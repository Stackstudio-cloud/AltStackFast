import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import rateLimit from 'express-rate-limit';

import { adminAuthMiddleware, assertProdSecrets } from './middleware/auth';
import toolsRouter from './routes/tools';
import analyzeRouter from './routes/analyze';
import mcpRouter from './routes/mcp'; // Import the new MCP route
import blueprintRouter from './routes/blueprint';


// Load environment variables - try .env.local first, then fallback to default
try {
  dotenv.config({ path: '.env.local' });
} catch (error) {
  // If .env.local doesn't exist, load from default locations
  dotenv.config();
}

// Sentry init (no-op if DSN missing)
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

const app = express();
// Skip Sentry request handler wiring (SDK v8 types may not include Handlers)
// Ensure required secrets in production
try { assertProdSecrets(); } catch (e) { console.error(String(e)); }

// --- Security Middleware ---
// Normalize to avoid trailing slash mismatches (e.g., https://site.com/ → https://site.com)
const FRONTEND_ORIGINS_RAW = process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGINS || '*';
const allowedOrigins = FRONTEND_ORIGINS_RAW.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*')) return callback(null, true);
      return allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error('CORS not allowed'));
    },
    credentials: true,
  })
);
// Basic CSP and HSTS via Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // keep simple; can be hardened later
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000 } : false,
  })
);
app.use(express.json());

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/v1/', apiLimiter); // Apply rate limiting to all v1 routes

// Initialize Firestore with robust env handling
let firestore: Firestore | null = null;
try {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  let firestoreOptions: Record<string, unknown> = {};
  if (raw) {
    // If it's a path, let ADC pick it up
    if (existsSync(raw)) {
      // Leave options empty; the library will read the file path from env
    } else {
      // Try raw JSON
      try {
        firestoreOptions.credentials = JSON.parse(raw);
      } catch {
        // Try base64 → JSON
        try {
          const decoded = Buffer.from(raw, 'base64').toString('utf-8');
          firestoreOptions.credentials = JSON.parse(decoded);
        } catch {
          // Try newline-normalized JSON
          try {
            const normalized = raw.replace(/\\n/g, '\n');
            firestoreOptions.credentials = JSON.parse(normalized);
          } catch {}
        }
      }
    }
  }
  firestore = new Firestore(firestoreOptions);
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.warn('⚠️ Firestore initialization failed:', error);
  console.warn('⚠️ Some features may not work without proper Google Cloud credentials');
}

export { firestore };

// --- Mount Routes ---
app.use('/v1/tools', toolsRouter);
app.use('/v1/analyze', analyzeRouter);
app.use('/v1/blueprint', blueprintRouter);
app.use('/mcp/v1', mcpRouter);

// Health check and readiness endpoints
app.get('/healthz', (_, res) => res.status(200).send('ok'));
app.get('/readyz', async (_, res) => {
  try {
    if (!firestore) return res.status(200).json({ ok: true, firestore: false });
    const timeoutMs = Number(process.env.READYZ_TIMEOUT_MS || 1000);
    await Promise.race([
      firestore.listCollections(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
    return res.status(200).json({ ok: true, firestore: true });
  } catch {
    return res.status(503).json({ ok: false, firestore: false });
  }
});

// Queue health endpoint
app.get('/queue/health', (_, res) => {
  res.json({
    status: 'healthy',
    stats: { waiting: 0, active: 0, completed: 0, failed: 0 },
    timestamp: new Date().toISOString(),
    note: 'Using QStash for job processing - detailed stats not available'
  });
});

// Root endpoint for the entire app
app.get('/', (_, res) => {
  res.json({
    name: 'Stackfast API',
    version: '1.0.0',
    status: 'running'
  });
});

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