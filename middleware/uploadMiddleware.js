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

// Allowed raw upload limit: up to 35MB raw so high-res images can be received and compressed safely down to under 15MB
const uploadToMemory = multer({
  storage: memoryStorage,
  limits: { fileSize: 1024 * 1024 * 35 },
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
 * If file size is large (>15MB), automatically applies aggressive compression to guarantee final size stays well under 15MB.
 * Also generates a fast thumbnail (400px wide) for use in cards/listings.
 * Falls back to direct S3 upload for non-image files with a strict 15MB cap.
 */
const processAndUpload = async (file) => {
  const isImage = file.mimetype.startsWith("image/");
  const timestamp = Date.now();
  const ext = isImage ? ".webp" : path.extname(file.originalname);
  const key = `${timestamp}_${file.fieldname}${ext}`;

  if (!isImage) {
    // Non-image files (e.g. PDFs): Enforce max 15MB limit
    const MAX_NON_IMAGE_BYTES = 15 * 1024 * 1024;
    if (file.buffer.length > MAX_NON_IMAGE_BYTES) {
      throw new Error(`File "${file.originalname}" exceeds the maximum limit of 15 MB.`);
    }

    const location = await uploadBufferToS3(file.buffer, key, file.mimetype);
    return {
      location,
      thumbnailUrl: location,
      key,
      mimetype: file.mimetype,
      size: file.buffer.length,
    };
  }

  // Determine compression parameters based on uploaded file size
  const rawSizeMB = file.buffer.length / (1024 * 1024);
  let maxDimension = 1600;
  let quality = 80;

  if (rawSizeMB > 15) {
    // If user uploaded > 15MB image, compress down strongly
    maxDimension = 1200;
    quality = 70;
  } else if (rawSizeMB > 8) {
    maxDimension = 1400;
    quality = 75;
  }

  // Generate full-size + thumbnail in parallel
  const [fullBuffer, thumbBuffer] = await Promise.all([
    sharp(file.buffer)
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer(),
    sharp(file.buffer)
      .resize({ width: 400, height: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
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
