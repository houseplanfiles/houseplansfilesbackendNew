const asyncHandler = require("express-async-handler");
const LeadPreference = require("../models/leadPreferenceModel.js");

// POST /api/lead-preferences  (professional)
const createLeadPreference = asyncHandler(async (req, res) => {
  const { frequency, leadCount, qualityPreference, city, serviceType, budget, phone, notes } =
    req.body;
  if (!["weekly", "monthly", "yearly"].includes(frequency)) {
    res.status(400);
    throw new Error("Please select weekly, monthly or yearly");
  }
  const count = Number(leadCount);
  if (!count || count < 1) {
    res.status(400);
    throw new Error("Please enter a valid number of leads");
  }
  const validQuality = ["all", "low", "medium", "high"].includes(qualityPreference)
    ? qualityPreference
    : "all";
  const pref = await LeadPreference.create({
    user: req.user._id,
    frequency,
    leadCount: count,
    qualityPreference: validQuality,
    city: city || req.user.city || "",
    serviceType: serviceType || "",
    budget: budget || "",
    phone: phone || req.user.phone || "",
    notes: notes || "",
  });
  res.status(201).json(pref);
});

// GET /api/lead-preferences/my  (professional)
const getMyLeadPreferences = asyncHandler(async (req, res) => {
  const prefs = await LeadPreference.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(prefs);
});

// GET /api/lead-preferences  (admin)
const getAllLeadPreferences = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== "all")
    filter.status = req.query.status;
  if (req.query.frequency && req.query.frequency !== "all")
    filter.frequency = req.query.frequency;
  if (req.query.qualityPreference && req.query.qualityPreference !== "all")
    filter.qualityPreference = req.query.qualityPreference;
  const prefs = await LeadPreference.find(filter)
    .populate("user", "name email phone role profession city companyName")
    .sort({ createdAt: -1 });
  res.json(prefs);
});

// PUT /api/lead-preferences/:id  (admin)
const updateLeadPreferenceStatus = asyncHandler(async (req, res) => {
  const pref = await LeadPreference.findById(req.params.id);
  if (!pref) {
    res.status(404);
    throw new Error("Lead preference not found");
  }
  if (req.body.status) pref.status = req.body.status;
  if (req.body.adminNote !== undefined) pref.adminNote = req.body.adminNote;
  await pref.save();
  await pref.populate("user", "name email phone role profession city companyName");
  res.json(pref);
});

module.exports = {
  createLeadPreference,
  getMyLeadPreferences,
  getAllLeadPreferences,
  updateLeadPreferenceStatus,
};
