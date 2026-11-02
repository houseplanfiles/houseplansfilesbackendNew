const express = require("express");
const {
  createLeadPreference,
  getMyLeadPreferences,
  getAllLeadPreferences,
  updateLeadPreferenceStatus,
} = require("../controllers/leadPreferenceController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").post(protect, createLeadPreference).get(protect, admin, getAllLeadPreferences);
router.get("/my", protect, getMyLeadPreferences);
router.put("/:id", protect, admin, updateLeadPreferenceStatus);

module.exports = router;
