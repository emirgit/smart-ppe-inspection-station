const express = require('express');
const router = express.Router();
const {
  createEntryLog,
  getEntryLogs,
  getEntryLogStats,
} = require('../controllers/entryLog.controller');

// Stats route must be defined BEFORE any potential /:id route
router.get('/stats', getEntryLogStats);

router.post('/', createEntryLog);
router.get('/', getEntryLogs);

module.exports = router;
