// Entry point for Vercel serverless function
// It re-exports the existing Express app defined in packages/api

import app from '../packages/api/src/server';

export default app;

