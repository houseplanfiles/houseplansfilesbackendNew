const express = require("express");
const {
  createPackage,
  getPackages,
  getPackageById,
  updatePackage,
  deletePackage,
} = require("../controllers/packageController.js");
const upload = require("../middleware/uploadMiddleware.js");

const router = express.Router();

router.route("/").post(upload.single("image"), createPackage).get(getPackages);

router
  .route("/:id")
  .get(getPackageById)
  .put(upload.single("image"), updatePackage)
  .delete(deletePackage);

module.exports = router;
