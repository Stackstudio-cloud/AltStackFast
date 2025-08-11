/*
 Import Developer-tools-API SQLite data into Stackfast ToolProfile JSON, and optionally POST to API.
 Usage:
   node scripts/import-devtools.js            # writes developer-tools-export.json
   API_BASE=https://stackfast-api.vercel.app ADMIN_JWT=... node scripts/import-devtools.js  # also POSTs
*/
const fs = require('fs');
const path = require('path');

async function main() {
  const dbPath = path.resolve(__dirname, '../Developer-tools-API/src/database/app.db');
  if (!fs.existsSync(dbPath)) {
    console.error('SQLite DB not found at', dbPath);
    process.exit(1);
  }

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  const query = 'SELECT * FROM developer_tools';
  const res = db.exec(query);
  if (!res || res.length === 0) {
    console.error('No rows returned from developer_tools');
    process.exit(1);
  }
  const columns = res[0].columns;
  const values = res[0].values;

  function safeParseJson(text) {
    if (!text || typeof text !== 'string') return [];
    try { return JSON.parse(text); } catch { return []; }
  }

  function slugify(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 64);
  }

  function normalizeScore(score) {
    if (score == null) return null;
    const n = Number(score);
    if (!Number.isFinite(n)) return null;
    // DB uses 1-10, convert to 0-1
    const clamped = Math.max(1, Math.min(10, n));
    return Number(((clamped - 1) / 9).toFixed(3));
  }

  const tools = values.map((row) => {
    const obj = Object.fromEntries(columns.map((c, i) => [c, row[i]]));
    const categories = obj.category ? String(obj.category).split(',').map((s) => s.trim()).filter(Boolean) : [];
    const tool = {
      tool_id: slugify(obj.name),
      name: obj.name,
      description: obj.description || '',
      category: categories.length ? categories : ['Uncategorized'],
      notable_strengths: safeParseJson(obj.notable_strengths),
      known_limitations: safeParseJson(obj.known_limitations),
      output_types: [],
      integrations: Array.from(new Set([
        ...safeParseJson(obj.native_integrations),
        ...safeParseJson(obj.verified_integrations),
        ...safeParseJson(obj.frameworks),
        ...safeParseJson(obj.supported_languages),
      ].filter(Boolean))),
      license: null,
      maturity_score: normalizeScore(obj.maturity_score),
      popularity_score: normalizeScore(obj.popularity_score),
      last_updated: new Date().toISOString(),
      schema_version: '2025-08-04',
      requires_review: true,
      source_url: obj.url || undefined,
      source_description: undefined,
      scraping_failed: undefined,
      pricing: obj.pricing || undefined,
    };
    return tool;
  });

  const outPath = path.resolve(process.cwd(), 'developer-tools-export.json');
  fs.writeFileSync(outPath, JSON.stringify({ count: tools.length, tools }, null, 2));
  console.log(`Wrote ${tools.length} tools to ${outPath}`);

  const apiBase = process.env.API_BASE;
  const adminJwt = process.env.ADMIN_JWT;
  if (apiBase && adminJwt) {
    console.log(`Posting to ${apiBase}/v1/tools ...`);
    let posted = 0, failed = 0;
    for (const t of tools) {
      try {
        const resp = await fetch(`${apiBase}/v1/tools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
          body: JSON.stringify(t),
        });
        if (!resp.ok) {
          const text = await resp.text();
          console.warn('POST failed', resp.status, text.slice(0, 200));
          failed += 1;
        } else {
          posted += 1;
        }
      } catch (e) {
        console.warn('POST error', (e && e.message) || String(e));
        failed += 1;
      }
    }
    console.log(`Import complete: posted=${posted}, failed=${failed}`);
  } else {
    console.log('Set API_BASE and ADMIN_JWT to POST to the API.');
  }
}

main().catch((e) => {
  console.error('Import failed:', e);
  process.exit(1);
});


