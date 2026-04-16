const prisma = require('../config/prisma');

// ─── POST /api/entry-logs ────────────────────────────────
const createEntryLog = async (req, res, next) => {
  try {
    const {
      worker_id,
      rfid_uid_scanned,
      result,
      inspection_time_ms,
      camera_snapshot_url,
      detections,
    } = req.body;

    // Validate required fields
    if (rfid_uid_scanned === undefined || rfid_uid_scanned === '') {
      return res.status(422).json({
        success: false,
        error: { code: 422, message: 'rfid_uid_scanned is required' },
      });
    }
    if (!result || !['PASS', 'FAIL', 'UNKNOWN_CARD'].includes(result)) {
      return res.status(422).json({
        success: false,
        error: { code: 422, message: 'result must be PASS, FAIL, or UNKNOWN_CARD' },
      });
    }
    if (!Array.isArray(detections)) {
      return res.status(422).json({
        success: false,
        error: { code: 422, message: 'detections is required and must be an array' },
      });
    }

    // Create entry log + detection details in a single transaction
    const entryLog = await prisma.$transaction(async (tx) => {
      const log = await tx.entryLog.create({
        data: {
          workerId: worker_id || null,
          rfidUidScanned: rfid_uid_scanned,
          result,
          inspectionTimeMs: inspection_time_ms || null,
          cameraSnapshotUrl: camera_snapshot_url || null,
          detectionDetails: {
            create: detections.map((d) => ({
              ppeItemId: d.ppe_item_id,
              wasRequired: d.was_required,
              wasDetected: d.was_detected,
              confidence: d.confidence ?? null,
            })),
          },
        },
        include: {
          detectionDetails: {
            include: { ppeItem: true },
          },
        },
      });

      return log;
    });

    // Compute missing_ppe from the detection details
    const missingPpe = entryLog.detectionDetails
      .filter((d) => d.wasRequired && !d.wasDetected)
      .map((d) => ({
        item_key: d.ppeItem.itemKey,
        display_name: d.ppeItem.displayName,
        icon_name: d.ppeItem.iconName,
      }));

    res.status(201).json({
      success: true,
      data: {
        entry_log_id: entryLog.id,
        result: entryLog.result,
        scanned_at: entryLog.scannedAt,
        missing_ppe: missingPpe,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/entry-logs ─────────────────────────────────
const getEntryLogs = async (req, res, next) => {
  try {
    const {
      worker_id,
      result,
      start_date,
      end_date,
      limit = '50',
      offset = '0',
    } = req.query;

    const take = parseInt(limit, 10);
    const skip = parseInt(offset, 10);

    const where = {};
    if (worker_id !== undefined) where.workerId = parseInt(worker_id, 10);
    if (result !== undefined) where.result = result;
    if (start_date || end_date) {
      where.scannedAt = {};
      if (start_date) where.scannedAt.gte = new Date(start_date);
      if (end_date) {
        // Include the entire end_date day
        const endDateObj = new Date(end_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        where.scannedAt.lt = endDateObj;
      }
    }

    const [logs, total] = await Promise.all([
      prisma.entryLog.findMany({
        where,
        include: {
          worker: true,
          detectionDetails: {
            include: { ppeItem: true },
          },
        },
        orderBy: { scannedAt: 'desc' },
        take,
        skip,
      }),
      prisma.entryLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        worker_id: log.workerId,
        worker_name: log.worker?.fullName || null,
        rfid_uid_scanned: log.rfidUidScanned,
        result: log.result,
        scanned_at: log.scannedAt,
        inspection_time_ms: log.inspectionTimeMs,
        camera_snapshot_url: log.cameraSnapshotUrl,
        missing_ppe: log.detectionDetails
          .filter((d) => d.wasRequired && !d.wasDetected)
          .map((d) => ({
            item_key: d.ppeItem.itemKey,
            display_name: d.ppeItem.displayName,
          })),
      })),
      total,
      limit: take,
      offset: skip,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/entry-logs/stats ───────────────────────────
const getEntryLogStats = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const where = {};
    if (start_date || end_date) {
      where.scannedAt = {};
      if (start_date) where.scannedAt.gte = new Date(start_date);
      if (end_date) {
        const endDateObj = new Date(end_date);
        endDateObj.setDate(endDateObj.getDate() + 1);
        where.scannedAt.lt = endDateObj;
      }
    }

    // Count by result type
    const [passed, failed, unknownCards, totalScans] = await Promise.all([
      prisma.entryLog.count({ where: { ...where, result: 'PASS' } }),
      prisma.entryLog.count({ where: { ...where, result: 'FAIL' } }),
      prisma.entryLog.count({ where: { ...where, result: 'UNKNOWN_CARD' } }),
      prisma.entryLog.count({ where }),
    ]);

    // Compliance rate: passed / (passed + failed) * 100
    const complianceRate =
      passed + failed > 0
        ? parseFloat(((passed / (passed + failed)) * 100).toFixed(1))
        : 0;

    // Most missed PPE: group detection_details where was_required=true and was_detected=false
    const detectionWhere = {
      wasRequired: true,
      wasDetected: false,
    };
    if (start_date || end_date) {
      detectionWhere.entryLog = { scannedAt: where.scannedAt };
    }

    const missedGrouped = await prisma.detectionDetail.groupBy({
      by: ['ppeItemId'],
      where: detectionWhere,
      _count: { ppeItemId: true },
      orderBy: { _count: { ppeItemId: 'desc' } },
    });

    // Fetch the PPE item details for each missed group
    let mostMissedPpe = [];
    if (missedGrouped.length > 0) {
      const ppeItemIds = missedGrouped.map((g) => g.ppeItemId);
      const ppeItems = await prisma.ppeItem.findMany({
        where: { id: { in: ppeItemIds } },
      });
      const ppeMap = new Map(ppeItems.map((p) => [p.id, p]));

      mostMissedPpe = missedGrouped.map((g) => {
        const item = ppeMap.get(g.ppeItemId);
        return {
          item_key: item.itemKey,
          display_name: item.displayName,
          miss_count: g._count.ppeItemId,
        };
      });
    }

    res.json({
      success: true,
      data: {
        total_scans: totalScans,
        passed,
        failed,
        unknown_cards: unknownCards,
        compliance_rate: complianceRate,
        most_missed_ppe: mostMissedPpe,
        period: {
          start_date: start_date || null,
          end_date: end_date || null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createEntryLog,
  getEntryLogs,
  getEntryLogStats,
};
