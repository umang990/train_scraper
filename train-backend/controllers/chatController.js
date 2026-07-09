const { processChat } = require('../services/chatService');

// @desc    Process a chat message through Gemini AI
// @route   POST /api/chat
// @access  Private
const handleChat = async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: 'messages array is required' });
    }

    try {
        const geminiResponse = await processChat(messages);
        res.json(geminiResponse);
    } catch (error) {
        console.error('[ChatController] ❌ Error:', error.message);
        console.error('[ChatController] Stack:', error.stack);
        res.status(500).json({
            reply: "Sorry, I couldn't process that. Please try again.",
            action: 'NONE',
            params: {},
            filters: {},
            missingFields: [],
            _error: error.message,
        });
    }
};

module.exports = { handleChat };
