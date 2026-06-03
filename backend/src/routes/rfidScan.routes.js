const express = require('express');
const router = express.Router();
const { requireFields } = require('../middlewares/validate');
const {
  createRfidScan,
  getLatestRfidScan,
} = require('../controllers/rfidScan.controller');

router.post('/', requireFields(['rfid', 'timestamp']), createRfidScan);
router.get('/', getLatestRfidScan);

module.exports = router;
