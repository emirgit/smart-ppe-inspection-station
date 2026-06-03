const prisma = require('../config/prisma');
const { uploadPhoto, deletePhoto, keyFromUrl } = require('../services/storage.service');

// ─── GET /api/workers ────────────────────────────────────
const getAllWorkers = async (req, res, next) => {
  try {
    const { is_active, role_id } = req.query;

    const where = {};
    if (is_active !== undefined) {
      where.isActive = is_active === 'true';
    }
    if (role_id !== undefined) {
      where.roleId = parseInt(role_id, 10);
    }

    const [workers, total] = await Promise.all([
      prisma.worker.findMany({
        where,
        include: { role: true },
        orderBy: { id: 'asc' },
      }),
      prisma.worker.count({ where }),
    ]);

    res.json({
      success: true,
      data: workers.map(formatWorker),
      total,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/workers ───────────────────────────────────
const createWorker = async (req, res, next) => {
  try {
    const { full_name, rfid_card_uid, role_id, photo_url } = req.body;

    // Check RFID uniqueness
    const existing = await prisma.worker.findUnique({
      where: { rfidCardUid: rfid_card_uid },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 409, message: 'RFID card already registered' },
      });
    }

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: parseInt(role_id, 10) },
    });
    if (!role) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Role not found' },
      });
    }

    const worker = await prisma.worker.create({
      data: {
        fullName: full_name,
        rfidCardUid: rfid_card_uid,
        roleId: parseInt(role_id, 10),
        photoUrl: photo_url || null,
      },
      include: { role: true },
    });

    res.status(201).json({
      success: true,
      data: formatWorker(worker),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/workers/:id ────────────────────────────────
const getWorkerById = async (req, res, next) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: { role: true },
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker not found' },
      });
    }

    res.json({
      success: true,
      data: formatWorker(worker),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/workers/digital-twin/:id ──────────────────
const getWorkerDigitalTwin = async (req, res, next) => {
  try {
    const workerId = parseInt(req.params.id, 10);

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      include: { role: true },
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker not found' },
      });
    }

    const [passed, failed, totalScans, lastLogs] = await Promise.all([
      prisma.entryLog.count({ where: { workerId, result: 'PASS' } }),
      prisma.entryLog.count({ where: { workerId, result: 'FAIL' } }),
      prisma.entryLog.count({ where: { workerId } }),
      prisma.entryLog.findMany({
        where: { workerId },
        include: {
          detectionDetails: {
            include: { ppeItem: true },
          },
        },
        orderBy: { scannedAt: 'desc' },
        take: 10,
      }),
    ]);

    const complianceRate =
      passed + failed > 0
        ? parseFloat(((passed / (passed + failed)) * 100).toFixed(1))
        : 0;

    res.json({
      success: true,
      data: {
        worker: formatWorker(worker),
        stats: {
          total_scans: totalScans,
          passed,
          failed,
          compliance_rate: complianceRate,
        },
        last_10_entry_logs: lastLogs.map(formatDigitalTwinEntryLog),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/workers/:id ────────────────────────────────
const updateWorker = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { full_name, role_id, photo_url, rfid_card_uid } = req.body;

    // Check worker exists
    const existing = await prisma.worker.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker not found' },
      });
    }

    // If RFID is being changed, check uniqueness
    if (rfid_card_uid && rfid_card_uid !== existing.rfidCardUid) {
      const duplicate = await prisma.worker.findUnique({
        where: { rfidCardUid: rfid_card_uid },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: { code: 409, message: 'RFID card already registered' },
        });
      }
    }

    const data = {};
    if (full_name !== undefined) data.fullName = full_name;
    if (role_id !== undefined) data.roleId = parseInt(role_id, 10);
    if (photo_url !== undefined) data.photoUrl = photo_url;
    if (rfid_card_uid !== undefined) {
      data.rfidCardUid = rfid_card_uid;
      // Reactivate the worker if they are currently inactive and receiving a new card
      if (!existing.isActive && rfid_card_uid) {
        data.isActive = true;
      }
    }

    const worker = await prisma.worker.update({
      where: { id },
      data,
      include: { role: true },
    });

    res.json({
      success: true,
      data: formatWorker(worker),
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/workers/:id ─────────────────────────────
// Soft-delete: marks worker as inactive and releases their RFID card
const deleteWorker = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await prisma.worker.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker not found' },
      });
    }

    await prisma.worker.update({
      where: { id },
      // Also null-out RFID so the card can be re-assigned to another worker
      data: { isActive: false, rfidCardUid: null },
    });

    res.json({
      success: true,
      message: 'Worker deactivated',
      data: { id, is_active: false },
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/workers/:id/permanent ───────────────────
// Hard-delete: removes worker from DB and deletes their R2 profile photo
const hardDeleteWorker = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await prisma.worker.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker not found' },
      });
    }

    // Delete profile photo from R2 before removing the DB record
    if (existing.photoUrl) {
      const key = keyFromUrl(existing.photoUrl);
      if (key) {
        await deletePhoto(key).catch(() => {
          // Non-fatal: log but don't block the deletion
          console.warn(`[R2] Failed to delete photo for worker ${id}: ${key}`);
        });
      }
    }

    await prisma.worker.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Worker permanently deleted',
      data: { id },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/workers/card/:uid ──────────────────────────
const getWorkerByCard = async (req, res, next) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { rfidCardUid: req.params.uid },
      include: {
        role: {
          include: {
            rolePpeRequirements: {
              include: { ppeItem: true },
            },
          },
        },
      },
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Card not registered' },
      });
    }

    res.json({
      success: true,
      data: {
        worker: {
          id: worker.id,
          full_name: worker.fullName,
          photo_url: worker.photoUrl,
          role_name: worker.role.roleName,
        },
        required_ppe: worker.role.rolePpeRequirements.map((rpr) => ({
          id: rpr.ppeItem.id,
          item_key: rpr.ppeItem.itemKey,
          display_name: rpr.ppeItem.displayName,
          icon_name: rpr.ppeItem.iconName,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/workers/:id/photo ───────────────────────
const uploadWorkerPhoto = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const worker = await prisma.worker.findUnique({ where: { id } });
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker not found' },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: 'No image file provided' },
      });
    }

    // Delete old photo from R2 if one exists
    if (worker.photoUrl) {
      const oldKey = keyFromUrl(worker.photoUrl);
      if (oldKey) {
        await deletePhoto(oldKey).catch(() => {
          // Non-fatal: log but don't block the upload
          console.warn(`[R2] Failed to delete old photo key: ${oldKey}`);
        });
      }
    }

    const { url } = await uploadPhoto(id, req.file.buffer, req.file.mimetype);

    const updated = await prisma.worker.update({
      where: { id },
      data: { photoUrl: url },
      include: { role: true },
    });

    res.json({
      success: true,
      data: formatWorker(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/workers/:id/photo ──────────────────────
const deleteWorkerPhoto = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const worker = await prisma.worker.findUnique({ where: { id } });
    if (!worker) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker not found' },
      });
    }

    if (!worker.photoUrl) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Worker has no profile photo' },
      });
    }

    const key = keyFromUrl(worker.photoUrl);
    if (key) {
      await deletePhoto(key);
    }

    const updated = await prisma.worker.update({
      where: { id },
      data: { photoUrl: null },
      include: { role: true },
    });

    res.json({
      success: true,
      data: formatWorker(updated),
    });
  } catch (err) {
    next(err);
  }
};

// ─── Helper ──────────────────────────────────────────────

/**
 * Transforms a Prisma Worker (with role included) into
 * the API contract response shape.
 */
function formatWorker(worker) {
  return {
    id: worker.id,
    full_name: worker.fullName,
    rfid_card_uid: worker.rfidCardUid,
    role_id: worker.roleId,
    role_name: worker.role.roleName,
    is_active: worker.isActive,
    photo_url: worker.photoUrl,
    created_at: worker.createdAt,
    ...(worker.updatedAt && { updated_at: worker.updatedAt }),
  };
}

function formatDigitalTwinEntryLog(log) {
  return {
    id: log.id,
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
  };
}

module.exports = {
  getAllWorkers,
  createWorker,
  getWorkerById,
  updateWorker,
  deleteWorker,
  hardDeleteWorker,
  getWorkerByCard,
  getWorkerDigitalTwin,
  uploadWorkerPhoto,
  deleteWorkerPhoto,
};
