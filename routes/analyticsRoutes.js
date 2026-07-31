const express = require("express");
const router = express.Router();
const { trackAnalytics, getAdminAnalytics } = require("../controllers/analyticsController");
const { protect, admin } = require("../middleware/authMiddleware");

// @route POST /api/analytics/track
router.post("/track", trackAnalytics);

// @route GET /api/analytics/admin
router.get("/admin", protect, admin, getAdminAnalytics);

module.exports = router;
