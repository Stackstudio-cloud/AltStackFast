// This is the entry point for Vercel
// Import the Express app from the built server
const app = require('../packages/api/dist/server.js').default;

// Export the app for Vercel
module.exports = app; 