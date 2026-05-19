// Public endpoint — reads patch notes from Supabase (no auth required)
const SB_URL  = () => process.env.SUPABASE_URL;
const SB_ANON = () => process.env.SUPABASE_ANON_KEY;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  if (req.method !== 'GET') return res.status(405).end();

  const url  = SB_URL();
  const anon = SB_ANON();
  if (!url || !anon) return res.status(200).json([]);

  try {
    const r = await fetch(
      `${url}/rest/v1/patch_notes?select=*&order=created_at.desc`,
      { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }
    );
    const rows = await r.json();
    return res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.status(200).json([]);
  }
};
