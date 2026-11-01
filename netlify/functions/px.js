const zlib = require('zlib');

// ── 50+ realistic User-Agents ────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Samsung SM-S24) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.83 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36',
  'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/122.0.6261.105 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (PlayStation 5 3.00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.291 Safari/537.36',
];

const UA_CHROME = USER_AGENTS.filter(u => u.includes('Chrome/') && !u.includes('Edg/') && !u.includes('OPR/') && !u.includes('CriOS'));
const UA_MOBILE = USER_AGENTS.filter(u => u.includes('Mobile') || u.includes('Android'));

function pickUA() { return USER_AGENTS[Math.random() * USER_AGENTS.length | 0]; }
function randInt(min, max) { return min + (Math.random() * (max - min) | 0); }

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}

// ── Stripped response headers ─────────────────────────────────
const STRIP_RES_HEADERS = new Set([
  'x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
  'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy',
  'permissions-policy', 'feature-policy', 'x-content-type-options',
  'transfer-encoding', 'connection', 'keep-alive', 'strict-transport-security',
  'expect-ct', 'report-to', 'nel', 'vary', 'content-length', 'content-encoding',
  'clear-site-data', 'x-xss-protection',
]);

// ── Public Invidious instances ────────────────────────────────
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://invidious.jing.rocks',
  'https://invidious.snopyta.org',
];

function pickInvidiousInstance() {
  return INVIDIOUS_INSTANCES[Math.floor(Math.random() * INVIDIOUS_INSTANCES.length)];
}

// ── Resource type detection ──────────────────────────────────
function detectResourceType(urlPath) {
  const p = urlPath.split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?)($|\?)/.test(p)) return 'image';
  if (/\.(js|mjs|cjs)($|\?)/.test(p)) return 'script';
  if (/\.(css)($|\?)/.test(p)) return 'style';
  if (/\.(woff2?|ttf|otf|eot)($|\?)/.test(p)) return 'font';
  if (/\.(mp4|webm|ogg|mp3|wav|flac|m4a|m3u8|ts)($|\?)/.test(p)) return 'media';
  if (/\.(json)($|\?)/.test(p)) return 'fetch';
  return 'document';
}

const RESOURCE_HEADERS = {
  document: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1', 'Upgrade-Insecure-Requests': '1' },
  image: { 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'Sec-Fetch-Dest': 'image', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  script: { 'Accept': '*/*', 'Sec-Fetch-Dest': 'script', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  style: { 'Accept': 'text/css,*/*;q=0.1', 'Sec-Fetch-Dest': 'style', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  font: { 'Accept': '*/*', 'Sec-Fetch-Dest': 'font', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'cross-site' },
  media: { 'Accept': '*/*', 'Sec-Fetch-Dest': 'video', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  fetch: { 'Accept': 'application/json,text/plain,*/*', 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin' },
};

// ── Static asset cache (per-invocation, in-memory) ────────────
const assetCache = new Map();
const CACHE_TTL = { image: 60000, script: 30000, style: 60000, font: 120000, fetch: 5000 };
const CACHE_MAX = 100;

function cacheGet(key) {
  const entry = assetCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { assetCache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data, type) {
  if (assetCache.size >= CACHE_MAX) { const first = assetCache.keys().next().value; if (first) assetCache.delete(first); }
  assetCache.set(key, { data, expires: Date.now() + (CACHE_TTL[type] || 10000) });
}

// ── YouTube rewriting ────────────────────────────────────────
function rewriteYouTubeEmbed(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const isYT = host.includes('youtube.com') || host === 'youtu.be';
    if (!isYT) return rawUrl;
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      return 'https://www.youtube.com/tv';
    }
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0${u.searchParams.get('t') ? '&start=' + u.searchParams.get('t').replace(/[^0-9]/g, '') : ''}`;
    const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shorts) return `https://www.youtube.com/embed/${shorts[1]}?autoplay=1&rel=0`;
    const q = u.searchParams.get('search_query') || u.searchParams.get('q');
    if (q) return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    return 'https://www.youtube.com/tv';
  } catch(e) { return rawUrl; }
}

// ── Site overrides ────────────────────────────────────────────
const SITE_OVERRIDES = {
  'youtube.com':   (u) => rewriteYouTubeEmbed(u),
  'youtu.be':      (u) => rewriteYouTubeEmbed(u),
  'instagram.com': (u) => 'https://www.picuki.com/profile/' + extractInstagramUser(u),
  'twitter.com':   (u) => u.replace('twitter.com', 'nitter.privacydev.net'),
  'x.com':         (u) => u.replace('x.com', 'nitter.privacydev.net'),
  'reddit.com':    (u) => u.replace(/^https?:\/\/(www\.)?reddit\.com/, 'https://old.reddit.com'),
  'www.reddit.com':(u) => u.replace(/^https?:\/\/(www\.)?reddit\.com/, 'https://old.reddit.com'),
};

function extractInstagramUser(rawUrl) {
  try { const u = new URL(rawUrl); return u.pathname.split('/').filter(Boolean)[0] || ''; } catch(e) { return ''; }
}

function preprocessUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const override = SITE_OVERRIDES[host] || SITE_OVERRIDES[u.hostname.toLowerCase()];
    if (override) { const result = override(rawUrl); if (result && result !== rawUrl) return result; }
  } catch(e) {}
  return rawUrl;
}

function buildUpstreamHeaders(targetUrl, resourceType, event) {
  const isYouTube = targetUrl.hostname.includes('youtube.com') || targetUrl.hostname.includes('youtu.be') || targetUrl.hostname.includes('ytimg.com') || targetUrl.hostname.includes('googlevideo.com');
  const isYouTubeTV = isYouTube && targetUrl.pathname.startsWith('/tv');
  const ua = isYouTubeTV
    ? 'Mozilla/5.0 (PlayStation 5 3.00) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.291 Safari/537.36'
    : isYouTube
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    : pickUA();
  const rh = RESOURCE_HEADERS[resourceType] || RESOURCE_HEADERS.document;
  const isChrome = ua.includes('Chrome/') && !ua.includes('Firefox/');
  const isMobile = ua.includes('Mobile');
  const secChUa = isChrome ? (isMobile ? '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"' : '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"') : undefined;

  const headers = {
    'User-Agent': ua,
    'Accept': rh['Accept'],
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'DNT': '1',
    'Referer': targetUrl.origin + '/',
    'Origin': targetUrl.origin,
    'sec-ch-ua': secChUa,
    'sec-ch-ua-mobile': isMobile ? '?1' : '?0',
    'sec-ch-ua-platform': ua.includes('PlayStation') ? '"PlayStation 5"' : ua.includes('Windows') ? '"Windows"' : ua.includes('Mac') ? '"macOS"' : ua.includes('Linux') ? '"Linux"' : ua.includes('Android') ? '"Android"' : '"iOS"',
    ...rh,
  };

  if (isYouTube) {
    headers['x-origin'] = 'https://www.youtube.com';
    headers['Referer'] = 'https://www.youtube.com/';
    headers['Origin'] = 'https://www.youtube.com';
    headers['Sec-Fetch-Site'] = 'same-origin';
    headers['Upgrade-Insecure-Requests'] = '1';
  }

  // Forward POST Content-Type from original request
  if (event.headers && event.headers['content-type']) {
    headers['Content-Type'] = event.headers['content-type'];
  }

  for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];
  return headers;
}

function toProxyUrl(url, base) {
  try {
    if (url.startsWith('//')) url = 'https:' + url;
    const abs = new URL(url, base).href;
    if (abs.startsWith('http://') || abs.startsWith('https://')) return '/px?url=' + encodeURIComponent(abs);
  } catch (e) {}
  return url;
}

function rewriteHtml(html, base) {
  const injectScript = `<script>
(function(){
var P='/px?url=';
var _ubCache=${JSON.stringify(String(base))};
function _getUpstreamBase(){try{var m=location.search.match(/[?&]url=([^&]+)/);if(m){_ubCache=decodeURIComponent(m[1]);return _ubCache;}if(_ubCache)return _ubCache;}catch(e){}return _ubCache||null;}
function tp(u){try{if(!u||typeof u!=='string'||u.startsWith(P)||u.startsWith('data:')||u.startsWith('blob:')||u.startsWith('javascript:'))return u;if(u.startsWith('//')){var up=_getUpstreamBase();var proto=up?new URL(up).protocol:'https:';u=proto+u;}var base=_getUpstreamBase()||location.href;var a=new URL(u,base).href;if(a.startsWith('http://')||a.startsWith('https://'))return P+encodeURIComponent(a);}catch(e){}return u;}
var _xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=tp(String(u));}catch(e){}return _xo.apply(this,arguments);};
var _fe=window.fetch;window.fetch=function(i,o){try{if(typeof i==='string'){i=tp(i);}else if(i&&typeof i==='object'&&i.url){var _nu=tp(String(i.url));if(_nu!==i.url){try{i=new Request(_nu,i);}catch(e){}}}}catch(e){}return _fe.call(this,i,o);};
if(navigator.sendBeacon){var _sb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){try{u=tp(String(u));}catch(e){}return _sb(u,d);};}
(function(){var _sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){try{var ln=(n||'').toLowerCase();if(typeof v==='string'&&(ln==='src'||ln==='href'||ln==='action'||ln==='data'||ln==='srcset')){if(ln==='srcset'){v=v.split(',').map(function(part){var s=part.trim().split(/\\s+/);if(s[0])s[0]=tp(s[0]);return s.join(' ');}).join(', ');}else{v=tp(v);}}}catch(e){}return _sa.call(this,n,v);};})();
document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(!h||h.startsWith('#')||h.startsWith('javascript:')||h.startsWith('mailto:')||h.startsWith('tel:'))return;try{var base=_getUpstreamBase()||location.href;if(h.startsWith('//')){h=(new URL(base)).protocol+h;}var ab=new URL(h,base).href;if((ab.startsWith('http://')||ab.startsWith('https://'))&&ab.indexOf(P)===-1){e.preventDefault();location.href=P+encodeURIComponent(ab);}}catch(x){}},true);
document.addEventListener('submit',function(e){var f=e.target;if(!f)return;try{var fbase=_getUpstreamBase()||location.href;var fa=new URL(f.action||'',fbase).href;if(!fa.startsWith('http')||fa.indexOf(P)!==-1)return;e.preventDefault();var m=(f.method||'GET').toUpperCase(),d=new URLSearchParams(new FormData(f)).toString(),sep=fa.indexOf('?')>=0?'&':'?';if(m==='GET'){location.href=P+encodeURIComponent(fa+(d?sep+d:''));}else{location.href=P+encodeURIComponent(fa)+(d?'&_body='+encodeURIComponent(d):'');}}catch(x){}},true);
['pushState','replaceState'].forEach(function(fn){var orig=history[fn];history[fn]=function(st,ti,url){if(url!=null){try{var s=String(url);if(!s||s.startsWith('#')||s.startsWith(P))return orig.call(this,st,ti,url);var qm=location.search.match(/[?&]url=([^&]+)/);var base=qm?decodeURIComponent(qm[1]):_ubCache;if(base){_ubCache=base;var abs=new URL(s,base).href;if(abs.startsWith('http://')||abs.startsWith('https://'))url=P+encodeURIComponent(abs);}}catch(e){}}return orig.call(this,st,ti,url);};});
var _wo=window.open;window.open=function(u,n,f){if(typeof u==='string')u=tp(u);return _wo.call(this,u,n,f);};
try{var _la=Location.prototype.assign;Location.prototype.assign=function(u){return _la.call(this,tp(String(u)));};var _lr=Location.prototype.replace;Location.prototype.replace=function(u){return _lr.call(this,tp(String(u)));};}catch(e){}
try{var _locDesc=Object.getOwnPropertyDescriptor(Location.prototype,'href');if(_locDesc&&_locDesc.set){Object.defineProperty(Location.prototype,'href',{get:_locDesc.get,set:function(v){try{v=tp(String(v));}catch(e){}return _locDesc.set.call(this,v);},configurable:true});}}catch(e){}
(function(){var tags=[['HTMLImageElement','src'],['HTMLImageElement','srcset'],['HTMLVideoElement','src'],['HTMLVideoElement','poster'],['HTMLSourceElement','src'],['HTMLSourceElement','srcset'],['HTMLScriptElement','src'],['HTMLLinkElement','href'],['HTMLIFrameElement','src']];tags.forEach(function(t){var proto=window[t[0]]&&window[t[0]].prototype;if(!proto)return;var d=Object.getOwnPropertyDescriptor(proto,t[1]);if(!d||!d.set)return;Object.defineProperty(proto,t[1],{get:d.get,set:function(v){try{v=tp(String(v));}catch(e){}return d.set.call(this,v);},configurable:true,enumerable:d.enumerable});});var _ss=CSSStyleDeclaration.prototype.setProperty;CSSStyleDeclaration.prototype.setProperty=function(p,v,pri){if(typeof v==='string'&&(p==='background-image'||p==='background')&&v.indexOf('url(')!==-1){v=v.replace(/url\\(['"]?(https?:\\/\\/[^'")\\s]+)['"]?\\)/g,function(m,u){return 'url('+tp(u)+')';});}return _ss.call(this,p,v,pri);};})();
try{Object.defineProperty(window,'top',{get:function(){return window;},configurable:true});}catch(e){}
try{Object.defineProperty(window,'parent',{get:function(){return window;},configurable:true});}catch(e){}
try{Object.defineProperty(window,'frameElement',{get:function(){return null;},configurable:true});}catch(e){}
try{Object.defineProperty(navigator,'serviceWorker',{get:function(){return{register:function(){return Promise.resolve({scope:'/'});},getRegistrations:function(){return Promise.resolve([]);},addEventListener:function(){}};},configurable:true});}catch(e){}
try{if(typeof navigator.getInstalledRelatedApps==='undefined'||true){Object.defineProperty(navigator,'getInstalledRelatedApps',{value:function(){return Promise.resolve([]);},configurable:true,writable:true});}}catch(e){}
try{var _cErr=console.error.bind(console);console.error=function(){try{var a=arguments[0];if(typeof a==='string'&&(a.indexOf('ERR_ALPN')!==-1||a.indexOf('wss://')!==-1||a.indexOf('getInstalledRelatedApps')!==-1||a.indexOf('FedCM')!==-1))return;}catch(e){}return _cErr.apply(console,arguments);};}catch(e){}
})();</script>`;

  html = html.replace(/<base\s[^>]*>/gi, '');
  html = html.replace(/<meta[^>]*http-equiv=["'](?:content-security-policy|x-frame-options)["'][^>]*>/gi, '');
  html = html.replace(/<meta[^>]*http-equiv=["']content-security-policy-report-only["'][^>]*>/gi, '');
  html = html.replace(/\s+integrity=["'][^"']*["']/gi, '');
  html = html.replace(/\s+nonce=["'][^"']*["']/gi, '');

  const attrRewrites = [
    [/<a\b([^>]*?)\shref=(['"])([^"'#\s][^"']*)(\2)/gi, 3],
    [/<form\b([^>]*?)\saction=(['"])([^"']*)(\2)/gi, 3],
    [/<script\b([^>]*?)\ssrc=(['"])([^"']*)(\2)/gi, 3],
    [/<link\b([^>]*?)\shref=(['"])([^"']*)(\2)/gi, 3],
    [/<img\b([^>]*?)\ssrc=(['"])([^"']*)(\2)/gi, 3],
    [/<source\b([^>]*?)\ssrc=(['"])([^"']*)(\2)/gi, 3],
    [/<video\b([^>]*?)\ssrc=(['"])([^"']*)(\2)/gi, 3],
    [/<iframe\b([^>]*?)\ssrc=(['"])([^"']*)(\2)/gi, 3],
    [/<meta\b([^>]*?)\scontent=(['"])(https?:\/\/[^"']*)(\2)/gi, 3],
    [/<img\b([^>]*?)\ssrcset=(['"])([^"']*)(\2)/gi, 3],
    [/<source\b([^>]*?)\ssrcset=(['"])([^"']*)(\2)/gi, 3],
    [/<img\b([^>]*?)\sdata-src=(['"])([^"']*)(\2)/gi, 3],
    [/<div\b([^>]*?)\sdata-src=(['"])([^"']*)(\2)/gi, 3],
    [/<div\b([^>]*?)\sdata-href=(['"])([^"']*)(\2)/gi, 3],
    [/<video\b([^>]*?)\sposter=(['"])([^"']*)(\2)/gi, 3],
  ];

  for (const [rx, groupIdx] of attrRewrites) {
    html = html.replace(rx, (m, before, q, url, q2) => {
      if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) return m;
      if (url.startsWith('//')) {
        const abs = 'https:' + url;
        if (rx.toString().includes('srcset')) return m.replace(url, toProxyUrl(abs, base));
        return m.slice(0, m.indexOf(url)) + toProxyUrl(abs, base) + q2;
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        if (rx.toString().includes('srcset')) return m.replace(url, toProxyUrl(url, base));
        return m.slice(0, m.indexOf(url)) + toProxyUrl(url, base) + q2;
      }
      if (!url.startsWith('/px?')) {
        try {
          const abs = new URL(url, base).href;
          if (abs.startsWith('http://') || abs.startsWith('https://')) {
            if (rx.toString().includes('srcset')) return m.replace(url, toProxyUrl(abs, base));
            return m.slice(0, m.indexOf(url)) + toProxyUrl(abs, base) + q2;
          }
        } catch {}
      }
      return m;
    });
  }

  html = html.replace(/(<[^>]+\sstyle="[^"]*url\()(['"]?)(https?:\/\/[^'")\s]+)\2(\))/gi, (m, pre, q, url, post) => pre + q + toProxyUrl(url, base) + q + post);

  html = html.replace(/(<(?:img|source)\b[^>]*?\ssrcset=)(['"])([^'"]*)(\2)/gi, (m, pre, q1, srcset, q2) => {
    return pre + q1 + srcset.replace(/(https?:\/\/[^\s,]+)/g, (u) => toProxyUrl(u, base)) + q2;
  });

  if (/<head[\s>]/i.test(html)) html = html.replace(/(<head[\s>][^>]*>)/i, '$1' + injectScript);
  else html = injectScript + html;

  return html;
}

function rewriteCss(css, base) {
  return css.replace(/url\((['"]?)([^'")\s]+)\1\)/gi, (m, q, url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return m;
    if (url.startsWith('//')) url = 'https:' + url;
    return 'url(' + q + toProxyUrl(url, base) + q + ')';
  });
}

async function decodeBody(response) {
  const encoding = (response.headers.get('content-encoding') || '').toLowerCase();
  const buf = Buffer.from(await response.arrayBuffer());
  if (!encoding || encoding === 'identity') return buf;
  return new Promise((resolve) => {
    if (encoding === 'gzip' || encoding === 'x-gzip') zlib.gunzip(buf, (err, r) => resolve(err ? buf : r));
    else if (encoding === 'deflate') zlib.inflate(buf, (err, r) => { if (err) zlib.inflateRaw(buf, (err2, r2) => resolve(err2 ? buf : r2)); else resolve(r); });
    else if (encoding === 'br') zlib.brotliDecompress(buf, (err, r) => resolve(err ? buf : r));
    else resolve(buf);
  });
}

function isAssetUrl(url) {
  try { return /\.(js|mjs|cjs|css)$/i.test(new URL(url).pathname); } catch(e) { return false; }
}

function assetErrorPlaceholder(ext, rawUrl) {
  if (ext === 'css') return `/* Galaxy Annihilating CHS Lab Proxy: Cannot load CSS from ${rawUrl.replace(/<\//g,'<\\/')} */`;
  return `// Galaxy Annihilating CHS Lab Proxy: Cannot load JS from ${rawUrl.replace(/<\//g,'<\\/')}`;
}

function errorPage(status, rawUrl, msg, tip) {
  const safe = rawUrl.replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return `<!DOCTYPE html><html><head><title>Cannot Load Page</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d0e14;color:#e8e9f0;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:14px;padding:24px;text-align:center}
.icon{font-size:38px}
.lbl{color:#f59e0b;font-size:20px;font-weight:700}
p{color:#888;font-size:14px;max-width:460px;line-height:1.6}
.url{color:#aaa;font-size:11px;word-break:break-all;max-width:460px;background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)}
.tip{font-size:12px;color:#4a9eff;max-width:460px;background:rgba(74,158,255,0.07);padding:10px 16px;border-radius:8px;border:1px solid rgba(74,158,255,0.15)}
.btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(255,255,255,0.7);text-decoration:none;font-size:13px}
.btn:hover{background:rgba(255,255,255,0.12);color:#fff}
.btn.primary{background:rgba(229,57,53,0.12);border-color:rgba(229,57,53,0.3);color:#ef5350}
</style></head><body>
<div class="icon">&#9888;&#65039;</div>
<div class="lbl">Error ${status} &mdash; Cannot Load Page</div>
<p>${msg}</p>
<div class="url">${safe}</div>
${tip ? `<div class="tip">&#128161; ${tip}</div>` : ''}
<div class="btns">
  <a class="btn" href="javascript:history.back()">&#8592; Go Back</a>
  <a class="btn primary" href="${safe}" target="_blank" rel="noopener">Open Directly &#8599;</a>
  <a class="btn" href="/px?url=${encodeURIComponent(rawUrl)}">&#8635; Retry</a>
</div>
</body></html>`;
}

// ── Event body reading (for POST/PUT/PATCH) ──────────────────
function readBody(event) {
  if (!event.body) return null;
  return event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body, 'utf8');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': '*' }, body: '' };
  }

  let rawUrl = (event.queryStringParameters || {}).url;
  if (!rawUrl) return { statusCode: 400, body: 'Missing url parameter' };
  if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;

  const processedUrl = preprocessUrl(rawUrl);

  let targetUrl;
  try { targetUrl = new URL(processedUrl); } catch (e) { return { statusCode: 400, body: 'Invalid URL' }; }

  const resourceType = detectResourceType(targetUrl.pathname + targetUrl.search);
  const isCacheable = resourceType !== 'document' && resourceType !== 'fetch';
  const cacheKey = targetUrl.href;
  const isYTDomain = targetUrl.hostname.includes('youtube.com') || targetUrl.hostname.includes('youtu.be');

  // Check cache for non-HTML resources
  if (isCacheable) {
    const cached = cacheGet(cacheKey);
    if (cached) return { statusCode: 200, headers: { 'Content-Type': resourceType === 'style' ? 'text/css; charset=utf-8' : resourceType === 'script' ? 'application/javascript; charset=utf-8' : 'application/octet-stream', 'X-Cache': 'HIT' }, body: cached.toString('base64'), isBase64Encoded: true };
  }

  // YouTube: rewrite to embed for document requests
  if (resourceType === 'document' && isYTDomain) {
    const embedUrl = rewriteYouTubeEmbed(rawUrl);
    try { targetUrl = new URL(embedUrl); rawUrl = embedUrl; } catch(e) {}
  }

  const maxRetries = resourceType === 'document' ? 1 : 0;
  let lastError = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt));

      const timeout = resourceType === 'document' ? 8500 : 7000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const noCookies = lastError && attempt > 0;
      const upstreamHeaders = buildUpstreamHeaders(targetUrl, resourceType, event);

      const fetchOptions = {
        method: (event.httpMethod === 'GET' || event.httpMethod === 'HEAD') ? event.httpMethod : 'GET',
        headers: upstreamHeaders,
        redirect: 'follow',
        signal: controller.signal,
      };

      if (event.httpMethod === 'POST' || event.httpMethod === 'PUT' || event.httpMethod === 'PATCH') {
        fetchOptions.method = event.httpMethod;
        const body = readBody(event);
        if (body) fetchOptions.body = body;
      }

      const response = await fetch(targetUrl.href, fetchOptions);
      clearTimeout(timer);

      const finalUrl = new URL(response.url || processedUrl);

      const respHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      };

      response.headers.forEach((value, name) => {
        const lower = name.toLowerCase();
        if (STRIP_RES_HEADERS.has(lower)) return;
        if (lower === 'set-cookie' || lower === 'location') return;
        respHeaders[name] = value;
      });

      // Handle redirects
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          const abs = new URL(location, finalUrl).href;
          return { statusCode: 302, headers: { ...respHeaders, 'Location': '/px?url=' + encodeURIComponent(abs) }, body: '' };
        }
      }

      const ct = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

      // Handle upstream errors
      if (response.status >= 400) {
        if ((response.status === 400 || response.status === 403) && attempt < maxRetries) {
          lastError = true;
          continue;
        }
        const statusMessages = {
          400: 'The site rejected this request. It may require login or actively blocks proxies.',
          401: 'This page requires you to be logged in.',
          403: 'This site is blocking proxy access.',
          404: 'Page not found on the remote site.',
          429: 'Too many requests — the site is rate-limiting.',
          500: 'The site returned an internal server error.',
          502: 'Bad gateway from the remote site.',
          503: 'The site is temporarily unavailable.',
        };
        const msg = statusMessages[response.status] || `The site returned error ${response.status}.`;
        const tip = response.status === 400 || response.status === 403 ? 'Try opening directly in a new tab, or retry.' : null;

        if (ct === 'text/html' || ct === 'application/xhtml+xml') {
          const body = await decodeBody(response);
          const html = body.toString('utf8');
          if (html.length > 2000) {
            return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' }, body: rewriteHtml(html, finalUrl) };
          }
        }
        return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' }, body: errorPage(response.status, rawUrl, msg, tip) };
      }

      // Successful response
      // If a JS/CSS asset returned HTML, it's an error page from the upstream
      if ((ct === 'text/html' || ct === 'application/xhtml+xml') && isAssetUrl(rawUrl)) {
        const ext = (rawUrl.match(/\.(js|mjs|cjs|css)$/i)?.[1] || 'js').toLowerCase();
        const mime = ext === 'css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
        return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': mime }, body: assetErrorPlaceholder(ext, rawUrl) };
      }

      if (ct === 'text/html' || ct === 'application/xhtml+xml') {
        const body = await decodeBody(response);
        return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' }, body: rewriteHtml(body.toString('utf8'), finalUrl) };
      }

      if (ct === 'text/css') {
        const body = await decodeBody(response);
        return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': 'text/css; charset=utf-8' }, body: rewriteCss(body.toString('utf8'), finalUrl) };
      }

      if (ct === 'application/javascript' || ct === 'text/javascript' || ct === 'application/x-javascript') {
        const body = await decodeBody(response);
        return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': 'application/javascript; charset=utf-8' }, body: body.toString('utf8') };
      }

      if (ct === 'application/json') {
        const body = await decodeBody(response);
        return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': 'application/json' }, body: body.toString('utf8') };
      }

      // Binary / other
      const buf = await decodeBody(response);
      if (isCacheable && buf.length < 500000) cacheSet(cacheKey, buf, resourceType);
      const rawCt = response.headers.get('content-type') || 'application/octet-stream';
      return { statusCode: 200, headers: { ...respHeaders, 'Content-Type': rawCt }, body: buf.toString('base64'), isBase64Encoded: true };

    } catch (err) {
      clearTimeout(timer);
      if (attempt < maxRetries) { lastError = true; continue; }
      const isTimeout = err.name === 'AbortError' || (err.message || '').toLowerCase().includes('timeout');
      return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' }, body: errorPage(isTimeout ? 504 : 502, rawUrl, isTimeout ? 'The request took too long. The site may be slow or blocking proxy connections.' : 'This site could not be loaded through the proxy.', 'Try opening directly in a new tab instead.') };
    }
  }
};
