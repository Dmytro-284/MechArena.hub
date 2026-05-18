const SB_URL  = () => process.env.SUPABASE_URL;
const SB_ANON = () => process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const url  = SB_URL();
  const anon = SB_ANON();
  if (!url || !anon) return res.json([]);

  try {
    const r    = await fetch(`${url}/rest/v1/promo_codes?select=*&active=eq.true`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` }
    });
    const rows = await r.json();
    res.json(Array.isArray(rows) ? rows : []);
  } catch {
    res.json([]);
  }
};
