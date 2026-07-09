const Station = require('../models/Station');

// @desc    Search stations for autocomplete
// @route   GET /api/stations/search?q=text
// @access  Public
const searchStations = async (req, res) => {
    const q = req.query.q || '';
    
    if (!q || q.length < 2) {
        return res.json([]);
    }

    try {
        // Try exact/prefix match on station code first (very common use case)
        let exactCodeMatch = await Station.find({
            stationCode: { $regex: new RegExp(`^${q}$`, 'i') }
        }).limit(1);

        // Perform a flexible search on name or code
        // We use regex here because text search might not match partial words natively
        const regex = new RegExp(q, 'i');
        let stations = await Station.find({
            $or: [
                { stationCode: { $regex: new RegExp(`^${q}`, 'i') } }, // Prefix match on code
                { stationName: regex } // Partial match on name
            ]
        })
        .limit(10)
        .lean();

        // If exact code match found, ensure it's at the top
        if (exactCodeMatch.length > 0) {
            const exactCode = exactCodeMatch[0].stationCode;
            stations = stations.filter(s => s.stationCode !== exactCode);
            stations.unshift(exactCodeMatch[0]);
        }
        
        // Take top 10
        stations = stations.slice(0, 10);

        res.json(stations);
    } catch (error) {
        console.error('Error searching stations:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    searchStations
};
