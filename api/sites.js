const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const SOURCES = {
  'hit-latest': 'https://hit-anime.com/',
  'hit-sub': 'https://hit-anime.com/category/subthai/',
  'hit-dub': 'https://hit-anime.com/category/anime-thai/',
  'hit-china': 'https://hit-anime.com/category/anime-chinese-korea/',
  'hit-movie': 'https://hit-anime.com/category/themovie/',
  'fairy-latest': 'https://fairyanime.net/',
  'fairy-sub': 'https://fairyanime.net/category/ซับไทย/',
  'fairy-dub': 'https://fairyanime.net/category/พากย์ไทย/',
  'fairy-top': 'https://fairyanime.net/scoretop/'
};

function absUrl(href, base) {
  try { return new URL(href, base).href; } catch { return null; }
}

function decodeEnt(s) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[n]));
}

async function fetchHtml(url) {
  const tries = [url,
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    'https://cors.eu.org/' + url];
  let last = '';
  for (const u of tries) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(u, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8' } });
      clearTimeout(to);
      if (!r.ok) { last = 'http ' + r.status; continue; }
      return await r.text();
    } catch (e) { last = String(e.message || e).slice(0, 60); }
  }
  throw new Error(last || 'fetch failed');
}

function parseHit(html, base) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<article[\s\S]*?<\/article>/g)) {
    const a = m[0];
    const lm = a.match(/<a[^>]*href="([^"]+)"[^>]*rel="bookmark"|rel="bookmark"[^>]*href="([^"]+)"/)
      || a.match(/<a[^>]*href="([^"]+)"[^>]*title="([^"]*)"/);
    if (!lm) continue;
    const url = absUrl(lm[1] || lm[2], base);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = (a.match(/title="([^"]{3,200})"/) || [])[1]
      || (a.match(/<a[^>]*>([^<]{3,200})<\/a>/) || [])[1] || url;
    const img = (a.match(/data-src="([^"]+)"/) || a.match(/<img[^>]*src="([^"]+)"/) || [])[1] || '';
    if (/data:image\/svg/.test(img)) continue;
    out.push({ url, title: decodeEnt(title).replace(/&#0?39;/g, "'").trim(), cover: img.startsWith('//') ? 'https:' + img : img, src: 'hit-anime' });
  }
  return out;
}

function parseFairy(html, base) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/latest-movie-img-container[\s\S]*?<h3>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)) {
    const url = absUrl(m[1], base);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const block = html.slice(Math.max(0, m.index - 800), m.index);
    const img = (block.match(/data-src="(https:[^"]+)"/) || block.match(/src="(https:[^"]+\.jpg[^"]*)"/) || [])[1] || '';
    const badge = (block.match(/ribbon-(sub|thai)">([^<]+)/) || [])[2] || '';
    out.push({ url, title: m[2].trim(), cover: img, badge, src: 'fairyanime' });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { source = 'hit-latest', page = '1' } = req.query;
  const base = SOURCES[source];
  if (!base) return res.status(400).json({ error: 'unknown source' });
  const pg = Math.max(1, +page || 1);
  const url = pg > 1 ? base.replace(/\/$/, '') + '/page/' + pg + '/' : base;
  try {
    const html = await fetchHtml(url);
    const items = source.startsWith('hit-') ? parseHit(html, base) : parseFairy(html, base);
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 120) });
  }
}
