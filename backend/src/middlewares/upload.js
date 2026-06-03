'use strict';

const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Multer instance configured with:
 * - In-memory storage (no temp files written to disk)
 * - 5 MB size limit
 * - JPEG / PNG / WebP only
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error('Only JPEG, PNG, and WebP images are allowed'), {
          status: 415,
        })
      );
    }
  },
});

module.exports = upload;
