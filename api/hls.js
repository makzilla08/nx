const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const target = req.query.url;
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).json({ error: 'need ?url=https://...' });
  }
  const referer = req.query.ref || '';
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 30000);
    const r = await fetch(target, {
      signal: ctl.signal, redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': '*/*', ...(referer ? { Referer: referer } : {}) }
    });
    clearTimeout(to);
    if (!r.ok) return res.status(r.status).json({ error: 'upstream ' + r.status });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer());
    const isPlaylist = ct.includes('mpegurl') || ct.includes('m3u8') || buf.slice(0, 7).toString() === '#EXTM3U';
    if (!isPlaylist) {
      res.setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(buf);
    }
    const base = new URL(target);
    const self = '/api/hls';
    const prox = u => self + '?url=' + encodeURIComponent(new URL(u, base).href) + (referer ? '&ref=' + encodeURIComponent(referer) : '');
    let text = buf.toString('utf-8');
    text = text.replace(/URI="([^"]+)"/g, (_, u) => 'URI="' + prox(u) + '"');
    text = text.split('\n').map(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return line;
      if (/^https?:\/\//i.test(t)) return prox(t);
      return prox(t);
    }).join('\n');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(text);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 120) });
  }
}
