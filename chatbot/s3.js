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
    let contentType = 'image/jpeg'; // default
    
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
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    });

    await s3.send(command);
    console.log(`✅ Successfully uploaded to S3: ${key}`);

    // Generate signed URL for secure access (valid for 7 days)
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    const signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 604800 }); // 7 days
    console.log(`🔗 Signed URL generated: ${signedUrl}`);
    return signedUrl;
    
  } catch (error) {
    console.error('❌ S3 upload error:', error);
    throw error;
  }
}

// Function to generate signed URL for existing S3 objects
async function getSignedUrlForImage(s3Key, bucketName = process.env.S3_BUCKET_NAME) {
  try {
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });
    
    const signedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 604800 }); // 7 days
    return signedUrl;
  } catch (error) {
    console.error('❌ Error generating signed URL:', error);
    throw error;
  }
}

module.exports = { uploadToS3, getSignedUrlForImage };
