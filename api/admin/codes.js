const SB_URL     = () => process.env.SUPABASE_URL;
const SB_SERVICE = () => process.env.SUPABASE_SERVICE_KEY;

function missingEnv(keys) {
  return keys.filter(key => !process.env[key]);
}

function sendError(res, status, code, message) {
  return res.status(status).json({ code, error: message });
}

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

async function touchMeta() {
  const r = await fetch(`${SB_URL()}/rest/v1/promo_meta?id=eq.true`, {
    method:  'PATCH',
    headers: sbHeaders(),
    body:    JSON.stringify({ updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error('Failed to update promo meta');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type');

  try {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (missingEnv(['ADMIN_USERNAME', 'ADMIN_PASSWORD']).length) {
    return sendError(res, 500, 'ADMIN_ENV_MISSING', 'Admin username/password are not configured on the server.');
  }
  if (!checkAuth(req)) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Invalid admin username or password.');
  }
  if (missingEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']).length) {
    return sendError(res, 500, 'SUPABASE_ENV_MISSING', 'Supabase admin environment variables are not configured on the server.');
  }

  const base = `${SB_URL()}/rest/v1/promo_codes`;

  if (req.method === 'GET') {
    const r    = await fetch(`${base}?select=*`, { headers: sbHeaders() });
    const rows = await r.json().catch(() => null);
    if (!r.ok) return sendError(res, r.status, 'SUPABASE_GET_FAILED', 'Supabase refused the promo codes request.');
    return res.json(Array.isArray(rows) ? rows : []);
  }

  if (req.method === 'POST') {
    const { code, reward, is_new } = req.body || {};
    if (!code) return res.status(400).json({ error: 'code is required' });

    const r    = await fetch(base, {
      method:  'POST',
      headers: sbHeaders(),
      body:    JSON.stringify({ code: code.trim().toUpperCase(), reward: (reward || '').trim(), active: true, is_new: Boolean(is_new) })
    });
    const rows = await r.json();
    if (!r.ok) return res.status(r.status).json(rows);
    await touchMeta();
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
    if ('is_new' in body) row.is_new = Boolean(body.is_new);

    const r    = await fetch(`${base}?id=eq.${id}`, { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(row) });
    const rows = await r.json();
    if (!r.ok) return res.status(r.status).json(rows);
    await touchMeta();
    return res.json(Array.isArray(rows) ? rows[0] : rows);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    const r = await fetch(`${base}?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders() });
    if (!r.ok) return res.status(r.status).json({ error: 'Delete failed' });
    await touchMeta();
    return res.json({ success: true });
  }

  return res.status(405).end();
  } catch (ex) {
    console.error('Admin codes API failed:', ex);
    return sendError(res, 500, 'ADMIN_FUNCTION_FAILED', 'Admin API crashed. Check Vercel Function Logs for the stack trace.');
  }
};
