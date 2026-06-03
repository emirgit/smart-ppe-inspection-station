const express = require('express');
const router = express.Router();
const { requireFields } = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const {
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
} = require('../controllers/worker.controller');

// Card lookup must be defined BEFORE /:id to avoid "card" being parsed as an ID
router.get('/card/:uid', getWorkerByCard);
router.get('/digital-twin/:id', getWorkerDigitalTwin);

router.get('/', getAllWorkers);
router.post('/', requireFields(['full_name', 'rfid_card_uid', 'role_id']), createWorker);
router.get('/:id', getWorkerById);
router.put('/:id', updateWorker);
router.delete('/:id', deleteWorker);          // soft delete (deactivate + clear RFID)
router.delete('/:id/permanent', hardDeleteWorker); // hard delete (removes from DB + R2 photo)
router.post('/:id/photo', upload.single('photo'), uploadWorkerPhoto);
router.delete('/:id/photo', deleteWorkerPhoto);

module.exports = router;
