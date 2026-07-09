const { findMultiHopRoutes } = require('../services/multiHopService');

// @desc    Stream multi-hop train change results via SSE
// @route   GET /api/multi-hop/search-stream
// @access  Private
const searchMultiHop = async (req, res) => {
    const { source, destination, date, maxHops, sortBy, minLayover } = req.query;

    if (!source || !destination || !date) {
        return res.status(400).json({ message: 'Missing required parameters: source, destination, date' });
    }

    try {
        // Setup SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Handle client disconnect gracefully
        let clientDisconnected = false;
        req.on('close', () => {
            clientDisconnected = true;
        });

        const onProgress = (completed, total, message) => {
            if (clientDisconnected) return;
            res.write(`data: ${JSON.stringify({ type: 'progress', completed, total, message })}\n\n`);
        };

        const onResult = (result) => {
            if (clientDisconnected) return;
            res.write(`data: ${JSON.stringify({ type: 'result', data: result })}\n\n`);
        };

        await findMultiHopRoutes(
            source, destination, date,
            {
                maxHops: parseInt(maxHops) || 1,
                sortBy: sortBy || 'cheapest',
                minLayover: parseInt(minLayover) || 30
            },
            onProgress, onResult
        );

        if (!clientDisconnected) {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        }
    } catch (error) {
        console.error('Multi-hop search error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error during multi-hop search' });
        } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    }
};

module.exports = { searchMultiHop };
