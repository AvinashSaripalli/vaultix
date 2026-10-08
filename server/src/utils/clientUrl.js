// CLIENT_URL may contain a comma-separated list of allowed origins (for CORS).
// Email links (verify/reset/invite) must point at a single canonical origin —
// use the first entry.
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)[0];

module.exports = { clientUrl };
