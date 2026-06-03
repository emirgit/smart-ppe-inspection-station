const express = require('express');
const router = express.Router();
const { requireFields } = require('../middlewares/validate');
const {
  getAllWorkers,
  createWorker,
  getWorkerById,
  updateWorker,
  deleteWorker,
  getWorkerByCard,
} = require('../controllers/worker.controller');

// Card lookup must be defined BEFORE /:id to avoid "card" being parsed as an ID
router.get('/card/:uid', getWorkerByCard);

router.get('/', getAllWorkers);
router.post('/', requireFields(['full_name', 'rfid_card_uid', 'role_id']), createWorker);
router.get('/:id', getWorkerById);
router.put('/:id', updateWorker);
router.delete('/:id', deleteWorker);

module.exports = router;
