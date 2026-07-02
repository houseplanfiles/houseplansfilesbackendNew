const { S3Client } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_S3_BUCKET_NAME,
  // 1 year cache — browsers and CDNs cache images instead of re-downloading
  cacheControl: "max-age=31536000, public",
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    // Use .webp extension for all image uploads
    const isImage = file.mimetype.startsWith("image/");
    const ext = isImage ? ".webp" : path.extname(file.originalname);
    const fileName = Date.now() + "_" + file.fieldname + ext;
    cb(null, fileName);
  },
  contentType: (req, file, cb) => {
    // Set correct content type for WebP
    if (file.mimetype.startsWith("image/")) {
      cb(null, "image/webp");
    } else {
      multerS3.AUTO_CONTENT_TYPE(req, file, cb);
    }
  },
});

module.exports = s3Storage;
