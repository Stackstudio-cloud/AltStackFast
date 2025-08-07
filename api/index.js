// Vercel serverless entry (plain JS). It re-exports the compiled Express app.

const app = require('../packages/api/dist/server');
module.exports = app.default || app; // support both ES default export and CommonJS
