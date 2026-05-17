const { URL } = require('url');
const zlib = require('zlib');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // Mobile UA — better for some sites
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
];

const STRIP_RES_HEADERS = new Set([
  'x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
  'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy',
  'permissions-policy', 'feature-policy', 'x-content-type-options',
  'transfer-encoding', 'connection', 'keep-alive', 'strict-transport-security',
  'expect-ct', 'report-to', 'nel', 'vary', 'content-length', 'content-encoding',
]);

// Sites that block server proxies — redirect to their simpler/mobile/embed equivalent
const SITE_OVERRIDES = {
  'youtube.com':   (u) => rewriteYouTube(u),
  'youtu.be':      (u) => rewriteYouTubeShort(u),
  'instagram.com': (u) => 'https://www.picuki.com/profile/' + extractInstagramUser(u),
  'twitter.com':   (u) => u.replace('twitter.com', 'nitter.privacydev.net'),
  'x.com':         (u) => u.replace('x.com', 'nitter.privacydev.net'),
  'reddit.com':    (u) => u.replace(/^https?:\/\/(www\.)?reddit\.com/, 'https://old.reddit.com'),
  'www.reddit.com':(u) => u.replace(/^https?:\/\/(www\.)?reddit\.com/, 'https://old.reddit.com'),
};

function rewriteYouTube(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const v = u.searchParams.get('v');
    // Single video → use embed (works through proxy)
    if (v) return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
    // Search → use Invidious-style search page
    const q = u.searchParams.get('search_query') || u.searchParams.get('q');
    if (q) return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    // Homepage → use YouTube TV (simpler SPA)
    return 'https://www.youtube.com/tv';
  } catch(e) { return rawUrl; }
}

function rewriteYouTubeShort(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const id = u.pathname.replace('/', '').split('/')[0];
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  } catch(e) {}
  return rawUrl;
}

function extractInstagramUser(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || '';
  } catch(e) { return ''; }
}

function preprocessUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const override = SITE_OVERRIDES[host] || SITE_OVERRIDES[u.hostname.toLowerCase()];
    if (override) {
      const result = override(rawUrl);
      if (result && result !== rawUrl) return result;
    }
  } catch(e) {}
  return rawUrl;
}

function pickUA(url) {
  // Use mobile UA for sites that serve lighter pages to mobile
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('youtube') || host.includes('google') || host.includes('instagram')) {
      return USER_AGENTS[4]; // mobile
    }
  } catch(e) {}
  return USER_AGENTS[Math.floor(Math.random() * (USER_AGENTS.length - 1))];
}

function toProxyUrl(url, base) {
  try {
    const abs = new URL(url, base).href;
    if (abs.startsWith('http://') || abs.startsWith('https://')) {
      return '/px?url=' + encodeURIComponent(abs);
    }
  } catch (e) {}
  return url;
}

function rewriteHtml(html, base) {
  const injectScript = `<script>
(function(){
  function toProxy(u, rel) {
    try {
      var abs = new URL(u, rel || location.href).href;
      if (abs.startsWith('http')) return '/px?url=' + encodeURIComponent(abs);
    } catch(e) {}
    return u;
  }
  // XHR
  var _XHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    try { arguments[1] = toProxy(String(u)); } catch(e) {}
    return _XHR.apply(this, arguments);
  };
  // fetch
  var _fetch = window.fetch;
  window.fetch = function(u, o) {
    try {
      if (typeof u === 'string') u = toProxy(u);
      else if (u && u.url) u = new Request(toProxy(u.url), u);
    } catch(e) {}
    return _fetch.call(window, u, o);
  };
  // WebSocket
  var _WS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    try {
      var wsUrl = String(url).replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      url = '/px?url=' + encodeURIComponent(wsUrl);
      url = url.replace('http:', 'ws:').replace('https:', 'wss:');
    } catch(e) {}
    return new _WS(url, protocols);
  };
  // Link clicks
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]');
    if (a) {
      var h = a.getAttribute('href');
      if (h && !h.startsWith('#') && !h.startsWith('javascript')) {
        try {
          var abs = new URL(h, location.href).href;
          if (abs.startsWith('http')) {
            e.preventDefault();
            e.stopPropagation();
            location.href = '/px?url=' + encodeURIComponent(abs);
          }
        } catch(e2) {}
      }
    }
  }, true);
  // Form submit
  document.addEventListener('submit', function(e) {
    var f = e.target;
    if (f && f.action && f.action.startsWith('http')) {
      e.preventDefault();
      var data = new URLSearchParams(new FormData(f)).toString();
      var sep = f.action.includes('?') ? '&' : '?';
      var target = (f.method && f.method.toUpperCase() === 'POST')
        ? f.action : f.action + (data ? sep + data : '');
      location.href = '/px?url=' + encodeURIComponent(target);
    }
  }, true);
  // History API
  ['pushState','replaceState'].forEach(function(fn) {
    var orig = history[fn];
    history[fn] = function(state, title, url) {
      if (url) {
        try {
          var abs = new URL(String(url), location.href).href;
          if (abs.startsWith('http')) url = '/px?url=' + encodeURIComponent(abs);
        } catch(e) {}
      }
      return orig.call(this, state, title, url);
    };
  });
  // window.open
  var _open = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      url = '/px?url=' + encodeURIComponent(url);
    }
    return _open.call(window, url, target, features);
  };
  // location.assign / replace
  var _assign = Location.prototype.assign;
  Location.prototype.assign = function(url) {
    try {
      var abs = new URL(url, location.href).href;
      if (abs.startsWith('http')) return _assign.call(location, '/px?url=' + encodeURIComponent(abs));
    } catch(e) {}
    return _assign.call(location, url);
  };
  var _replace = Location.prototype.replace;
  Location.prototype.replace = function(url) {
    try {
      var abs = new URL(url, location.href).href;
      if (abs.startsWith('http')) return _replace.call(location, '/px?url=' + encodeURIComponent(abs));
    } catch(e) {}
    return _replace.call(location, url);
  };
  // Dynamic setAttribute
  var _origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    try {
      var n = name.toLowerCase();
      if ((n === 'src' || n === 'href' || n === 'action') && typeof value === 'string' && /^https?:\/\//.test(value)) {
        value = '/px?url=' + encodeURIComponent(new URL(value, location.href).href);
      }
    } catch(e) {}
    return _origSetAttr.call(this, name, value);
  };
  // image.src assignments
  var _imgSrcDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (_imgSrcDesc && _imgSrcDesc.set) {
    var _origImgSrc = _imgSrcDesc.set;
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      set: function(val) {
        if (typeof val === 'string' && /^https?:\/\//.test(val)) {
          try { val = '/px?url=' + encodeURIComponent(new URL(val, location.href).href); } catch(e) {}
        }
        return _origImgSrc.call(this, val);
      },
      get: _imgSrcDesc.get,
      configurable: true,
    });
  }
})();
</script>`;

  html = html.replace(/<base\s[^>]*>/gi, '');

  const attrRewrites = [
    /(<a\b[^>]*?\shref=)(["'])([^"'#\s][^"']*)(["'])/gi,
    /(<form\b[^>]*?\saction=)(["'])([^"']*)(["'])/gi,
    /(<script\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<link\b[^>]*?\shref=)(["'])([^"']*)(["'])/gi,
    /(<img\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<img\b[^>]*?\sdata-src=)(["'])([^"']*)(["'])/gi,
    /(<img\b[^>]*?\sdata-lazy-src=)(["'])([^"']*)(["'])/gi,
    /(<img\b[^>]*?\sdata-original=)(["'])([^"']*)(["'])/gi,
    /(<source\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<video\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<video\b[^>]*?\sposter=)(["'])([^"']*)(["'])/gi,
    /(<iframe\b[^>]*?\ssrc=)(["'])([^"']*)(["'])/gi,
    /(<meta\b[^>]*?\scontent=)(["'])(https?:\/\/[^"']*)(["'])/gi,
  ];

  for (const rx of attrRewrites) {
    html = html.replace(rx, (m, pre, q1, url, q2) => {
      if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('#')) return m;
      return pre + q1 + toProxyUrl(url, base) + q2;
    });
  }

  html = html.replace(/(<[^>]+\sstyle="[^"]*url\()(['"]?)(https?:\/\/[^'")\s]+)\2(\))/gi, (m, pre, q, url, post) => {
    return pre + q + toProxyUrl(url, base) + q + post;
  });

  html = html.replace(/(<(?:img|source)\b[^>]*?\ssrcset=)(["'])([^"']*)(["'])/gi, (m, pre, q1, srcset, q2) => {
    const rewritten = srcset.replace(/(https?:\/\/[^\s,]+)/g, (u) => toProxyUrl(u, base));
    return pre + q1 + rewritten + q2;
  });

  if (/<head[\s>]/i.test(html)) {
    html = html.replace(/(<head[\s>][^>]*>)/i, '$1' + injectScript);
  } else {
    html = injectScript + html;
  }

  return html;
}

function rewriteCss(css, base) {
  return css.replace(/url\((['"]?)([^'")\s]+)\1\)/gi, (m, q, url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return m;
    return 'url(' + q + toProxyUrl(url, base) + q + ')';
  });
}

async function decodeBody(response) {
  const encoding = (response.headers.get('content-encoding') || '').toLowerCase();
  const buf = Buffer.from(await response.arrayBuffer());
  if (!encoding || encoding === 'identity') return buf;
  return new Promise((resolve) => {
    if (encoding === 'gzip' || encoding === 'x-gzip') {
      zlib.gunzip(buf, (err, r) => resolve(err ? buf : r));
    } else if (encoding === 'deflate') {
      zlib.inflate(buf, (err, r) => {
        if (err) zlib.inflateRaw(buf, (err2, r2) => resolve(err2 ? buf : r2));
        else resolve(r);
      });
    } else if (encoding === 'br') {
      zlib.brotliDecompress(buf, (err, r) => resolve(err ? buf : r));
    } else {
      resolve(buf);
    }
  });
}

function rewriteSetCookie(headers) {
  const cookies = headers.getSetCookie ? headers.getSetCookie() : [];
  return cookies.map(c =>
    c.replace(/;\s*domain=[^;]*/gi, '')
     .replace(/;\s*secure/gi, '')
     .replace(/;\s*samesite=[^;]*/gi, '; SameSite=Lax')
  );
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function errorPage(status, rawUrl, msg, tip) {
  return `<!DOCTYPE html><html><head><title>Cannot Load Page</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d0e14;color:#e8e9f0;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px;padding:24px;text-align:center}
.icon{font-size:40px}
h2{color:#f59e0b;font-size:20px;font-weight:700}
p{color:#888;font-size:14px;max-width:460px;line-height:1.6}
.url{color:#aaa;font-size:11px;word-break:break-all;max-width:460px;background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);margin:4px 0}
.tip{font-size:12px;color:#4a9eff;max-width:460px;line-height:1.6;background:rgba(74,158,255,0.07);padding:10px 16px;border-radius:8px;border:1px solid rgba(74,158,255,0.15)}
.btn{display:inline-flex;align-items:center;gap:6px;margin-top:4px;padding:9px 20px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:rgba(255,255,255,0.7);text-decoration:none;font-size:13px;cursor:pointer;transition:all .15s}
.btn:hover{background:rgba(255,255,255,0.12);color:#fff}
.btn.primary{background:rgba(229,57,53,0.15);border-color:rgba(229,57,53,0.35);color:#ef5350}
</style></head><body>
<div class="icon">&#9888;&#65039;</div>
<h2>Error ${status} &mdash; Cannot Load Page</h2>
<p>${msg}</p>
<div class="url">${rawUrl.replace(/</g,'&lt;')}</div>
${tip ? `<div class="tip">&#128161; ${tip}</div>` : ''}
<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px">
  <a class="btn" href="javascript:history.back()">&#8592; Go Back</a>
  <a class="btn primary" href="${rawUrl.replace(/"/g,'&quot;')}" target="_blank" rel="noopener">Open Directly &#8599;</a>
</div>
</body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
      body: '',
    };
  }

  let rawUrl = (event.queryStringParameters || {}).url;
  if (!rawUrl) return { statusCode: 400, body: 'Missing url parameter' };
  if (!/^https?:\/\//i.test(rawUrl)) rawUrl = 'https://' + rawUrl;

  // Preprocess known sites to simpler/mobile alternatives
  const processedUrl = preprocessUrl(rawUrl);

  let targetUrl;
  try { targetUrl = new URL(processedUrl); } catch (e) {
    return { statusCode: 400, body: 'Invalid URL' };
  }

  const { signal, clear } = withTimeout(12000);

  try {
    const ua = pickUA(processedUrl);
    const fetchOptions = {
      method: (event.httpMethod === 'GET' || event.httpMethod === 'HEAD') ? event.httpMethod : 'GET',
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': targetUrl.origin + '/',
        'Origin': targetUrl.origin,
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': ua.includes('Mobile') ? '?1' : '?0',
        'sec-ch-ua-platform': ua.includes('Android') ? '"Android"' : '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
      },
      redirect: 'follow',
      signal,
    };

    if (event.body && (event.httpMethod === 'POST' || event.httpMethod === 'PUT' || event.httpMethod === 'PATCH')) {
      fetchOptions.method = event.httpMethod;
      fetchOptions.body = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : event.body;
    }

    const response = await fetch(targetUrl.href, fetchOptions);
    clear();
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
      try { respHeaders[name] = value; } catch (e) {}
    });

    // Handle redirects manually (pass them through as proxy redirects)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const abs = new URL(location, finalUrl).href;
        return {
          statusCode: 302,
          headers: { ...respHeaders, 'Location': '/px?url=' + encodeURIComponent(abs) },
          body: '',
        };
      }
    }

    // For error responses from the target site, show our error page
    // We ALWAYS return 200 so the browser doesn't show a blank/failed iframe
    if (response.status >= 400) {
      const ct = (response.headers.get('content-type') || '').toLowerCase();
      const statusMessages = {
        400: 'The site rejected this request. It may require you to be logged in, or it actively blocks proxies.',
        401: 'This page requires you to be logged in.',
        403: 'This site is blocking proxy access.',
        404: 'This page was not found.',
        429: 'Too many requests. Please wait a moment and try again.',
        451: 'This content is unavailable in your region.',
      };
      const msg = statusMessages[response.status] || `The site returned error ${response.status}.`;
      const tip = response.status === 400 || response.status === 403
        ? 'Try clicking "Open Directly" to visit the site in a new tab, or try a different URL.'
        : null;

      // If it returned a tiny HTML body (bot-detection page), show our error
      // If it's a real HTML error page, let it through but still as 200
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        return {
          statusCode: 200,
          headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' },
          body: errorPage(response.status, rawUrl, msg, tip),
        };
      }
      // For HTML error pages: read the body and check if it's useful
      const body = await decodeBody(response);
      const html = body.toString('utf8');
      // If the body is very short (< 2kb) it's probably a bot-detection/block page
      if (html.length < 2000) {
        return {
          statusCode: 200,
          headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' },
          body: errorPage(response.status, rawUrl, msg, tip),
        };
      }
      // It's a real error HTML page — rewrite and serve as 200
      return {
        statusCode: 200,
        headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        body: rewriteHtml(html, finalUrl),
      };
    }

    const setCookies = rewriteSetCookie(response.headers);
    if (setCookies.length > 0) {
      respHeaders['Set-Cookie'] = setCookies.join(', ');
    }

    const ct = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

    if (ct === 'text/html' || ct === 'application/xhtml+xml') {
      const body = await decodeBody(response);
      const html = rewriteHtml(body.toString('utf8'), finalUrl);
      return {
        statusCode: 200,
        headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      };
    }

    if (ct === 'text/css') {
      const body = await decodeBody(response);
      return {
        statusCode: 200,
        headers: { ...respHeaders, 'Content-Type': 'text/css; charset=utf-8' },
        body: rewriteCss(body.toString('utf8'), finalUrl),
      };
    }

    if (ct === 'application/javascript' || ct === 'text/javascript' || ct === 'application/x-javascript') {
      const body = await decodeBody(response);
      return {
        statusCode: 200,
        headers: { ...respHeaders, 'Content-Type': 'application/javascript; charset=utf-8' },
        body: body.toString('utf8'),
      };
    }

    if (ct === 'application/json') {
      const body = await decodeBody(response);
      let json = body.toString('utf8');
      json = json.replace(/"(https?:\/\/[^"]+)"/g, (m, url) => {
        try { new URL(url); return '"' + toProxyUrl(url, finalUrl) + '"'; } catch (e) { return m; }
      });
      return {
        statusCode: 200,
        headers: { ...respHeaders, 'Content-Type': 'application/json' },
        body: json,
      };
    }

    const buf = await decodeBody(response);
    const rawCt = response.headers.get('content-type') || 'application/octet-stream';
    return {
      statusCode: 200,
      headers: { ...respHeaders, 'Content-Type': rawCt },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (err) {
    clear();
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError' || (err.message || '').toLowerCase().includes('timeout') || (err.message || '').toLowerCase().includes('aborted');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: errorPage(
        isTimeout ? 504 : 502,
        rawUrl,
        isTimeout
          ? 'The request took too long. The site may be slow or blocking proxy connections.'
          : 'This site could not be loaded through the proxy. It may block server-side requests or require special handling.',
        'Try "Open Directly" to access the site in a new tab instead.'
      ),
    };
  }
};
