const { URL } = require('url');
const zlib = require('zlib');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

const STRIP_RES_HEADERS = new Set([
  'x-frame-options', 'content-security-policy', 'content-security-policy-report-only',
  'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy',
  'permissions-policy', 'feature-policy', 'x-content-type-options',
  'transfer-encoding', 'connection', 'keep-alive', 'strict-transport-security',
  'expect-ct', 'report-to', 'nel', 'vary', 'content-length', 'content-encoding',
]);

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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
  var _base = '${base.origin}';
  function toProxy(u, rel) {
    try {
      var abs = new URL(u, rel || location.href).href;
      if (abs.startsWith('http')) return '/px?url=' + encodeURIComponent(abs);
    } catch(e) {}
    return u;
  }
  var _XHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) {
    try { arguments[1] = toProxy(String(u)); } catch(e) {}
    return _XHR.apply(this, arguments);
  };
  var _fetch = window.fetch;
  window.fetch = function(u, o) {
    try {
      if (typeof u === 'string') u = toProxy(u);
      else if (u && u.url) u = new Request(toProxy(u.url), u);
    } catch(e) {}
    return _fetch.call(window, u, o);
  };
  var _WS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    try {
      var wsUrl = String(url).replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
      url = '/px?url=' + encodeURIComponent(wsUrl);
      url = url.replace('http:', 'ws:').replace('https:', 'wss:');
    } catch(e) {}
    return new _WS(url, protocols);
  };
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
  ['pushState','replaceState'].forEach(function(fn) {
    var orig = history[fn];
    history[fn] = function(state, title, url) {
      if (url) {
        try {
          var abs = new URL(url, location.href).href;
          if (abs.startsWith('http')) url = '/px?url=' + encodeURIComponent(abs);
        } catch(e) {}
      }
      return orig.call(this, state, title, url);
    };
  });
  var _open = window.open;
  window.open = function(url, target, features) {
    if (url && typeof url === 'string' && url.startsWith('http')) {
      url = '/px?url=' + encodeURIComponent(url);
    }
    return _open.call(window, url, target, features);
  };
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
  // Rewrite dynamically set src/href on elements
  var _origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    try {
      var n = name.toLowerCase();
      if ((n === 'src' || n === 'href' || n === 'action') && typeof value === 'string' && value.startsWith('http')) {
        value = '/px?url=' + encodeURIComponent(new URL(value, location.href).href);
      }
    } catch(e) {}
    return _origSetAttr.call(this, name, value);
  };
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

  let targetUrl;
  try { targetUrl = new URL(rawUrl); } catch (e) {
    return { statusCode: 400, body: 'Invalid URL' };
  }

  const { signal, clear } = withTimeout(12000);

  try {
    const ua = pickUA();
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
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
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
    const finalUrl = new URL(response.url || rawUrl);

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

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const abs = new URL(location, finalUrl).href;
        return {
          statusCode: response.status,
          headers: { ...respHeaders, 'Location': '/px?url=' + encodeURIComponent(abs) },
          body: '',
        };
      }
    }

    // For 4xx/5xx responses from the proxied site, show a helpful error page instead
    if (response.status >= 400) {
      const ct = (response.headers.get('content-type') || '').toLowerCase();
      // If it's HTML, still try to serve it (some 4xx pages are useful)
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        const statusText = {
          400: 'Bad Request — The site rejected this request. It may require login or block proxies.',
          401: 'Unauthorized — This page requires you to be logged in.',
          403: 'Forbidden — This site is blocking proxy access.',
          404: 'Not Found — The page does not exist.',
          429: 'Rate Limited — Too many requests. Try again in a moment.',
          451: 'Unavailable for Legal Reasons.',
        };
        const msg = statusText[response.status] || `The site returned error ${response.status}.`;
        return {
          statusCode: 200,
          headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' },
          body: `<!DOCTYPE html><html><head><title>Site Error ${response.status}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d0e14;color:#e8e9f0;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;padding:24px}
h2{color:#f59e0b;font-size:22px}p{color:#888;font-size:14px;max-width:480px;text-align:center;line-height:1.6}
.url{color:#aaa;font-size:12px;word-break:break-all;max-width:480px;background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)}
a{color:#58a6ff;font-size:14px;text-decoration:none}a:hover{text-decoration:underline}
.tip{font-size:12px;color:#555;max-width:480px;text-align:center;line-height:1.6;background:#0d1117;padding:10px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.05)}
</style></head><body>
<h2>&#9888; ${response.status} — Cannot Load Page</h2>
<p>${msg}</p>
<div class="url">${rawUrl}</div>
<div class="tip">&#128161; Try: searching on Google instead, or open the site directly in a new tab if you have access.</div>
<a href="javascript:history.back()">&#8592; Go back</a>
</body></html>`,
        };
      }
    }

    const setCookies = rewriteSetCookie(response.headers);
    if (setCookies.length > 0) {
      respHeaders['Set-Cookie'] = setCookies.join(', ');
    }

    const ct = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

    if (ct === 'text/html' || ct === 'application/xhtml+xml') {
      const body = await decodeBody(response);
      let html = body.toString('utf8');
      html = rewriteHtml(html, finalUrl);
      return {
        statusCode: response.status,
        headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        body: html,
      };
    }

    if (ct === 'text/css') {
      const body = await decodeBody(response);
      let css = body.toString('utf8');
      css = rewriteCss(css, finalUrl);
      return {
        statusCode: response.status,
        headers: { ...respHeaders, 'Content-Type': 'text/css; charset=utf-8' },
        body: css,
      };
    }

    if (ct === 'application/javascript' || ct === 'text/javascript' || ct === 'application/x-javascript') {
      const body = await decodeBody(response);
      return {
        statusCode: response.status,
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
        statusCode: response.status,
        headers: { ...respHeaders, 'Content-Type': 'application/json' },
        body: json,
      };
    }

    const buf = await decodeBody(response);
    const rawCt = response.headers.get('content-type') || 'application/octet-stream';
    return {
      statusCode: response.status,
      headers: { ...respHeaders, 'Content-Type': rawCt },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };

  } catch (err) {
    clear();
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError' || (err.message || '').includes('timeout');
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html><html><head><title>Proxy Error</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d0e14;color:#e8e9f0;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;padding:24px}
h2{color:#e53935;font-size:22px}p{color:#888;font-size:14px;max-width:480px;text-align:center;line-height:1.6}
.url{color:#aaa;font-size:12px;word-break:break-all;max-width:480px;background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)}
a{color:#58a6ff;font-size:14px;text-decoration:none}a:hover{text-decoration:underline}
</style></head><body>
<h2>${isTimeout ? '&#8987; Request Timed Out' : '&#9888; Could not load page'}</h2>
<p>${isTimeout ? 'The request took too long. The site may be slow or blocking proxies.' : 'This site could not be loaded through the proxy. It may block server-side requests or require special handling.'}</p>
<div class="url">${rawUrl}</div>
<p style="font-size:12px">Error: ${(err.message || '').replace(/</g,'&lt;')}</p>
<a href="javascript:history.back()">&#8592; Go back</a>
</body></html>`,
    };
  }
};
