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
  'fairy-top': 'https://fairyanime.net/scoretop/',
  'o37-new': 'https://037hddd.com/',
  'o37-movies': 'https://037hddd.com/movies',
  'sd-new': 'https://seriesdet.com/',
  'sd-china': 'https://seriesdet.com/category/chinese-series/'
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
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
    'https://corsproxy.io/?url=' + encodeURIComponent(url),
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

function parseM285(html, base) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<figure class="movie-box">[\s\S]*?<\/figure>/g)) {
    const a = m[0];
    const lm = a.match(/<a[^>]*href="([^"]+)"/);
    if (!lm) continue;
    const url = absUrl(lm[1], base);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const title = decodeEnt(((a.match(/<h2[^>]*>([^<]+)<\/h2>/) || [])[1] || url).trim());
    const img = (a.match(/<img[^>]*src="([^"]+)"/) || [])[1] || '';
    out.push({ url, title, cover: img, src: 'movie285' });
  }
  return out;
}

function parseSeriesdet(html, base) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<article[\s\S]*?(?=<article|$)/g)) {
    const a = m[0];
    const lm = a.match(/<a[^>]*href="([^"]+)"[^>]*class="post-url post-title"|class="post-url post-title"[^>]*href="([^"]+)"/)
      || a.match(/<h2 class="title">\s*<a href="([^"]+)"/);
    if (!lm) continue;
    const url = absUrl(lm[1] || lm[2], base);
    if (!url || seen.has(url) || /#|author|category/.test(url)) continue;
    seen.add(url);
    const title = decodeEnt(((a.match(/<h2 class="title">[\s\S]*?<a[^>]*>([^<]+)</) || [])[1] || url).replace(/&hellip;.*$/, '').trim());
    const img = (a.match(/background-image:\s*url\((https:[^)]+)\)/) || [])[1] || '';
    out.push({ url, title, cover: img, src: 'seriesdet' });
  }
  return out;
}

function parseO37(html, base) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<a class="movie-card[^>]*href="([^"]+)"[\s\S]*?<\/a>/g)) {
    const url = absUrl(m[1], base);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const a = m[0];
    const title = decodeEnt(((a.match(/<div class="card-title">([^<]+)</) || [])[1] || url).trim());
    let img = (a.match(/<img[^>]*src="([^"]+)"/) || [])[1] || '';
    img = img.replace(/&amp;/g, '&');
    const q = (a.match(/badge-q-\w+">([^<]+)/) || [])[1] || '';
    const dub = /cad-dub">([^<]+)/.test(a), sub = /cad-sub">([^<]+)/.test(a);
    const badge = [q, dub && sub ? 'พากย์+ซับ' : dub ? 'พากย์ไทย' : sub ? 'ซับไทย' : ''].filter(Boolean).join(' ');
    out.push({ url, title, cover: absUrl(img, base) || '', badge, src: '037hd' });
  }
  return out;
}

function pickParser(source) {
  if (source.startsWith('hit-')) return parseHit;
  if (source.startsWith('fairy-')) return parseFairy;
  if (source.startsWith('m285-')) return parseM285;
  if (source.startsWith('sd-')) return parseSeriesdet;
  if (source.startsWith('o37-')) return parseO37;
  return parseHit;
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

async function searchO37(q) {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch('https://037hddd.com/api/search?q=' + encodeURIComponent(q) + '&limit=12',
      { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    clearTimeout(to);
    if (!r.ok) return [];
    const j = await r.json();
    const out = [];
    for (const m of (j.movies || []).concat(j.series || [])) {
      out.push({
        url: 'https://037hddd.com' + m.url,
        title: decodeEnt(m.title || ''),
        cover: m.img ? 'https://037hddd.com' + m.img : '',
        badge: [m.quality, m.rating ? '★' + m.rating : ''].filter(Boolean).join(' ')
      });
    }
    return out;
  } catch { return []; }
}

async function searchWP(base, parser, q) {
  try {
    const html = await fetchHtml(base + '?s=' + encodeURIComponent(q));
    return parser(html, base).slice(0, 12);
  } catch { return []; }
}

async function searchAll(req, res, q) {
  const [o37, hit, sd] = await Promise.all([
    searchO37(q),
    searchWP('https://hit-anime.com/', parseHit, q),
    searchWP('https://seriesdet.com/', parseSeriesdet, q)
  ]);
  return res.status(200).json({
    groups: [
      { site: '037hd', items: o37 },
      { site: 'hit-anime', items: hit },
      { site: 'seriesdet', items: sd }
    ]
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { source = 'hit-latest', page = '1', action = '', q = '' } = req.query;
  if (action === 'search' && q.trim()) {
    return searchAll(req, res, q.trim());
  }
  const base = SOURCES[source];
  if (!base) return res.status(400).json({ error: 'unknown source' });
  const pg = Math.max(1, +page || 1);
  const url = pg > 1 ? base.replace(/\/$/, '') + '/page/' + pg + '/' : base;
  try {
    const html = await fetchHtml(url);
    const items = pickParser(source)(html, base);
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 120) });
  }
}
