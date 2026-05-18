const SB_URL  = () => process.env.SUPABASE_URL;
const SB_ANON = () => process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const url  = SB_URL();
  const anon = SB_ANON();
  if (!url || !anon) return res.json({ codes: [], lastUpdated: null });

  const headers = { apikey: anon, Authorization: `Bearer ${anon}` };

  try {
    const [codesRes, metaRes] = await Promise.all([
      fetch(`${url}/rest/v1/promo_codes?select=*&active=eq.true`, { headers }),
      fetch(`${url}/rest/v1/promo_meta?select=updated_at`,        { headers })
    ]);

    const rows = await codesRes.json();
    const meta = await metaRes.json();

    res.json({
      codes:       Array.isArray(rows) ? rows : [],
      lastUpdated: Array.isArray(meta) && meta[0] ? meta[0].updated_at : null
    });
  } catch {
    res.json({ codes: [], lastUpdated: null });
  }
};
