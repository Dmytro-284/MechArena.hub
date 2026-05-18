const SB_URL     = () => process.env.SUPABASE_URL;
const SB_SERVICE = () => process.env.SUPABASE_SERVICE_KEY;

function sbHeaders() {
  const key = SB_SERVICE();
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
}

function checkAuth(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  try {
    const decoded = Buffer.from(h.slice(7), 'base64').toString('utf-8');
    const colon   = decoded.indexOf(':');
    return decoded.slice(0, colon) === process.env.ADMIN_USERNAME &&
           decoded.slice(colon + 1) === process.env.ADMIN_PASSWORD;
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req))          return res.status(401).json({ error: 'Unauthorized' });

  const base = `${SB_URL()}/rest/v1/promo_codes`;

  if (req.method === 'GET') {
    const r    = await fetch(`${base}?select=*`, { headers: sbHeaders() });
    const rows = await r.json();
    return res.json(Array.isArray(rows) ? rows : []);
  }

  if (req.method === 'POST') {
    const { code, reward } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code is required' });

    const r    = await fetch(base, {
      method:  'POST',
      headers: sbHeaders(),
      body:    JSON.stringify({ code: code.trim().toUpperCase(), reward: (reward || '').trim(), active: true })
    });
    const rows = await r.json();
    if (!r.ok) return res.status(r.status).json(rows);
    return res.status(201).json(Array.isArray(rows) ? rows[0] : rows);
  }

  if (req.method === 'PUT') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const body = req.body || {};
    const row  = {};
    if ('code'   in body) row.code   = String(body.code).trim().toUpperCase();
    if ('reward' in body) row.reward = String(body.reward || '').trim();
    if ('active' in body) row.active = Boolean(body.active);

    const r    = await fetch(`${base}?id=eq.${id}`, { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(row) });
    const rows = await r.json();
    if (!r.ok) return res.status(r.status).json(rows);
    return res.json(Array.isArray(rows) ? rows[0] : rows);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const r = await fetch(`${base}?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders() });
    if (!r.ok) return res.status(r.status).json({ error: 'Delete failed' });
    return res.json({ success: true });
  }

  res.status(405).end();
};
