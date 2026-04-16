const prisma = require('../config/prisma');

// ─── GET /api/roles ──────────────────────────────────────
const getAllRoles = async (req, res, next) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { id: 'asc' },
    });

    res.json({
      success: true,
      data: roles.map(formatRole),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/roles ─────────────────────────────────────
const createRole = async (req, res, next) => {
  try {
    const { role_name, description } = req.body;

    // Check uniqueness
    const existing = await prisma.role.findUnique({
      where: { roleName: role_name },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 409, message: 'Role name already exists' },
      });
    }

    const role = await prisma.role.create({
      data: {
        roleName: role_name,
        description: description || null,
      },
    });

    res.status(201).json({
      success: true,
      data: formatRole(role),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/roles/:id/ppe ──────────────────────────────
const getRolePpe = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePpeRequirements: {
          include: { ppeItem: true },
        },
      },
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Role not found' },
      });
    }

    res.json({
      success: true,
      data: {
        role_id: role.id,
        role_name: role.roleName,
        ppe_items: role.rolePpeRequirements.map((rpr) => ({
          id: rpr.ppeItem.id,
          item_key: rpr.ppeItem.itemKey,
          display_name: rpr.ppeItem.displayName,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/roles/:id/ppe ──────────────────────────────
const updateRolePpe = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { ppe_item_ids } = req.body;

    if (!ppe_item_ids || !Array.isArray(ppe_item_ids)) {
      return res.status(422).json({
        success: false,
        error: { code: 422, message: 'ppe_item_ids is required and must be an array' },
      });
    }

    // Verify role exists
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return res.status(404).json({
        success: false,
        error: { code: 404, message: 'Role not found' },
      });
    }

    // Replace operation inside a transaction
    await prisma.$transaction([
      prisma.rolePpeRequirement.deleteMany({ where: { roleId: id } }),
      ...ppe_item_ids.map((ppeItemId) =>
        prisma.rolePpeRequirement.create({
          data: { roleId: id, ppeItemId },
        })
      ),
    ]);

    // Fetch updated data for response
    const updated = await prisma.role.findUnique({
      where: { id },
      include: {
        rolePpeRequirements: {
          include: { ppeItem: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        role_id: updated.id,
        role_name: updated.roleName,
        ppe_items: updated.rolePpeRequirements.map((rpr) => ({
          id: rpr.ppeItem.id,
          item_key: rpr.ppeItem.itemKey,
          display_name: rpr.ppeItem.displayName,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Helper ──────────────────────────────────────────────

function formatRole(role) {
  return {
    id: role.id,
    role_name: role.roleName,
    description: role.description,
    created_at: role.createdAt,
  };
}

module.exports = {
  getAllRoles,
  createRole,
  getRolePpe,
  updateRolePpe,
};
