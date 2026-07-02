const express = require("express");
const router = express.Router();
const {
  getAllApprovedPlans,
  getMyPlans,
  getPlanById,
  getPlanBySlug,
  createPlan,
  updatePlan,
  deletePlan,
  createPlanReview,
  getAllPlansForAdmin,
} = require("../controllers/professional/professionalPlanController.js");
const {
  protect,
  professionalProtect,
  admin,
} = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");
const handleFileUploads = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "headerImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 5 },
  { name: "planFile", maxCount: 10 },
]);
router.route("/").get(getAllApprovedPlans);
router
  .route("/")
  .post(protect, professionalProtect, handleFileUploads, createPlan);
router.route("/my-plans").get(protect, professionalProtect, getMyPlans);
router.route("/admin/all").get(protect, admin, getAllPlansForAdmin);
router.route("/slug/:slug").get(getPlanBySlug);
router
  .route("/:id")
  .get(getPlanById)
  .put(protect, handleFileUploads, updatePlan) // Corrected
  .delete(protect, deletePlan); // Corrected

router.route("/:id/reviews").post(protect, createPlanReview);
module.exports = router;
