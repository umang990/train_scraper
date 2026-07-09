const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { handleChat } = require('../controllers/chatController');

router.post('/', protect, handleChat);

module.exports = router;
