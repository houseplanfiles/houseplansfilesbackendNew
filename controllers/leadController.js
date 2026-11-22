const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Lead = require("../models/leadModel");
const Inquiry = require("../models/inquiryModel");
const SellerInquiry = require("../models/sellerinquiryModel");
const CorporateInquiry = require("../models/corporateInquiryModel");
const LeadPreference = require("../models/leadPreferenceModel");

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

// @desc    Get ALL leads — only from Lead model
// @route   GET /api/leads
// @access  Public (softProtect)
const getLeads = asyncHandler(async (req, res) => {
  const currentUserId = req.user ? req.user._id.toString() : null;

  // 1. Fetch leads:
  // If a lead has allowedUsers specified, only those users (or buyer) can see it
  let filter = { status: { $in: ["Available", "Sold"] } };

  if (currentUserId) {
    filter = {
      status: { $in: ["Available", "Sold"] },
      $or: [
        { allowedUsers: { $exists: false } },
        { allowedUsers: { $size: 0 } },
        { allowedUsers: req.user._id },
        { buyer: req.user._id },
      ],
    };
  } else {
    // Unauthenticated visitors only see truly public leads without specific target restrictions
    filter = {
      status: { $in: ["Available", "Sold"] },
      $or: [
        { allowedUsers: { $exists: false } },
        { allowedUsers: { $size: 0 } },
      ],
    };
  }

  const adminLeads = await Lead.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  // 2. Add sourceType
  let allLeads = adminLeads.map((lead) => ({
    ...lead,
    sourceType: "admin_lead",
  }));

  // 3. Decide what to reveal using explicit boolean flag
  allLeads = allLeads.map((lead) => {
    const isBuyer =
      currentUserId &&
      lead.buyer &&
      lead.buyer.toString() === currentUserId;

    // Sold lead: only buyer sees contact
    if (lead.status === "Sold") {
      return isBuyer ? revealLead({ ...lead }) : maskLead({ ...lead });
    }
    // Available: always mask until purchased
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

const submitPublicLead = asyncHandler(async (req, res) => {
  const {
    name,
    phone,
    city,
    category,
    requirements,
    budget,
    qualityTier
  } = req.body;

  if (!name || !phone || !category || !city || !requirements) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  const validQuality = ["low", "medium", "high"].includes(qualityTier)
    ? qualityTier
    : "medium";

  // Create lead with default settings for a public submission
  const lead = await Lead.create({
    title: `${category} Requirement in ${city}`,
    category,
    city,
    budget: budget || "Not Specified",
    requirements,
    qualityTier: validQuality,
    price: 99, // default price for new leads
    clientName: name,
    clientPhone: phone,
    clientEmail: "", // optional
    status: "Pending" // user submitted leads must be approved by admin
  });

  if (lead) {
    res.status(201).json({ success: true, lead });
  } else {
    res.status(400);
    throw new Error("Invalid lead data");
  }
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
    qualityTier,
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

  const validQuality = ["low", "medium", "high"].includes(qualityTier)
    ? qualityTier
    : "medium";

  const lead = new Lead({
    title,
    category,
    city,
    budget,
    requirements,
    price,
    qualityTier: validQuality,
    clientName,
    clientPhone,
    clientEmail: clientEmail || "",
  });

  const createdLead = await lead.save();
  res.status(201).json(createdLead);
});

// @desc    Transfer/Assign a lead to a professional user directly by Admin
// @route   POST /api/leads/:id/transfer
// @access  Private/Admin
const transferLead = asyncHandler(async (req, res) => {
  const { targetUserId, targetUserEmail, targetUserPhone } = req.body;
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  const User = require("../models/userModel");
  let targetUser = null;

  if (targetUserId) {
    targetUser = await User.findById(targetUserId);
  } else if (targetUserEmail) {
    targetUser = await User.findOne({ email: targetUserEmail.trim().toLowerCase() });
  } else if (targetUserPhone) {
    targetUser = await User.findOne({ phone: targetUserPhone.trim() });
  }

  if (!targetUser) {
    res.status(404);
    throw new Error("Target professional user not found");
  }

  lead.buyer = targetUser._id;
  lead.status = "Sold";
  lead.paymentDetails = {
    razorpay_order_id: "ADMIN_ASSIGNED",
    razorpay_payment_id: `ASSIGNED_BY_${req.user._id}`,
    razorpay_signature: "ADMIN_OVERRIDE",
    purchasedAt: new Date(),
  };

  const updatedLead = await lead.save();

  // If this target user has an approved or pending lead preference request, increment deliveredCount
  try {
    const activePref = await LeadPreference.findOne({
      user: targetUser._id,
      status: { $in: ["approved", "pending", "contacted"] },
    }).sort({ createdAt: -1 });

    if (activePref) {
      activePref.deliveredCount = (activePref.deliveredCount || 0) + 1;
      if (activePref.deliveredCount >= activePref.leadCount) {
        activePref.status = "completed";
      }
      await activePref.save();
    }
  } catch (err) {
    console.error("Error updating leadPreference deliveredCount:", err);
  }

  res.json({
    message: `Lead transferred successfully to ${targetUser.name || targetUser.businessName || targetUser.email}`,
    lead: updatedLead,
  });
});

// @desc    Bulk transfer multiple leads to a single professional user (Admin only)
// @route   POST /api/leads/bulk-transfer
// @access  Private/Admin
const bulkTransferLeads = asyncHandler(async (req, res) => {
  const { leadIds, targetUserId, targetUserEmail, targetUserPhone } = req.body;

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    res.status(400);
    throw new Error("Please provide at least one leadId to transfer");
  }

  const User = require("../models/userModel");
  let targetUser = null;

  if (targetUserId) {
    targetUser = await User.findById(targetUserId);
  } else if (targetUserEmail) {
    targetUser = await User.findOne({ email: targetUserEmail.trim().toLowerCase() });
  } else if (targetUserPhone) {
    targetUser = await User.findOne({ phone: targetUserPhone.trim() });
  }

  if (!targetUser) {
    res.status(404);
    throw new Error("Target professional user not found");
  }

  const result = await Lead.updateMany(
    { _id: { $in: leadIds } },
    {
      $set: {
        buyer: targetUser._id,
        status: "Sold",
        paymentDetails: {
          razorpay_order_id: "BULK_ADMIN_ASSIGNED",
          razorpay_payment_id: `ASSIGNED_BY_${req.user._id}`,
          razorpay_signature: "ADMIN_OVERRIDE",
          purchasedAt: new Date(),
        },
      },
    }
  );

  // If this target user has an active lead preference request, increment deliveredCount by modifiedCount
  try {
    if (result.modifiedCount > 0) {
      const activePref = await LeadPreference.findOne({
        user: targetUser._id,
        status: { $in: ["approved", "pending", "contacted"] },
      }).sort({ createdAt: -1 });

      if (activePref) {
        activePref.deliveredCount = (activePref.deliveredCount || 0) + result.modifiedCount;
        if (activePref.deliveredCount >= activePref.leadCount) {
          activePref.status = "completed";
        }
        await activePref.save();
      }
    }
  } catch (err) {
    console.error("Error updating leadPreference deliveredCount for bulk transfer:", err);
  }

  res.json({
    message: `${result.modifiedCount} leads transferred successfully to ${targetUser.name || targetUser.businessName || targetUser.email}`,
    modifiedCount: result.modifiedCount,
  });
});

// @desc    Target / Offer a lead to specific selected contractors (Admin only)
// @route   POST /api/leads/:id/target-contractors
// @access  Private/Admin
const targetContractorsForLead = asyncHandler(async (req, res) => {
  const { contractorIds, isBroadcasted } = req.body;
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  // contractorIds is an array of user IDs
  if (Array.isArray(contractorIds)) {
    lead.allowedUsers = contractorIds;
  }
  if (isBroadcasted !== undefined) {
    lead.isBroadcasted = Boolean(isBroadcasted);
  }

  // If lead was pending, make it available so allowed users can see and buy it
  if (lead.status === "Pending") {
    lead.status = "Available";
  }

  const updatedLead = await lead.save();
  await updatedLead.populate("allowedUsers", "name businessName email phone city profession role");

  res.json({
    message: `Lead successfully targeted to ${lead.allowedUsers.length} contractor(s)`,
    lead: updatedLead,
  });
});

// @desc    Publish a lead to public lead board
// @route   POST /api/leads/:id/publish-public
// @access  Private/Admin
const publishLeadPublic = asyncHandler(async (req, res) => {
  const { price } = req.body;
  const lead = await Lead.findById(req.params.id);

  if (!lead) {
    res.status(404);
    throw new Error("Lead not found");
  }

  lead.status = "Available";
  lead.buyer = null;
  lead.allowedUsers = []; // Clear restriction so all contractors can see
  lead.isBroadcasted = true;
  if (price !== undefined && Number(price) >= 0) {
    lead.price = Number(price);
  }

  const updatedLead = await lead.save();
  res.json({
    message: "Lead published to public board successfully (open to all)",
    lead: updatedLead,
  });
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
  if (req.body.qualityTier && ["low", "medium", "high"].includes(req.body.qualityTier)) {
    lead.qualityTier = req.body.qualityTier;
  }
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

// @desc    Get leads targeted/assigned to currently logged in professional (Available for them to buy, masked)
// @route   GET /api/leads/my-targeted
// @access  Private
const getMyTargetedLeads = asyncHandler(async (req, res) => {
  // Find leads where allowedUsers contains current user AND status is Available (not yet bought)
  const leads = await Lead.find({
    allowedUsers: req.user._id,
    status: "Available",
  }).sort({ createdAt: -1 });

  // Mask sensitive contact details until purchased
  const masked = leads.map((lead) => maskLead({ ...lead.toObject() }));
  res.json(masked);
});

// @desc    Get leads purchased by the currently logged in user
// @route   GET /api/leads/my-unlocked
// @access  Private
const getMyUnlockedLeads = asyncHandler(async (req, res) => {
  const leads = await Lead.find({ buyer: req.user._id }).sort({ createdAt: -1 });
  
  // They are the buyer, so reveal contacts
  const revealedLeads = leads.map(lead => revealLead({ ...lead.toObject() }));
  
  res.json(revealedLeads);
});

module.exports = {
  getLeads,
  getLeadById,
  getAdminAllLeads,
  createLead,
  updateLead,
  deleteLead,
  transferLead,
  bulkTransferLeads,
  targetContractorsForLead,
  publishLeadPublic,
  createLeadRazorpayOrder,
  verifyLeadPayment,
  getMyTargetedLeads,
  getMyUnlockedLeads,
  submitPublicLead,
};
