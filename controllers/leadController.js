const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Lead = require("../models/leadModel");

// Helper to clean env variables
const getEnv = (key) => (process.env[key] ? process.env[key].trim() : "");

const razorpay = new Razorpay({
  key_id: getEnv("RAZORPAY_KEY_ID"),
  key_secret: getEnv("RAZORPAY_KEY_SECRET"),
});

// @desc    Get all leads (Privacy-Masked for non-buyers)
// @route   GET /api/leads
// @access  Public (softProtect)
const getLeads = asyncHandler(async (req, res) => {
  const leads = await Lead.find({}).sort({ createdAt: -1 });
  
  const currentUserId = req.user ? req.user._id.toString() : null;

  const maskedLeads = leads.map((lead) => {
    const isBuyer = currentUserId && lead.buyer && lead.buyer.toString() === currentUserId;
    
    // Mask sensitive details if it's available or bought by someone else
    if (lead.status === "Available" || !isBuyer) {
      const leadObj = lead.toObject();
      leadObj.clientName = "Client (Locked)";
      leadObj.clientPhone = "Locked (Pay to Unlock)";
      leadObj.clientEmail = "Locked (Pay to Unlock)";
      return leadObj;
    }
    return lead;
  });

  res.json(maskedLeads);
});

// @desc    Get single lead by ID (Privacy-Masked)
// @route   GET /api/leads/:id
// @access  Public (softProtect)
const getLeadById = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  const currentUserId = req.user ? req.user._id.toString() : null;
  const isBuyer = currentUserId && lead.buyer && lead.buyer.toString() === currentUserId;

  if (lead.status === "Available" || !isBuyer) {
    const leadObj = lead.toObject();
    leadObj.clientName = "Client (Locked)";
    leadObj.clientPhone = "Locked (Pay to Unlock)";
    leadObj.clientEmail = "Locked (Pay to Unlock)";
    return res.json(leadObj);
  }

  res.json(lead);
});

// @desc    Create a new lead (Admin only)
// @route   POST /api/leads
// @access  Private/Admin
const createLead = asyncHandler(async (req, res) => {
  const {
    title,
    category,
    city,
    budget,
    requirements,
    price,
    clientName,
    clientPhone,
    clientEmail,
  } = req.body;

  if (
    !title ||
    !category ||
    !city ||
    !budget ||
    !requirements ||
    price === undefined ||
    !clientName ||
    !clientPhone
  ) {
    res.status(400);
    throw new Error("Please provide all required fields.");
  }

  const lead = new Lead({
    title,
    category,
    city,
    budget,
    requirements,
    price,
    clientName,
    clientPhone,
    clientEmail: clientEmail || "",
  });

  const createdLead = await lead.save();
  res.status(201).json(createdLead);
});

// @desc    Update a lead (Admin only)
// @route   PUT /api/leads/:id
// @access  Private/Admin
const updateLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  lead.title = req.body.title || lead.title;
  lead.category = req.body.category || lead.category;
  lead.city = req.body.city || lead.city;
  lead.budget = req.body.budget || lead.budget;
  lead.requirements = req.body.requirements || lead.requirements;
  lead.price = req.body.price !== undefined ? req.body.price : lead.price;
  lead.clientName = req.body.clientName || lead.clientName;
  lead.clientPhone = req.body.clientPhone || lead.clientPhone;
  lead.clientEmail = req.body.clientEmail !== undefined ? req.body.clientEmail : lead.clientEmail;
  lead.status = req.body.status || lead.status;
  lead.buyer = req.body.buyer !== undefined ? req.body.buyer : lead.buyer;

  const updatedLead = await lead.save();
  res.json(updatedLead);
});

// @desc    Delete a lead (Admin only)
// @route   DELETE /api/leads/:id
// @access  Private/Admin
const deleteLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  await lead.deleteOne();
  res.json({ message: "Lead removed successfully" });
});

// @desc    Create Razorpay Order for purchasing a lead
// @route   POST /api/leads/:id/buy
// @access  Private
const createLeadRazorpayOrder = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  if (lead.status === "Sold") {
    res.status(400);
    throw new Error("This lead is already sold.");
  }

  const options = {
    amount: Math.round(lead.price * 100), // In paisa
    currency: "INR",
    receipt: `lead_${lead._id.toString()}`,
  };

  try {
    const razorpayOrder = await razorpay.orders.create(options);
    res.json({
      orderId: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
    });
  } catch (error) {
    console.error("RAZORPAY ERROR:", error);
    res.status(500);
    throw new Error("Could not create Razorpay order for this lead.");
  }
});

// @desc    Verify Razorpay payment and mark lead as Sold
// @route   POST /api/leads/:id/verify
// @access  Private
const verifyLeadPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  if (lead.status === "Sold") {
    res.status(400);
    throw new Error("This lead is already sold.");
  }

  // Verify Signature
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", getEnv("RAZORPAY_KEY_SECRET"))
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    lead.status = "Sold";
    lead.buyer = req.user._id;
    lead.paymentDetails = {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      purchasedAt: new Date(),
    };

    const updatedLead = await lead.save();
    res.json(updatedLead);
  } else {
    res.status(400);
    throw new Error("Payment signature verification failed.");
  }
});

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  createLeadRazorpayOrder,
  verifyLeadPayment,
};
