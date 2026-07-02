const express = require("express");
const router = express.Router();
const { getGoogleFeed } = require("../controllers/feed.controller");

router.get("/google", getGoogleFeed);

module.exports = router;
