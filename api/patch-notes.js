// Fetches latest messages from a Discord channel and returns them as patch notes.
// Env vars: DISCORD_BOT_TOKEN, DISCORD_CHANNEL_ID

const LIMIT = 20;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  if (req.method !== 'GET') return res.status(405).end();

  const token     = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    return res.status(200).json({ error: 'DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID not configured', posts: [] });
  }

  try {
    const r = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=${LIMIT}`,
      { headers: { Authorization: `Bot ${token}` } }
    );

    if (!r.ok) {
      const body = await r.text();
      return res.status(200).json({ error: `Discord API error ${r.status}: ${body}`, posts: [] });
    }

    const messages = await r.json();

    // ?debug=1 — show raw Discord response for troubleshooting
    if (req.query && req.query.debug === '1') {
      return res.status(200).json({ raw: messages });
    }

    const posts = messages
      .filter(m => m.type === 0 && m.content && m.content.trim().length > 0)
      .map(m => ({
        id:        m.id,
        content:   m.content,
        timestamp: m.timestamp,
        author:    m.author?.username || null,
      }));

    return res.status(200).json(posts);
  } catch (e) {
    return res.status(200).json({ error: e.message, posts: [] });
  }
};
