const express = require('express');
const router = express.Router();
const { getTrainsData, getTrainSchedule, optimizeTrainStream } = require('../controllers/trainController');
const { protect } = require('../middleware/auth');

// Apply protection middleware to the train routes
router.get('/', protect, getTrainsData);
router.get('/:trainNumber/schedule', protect, getTrainSchedule);
router.get('/:trainNumber/optimize-stream', protect, optimizeTrainStream);

module.exports = router;
