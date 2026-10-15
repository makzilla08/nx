const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const API = 'https://037hddd.com';

async function get(path) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(API + path, { signal: ctl.signal, headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
    clearTimeout(to);
    if (!r.ok) throw new Error('upstream ' + r.status);
    return await r.json();
  } catch (e) { clearTimeout(to); throw e; }
}

const stripTitle = t => (t || '').replace(/\s*\(\d{3,4}\)\s*/g, ' ').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { genre = '', country = '', year = '', type = '', sort = '', search = '', letter = '', page = '1', limit = '24', kind = 'movie' } = req.query;
  if (req.query.meta === '1') {
    try {
      const meta = await get('/api/movies/meta');
      return res.status(200).json({
        countries: meta.countries || [],
        years: (meta.years || []).filter(y => +y >= 2010),
        genres: ['action', 'comedy', 'drama', 'horror', 'romance', 'documentary', 'war', 'thai'],
        types: ['พากย์ไทย', 'ซับไทย']
      });
    } catch (e) { return res.status(502).json({ error: String(e.message || e).slice(0, 100) }); }
  }
  try {
    const needLetter = letter && !search;
    const lim = needLetter ? 60 : Math.min(48, +limit || 24);
    const base = kind === 'series' ? '/api/series' : '/api/movies';
    let url = `${base}?page=${Math.max(1, +page || 1)}&limit=${lim}`;
    if (genre) url += '&genre=' + encodeURIComponent(genre);
    if (country) url += '&country=' + encodeURIComponent(country);
    if (year) url += '&year=' + encodeURIComponent(year);
    if (type) url += '&type=' + encodeURIComponent(type);
    if (sort) url += '&sort=' + encodeURIComponent(sort);
    if (search) url += '&search=' + encodeURIComponent(search);
    else if (letter) url += '&search=' + encodeURIComponent(letter);
    const j = await get(url);
    let items = (j.data || []).map(m => ({
      url: API + '/watch/' + (kind === 'series' ? 'series' : 'movies') + '/' + m.id,
      title: m.title || '',
      cover: m.img ? (m.img.startsWith('http') ? m.img : API + m.img) : (m.poster_url || ''),
      badge: [m.quality || (m.ep ? 'EP.' + m.ep.replace(/\D/g, '') : ''), m.type, m.rating ? '★' + m.rating : ''].filter(Boolean).join(' ')
    }));
    if (needLetter) {
      const L = letter.toLowerCase();
      items = items.filter(x => stripTitle(x.title).toLowerCase().startsWith(L));
    }
    return res.status(200).json({ items, total: j.total || items.length });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 120) });
  }
}
