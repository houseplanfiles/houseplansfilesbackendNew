const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Lead = require("../models/leadModel");
const Inquiry = require("../models/inquiryModel");
const SellerInquiry = require("../models/sellerinquiryModel");
const CorporateInquiry = require("../models/corporateInquiryModel");

// Helper to clean env variables
const getEnv = (key) => (process.env[key] ? process.env[key].trim() : "");

const razorpay = new Razorpay({
  key_id: getEnv("RAZORPAY_KEY_ID"),
  key_secret: getEnv("RAZORPAY_KEY_SECRET"),
});

// Helper: mask contact details — add explicit contactRevealed flag
const maskLead = (leadObj) => {
  leadObj.clientName = "";
  leadObj.clientPhone = "";
  leadObj.clientEmail = "";
  leadObj.contactRevealed = false;
  return leadObj;
};

const revealLead = (leadObj) => {
  leadObj.contactRevealed = true;
  return leadObj;
};

// @desc    Get ALL leads — aggregated from Inquiry + SellerInquiry + CorporateInquiry + Lead models
// @route   GET /api/leads
// @access  Public (softProtect)
const getLeads = asyncHandler(async (req, res) => {
  const currentUserId = req.user ? req.user._id.toString() : null;

  // 1. Fetch from all inquiry sources in parallel
  const [adminLeads, contractorInquiries, sellerInquiries, corporateInquiries] =
    await Promise.all([
      Lead.find({}).sort({ createdAt: -1 }).lean(),
      Inquiry.find({}).populate("recipient", "name city profession").sort({ createdAt: -1 }).lean(),
      SellerInquiry.find({}).populate("product", "name category").sort({ createdAt: -1 }).lean(),
      CorporateInquiry.find({}).sort({ createdAt: -1 }).lean(),
    ]);

  // 2. Normalize: Convert Inquiry → lead shape
  const fromContractor = contractorInquiries.map((inq) => ({
    _id: inq._id,
    sourceType: "contractor_inquiry",
    title: `Enquiry for ${inq.recipientInfo?.role || "Professional"}: ${inq.recipientInfo?.name || ""}`,
    category: inq.recipientInfo?.role || "General",
    city: inq.recipientInfo?.city || "India",
    budget: "As per discussion",
    requirements: inq.requirements,
    price: 0,
    clientName: inq.senderName,
    clientPhone: inq.senderWhatsapp,
    clientEmail: inq.senderEmail,
    status: "Available",
    buyer: null,
    createdAt: inq.createdAt,
  }));

  // 3. Normalize: Convert SellerInquiry → lead shape
  const fromSeller = sellerInquiries.map((inq) => ({
    _id: inq._id,
    sourceType: "seller_inquiry",
    title: `Product Enquiry: ${inq.product?.name || "Product"}`,
    category: inq.product?.category || "Building Material",
    city: "India",
    budget: "As per discussion",
    requirements: inq.message,
    price: 0,
    clientName: inq.name,
    clientPhone: inq.phone,
    clientEmail: inq.email,
    status: "Available",
    buyer: null,
    createdAt: inq.createdAt,
  }));

  // 4. Normalize: Convert CorporateInquiry → lead shape
  const fromCorporate = corporateInquiries.map((inq) => ({
    _id: inq._id,
    sourceType: "corporate_inquiry",
    title: `Corporate Project: ${inq.projectType} - ${inq.companyName}`,
    category: inq.projectType || "Corporate",
    city: "India",
    budget: "Enterprise Budget",
    requirements: inq.projectDetails,
    price: 0,
    clientName: inq.contactPerson,
    clientPhone: inq.phoneNumber,
    clientEmail: inq.workEmail,
    status: "Available",
    buyer: null,
    createdAt: inq.createdAt,
  }));

  // 5. Admin-created leads
  const fromAdminLeads = adminLeads.map((lead) => ({
    ...lead,
    sourceType: "admin_lead",
  }));

  // 6. Merge and sort
  let allLeads = [
    ...fromAdminLeads,
    ...fromContractor,
    ...fromSeller,
    ...fromCorporate,
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // 7. Decide what to reveal using explicit boolean flag
  allLeads = allLeads.map((lead) => {
    const isBuyer =
      currentUserId &&
      lead.buyer &&
      lead.buyer.toString() === currentUserId;

    if (lead.sourceType === "admin_lead") {
      // Sold lead: only buyer sees contact
      if (lead.status === "Sold") {
        return isBuyer ? revealLead({ ...lead }) : maskLead({ ...lead });
      }
      // Available: always mask until purchased
      return maskLead({ ...lead });
    }

    // Inquiry-based leads: always masked (admin hasn't priced them yet)
    return maskLead({ ...lead });
  });

  res.json(allLeads);
});


// @desc    Get single lead by ID
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
    return res.json(maskLead({ ...lead.toObject() }));
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

// @desc    Admin: Get ALL leads+inquiries UNMASKED (full contact details)
// @route   GET /api/leads/admin/all
// @access  Private/Admin
const getAdminAllLeads = asyncHandler(async (req, res) => {
  const [adminLeads, contractorInquiries, sellerInquiries, corporateInquiries] =
    await Promise.all([
      Lead.find({}).sort({ createdAt: -1 }).lean(),
      Inquiry.find({}).populate("recipient", "name city profession").sort({ createdAt: -1 }).lean(),
      SellerInquiry.find({}).populate("product", "name category").sort({ createdAt: -1 }).lean(),
      CorporateInquiry.find({}).sort({ createdAt: -1 }).lean(),
    ]);

  const fromContractor = contractorInquiries.map((inq) => ({
    _id: inq._id,
    sourceType: "contractor_inquiry",
    title: `Enquiry for ${inq.recipientInfo?.role || "Professional"}: ${inq.recipientInfo?.name || ""}`,
    category: inq.recipientInfo?.role || "General",
    city: inq.recipientInfo?.city || "India",
    budget: "As per discussion",
    requirements: inq.requirements,
    price: 0,
    clientName: inq.senderName,
    clientPhone: inq.senderWhatsapp,
    clientEmail: inq.senderEmail,
    status: "Available",
    buyer: null,
    createdAt: inq.createdAt,
  }));

  const fromSeller = sellerInquiries.map((inq) => ({
    _id: inq._id,
    sourceType: "seller_inquiry",
    title: `Product Enquiry: ${inq.product?.name || "Product"}`,
    category: inq.product?.category || "Building Material",
    city: "India",
    budget: "As per discussion",
    requirements: inq.message,
    price: 0,
    clientName: inq.name,
    clientPhone: inq.phone,
    clientEmail: inq.email,
    status: "Available",
    buyer: null,
    createdAt: inq.createdAt,
  }));

  const fromCorporate = corporateInquiries.map((inq) => ({
    _id: inq._id,
    sourceType: "corporate_inquiry",
    title: `Corporate Project: ${inq.projectType} — ${inq.companyName}`,
    category: inq.projectType || "Corporate",
    city: "India",
    budget: "Enterprise Budget",
    requirements: inq.projectDetails,
    price: 0,
    clientName: inq.contactPerson,
    clientPhone: inq.phoneNumber,
    clientEmail: inq.workEmail,
    status: "Available",
    buyer: null,
    createdAt: inq.createdAt,
  }));

  const fromAdminLeads = adminLeads.map((lead) => ({ ...lead, sourceType: "admin_lead" }));

  const allLeads = [
    ...fromAdminLeads,
    ...fromContractor,
    ...fromSeller,
    ...fromCorporate,
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(allLeads); // No masking — admin sees everything
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
  getAdminAllLeads,
  createLead,
  updateLead,
  deleteLead,
  createLeadRazorpayOrder,
  verifyLeadPayment,
};
