const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const accessToken = '***REMOVED-META-WHATSAPP-TOKEN***'; // better than hardcoding

async function downloadWhatsAppMedia(mediaId) {
  // 1. Get the media URL
  const metaUrl = `https://graph.facebook.com/v18.0/${mediaId}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const metaData = await metaRes.json();

  if (!metaData.url) throw new Error("No media URL returned by WhatsApp API");

  // 2. Download the actual image
  const imageRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const buffer = await imageRes.arrayBuffer();
  const tmpPath = path.join("tmp", `${mediaId}.jpg`);

  // Ensure tmp folder exists
  fs.mkdirSync("tmp", { recursive: true });
  fs.writeFileSync(tmpPath, Buffer.from(buffer));

  return tmpPath; // return local file path
}

module.exports = { downloadWhatsAppMedia };
