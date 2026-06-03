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
};
