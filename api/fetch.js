import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX_BYTES = 1500000;

function blockedIp(ip) {
  if (!net.isIP(ip)) return true;
  if (ip === '169.254.169.254') return true;
  if (ip.startsWith('127.') || ip === '::1') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const target = req.query.url;
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).json({ error: 'need ?url=https://...' });
  }
  const referer = (req.query.ref || '').toString();
  if (referer && !/^https?:\/\//i.test(referer)) {
    return res.status(400).json({ error: 'bad ref' });
  }
  try {
    const host = new URL(target).hostname;
    const addrs = await dns.lookup(host, { all: true }).catch(() => []);
    if (!addrs.length || addrs.some(a => blockedIp(a.address))) {
      return res.status(403).json({ error: 'host blocked' });
    }
  } catch {
    return res.status(403).json({ error: 'dns failed' });
  }
  const isPost = req.method === 'POST';
  let fwdHeaders = { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/json,*/*', 'Accept-Language': 'th-TH,th;q=0.9,en;q=0.8' };
  let fwdBody;
  if (isPost) {
    fwdHeaders = { ...fwdHeaders, 'Content-Type': 'application/json' };
    fwdBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  }
  try {
    const baseHeaders = { ...fwdHeaders, ...(referer ? { Referer: referer } : {}) };
    const tries = [{ url: target, enc: false },
      { url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(target), enc: true },
      { url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(target), enc: true },
      { url: 'https://corsproxy.io/?url=' + encodeURIComponent(target), enc: true }];
    let last = '', r = null;
    for (const t of tries) {
      if (isPost && t.enc) continue;
      try {
        const ctl = new AbortController();
        const to = setTimeout(() => ctl.abort(), 25000);
        const rr = await fetch(t.url, {
          method: isPost ? 'POST' : 'GET',
          body: fwdBody,
          signal: ctl.signal,
          redirect: 'follow',
          headers: t.enc ? { 'User-Agent': UA } : baseHeaders
        });
        clearTimeout(to);
        if (!rr.ok) { last = 'http ' + rr.status; continue; }
        r = rr; break;
      } catch (e) { last = String(e.message || e).slice(0, 60); }
    }
    if (!r) return res.status(502).json({ error: last || 'fetch failed' });
    const buf = Buffer.from(await r.arrayBuffer()).subarray(0, MAX_BYTES);
    res.setHeader('Content-Type', r.headers.get('content-type') || 'text/html; charset=utf-8');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 120) });
  }
}
