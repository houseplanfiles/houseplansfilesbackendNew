const { S3Client, ListObjectsV2Command, CopyObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME;

async function fixCacheHeaders() {
  let continuationToken;
  let count = 0;
  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET, ContinuationToken: continuationToken,
    }));
    for (const obj of list.Contents || []) {
      const ext = obj.Key.split(".").pop().toLowerCase();
      if (!["jpg","jpeg","png","webp","avif"].includes(ext)) continue;
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "avif" ? "image/avif" : "image/jpeg";
      await s3.send(new CopyObjectCommand({
        Bucket: BUCKET, CopySource: `${BUCKET}/${obj.Key}`, Key: obj.Key,
        MetadataDirective: "REPLACE",
        CacheControl: "max-age=31536000, public, immutable",
        ContentType: contentType,
      }));
      console.log(`Fixed (${++count}): ${obj.Key}`);
    }
    continuationToken = list.NextContinuationToken;
  } while (continuationToken);
  console.log(`\nDone. Fixed ${count} objects.`);
}

fixCacheHeaders().catch(console.error);