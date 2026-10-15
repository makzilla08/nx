const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'need ?q=' });
  const key = process.env.EXA_API_KEY;
  if (!key) return res.status(500).json({ error: 'no EXA_API_KEY on server' });
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'User-Agent': UA },
      body: JSON.stringify({ query: q + ' ดูฟรี ซับไทย พากย์ไทย', numResults: 15 })
    });
    clearTimeout(to);
    if (!r.ok) return res.status(r.status).json({ error: 'exa ' + r.status });
    const j = await r.json();
    return res.status(200).json({ results: (j.results || []).map(s => ({ url: s.url, title: s.title || s.url })) });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 120) });
  }
}
