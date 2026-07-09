const express = require('express');
const router = express.Router();
const { searchStations } = require('../controllers/stationController');

// GET /api/stations/search?q=text
router.get('/search', searchStations);

module.exports = router;
