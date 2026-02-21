const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY
  }
});

const BUCKET = process.env.R2_BUCKET_NAME || 'rexon-artifacts';

/**
 * Upload a buffer to Cloudflare R2
 * Returns the public URL
 */
async function uploadToR2(buffer, key, contentType = 'application/octet-stream') {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Make publicly readable
    ACL: 'public-read'
  });

  await s3.send(command);

  // Return R2 public URL
  // Format: https://pub-<hash>.r2.dev/<key>  OR custom domain
  // Use endpoint-based URL as fallback
  const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
  return `${endpoint}/${BUCKET}/${key}`;
}

module.exports = { uploadToR2 };
