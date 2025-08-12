import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import { existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join as pathJoin } from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
// Optional requires to avoid hard dependency in serverless builds
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tryRequire = (name: string): any => { try { return require(name); } catch { return null; } };
const Sentry = tryRequire('@sentry/node');
const pino = tryRequire('pino');
import rateLimit from 'express-rate-limit';

// Helper to pick the first non-empty env var from a list
const CREDS_ENV_KEYS = [
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CREDENTIALS',
  'GCP_SERVICE_ACCOUNT',
  'GCP_CREDENTIALS',
  'FIREBASE_SERVICE_ACCOUNT',
  'FIREBASE_ADMIN_CREDENTIALS',
];

const pickFirstEnv = (keys: string[]): { key: string; value: string } | null => {
  for (const key of keys) {
    const v = process.env[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      return { key, value: v };
    }
  }
  return null;
};

const cleanRawCredString = (value: string): string => {
  let cleaned = value.trim();
  // Strip wrapping single/double quotes if present
  cleaned = cleaned.replace(/^['"]+|['"]+$/g, '');
  return cleaned;
};

import { adminAuthMiddleware, assertProdSecrets } from './middleware/auth';
import toolsRouter from './routes/tools';
import analyzeRouter from './routes/analyze';
import mcpRouter from './routes/mcp'; // Import the new MCP route
import blueprintRouter from './routes/blueprint';
import compatibilityRouter from './routes/compatibility';


// Load environment variables - try .env.local first, then fallback to default
try {
  dotenv.config({ path: '.env.local' });
} catch (error) {
  // If .env.local doesn't exist, load from default locations
  dotenv.config();
}

// Sentry init (no-op if DSN missing)
if (Sentry && process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

const app = express();
// Skip Sentry request handler wiring (SDK v8 types may not include Handlers)

// Simple structured logger
const logger = pino ? pino({ level: process.env.LOG_LEVEL || 'info' }) : {
  info: console.log,
  warn: console.warn,
  error: console.error,
};
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
// RequestId correlation
app.use((req, _res, next) => {
  const reqId = (req.headers['x-request-id'] as string) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  (req as any).requestId = reqId;
  next();
});

// Mirror requestId on responses
app.use((req, res, next) => {
  const reqId = (req as any).requestId as string | undefined;
  if (reqId) res.setHeader('x-request-id', reqId);
  next();
});

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/v1/', apiLimiter); // Apply rate limiting to all v1 routes

// Stricter limits for LLM-heavy endpoints
const blueprintLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/v1/blueprint', blueprintLimiter);

// Initialize Firestore with robust env handling
let firestore: Firestore | null = null;
let firestoreCredentialSource: string = 'none';
let firestoreCredentialStrategy: string = 'none';
let firestoreCredentialAttemptErrors: Array<{ key: string; stage: string; message: string }> = [];
let firestoreUsedCredentialEnvKey: string | null = null;
try {
  let firestoreOptions: Record<string, unknown> = {};
  let usedCredentialEnvKey: string | null = null;
  const candidates = CREDS_ENV_KEYS
    .map((key) => ({ key, value: process.env[key] }))
    .filter((e): e is { key: string; value: string } => typeof e.value === 'string' && e.value.trim().length > 0);

  for (const { key, value } of candidates) {
    const raw = cleanRawCredString(value);
    // If it's a path, let ADC pick it up (only for GOOGLE_APPLICATION_CREDENTIALS)
    if (key === 'GOOGLE_APPLICATION_CREDENTIALS' && existsSync(raw)) {
      firestoreCredentialSource = `env-path:${key}`;
      usedCredentialEnvKey = key;
      // Leave options empty so ADC reads the file path
      firestoreCredentialStrategy = 'path:existing';
      break;
    }
    // Try raw JSON
    let parsed: any | null = null;
    try {
      if (raw.startsWith('{')) {
        parsed = JSON.parse(raw);
        firestoreCredentialSource = `env-json:${key}`;
      } else {
        throw new Error('not-json');
      }
    } catch (err1) {
      firestoreCredentialAttemptErrors.push({ key, stage: 'json', message: (err1 as Error)?.message || 'json-parse-failed' });
      // Try base64 → JSON (support url-safe variants)
      try {
        const compact = raw.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
        const pad = (4 - (compact.length % 4)) % 4;
        const normalizedBase64 = compact + '='.repeat(pad);
        const decoded = Buffer.from(normalizedBase64, 'base64').toString('utf-8');
        parsed = JSON.parse(decoded);
        firestoreCredentialSource = `env-base64:${key}`;
      } catch (err2) {
        firestoreCredentialAttemptErrors.push({ key, stage: 'base64', message: (err2 as Error)?.message || 'base64-decode-failed' });
        // Try newline-normalized JSON
        try {
          const normalized = raw.replace(/\\n/g, '\n');
          parsed = JSON.parse(normalized);
          firestoreCredentialSource = `env-normalized-json:${key}`;
        } catch (err3) {
          firestoreCredentialAttemptErrors.push({ key, stage: 'normalized-json', message: (err3 as Error)?.message || 'normalized-json-parse-failed' });
          // no-op; try next key
        }
      }
    }
    if (parsed) {
      usedCredentialEnvKey = key;
      // Write to a temp file and point google-auth to it to avoid env/path ambiguity
      const keyFilePath = pathJoin(tmpdir(), 'gcp-service-account.json');
      try {
        writeFileSync(keyFilePath, JSON.stringify(parsed), { encoding: 'utf-8' });
        process.env.GOOGLE_APPLICATION_CREDENTIALS = keyFilePath;
        firestoreCredentialStrategy = `path:written:${key}`;
        // Prefer keyFilename to make intent explicit
        (firestoreOptions as any).keyFilename = keyFilePath;
        if (parsed.project_id && typeof parsed.project_id === 'string') {
          (firestoreOptions as any).projectId = parsed.project_id;
        }
      } catch {
        // Fallback to in-memory credentials if writing fails
        delete (process as any).env.GOOGLE_APPLICATION_CREDENTIALS;
        firestoreOptions.credentials = parsed;
        if (parsed.project_id && typeof parsed.project_id === 'string') {
          (firestoreOptions as any).projectId = parsed.project_id;
        }
        firestoreCredentialStrategy = `inline:${key}`;
      }
      break;
    }
  }
  firestore = new Firestore(firestoreOptions);
  logger.info({ msg: 'Firestore initialized', credentialSource: firestoreCredentialSource, strategy: firestoreCredentialStrategy, usedEnvKey: usedCredentialEnvKey });
  firestoreUsedCredentialEnvKey = usedCredentialEnvKey;
} catch (error) {
  logger.warn({ msg: 'Firestore initialization failed', err: (error as Error)?.message });
}

export { firestore };

// --- Mount Routes ---
app.use('/v1/tools', toolsRouter);
app.use('/v1/analyze', analyzeRouter);
app.use('/v1/blueprint', blueprintRouter);
app.use('/v1/compatibility', compatibilityRouter);
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

// Debug endpoint (non-sensitive): check basic config presence
app.get('/_debug/config', (_req, res) => {
  const presentKeys = CREDS_ENV_KEYS.filter((k) => {
    const v = process.env[k];
    return typeof v === 'string' && v.trim().length > 0;
  });
  const valueHints: Record<string, { startsWithCurly: boolean; looksBase64ish: boolean; length: number }> = {};
  for (const key of presentKeys) {
    try {
      const rawVal = process.env[key] as string;
      const cleaned = cleanRawCredString(rawVal);
      const trimmed = cleaned.trim();
      const startsWithCurly = trimmed.startsWith('{');
      // Heuristic only; do not expose content
      const looksBase64ish = !startsWithCurly && /^[A-Za-z0-9+/_-]+=*$/.test(trimmed.replace(/\s+/g, ''));
      valueHints[key] = { startsWithCurly, looksBase64ish, length: trimmed.length };
    } catch {
      // ignore
    }
  }
  res.json({
    success: true,
    node: process.version,
    tools_source: (process.env.TOOLS_SOURCE || 'mock'),
    gemini_configured: Boolean(process.env.GEMINI_API_KEY),
    sentry_configured: Boolean(process.env.SENTRY_DSN),
    env: process.env.NODE_ENV || 'development',
    firestore_credential_source: firestoreCredentialSource,
    firestore_credential_strategy: firestoreCredentialStrategy,
    firestore_credential_used_env_key: firestoreUsedCredentialEnvKey,
    firestore_credential_env_keys_present: presentKeys,
    firestore_credential_attempt_errors: firestoreCredentialAttemptErrors,
    firestore_env_value_hints: valueHints,
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

// Error handler (last)
app.use((err: unknown, req: any, res: any, _next: any) => {
  const requestId = req?.requestId;
  try {
    // log structured error
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pino = require('pino');
    const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
    logger.error({ msg: 'unhandled error', err: (err as Error)?.message, requestId });
  } catch {}
  res.status(500).json({ success: false, error: 'Internal Server Error', requestId });
});

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  const PORT = process.env.PORT || 8080;

  // Add error handling to the server startup
  const server = app.listen(PORT, () => {
  logger.info({ msg: 'API server started', port: PORT });
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