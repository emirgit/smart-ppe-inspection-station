const prisma = require('../config/prisma');

// ─── POST /api/rfid/scan ───────────────────────────────
const createRfidScan = async (req, res, next) => {
  try {
    const { rfid, timestamp } = req.body;
    const scannedAt = new Date(timestamp);

    if (Number.isNaN(scannedAt.getTime())) {
      return res.status(422).json({
        success: false,
        error: { code: 422, message: 'timestamp must be a valid date-time' },
      });
    }

    const record = await prisma.rfidScan.upsert({
      where: { slot: 1 },
      update: { rfid, scannedAt },
      create: { slot: 1, rfid, scannedAt },
    });

    res.status(201).json({
      success: true,
      data: {
        rfid: record.rfid,
        timestamp: record.scannedAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/rfid/scan ────────────────────────────────
const getLatestRfidScan = async (req, res, next) => {
  try {
    const record = await prisma.rfidScan.findUnique({
      where: { slot: 1 },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'No RFID scan found' },
      });
    }

    res.json({
      success: true,
      data: {
        rfid: record.rfid,
        timestamp: record.scannedAt.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createRfidScan,
  getLatestRfidScan,
};
