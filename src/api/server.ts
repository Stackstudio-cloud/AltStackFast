import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import cors from 'cors';
import toolsRouter from './routes/tools.js';

// Load environment variables from .env file
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firestore
// This assumes you have GOOGLE_APPLICATION_CREDENTIALS set in your environment
export const firestore = new Firestore();

// Mount our first route
app.use('/v1/tools', toolsRouter);

// Health check endpoint for deployment platforms
app.get('/healthz', (_, res) => res.status(200).send('ok'));

// Root endpoint
app.get('/', (_, res) => {
  res.json({
    name: 'AltStackFast MCP Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      tools: '/v1/tools',
      health: '/healthz'
    }
  });
});

const PORT = process.env.PORT ?? 8080;
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🔧 Tools endpoint: http://localhost:${PORT}/v1/tools`);
}); 