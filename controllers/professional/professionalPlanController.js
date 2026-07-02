const asyncHandler = require("express-async-handler");
const ProfessionalPlan = require("../../models/professionalPlanModel.js");

const normalizeToArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
};

const getAllApprovedPlans = asyncHandler(async (req, res) => {
  const pageSize = Number(req.query.limit) || 12;
  const page = Number(req.query.pageNumber) || 1;
  const keyword = req.query.keyword
    ? { name: { $regex: req.query.keyword, $options: "i" } }
    : {};
  const query = { status: "Approved", ...keyword };

  const count = await ProfessionalPlan.countDocuments(query);
  const plans = await ProfessionalPlan.find(query)
    .populate("user", "name profession")
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ createdAt: -1 });

  res.json({ plans, page, pages: Math.ceil(count / pageSize) });
});

const getMyPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(plans);
});

const getAllPlansForAdmin = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({})
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  if (plans) {
    res.json(plans);
  } else {
    res.status(404);
    throw new Error("No plans found");
  }
});

const getPlanById = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (plan) {
    res.json(plan);
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

const getPlanBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  const planId = slug.split("-").pop();
  if (!planId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(404);
    throw new Error("Plan not found (Invalid ID format)");
  }
  const plan = await ProfessionalPlan.findById(planId);
  if (plan) {
    res.json(plan);
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

const createPlan = asyncHandler(async (req, res) => {
  if (
    !["professional", "Contractor"].includes(req.user.role) ||
    !req.user.isApproved
  ) {
    res.status(403);
    throw new Error(
      "Access Denied. Only approved professionals can create plans."
    );
  }
  // (Your existing createPlan logic)
});

const updatePlan = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);

  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }

  if (
    plan.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(401);
    throw new Error("Not authorized to update this plan");
  }

  Object.keys(req.body).forEach((key) => {
    plan[key] = req.body[key];
  });

  if (req.files) {
    const getFilePath = (file) => file.location || file.path;
    if (req.files.mainImage)
      plan.mainImage = getFilePath(req.files.mainImage[0]);
    if (req.files.galleryImages)
      plan.galleryImages = req.files.galleryImages.map(getFilePath);
    if (req.files.planFile) plan.planFile = req.files.planFile.map(getFilePath);
  }

  const updatedPlan = await plan.save();
  res.json(updatedPlan);
});

const deletePlan = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);

  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }

  if (
    plan.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(401);
    throw new Error("Not authorized to delete this plan");
  }

  await plan.deleteOne();
  res.json({ message: "Plan removed successfully" });
});

const createPlanReview = asyncHandler(async (req, res) => {
  // (Your existing createPlanReview logic)
});

module.exports = {
  getAllApprovedPlans,
  getMyPlans,
  getPlanById,
  getPlanBySlug,
  createPlan,
  updatePlan,
  deletePlan,
  createPlanReview,
  getAllPlansForAdmin,
};
