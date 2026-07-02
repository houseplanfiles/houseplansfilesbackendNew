const multer = require("multer");
const sharp = require("sharp");
const s3Storage = require("../config/s3Config");
const { Upload } = require("@aws-sdk/lib-storage");
const { S3Client } = require("@aws-sdk/client-s3");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Memory storage — we process the image before sending to S3
const memoryStorage = multer.memoryStorage();

const uploadToMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 20 }, // 20MB limit for raw uploads
});

/**
 * Uploads a buffer to S3 with proper cache headers.
 */
const uploadBufferToS3 = async (buffer, key, contentType) => {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // FIX: Cache images for 1 year (was missing before, causing 14MB re-downloads on every visit)
      CacheControl: "max-age=31536000, public, immutable",
    },
  });

  const result = await upload.done();
  return (
    result.Location ||
    `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  );
};

/**
 * Compresses and converts image to WebP, then uploads to S3.
 * Also generates a thumbnail (400px wide) for use in cards/listings.
 * Falls back to direct S3 upload for non-image files.
 *
 * Returns:
 *   location      — full-size WebP URL (max 1200px)
 *   thumbnailUrl  — thumbnail WebP URL (max 400px) for card display
 */
const processAndUpload = async (file) => {
  const isImage = file.mimetype.startsWith("image/");
  const timestamp = Date.now();
  const ext = isImage ? ".webp" : path.extname(file.originalname);
  const key = `${timestamp}_${file.fieldname}${ext}`;

  if (!isImage) {
    // Non-image: upload directly
    const location = await uploadBufferToS3(file.buffer, key, file.mimetype);
    return {
      location,
      thumbnailUrl: location,
      key,
      mimetype: file.mimetype,
      size: file.buffer.length,
    };
  }

  // FIX: Generate full-size + thumbnail in parallel
  const [fullBuffer, thumbBuffer] = await Promise.all([
    sharp(file.buffer)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer(),
    sharp(file.buffer)
      // FIX: Thumbnail sized for card display (400px wide) — saves ~95% bandwidth on listings
      .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer(),
  ]);

  const thumbKey = `${timestamp}_${file.fieldname}_thumb.webp`;

  const [location, thumbnailUrl] = await Promise.all([
    uploadBufferToS3(fullBuffer, key, "image/webp"),
    uploadBufferToS3(thumbBuffer, thumbKey, "image/webp"),
  ]);

  return {
    location,
    thumbnailUrl,
    key,
    mimetype: "image/webp",
    size: fullBuffer.length,
  };
};

/**
 * Middleware that processes all uploaded files through sharp before S3.
 * Drop-in replacement for the old multer-s3 upload middleware.
 *
 * After processing, each file has:
 *   req.file.location     — full-size image URL
 *   req.file.thumbnailUrl — thumbnail URL for listings (use this in mainImage for cards)
 */
const upload = {
  single: (fieldName) => async (req, res, next) => {
    uploadToMemory.single(fieldName)(req, res, async (err) => {
      if (err) return next(err);
      if (!req.file) return next();
      try {
        const result = await processAndUpload(req.file);
        req.file.location = result.location;
        req.file.thumbnailUrl = result.thumbnailUrl;
        req.file.key = result.key;
        req.file.mimetype = result.mimetype;
        req.file.size = result.size;
        next();
      } catch (e) {
        next(e);
      }
    });
  },

  array: (fieldName, maxCount) => async (req, res, next) => {
    uploadToMemory.array(fieldName, maxCount)(req, res, async (err) => {
      if (err) return next(err);
      if (!req.files || req.files.length === 0) return next();
      try {
        const results = await Promise.all(req.files.map(processAndUpload));
        req.files = req.files.map((f, i) => ({
          ...f,
          location: results[i].location,
          thumbnailUrl: results[i].thumbnailUrl,
          key: results[i].key,
          mimetype: results[i].mimetype,
          size: results[i].size,
        }));
        next();
      } catch (e) {
        next(e);
      }
    });
  },

  fields: (fields) => async (req, res, next) => {
    uploadToMemory.fields(fields)(req, res, async (err) => {
      if (err) return next(err);
      if (!req.files) return next();
      try {
        for (const fieldName of Object.keys(req.files)) {
          const results = await Promise.all(
            req.files[fieldName].map(processAndUpload)
          );
          req.files[fieldName] = req.files[fieldName].map((f, i) => ({
            ...f,
            location: results[i].location,
            thumbnailUrl: results[i].thumbnailUrl,
            key: results[i].key,
            mimetype: results[i].mimetype,
            size: results[i].size,
          }));
        }
        next();
      } catch (e) {
        next(e);
      }
    });
  },
};

module.exports = upload;
