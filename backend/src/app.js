require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middlewares/errorHandler');
const { authenticate } = require('./middlewares/auth.middleware');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const workerRoutes = require('./routes/worker.routes');
const roleRoutes = require('./routes/role.routes');
const ppeItemRoutes = require('./routes/ppeItem.routes');
const entryLogRoutes = require('./routes/entryLog.routes');
const rfidScanRoutes = require('./routes/rfidScan.routes');
const { getWorkerByCard } = require('./controllers/worker.controller');
const { createEntryLog } = require('./controllers/entryLog.controller');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Public routes (no auth required) ───────────────────
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// Device-facing endpoints (used by RPi / turnstile hardware)
app.get('/api/workers/card/:uid', getWorkerByCard);
app.post('/api/entry-logs', createEntryLog);
app.use('/api/rfid/scan', rfidScanRoutes);

// ─── Protected routes (admin JWT required) ──────────────
app.use('/api/workers', authenticate, workerRoutes);
app.use('/api/roles', authenticate, roleRoutes);
app.use('/api/ppe-items', authenticate, ppeItemRoutes);
app.use('/api/entry-logs', authenticate, entryLogRoutes);

// Root route
app.get('/', (req, res) => {
  res.send('Turnstile Backend API is running');
});

// Error Handler
app.use(errorHandler);

module.exports = app;


