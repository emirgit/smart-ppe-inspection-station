const prisma = require('../config/prisma');

// ─── GET /api/ppe-items ──────────────────────────────────
const getAllPpeItems = async (req, res, next) => {
  try {
    const items = await prisma.ppeItem.findMany({
      orderBy: { id: 'asc' },
    });

    res.json({
      success: true,
      data: items.map(formatPpeItem),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/ppe-items/:id ──────────────────────────────
const getPpeItemById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const item = await prisma.ppeItem.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'PPE item not found' },
      });
    }

    res.json({
      success: true,
      data: formatPpeItem(item),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ppe-items ─────────────────────────────────
const createPpeItem = async (req, res, next) => {
  try {
    const { item_key, display_name, icon_name } = req.body;

    // Check uniqueness
    const existing = await prisma.ppeItem.findUnique({
      where: { itemKey: item_key },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 409, message: 'item_key already exists' },
      });
    }

    const item = await prisma.ppeItem.create({
      data: {
        itemKey: item_key,
        displayName: display_name,
        iconName: icon_name || null,
      },
    });

    res.status(201).json({
      success: true,
      data: formatPpeItem(item),
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/ppe-items/:id ──────────────────────────────
const updatePpeItem = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { item_key, display_name, icon_name } = req.body;

    // Check existence
    const existing = await prisma.ppeItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'PPE item not found' },
      });
    }

    // If item_key is being changed, check uniqueness
    if (item_key && item_key !== existing.itemKey) {
      const duplicate = await prisma.ppeItem.findUnique({
        where: { itemKey: item_key },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: { code: 409, message: 'item_key already exists' },
        });
      }
    }

    const updateData = {};
    if (item_key !== undefined) updateData.itemKey = item_key;
    if (display_name !== undefined) updateData.displayName = display_name;
    if (icon_name !== undefined) updateData.iconName = icon_name;

    const item = await prisma.ppeItem.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: formatPpeItem(item),
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/ppe-items/:id ───────────────────────────
const deletePpeItem = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await prisma.ppeItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'PPE item not found' },
      });
    }

    // Check if PPE item is used in any role requirements
    const usageCount = await prisma.rolePpeRequirement.count({
      where: { ppeItemId: id },
    });
    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 409,
          message: `Cannot delete: PPE item is assigned to ${usageCount} role(s). Remove it from all roles first.`,
        },
      });
    }

    await prisma.ppeItem.delete({ where: { id } });

    res.json({
      success: true,
      message: 'PPE item deleted',
      data: { id },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Helper ──────────────────────────────────────────────
function formatPpeItem(item) {
  return {
    id: item.id,
    item_key: item.itemKey,
    display_name: item.displayName,
    icon_name: item.iconName,
  };
}

module.exports = {
  getAllPpeItems,
  getPpeItemById,
  createPpeItem,
  updatePpeItem,
  deletePpeItem,
};
