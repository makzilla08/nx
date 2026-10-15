const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const EP = 'https://graphql.anilist.co';

const LIST_Q = `
  query ($page: Int, $perPage: Int, $sort: [MediaSort], $search: String, $genre: String, $season: MediaSeason, $seasonYear: Int, $country: CountryCode) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, search: $search, genre: $genre, season: $season, seasonYear: $seasonYear, countryOfOrigin: $country, isAdult: false) {
      id idMal
      title { romaji english native }
      coverImage { large medium color }
      bannerImage
      averageScore popularity trending: popularity
      episodes status
      season seasonYear
      genres
      description(asHtml: false)
      startDate { year month day }
    }
  }
}`;

const INFO_Q = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id idMal
    title { romaji english native }
    coverImage { large }
    bannerImage
    averageScore popularity episodes status
    season seasonYear genres
    description(asHtml: false)
    trailer { id site }
    externalLinks { url site }
    streamingEpisodes { title url thumbnail }
  }
}`;

const pickTitle = t => t.english || t.romaji || t.native || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { action = 'trending', q = '', id = '', genre = '', page = '1', year = '', country = '' } = req.query;
  let query, vars;
  if (action === 'info' && id) {
    query = INFO_Q; vars = { id: +id };
  } else {
    query = LIST_Q;
    vars = { page: Math.max(1, +page || 1), perPage: 24 };
    if (action === 'search' && q) vars.search = q;
    else if (action === 'popular') vars.sort = ['POPULARITY_DESC'];
    else if (action === 'top') vars.sort = ['SCORE_DESC'];
    else if (action === 'seasonal') {
      const m = new Date().getMonth() + 1, y = new Date().getFullYear();
      vars.season = m <= 3 ? 'WINTER' : m <= 6 ? 'SPRING' : m <= 9 ? 'SUMMER' : 'FALL';
      vars.seasonYear = y; vars.sort = ['POPULARITY_DESC'];
    }
    else vars.sort = ['TRENDING_DESC'];
    if (genre) vars.genre = genre;
    if (year && +year) vars.seasonYear = +year;
    if (country) vars.country = country;
    vars.genre = vars.genre || undefined;
  }
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(EP, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ query, variables: vars })
    });
    clearTimeout(to);
    if (!r.ok) return res.status(r.status).json({ error: 'anilist ' + r.status });
    const j = await r.json();
    if (j.errors) return res.status(502).json({ error: j.errors[0]?.message?.slice(0, 100) || 'anilist error' });
    if (action === 'info' && id) {
      const m = j.data.Media;
      return res.status(200).json({ item: { ...m, pickedTitle: pickTitle(m.title) } });
    }
    const items = (j.data.Page.media || []).map(m => ({
      id: m.id, title: pickTitle(m.title), native: m.title.native,
      cover: m.coverImage?.large || m.coverImage?.medium || '',
      score: m.averageScore, episodes: m.episodes, status: m.status,
      seasonYear: m.seasonYear, genres: (m.genres || []).slice(0, 3)
    }));
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 120) });
  }
}
