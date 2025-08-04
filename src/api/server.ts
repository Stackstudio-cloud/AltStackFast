import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import cors from 'cors';
import toolsRouter from './routes/tools.js';
import analyzeRouter from './routes/analyze.js';
import { getQueueHealth } from './queue.js';

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firestore
// This assumes you have GOOGLE_APPLICATION_CREDENTIALS set in your environment
export const firestore = new Firestore();

// Mount our routes
app.use('/v1/tools', toolsRouter);
app.use('/v1/analyze', analyzeRouter);

// Health check endpoint for deployment platforms
app.get('/healthz', (_, res) => res.status(200).send('ok'));

// Queue health check
app.get('/queue/health', async (_, res) => {
  try {
    const health = await getQueueHealth();
    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Root endpoint
app.get('/', (_, res) => {
  res.json({
    name: 'AltStackFast MCP Server',
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

const PORT = process.env.PORT ?? 8080;
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🔧 Tools endpoint: http://localhost:${PORT}/v1/tools`);
  console.log(`⚡ Analyze endpoint: http://localhost:${PORT}/v1/analyze`);
  console.log(`📈 Queue health: http://localhost:${PORT}/queue/health`);
}); 