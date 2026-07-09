const mongoose = require('mongoose');

const stationSchema = new mongoose.Schema({
    stationName: {
        type: String,
        required: true,
        trim: true,
    },
    stationCode: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
    },
    category: {
        type: String,
        trim: true,
    },
    division: {
        type: String,
        trim: true,
    },
    zone: {
        type: String,
        trim: true,
    },
    district: {
        type: String,
        trim: true,
    },
    state: {
        type: String,
        trim: true,
    }
}, {
    timestamps: true
});

// Create text index for autocomplete search
stationSchema.index({ stationName: 'text', stationCode: 'text' });
// Add normal indexes for quick exact lookups
stationSchema.index({ stationCode: 1 });
stationSchema.index({ stationName: 1 });

const Station = mongoose.model('Station', stationSchema);

module.exports = Station;
