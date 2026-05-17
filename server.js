const express = require('express');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const zlib = require('zlib');
const http = require('http');
const https = require('https');

// Keep-alive agents for upstream connections (reuse TCP sockets)
let undiciDispatcher = null;
try {
  // Node.js built-in fetch uses undici — configure dispatcher for keep-alive
  const { Agent: UndiciAgent, setGlobalDispatcher } = require('undici');
  undiciDispatcher = new UndiciAgent({
    keepAliveTimeout: 30000,
    keepAliveMaxTimeout: 60000,
    connections: 32,
    connect: { rejectUnauthorized: true },
  });
  setGlobalDispatcher(undiciDispatcher);
} catch {} // fallback: built-in fetch default config

const app = express();
const PORT = process.env.PORT || 5000;
const SITE_DIR = __dirname;

// ── 50+ realistic User-Agents ────────────────────────────────
const USER_AGENTS = [
  // Chrome Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  // Chrome Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Chrome Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Firefox Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  // Firefox Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
  // Firefox Linux
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  // Edge Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  // Edge Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  // Safari Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  // Opera
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0',
  // Chrome Android
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.113 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Samsung SM-S24) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.83 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.118 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36',
  // Firefox Android
  'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
  'Mozilla/5.0 (Android 13; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0',
  // Safari iOS
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // Chrome iOS
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/537.36 (KHTML, like Gecko) CriOS/124.0.6367.71 Mobile/15E148 Safari/604.1',
  // Samsung Internet
  'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/122.0.6261.105 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/121.0.6167.101 Mobile Safari/537.36',
  // Older Chrome versions (for sites that check version ranges)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const UA_CHROME = USER_AGENTS.filter(u => u.includes('Chrome/') && !u.includes('Edg/') && !u.includes('OPR/') && !u.includes('CriOS'));
const UA_FIREFOX = USER_AGENTS.filter(u => u.includes('Firefox/') && !u.includes('Mobile'));
const UA_MOBILE = USER_AGENTS.filter(u => u.includes('Mobile') || u.includes('Android'));

// ── Stripped headers ─────────────────────────────────────────
const STRIP_RES_HEADERS = new Set([
  'x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
  'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy',
  'permissions-policy', 'feature-policy', 'x-content-type-options',
  'transfer-encoding', 'connection', 'keep-alive', 'strict-transport-security',
  'expect-ct', 'report-to', 'nel', 'vary', 'content-length', 'content-encoding',
  'clear-site-data', 'x-xss-protection',
]);

// ── Cookie jar (per-domain session persistence) ──────────────
const cookieJar = {};

function pickUA() { return USER_AGENTS[Math.random() * USER_AGENTS.length | 0]; }
function randomIp() {
  const a = 10 + (Math.random() * 200 | 0);
  const b = Math.random() * 255 | 0;
  const c = Math.random() * 255 | 0;
  const d = Math.random() * 255 | 0;
  return `${a}.${b}.${c}.${d}`;
}
function randInt(min, max) { return min + (Math.random() * (max - min) | 0); }

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return 'unknown'; }
}

function getCookies(domain) {
  const jar = cookieJar[domain];
  if (!jar) return '';
  const now = Date.now();
  const valid = Object.entries(jar).filter(([k, v]) => !v.expires || v.expires > now);
  if (valid.length !== Object.keys(jar).length) {
    cookieJar[domain] = Object.fromEntries(valid);
  }
  return valid.map(([k, v]) => `${k}=${v.value}`).join('; ');
}

function setCookies(domain, setCookieHeaders) {
  if (!setCookieHeaders || !setCookieHeaders.length) return;
  if (!cookieJar[domain]) cookieJar[domain] = {};
  for (const h of setCookieHeaders) {
    const parts = h.split(';');
    const eq = parts[0].indexOf('=');
    if (eq < 1) continue;
    const name = parts[0].slice(0, eq).trim();
    const value = parts[0].slice(eq + 1).trim();
    let expires = null;
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].trim().toLowerCase();
      if (p.startsWith('max-age=')) expires = Date.now() + parseInt(p.slice(8)) * 1000;
      if (p.startsWith('expires=')) expires = new Date(p.slice(8)).getTime();
    }
    cookieJar[domain][name] = { value, expires };
  }
}

// ── Static asset cache ───────────────────────────────────────
const assetCache = new Map();
const CACHE_TTL = {
  image: 60000,     // 1 min
  script: 30000,    // 30s
  style: 60000,     // 1 min
  font: 120000,     // 2 min
  fetch: 5000,      // 5s
};
const CACHE_MAX = 200;

function cacheGet(key) {
  const entry = assetCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { assetCache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data, type) {
  if (assetCache.size >= CACHE_MAX) {
    const first = assetCache.keys().next().value;
    if (first) assetCache.delete(first);
  }
  const ttl = CACHE_TTL[type] || 10000;
  assetCache.set(key, { data, expires: Date.now() + ttl });
}

// ── URL rewriting ────────────────────────────────────────────
function toProxyUrl(url, base) {
  try {
    const abs = new URL(url, base).href;
    if (abs.startsWith('http://') || abs.startsWith('https://')) return '/px?url=' + encodeURIComponent(abs);
  } catch {}
  return url;
}

// ── HTML rewriting ───────────────────────────────────────────
function rewriteHtml(html, base, domain) {
  // Inject proxy script (inline)
  const injectScript = `<script>(function(){
var P='/px?url=';
/* Cache of the upstream base URL.  Populated on first read and kept even after
   SPA pushState navigation removes the ?url= param from location.search. */
var _ubCache=${JSON.stringify(String(base))};
/* Extract the upstream (real) URL from the proxy page's ?url= query param.
   Falls back to the server-embedded _ubCache so SPA pushState navigation never loses the base. */
function _getUpstreamBase(){try{var m=location.search.match(/[?&]url=([^&]+)/);if(m){_ubCache=decodeURIComponent(m[1]);return _ubCache;}if(_ubCache)return _ubCache;}catch(e){}return _ubCache||null;}
/* tp: rewrite URL to proxy path. Uses upstream base for relative/protocol-relative URL resolution. */
function tp(u){try{if(!u||typeof u!=='string'||u.startsWith(P)||u.startsWith('data:')||u.startsWith('blob:')||u.startsWith('javascript:'))return u;if(u.startsWith('//')){var up=_getUpstreamBase();var proto=up?new URL(up).protocol:'https:';u=proto+u;}var base=_getUpstreamBase()||location.href;var a=new URL(u,base).href;if(a.startsWith('http://')||a.startsWith('https://'))return P+encodeURIComponent(a);}catch(e){}return u;}
/* XHR — must set arguments[1] explicitly so the browser sees the change */
var _xo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=tp(String(u));}catch(e){}return _xo.apply(this,arguments);};
/* fetch — handle both string URLs and Request objects */
var _fe=window.fetch;window.fetch=function(i,o){try{if(typeof i==='string'){i=tp(i);}else if(i&&typeof i==='object'&&i.url){var _nu=tp(String(i.url));if(_nu!==i.url){try{i=new Request(_nu,i);}catch(e){}}}}catch(e){}return _fe.call(this,i,o);};
/* navigator.sendBeacon — rewrite URL so analytics calls go through the proxy */
if(navigator.sendBeacon){var _sb=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){try{u=tp(String(u));}catch(e){}return _sb(u,d);};}
/* Element.prototype.setAttribute — catches setAttribute('src','...') which bypasses prototype setters */
(function(){var _sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){try{var ln=(n||'').toLowerCase();if(typeof v==='string'&&(ln==='src'||ln==='href'||ln==='action'||ln==='data'||ln==='srcset')){if(ln==='srcset'){v=v.split(',').map(function(part){var s=part.trim().split(/\s+/);if(s[0])s[0]=tp(s[0]);return s.join(' ');}).join(', ');}else{v=tp(v);}}}catch(e){}return _sa.call(this,n,v);};})();
/* Anchor clicks — resolve against upstream base so relative paths go to the real site */
document.addEventListener('click',function(e){var a=e.target.closest('a[href]');if(!a)return;var h=a.getAttribute('href');if(!h||h.startsWith('#')||h.startsWith('javascript:')||h.startsWith('mailto:')||h.startsWith('tel:'))return;try{var base=_getUpstreamBase()||location.href;if(h.startsWith('//')){h=(new URL(base)).protocol+h;}var ab=new URL(h,base).href;if((ab.startsWith('http://')||ab.startsWith('https://'))&&ab.indexOf(P)===-1){e.preventDefault();location.href=P+encodeURIComponent(ab);}}catch(x){}},true);
/* Form submit — resolve action against upstream base */
document.addEventListener('submit',function(e){var f=e.target;if(!f)return;try{var fbase=_getUpstreamBase()||location.href;var fa=new URL(f.action||'',fbase).href;if(!fa.startsWith('http')||fa.indexOf(P)!==-1)return;e.preventDefault();var m=(f.method||'GET').toUpperCase(),d=new URLSearchParams(new FormData(f)).toString(),sep=fa.indexOf('?')>=0?'&':'?';if(m==='GET'){location.href=P+encodeURIComponent(fa+(d?sep+d:''));}else{location.href=P+encodeURIComponent(fa)+(d?'&_body='+encodeURIComponent(d):'');}}catch(x){}},true);
/* pushState / replaceState — resolve relative URLs against the UPSTREAM origin, not our proxy server.
   Extract the real upstream URL from the current page's ?url= query param so that e.g.
   pushState('/about') on a proxied duckduckgo.com page becomes /px?url=https://duckduckgo.com/about
   instead of navigating to our server's /about route (which causes SPA double-render). */
['pushState','replaceState'].forEach(function(fn){var orig=history[fn];history[fn]=function(st,ti,url){if(url!=null){try{var s=String(url);if(!s||s.startsWith('#')||s.startsWith(P))return orig.call(this,st,ti,url);/* Use location.search first, then fall back to server-embedded _ubCache — never use location.href as that points to our proxy domain */var qm=location.search.match(/[?&]url=([^&]+)/);var base=qm?decodeURIComponent(qm[1]):_ubCache;if(base){_ubCache=base;var abs=new URL(s,base).href;if(abs.startsWith('http://')||abs.startsWith('https://'))url=P+encodeURIComponent(abs);}}catch(e){}}return orig.call(this,st,ti,url);};});
/* window.open */
var _wo=window.open;window.open=function(u,n,f){if(typeof u==='string')u=tp(u);return _wo.call(this,u,n,f);};
/* location.assign / replace */
try{var _la=Location.prototype.assign;Location.prototype.assign=function(u){return _la.call(this,tp(String(u)));};var _lr=Location.prototype.replace;Location.prototype.replace=function(u){return _lr.call(this,tp(String(u)));};}catch(e){}
/* Intercept HTMLImageElement / HTMLSourceElement / HTMLVideoElement src/poster setters
   so dynamically-set image URLs (like YouTube thumbnails) get proxied too */
(function(){
  var tags=[['HTMLImageElement','src'],['HTMLImageElement','srcset'],['HTMLVideoElement','src'],['HTMLVideoElement','poster'],['HTMLSourceElement','src'],['HTMLSourceElement','srcset'],['HTMLScriptElement','src'],['HTMLLinkElement','href'],['HTMLIFrameElement','src']];
  tags.forEach(function(t){
    var proto=window[t[0]]&&window[t[0]].prototype;
    if(!proto)return;
    var d=Object.getOwnPropertyDescriptor(proto,t[1]);
    if(!d||!d.set)return;
    Object.defineProperty(proto,t[1],{get:d.get,set:function(v){
      try{v=tp(String(v));}catch(e){}
      return d.set.call(this,v);
    },configurable:true,enumerable:d.enumerable});
  });
  /* Also intercept CSS backgroundImage / background */
  var _ss=CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty=function(p,v,pri){
    if(typeof v==='string'&&(p==='background-image'||p==='background')&&v.indexOf('url(')!==-1){
      v=v.replace(/url\\(['"]?(https?:\\/\\/[^'")\\s]+)['"]?\\)/g,function(m,u){return 'url('+tp(u)+')';});
    }
    return _ss.call(this,p,v,pri);
  };
})();
/* Block service workers — they hijack fetch and break the proxy */
try{Object.defineProperty(navigator,'serviceWorker',{get:function(){return{register:function(){return Promise.resolve({scope:'/'});},getRegistrations:function(){return Promise.resolve([]);},addEventListener:function(){}};},configurable:true});}catch(e){}
/* Spoof navigator.getInstalledRelatedApps — only works in top-level context; throws inside iframes */
try{if(typeof navigator.getInstalledRelatedApps==='undefined'||true){Object.defineProperty(navigator,'getInstalledRelatedApps',{value:function(){return Promise.resolve([]);},configurable:true,writable:true});}}catch(e){}
/* Suppress noisy console errors from WebSocket/WebRTC that can't be proxied */
try{var _cErr=console.error.bind(console);console.error=function(){try{var a=arguments[0];if(typeof a==='string'&&(a.indexOf('ERR_ALPN')!==-1||a.indexOf('wss://')!==-1||a.indexOf('getInstalledRelatedApps')!==-1||a.indexOf('FedCM')!==-1))return;}catch(e){}return _cErr.apply(console,arguments);};}catch(e){}
})();</script>`;

  // Remove <base> tags
  html = html.replace(/<base\s[^>]*>/gi, '');

  // Strip CSP & X-Frame-Options meta tags
  html = html.replace(/<meta[^>]*http-equiv=["'](?:content-security-policy|x-frame-options)["'][^>]*>/gi, '');
  // Strip anything that looks like a CSP-only meta
  html = html.replace(/<meta[^>]*http-equiv=["']content-security-policy-report-only["'][^>]*>/gi, '');

  // Remove integrity attributes (SRI breaks rewriten resources)
  html = html.replace(/\s+integrity=["'][^"']*["']/gi, '');
  // Remove nonce & crossorigin from scripts/links (they break injection)
  html = html.replace(/\s+nonce=["'][^"']*["']/gi, '');

  // Rewrite all resource attributes
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
      // Protocol-relative URLs → treat as https
      if (url.startsWith('//')) {
        const abs = 'https:' + url;
        if (rx.toString().includes('srcset')) return m.replace(url, toProxyUrl(abs, base));
        return m.slice(0, m.indexOf(url)) + toProxyUrl(abs, base) + q2;
      }
      if (url.startsWith('http://') || url.startsWith('https://')) {
        if (rx.toString().includes('srcset')) {
          return m.replace(url, toProxyUrl(url, base));
        }
        return m.slice(0, m.indexOf(url)) + toProxyUrl(url, base) + q2;
      }
      // Relative URLs — resolve against base and proxy
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

  // Rewrite style="background: url(...)"
  html = html.replace(/(<[^>]+\sstyle="[^"]*url\()(['"]?)(https?:\/\/[^'")\s]+)\2(\))/gi, (m, pre, q, url, post) => pre + q + toProxyUrl(url, base) + q + post);

  // Rewrite srcset separately
  html = html.replace(/(<(?:img|source)\b[^>]*?\ssrcset=)(['"])([^'"]*)(\2)/gi, (m, pre, q1, srcset, q2) => {
    return pre + q1 + srcset.replace(/(https?:\/\/[^\s,]+)/g, (u) => toProxyUrl(u, base)) + q2;
  });

  // Inject proxy script
  if (/<head[\s>]/i.test(html)) html = html.replace(/(<head[\s>][^>]*>)/i, '$1' + injectScript);
  else html = injectScript + html;

  return html;
}

// ── CSS rewriting ────────────────────────────────────────────
function rewriteCss(css, base) {
  return css.replace(/url\((['"]?)([^'")\s]+)\1\)/gi, (m, q, url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return m;
    if (url.startsWith('//')) url = 'https:' + url;
    return 'url(' + q + toProxyUrl(url, base) + q + ')';
  });
}

// ── JS rewriting — disabled: static string replacement breaks SPAs ──
// The injected XHR/fetch interceptors handle runtime URL rewriting instead.
function rewriteJs(js, base) {
  return js;
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
  if (/\.(xml)($|\?)/.test(p)) return 'document';
  return 'document';
}

// ── Per-resource headers matching real browser behavior ──────
const RESOURCE_HEADERS = {
  document: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7', 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1', 'Upgrade-Insecure-Requests': '1' },
  image: { 'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8', 'Sec-Fetch-Dest': 'image', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  script: { 'Accept': '*/*', 'Sec-Fetch-Dest': 'script', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  style: { 'Accept': 'text/css,*/*;q=0.1', 'Sec-Fetch-Dest': 'style', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  font: { 'Accept': '*/*', 'Sec-Fetch-Dest': 'font', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'cross-site' },
  media: { 'Accept': '*/*', 'Sec-Fetch-Dest': 'video', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site' },
  fetch: { 'Accept': 'application/json,text/plain,*/*', 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin' },
};

function buildUpstreamHeaders(clientReq, targetUrl, isRetry) {
  // For YouTube, always use a stable desktop Chrome UA so the page renders properly
  const isYouTube = targetUrl.hostname.includes('youtube.com') || targetUrl.hostname.includes('youtu.be') || targetUrl.hostname.includes('ytimg.com') || targetUrl.hostname.includes('googlevideo.com') || targetUrl.hostname.includes('yt3.ggpht.com');
  const isDDG = targetUrl.hostname.includes('duckduckgo.com') || targetUrl.hostname.includes('ddg.gg');

  const ua = isYouTube
    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    : pickUA();

  const resourceType = detectResourceType(targetUrl.pathname + targetUrl.search);
  const rh = RESOURCE_HEADERS[resourceType] || RESOURCE_HEADERS.document;
  const isChrome = ua.includes('Chrome/') || ua.includes('Edg/') || ua.includes('OPR/');
  const isMobile = ua.includes('Mobile');
  const domain = getDomain(targetUrl.href);

  const secChUa = isChrome
    ? (isMobile
      ? '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"'
      : '"Chromium";v="125", "Google Chrome";v="125", "Not-A.Brand";v="99"')
    : undefined;

  const headers = {
    'User-Agent': ua,
    'Accept': rh['Accept'],
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'DNT': '1',
    'Referer': targetUrl.origin + '/',
    'Origin': targetUrl.origin,
    'Connection': 'keep-alive',
    'sec-ch-ua': secChUa,
    'sec-ch-ua-mobile': isMobile ? '?1' : '?0',
    'sec-ch-ua-platform': ua.includes('Windows') ? '"Windows"' : ua.includes('Mac') ? '"macOS"' : ua.includes('Linux') && !isMobile ? '"Linux"' : ua.includes('Android') ? '"Android"' : '"iOS"',
    ...rh,
  };

  // YouTube-specific: add client identity headers + consent cookie bypass
  if (isYouTube) {
    headers['x-origin'] = 'https://www.youtube.com';
    headers['Referer'] = 'https://www.youtube.com/';
    headers['Origin'] = 'https://www.youtube.com';
    headers['Sec-Fetch-Site'] = 'same-origin';
    headers['Upgrade-Insecure-Requests'] = '1';
    // Only add internal client headers for YouTube API endpoints, NOT the main HTML page.
    // Claiming to be the web client on the HTML page while lacking real session cookies
    // triggers YouTube's bot detection and causes 400 errors.
    const isYtApi = /\/(youtubei|generate_204|log_event|stats|api\/)/.test(targetUrl.pathname);
    if (isYtApi) {
      headers['x-youtube-client-name'] = '1';
      headers['x-youtube-client-version'] = '2.20240501.01.00';
      headers['Sec-Fetch-Mode'] = 'cors';
      headers['Sec-Fetch-Dest'] = 'empty';
    } else {
      headers['Sec-Fetch-Mode'] = resourceType === 'document' ? 'navigate' : 'no-cors';
      headers['Sec-Fetch-Dest'] = resourceType === 'document' ? 'document' : (resourceType === 'script' ? 'script' : 'empty');
    }
  }

  // DuckDuckGo: send proper search engine headers
  if (isDDG) {
    headers['Referer'] = 'https://duckduckgo.com/';
    headers['Origin'] = 'https://duckduckgo.com';
    headers['Sec-Fetch-Site'] = 'same-origin';
    headers['Sec-Fetch-Mode'] = 'navigate';
  }

  // Cookie handling: jar cookies take priority; client cookies as fallback (never for YouTube)
  const jarCookies = getCookies(domain);
  if (isYouTube) {
    // Only use real consent cookies — do NOT send fake per-session cookies like
    // VISITOR_INFO1_LIVE or YSC. Fake session cookies make YouTube's bot detection worse.
    const ytConsent = 'SOCS=CAISNQgDEhJnd3NfMjAyNDExMjMtMF9SQzEaC2VuLVVTLGVuO3VzIiAyMDI0MTEyMy0wX1JDMVgB; CONSENT=PENDING+987';
    headers['Cookie'] = jarCookies ? jarCookies + '; ' + ytConsent : ytConsent;
  } else {
    if (jarCookies) headers['Cookie'] = jarCookies;
    else if (clientReq.headers['cookie']) headers['Cookie'] = clientReq.headers['cookie'];
  }

  if (clientReq.headers['content-type']) headers['Content-Type'] = clientReq.headers['content-type'];

  // Forward client-sent auth/API headers (YouTube sends these from its own JS)
  const passthroughHeaders = ['authorization', 'x-goog-authuser', 'x-goog-visitor-id', 'x-goog-fieldmask',
    'x-youtube-client-name', 'x-youtube-client-version', 'x-youtube-page-cl',
    'x-youtube-page-label', 'x-youtube-utc-offset', 'x-youtube-time-zone',
    'x-origin', 'x-requested-with'];
  for (const h of passthroughHeaders) {
    if (clientReq.headers[h] && !headers[h]) headers[h] = clientReq.headers[h];
  }

  // Clean up undefined values
  for (const k of Object.keys(headers)) if (headers[k] === undefined) delete headers[k];

  return headers;
}

// ── Response body decompression ──────────────────────────────
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

// ── PROXY ENDPOINT ───────────────────────────────────────────
app.all('/px', async (req, res) => {
  let rawUrl = req.query.url;
  if (!rawUrl) return res.status(400).send('Missing url parameter');
  if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;
  let targetUrl;
  try { targetUrl = new URL(rawUrl); } catch { return res.status(400).send('Invalid URL'); }

  const domain = getDomain(targetUrl.href);
  const resourceType = detectResourceType(targetUrl.pathname + targetUrl.search);
  const cacheKey = targetUrl.href;
  const isCacheable = resourceType !== 'document' && resourceType !== 'fetch';

  // Check cache for non-HTML resources
  if (isCacheable) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached);
    }
  }

  const maxRetries = resourceType === 'document' ? 1 : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt)); // backoff

      const upstreamHeaders = buildUpstreamHeaders(req, targetUrl, attempt > 0);
      const timeout = resourceType === 'document' ? randInt(25000, 40000) : randInt(15000, 30000);

      const fetchOptions = {
        method: req.method === 'GET' || req.method === 'HEAD' ? req.method : 'GET',
        headers: upstreamHeaders,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout),
      };

      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        fetchOptions.method = req.method;
        const bodyChunks = [];
        for await (const chunk of req) bodyChunks.push(chunk);
        if (bodyChunks.length > 0) fetchOptions.body = Buffer.concat(bodyChunks);
      }

      const response = await fetch(targetUrl.href, fetchOptions);
      const finalUrl = new URL(response.url || rawUrl);

      // Store cookies from response
      const rawSetCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      setCookies(domain, rawSetCookies.length ? rawSetCookies : (response.headers.raw ? response.headers.raw()['set-cookie'] : []));

      // Build response headers
      const respHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS', 'Access-Control-Allow-Headers': '*' };

      response.headers.forEach((value, name) => {
        const lower = name.toLowerCase();
        if (STRIP_RES_HEADERS.has(lower)) return;
        if (lower === 'set-cookie' || lower === 'location') return;
        respHeaders[name] = value;
      });

      for (const [k, v] of Object.entries(respHeaders)) {
        try { res.setHeader(k, v); } catch {}
      }

      // Redirects — rewrite location
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          const abs = new URL(location, finalUrl).href;
          res.setHeader('Location', '/px?url=' + encodeURIComponent(abs));
          return res.status(response.status).end();
        }
      }

      const ct = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

      // For 4xx/5xx — never forward these status codes to the browser.
      // A 4xx iframe src causes the browser to show nothing (white/black screen).
      if (response.status >= 400) {
        const msgs = {
          400: 'The site rejected this request. It may require login or actively blocks proxies.',
          401: 'This page requires you to be logged in.',
          403: 'This site is blocking proxy access.',
          404: 'Page not found on the remote site.',
          429: 'Too many requests — the site is rate-limiting. Please wait a moment.',
          500: 'The site returned an internal server error.',
          502: 'Bad gateway from the remote site.',
          503: 'The site is temporarily unavailable.',
        };
        const msg = msgs[response.status] || `The site returned error ${response.status}.`;
        // If the target returned substantial HTML (real error page), rewrite + serve it
        if (ct === 'text/html' || ct === 'application/xhtml+xml') {
          const html = await response.text();
          if (html.length > 2000) {
            res.removeHeader('content-length'); res.removeHeader('content-encoding');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(rewriteHtml(html, finalUrl, domain));
          }
        }
        // Short / non-HTML — show our styled error page
        res.removeHeader('content-length'); res.removeHeader('content-encoding');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const safe = rawUrl.replace(/</g,'&lt;').replace(/"/g,'&quot;');
        return res.status(200).send(`<!DOCTYPE html><html><head><title>Cannot Load Page</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#0d0e14;color:#e8e9f0;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:14px;padding:24px;text-align:center}.icon{font-size:38px}.lbl{color:#f59e0b;font-size:20px;font-weight:700}p{color:#888;font-size:14px;max-width:460px;line-height:1.6}.url{color:#aaa;font-size:11px;word-break:break-all;max-width:460px;background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)}.tip{font-size:12px;color:#4a9eff;max-width:460px;background:rgba(74,158,255,0.07);padding:10px 16px;border-radius:8px;border:1px solid rgba(74,158,255,0.15)}.btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(255,255,255,0.7);text-decoration:none;font-size:13px}.btn:hover{background:rgba(255,255,255,0.12);color:#fff}.btn.red{background:rgba(229,57,53,0.12);border-color:rgba(229,57,53,0.3);color:#ef5350}</style>
</head><body>
<div class="icon">&#9888;&#65039;</div>
<div class="lbl">Error ${response.status} &mdash; Cannot Load Page</div>
<p>${msg}</p>
<div class="url">${safe}</div>
<div class="tip">&#128161; Try opening directly in a new tab, or retry — sometimes sites temporarily block proxies.</div>
<div class="btns">
  <a class="btn" href="javascript:history.back()">&#8592; Go Back</a>
  <a class="btn red" href="${safe}" target="_blank" rel="noopener">Open Directly &#8599;</a>
  <a class="btn" href="/px?url=${encodeURIComponent(rawUrl)}">&#8635; Retry</a>
</div>
</body></html>`);
      }

      res.status(response.status);

      // HTML — rewrite and inject proxy (use text() — Node fetch auto-decompresses)
      if (ct === 'text/html' || ct === 'application/xhtml+xml') {
        let html = await response.text();
        html = rewriteHtml(html, finalUrl, domain);
        res.removeHeader('content-length');
        res.removeHeader('content-encoding');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      }

      // CSS — rewrite URLs
      if (ct === 'text/css') {
        let css = await response.text();
        css = rewriteCss(css, finalUrl);
        res.removeHeader('content-length');
        res.removeHeader('content-encoding');
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
        return res.send(css);
      }

      // JSON — pass through as-is; rewriting URLs inside JSON breaks YouTube/API responses
      // Runtime XHR/fetch interceptors handle re-routing any navigations that follow.
      if (ct === 'application/json') {
        const buf = Buffer.from(await response.arrayBuffer());
        res.removeHeader('content-length');
        res.removeHeader('content-encoding');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.send(buf);
      }

      // JavaScript — light rewrite
      if (ct === 'application/javascript' || ct === 'text/javascript' || ct === 'application/x-javascript') {
        let js = await response.text();
        js = rewriteJs(js, finalUrl);
        res.removeHeader('content-length');
        res.removeHeader('content-encoding');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        return res.send(js);
      }

      // Binary / other
      res.removeHeader('content-length');
      res.removeHeader('content-encoding');
      const buf = Buffer.from(await response.arrayBuffer());

      // Cache cacheable resources
      if (isCacheable && buf.length < 500000) cacheSet(cacheKey, buf, resourceType);

      return res.send(buf);

    } catch (err) {
      if (attempt < maxRetries) continue;
      const isTimeout = err.name === 'TimeoutError' || (err.message || '').includes('timeout');
      res.status(502).send(
        `<!DOCTYPE html><html><head><title>Proxy Error</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d0e14;color:#e8e9f0;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;padding:24px}
h2{color:#e53935;font-size:22px}p{color:#888;font-size:14px;max-width:480px;text-align:center;line-height:1.6}
.url{color:#aaa;font-size:12px;word-break:break-all;max-width:480px;background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)}
a{color:#58a6ff;font-size:14px;text-decoration:none}a:hover{text-decoration:underline}
.btn{display:inline-block;margin-top:8px;padding:8px 20px;border-radius:8px;background:#21262d;color:#c9d1d9;border:1px solid #30363d;cursor:pointer;font-size:13px;text-decoration:none}
.btn:hover{background:#30363d}
</style></head><body>
<h2>${isTimeout ? 'Request Timed Out' : 'Could not load page'}</h2>
<p>${isTimeout ? 'The request took too long. The site may be slow or blocking proxies.' : 'This site could not be loaded through the proxy.'}</p>
<div class="url">${rawUrl.replace(/</g,'&lt;')}</div>
<p style="font-size:12px;color:#555">${(err.message || '').replace(/</g,'&lt;')}</p>
<a class="btn" href="javascript:history.back()">Go back</a>
<a class="btn" href="/px?url=${encodeURIComponent(rawUrl)}" style="margin-left:8px">Retry</a>
</body></html>`
      );
    }
  }
});

// ── Search suggestions ───────────────────────────────────────
app.get('/suggestions', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const r = await fetch('https://duckduckgo.com/ac/?q=' + encodeURIComponent(q) + '&type=list', {
      headers: { 'User-Agent': pickUA(), 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return res.json([]);
    const data = await r.json();
    let suggestions = [];
    if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[1])) suggestions = data[1];
    else if (Array.isArray(data)) suggestions = data.map(d => (typeof d === 'string' ? d : d.phrase)).filter(Boolean);
    res.json(suggestions.slice(0, 8));
  } catch { res.json([]); }
});

app.options('/px', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.sendStatus(204);
});

// ── Static files ──────────────────────────────────────────────
app.use(express.static(SITE_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('inject.js')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}));

app.get('/blackmarket', (req, res) => res.sendFile(path.join(SITE_DIR, 'blackmarket.html')));
app.get('/proxy', (req, res) => res.sendFile(path.join(SITE_DIR, 'proxy.html')));
app.get('/proxy1', (req, res) => res.sendFile(path.join(SITE_DIR, 'proxy1.html')));
app.get('/proxy2', (req, res) => res.sendFile(path.join(SITE_DIR, 'proxy2.html')));

app.get('*', (req, res) => res.sendFile(path.join(SITE_DIR, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FasahatHub running on http://0.0.0.0:${PORT}`);
});
