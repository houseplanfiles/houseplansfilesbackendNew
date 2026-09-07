const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Product = require("../models/productModel");
const ProfessionalPlan = require("../models/professionalPlanModel");
const SellerProduct = require("../models/sellerProductModel");

// @desc    Track view or click/contact event
// @route   POST /api/analytics/track
// @access  Public
const trackAnalytics = asyncHandler(async (req, res) => {
  const { type, id, action } = req.body;

  if (!type || !id || !action) {
    res.status(400);
    throw new Error("Please provide type, id, and action");
  }

  // type can be 'user', 'product', 'plan', 'sellerProduct'
  // action can be 'view', 'contact'

  const cleanId = typeof id === "string" ? id.trim() : id;

  try {
    if (type === "user") {
      const field = action === "view" ? "profileViews" :
                    action === "contact" ? "contactClicks" :
                    action === "whatsapp_click" ? "whatsappClicks" :
                    action === "call_click" ? "callClicks" : null;
      if (field) {
        const user = await User.findByIdAndUpdate(cleanId, { $inc: { [field]: 1 } }, { new: true });
        if (user) return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
      }
    } else if (type === "product") {
      if (action === "view") {
        const product = await Product.findByIdAndUpdate(cleanId, { $inc: { views: 1 } }, { new: true });
        if (product) return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
      }
    } else if (type === "plan") {
      if (action === "view") {
        const plan = await ProfessionalPlan.findByIdAndUpdate(cleanId, { $inc: { views: 1 } }, { new: true });
        if (plan) return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
      }
    } else if (type === "sellerProduct") {
      if (action === "view") {
        const sellerProduct = await SellerProduct.findByIdAndUpdate(cleanId, { $inc: { views: 1 } }, { new: true });
        if (sellerProduct) return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
      }
    }

    res.status(404);
    throw new Error(`${type} not found`);
  } catch (error) {
    res.status(500);
    throw new Error("Error tracking analytics: " + error.message);
  }
});

// @desc    Get analytics stats for admin
// @route   GET /api/analytics/admin
// @access  Private/Admin
const getAdminAnalytics = asyncHandler(async (req, res) => {
  // Aggregate total profile views and product views
  const totalProfileViews = await User.aggregate([
    { 
      $group: { 
        _id: null, 
        totalViews: { $sum: { $ifNull: ["$profileViews", 0] } }, 
        totalContactClicks: { 
          $sum: { 
            $add: [
              { $ifNull: ["$contactClicks", 0] }, 
              { $ifNull: ["$whatsappClicks", 0] }, 
              { $ifNull: ["$callClicks", 0] }
            ] 
          } 
        } 
      } 
    }
  ]);

  const totalProductViews = await Product.aggregate([
    { $group: { _id: null, totalViews: { $sum: { $ifNull: ["$views", 0] } } } }
  ]);

  const totalPlanViews = await ProfessionalPlan.aggregate([
    { $group: { _id: null, totalViews: { $sum: { $ifNull: ["$views", 0] } } } }
  ]);

  const totalSellerProductViews = await SellerProduct.aggregate([
    { $group: { _id: null, totalViews: { $sum: { $ifNull: ["$views", 0] } } } }
  ]);

  res.json({
    profileViews: totalProfileViews[0]?.totalViews || 0,
    contactClicks: totalProfileViews[0]?.totalContactClicks || 0,
    productViews: totalProductViews[0]?.totalViews || 0,
    planViews: totalPlanViews[0]?.totalViews || 0,
    sellerProductViews: totalSellerProductViews[0]?.totalViews || 0,
  });
});

  // @desc    Get detailed user reports for admin
  // @route   GET /api/analytics/admin/user-reports
  // @access  Private/Admin
  const getUserAnalyticsReport = asyncHandler(async (req, res) => {
    // Find all professionals, sellers, contractors, architects
    const users = await User.find({
      role: { $in: ["professional", "seller", "Contractor", "contractor", "Architect", "architect", "Professional", "Seller"] }
    }).select("name email role companyName businessName profileViews contactClicks whatsappClicks callClicks phone");

  // We need to find project views per user.
  // This can be heavy, so we fetch aggregations.
  const productViews = await Product.aggregate([
    { $group: { _id: "$user", totalViews: { $sum: "$views" } } }
  ]);
  
  const planViews = await ProfessionalPlan.aggregate([
    { $group: { _id: "$user", totalViews: { $sum: "$views" } } }
  ]);

  const sellerProductViews = await SellerProduct.aggregate([
    { $group: { _id: "$seller", totalViews: { $sum: "$views" } } }
  ]);

  const statsMap = {};
  
  productViews.forEach(p => {
    if (p._id) statsMap[p._id.toString()] = (statsMap[p._id.toString()] || 0) + p.totalViews;
  });
  
  planViews.forEach(p => {
    if (p._id) statsMap[p._id.toString()] = (statsMap[p._id.toString()] || 0) + p.totalViews;
  });
  
  sellerProductViews.forEach(p => {
    if (p._id) statsMap[p._id.toString()] = (statsMap[p._id.toString()] || 0) + p.totalViews;
  });

  const report = users.map(u => ({
    _id: u._id,
    name: u.name || u.businessName || u.companyName || "Unknown",
    email: u.email,
    phone: u.phone,
    role: u.role,
    companyName: u.companyName,
    profileViews: u.profileViews || 0,
    contactClicks: u.contactClicks || 0,
    whatsappClicks: u.whatsappClicks || 0,
    callClicks: u.callClicks || 0,
    projectViews: statsMap[u._id.toString()] || 0
  }));

  res.json(report);
});

module.exports = {
  trackAnalytics,
  getAdminAnalytics,
  getUserAnalyticsReport
};
