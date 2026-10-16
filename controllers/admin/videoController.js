const asyncHandler = require("express-async-handler");
const Video = require("../../models/videoModel");
const Product = require("../../models/productModel"); 

// Robust function to validate and extract YouTube ID
const validateAndExtractYouTubeId = (url) => {
  if (!url || typeof url !== "string") return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

/**
 * @desc    Add a new YouTube link
 * @route   POST /api/videos
 * @access  Private/Admin
 */
const addVideoLink = asyncHandler(async (req, res) => {
  const { title, description, youtubeLink, topic, productLink } = req.body;

  if (!title || !youtubeLink || !topic) {
    res.status(400);
    throw new Error("Title, YouTube Link, and Topic are required");
  }

  const videoId = validateAndExtractYouTubeId(youtubeLink);
  if (!videoId) {
    res.status(400);
    throw new Error("Invalid YouTube URL format. Please provide a valid link.");
  }

  const videoExists = await Video.findOne({ youtubeVideoId: videoId });
  if (videoExists) {
    res.status(400);
    throw new Error("A video with this YouTube ID already exists.");
  }

  if (productLink) {
    const productExists = await Product.findById(productLink);
    if (!productExists) {
      res.status(404);
      throw new Error("The linked product does not exist.");
    }
  }

  const video = await Video.create({
    user: req.user._id,
    title: title.trim(),
    description: description ? description.trim() : "",
    youtubeLink: youtubeLink.trim(),
    topic: topic.trim(),
    youtubeVideoId: videoId,
    productLink: productLink || null,
  });

  res.status(201).json(video);
});

/**
 * @desc    Get all videos
 * @route   GET /api/videos
 * @access  Public
 */
const getVideos = asyncHandler(async (req, res) => {
  const filter = req.query.topic ? { topic: req.query.topic } : {};

  const videos = await Video.find(filter)
    .sort({ createdAt: -1 })
    .populate(
      "productLink",
      "name mainImage price salePrice isSale Name Images"
    ); 

  res.json(videos);
});

/**
 * @desc    Get all unique topics
 * @route   GET /api/videos/topics
 * @access  Public
 */
const getUniqueTopics = asyncHandler(async (req, res) => {
  const topics = await Video.distinct("topic");
  res.json(topics.filter(Boolean).sort());
});

/**
 * @desc    Update a video link
 * @route   PUT /api/videos/:id
 * @access  Private/Admin
 */
const updateVideo = asyncHandler(async (req, res) => {
  const { title, description, youtubeLink, topic, productLink } = req.body;
  const video = await Video.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  if (title) video.title = title.trim();
  if (description !== undefined) video.description = description.trim();
  if (topic) video.topic = topic.trim();
  if (productLink !== undefined) {
    video.productLink = productLink === "none" || !productLink ? null : productLink;
  }

  if (youtubeLink && youtubeLink.trim() !== video.youtubeLink) {
    const videoId = validateAndExtractYouTubeId(youtubeLink);
    if (!videoId) {
      res.status(400);
      throw new Error("Invalid YouTube URL format. Please provide a valid link.");
    }
    video.youtubeLink = youtubeLink.trim();
    video.youtubeVideoId = videoId;
  }

  const updatedVideo = await video.save();
  res.json(updatedVideo);
});

/**
 * @desc    Delete a video link
 * @route   DELETE /api/videos/:id
 * @access  Private/Admin
 */
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  await video.deleteOne();
  res.json({ message: "Video link removed successfully" });
});

module.exports = {
  addVideoLink,
  getVideos,
  getUniqueTopics,
  updateVideo,
  deleteVideo,
};
