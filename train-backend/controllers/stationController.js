const Station = require('../models/Station');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

let localStations = [];
try {
    const filePath = path.join(__dirname, '../data/stations.json');
    if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        localStations = JSON.parse(raw).map(s => ({
            stationName: s.name,
            stationCode: s.code,
            state: s.state || ''
        }));
    }
} catch (e) {
    console.error('Failed to load local stations.json:', e.message);
}

const searchLocalStations = (q) => {
    const query = (q || '').trim().toLowerCase();
    if (!query) return [];
    
    const exact = [];
    const codePrefix = [];
    const namePrefix = [];
    const nameContains = [];

    for (const s of localStations) {
        const c = (s.stationCode || '').toLowerCase();
        const n = (s.stationName || '').toLowerCase();

        if (c === query) {
            exact.push(s);
        } else if (c.startsWith(query)) {
            codePrefix.push(s);
        } else if (n.startsWith(query)) {
            namePrefix.push(s);
        } else if (n.includes(query)) {
            nameContains.push(s);
        }
    }

    return [...exact, ...codePrefix, ...namePrefix, ...nameContains].slice(0, 10);
};

// @desc    Search stations for autocomplete
// @route   GET /api/stations/search?q=text
// @access  Public
const searchStations = async (req, res) => {
    const q = (req.query.q || '').trim();
    
    if (!q || q.length < 2) {
        return res.json([]);
    }

    try {
        let stations = [];
        if (mongoose.connection.readyState === 1) {
            try {
                // Try MongoDB first if connected
                let exactCodeMatch = await Station.find({
                    stationCode: { $regex: new RegExp(`^${q}$`, 'i') }
                }).limit(1);

                const regex = new RegExp(q, 'i');
                stations = await Station.find({
                    $or: [
                        { stationCode: { $regex: new RegExp(`^${q}`, 'i') } },
                        { stationName: regex }
                    ]
                })
                .limit(10)
                .lean();

                if (exactCodeMatch.length > 0) {
                    const exactCode = exactCodeMatch[0].stationCode;
                    stations = stations.filter(s => s.stationCode !== exactCode);
                    stations.unshift(exactCodeMatch[0]);
                }
            } catch (dbError) {
                console.warn('MongoDB station query failed, using local station data:', dbError.message);
            }
        }

        // If DB returned no stations, use the local comprehensive stations list
        if (!stations || stations.length === 0) {
            stations = searchLocalStations(q);
        }

        res.json(stations.slice(0, 10));
    } catch (error) {
        console.error('Error searching stations:', error);
        // Fallback to local search even if an unexpected error occurs
        res.json(searchLocalStations(q));
    }
};

module.exports = {
    searchStations
};
