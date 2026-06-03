const express = require('express');
const router = express.Router();
const {
  getAllPpeItems,
  getPpeItemById,
} = require('../controllers/ppeItem.controller');

router.get('/', getAllPpeItems);
router.get('/:id', getPpeItemById);

module.exports = router;
