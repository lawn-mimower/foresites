const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function uploadToS3(localFilePath, bucketName, keyPrefix = "") {
  try {
    console.log(`📤 Uploading to S3: ${localFilePath}`);
    
    const fileContent = fs.readFileSync(localFilePath);
    const fileName = path.basename(localFilePath);
    const key = `${keyPrefix}${fileName}`;

    // Determine content type based on file extension
    const ext = path.extname(fileName).toLowerCase();
    let contentType = 'application/octet-stream'; // default
    
    // Image types
    switch (ext) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      // Audio types
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.m4a':
        contentType = 'audio/mp4';
        break;
      case '.aac':
        contentType = 'audio/aac';
        break;
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    });

    await s3.send(command);
    console.log(`✅ Successfully uploaded to S3: ${key}`);

    // Return the S3 key instead of signed URL (we'll generate signed URLs on-demand)
    return key;
    
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    throw error;
  }
}

// Function to generate signed URL for existing S3 objects
async function getSignedUrlForS3Object(s3Key, bucketName = process.env.S3_BUCKET_NAME, expiresIn = 604800) {
  try {
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });
    
    const signedUrl = await getSignedUrl(s3, getCommand, { expiresIn }); // Default 7 days
    return signedUrl;
  } catch (error) {
    console.error('❌ Error generating signed URL:', error);
    throw error;
  }
}

// Helper function to check if a string is an S3 key (starts with voice/ or images/)
function isS3Key(path) {
  return path && (path.startsWith('voice/') || path.startsWith('images/'));
}

// Helper function to generate public S3 URL
function getS3Url(s3Key, bucketName = process.env.S3_BUCKET_NAME, region = process.env.AWS_REGION) {
  if (!s3Key) return null;
  // Format: https://bucket-name.s3.region.amazonaws.com/key
  // Or: https://s3.region.amazonaws.com/bucket-name/key
  return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
}

module.exports = { uploadToS3, getSignedUrlForS3Object, isS3Key, getS3Url };
