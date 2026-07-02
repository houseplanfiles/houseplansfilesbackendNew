const express = require("express");
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUserByAdmin,
  getUserStats,
  getSellerPublicProfile,
  getContractorPublicProfile,
  forgotPassword,
  resetPassword,
  addProjectReview,
  updateProjectSEO,
  getAllContractorProjects,
} = require("../controllers/userController");

const upload = require("../middleware/uploadMiddleware");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

const handleUserUploads = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "businessCertification", maxCount: 1 },
  { name: "shopImage", maxCount: 1 },
  { name: "portfolio", maxCount: 1 },
  { name: "coverPhoto", maxCount: 1 },
  { name: "workSample_images_0", maxCount: 5 },
  { name: "workSample_images_1", maxCount: 5 },
  { name: "workSample_images_2", maxCount: 5 },
  { name: "workSample_images_3", maxCount: 5 },
  { name: "workSample_images_4", maxCount: 5 },
  { name: "workSample_images_5", maxCount: 5 },
  { name: "workSample_images_6", maxCount: 5 },
  { name: "workSample_images_7", maxCount: 5 },
  { name: "workSample_images_8", maxCount: 5 },
  { name: "workSample_images_9", maxCount: 5 },
  { name: "package_pdf_0", maxCount: 1 },
  { name: "package_pdf_1", maxCount: 1 },
  { name: "package_pdf_2", maxCount: 1 },
  { name: "package_pdf_3", maxCount: 1 },
  { name: "package_pdf_4", maxCount: 1 },
]);

router.post("/register", handleUserUploads, registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.get("/store/:sellerId", getSellerPublicProfile);
router.get("/contractor/:id", getContractorPublicProfile); // NEW PUBLIC ROUTE
router.post("/contractors/:id/reviews", protect, addProjectReview);
router.put("/contractors/:id/seo", protect, admin, updateProjectSEO); // ADMIN ONLY
router.get("/admin/contractor-projects", protect, admin, getAllContractorProjects); // NEW ADMIN PROJECT LIST
router.route("/").get(getAllUsers);

router
  .route("/admin/create")
  .post(protect, admin, handleUserUploads, createUserByAdmin);
router.route("/stats").get(protect, admin, getUserStats);

router
  .route("/:id")
  .get(protect, admin, getUserById)
  .put(protect, handleUserUploads, updateUser)
  .delete(protect, admin, deleteUser);

module.exports = router;
