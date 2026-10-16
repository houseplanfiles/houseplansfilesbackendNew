// routes/videoRoutes.js
const express = require("express");
const router = express.Router();
const {
  addVideoLink,
  getVideos,
  getUniqueTopics,
  updateVideo,
  deleteVideo,
} = require("../controllers/admin/videoController.js");
const { protect, admin } = require("../middleware/authMiddleware.js");

router.get("/topics", getUniqueTopics);

router
  .route("/")
  .post(protect, admin, addVideoLink)
  .get(getVideos);

router
  .route("/:id")
  .put(protect, admin, updateVideo)
  .delete(protect, admin, deleteVideo);

module.exports = router;
