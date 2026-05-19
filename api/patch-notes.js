// Public read-only patch notes endpoint — fetches from Supabase patch_notes table.
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');

  if (req.method !== 'GET') return res.status(405).end();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    return res.status(200).json([]);
  }

  try {
    const r = await fetch(
      `${url}/rest/v1/patch_notes?select=*&order=release_date.desc,created_at.desc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    const rows = await r.json();
    return res.status(200).json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    return res.status(200).json([]);
  }
};
