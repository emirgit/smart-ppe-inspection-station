'use strict';

const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const r2Client = require('../config/r2');
const path = require('path');

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, ''); // strip trailing slash

/**
 * Derive file extension from MIME type.
 * @param {string} mimeType
 * @returns {string} e.g. 'jpg'
 */
function extFromMime(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return map[mimeType] || 'jpg';
}

/**
 * Upload a worker profile photo to R2.
 *
 * @param {number} workerId - The worker's DB id (used to build the object key)
 * @param {Buffer} fileBuffer - The raw file data from multer's memoryStorage
 * @param {string} mimeType  - MIME type, e.g. 'image/jpeg'
 * @returns {{ url: string, key: string }} - Public URL and the R2 object key
 */
async function uploadPhoto(workerId, fileBuffer, mimeType) {
  const ext = extFromMime(mimeType);
  const key = `photos/worker-${workerId}-${Date.now()}.${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  const url = `${PUBLIC_URL}/${key}`;
  return { url, key };
}

/**
 * Delete a worker profile photo from R2.
 *
 * @param {string} objectKey - The R2 object key (e.g. "photos/worker-3-1715900000000.jpg")
 */
async function deletePhoto(objectKey) {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
    })
  );
}

/**
 * Extract the R2 object key from a stored public URL.
 * e.g. "https://pub-xxx.r2.dev/photos/worker-3-123.jpg" → "photos/worker-3-123.jpg"
 *
 * @param {string} photoUrl
 * @returns {string|null}
 */
function keyFromUrl(photoUrl) {
  if (!photoUrl || !PUBLIC_URL) return null;
  const prefix = `${PUBLIC_URL}/`;
  if (!photoUrl.startsWith(prefix)) return null;
  return photoUrl.slice(prefix.length);
}

module.exports = { uploadPhoto, deletePhoto, keyFromUrl };
