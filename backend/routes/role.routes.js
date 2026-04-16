const express = require('express');
const router = express.Router();
const { requireFields } = require('../middlewares/validate');
const {
  getAllRoles,
  createRole,
  getRolePpe,
  updateRolePpe,
} = require('../controllers/role.controller');

router.get('/', getAllRoles);
router.post('/', requireFields(['role_name']), createRole);
router.get('/:id/ppe', getRolePpe);
router.put('/:id/ppe', updateRolePpe);

module.exports = router;
