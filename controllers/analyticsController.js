const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const Product = require("../models/productModel");
const ProfessionalPlan = require("../models/professionalPlanModel");
const SellerProduct = require("../models/sellerProductModel");

const AnalyticsLog = require("../models/analyticsLogModel");

// @desc    Track view or click/contact event
// @route   POST /api/analytics/track
// @access  Public
const trackAnalytics = asyncHandler(async (req, res) => {
  const { type, id, action } = req.body;

  if (!type || !id || !action) {
    res.status(400);
    throw new Error("Please provide type, id, and action");
  }

  const cleanId = typeof id === "string" ? id.trim() : id;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

const getTodayDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const updateDailyUserAnalytics = async (userId, field) => {
  const today = getTodayDateString();
  const user = await User.findById(userId);
  if (!user) return;
  user[field] = (user[field] || 0) + 1;
  const daily = user.dailyAnalytics.find(d => d.date === today);
  if (daily) {
    daily[field] = (daily[field] || 0) + 1;
  } else {
    user.dailyAnalytics.push({ date: today, [field]: 1 });
  }
  await user.save();
};

const updateDailyProductAnalytics = async (productId) => {
  const today = getTodayDateString();
  const product = await Product.findById(productId);
  if (!product) return;
  product.views = (product.views || 0) + 1;
  const daily = product.dailyAnalytics.find(d => d.date === today);
  if (daily) {
    daily.views = (daily.views || 0) + 1;
  } else {
    product.dailyAnalytics.push({ date: today, views: 1 });
  }
  await product.save();
  return product.user; // Return owner for cascading updates
};

const updateDailySellerProductAnalytics = async (sellerProductId) => {
  const today = getTodayDateString();
  const product = await SellerProduct.findById(sellerProductId);
  if (!product) return;
  product.views = (product.views || 0) + 1;
  const daily = product.dailyAnalytics.find(d => d.date === today);
  if (daily) {
    daily.views = (daily.views || 0) + 1;
  } else {
    product.dailyAnalytics.push({ date: today, views: 1 });
  }
  await product.save();
  return product.seller;
};

// Helper for IP tracking
const checkAndLogIp = async (targetId, targetModel, actionName) => {
  if (ipAddress === 'unknown') return true; // Can't track, allow
  
  const existing = await AnalyticsLog.findOne({
    targetId,
    targetModel,
    action: actionName,
    ipAddress
  });
  
  if (existing) return false; // Already tracked
  
  await AnalyticsLog.create({
    targetId,
    targetModel,
    action: actionName,
    ipAddress
  });
  
  return true; // Newly tracked
};

try {
    if (type === "user") {
      const field = action === "view" ? "profileViews" :
                    action === "contact" ? "contactClicks" :
                    action === "whatsapp_click" ? "whatsappClicks" :
                    action === "call_click" ? "callClicks" : null;
      if (field) {
        // Enforce IP tracking for WhatsApp and Call clicks
        if (action === "whatsapp_click" || action === "call_click") {
          const shouldCount = await checkAndLogIp(cleanId, "User", action);
          if (!shouldCount) {
             return res.status(200).json({ success: true, message: "Analytics already tracked for this IP" });
          }
        }
        await updateDailyUserAnalytics(cleanId, field);
        return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
      }
    } else if (type === "product") {
      if (action === "view") {
        const ownerId = await updateDailyProductAnalytics(cleanId);
        if (ownerId) {
          await updateDailyUserAnalytics(ownerId, "profileViews");
        }
        return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
      }
    } else if (type === "plan") {
      if (action === "view") {
        const plan = await ProfessionalPlan.findByIdAndUpdate(cleanId, { $inc: { views: 1 } }, { new: true });
        if (plan && plan.user) {
          await updateDailyUserAnalytics(plan.user, "profileViews");
        }
        if (plan) return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
      }
    } else if (type === "sellerProduct") {
      if (action === "view") {
        const sellerId = await updateDailySellerProductAnalytics(cleanId);
        if (sellerId) {
          await updateDailyUserAnalytics(sellerId, "profileViews");
        }
        return res.status(200).json({ success: true, message: "Analytics tracked successfully" });
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
        },
        totalWhatsappClicks: { $sum: { $ifNull: ["$whatsappClicks", 0] } },
        totalCallClicks: { $sum: { $ifNull: ["$callClicks", 0] } }
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
    whatsappClicks: totalProfileViews[0]?.totalWhatsappClicks || 0,
    callClicks: totalProfileViews[0]?.totalCallClicks || 0,
    productViews: totalProductViews[0]?.totalViews || 0,
    planViews: totalPlanViews[0]?.totalViews || 0,
    sellerProductViews: totalSellerProductViews[0]?.totalViews || 0,
  });
});

  // @desc    Get detailed user reports for admin
  // @route   GET /api/analytics/admin/user-reports
  // @access  Private/Admin
  const getUserAnalyticsReport = asyncHandler(async (req, res) => {
    const { timeRange } = req.query; // 'today', '7d', '1m', '3m', '6m', '1y'

    const getDateThreshold = (range) => {
      const d = new Date();
      d.setHours(0,0,0,0);
      if (range === 'today') return d;
      if (range === '7d') d.setDate(d.getDate() - 7);
      else if (range === '1m') d.setMonth(d.getMonth() - 1);
      else if (range === '3m') d.setMonth(d.getMonth() - 3);
      else if (range === '6m') d.setMonth(d.getMonth() - 6);
      else if (range === '1y') d.setFullYear(d.getFullYear() - 1);
      else return null;
      return d;
    };

    const thresholdDate = getDateThreshold(timeRange);

    // Find all professionals, sellers, contractors, architects
    const users = await User.find({
      role: { $in: ["professional", "seller", "Contractor", "contractor", "Architect", "architect", "Professional", "Seller"] }
    }).select("name email role companyName businessName profileViews contactClicks whatsappClicks callClicks phone dailyAnalytics");

  const products = await Product.find().select("user dailyAnalytics views");
  const plans = await ProfessionalPlan.find().select("user dailyAnalytics views");
  const sellerProducts = await SellerProduct.find().select("seller dailyAnalytics views");

  const statsMap = {}; 

  const processDaily = (items, userField) => {
    items.forEach(item => {
      const uId = item[userField];
      if (!uId) return;
      const uIdStr = uId.toString();
      if (!statsMap[uIdStr]) statsMap[uIdStr] = 0;

      if (thresholdDate && item.dailyAnalytics && item.dailyAnalytics.length > 0) {
        item.dailyAnalytics.forEach(d => {
          if (new Date(d.date) >= thresholdDate) {
            statsMap[uIdStr] += (d.views || 0);
          }
        });
      } else if (!thresholdDate) {
        statsMap[uIdStr] += (item.views || 0);
      }
    });
  };

  processDaily(products, 'user');
  processDaily(plans, 'user');
  processDaily(sellerProducts, 'seller');

  const report = users.map(u => {
    let profileViews = 0, contactClicks = 0, whatsappClicks = 0, callClicks = 0;

    if (thresholdDate && u.dailyAnalytics && u.dailyAnalytics.length > 0) {
      u.dailyAnalytics.forEach(d => {
        if (new Date(d.date) >= thresholdDate) {
          profileViews += (d.profileViews || 0);
          contactClicks += (d.contactClicks || 0);
          whatsappClicks += (d.whatsappClicks || 0);
          callClicks += (d.callClicks || 0);
        }
      });
    } else if (!thresholdDate) {
      profileViews = u.profileViews || 0;
      contactClicks = u.contactClicks || 0;
      whatsappClicks = u.whatsappClicks || 0;
      callClicks = u.callClicks || 0;
    }

    return {
      _id: u._id,
      name: u.name || u.businessName || u.companyName || "Unknown",
      email: u.email,
      phone: u.phone,
      role: u.role,
      companyName: u.companyName,
      profileViews,
      contactClicks,
      whatsappClicks,
      callClicks,
      projectViews: statsMap[u._id.toString()] || 0
    };
  });

  res.json(report);
});

module.exports = {
  trackAnalytics,
  getAdminAnalytics,
  getUserAnalyticsReport
};
