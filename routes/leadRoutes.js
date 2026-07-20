const express = require("express");
const router = express.Router();
const {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  createLeadRazorpayOrder,
  verifyLeadPayment,
} = require("../controllers/leadController");
const { protect, admin, softProtect } = require("../middleware/authMiddleware");

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
