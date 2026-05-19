// Fetches the latest messages from a Discord channel and returns them as patch notes.
// Required env vars (set in Vercel dashboard):
//   DISCORD_BOT_TOKEN  — Bot token from discord.com/developers
//   DISCORD_CHANNEL_ID — ID of the #patch-notes channel

const LIMIT = 20; // how many messages to fetch

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60'); // cache 5 min on CDN

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

    // Filter out bot messages, pins, empty content; return newest first (Discord default)
    const posts = messages
      .filter(m => m.type === 0 && m.content && m.content.trim().length > 20)
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
