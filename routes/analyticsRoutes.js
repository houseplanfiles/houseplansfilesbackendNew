const express = require("express");
const router = express.Router();
const { trackAnalytics, getAdminAnalytics, getUserAnalyticsReport } = require("../controllers/analyticsController");
const { protect, admin } = require("../middleware/authMiddleware");

// @route POST /api/analytics/track
router.post("/track", trackAnalytics);

// @route GET /api/analytics/admin
router.get("/admin", protect, admin, getAdminAnalytics);

// @route GET /api/analytics/admin/user-reports
router.get("/admin/user-reports", protect, admin, getUserAnalyticsReport);

module.exports = router;
