import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { adminAuthMiddleware } from './middleware/auth.js';
import toolsRouter from './routes/tools.js';
import analyzeRouter from './routes/analyze.js';
import mcpRouter from './routes/mcp.js'; // Import the new MCP route


// Load environment variables - try .env.local first, then fallback to default
try {
  dotenv.config({ path: '.env.local' });
} catch (error) {
  // If .env.local doesn't exist, load from default locations
  dotenv.config();
}

const app = express();

// --- Security Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(helmet()); // Set various security headers
app.use(express.json());

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/v1/', apiLimiter); // Apply rate limiting to all v1 routes

// Initialize Firestore with error handling
let firestore: Firestore | null = null;
try {
  firestore = new Firestore();
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.warn('⚠️ Firestore initialization failed:', error);
  console.warn('⚠️ Some features may not work without proper Google Cloud credentials');
}

export { firestore };

const apiRouter = express.Router();

// --- Mount Routes ---
apiRouter.use('/v1/tools', toolsRouter);
apiRouter.use('/v1/analyze', analyzeRouter);
apiRouter.use('/mcp/v1', mcpRouter);

// Health check endpoint
apiRouter.get('/healthz', (_, res) => res.status(200).send('ok'));

// Queue health endpoint
apiRouter.get('/queue/health', (_, res) => {
  res.json({
    status: 'healthy',
    stats: { waiting: 0, active: 0, completed: 0, failed: 0 },
    timestamp: new Date().toISOString(),
    note: 'Using QStash for job processing - detailed stats not available'
  });
});

// Root endpoint for the entire app
apiRouter.get('/', (_, res) => {
  res.json({
    name: 'AltStackFast API',
    version: '1.0.0',
    status: 'running'
  });
});

app.use('/api', apiRouter);

// Export the app for Vercel
export default app;

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  const PORT = process.env.PORT || 8080;

  // Add error handling to the server startup
  const server = app.listen(PORT, () => {
    console.log(`🚀 API server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/healthz`);
    console.log(`🔗 Queue health: http://localhost:${PORT}/queue/health`);
    console.log(`🛠️ Tools API: http://localhost:${PORT}/v1/tools`);
    console.log(`🔍 Analysis API: http://localhost:${PORT}/v1/analyze`);
    console.log(`🤖 MCP API: http://localhost:${PORT}/mcp/v1`);
    console.log('🔒 Security middleware active (CORS, Helmet, Rate Limiting)');
  });

  // Add error handling
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
  });

  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });
} 