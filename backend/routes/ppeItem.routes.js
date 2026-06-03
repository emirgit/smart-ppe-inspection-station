const express = require('express');
const router = express.Router();
const { requireFields } = require('../middlewares/validate');
const {
  getAllPpeItems,
  getPpeItemById,
  createPpeItem,
  updatePpeItem,
  deletePpeItem,
} = require('../controllers/ppeItem.controller');

router.get('/', getAllPpeItems);
router.get('/:id', getPpeItemById);
router.post('/', requireFields(['item_key', 'display_name']), createPpeItem);
router.put('/:id', updatePpeItem);
router.delete('/:id', deletePpeItem);

module.exports = router;
