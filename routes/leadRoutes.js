const express = require("express");
const router = express.Router();
const {
  getLeads,
  getLeadById,
  getAdminAllLeads,
  createLead,
  updateLead,
  deleteLead,
  createLeadRazorpayOrder,
  verifyLeadPayment,
  getMyUnlockedLeads,
} = require("../controllers/leadController");
const { protect, admin, softProtect } = require("../middleware/authMiddleware");

// Contractor/User only: get purchased leads
router.route("/my-unlocked").get(protect, getMyUnlockedLeads);

// Admin-only: full unmasked view of ALL inquiries+leads
router.route("/admin/all").get(protect, admin, getAdminAllLeads);


router
  .route("/")
  .get(softProtect, getLeads)
  .post(protect, admin, createLead);

router
  .route("/:id")
  .get(softProtect, getLeadById)
  .put(protect, admin, updateLead)
  .delete(protect, admin, deleteLead);

router.route("/:id/buy").post(protect, createLeadRazorpayOrder);
router.route("/:id/verify").post(protect, verifyLeadPayment);

module.exports = router;
