require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// CORS — allow all origins explicitly
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check — keeps Render alive & lets frontend ping to wake it
app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    res.status(200).json({
        status: 'ok',
        db: dbState === 1 ? 'connected' : 'connecting'
    });
});

// Routes
const authRoutes = require('./routes/authRoutes');
const trainRoutes = require('./routes/trainRoutes');
const stationRoutes = require('./routes/stationRoutes');
const multiHopRoutes = require('./routes/multiHopRoutes');
const chatRoutes = require('./routes/chatRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/multi-hop', multiHopRoutes);
app.use('/api/chat', chatRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

const PORT = process.env.PORT || 5000;

// ── Start server FIRST so Render gets a live port immediately ──────────────
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

// ── Connect to MongoDB in the background with retries ─────────────────────
const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error('[DB] MONGO_URI env variable is not set! Routes needing DB will fail.');
        return;
    }
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await mongoose.connect(uri);
            console.log('[DB] MongoDB Connected');
            return;
        } catch (err) {
            console.error(`[DB] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
            if (attempt < maxRetries) {
                const wait = attempt * 3000; // 3s, 6s, 9s, 12s
                console.log(`[DB] Retrying in ${wait / 1000}s...`);
                await new Promise(r => setTimeout(r, wait));
            } else {
                console.error('[DB] All connection attempts failed. Server is running but DB is unavailable.');
            }
        }
    }
};

connectDB();

// Process-level error guards — never crash the process
process.on('uncaughtException', (err) => {
    console.error('[CRASH] uncaughtException:', err.message, err.stack);
});

process.on('unhandledRejection', (err) => {
    console.error('[CRASH] unhandledRejection:', err?.message || err);
});

