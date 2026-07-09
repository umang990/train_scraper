const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { searchMultiHop } = require('../controllers/multiHopController');

router.get('/search-stream', protect, searchMultiHop);

module.exports = router;
