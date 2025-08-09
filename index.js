// This is the main Vercel function
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/v1/', apiLimiter);

// Health check endpoint
app.get('/healthz', (_, res) => res.status(200).send('ok'));

// Queue health endpoint
app.get('/queue/health', (_, res) => {
  res.json({
    status: 'healthy',
    stats: { waiting: 0, active: 0, completed: 0, failed: 0 },
    timestamp: new Date().toISOString(),
    note: 'Using QStash for job processing - detailed stats not available'
  });
});

// Root endpoint
app.get('/', (_, res) => {
  res.json({
    name: 'Stackfast MCP Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      tools: '/v1/tools',
      analyze: '/v1/analyze',
      health: '/healthz',
      queueHealth: '/queue/health'
    }
  });
});

// Export the app for Vercel
module.exports = app; 