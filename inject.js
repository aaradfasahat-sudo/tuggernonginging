// FasahatHub Extensions v1.0
// Adds: Search w/ Filters, Continue Watching, Theme Colors (in Settings),
//       Activity Feed (from DM contacts), Watch History, Profile navigation,
//       Feature Suggestions (Admin)
/* ── Standalone injection (runs BEFORE the main IIFE so even if IIFE fails) ── */
// Removed: moved into inject.js watchdog below (1500ms, safer for React SPA)

(function () {
  'use strict';

  if (window.__fasExtV4Loaded) return;
  window.__fasExtV4Loaded = true;

  /* =========================================================
     UTILITIES
  ========================================================= */
  const K = {
    accent: 'fas_accent_color',
    watching: 'fas_continue_watching',
    history: 'fas_watch_history',
    suggestions: 'fas_my_suggestions',
  };

  function gs(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
  }
  function ss(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  function waitForFB(cb, n = 0) {
    if (window.db && window.fsCollection && window.fsGetDocs) { cb(); }
    else if (n < 40) { setTimeout(() => waitForFB(cb, n + 1), 500); }
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _showToast(msg, bg) {
    try {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:999999;background:${bg||'#333'};color:#fff;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600;font-family:Inter,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.5);max-width:90vw;text-align:center;pointer-events:none;transition:opacity .3s;`;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => { try { el.style.opacity = '0'; setTimeout(() => { try { el.remove(); } catch {} }, 300); } catch {} }, 3000);
    } catch {}
  }

  function _installPostCooldown() {
    try {
      const orig = window.fsAddDoc;
      if (!orig || window.__fas_cooldownInstalled) return;
      window.__fas_cooldownInstalled = true;
      window.fsAddDoc = function(collectionRef, data) {
        try {
          if (collectionRef && (collectionRef.id === 'posts')) {
            const last = parseInt(localStorage.getItem('fas_last_post_time') || '0');
            const now = Date.now();
            if (now - last < 60000 && last > 0) {
              const s = Math.ceil((60000 - (now - last)) / 1000);
              _showToast(`Wait ${s}s before posting again`, '#e53935');
              return Promise.reject(new Error(`Cooldown: ${s}s remaining`));
            }
            try { localStorage.setItem('fas_last_post_time', String(now)); } catch {}
          }
        } catch {}
        return orig.apply(window, arguments);
      };
    } catch {}
  }

  /* =========================================================
     1.  THEME / ACCENT COLOR  (feature 9 – injected into Settings)
  ========================================================= */
  const SWATCHES = [
    { name: 'Crimson',  val: '#ef4444' },
    { name: 'Rose',     val: '#f43f5e' },
    { name: 'Orange',   val: '#f97316' },
    { name: 'Amber',    val: '#f59e0b' },
    { name: 'Emerald',  val: '#10b981' },
    { name: 'Cyan',     val: '#06b6d4' },
    { name: 'Azure',    val: '#3b82f6' },
    { name: 'Indigo',   val: '#6366f1' },
    { name: 'Violet',   val: '#8b5cf6' },
    { name: 'Pink',     val: '#ec4899' },
  ];

  let curAccent = gs(K.accent, '#ef4444');

  function applyAccent(hex) {
    curAccent = hex;
    ss(K.accent, hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    let el = document.getElementById('fas-accent-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'fas-accent-style';
      document.head.appendChild(el);
    }
    el.textContent = `
      :root { --mk-accent-red: ${hex} !important; --fas-accent: ${hex} !important; }
      .bg-\\[var\\(--mk-accent-red\\)\\] { background-color: ${hex} !important; }
      .bg-red-400,.bg-red-500,.bg-red-600 { background-color: ${hex} !important; }
      .text-red-400,.text-red-500,.text-red-600 { color: ${hex} !important; }
      .border-red-400,.border-red-500,.border-red-600 { border-color: ${hex} !important; }
      .hover\\:bg-red-600:hover { background-color: color-mix(in srgb,${hex} 80%,#000) !important; }
      .shadow-red-500\\/20 { box-shadow: 0 4px 20px rgba(${r},${g},${b},0.25) !important; }
      #fas-ext-fab { background: ${hex} !important; }
      #fas-suggestion-submit { background: ${hex} !important; }
    `;
    // Update any open swatches
    document.querySelectorAll('.fas-swatch').forEach(sw => {
      sw.style.outline = sw.dataset.val === hex ? '2px solid white' : '2px solid transparent';
    });
    const hexLabel = document.getElementById('fas-hex-label');
    if (hexLabel) hexLabel.textContent = hex;
    const picker = document.getElementById('fas-custom-picker');
    if (picker) picker.value = hex;
  }

  applyAccent(curAccent);

  // Inject color section into the existing settings modal
  function tryInjectSettings(root) {
    if (!root.querySelectorAll) return;
    const spans = root.querySelectorAll('span, div');
    for (const el of spans) {
      if (el.childElementCount === 0 && el.textContent.trim() === 'Knight Presets') {
        const scrollContainer = el.closest('[class*="overflow-y"]') || el.closest('.p-6');
        if (scrollContainer && !scrollContainer.querySelector('#fas-color-section')) {
          buildColorSection(scrollContainer);
        }
        break;
      }
    }
  }

  function buildColorSection(container) {
    const sec = document.createElement('div');
    sec.id = 'fas-color-section';
    sec.style.cssText = 'margin-top:28px;';
    sec.innerHTML = `
      <div style="font-size:11px;color:var(--mk-eye-glow,#ff6b6b);text-transform:uppercase;margin-bottom:14px;font-weight:700;display:flex;align-items:center;gap:7px;letter-spacing:.06em;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
        Accent Color
      </div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,215,0,.07);border-radius:14px;padding:14px;">
        <div style="font-size:11px;opacity:.55;color:var(--mk-silver,#ccc);margin-bottom:10px;">Choose your accent</div>
        <div id="fas-swatch-row" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
          ${SWATCHES.map(s => `
            <button class="fas-swatch" data-val="${s.val}" title="${s.name}"
              style="width:26px;height:26px;border-radius:50%;background:${s.val};border:none;cursor:pointer;outline:${s.val === curAccent ? '2px solid white' : '2px solid transparent'};outline-offset:2px;transition:transform .15s,outline .15s;"
              onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'">
            </button>`).join('')}
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="color" id="fas-custom-picker" value="${curAccent}"
            style="width:36px;height:30px;border:none;background:none;cursor:pointer;border-radius:6px;padding:0;">
          <span style="font-size:11px;opacity:.6;color:var(--mk-silver,#ccc);">Custom</span>
          <code id="fas-hex-label" style="font-size:11px;color:var(--mk-gold,#f5c518);font-family:monospace;">${curAccent}</code>
        </div>
      </div>`;
    container.appendChild(sec);

    sec.querySelectorAll('.fas-swatch').forEach(btn => {
      btn.addEventListener('click', () => applyAccent(btn.dataset.val));
    });
    sec.querySelector('#fas-custom-picker').addEventListener('input', e => applyAccent(e.target.value));
  }

  /* =========================================================
     2.  CONTENT TRACKING  (Continue Watching + History)
  ========================================================= */
  function recordView(item) {
    const hist = gs(K.history, []);
    const watch = gs(K.watching, []);
    const newH = [item, ...hist.filter(h => h.id !== item.id)].slice(0, 60);
    const newW = [item, ...watch.filter(h => h.id !== item.id)].slice(0, 15);
    ss(K.history, newH);
    ss(K.watching, newW);
  }

  // Detect content type from visible h1 + URL + page context
  function detectType() {
    const h = (document.querySelector('h1')?.textContent || '').toLowerCase();
    const url = location.pathname.toLowerCase();
    const title = document.title.toLowerCase();
    if (h.includes('m0v') || h.includes('movie') || url.includes('movie') || title.includes('movie')) return 'movie';
    if (h.includes('an1m') || h.includes('anim') || url.includes('anime') || title.includes('anime')) return 'anime';
    if (h.includes('show') || h.includes('tv') || url.includes('/tv') || url.includes('/show')) return 'tv';
    if (h.includes('manga') || url.includes('manga')) return 'manga';
    if (h.includes('game') || h.includes('g4m3') || url.includes('game') || url.includes('/play') || title.includes('game')) return 'game';
    return 'content';
  }

  document.addEventListener('click', e => {
    const card = e.target.closest('.rounded-2xl');
    if (!card) return;
    const img = card.querySelector('img[src^="http"]');
    const titleEl = card.querySelector('h3') || card.querySelector('h2');
    if (!img || !titleEl) return;
    const title = titleEl.textContent.trim();
    if (title.length < 2) return;
    recordView({
      id: title.toLowerCase().replace(/\W+/g, '-'),
      title,
      imageUrl: img.src,
      type: detectType(),
      timestamp: Date.now(),
    });
  }, true);

  /* =========================================================
     3.  SEARCH OVERLAY  (feature 1)
  ========================================================= */
  function buildSearchOverlay() {
    const ov = document.createElement('div');
    ov.id = 'fas-search-overlay';
    ov.style.cssText = `position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);backdrop-filter:blur(12px);display:none;flex-direction:column;align-items:center;padding:72px 20px 40px;font-family:Inter,sans-serif;`;
    ov.innerHTML = `
      <div style="width:100%;max-width:680px;">
        <div style="position:relative;margin-bottom:16px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,.7)" stroke-width="2.5" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input id="fas-s-input" type="text" placeholder="Search titles, posts, people…"
            style="width:100%;padding:16px 50px 16px 46px;background:rgba(8,8,18,.97);border:2px solid rgba(255,215,0,.35);border-radius:14px;color:#fff;font-size:15px;outline:none;box-sizing:border-box;font-family:inherit;">
          <kbd style="position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:10px;color:rgba(255,255,255,.3);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:2px 7px;pointer-events:none;">ESC</kbd>
        </div>
        <div id="fas-filters" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
          ${['All','Movies','Anime','TV','Manga','Games','Posts'].map((f,i)=>`
            <button class="fas-fb" data-f="${f.toLowerCase()}"
              style="padding:5px 13px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid ${i===0?'rgba(255,215,0,.5)':'rgba(255,255,255,.12)'};background:${i===0?'rgba(255,215,0,.1)':'transparent'};color:${i===0?'rgba(255,215,0,.9)':'rgba(255,255,255,.45)'};outline:none;transition:all .15s;">${f}</button>`).join('')}
        </div>
        <div id="fas-s-results" style="color:rgba(255,255,255,.35);font-size:13px;text-align:center;padding:36px 0;">Start typing to search…</div>
      </div>`;
    document.body.appendChild(ov);

    let activeFilter = 'all';
    ov.querySelectorAll('.fas-fb').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.f;
        ov.querySelectorAll('.fas-fb').forEach(b => {
          const on = b.dataset.f === activeFilter;
          b.style.borderColor = on ? 'rgba(255,215,0,.5)' : 'rgba(255,255,255,.12)';
          b.style.background = on ? 'rgba(255,215,0,.1)' : 'transparent';
          b.style.color = on ? 'rgba(255,215,0,.9)' : 'rgba(255,255,255,.45)';
        });
        doSearch(ov.querySelector('#fas-s-input').value.trim(), activeFilter);
      });
    });

    const input = ov.querySelector('#fas-s-input');
    let debounce;
    input.addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => doSearch(e.target.value.trim(), activeFilter), 250);
    });

    ov.addEventListener('click', e => { if (e.target === ov) closeSearch(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearch();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openSearch(); }
    });

    function doSearch(q, filter) {
      const res = ov.querySelector('#fas-s-results');
      if (!q || q.length < 2) {
        res.innerHTML = '<div style="text-align:center;padding:36px 0;color:rgba(255,255,255,.3);">Start typing to search…</div>';
        return;
      }
      const ql = q.toLowerCase();
      // Search tracked items first
      const pool = [...new Map([
        ...gs(K.watching, []), ...gs(K.history, [])
      ].map(i => [i.id, i])).values()];

      let hits = pool.filter(item => {
        if (filter !== 'all' && !item.type.startsWith(filter.replace(' ', ''))) return false;
        return item.title.toLowerCase().includes(ql);
      });

      if (hits.length) { renderHits(hits, res, q); return; }

      // Fallback: Firebase posts
      res.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,.3);font-size:12px;">Searching…</div>';
      waitForFB(async () => {
        try {
          const snap = await window.fsGetDocs(window.fsCollection(window.db, 'posts'));
          const results = [];
          snap.forEach(doc => {
            const d = doc.data() || {};
            const content = (d.content || '').toLowerCase();
            const name = (d.authorName || d.author || '').toLowerCase();
            if ((filter === 'all' || filter === 'posts') && (content.includes(ql) || name.includes(ql))) {
              const displayName = d.authorName || d.author || '';
              results.push({ id: doc.id, title: `${displayName}: ${(d.content||'').slice(0,55)}…`, imageUrl: d.authorPhoto||null, type: 'post' });
            }
          });
          renderHits(results, res, q);
        } catch { renderHits([], res, q); }
      });
    }

    function renderHits(hits, el, q) {
      if (!hits.length) {
        el.innerHTML = `<div style="text-align:center;padding:36px 0;color:rgba(255,255,255,.3);"><div style="font-size:28px;margin-bottom:10px;">🔍</div>No results for <strong style="color:rgba(255,255,255,.5);">"${esc(q)}"</strong><div style="font-size:11px;margin-top:6px;opacity:.6;">Browse a hub first to populate your history.</div></div>`;
        return;
      }
      el.innerHTML = `
        <div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:12px;">${hits.length} result${hits.length!==1?'s':''}</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;">
          ${hits.map(item => `
            <div style="border-radius:10px;overflow:hidden;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);">
              ${item.imageUrl
                ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="lazy" style="width:100%;aspect-ratio:2/3;object-fit:cover;">`
                : `<div style="width:100%;aspect-ratio:2/3;background:rgba(255,215,0,.05);display:flex;align-items:center;justify-content:center;font-size:26px;">🎬</div>`}
              <div style="padding:7px;">
                <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,.8);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.3;">${esc(item.title)}</div>
                <div style="font-size:9px;color:rgba(255,215,0,.55);margin-top:3px;text-transform:uppercase;">${esc(item.type)}</div>
              </div>
            </div>`).join('')}
        </div>`;
    }
  }

  function openSearch() {
    const ov = document.getElementById('fas-search-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    setTimeout(() => ov.querySelector('#fas-s-input')?.focus(), 50);
  }
  function closeSearch() {
    const ov = document.getElementById('fas-search-overlay');
    if (!ov) return;
    ov.style.display = 'none';
    const inp = ov.querySelector('#fas-s-input');
    if (inp) inp.value = '';
  }

  /* =========================================================
     4.  EXTENSIONS PANEL  (Continue Watching / History / Activity / Suggest)
  ========================================================= */
  function buildPanel() {
    // FAB button
    const fab = document.createElement('button');
    fab.id = 'fas-ext-fab';
    fab.title = 'Extensions';
    fab.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    fab.style.cssText = `position:fixed;bottom:80px;right:16px;z-index:9990;width:44px;height:44px;border-radius:50%;background:${curAccent};border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 22px rgba(0,0,0,.45);transition:transform .2s;`;
    fab.addEventListener('mouseenter', () => fab.style.transform = 'scale(1.12)');
    fab.addEventListener('mouseleave', () => fab.style.transform = '');

    // Panel
    const panel = document.createElement('div');
    panel.id = 'fas-ext-panel';
    panel.style.cssText = `position:fixed;bottom:136px;right:16px;z-index:9989;width:370px;max-height:78vh;background:#09091a;border:1px solid rgba(255,215,0,.13);border-radius:18px;overflow:hidden;display:none;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,.65);font-family:Inter,sans-serif;`;

    panel.innerHTML = `
      <div style="padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,.06);">
        <div style="font-size:13px;font-weight:700;color:var(--mk-gold,#f5c518);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">⚡ Extensions</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${[['watching','▶ Watching'],['history','📜 History'],['search','🔍 Search'],['suggest','💡 Suggest'],['proxy','🌐 Proxy']].map(([id,label],i) => `
            <button class="fas-ptab" data-tab="${id}"
              style="font-size:10px;padding:4px 10px;border-radius:20px;border:1px solid ${i===0?'rgba(255,215,0,.4)':'rgba(255,255,255,.1)'};background:${i===0?'rgba(255,215,0,.1)':'transparent'};color:${i===0?'rgba(255,215,0,.9)':'rgba(255,255,255,.4)'};cursor:pointer;white-space:nowrap;transition:all .15s;outline:none;">${label}</button>`).join('')}
        </div>
      </div>
      <div id="fas-pbody" style="overflow-y:auto;flex:1;padding:14px;"></div>`;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    let activeTab = 'watching';
    function setTab(tab) {
      activeTab = tab;
      panel.querySelectorAll('.fas-ptab').forEach(b => {
        const on = b.dataset.tab === tab;
        b.style.borderColor = on ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.1)';
        b.style.background = on ? 'rgba(255,215,0,.1)' : 'transparent';
        b.style.color = on ? 'rgba(255,215,0,.9)' : 'rgba(255,255,255,.4)';
      });
      renderTab(tab);
    }

    panel.querySelectorAll('.fas-ptab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

    function renderTab(tab) {
      const body = panel.querySelector('#fas-pbody');
      if (tab === 'watching') renderWatching(body);
      else if (tab === 'history') renderHistory(body);
      else if (tab === 'search') renderSearchTab(body);
      else if (tab === 'suggest') renderSuggest(body);
      else if (tab === 'proxy') renderProxy(body);
    }

    fab.addEventListener('click', () => {
      const open = panel.style.display === 'flex';
      panel.style.display = open ? 'none' : 'flex';
      if (!open) renderTab(activeTab);
    });

    document.addEventListener('click', e => {
      if (!panel.contains(e.target) && e.target !== fab) panel.style.display = 'none';
    });
  }

  /* ---- Watching ---- */
  function renderWatching(el) {
    const items = gs(K.watching, []);
    if (!items.length) {
      el.innerHTML = emptyState('🎬', 'Click on any movie, anime, or show card to track it here.');
      return;
    }
    el.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">Continue Watching</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:9px;">
        ${items.slice(0,9).map(item => `
          <div style="position:relative;aspect-ratio:2/3;border-radius:9px;overflow:hidden;cursor:pointer;border:1px solid rgba(255,215,0,.08);" title="${esc(item.title)}">
            <img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.88));padding:16px 5px 5px;font-size:9px;color:#fff;font-weight:600;line-height:1.3;">${esc(item.title)}</div>
            <div style="position:absolute;top:3px;right:3px;font-size:7px;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,.7);color:rgba(255,215,0,.8);text-transform:uppercase;">${esc(item.type)}</div>
          </div>`).join('')}
      </div>
      ${items.length > 9 ? `<div style="text-align:center;margin-top:8px;font-size:10px;color:rgba(255,255,255,.25);">+${items.length-9} more in History</div>` : ''}`;
  }

  /* ---- History ---- */
  function renderHistory(el) {
    const items = gs(K.history, []);
    if (!items.length) { el.innerHTML = emptyState('📜', 'No history yet.'); return; }
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;">Watch History (${items.length})</div>
        <button id="fas-clear-hist" style="font-size:10px;color:rgba(255,80,80,.65);background:none;border:none;cursor:pointer;text-decoration:underline;">Clear</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        ${items.map(item => `
          <div style="display:flex;gap:10px;align-items:center;padding:8px;background:rgba(255,255,255,.03);border-radius:9px;border:1px solid rgba(255,255,255,.05);">
            <img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" loading="lazy" style="width:32px;height:48px;object-fit:cover;border-radius:5px;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(item.title)}</div>
              <div style="font-size:9px;color:rgba(255,215,0,.55);text-transform:uppercase;margin-top:2px;">${esc(item.type)}</div>
              <div style="font-size:9px;color:rgba(255,255,255,.22);margin-top:1px;">${new Date(item.timestamp).toLocaleDateString()}</div>
            </div>
          </div>`).join('')}
      </div>`;
    el.querySelector('#fas-clear-hist').addEventListener('click', () => {
      ss(K.history, []); ss(K.watching, []); renderHistory(el);
    });
  }

  /* ---- Proxy Launcher ---- */
  function renderProxy(el) {
    el.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Web Proxy</div>
      <a href="/proxy.html" target="_blank" style="display:flex;align-items:center;gap:10px;background:rgba(229,57,53,0.12);border:1px solid rgba(229,57,53,0.3);border-radius:10px;padding:14px 16px;color:#e8e9f0;text-decoration:none;font-weight:600;font-size:13px;transition:background 0.15s;" onmouseover="this.style.background='rgba(229,57,53,0.22)'" onmouseout="this.style.background='rgba(229,57,53,0.12)'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        Open Proxy Hub
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" style="margin-left:auto"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>
      <div style="margin-top:10px;font-size:11px;color:rgba(255,255,255,.3);line-height:1.5;">Both FasahatHub proxies available inside. Use About:Blank mode in proxy settings for stealth browsing.</div>
    `;
  }

  /* ---- Activity Feed (from DM contacts) ---- */
  function renderActivity(el) {
    const user = window.__FIREBASE_USER__ || window.__USER__;
    if (!user) {
      el.innerHTML = emptyState('🔐', 'Sign in to see activity from your DM contacts.');
      return;
    }
    el.innerHTML = `<div style="text-align:center;padding:32px 0;color:rgba(255,255,255,.35);font-size:12px;">Loading…</div>`;

    waitForFB(async () => {
      const { db, fsCollection, fsGetDocs, fsQuery, fsOrderBy } = window;
      try {
        // Step 1: find DM contacts
        const convSnap = await fsGetDocs(fsCollection(db, 'conversations'));
        const contacts = new Set();
        convSnap.forEach(doc => {
          const parts = (doc.data()?.participants) || [];
          if (parts.includes(user.uid)) parts.forEach(uid => { if (uid !== user.uid) contacts.add(uid); });
        });

        if (!contacts.size) {
          el.innerHTML = emptyState('💬', "No DM contacts yet — start a conversation first!");
          return;
        }

        // Step 2: get their recent posts
        const postsSnap = await fsGetDocs(fsQuery(fsCollection(db, 'posts'), fsOrderBy('createdAt', 'desc')));
        const feed = [];
        postsSnap.forEach(doc => {
          const d = doc.data() || {};
          if (contacts.has(d.authorUid) && feed.length < 25) {
            feed.push({
              id: doc.id,
              content: d.content || '',
              author: d.authorName || d.author || 'Anonymous',
              authorUid: d.authorUid,
              authorPhoto: d.authorPhoto || null,
              image: d.imageUrl || null,
              time: d.createdAt?.toDate?.()?.getTime() || Date.now(),
            });
          }
        });

        if (!feed.length) {
          el.innerHTML = emptyState('📭', 'None of your DM contacts have posted recently.');
          return;
        }

        el.innerHTML = `
          <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Posts from DM Contacts</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${feed.map(post => `
              <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:12px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                  ${post.authorPhoto
                    ? `<img src="${esc(post.authorPhoto)}" loading="lazy" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid rgba(255,215,0,.2);">`
                    : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,215,0,.1);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:rgba(255,215,0,.7);">${esc(post.author[0])}</div>`}
                  <div>
                    <div style="font-size:11px;font-weight:600;color:rgba(255,215,0,.8);">${esc(post.author)}</div>
                    <div style="font-size:9px;color:rgba(255,255,255,.25);">${new Date(post.time).toLocaleDateString()}</div>
                  </div>
                </div>
                ${post.content ? `<div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.55;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${esc(post.content)}</div>` : ''}
                ${post.image ? `<img src="${esc(post.image)}" loading="lazy" style="width:100%;border-radius:8px;margin-top:8px;max-height:120px;object-fit:cover;">` : ''}
              </div>`).join('')}
          </div>`;
      } catch (err) {
        el.innerHTML = `<div style="text-align:center;padding:24px;color:rgba(255,100,100,.55);font-size:12px;">Could not load feed.<br><span style="font-size:10px;opacity:.6;">${esc(err.message)}</span></div>`;
      }
    });
  }

  /* ---- Search shortcut tab ---- */
  function renderSearchTab(el) {
    el.innerHTML = `
      <div style="text-align:center;padding:24px 0;">
        <div style="font-size:32px;margin-bottom:12px;">🔍</div>
        <div style="font-size:13px;color:rgba(255,255,255,.65);margin-bottom:16px;">Global search across all your content history</div>
        <button id="fas-open-search-btn"
          style="padding:10px 24px;background:var(--mk-accent-red,#ef4444);border:none;border-radius:10px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;letter-spacing:.04em;">
          Open Search
        </button>
        <div style="margin-top:10px;font-size:10px;color:rgba(255,255,255,.3);">Or press <kbd style="border:1px solid rgba(255,255,255,.2);border-radius:3px;padding:1px 5px;">Ctrl+K</kbd></div>
      </div>`;
    el.querySelector('#fas-open-search-btn').addEventListener('click', () => {
      document.getElementById('fas-ext-panel').style.display = 'none';
      openSearch();
    });
  }

  /* ---- Feature Suggestions ---- */
  function renderSuggest(el) {
    const saved = gs(K.suggestions, []);
    el.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">Suggest a Feature to Admin</div>
      <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,215,0,.1);border-radius:12px;padding:14px;margin-bottom:14px;">
        <textarea id="fas-sug-text" placeholder="Describe your idea…"
          style="width:100%;min-height:72px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.8);font-size:12px;padding:8px;resize:vertical;outline:none;font-family:inherit;box-sizing:border-box;line-height:1.5;"></textarea>
        <input id="fas-sug-cat" type="text" placeholder="Category (Movies, Social, Design…)"
          style="width:100%;margin-top:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.8);font-size:12px;padding:8px;outline:none;font-family:inherit;box-sizing:border-box;">
        <button id="fas-sug-submit"
          style="margin-top:10px;width:100%;padding:10px;background:var(--mk-accent-red,#ef4444);border:none;border-radius:8px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;transition:opacity .2s;">
          Submit Suggestion
        </button>
      </div>
      ${saved.length ? `
        <div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:8px;text-transform:uppercase;">Your Suggestions (${saved.length})</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${saved.slice(0,8).map(s => `
            <div style="padding:8px 10px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:8px;">
              <div style="font-size:11px;color:rgba(255,255,255,.6);">${esc(s.text)}</div>
              ${s.category ? `<div style="font-size:9px;color:rgba(255,215,0,.4);margin-top:3px;">${esc(s.category)}</div>` : ''}
              <div style="font-size:9px;color:rgba(255,255,255,.2);margin-top:2px;">${new Date(s.timestamp).toLocaleDateString()}</div>
            </div>`).join('')}
        </div>` : ''}`;

    el.querySelector('#fas-sug-submit').addEventListener('click', async () => {
      const text = el.querySelector('#fas-sug-text').value.trim();
      const category = el.querySelector('#fas-sug-cat').value.trim() || 'General';
      if (!text) return;
      const btn = el.querySelector('#fas-sug-submit');
      btn.textContent = 'Submitting…'; btn.style.opacity = '.6';

      const sug = {
        text, category, timestamp: Date.now(),
        userId: (window.__FIREBASE_USER__ || window.__USER__)?.uid || 'anonymous',
        userName: (window.__FIREBASE_USER__ || window.__USER__)?.displayName || 'Anonymous',
      };
      const prev = gs(K.suggestions, []);
      ss(K.suggestions, [sug, ...prev].slice(0, 30));

      try {
        if (window.db && window.fsCollection && window.fsAddDoc)
          await window.fsAddDoc(window.fsCollection(window.db, 'feature_suggestions'), sug);
      } catch {}

      btn.textContent = '✓ Submitted!'; btn.style.background = '#10b981'; btn.style.opacity = '1';
      setTimeout(() => renderSuggest(el), 2000);
    });
  }

  /* =========================================================
     5.  PROFILE CLICK → DM / POSTS NAV  (feature 15)
         Injects buttons into UserProfileModal when it opens
  ========================================================= */
  function tryInjectProfileModal(node) {
    if (!node.querySelectorAll) return;
    // The profile modal has a user-plus or user-minus button and an achievements section
    const followBtn = [...node.querySelectorAll('button')].find(b =>
      b.textContent.includes('Follow') || b.textContent.includes('Unfollow') || b.textContent.includes('Message')
    );
    if (!followBtn) return;
    const modalRoot = followBtn.closest('[class*="fixed"]') || followBtn.closest('[class*="modal"]') || followBtn.closest('[class*="z-50"]');
    if (!modalRoot || modalRoot.querySelector('#fas-profile-nav')) return;

    // Find the UID — look for data in parent or from displayed text
    const navRow = document.createElement('div');
    navRow.id = 'fas-profile-nav';
    navRow.style.cssText = 'display:flex;gap:8px;margin:10px 16px;';
    navRow.innerHTML = `
      <button id="fas-goto-posts"
        style="flex:1;padding:8px;border-radius:10px;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);color:rgba(255,215,0,.85);font-size:11px;cursor:pointer;font-weight:600;transition:all .15s;">
        📝 View Posts
      </button>
      <button id="fas-goto-dms"
        style="flex:1;padding:8px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.7);font-size:11px;cursor:pointer;font-weight:600;transition:all .15s;">
        💬 Send DM
      </button>`;

    followBtn.parentElement?.insertAdjacentElement('afterend', navRow) ||
      modalRoot.querySelector('[class*="overflow-y"]')?.prepend(navRow);

    // Clicking "View Posts" — close modal and navigate to posts tab
    navRow.querySelector('#fas-goto-posts').addEventListener('click', () => {
      // Click close button in modal
      const closeBtn = modalRoot.querySelector('button[class*="close"], button svg[class*="X"]')
        ?.closest('button') || [...modalRoot.querySelectorAll('button')].find(b => b.title === 'Close' || b.getAttribute('aria-label') === 'Close');
      closeBtn?.click();
      // Navigate to posts via nav link
      setTimeout(() => {
        const postsLink = [...document.querySelectorAll('a, button')].find(b =>
          b.textContent.trim().toLowerCase().includes('post') && !b.closest('#fas-ext-panel') && !b.closest('#fas-profile-nav'));
        postsLink?.click();
      }, 300);
    });

    // Clicking "Send DM" — close modal and navigate to DMs
    navRow.querySelector('#fas-goto-dms').addEventListener('click', () => {
      const closeBtn = [...modalRoot.querySelectorAll('button')].find(b =>
        b.title === 'Close' || b.getAttribute('aria-label') === 'Close' || (b.children[0]?.tagName === 'svg' && b.parentElement === modalRoot));
      closeBtn?.click();
      setTimeout(() => {
        const dmsLink = [...document.querySelectorAll('a, button')].find(b =>
          b.textContent.trim().toLowerCase().includes('dm') && !b.closest('#fas-ext-panel') && !b.closest('#fas-profile-nav'));
        dmsLink?.click();
      }, 300);
    });
  }

  /* =========================================================
     HELPERS
  ========================================================= */
  function emptyState(icon, msg) {
    return `<div style="text-align:center;padding:36px 0;color:rgba(255,255,255,.3);"><div style="font-size:30px;margin-bottom:10px;">${icon}</div><div style="font-size:12px;line-height:1.5;">${esc(msg)}</div></div>`;
  }

  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(typeof ts === 'object' && ts.toDate ? ts.toDate() : ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff/86400000) + 'd ago';
    return d.toLocaleDateString();
  }

  // Returns current authed user uid (checks both possible globals)
  function getUid() {
    return (window.__FIREBASE_USER__ || window.__USER__)?.uid || null;
  }

  // Waits for Firebase globals + authenticated user (checks both possible globals)
  function waitForFBAuth(cb, n = 0) {
    const user = window.__FIREBASE_USER__ || window.__USER__;
    if (window.db && window.fsCollection && window.fsGetDocs && user) { cb(); }
    else if (n < 80) { setTimeout(() => waitForFBAuth(cb, n + 1), 500); }
  }

  // Waits for ALL Firestore functions needed for read/write/query operations
  function waitForFBFull(cb, n = 0) {
    const user = window.__FIREBASE_USER__ || window.__USER__;
    if (window.db && window.fsCollection && window.fsGetDocs &&
        window.fsGetDoc && window.fsSetDoc && window.fsDoc &&
        window.fsQuery && window.fsWhere && window.fsOrderBy && user) { cb(); }
    else if (n < 120) { setTimeout(() => waitForFBFull(cb, n + 1), 500); }
  }

  function waitForFBPromise() {
    return new Promise(res => waitForFBAuth(res));
  }

  function waitForFBFullPromise() {
    return new Promise(res => waitForFBFull(res));
  }

  /* =========================================================
     5.  ADMIN — BAN DIALOG  (Feature 11)
  ========================================================= */
  let _banIntercepting = false;

  function buildBanDialog() {
    if (document.getElementById('fas-ban-dialog')) return;
    const ov = document.createElement('div');
    ov.id = 'fas-ban-dialog';
    ov.style.cssText = `display:none;position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.82);backdrop-filter:blur(10px);align-items:center;justify-content:center;font-family:Inter,sans-serif;`;
    ov.innerHTML = `
      <div style="background:#0d0d20;border:1.5px solid rgba(239,68,68,.4);border-radius:20px;padding:28px;width:360px;max-width:92vw;box-shadow:0 32px 80px rgba(0,0,0,.7);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93 19.07 19.07"/></svg>
          <span style="font-size:17px;font-weight:800;color:#ef4444;text-transform:uppercase;letter-spacing:.05em;">Ban User</span>
        </div>
        <div id="fas-ban-uname" style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:22px;padding-left:32px;"></div>
        <div style="display:grid;gap:10px;margin-bottom:18px;">
          <button id="fas-ban-perm" style="padding:14px 16px;background:rgba(239,68,68,.12);border:1.5px solid rgba(239,68,68,.35);border-radius:13px;color:#ef4444;font-weight:700;font-size:13px;cursor:pointer;text-align:left;transition:all .15s;">
            🔒 Permanent Ban
            <div style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35);margin-top:4px;">User is banned indefinitely with no expiry</div>
          </button>
          <button id="fas-ban-temp" style="padding:14px 16px;background:rgba(251,191,36,.07);border:1.5px solid rgba(251,191,36,.25);border-radius:13px;color:#fbbf24;font-weight:700;font-size:13px;cursor:pointer;text-align:left;transition:all .15s;">
            ⏳ Temporary Ban
            <div style="font-size:10px;font-weight:400;color:rgba(255,255,255,.35);margin-top:4px;">Ban expires after a set number of days</div>
          </button>
        </div>
        <div id="fas-ban-tempopts" style="display:none;margin-bottom:18px;padding:14px;background:rgba(255,255,255,.03);border-radius:12px;border:1px solid rgba(255,255,255,.07);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Duration (days)</label>
              <input id="fas-ban-days" type="number" min="1" max="365" value="7"
                style="width:100%;box-sizing:border-box;padding:8px 10px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:13px;outline:none;">
            </div>
            <div>
              <label style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Presets</label>
              <select id="fas-ban-preset"
                style="width:100%;box-sizing:border-box;padding:8px 10px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:12px;outline:none;cursor:pointer;">
                <option value="">Custom</option>
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
          <label style="font-size:10px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Reason (optional)</label>
          <input id="fas-ban-reason" type="text" placeholder="e.g. Spam, harassment, rule violation..."
            style="width:100%;box-sizing:border-box;padding:8px 10px;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:12px;outline:none;">
        </div>
        <div style="display:flex;gap:10px;">
          <button id="fas-ban-cancel" style="flex:1;padding:10px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:rgba(255,255,255,.5);font-size:12px;font-weight:600;cursor:pointer;transition:background .15s;">Cancel</button>
          <button id="fas-ban-confirm" style="display:none;flex:1;padding:10px 14px;background:linear-gradient(135deg,#ef4444,#dc2626);border:none;border-radius:10px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(239,68,68,.3);transition:opacity .15s;">⛔ Confirm Ban</button>
        </div>
      </div>`;
    document.body.appendChild(ov);

    let _pendingBtn = null;
    let _banMode = null;

    const permBtn = ov.querySelector('#fas-ban-perm');
    const tempBtn = ov.querySelector('#fas-ban-temp');
    const tempOpts = ov.querySelector('#fas-ban-tempopts');
    const confirmBtn = ov.querySelector('#fas-ban-confirm');
    const preset = ov.querySelector('#fas-ban-preset');
    const daysInput = ov.querySelector('#fas-ban-days');

    permBtn.addEventListener('mouseenter', () => permBtn.style.background = 'rgba(239,68,68,.22)');
    permBtn.addEventListener('mouseleave', () => { if (_banMode !== 'permanent') permBtn.style.background = 'rgba(239,68,68,.12)'; });
    tempBtn.addEventListener('mouseenter', () => tempBtn.style.background = 'rgba(251,191,36,.14)');
    tempBtn.addEventListener('mouseleave', () => { if (_banMode !== 'temporary') tempBtn.style.background = 'rgba(251,191,36,.07)'; });

    permBtn.addEventListener('click', () => {
      _banMode = 'permanent';
      tempOpts.style.display = 'none';
      confirmBtn.style.display = 'block';
      permBtn.style.borderColor = 'rgba(239,68,68,.9)';
      permBtn.style.background = 'rgba(239,68,68,.22)';
      tempBtn.style.borderColor = 'rgba(251,191,36,.25)';
      tempBtn.style.background = 'rgba(251,191,36,.07)';
    });

    tempBtn.addEventListener('click', () => {
      _banMode = 'temporary';
      tempOpts.style.display = 'block';
      confirmBtn.style.display = 'block';
      tempBtn.style.borderColor = 'rgba(251,191,36,.9)';
      tempBtn.style.background = 'rgba(251,191,36,.14)';
      permBtn.style.borderColor = 'rgba(239,68,68,.35)';
      permBtn.style.background = 'rgba(239,68,68,.12)';
    });

    preset.addEventListener('change', () => {
      if (preset.value) daysInput.value = preset.value;
    });

    ov.querySelector('#fas-ban-cancel').addEventListener('click', closeBanDialog);
    ov.addEventListener('click', e => { if (e.target === ov) closeBanDialog(); });

    confirmBtn.addEventListener('click', async () => {
      if (!_pendingBtn) { closeBanDialog(); return; }
      if (_banMode === 'temporary') {
        const days = parseInt(daysInput.value) || 7;
        const reason = ov.querySelector('#fas-ban-reason').value.trim();
        const expiry = Date.now() + days * 86400000;
        const uid = _pendingBtn.dataset.fasUid;
        if (uid) {
          const bans = JSON.parse(localStorage.getItem('fh_ban_details') || '{}');
          bans[uid] = { type: 'temporary', expiry, reason, days };
          localStorage.setItem('fh_ban_details', JSON.stringify(bans));
          if (window.db && window.fsSetDoc && window.fsDoc) {
            try {
              await window.fsSetDoc(window.fsDoc(window.db, 'players', uid),
                { banned: true, banType: 'temporary', banExpiry: expiry, banReason: reason },
                { merge: true });
            } catch {}
          }
        }
      } else if (_banMode === 'permanent') {
        const uid = _pendingBtn.dataset.fasUid;
        if (uid && window.db && window.fsSetDoc && window.fsDoc) {
          try {
            await window.fsSetDoc(window.fsDoc(window.db, 'players', uid),
              { banned: true, banType: 'permanent', banReason: '' },
              { merge: true });
          } catch {}
        }
      }
      _banIntercepting = true;
      _pendingBtn.click();
      setTimeout(() => { _banIntercepting = false; }, 300);
      closeBanDialog();
    });

    window.__fas_openBanDialog = (btn, displayName) => {
      _pendingBtn = btn;
      _banMode = null;
      ov.querySelector('#fas-ban-uname').textContent = `Banning: ${displayName}`;
      confirmBtn.style.display = 'none';
      tempOpts.style.display = 'none';
      permBtn.style.borderColor = 'rgba(239,68,68,.35)';
      permBtn.style.background = 'rgba(239,68,68,.12)';
      tempBtn.style.borderColor = 'rgba(251,191,36,.25)';
      tempBtn.style.background = 'rgba(251,191,36,.07)';
      ov.querySelector('#fas-ban-reason').value = '';
      daysInput.value = '7';
      preset.value = '';
      ov.style.display = 'flex';
    };
  }

  function closeBanDialog() {
    const d = document.getElementById('fas-ban-dialog');
    if (d) d.style.display = 'none';
  }

  // Intercept "Ban" clicks inside admin panel before React handles them
  document.addEventListener('click', e => {
    if (_banIntercepting) return;
    const btn = e.target.closest('button');
    if (!btn) return;
    const txt = btn.textContent.trim();
    if (txt !== 'Ban') return;
    const adminPanel = document.querySelector('[data-fas-admin="1"]') || btn.closest('[class*="max-w-5xl"]');
    if (!adminPanel) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const row = btn.closest('[class*="flex items-center justify-between"]') || btn.parentElement?.parentElement;
    const nameSpan = row ? (row.querySelector('span[class*="truncate"]') || row.querySelector('span')) : null;
    const displayName = nameSpan?.textContent?.trim() || 'Unknown user';
    if (!btn.dataset.fasUid) {
      const cache = window.__fas_usersCache || {};
      const match = Object.values(cache).find(u => u.displayName === displayName || u.email === displayName);
      if (match) btn.dataset.fasUid = match.uid;
    }
    if (window.__fas_openBanDialog) window.__fas_openBanDialog(btn, displayName);
  }, true);

  /* =========================================================
     6.  ADMIN TOOLS PANEL  (Features 3 · 4 · 16)
         Activity Timeline · DM Inspector · Contact Network
  ========================================================= */
  // Returns true if a string looks like a Firebase UID (28 chars, no spaces, alphanumeric+_-)
  function looksLikeUid(s) {
    return typeof s === 'string' && s.length >= 20 && !/\s/.test(s) && /^[A-Za-z0-9_\-]+$/.test(s);
  }

  /* =========================================================
     FIRESTORE INTERCEPTOR
     Wraps window.fsGetDocs so the 'players' collection always
     returns a corrected displayName and photoURL before React
     renders the data. This survives all re-renders because
     React itself receives the fixed data.
  ========================================================= */
  function _resolveName(d) {
    const raw = d.displayName || '';
    return (
      (!looksLikeUid(raw) && raw ? raw : null) ||
      (d.name        && !looksLikeUid(d.name)     ? d.name     : null) ||
      (d.username    && !looksLikeUid(d.username)  ? d.username : null) ||
      (d.email ? d.email.split('@')[0] : null)
    );
    // intentionally no fallback here — React will use ne.id itself,
    // and we don't want to replace that with a worse "User-XXXXXX"
  }

  function _resolvePhoto(d) {
    return d.photoURL || d.photo || d.avatar || d.avatarUrl ||
           d.profilePicture || d.picture || '';
  }

  function _patchPlayersSnapshot(snapshot) {
    if (!snapshot || !snapshot.docs || !snapshot.docs.length) return snapshot;
    const firstPath = snapshot.docs[0]?.ref?.path || '';
    if (!firstPath.startsWith('players/')) return snapshot;

    const authUser = window.__FIREBASE_USER__ || window.__USER__;
    let anyPatched = false;

    snapshot.docs.forEach(doc => {
      const d = (doc.data && doc.data()) || {};

      // If this document belongs to the currently logged-in user, always prefer
      // the Firebase Auth data (guaranteed to be correct)
      if (authUser && authUser.uid === doc.id) {
        const authName  = authUser.displayName && !looksLikeUid(authUser.displayName) ? authUser.displayName : null;
        const authPhoto = authUser.photoURL || '';
        const fsName    = _resolveName(d);
        const fsPhoto   = _resolvePhoto(d);
        const bestName  = authName || fsName;
        const bestPhoto = authPhoto || fsPhoto;
        if (bestName || bestPhoto) {
          anyPatched = true;
          const origData = doc.data.bind(doc);
          const patched = () => ({ ...origData(), displayName: bestName || origData().displayName || 'User', photoURL: bestPhoto || origData().photoURL || '' });
          try { doc.data = patched; } catch(e) { try { Object.defineProperty(doc, 'data', { value: patched, configurable: true }); } catch(e2) {} }
        }
        return;
      }

      const fixedName  = _resolveName(d);
      const fixedPhoto = _resolvePhoto(d);
      const nameOk  = !fixedName  || fixedName  === (d.displayName || '');
      const photoOk = fixedPhoto === (d.photoURL || '');
      if (nameOk && photoOk) return;
      anyPatched = true;
      const origData = doc.data.bind(doc);
      const patched = () => ({
        ...origData(),
        ...(fixedName  ? { displayName: fixedName }  : {}),
        ...(fixedPhoto ? { photoURL: fixedPhoto }     : {}),
      });
      try { doc.data = patched; } catch(e) { try { Object.defineProperty(doc, 'data', { value: patched, configurable: true }); } catch(e2) {} }
    });

    return snapshot; // same reference — preserves prototype methods like docChanges()
  }

  function _installFsGetDocsPatch() {
    if (window.__fas_fsPatchApplied || !window.fsGetDocs) return false;
    const _origGetDocs = window.fsGetDocs;
    window.fsGetDocs = async function (...args) {
      const result = await _origGetDocs.apply(this, args);
      return _patchPlayersSnapshot(result);
    };

    // Also patch fsOnSnapshot so the live 'players' listener gets corrected data
    if (window.fsOnSnapshot && !window.__fas_fsOnSnapPatchApplied) {
      const _origOnSnap = window.fsOnSnapshot;
      window.fsOnSnapshot = function (ref, callbackOrOptions, ...rest) {
        if (typeof callbackOrOptions !== 'function') {
          return _origOnSnap.call(this, ref, callbackOrOptions, ...rest);
        }
        const wrappedCb = snapshot => {
          callbackOrOptions(_patchPlayersSnapshot(snapshot));
        };
        return _origOnSnap.call(this, ref, wrappedCb, ...rest);
      };
      window.__fas_fsOnSnapPatchApplied = true;
    }

    window.__fas_fsPatchApplied = true;
    return true;
  }

  // Try immediately (React bundle already ran), then poll every 200 ms
  // in case Firebase globals aren't set yet.
  if (!_installFsGetDocsPatch()) {
    const _patchPoll = setInterval(() => {
      if (_installFsGetDocsPatch()) clearInterval(_patchPoll);
    }, 200);
    setTimeout(() => clearInterval(_patchPoll), 10000);
  }

  // ── Poll votes preservation patch ──────────────────────────────────
  // The AdminHub poll-save function always writes  votes:{}  — wiping
  // everyone's votes every time the admin edits the poll question or
  // options.  We intercept fsSetDoc on settings/site and restore the
  // existing votes whenever an empty-votes object would overwrite them.
  function _installSetDocPollPatch() {
    if (window.__fas_setDocPollPatchApplied || !window.fsSetDoc || !window.fsGetDoc || !window.fsDoc || !window.db) return false;
    const _origSetDoc = window.fsSetDoc;
    window.fsSetDoc = async function(ref, data, opts) {
      // Intercept ANY poll write to settings/site and ALWAYS merge with
      // existing Firestore votes.  This fixes two bugs at once:
      //   1. Admin poll-save resets votes:{} — preserved by merging
      //   2. Concurrent user votes overwrite each other — fixed by merging
      if (
        ref && typeof ref.path === 'string' &&
        (ref.path === 'settings/site' || ref.path.endsWith('/settings/site')) &&
        data && data.poll && typeof data.poll.votes === 'object'
      ) {
        try {
          const cur = await window.fsGetDoc(window.fsDoc(window.db, 'settings', 'site'));
          if (cur.exists()) {
            const existingVotes = cur.data()?.poll?.votes || {};
            // existing first, new on top — new vote for same uid overrides, old votes kept
            const merged = { ...existingVotes, ...data.poll.votes };
            data = { ...data, poll: { ...data.poll, votes: merged } };
            console.log('[FasahatHub] poll votes merged:', Object.keys(merged).length, 'total');
          }
        } catch (e) {
          console.warn('[FasahatHub] poll merge error:', e);
        }
      }
      return _origSetDoc.call(this, ref, data, opts);
    };
    window.__fas_setDocPollPatchApplied = true;
    console.log('[FasahatHub] fsSetDoc poll-votes patch applied');
    return true;
  }

  if (!_installSetDocPollPatch()) {
    const _sdPoll = setInterval(() => {
      if (_installSetDocPollPatch()) clearInterval(_sdPoll);
    }, 200);
    setTimeout(() => clearInterval(_sdPoll), 10000);
  }

  /* =========================================================
     DOM PATCHER — Fixes letter avatars & UID names in rendered cards
  ========================================================= */
  let _patchTimer = null;

  function scheduleUserCardPatch() {
    clearTimeout(_patchTimer);
    _patchTimer = setTimeout(patchUserCardsInDOM, 350);
  }

  function _makeAvatarImg(url) {
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
    img.onerror = () => { img.style.display = 'none'; };
    return img;
  }

  function _playerFromNameText(cache, text) {
    // If the text IS a UID key in the cache, return it directly (most common broken case)
    if (cache[text]) return cache[text];
    // Otherwise try a display-name match (for users whose name is already resolved but photo missing)
    return Object.values(cache).find(p => p.displayName === text) || null;
  }

  function patchUserCardsInDOM() {
    const cache = window.__fas_usersCache;
    if (!cache || !Object.keys(cache).length) return;

    // ── Pass 1: replace raw UID text with the real display name ─────────────
    // Any leaf element whose full text content matches a UID in our cache
    // gets swapped to the resolved displayName, and its nearby letter-avatar
    // gets a real profile photo injected.
    document.querySelectorAll('span, p, h3, h4, div, td, li, a').forEach(el => {
      if (el.children.length > 0) return;            // only leaf nodes
      const text = (el.textContent || '').trim();
      if (!looksLikeUid(text)) return;               // not a UID-shaped string
      if (el.dataset.fasPatch) return;               // already patched
      const player = cache[text];                    // ← direct UID key lookup
      if (!player || !player.displayName) return;    // skip if no real name resolved

      el.textContent = player.displayName;
      el.dataset.fasPatch = '1';

      // Patch the nearest letter-avatar in the same flex row
      const row = el.closest('[class*="flex"][class*="items-center"]') || el.parentElement?.parentElement;
      if (row && player.photoURL) {
        const avatarEl = row.querySelector(
          'div[class*="rounded-full"], div[class*="rounded-50"]'
        );
        if (avatarEl && !avatarEl.querySelector('img') && !avatarEl.dataset.fasPatch) {
          avatarEl.innerHTML = '';
          avatarEl.appendChild(_makeAvatarImg(player.photoURL));
          avatarEl.dataset.fasPatch = '1';
        }
      }
    });

    // ── Pass 2: inject real photos into letter-avatar divs ──────────────────
    // Looks for circular divs that still contain a single letter (no <img>).
    // Resolves the player by reading the nearby name span – which by now may
    // already have been corrected by Pass 1 (real name) or may still be a UID.
    document.querySelectorAll('div[class*="rounded-full"]').forEach(avatarEl => {
      if (avatarEl.dataset.fasPatch) return;
      if (avatarEl.querySelector('img')) return;     // already has a photo

      // Must look like a letter-avatar: single text char, no complex children
      const letter = (avatarEl.textContent || '').trim();
      if (letter.length > 2) return;                // more than 1-2 chars → not a letter avatar

      const row = avatarEl.closest('[class*="flex"][class*="items-center"]') || avatarEl.parentElement;
      if (!row) return;

      // Find the name element – try multiple selector strategies
      const nameEl =
        row.querySelector('span[class*="truncate"]') ||
        row.querySelector('span[class*="text-xs"]') ||
        row.querySelector('span[class*="text-sm"]') ||
        row.querySelector('span[class*="text-white"]') ||
        row.querySelector('span');
      if (!nameEl || nameEl === avatarEl) return;

      const nameText = (nameEl.textContent || '').trim();
      if (!nameText || nameText.length <= 1) return;

      const player = _playerFromNameText(cache, nameText);
      if (player?.photoURL) {
        avatarEl.innerHTML = '';
        avatarEl.appendChild(_makeAvatarImg(player.photoURL));
        avatarEl.dataset.fasPatch = '1';
      }
    });

    // ── Pass 3: fix <img> tags with empty/missing src in user card rows ──────
    document.querySelectorAll('img').forEach(img => {
      if (img.dataset.fasPatch) return;
      if (img.getAttribute('src')) return;           // already has a source
      const row = img.closest('[class*="flex"][class*="items-center"]');
      if (!row) return;
      const nameEl = row.querySelector('span[class*="truncate"], span[class*="text-xs"], span[class*="text-sm"], span');
      if (!nameEl) return;
      const nameText = (nameEl.textContent || '').trim();
      const player = _playerFromNameText(cache, nameText);
      if (player?.photoURL) {
        img.src = player.photoURL;
        img.dataset.fasPatch = '1';
      }
    });

    // ── Pass 4: inject status badges (ADMIN / PREMIUM / TRIAL) next to names ──
    document.querySelectorAll('span[class*="truncate"], div[class*="truncate"], span[class*="text-xs"], div[class*="text-xs"], span[class*="text-sm"], div[class*="text-sm"], span[class*="text-white"], div[class*="text-white"]').forEach(function(nameEl) {
      if (nameEl.dataset.fasBadge) return;
      var isInAdmin = !!nameEl.closest('[class*="rounded-2xl"]');
      var row = nameEl.closest('[class*="flex"][class*="items-center"]') || nameEl.parentElement?.parentElement;
      if (!row) return;
      if (row.dataset.fasBadge) return;
      var nameText = (nameEl.textContent || '').trim();
      if (!nameText || nameText.length <= 1) return;
      var player = _playerFromNameText(cache, nameText);
      if (!player) return;
      var role = player.role || '';
      var isPremiumActive = player.premium && (!player.premiumExpiresAt || player.premiumExpiresAt > Date.now());
      var isTrial = player.trial && isPremiumActive;
      var badgeHtml = '';
      // Skip PREMIUM/ADMIN badges inside React admin panel — it already renders role.
      // TRIAL always injects since admin panel doesn't show trial status.
      if (role === 'admin' && !isInAdmin) badgeHtml = '<span style="display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;padding:1px 5px;border-radius:5px;margin-left:4px;background:rgba(99,102,241,.15);color:rgba(165,180,252,.9);border:1px solid rgba(99,102,241,.25);text-transform:uppercase;">ADMIN</span>';
      else if (role === 'premium' && isTrial) badgeHtml = '<span style="display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;padding:1px 5px;border-radius:5px;margin-left:4px;background:rgba(52,211,153,.12);color:rgba(52,211,153,.85);border:1px solid rgba(52,211,153,.25);text-transform:uppercase;">TRIAL</span>';
      else if (role === 'premium' && isPremiumActive && !isInAdmin) badgeHtml = '<span style="display:inline-flex;align-items:center;gap:2px;font-size:8px;font-weight:700;padding:1px 5px;border-radius:5px;margin-left:4px;background:rgba(255,215,0,.12);color:rgba(255,215,0,.85);border:1px solid rgba(255,215,0,.25);text-transform:uppercase;">PREMIUM</span>';
      if (badgeHtml) {
        var badgeEl = document.createElement('span');
        badgeEl.innerHTML = badgeHtml;
        badgeEl.dataset.fasBadge = '1';
        nameEl.parentNode.insertBefore(badgeEl, nameEl.nextSibling);
        row.dataset.fasBadge = '1';
        nameEl.dataset.fasBadge = '1';
      }
    });
  }

  /* =========================================================
     ADMIN BATCH FIX — Repairs all bad player records in Firestore
  ========================================================= */
  async function adminBatchFixUsers() {
    const user = window.__FIREBASE_USER__ || window.__USER__;
    if (!user?.email || user.email.toLowerCase() !== 'fasahatalhasan@gmail.com') return 0;
    await waitForFBFullPromise();
    try {
      const snap = await window.fsGetDocs(window.fsCollection(window.db, 'players'));
      const updates = [];

      snap.forEach(docSnap => {
        const d = docSnap.data() || {};
        const patch = {};

        // Fix displayName — use any valid alternative field if current value is missing/UID-like
        const stored = d.displayName || '';
        if (!stored || looksLikeUid(stored)) {
          const fixed =
            (d.name && !looksLikeUid(d.name) ? d.name : null) ||
            (d.firstName ? [d.firstName, d.lastName].filter(Boolean).join(' ') : null) ||
            (d.username && !looksLikeUid(d.username) ? d.username : null) ||
            (d.email ? d.email.split('@')[0] : null) ||
            null;
          if (fixed) patch.displayName = fixed;
        }

        // Fix photoURL — check alternative field names
        if (!d.photoURL) {
          const fixed =
            d.photo ||
            d.avatar ||
            d.avatarUrl ||
            d.profilePicture ||
            d.picture ||
            null;
          if (fixed) patch.photoURL = fixed;
        }

        if (Object.keys(patch).length > 0) {
          updates.push(
            window.fsSetDoc(
              window.fsDoc(window.db, 'players', docSnap.id),
              patch,
              { merge: true }
            ).catch(() => {})
          );
        }
      });

      if (updates.length) {
        await Promise.all(updates);
        // Bust the cache so next render picks up corrected data
        window.__fas_usersCache = null;
        _usersCachePromise = null;
        console.log('[FasahatHub] Batch-fixed', updates.length, 'player record(s).');
      }
      return updates.length;
    } catch (err) {
      console.warn('[FasahatHub] adminBatchFixUsers error:', err.message);
      return 0;
    }
  }

  let _usersCachePromise = null;
  async function loadUsersCache() {
    // Return existing cache instantly
    if (window.__fas_usersCache && Object.keys(window.__fas_usersCache).length > 0) {
      return window.__fas_usersCache;
    }
    // If a fetch is already in progress, wait for it instead of starting another
    if (_usersCachePromise) return _usersCachePromise;
    _usersCachePromise = (async () => {
      window.__fas_usersCache = {};

      // Wait for Firestore globals (no user check — admin may use different auth)
      if (!window.db || !window.fsCollection || !window.fsGetDocs) {
        await new Promise(res => waitForFB(res));
      }

      // Firebase Auth data for whoever is logged in right now — always accurate
      const authUser = window.__FIREBASE_USER__ || window.__USER__;

      try {
        const snap = await window.fsGetDocs(window.fsCollection(window.db, 'players'));
        snap.forEach(doc => {
          const d = doc.data() || {};
          const rawName = d.displayName || '';

          let resolvedName  = null;
          let resolvedPhoto = d.photoURL || d.photo || d.avatar || d.avatarUrl ||
                              d.profilePicture || d.picture || '';

          if (authUser && authUser.uid === doc.id) {
            // Current user: Firebase Auth is the source of truth
            const authName = authUser.displayName && !looksLikeUid(authUser.displayName)
              ? authUser.displayName : null;
            resolvedName  = authName || (!looksLikeUid(rawName) && rawName ? rawName : null);
            resolvedPhoto = authUser.photoURL || resolvedPhoto;
          } else {
            // Other users: try every Firestore field; NO fake fallback — null means "no data"
            resolvedName =
              (!looksLikeUid(rawName) && rawName ? rawName : null) ||
              (d.name     && !looksLikeUid(d.name)     ? d.name     : null) ||
              (d.username && !looksLikeUid(d.username)  ? d.username : null) ||
              (d.email ? d.email.split('@')[0] : null) ||
              null;
          }

          window.__fas_usersCache[doc.id] = {
            uid:              doc.id,
            displayName:      resolvedName,
            photoURL:         resolvedPhoto,
            email:            d.email || '',
            role:             d.role || '',
            premium:          !!d.premium || d.role === 'premium',
            trial:            !!d.trial,
            premiumExpiresAt: d.premiumExpiresAt || 0,
          };
        });
      } catch {}

      // ── Posts cross-reference ──────────────────────────────────────────────
      // For users whose players doc has no name/photo, scan their own posts and
      // use the authorName / authorPhoto that was stored there at post-creation time.
      try {
        const missingUids = Object.keys(window.__fas_usersCache).filter(uid => {
          const u = window.__fas_usersCache[uid];
          return !u.displayName || !u.photoURL;
        });
        if (
          missingUids.length > 0 &&
          window.fsGetDocs && window.fsCollection &&
          window.db && window.fsQuery && window.fsOrderBy
        ) {
          const postsSnap = await window.fsGetDocs(
            window.fsQuery(
              window.fsCollection(window.db, 'posts'),
              window.fsOrderBy('createdAt', 'desc')
            )
          );
          postsSnap.forEach(pdoc => {
            const p   = pdoc.data() || {};
            const uid = p.authorUid || p.uid || p.userId || '';
            if (!uid || !window.__fas_usersCache[uid]) return;
            const cached = window.__fas_usersCache[uid];
            if (!cached.displayName) {
              cached.displayName =
                (p.authorName  && !looksLikeUid(p.authorName)  ? p.authorName  : null) ||
                (p.author      && !looksLikeUid(p.author)      ? p.author      : null) ||
                (p.userName    && !looksLikeUid(p.userName)     ? p.userName    : null) ||
                null;
            }
            if (!cached.photoURL) {
              cached.photoURL =
                p.authorPhoto || p.authorPhotoURL || p.authorAvatar || p.userPhoto || '';
            }
          });
        }
      } catch {}

      // ── Permanently fix the current user's Firestore document ──────────────
      // Write their real Auth name/photo back so future fetches are clean.
      if (authUser && authUser.uid && window.fsSetDoc && window.fsDoc && window.db) {
        const patch = {};
        if (authUser.displayName && !looksLikeUid(authUser.displayName)) {
          patch.displayName = authUser.displayName;
        }
        if (authUser.photoURL) patch.photoURL = authUser.photoURL;
        if (Object.keys(patch).length > 0) {
          window.fsSetDoc(
            window.fsDoc(window.db, 'players', authUser.uid),
            patch,
            { merge: true }
          ).catch(() => {});
        }
      }

      _usersCachePromise = null;
      return window.__fas_usersCache;
    })();
    return _usersCachePromise;
  }

  function tryInjectAdmin(root) {
    if (!root.querySelectorAll) return;

    // Exact match only — avoid partial matches on nav links or breadcrumbs
    const h1s = root.querySelectorAll('h1');
    let found = null;
    for (const h of h1s) {
      if (h.textContent.trim() === 'Admin Panel') { found = h; break; }
    }
    if (!found && root.tagName === 'H1' && root.textContent.trim() === 'Admin Panel') {
      found = root;
    }
    if (!found) return;

    // ── STEP 1: Inject CSS override immediately ────────────────────────────────
    _injectAdminCss();

    // ── STEP 2: One-shot tool injection ───────────────────────────────────────
    if (window.__fas_adminInjected) return;

    const innerCard =
      found.closest('[class*="backdrop-blur"]') ||
      found.closest('[class*="rounded-2xl"]')   ||
      found.closest('[class*="p-6"]')            ||
      found.parentElement;
    if (!innerCard) return;

    const outerWrap = innerCard.parentElement;
    if (!outerWrap) return;
    if (outerWrap.querySelector('#fas-admin-tools')) return;

    window.__fas_adminInjected = true;

    // Inject admin tools AFTER the motion.div — never inside it (React would
    // remove children it doesn't own, potentially restarting the animation).
    buildAdminToolsPanel(outerWrap, found);
    tryInjectAdminCards(outerWrap);
  }

  function buildAdminToolsPanel(container, headingEl) {
    const card = document.createElement('div');
    card.id = 'fas-admin-tools';
    card.style.cssText = `background:rgba(0,0,0,.3);border:1px solid rgba(255,215,0,.15);border-radius:18px;padding:20px;margin-bottom:8px;font-family:Inter,sans-serif;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,.8)" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 4.93 19.07"/><path d="M14 2.46A10 10 0 0 1 21.54 10"/></svg>
        <span style="font-size:13px;font-weight:800;color:rgba(255,215,0,.85);text-transform:uppercase;letter-spacing:.07em;">Admin Intelligence</span>
        <span style="margin-left:auto;font-size:10px;color:rgba(255,255,255,.2);background:rgba(255,215,0,.07);padding:2px 8px;border-radius:6px;border:1px solid rgba(255,215,0,.1);">ADMIN ONLY</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;" id="fas-atabs">
          ${[['activity','👤 Activity'],['dm-inspector','💬 DM Inspector'],['all-dms','🌐 All DMs'],['network','🕸 Contact Network'],['premium','👑 Premium']].map(([id,lbl],i)=>`
          <button class="fas-atab" data-tab="${id}"
            style="font-size:11px;padding:5px 12px;border-radius:20px;cursor:pointer;border:1px solid ${i===0?'rgba(255,215,0,.5)':'rgba(255,255,255,.1)'};background:${i===0?'rgba(255,215,0,.1)':'transparent'};color:${i===0?'rgba(255,215,0,.9)':'rgba(255,255,255,.4)'};outline:none;transition:all .15s;">${lbl}</button>`).join('')}
      </div>
      <div id="fas-atbody" style="min-height:80px;"></div>`;

    // container is now the INNER admin card — just append the tools panel inside it
    container.appendChild(card);

    let activeAtab = 'activity';
    card.querySelectorAll('.fas-atab').forEach(btn => {
      btn.addEventListener('click', () => {
        activeAtab = btn.dataset.tab;
        card.querySelectorAll('.fas-atab').forEach(b => {
          const on = b.dataset.tab === activeAtab;
          b.style.borderColor = on ? 'rgba(255,215,0,.5)' : 'rgba(255,255,255,.1)';
          b.style.background = on ? 'rgba(255,215,0,.1)' : 'transparent';
          b.style.color = on ? 'rgba(255,215,0,.9)' : 'rgba(255,255,255,.4)';
        });
        renderAdminTab(activeAtab, card.querySelector('#fas-atbody'));
      });
    });

    renderAdminTab('activity', card.querySelector('#fas-atbody'));
  }

  /* --- Feature 3: Activity Timeline --- */
  function renderAdminTab(tab, body) {
    if (tab === 'activity') renderActivityTimeline(body);
    else if (tab === 'dm-inspector') renderDMInspector(body);
    else if (tab === 'all-dms') renderAllDMs(body);
    else if (tab === 'network') renderContactNetwork(body);
    else if (tab === 'premium') renderPremiumManager(body);
  }

  /* --- Shared helper: load all conversations (parallel batch queries) --- */
  async function _loadAllConversations() {
    // Try 1: Direct list — fast if security rules allow
    try {
      var snap = await window.fsGetDocs(window.fsCollection(window.db, 'conversations'));
      var convs = [];
      snap.forEach(function(doc) {
        var d = doc.data() || {};
        convs.push({ id: doc.id, participants: d.participants || [], names: (d.participants||[]).map(function(uid) { return d['name_'+uid] || uid; }).join(' ↔ '), photos: (d.participants||[]).map(function(uid) { return d['photo_'+uid] || ''; }), lastMessage: d.lastMessage || '', lastTs: d.lastTime?.toDate?.()?.getTime() || d.lastTime || 0 });
      });
      return convs;
    } catch(e) {}

    // Try 2: Parallel batch queries with array-contains-any (10 UIDs per query)
    var uids = Object.keys(window.__fas_usersCache || {});
    if (!uids.length) {
      try {
        var psnap = await window.fsGetDocs(window.fsCollection(window.db, 'players'));
        psnap.forEach(function(pdoc) { uids.push(pdoc.id); });
      } catch(e2) {}
    }
    if (!uids.length) return [];

    var seen = {}, convs = [], batchSize = 10, batches = [];
    for (var i = 0; i < uids.length; i += batchSize) batches.push(uids.slice(i, i + batchSize));
    await Promise.all(batches.map(function(batch) {
      return window.fsGetDocs(window.fsQuery(window.fsCollection(window.db, 'conversations'), window.fsWhere('participants', 'array-contains-any', batch))).then(function(s) {
        s.forEach(function(doc) {
          if (seen[doc.id]) return;
          seen[doc.id] = true;
          var d = doc.data() || {};
          convs.push({ id: doc.id, participants: d.participants || [], names: (d.participants||[]).map(function(uid) { return d['name_'+uid] || uid; }).join(' ↔ '), photos: (d.participants||[]).map(function(uid) { return d['photo_'+uid] || ''; }), lastMessage: d.lastMessage || '', lastTs: d.lastTime?.toDate?.()?.getTime() || d.lastTime || 0 });
        });
      }).catch(function() {});
    }));
    return convs;
  }

  function renderActivityTimeline(body) {
    body.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input id="fas-act-search" type="text" placeholder="Search user by name or UID…"
          style="flex:1;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:12px;outline:none;">
        <button id="fas-act-go" style="padding:8px 14px;background:rgba(255,215,0,.15);border:1px solid rgba(255,215,0,.3);border-radius:10px;color:rgba(255,215,0,.85);font-size:12px;font-weight:600;cursor:pointer;">Search</button>
      </div>
      <div id="fas-act-results" style="color:rgba(255,255,255,.25);font-size:12px;text-align:center;padding:20px 0;">Search a user to see their activity timeline.</div>`;

    const go = () => {
      const q = body.querySelector('#fas-act-search').value.trim().toLowerCase();
      if (!q) return;
      body.querySelector('#fas-act-results').innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading…</div>`;
      waitForFB(async () => {
        const adminUid = getUid();
        if (!adminUid) {
          body.querySelector('#fas-act-results').innerHTML = emptyState('🔐', 'Sign in first to use Admin Intelligence.');
          return;
        }
        try {
          var cache = await loadUsersCache();
          var matched = Object.values(cache).filter(u =>
            (u.displayName||'').toLowerCase().includes(q) ||
            (u.uid||'').toLowerCase().includes(q) ||
            (u.email||'').toLowerCase().includes(q)
          );

          // Fallback: if cache is still empty, try direct Firestore query
          if (!matched.length && window.fsGetDocs && window.fsCollection && window.db) {
            try {
              var snap2 = await window.fsGetDocs(window.fsCollection(window.db, 'players'));
              snap2.forEach(function(doc) {
                var d = doc.data() || {};
                if ((d.displayName||'').toLowerCase().includes(q) || (doc.id||'').toLowerCase().includes(q) || (d.email||'').toLowerCase().includes(q)) {
                  matched.push({ uid: doc.id, displayName: d.displayName || d.name || d.username || d.email || '', email: d.email || '' });
                }
              });
            } catch(e2) {}
          }

          if (!matched.length) {
            body.querySelector('#fas-act-results').innerHTML = emptyState('🔍', 'No users found matching "' + esc(q) + '"');
            return;
          }

          const uid = matched[0].uid;
          const uname = matched[0].displayName;

          // Get posts by this user (no fsOrderBy — sort in JS to avoid index requirement)
          const postsSnap = await window.fsGetDocs(window.fsCollection(window.db, 'posts'));
          const posts = [];
          postsSnap.forEach(doc => {
            const d = doc.data() || {};
            if (d.authorUid === uid) posts.push({ id: doc.id, ...d, _type: 'post' });
          });
          posts.sort((a,b) => ((b.createdAt?.toDate?.()?.getTime()||b.createdAt||0) - (a.createdAt?.toDate?.()?.getTime()||a.createdAt||0)));

          // Get conversations involving searched user (using parallel batch loader)
          var allConvs = await _loadAllConversations();
          var convs = [];
          allConvs.forEach(function(c) {
            if (c.participants.indexOf(uid) === -1) return;
            var otherId = c.participants.find(function(p) { return p !== uid; });
            var nameParts = c.names.split(' ↔ ');
            var otherName = otherId ? (nameParts[0] === (c.participants[0]===uid?c.participants[1]:c.participants[0]) ? (nameParts[1]||nameParts[0]) : nameParts[0]) : 'Unknown';
            convs.push({ id: c.id, otherName: otherName, lastMessage: c.lastMessage, lastTime: c.lastTs });
          });

          const timelineItems = [
            ...posts.map(p => ({
              ts: p.createdAt?.toDate?.()?.getTime() || p.createdAt || 0,
              type: 'post',
              text: (p.content || '').slice(0, 80),
              extra: p.imageUrl ? '📷 image attached' : '',
            })),
            ...convs.map(c => ({
              ts: c.lastTime?.toDate?.()?.getTime() || c.lastTime || 0,
              type: 'dm',
              text: `DM with ${esc(c.otherName)}: "${esc((c.lastMessage||'').slice(0,55))}"`,
              extra: '',
            })),
          ].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 30);

          if (!timelineItems.length) {
            body.querySelector('#fas-act-results').innerHTML = emptyState('📭', `No activity found for ${esc(uname)}`);
            return;
          }

          body.querySelector('#fas-act-results').innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 12px;background:rgba(255,255,255,.04);border-radius:10px;">
              <div style="width:30px;height:30px;border-radius:50%;background:rgba(255,215,0,.12);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:rgba(255,215,0,.8);">${esc(uname[0]?.toUpperCase()||'?')}</div>
              <div>
                <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.8);">${esc(uname)}</div>
                <div style="font-size:10px;color:rgba(255,255,255,.3);">${posts.length} posts · ${convs.length} DM threads</div>
              </div>
            </div>
            <div style="position:relative;padding-left:20px;">
              <div style="position:absolute;left:7px;top:0;bottom:0;width:1px;background:rgba(255,215,0,.12);"></div>
              ${timelineItems.map(item => `
                <div style="position:relative;margin-bottom:10px;padding:9px 12px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid rgba(255,255,255,.05);">
                  <div style="position:absolute;left:-16px;top:50%;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:${item.type==='post'?'rgba(99,102,241,.8)':'rgba(16,185,129,.8)'};"></div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                    <div>
                      <div style="font-size:10px;font-weight:600;color:${item.type==='post'?'rgba(165,180,252,.8)':'rgba(52,211,153,.8)'};text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px;">${item.type==='post'?'📝 Post':'💬 DM'}</div>
                      <div style="font-size:11px;color:rgba(255,255,255,.65);line-height:1.4;">${item.text||'—'}</div>
                      ${item.extra ? `<div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;">${item.extra}</div>` : ''}
                    </div>
                    <div style="font-size:9px;color:rgba(255,255,255,.25);white-space:nowrap;flex-shrink:0;">${fmtTime(item.ts)}</div>
                  </div>
                </div>`).join('')}
            </div>`;
        } catch (err) {
          body.querySelector('#fas-act-results').innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ${esc(err.message)}</div>`;
        }
      });
    };

    body.querySelector('#fas-act-go').addEventListener('click', go);
    body.querySelector('#fas-act-search').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }

  /* --- Feature 4: DM Conversation Inspector with search (newest first) --- */
  function renderDMInspector(body) {
    body.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading conversations…</div>`;
    waitForFB(async () => {
      try {
        var convsAll = await _loadAllConversations();
        convsAll.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

        var renderList = function(filter) {
          var q = (filter||'').toLowerCase();
          var convs = q ? convsAll.filter(function(c) { return c.names.toLowerCase().includes(q) || (c.lastMessage||'').toLowerCase().includes(q); }) : convsAll;
          var html = '';
          if (!convs.length) {
            html = emptyState('💬', q ? 'No conversations match "' + esc(q) + '"' : 'No DM conversations found.');
          } else {
            html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.05em;">' + convs.length + ' of ' + convsAll.length + ' conversations</div><div style="font-size:10px;color:rgba(255,215,0,.5);">Newest first</div></div><div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto;padding-right:4px;" id="fas-dm-list">' + convs.map(function(c,i) {
              return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:11px;cursor:pointer;transition:background .15s;" class="fas-dm-row" data-idx="' + i + '"><div style="display:flex;flex-shrink:0;">' + (c.photos.slice(0,2).map(function(ph,pi) { return ph ? '<img src="' + esc(ph) + '" loading="lazy" style="width:26px;height:26px;border-radius:50%;object-fit:cover;margin-left:' + (pi>0?'-8px':'0') + ';border:1.5px solid rgba(0,0,0,.6);">' : '<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,215,0,.1);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:rgba(255,215,0,.7);margin-left:' + (pi>0?'-8px':'0') + ';border:1.5px solid rgba(0,0,0,.6);">' + esc((c.names||'?')[pi*4]||'?') + '</div>'; }).join('')) + '</div><div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(c.names) + '</div><div style="font-size:10px;color:rgba(255,255,255,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">' + esc((c.lastMessage||'').slice(0,60)||'No messages') + '</div></div><div style="font-size:9px;color:rgba(255,255,255,.2);white-space:nowrap;flex-shrink:0;">' + fmtTime(c.lastTs) + '</div></div>';
            }).join('') + '</div>';
          }
          body.querySelector('#fas-dm-content').innerHTML = html;
          body.querySelectorAll('.fas-dm-row').forEach(function(row) {
            row.addEventListener('mouseenter', function() { this.style.background = 'rgba(255,255,255,.06)'; });
            row.addEventListener('mouseleave', function() { this.style.background = 'rgba(255,255,255,.03)'; });
            row.addEventListener('click', function() {
              var idx = parseInt(this.dataset.idx);
              var filtered = (body.querySelector('#fas-dm-search').value||'').toLowerCase();
              var list = filtered ? convsAll.filter(function(c) { return c.names.toLowerCase().includes(filtered) || (c.lastMessage||'').toLowerCase().includes(filtered); }) : convsAll;
              expandDMConversation(body, list[idx], convsAll);
            });
          });
        };

        body.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:8px;"><input id="fas-dm-search" type="text" placeholder="Filter by name or message…" style="flex:1;padding:7px 10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;font-size:11px;outline:none;"><button id="fas-dm-search-btn" style="padding:7px 12px;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.25);border-radius:8px;color:rgba(255,215,0,.8);font-size:11px;font-weight:600;cursor:pointer;">Search</button></div><div id="fas-dm-content"></div>';
        renderList('');
        body.querySelector('#fas-dm-search-btn').addEventListener('click', function() { renderList(body.querySelector('#fas-dm-search').value); });
        body.querySelector('#fas-dm-search').addEventListener('keyup', function(e) { if (e.key === 'Enter') renderList(this.value); });
      } catch (err) {
        body.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ' + esc(err.message) + '</div>';
      }
    });
  }

  function expandDMConversation(body, conv, allConvs, onBack) {
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
        <button id="fas-dm-back" style="padding:5px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.5);font-size:11px;cursor:pointer;">← Back</button>
        <div style="font-size:12px;font-weight:700;color:rgba(255,255,255,.7);">${esc(conv.names)}</div>
      </div>
      <div id="fas-dm-msgs" style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading messages…</div>`;

    body.querySelector('#fas-dm-back').addEventListener('click', function() { (onBack || renderDMInspector)(body); });

    waitForFB(async () => {
      try {
        const snap = await window.fsGetDocs(
          window.fsQuery(
            window.fsCollection(window.db, 'conversations', conv.id, 'messages'),
            window.fsOrderBy('createdAt', 'desc')
          )
        );
        const msgs = [];
        snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

        const msgsEl = body.querySelector('#fas-dm-msgs');
        if (!msgs.length) {
          msgsEl.innerHTML = emptyState('📭', 'No messages in this conversation.');
          return;
        }
        msgsEl.innerHTML = `
          <div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:10px;text-align:right;">${msgs.length} messages (newest first)</div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;padding-right:4px;">
            ${msgs.map(msg => `
              <div style="padding:8px 12px;background:rgba(255,255,255,.03);border-radius:9px;border:1px solid rgba(255,255,255,.05);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                  <span style="font-size:10px;font-weight:600;color:rgba(255,215,0,.65);">${esc(msg.senderName||'System')}</span>
                  <span style="font-size:9px;color:rgba(255,255,255,.2);">${fmtTime(msg.createdAt?.toDate?.()?.getTime() || msg.createdAt)}</span>
                </div>
                <div style="font-size:11px;color:rgba(255,255,255,.6);line-height:1.4;">${esc(msg.text||'[media]')}</div>
              </div>`).join('')}
          </div>`;
      } catch (err) {
        body.querySelector('#fas-dm-msgs').innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error loading messages: ${esc(err.message)}</div>`;
      }
    });
  }

  /* --- All DMs: Global conversation viewer --- */
  function renderAllDMs(body) {
    body.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading all conversations…</div>';
    waitForFB(async () => {
      var adminUid = getUid();
      if (!adminUid) { body.innerHTML = emptyState('🔐', 'Sign in to view all DMs.'); return; }
      try {
        var convsAll = await _loadAllConversations();
        convsAll.sort(function(a,b) { return (b.lastTs||0) - (a.lastTs||0); });

        var renderList = function(filter) {
          var q = (filter||'').toLowerCase();
          var convs = q ? convsAll.filter(function(c) { return c.names.toLowerCase().includes(q) || (c.lastMessage||'').toLowerCase().includes(q); }) : convsAll;
          var parts = convs.length + ' of ' + convsAll.length + ' conversations';
          var html = '';
          if (!convs.length) {
            html = q ? emptyState('💬', 'No conversations match "' + esc(q) + '"') : emptyState('💬', 'No conversations found.');
          } else {
            html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.05em;">' + parts + '</div><div style="font-size:10px;color:rgba(255,215,0,.5);">Newest first</div></div><div style="display:flex;flex-direction:column;gap:5px;max-height:280px;overflow-y:auto;padding-right:4px;" id="fas-dm-list">' + convs.map(function(c,i) {
              var partCount = c.participants.length;
              var badge = partCount > 2 ? '<span style="font-size:8px;background:rgba(99,102,241,.15);color:rgba(165,180,252,.8);padding:1px 5px;border-radius:6px;margin-left:4px;">Group ' + partCount + '</span>' : '';
              var initials = (c.participants||[]).slice(0,3).map(function(uid) { return (uid||'?')[0].toUpperCase(); }).join('');
              return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:11px;cursor:pointer;transition:background .15s;" class="fas-dm-row" data-idx="' + i + '"><div style="width:28px;height:28px;border-radius:50%;background:rgba(255,215,0,.08);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:rgba(255,215,0,.6);flex-shrink:0;letter-spacing:.03em;">' + esc(initials) + '</div><div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(c.names) + badge + '</div><div style="font-size:10px;color:rgba(255,255,255,.3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">' + esc((c.lastMessage||'').slice(0,60)||'No messages') + '</div></div><div style="font-size:9px;color:rgba(255,255,255,.2);white-space:nowrap;flex-shrink:0;">' + fmtTime(c.lastTs) + '</div></div>';
            }).join('') + '</div>';
          }
          body.querySelector('#fas-adm-content').innerHTML = html;
          body.querySelectorAll('.fas-dm-row').forEach(function(row) {
            row.addEventListener('mouseenter', function() { this.style.background = 'rgba(255,255,255,.06)'; });
            row.addEventListener('mouseleave', function() { this.style.background = 'rgba(255,255,255,.03)'; });
            row.addEventListener('click', function() {
              var idx = parseInt(this.dataset.idx);
              var filtered = (body.querySelector('#fas-adm-search').value||'').toLowerCase();
              var list = filtered ? convsAll.filter(function(c) { return c.names.toLowerCase().includes(filtered) || (c.lastMessage||'').toLowerCase().includes(filtered); }) : convsAll;
              expandDMConversation(body, list[idx], convsAll, renderAllDMs);
            });
          });
        };

        body.innerHTML = '<div style="margin-bottom:6px;font-size:10px;color:rgba(255,255,255,.25);text-transform:uppercase;letter-spacing:.05em;">Global DM Viewer</div><div style="display:flex;gap:6px;margin-bottom:8px;"><input id="fas-adm-search" type="text" placeholder="Search all conversations…" style="flex:1;padding:7px 10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;font-size:11px;outline:none;"><button id="fas-adm-search-btn" style="padding:7px 12px;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.25);border-radius:8px;color:rgba(255,215,0,.8);font-size:11px;font-weight:600;cursor:pointer;">Search</button></div><div id="fas-adm-content"></div>';
        renderList('');
        body.querySelector('#fas-adm-search-btn').addEventListener('click', function() { renderList(body.querySelector('#fas-adm-search').value); });
        body.querySelector('#fas-adm-search').addEventListener('keyup', function(e) { if (e.key === 'Enter') renderList(this.value); });
      } catch (err) {
        body.innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ' + esc(err.message) + '</div>';
      }
    });
  }

  /* --- Feature 16: DM Contact Network --- */
  function renderContactNetwork(body) {
    body.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Building contact network…</div>`;
    waitForFB(async () => {
      try {
        var convs = await _loadAllConversations();
        var cache = await loadUsersCache();

        const edges = [];
        const nodeSet = new Set();
        const nodeConvCount = {};

        convs.forEach(c => {
          const [a, b] = c.participants || [];
          if (!a || !b) return;
          var nameParts = c.names.split(' ↔ ');
          const nameA = cache[a]?.displayName || nameParts[0] || a.slice(0,8);
          const nameB = cache[b]?.displayName || nameParts[1] || b.slice(0,8);
          nodeSet.add(a);
          nodeSet.add(b);
          nodeConvCount[a] = (nodeConvCount[a] || 0) + 1;
          nodeConvCount[b] = (nodeConvCount[b] || 0) + 1;
          edges.push({ a, b, nameA, nameB, lastTs: c.lastTs, lastMsg: c.lastMessage || '' });
        });

        // Sort by most recent
        edges.sort((x, y) => (y.lastTs || 0) - (x.lastTs || 0));

        // Top connected users
        const topUsers = [...nodeSet]
          .map(uid => ({ uid, name: cache[uid]?.displayName || uid.slice(0,8), count: nodeConvCount[uid] || 0 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        if (!edges.length) {
          body.innerHTML = emptyState('🕸', 'No DM connections found.');
          return;
        }

        body.innerHTML = `
          <div style="margin-bottom:14px;">
            <div style="font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">Most Connected Users</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${topUsers.map(u => `
                <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.12);border-radius:20px;">
                  <div style="width:18px;height:18px;border-radius:50%;background:rgba(255,215,0,.15);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:rgba(255,215,0,.7);">${esc(u.name[0]?.toUpperCase()||'?')}</div>
                  <span style="font-size:10px;color:rgba(255,255,255,.65);">${esc(u.name)}</span>
                  <span style="font-size:9px;color:rgba(255,215,0,.5);background:rgba(255,215,0,.08);padding:1px 5px;border-radius:8px;">${u.count}</span>
                </div>`).join('')}
            </div>
          </div>
          <div style="font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;">${edges.length} connections (recent first)</div>
          <div style="display:flex;flex-direction:column;gap:5px;max-height:260px;overflow-y:auto;padding-right:4px;">
            ${edges.map(edge => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.04);border-radius:9px;">
                <div style="display:flex;align-items:center;gap:5px;flex:1;min-width:0;">
                  <span style="font-size:11px;color:rgba(255,255,255,.65);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${esc(edge.nameA)}</span>
                  <span style="font-size:12px;color:rgba(255,215,0,.4);">↔</span>
                  <span style="font-size:11px;color:rgba(255,255,255,.65);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px;">${esc(edge.nameB)}</span>
                </div>
                <div style="flex-shrink:0;text-align:right;">
                  <div style="font-size:9px;color:rgba(255,255,255,.2);">${fmtTime(edge.lastTs)}</div>
                  ${edge.lastMsg ? `<div style="font-size:9px;color:rgba(255,255,255,.25);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;">"${esc(edge.lastMsg.slice(0,30))}"</div>` : ''}
                </div>
              </div>`).join('')}
          </div>`;
      } catch (err) {
        body.innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ${esc(err.message)}</div>`;
      }
    });
  }

  /* --- Feature 17: Premium Manager (redesigned) --- */
  function renderPremiumManager(body) {
    var allUsers = [];
    var render = function(filter) {
      var q = (filter||'').toLowerCase();
      var list = q ? allUsers.filter(function(u) { return (u.name||'').toLowerCase().includes(q) || (u.uid||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q); }) : allUsers;
      var premiumUsers = list.filter(function(u) { return u.premium && (!u.expiresAt || u.expiresAt > Date.now()); });
      var trialUsers = premiumUsers.filter(function(u) { return u.trial; });
      var expiredUsers = list.filter(function(u) { return u.premium && u.expiresAt && u.expiresAt <= Date.now(); });
      var nonPremium = list.filter(function(u) { return !u.premium; });

      var html = '';
      if (!list.length) {
        html = emptyState('👑', q ? 'No users match "' + esc(q) + '"' : 'Loading user data…');
      } else {
        html = '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;"><span style="font-size:10px;color:rgba(255,255,255,.3);background:rgba(255,255,255,.04);padding:3px 8px;border-radius:12px;">All: ' + list.length + '</span><span style="font-size:10px;color:rgba(52,211,153,.6);background:rgba(52,211,153,.06);padding:3px 8px;border-radius:12px;">Premium: ' + premiumUsers.length + '</span><span style="font-size:10px;color:rgba(52,211,153,.6);background:rgba(52,211,153,.06);padding:3px 8px;border-radius:12px;">Trial: ' + trialUsers.length + '</span><span style="font-size:10px;color:rgba(255,100,100,.5);background:rgba(255,100,100,.06);padding:3px 8px;border-radius:12px;">Expired: ' + expiredUsers.length + '</span></div>';
        html += '<div style="display:flex;flex-direction:column;gap:6px;max-height:340px;overflow-y:auto;padding-right:4px;">' + list.map(function(u) {
          var statusColor = u.premium && (!u.expiresAt || u.expiresAt > Date.now()) ? (u.trial ? 'rgba(52,211,153,0.8)' : 'rgba(255,215,0,0.8)') : (u.expiresAt && u.expiresAt <= Date.now() ? 'rgba(255,100,100,0.4)' : 'rgba(255,255,255,.25)');
          var statusText = u.premium && (!u.expiresAt || u.expiresAt > Date.now()) ? (u.expiresAt ? 'Expires ' + new Date(u.expiresAt).toLocaleDateString() : 'Permanent') : (u.expiresAt && u.expiresAt <= Date.now() ? 'Expired' : '—');
          var badge = u.trial ? '<span style="font-size:8px;background:rgba(52,211,153,.15);color:rgba(52,211,153,.85);padding:1px 5px;border-radius:5px;margin-left:4px;">TRIAL</span>' : (u.premium && (!u.expiresAt || u.expiresAt > Date.now()) ? '<span style="font-size:8px;background:rgba(255,215,0,.12);color:rgba(255,215,0,.75);padding:1px 5px;border-radius:5px;margin-left:4px;">PREMIUM</span>' : '');
          var daysLeft = u.expiresAt ? Math.ceil((u.expiresAt - Date.now()) / 86400000) : '';
          var daysStr = daysLeft > 0 ? ' (' + daysLeft + 'd)' : '';
          var customDays = body.querySelector('#fas-prem-defdays') ? body.querySelector('#fas-prem-defdays').value : 21;
          return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.05);border-radius:10px;"><div style="width:28px;height:28px;border-radius:50%;background:rgba(255,215,0,.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:rgba(255,215,0,.7);flex-shrink:0;">' + esc((u.name||'?')[0].toUpperCase()) + '</div><div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(u.name) + badge + '</div><div style="font-size:9px;color:' + statusColor + ';margin-top:1px;">' + statusText + daysStr + '</div></div><div style="display:flex;gap:4px;flex-shrink:0;"><button class="fas-prem-act" data-uid="' + u.uid + '" data-action="trial" style="padding:3px 7px;font-size:9px;border-radius:7px;cursor:pointer;border:1px solid rgba(52,211,153,.3);background:rgba(52,211,153,.08);color:rgba(52,211,153,.8);font-weight:600;">Trial</button><button class="fas-prem-act" data-uid="' + u.uid + '" data-action="forever" style="padding:3px 7px;font-size:9px;border-radius:7px;cursor:pointer;border:1px solid rgba(255,215,0,.3);background:rgba(255,215,0,.08);color:rgba(255,215,0,.8);font-weight:600;">Perm</button><button class="fas-prem-act" data-uid="' + u.uid + '" data-action="custom" data-days="' + customDays + '" style="padding:3px 7px;font-size:9px;border-radius:7px;cursor:pointer;border:1px solid rgba(99,102,241,.3);background:rgba(99,102,241,.08);color:rgba(165,180,252,.8);font-weight:600;">' + customDays + 'd</button><button class="fas-prem-act" data-uid="' + u.uid + '" data-action="remove" style="padding:3px 7px;font-size:9px;border-radius:7px;cursor:pointer;border:1px solid rgba(255,80,80,.25);background:rgba(255,80,80,.06);color:rgba(255,80,80,.7);font-weight:600;">Remove</button></div></div>';
        }).join('') + '</div>';
      }
      body.querySelector('#fas-prem-content').innerHTML = html;
      body.querySelectorAll('.fas-prem-act').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var uid = this.dataset.uid;
          var action = this.dataset.action;
          var data;
          var isTrial = false;
          if (action === 'trial') { data = { premium: true, trial: true, role: 'premium', premiumExpiresAt: Date.now() + 21 * 24 * 60 * 60 * 1000 }; isTrial = true; }
          else if (action === 'forever') { data = { premium: true, trial: false, role: 'premium', premiumExpiresAt: null }; }
          else if (action === 'custom') { data = { premium: true, trial: false, role: 'premium', premiumExpiresAt: Date.now() + parseInt(this.dataset.days || 21) * 24 * 60 * 60 * 1000 }; }
          else { data = { premium: false, trial: false, role: '', premiumExpiresAt: null }; }
          this.textContent = '...';
          window.fsSetDoc(window.fsDoc(window.db, 'players', uid), data, { merge: true }).then(function() {
            btn.textContent = '✓';
            // Update cache in-memory so badges appear immediately
            if (window.__fas_usersCache && window.__fas_usersCache[uid]) {
              window.__fas_usersCache[uid].role = data.role || '';
              window.__fas_usersCache[uid].premium = !!data.premium;
              window.__fas_usersCache[uid].trial = !!data.trial;
              window.__fas_usersCache[uid].premiumExpiresAt = data.premiumExpiresAt || 0;
            }
            scheduleUserCardPatch();
            setTimeout(function() {
              // Rebuild list
              loadAllPlayers(body, body.querySelector('#fas-prem-search').value, render);
            }, 1000);
          }).catch(function() { btn.textContent = '✗'; });
        });
      });
    };

    var loadAllPlayers = function(body, searchVal, cb) {
      body.querySelector('#fas-prem-content').innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:12px;">Loading users…</div>';
      waitForFB(async function() {
        try {
          var usersMap = {};
          var cache = await loadUsersCache();
          Object.keys(cache).forEach(function(k) {
            usersMap[k] = {
              name: cache[k].displayName || k,
              email: cache[k].email || '',
              uid: k,
              premium: !!cache[k].premium || cache[k].role === 'premium',
              trial: !!cache[k].trial,
              expiresAt: cache[k].premiumExpiresAt || 0,
            };
          });
          if (Object.keys(usersMap).length === 0) {
            // Fallback: direct query + individual reads for premium data
            var snap = await window.fsGetDocs(window.fsCollection(window.db, 'players'));
            snap.forEach(function(doc) {
              var d = doc.data() || {};
              usersMap[doc.id] = {
                name: d.displayName || d.name || d.username || d.email || doc.id.slice(0,8),
                email: d.email || '',
                uid: doc.id,
                premium: !!d.premium || d.role === 'premium',
                trial: !!d.trial,
                expiresAt: d.premiumExpiresAt || 0,
              };
            });
          }
          // Try to get fresh premium data for each user (fallback to cache data if read fails)
          await Promise.all(Object.keys(usersMap).map(function(uid) {
            return window.fsGetDoc(window.fsDoc(window.db, 'players', uid)).then(function(snap) {
              var d = snap ? (snap.data() || {}) : {};
              usersMap[uid].premium = !!d.premium || d.role === 'premium';
              usersMap[uid].trial = !!d.trial;
              usersMap[uid].expiresAt = d.premiumExpiresAt || 0;
            }).catch(function() {
              // Individual read failed — cache data already set above, keep it
            });
          }));
          allUsers = Object.values(usersMap);
          allUsers.sort(function(a,b) {
            var aP = a.premium ? 1 : 0;
            var bP = b.premium ? 1 : 0;
            if (aP !== bP) return bP - aP;
            return (a.name||'').localeCompare(b.name||'');
          });
          cb(searchVal);
        } catch(err) {
          body.querySelector('#fas-prem-content').innerHTML = '<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ' + esc(err.message) + '</div>';
        }
      });
    };

    body.innerHTML = '<div style="display:flex;gap:8px;margin-bottom:6px;"><input id="fas-prem-search" type="text" placeholder="Search users…" style="flex:1;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:12px;outline:none;"><button id="fas-prem-go" style="padding:8px 14px;background:rgba(255,215,0,.15);border:1px solid rgba(255,215,0,.3);border-radius:10px;color:rgba(255,215,0,.85);font-size:12px;font-weight:600;cursor:pointer;">Search</button></div><div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;"><span style="font-size:10px;color:rgba(255,255,255,.3);">Custom duration:</span><input id="fas-prem-defdays" type="number" min="1" value="21" style="width:45px;padding:4px 5px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#fff;font-size:11px;text-align:center;outline:none;"><span style="font-size:10px;color:rgba(255,255,255,.2);">days</span></div><div id="fas-prem-content"><div style="text-align:center;padding:20px;color:rgba(255,255,255,.25);font-size:12px;">Loading user data…</div></div>';

    loadAllPlayers(body, '', render);

    body.querySelector('#fas-prem-go').addEventListener('click', function() { render(body.querySelector('#fas-prem-search').value); });
    body.querySelector('#fas-prem-search').addEventListener('keyup', function(e) { if (e.key === 'Enter') render(this.value); });
  }

  /* =========================================================
     7.  HOMEPAGE — TOP ACTIVE USERS  (Feature 15)
  ========================================================= */
  let _homepageInjected = false;

  function tryInjectHomepage() {
    if (_homepageInjected) return;
    if (document.getElementById('fas-top-users')) return;
    // Detect homepage: URL is / and page has content carousels (multiple h2 headings)
    const path = window.location.pathname;
    if (path !== '/' && !path.endsWith('/index.html') && path !== '') return;
    const h2s = document.querySelectorAll('h2');
    if (h2s.length < 2) return;
    // Find a good insertion point — after the first shelf/section
    const mainContent = document.querySelector('[class*="max-w-7xl"]') || document.querySelector('[class*="max-w-6xl"]') || document.querySelector('main');
    if (!mainContent) return;
    // Find first inner section to insert after
    const firstSection = mainContent.querySelector('[class*="mb-"], [class*="space-y"]');
    if (!firstSection) return;
    _homepageInjected = true;
    buildTopActiveUsers(firstSection);
  }

  function buildTopActiveUsers(afterEl) {
    const section = document.createElement('div');
    section.id = 'fas-top-users';
    section.style.cssText = `margin:0 0 32px;font-family:Inter,sans-serif;`;
    section.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,215,0,.8)" stroke-width="2.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span style="font-size:13px;font-weight:700;color:rgba(255,255,255,.85);letter-spacing:.02em;">Top Active This Week</span>
        </div>
        <span style="font-size:10px;color:rgba(255,255,255,.2);">by posts</span>
      </div>
      <div id="fas-tu-list" style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;">
        <div style="padding:16px;color:rgba(255,255,255,.25);font-size:12px;">Loading…</div>
      </div>`;

    afterEl.parentElement?.insertBefore(section, afterEl.nextSibling) || afterEl.parentElement?.appendChild(section);

    waitForFBAuth(async () => {
      try {
        const oneWeekAgo = Date.now() - 7 * 86400000;
        const snap = await window.fsGetDocs(
          window.fsQuery(window.fsCollection(window.db, 'posts'), window.fsOrderBy('createdAt', 'desc'))
        );

        const counts = {};
        const info = {};
        snap.forEach(doc => {
          const d = doc.data() || {};
          const ts = d.createdAt?.toDate?.()?.getTime() || d.createdAt || 0;
          if (ts < oneWeekAgo) return;
          const uid = d.authorUid;
          if (!uid) return;
          counts[uid] = (counts[uid] || 0) + 1;
          if (!info[uid]) info[uid] = { name: d.authorName || d.author || 'Unknown', photo: d.authorPhoto || '' };
        });

        // Also load users cache so names are resolved even if authorName was missing on the post
        await loadUsersCache();
        const _uc = window.__fas_usersCache || {};

        const ranked = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([uid, count]) => {
            const cachedName = _uc[uid]?.displayName;
            const postName   = info[uid]?.name;
            // Prefer cache; fall back to post's authorName only if it doesn't look like a UID
            const name = (cachedName && !looksLikeUid(cachedName))
              ? cachedName
              : (postName && !looksLikeUid(postName) ? postName : null)
              || null;
            if (!name) return null; // hide users whose name can't be resolved cleanly
            return { uid, count, name, photo: _uc[uid]?.photoURL || info[uid]?.photo || '' };
          })
          .filter(Boolean);

        const list = document.getElementById('fas-tu-list');
        if (!list) return;

        if (!ranked.length) {
          list.innerHTML = `<div style="padding:16px;color:rgba(255,255,255,.25);font-size:12px;">No posts this week yet.</div>`;
        } else {
          list.innerHTML = ranked.map((u, i) => `
            <div style="flex-shrink:0;width:100px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 10px;text-align:center;position:relative;transition:border-color .2s;cursor:default;"
              onmouseenter="this.style.borderColor='rgba(255,215,0,.2)'" onmouseleave="this.style.borderColor='rgba(255,255,255,.07)'">
              ${i === 0 ? `<div style="position:absolute;top:-8px;left:50%;transform:translateX(-50%);font-size:14px;">👑</div>` : ''}
              ${u.photo
                ? `<img src="${esc(u.photo)}" loading="lazy" style="width:44px;height:44px;border-radius:50%;object-fit:cover;margin:4px auto 8px;border:2px solid ${i===0?'rgba(255,215,0,.5)':i===1?'rgba(192,192,192,.4)':i===2?'rgba(205,127,50,.4)':'rgba(255,255,255,.1)'};display:block;">`
                : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(255,215,0,.1);margin:4px auto 8px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:rgba(255,215,0,.7);border:2px solid rgba(255,215,0,.15);">${esc(u.name[0]?.toUpperCase()||'?')}</div>`}
              <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(u.name)}</div>
              <div style="font-size:10px;color:rgba(255,215,0,.6);margin-top:3px;font-weight:700;">${u.count} post${u.count!==1?'s':''}</div>
              <div style="font-size:9px;color:rgba(255,255,255,.2);margin-top:2px;">#${i+1}</div>
            </div>`).join('');
        }

      } catch {
        const list = document.getElementById('fas-tu-list');
        if (list) list.innerHTML = `<div style="padding:16px;color:rgba(255,100,100,.3);font-size:11px;">Could not load.</div>`;
      }
    });
  }

  /* =========================================================
     9.  ADMIN — MAINTENANCE MODE  (Feature 7)
  ========================================================= */
  let _maintenanceOn = false;

  function buildMaintenanceToggle(container) {
    if (container.querySelector('#fas-maint-card')) return;
    const card = document.createElement('div');
    card.id = 'fas-maint-card';
    card.style.cssText = `background:rgba(255,255,255,.03);border:1px solid rgba(255,100,50,.2);border-radius:18px;padding:20px;margin-top:10px;font-family:Inter,sans-serif;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,120,60,.8)" stroke-width="2.2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <div>
            <div style="font-size:13px;font-weight:800;color:rgba(255,120,60,.85);text-transform:uppercase;letter-spacing:.06em;">Maintenance Mode</div>
            <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:2px;">Shows a maintenance page to all non-admin visitors</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span id="fas-maint-status" style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.35);">OFF</span>
          <button id="fas-maint-toggle" style="padding:8px 18px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:1.5px solid rgba(255,120,60,.4);background:rgba(255,120,60,.12);color:rgba(255,120,60,.85);transition:all .15s;">Enable</button>
          <span id="fas-maint-msg" style="font-size:11px;color:rgba(255,255,255,.3);"></span>
        </div>
      </div>
      <div id="fas-maint-msg-section" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);">
        <label style="font-size:10px;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:6px;">Custom message (optional)</label>
        <div style="display:flex;gap:8px;">
          <input id="fas-maint-custom" type="text" placeholder="e.g. Back online at 3PM — upgrading servers"
            style="flex:1;padding:8px 12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:12px;outline:none;">
          <button id="fas-maint-save-msg" style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:rgba(255,255,255,.5);font-size:11px;font-weight:600;cursor:pointer;">Save</button>
        </div>
      </div>`;

    container.appendChild(card);

    // Load current state
    waitForFBAuth(async () => {
      try {
        const doc = await window.fsGetDoc(window.fsDoc(window.db, 'settings', 'site'));
        if (doc.exists()) {
          const data = doc.data() || {};
          _maintenanceOn = !!data.maintenanceMode;
          updateMaintenanceUI(card);
          if (_maintenanceOn && data.maintenanceMsg) {
            card.querySelector('#fas-maint-custom').value = data.maintenanceMsg;
          }
        }
      } catch {}
    });

    card.querySelector('#fas-maint-toggle').addEventListener('click', async () => {
      _maintenanceOn = !_maintenanceOn;
      updateMaintenanceUI(card);
      await waitForFBPromise();
      try {
        await window.fsSetDoc(window.fsDoc(window.db, 'settings', 'site'),
          { maintenanceMode: _maintenanceOn },
          { merge: true }
        );
        const msg = card.querySelector('#fas-maint-msg');
        msg.textContent = _maintenanceOn ? '✓ Maintenance enabled' : '✓ Site back online';
        msg.style.color = _maintenanceOn ? 'rgba(255,120,60,.8)' : 'rgba(100,220,100,.8)';
        setTimeout(() => { msg.textContent = ''; }, 3000);
      } catch (e) {
        const msg = card.querySelector('#fas-maint-msg');
        msg.textContent = '✗ ' + (e.message || 'Failed');
        msg.style.color = 'rgba(255,100,100,.7)';
      }
    });

    card.querySelector('#fas-maint-save-msg').addEventListener('click', async () => {
      const customMsg = card.querySelector('#fas-maint-custom').value.trim();
      await waitForFBPromise();
      try {
        await window.fsSetDoc(window.fsDoc(window.db, 'settings', 'site'), { maintenanceMsg: customMsg }, { merge: true });
        const msg = card.querySelector('#fas-maint-msg');
        msg.textContent = '✓ Message saved';
        msg.style.color = 'rgba(100,220,100,.8)';
        setTimeout(() => { msg.textContent = ''; }, 2500);
      } catch {}
    });
  }

  function updateMaintenanceUI(card) {
    const statusEl = card.querySelector('#fas-maint-status');
    const toggleBtn = card.querySelector('#fas-maint-toggle');
    const msgSection = card.querySelector('#fas-maint-msg-section');
    if (_maintenanceOn) {
      statusEl.textContent = 'ON';
      statusEl.style.background = 'rgba(255,120,60,.2)';
      statusEl.style.color = 'rgba(255,120,60,.9)';
      card.style.borderColor = 'rgba(255,120,60,.5)';
      toggleBtn.textContent = 'Disable';
      toggleBtn.style.background = 'rgba(255,120,60,.25)';
      toggleBtn.style.borderColor = 'rgba(255,120,60,.6)';
      toggleBtn.style.color = 'rgba(255,120,60,.95)';
      msgSection.style.display = 'block';
    } else {
      statusEl.textContent = 'OFF';
      statusEl.style.background = 'rgba(255,255,255,.07)';
      statusEl.style.color = 'rgba(255,255,255,.35)';
      card.style.borderColor = 'rgba(255,100,50,.2)';
      toggleBtn.textContent = 'Enable';
      toggleBtn.style.background = 'rgba(255,120,60,.12)';
      toggleBtn.style.borderColor = 'rgba(255,120,60,.4)';
      toggleBtn.style.color = 'rgba(255,120,60,.85)';
      msgSection.style.display = 'none';
    }
  }

  // Returns true if the currently resolved user is the site admin
  function _isAdmin() {
    const user = window.__FIREBASE_USER__ || window.__USER__;
    if (!user) return false;
    if (user.email && user.email.toLowerCase() === 'fasahatalhasan@gmail.com') return true;
    const roles = JSON.parse(localStorage.getItem('fh_user_roles') || '{}');
    return roles[user.uid] === 'admin';
  }

  // Wait until Firebase Auth has resolved (auth-changed fired or timeout)
  function waitForAuth(cb, timeoutMs = 5000) {
    // If auth is already determined (user object set or explicitly null), proceed immediately
    if (window.__FIREBASE_USER__ !== undefined) { cb(); return; }
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; cb(); } };
    window.addEventListener('auth-changed', done, { once: true });
    setTimeout(done, timeoutMs);
  }

  // Returns true if the admin email is found anywhere in localStorage
  // (Firebase stores current user in localStorage under firebase:authUser:* keys)
  function _isAdminFromStorage() {
    try {
      const ADMIN = 'fasahatalhasan@gmail.com';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const v = localStorage.getItem(k);
        if (v && v.includes(ADMIN)) return true;
      }
    } catch {}
    return false;
  }

  // Returns true if the current URL path looks like an admin page
  function _isAdminUrl() {
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    return path.includes('admin') || hash.includes('admin');
  }

  // Show maintenance overlay to non-admin visitors.
  // DOM-based check: is the admin panel h1 currently in the page?
  // The app uses tab-state navigation (URL never changes), so this is the only
  // reliable way to know the user is viewing the admin tab.
  function _isAdminActive() {
    const h1s = document.querySelectorAll('h1');
    for (const h of h1s) {
      if (h.textContent.trim() === 'Admin Panel') return true;
    }
    return false;
  }

  function checkMaintenanceMode() {
    // ── Immediate admin escape hatches (no Firestore read needed) ──────
    // 1. Skip if admin panel is currently visible in the DOM
    if (_isAdminActive()) return;
    // 2. Skip if URL contains "admin" (fallback for URL-based routing)
    if (_isAdminUrl()) return;
    // 3. Skip if Firebase has stored admin auth in localStorage
    if (_isAdminFromStorage()) return;

    // ── Wait for Firebase + auth to fully resolve ──────────────────────
    let _attempts = 0;
    const _poll = setInterval(async () => {
      _attempts++;

      const fbReady   = !!(window.db && window.fsGetDoc && window.fsDoc);
      // undefined = not yet resolved; null = logged out; object = logged in
      const authKnown = window.__FIREBASE_USER__ !== undefined;

      if (!fbReady) return;
      // Give auth up to 15 seconds — Firebase is fast but can be slow on
      // first visit or poor connections.
      if (!authKnown && _attempts < 75) return;

      clearInterval(_poll);

      // Re-run escape hatches now that auth is known
      if (_isAdmin() || _isAdminFromStorage()) return;

      try {
        const doc = await window.fsGetDoc(window.fsDoc(window.db, 'settings', 'site'));
        if (!doc.exists()) return;
        const siteData = doc.data() || {};
        if (!siteData.maintenanceMode) return;

        // Final check — admin never sees the overlay
        if (_isAdmin() || _isAdminFromStorage()) return;

        if (document.getElementById('fas-maint-overlay')) return;
        const ov = document.createElement('div');
        ov.id = 'fas-maint-overlay';
        ov.style.cssText = `position:fixed;inset:0;z-index:999998;background:#050510;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,sans-serif;text-align:center;padding:40px;`;
        ov.innerHTML = `
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,120,60,.6)" stroke-width="1.5" style="margin-bottom:28px;"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          <div style="font-size:32px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;">Under Maintenance</div>
          <div style="font-size:15px;color:rgba(255,255,255,.45);max-width:420px;line-height:1.6;margin-bottom:28px;">${siteData.maintenanceMsg ? esc(siteData.maintenanceMsg) : 'FasahatHub is currently undergoing maintenance. We\'ll be back shortly!'}</div>
          <div style="font-size:12px;color:rgba(255,120,60,.5);border:1px solid rgba(255,120,60,.2);padding:8px 20px;border-radius:20px;">🔧 Maintenance in progress</div>
          <button onclick="window.firebaseSignIn&&window.firebaseSignIn()"
            style="margin-top:24px;padding:10px 24px;background:rgba(255,120,60,.18);border:1.5px solid rgba(255,120,60,.4);border-radius:12px;color:rgba(255,120,60,.9);font-size:13px;font-weight:700;cursor:pointer;font-family:Inter,sans-serif;">
            Admin Sign In
          </button>`;
        document.body.appendChild(ov);

        // Persistently watch — remove overlay the moment admin auth OR admin panel is visible
        const _watch = setInterval(() => {
          if (_isAdmin() || _isAdminFromStorage() || _isAdminUrl() || _isAdminActive()) {
            clearInterval(_watch);
            const el = document.getElementById('fas-maint-overlay');
            if (el) el.remove();
          }
        }, 300);
        // Stop watching after 5 minutes
        setTimeout(() => clearInterval(_watch), 300000);
      } catch {}
    }, 200);
  }

  /* =========================================================
     10.  ADMIN — FEEDBACK / FEATURE SUGGESTIONS VIEWER
  ========================================================= */
  function buildFeedbackViewer(container) {
    if (container.querySelector('#fas-feedback-card')) return;
    const card = document.createElement('div');
    card.id = 'fas-feedback-card';
    card.style.cssText = `background:rgba(255,255,255,.03);border:1px solid rgba(99,102,241,.25);border-radius:18px;padding:20px;margin-top:10px;font-family:Inter,sans-serif;`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(165,180,252,.8)" stroke-width="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span style="font-size:13px;font-weight:800;color:rgba(165,180,252,.85);text-transform:uppercase;letter-spacing:.06em;">User Feedback</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <select id="fas-fb-filter" style="padding:5px 10px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.6);font-size:11px;outline:none;cursor:pointer;">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <button id="fas-fb-reload" style="padding:5px 12px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;color:rgba(165,180,252,.8);font-size:11px;font-weight:600;cursor:pointer;">↺ Refresh</button>
        </div>
      </div>
      <div id="fas-fb-body" style="min-height:60px;">
        <div style="text-align:center;padding:20px;color:rgba(255,255,255,.2);font-size:12px;">Loading feedback…</div>
      </div>`;
    container.appendChild(card);
    loadFeedback(card);
    card.querySelector('#fas-fb-reload').addEventListener('click', () => loadFeedback(card));
    card.querySelector('#fas-fb-filter').addEventListener('change', () => renderFeedbackItems(card, _fbCache, card.querySelector('#fas-fb-filter').value));
  }

  let _fbCache = [];

  function loadFeedback(card) {
    const body = card.querySelector('#fas-fb-body');
    body.innerHTML = `<div style="text-align:center;padding:20px;color:rgba(255,255,255,.2);font-size:12px;">Loading…</div>`;
    waitForFB(async () => {
      const uid = getUid();
      if (!uid) { body.innerHTML = emptyState('🔐', 'Sign in to view feedback.'); return; }
      try {
        const snap = await window.fsGetDocs(window.fsCollection(window.db, 'feature_suggestions'));
        _fbCache = [];
        snap.forEach(doc => _fbCache.push({ id: doc.id, ...doc.data() }));
        _fbCache.sort((a,b) => {
          const ta = a.createdAt?.toDate?.()?.getTime() || a.createdAt || 0;
          const tb = b.createdAt?.toDate?.()?.getTime() || b.createdAt || 0;
          return tb - ta;
        });
        const filter = card.querySelector('#fas-fb-filter').value;
        renderFeedbackItems(card, _fbCache, filter);
      } catch (err) {
        body.innerHTML = `<div style="text-align:center;padding:16px;color:rgba(255,100,100,.5);font-size:11px;">Error: ${esc(err.message)}</div>`;
      }
    });
  }

  function renderFeedbackItems(card, items, filter) {
    const body = card.querySelector('#fas-fb-body');
    const filtered = filter === 'all' ? items : items.filter(i => (i.status || 'pending') === filter);
    if (!filtered.length) {
      body.innerHTML = emptyState('💬', filter === 'all' ? 'No feedback submitted yet.' : `No ${filter} feedback.`);
      return;
    }
    body.innerHTML = `
      <div style="font-size:10px;color:rgba(255,255,255,.25);margin-bottom:8px;">${filtered.length} item${filtered.length!==1?'s':''}</div>
      <div style="display:flex;flex-direction:column;gap:7px;max-height:400px;overflow-y:auto;padding-right:4px;">
        ${filtered.map(item => {
          const status = item.status || 'pending';
          const statusColor = status === 'done' ? 'rgba(52,211,153,.8)' : status === 'dismissed' ? 'rgba(255,100,100,.6)' : 'rgba(251,191,36,.7)';
          const statusBg = status === 'done' ? 'rgba(52,211,153,.1)' : status === 'dismissed' ? 'rgba(255,100,100,.08)' : 'rgba(251,191,36,.08)';
          const ts = item.createdAt?.toDate?.()?.getTime() || item.createdAt || 0;
          return `
            <div style="padding:12px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;" data-fbid="${esc(item.id)}">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
                <div style="font-size:12px;color:rgba(255,255,255,.75);line-height:1.45;flex:1;">${esc(item.text || item.suggestion || item.content || '(no text)')}</div>
                <span style="font-size:9px;padding:2px 8px;border-radius:10px;background:${statusBg};color:${statusColor};white-space:nowrap;border:1px solid ${statusColor};flex-shrink:0;">${status}</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  ${item.authorPhoto ? `<img src="${esc(item.authorPhoto)}" loading="lazy" style="width:18px;height:18px;border-radius:50%;object-fit:cover;">` : `<div style="width:18px;height:18px;border-radius:50%;background:rgba(165,180,252,.15);display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:rgba(165,180,252,.7);">${esc((item.authorName||'?')[0].toUpperCase())}</div>`}
                  <span style="font-size:10px;color:rgba(255,255,255,.35);">${esc(item.authorName || 'Anonymous')}</span>
                  <span style="font-size:9px;color:rgba(255,255,255,.2);">· ${fmtTime(ts)}</span>
                </div>
                <div style="display:flex;gap:5px;">
                  <button class="fas-fb-act" data-id="${esc(item.id)}" data-status="done" style="padding:3px 8px;font-size:9px;border-radius:6px;cursor:pointer;border:1px solid rgba(52,211,153,.3);background:rgba(52,211,153,.08);color:rgba(52,211,153,.75);font-weight:600;">✓ Done</button>
                  <button class="fas-fb-act" data-id="${esc(item.id)}" data-status="dismissed" style="padding:3px 8px;font-size:9px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,100,100,.3);background:rgba(255,100,100,.06);color:rgba(255,100,100,.65);font-weight:600;">✗ Dismiss</button>
                  <button class="fas-fb-act" data-id="${esc(item.id)}" data-status="pending" style="padding:3px 8px;font-size:9px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.35);">↺ Reset</button>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    body.querySelectorAll('.fas-fb-act').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const newStatus = btn.dataset.status;
        btn.style.opacity = '0.5';
        try {
          await window.fsSetDoc(window.fsDoc(window.db, 'feature_suggestions', id), { status: newStatus }, { merge: true });
          const item = _fbCache.find(i => i.id === id);
          if (item) item.status = newStatus;
          const filter = card.querySelector('#fas-fb-filter').value;
          renderFeedbackItems(card, _fbCache, filter);
        } catch (e) {
          btn.style.opacity = '1';
          console.warn('Feedback update failed:', e.message);
        }
      });
    });
  }

  // Wire admin-only cards into the admin panel
  function tryInjectAdminCards(container) {
    buildMaintenanceToggle(container);
    buildFeedbackViewer(container);
    injectTrialButtons(container);
  }

  /* --- Inject trial button with custom days next to Premium/Unpremium/Ban in admin user cards --- */
  function scanAddTrialButtons() {
    var defaultDays = parseInt(document.getElementById('fas-trial-days')?.getAttribute('data-days') || localStorage.getItem('fas_trial_days') || '21', 10);
    document.querySelectorAll('button').forEach(function(btn) {
      var t = (btn.textContent||'').trim().toLowerCase();
      if (t !== 'ban') return;
      var parent = btn.parentElement;
      if (!parent || parent.querySelector('#fas-trial-btn')) return;
      var hasP = false, hasU = false;
      var actionsRow = btn.closest('[class*="flex"]') || parent;
      actionsRow.querySelectorAll('button').forEach(function(b) {
        var bt = (b.textContent||'').trim().toLowerCase();
        if (bt === 'premium') hasP = true;
        if (bt === 'unpremium') hasU = true;
      });
      if (!hasP || !hasU) {
        var wider = parent.parentElement;
        if (wider) {
          wider.querySelectorAll('button').forEach(function(b) {
            var bt = (b.textContent||'').trim().toLowerCase();
            if (bt === 'premium') hasP = true;
            if (bt === 'unpremium') hasU = true;
          });
        }
        if (!hasP || !hasU) return;
      }
      var card = btn.closest('[class*="rounded-xl"]') || parent.parentElement;
      var nameEl = card.querySelector('div[class*="truncate"], span[class*="truncate"]') || card.querySelector('span:not([style])') || parent.querySelector('strong');
      var displayName = nameEl ? nameEl.textContent.trim() : '';
      var wrap = document.createElement('span');
      wrap.style.cssText = 'display:inline-flex;align-items:center;gap:3px;';
      var daysInp = document.createElement('input');
      daysInp.type = 'number';
      daysInp.min = 1;
      daysInp.value = defaultDays;
      daysInp.style.cssText = 'width:28px;padding:2px 3px;border-radius:5px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.4);color:#fff;font-size:9px;text-align:center;outline:none;';
      daysInp.onclick = function(e) { e.stopPropagation(); };
      daysInp.onchange = function() { localStorage.setItem('fas_trial_days', this.value); };
      var tb = document.createElement('button');
      tb.id = 'fas-trial-btn';
      tb.textContent = 'Trial';
      tb.style.cssText = 'padding:2px 6px;border-radius:8px;border:1px solid rgba(52,211,153,0.3);background:rgba(52,211,153,0.1);color:rgba(52,211,153,0.85);font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s;';
      tb.onmouseenter = function() { this.style.background = 'rgba(52,211,153,0.2)'; };
      tb.onmouseleave = function() { this.style.background = 'rgba(52,211,153,0.1)'; };
      tb.onclick = function(e) {
        e.stopPropagation();
        e.preventDefault();
        var trialDays = parseInt(daysInp.value, 10) || 21;
        var lookup = function(cb) {
          var cache = window.__fas_usersCache || {};
          var match = Object.values(cache).find(function(u) { return u.displayName === displayName || u.email === displayName; });
          if (match) { cb(match.uid); return; }
          if (!window.fsGetDocs || !window.fsCollection || !window.db) { tb.textContent = 'No FS'; return; }
          window.fsGetDocs(window.fsCollection(window.db, 'players')).then(function(snap) {
            var found = null;
            snap.forEach(function(doc) {
              var d = doc.data() || {};
              if (d.displayName === displayName || d.email === displayName || doc.id === displayName) found = doc.id;
            });
            cb(found || '');
          }).catch(function() { tb.textContent = '✗ FS'; });
        };
        lookup(function(uid) {
          if (!uid) { tb.textContent = 'No UID'; return; }
          tb.textContent = '...';
          tb.disabled = true;
          window.fsSetDoc(window.fsDoc(window.db, 'players', uid), { premium: true, trial: true, role: 'premium', premiumExpiresAt: Date.now() + trialDays * 24 * 60 * 60 * 1000 }, { merge: true }).then(function() {
            tb.textContent = '✓';
            tb.style.borderColor = 'rgba(52,211,153,0.6)';
            // Update cache in-memory so badges appear immediately
            if (window.__fas_usersCache && window.__fas_usersCache[uid]) {
              window.__fas_usersCache[uid].role = 'premium';
              window.__fas_usersCache[uid].premium = true;
              window.__fas_usersCache[uid].trial = true;
              window.__fas_usersCache[uid].premiumExpiresAt = Date.now() + trialDays * 24 * 60 * 60 * 1000;
            }
            scheduleUserCardPatch();
            setTimeout(function() { tb.textContent = 'Trial'; tb.disabled = false; }, 2000);
          }).catch(function(err) {
            tb.textContent = '✗';
            setTimeout(function() { tb.textContent = 'Trial'; tb.disabled = false; }, 3000);
          });
        });
      };
      wrap.appendChild(tb);
      wrap.appendChild(daysInp);
      parent.appendChild(wrap);
    });
  }
  function injectTrialButtons(root) {
    if (document.getElementById('fas-trial-ob')) return;
    var obId = document.createElement('span');
    obId.id = 'fas-trial-ob';
    obId.style.display = 'none';
    document.body.appendChild(obId);
    var ob = new MutationObserver(scanAddTrialButtons);
    ob.observe(root, { childList: true, subtree: true });
    setTimeout(scanAddTrialButtons, 500);
  }

  /* =========================================================
     VIDEO CALL CONTROLS FIX
     Intercepts getUserMedia to capture the local stream, then
     injects overlay controls when an active call UI is visible.
     Hang button clicks the red end-call button in the React UI
     using a reliable visual/structural selector instead of text.
  ========================================================= */

  // Intercept getUserMedia early to capture local stream
  (function patchGetUserMedia() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(constraints) {
      return orig(constraints).then(stream => {
        window.__localStream__ = stream;
        return stream;
      });
    };
  })();

  let _callOverlayPresent = false;

  // Detect if a REAL video call is currently active (not just a movie/clip playing)
  function isCallUiActive() {
    // Don't trigger if the proxy overlay is open (iframe content has videos)
    const pov = document.getElementById('fas-pov');
    if (pov && pov.style.display !== 'none') return false;

    // Primary check: getUserMedia was intercepted and stream has live tracks
    const ls = window.__localStream__;
    if (ls && ls.getTracks) {
      const liveTracks = ls.getTracks().filter(t => t.readyState === 'live');
      if (liveTracks.length > 0) {
        // Also verify there's a call UI visible (fixed container with video)
        const videos = document.querySelectorAll('video');
        for (const v of videos) {
          const parent = v.closest('[class*="fixed"][class*="inset"]') ||
                         v.closest('[style*="position: fixed"]') ||
                         v.closest('[style*="position:fixed"]');
          if (parent) return true;
        }
        // Even without a fixed container, if stream is live it's a call
        return true;
      }
      // Stream exists but all tracks stopped — call ended
      return false;
    }

    // No getUserMedia stream captured — definitely not a call
    return false;
  }

  // Reliably dispatch a click on a React-rendered button
  function reactClick(btn) {
    if (!btn) return false;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    return true;
  }

  // Find the React end-call button: a red circular button in the call bar
  function findEndCallButton() {
    const skip = document.getElementById('fas-hang-btn');
    // 1) aria-label / title keyword match
    for (const btn of document.querySelectorAll('button')) {
      if (btn === skip) continue;
      const label = (btn.getAttribute('aria-label') || btn.title || btn.textContent || '').toLowerCase();
      if (label.includes('end') || label.includes('hang') || label.includes('decline') || label.includes('leave')) return btn;
    }
    // 2) Red circular button heuristic
    for (const btn of document.querySelectorAll('button')) {
      if (btn === skip) continue;
      const style = window.getComputedStyle(btn);
      const bg = style.backgroundColor || '';
      const w = parseFloat(style.width);
      const h = parseFloat(style.height);
      const br = parseFloat(style.borderRadius);
      const isRed = /rgb\(2[12]\d,\s*[23]\d,\s*[23]\d\)|rgb\(239|rgb\(220|rgb\(225|rgb\(248|rgb\(185/.test(bg);
      const isCircle = br >= 18;
      const isCallSize = w >= 40 && w <= 80 && h >= 40 && h <= 80;
      if (isRed && isCircle && isCallSize) return btn;
    }
    // 3) SVG phone-slash icon inside a button (common for hang-up)
    for (const btn of document.querySelectorAll('button')) {
      if (btn === skip) continue;
      const svgPaths = btn.querySelectorAll('line, path');
      let hasPhone = false, hasSlash = false;
      svgPaths.forEach(el => {
        const d = (el.getAttribute('d') || '').toLowerCase();
        if (d.includes('22 16.92') || d.includes('phone')) hasPhone = true;
        if (el.tagName === 'line') hasSlash = true;
      });
      if (hasPhone && hasSlash) return btn;
    }
    return null;
  }

  // Find the React mute button
  function findMuteButton() {
    for (const btn of document.querySelectorAll('button')) {
      const label = (btn.getAttribute('aria-label') || btn.title || '').toLowerCase();
      if (label === 'mute' || label === 'unmute' || label.includes('toggle mute') || label.includes('microphone')) return btn;
    }
    return null;
  }

  // Find the React camera button
  function findCameraButton() {
    for (const btn of document.querySelectorAll('button')) {
      const label = (btn.getAttribute('aria-label') || btn.title || '').toLowerCase();
      if (label.includes('camera') || label === 'video' || label.includes('cam') || label.includes('toggle video')) return btn;
    }
    return null;
  }

  function injectCallControls() {
    if (document.getElementById('fas-call-overlay')) return;

    _callOverlayPresent = true;

    const overlay = document.createElement('div');
    overlay.id = 'fas-call-overlay';
    overlay.style.cssText = [
      'position:fixed',
      'bottom:32px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:999999',
      'display:flex',
      'gap:16px',
      'align-items:center',
      'background:rgba(0,0,0,0.75)',
      'backdrop-filter:blur(12px)',
      'border:1px solid rgba(255,255,255,0.12)',
      'border-radius:50px',
      'padding:10px 24px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
      'font-family:Inter,sans-serif',
    ].join(';');

    let _muted = false;
    let _camOff = false;

    function makeBtn(id, bg, title, svgPath, onClick) {
      const btn = document.createElement('button');
      btn.id = id;
      btn.title = title;
      btn.style.cssText = [
        `background:${bg}`,
        'border:none',
        'border-radius:50%',
        'width:48px',
        'height:48px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'cursor:pointer',
        'color:#fff',
        'transition:transform 0.15s,opacity 0.15s',
        'flex-shrink:0',
      ].join(';');
      btn.innerHTML = svgPath;
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.12)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
      btn.addEventListener('click', onClick);
      return btn;
    }

    const micSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;
    const micOffSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M18.89 13.23A7 7 0 0 0 19 12v-2"/><path d="M16.95 16.95A7 7 0 0 1 5 12v-2"/><path d="M12 19v3"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/></svg>`;
    const camSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>`;
    const camOffSVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;
    const hangSVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l1.63-1.63a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

    function getLocalStream() {
      // Try captured stream first, then scan video elements for muted local preview
      if (window.__localStream__) return window.__localStream__;
      const videos = document.querySelectorAll('video');
      for (const v of videos) {
        if (v.muted && v.srcObject) return v.srcObject;
      }
      return null;
    }

    const muteBtn = makeBtn('fas-mute-btn', 'rgba(60,60,70,0.9)', 'Toggle Mute', micSVG, () => {
      const reactBtn = findMuteButton();
      reactClick(reactBtn);

      _muted = !_muted;
      muteBtn.innerHTML = _muted ? micOffSVG : micSVG;
      muteBtn.style.background = _muted ? 'rgba(200,50,50,0.85)' : 'rgba(60,60,70,0.9)';

      const localStream = getLocalStream();
      if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = !_muted; });
    });

    const camBtn = makeBtn('fas-cam-btn', 'rgba(60,60,70,0.9)', 'Toggle Camera', camSVG, () => {
      const reactBtn = findCameraButton();
      reactClick(reactBtn);

      _camOff = !_camOff;
      camBtn.innerHTML = _camOff ? camOffSVG : camSVG;
      camBtn.style.background = _camOff ? 'rgba(200,50,50,0.85)' : 'rgba(60,60,70,0.9)';

      const localStream = getLocalStream();
      if (localStream) localStream.getVideoTracks().forEach(t => { t.enabled = !_camOff; });
    });

    const hangBtn = makeBtn('fas-hang-btn', 'rgba(220,40,40,0.9)', 'End Call', hangSVG, () => {
      const reactEndBtn = findEndCallButton();
      if (reactClick(reactEndBtn)) {
        setTimeout(() => { overlay.remove(); _callOverlayPresent = false; }, 300);
      } else {
        const localStream = getLocalStream();
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        window.__localStream__ = null;
        overlay.remove();
        _callOverlayPresent = false;
      }
    });

    overlay.appendChild(muteBtn);
    overlay.appendChild(camBtn);
    overlay.appendChild(hangBtn);
    document.body.appendChild(overlay);
  }

  function removeCallOverlay() {
    const el = document.getElementById('fas-call-overlay');
    if (el) el.remove();
    _callOverlayPresent = false;
  }

  function checkCallState() {
    const active = isCallUiActive();
    if (active) {
      injectCallControls();
    } else if (_callOverlayPresent) {
      removeCallOverlay();
    }
  }

  /* =========================================================
     GAME IFRAME PERMISSION FIX
     Ensures game iframes have the permissions they need to run.
  ========================================================= */
  function fixGameIframes() {
    document.querySelectorAll('iframe').forEach(iframe => {
      const src = iframe.src || '';
      if (!src) return;
      if (src.includes('githack') || src.includes('github') || src.includes('gitlab') ||
          src.includes('itch.io') || src.includes('gmes') || src.includes('game')) {
        if (!iframe.dataset.fasFixed) {
          iframe.dataset.fasFixed = '1';
          iframe.setAttribute('allow', 'autoplay; fullscreen; pointer-lock; gamepad');
          if (!iframe.getAttribute('sandbox') || iframe.getAttribute('sandbox') === '') {
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock allow-modals allow-downloads');
          }
        }
      }
    });
  }

  /* =========================================================
     PROXY NAV BAR  (replaces marquee ticker in top navbar)
  ========================================================= */
  let _proxyBarInjected = false;
  let _povEscBound = false;
  let _overlayBuilt = false; // hard lock — prevents race-condition double-build
  // Tabbed browser state
  let _tabs = [];
  let _activeTabId = null;
  let _tabIdCounter = 0;
  let _tabNavHist = [];    // stack of {tabId, url} for back/forward per-tab
  let _tabNavIdx = {};     // tabId → current index in _tabNavHist

  function _injectBlackMarketNav() {
    if (document.getElementById('fas-bm-nav-btn')) return true;
    const nav = document.querySelector('nav');
    if (!nav) return false;
    // Find Home button by iterating children
    let homeBtn = null;
    for (const child of nav.children) {
      if (child.tagName === 'BUTTON' || child.tagName === 'A') {
        const txt = child.textContent.trim().toLowerCase();
        if (txt === 'home') { homeBtn = child; break; }
      }
    }
    if (!homeBtn) return false;

    const btn = document.createElement('button');
    btn.id = 'fas-bm-nav-btn';
    btn.innerHTML = '<span style="font-size:13px;">🏴</span> Black Market';
    btn.style.cssText = [
      'display:inline-flex;align-items:center;gap:6px',
      'padding:6px 14px;border-radius:20px',
      'background:linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.1))',
      'border:1.5px solid rgba(255,215,0,.35)',
      'color:rgba(255,215,0,.9);font-size:11px;font-weight:800',
      'letter-spacing:.06em;text-transform:uppercase',
      'transition:all .18s;white-space:nowrap;font-family:inherit',
      'box-shadow:0 0 12px rgba(255,215,0,.08)',
      'cursor:pointer',
    ].join(';');
    btn.onmouseenter = () => {
      btn.style.background = 'linear-gradient(135deg,rgba(255,215,0,.25),rgba(255,140,0,.18))';
      btn.style.borderColor = 'rgba(255,215,0,.6)';
      btn.style.boxShadow = '0 0 18px rgba(255,215,0,.18)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.1))';
      btn.style.borderColor = 'rgba(255,215,0,.35)';
      btn.style.boxShadow = '0 0 12px rgba(255,215,0,.08)';
    };
    btn.onclick = () => { window.location.href = '/blackmarket'; };
    homeBtn.parentNode.insertBefore(btn, homeBtn.nextSibling);
    return true;
  }

  // Resolve a query string into a full URL to proxy
  function _resolveProxyUrl(query) {
    const q = (query || '').trim();
    if (!q) return null;
    if (/^https?:\/\//i.test(q)) return q;
    if (/^[a-z0-9-]+(\.[a-z]{2,}){1,}(\/|$)/i.test(q)) return 'https://' + q;
    return 'https://duckduckgo.com/?q=' + encodeURIComponent(q);
  }

  /* =========================================================
     TABBED BROWSER OVERLAY
  ========================================================= */
  function buildProxyOverlay() {
    if (_overlayBuilt || document.getElementById('fas-pov')) return;
    _overlayBuilt = true;

    const ov = document.createElement('div');
    ov.id = 'fas-pov';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:2147483647;flex-direction:column;background:#0d0e14;';
    ov._activeTabId = null;

    // ── Toolbar ──
    const tb = document.createElement('div');
    tb.id = 'fas-pov-tb';
    tb.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;flex-shrink:0;background:#0d0e14;border-bottom:1px solid rgba(255,255,255,0.08);';

    function mkBtn(title, inner) {
      const b = document.createElement('button');
      b.title = title;
      b.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#aaa;border-radius:7px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s,color .15s;';
      b.innerHTML = inner;
      b.onmouseover = () => { b.style.background = 'rgba(255,255,255,0.1)'; b.style.color = '#e8e9f0'; };
      b.onmouseout  = () => { b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = '#aaa'; };
      return b;
    }

    const btnBack   = mkBtn('Back',    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>');
    const btnFwd    = mkBtn('Forward', '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>');
    const btnReload = mkBtn('Reload',  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>');
    btnBack.id = 'fas-pov-back'; btnFwd.id = 'fas-pov-fwd'; btnReload.id = 'fas-pov-reload';

    const urlForm = document.createElement('form');
    urlForm.id = 'fas-pov-urlform';
    urlForm.style.cssText = 'flex:1;display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:0 10px;height:30px;transition:border-color .2s;min-width:0;';
    urlForm.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><input id="fas-pov-urlinput" type="text" placeholder="Search or enter URL..." autocomplete="off" spellcheck="false" style="flex:1;background:none;border:none;outline:none;color:#e8e9f0;font-size:12px;font-family:inherit;min-width:0;caret-color:#e53935;">';

    const btnNewTab = document.createElement('button');
    btnNewTab.id = 'fas-pov-newtab';
    btnNewTab.title = 'New Tab';
    btnNewTab.style.cssText = 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#4ade80;border-radius:7px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:16px;font-weight:700;transition:background .15s;';
    btnNewTab.textContent = '+';
    btnNewTab.onmouseover = () => btnNewTab.style.background = 'rgba(255,255,255,0.1)';
    btnNewTab.onmouseout  = () => btnNewTab.style.background = 'rgba(255,255,255,0.05)';

    const btnClose = document.createElement('button');
    btnClose.id = 'fas-pov-close';
    btnClose.title = 'Close browser';
    btnClose.style.cssText = 'background:rgba(229,57,53,0.12);border:1px solid rgba(229,57,53,0.35);color:#e8e9f0;border-radius:7px;padding:5px 11px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;flex-shrink:0;transition:background .15s;';
    btnClose.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close';
    btnClose.onmouseover = () => btnClose.style.background = 'rgba(229,57,53,0.25)';
    btnClose.onmouseout  = () => btnClose.style.background = 'rgba(229,57,53,0.12)';

    tb.append(btnBack, btnFwd, btnReload, urlForm, btnNewTab, btnClose);

    // ── Tab bar ──
    const tabBar = document.createElement('div');
    tabBar.id = 'fas-pov-tabs';
    tabBar.style.cssText = 'display:flex;align-items:center;gap:2px;padding:0 10px;flex-shrink:0;background:#0d0e14;border-bottom:1px solid rgba(255,255,255,0.05);overflow-x:auto;min-height:32px;';

    // ── Content area ──
    const content = document.createElement('div');
    content.id = 'fas-pov-content';
    content.style.cssText = 'flex:1;position:relative;overflow:hidden;background:#0d0e14;';

    // ── Loading bar ──
    const lb = document.createElement('div');
    lb.id = 'fas-pov-loadbar';
    lb.style.cssText = 'position:absolute;top:0;left:0;height:2px;width:0%;background:linear-gradient(90deg,#e53935,#ff6f00);transition:width .3s;z-index:1;pointer-events:none;';
    content.appendChild(lb);

    ov.append(tb, tabBar, content);
    document.body.appendChild(ov);

    // ── Events ──
    btnClose.addEventListener('click', _closeBrowser);
    btnNewTab.addEventListener('click', () => _createTab('https://duckduckgo.com', 'New Tab'));

    btnBack.addEventListener('click', () => {
      const tab = _tabs.find(t => t.id === _activeTabId);
      if (tab) { try { tab.iframe.contentWindow.history.back(); } catch(e) {} }
    });
    btnFwd.addEventListener('click', () => {
      const tab = _tabs.find(t => t.id === _activeTabId);
      if (tab) { try { tab.iframe.contentWindow.history.forward(); } catch(e) {} }
    });
    btnReload.addEventListener('click', () => {
      const tab = _tabs.find(t => t.id === _activeTabId);
      if (!tab) return;
      try {
        const src = tab.iframe.src;
        if (src && src !== 'about:blank') {
          tab.iframe.src = 'about:blank';
          requestAnimationFrame(() => { tab.iframe.src = src; });
        }
      } catch(e) {}
    });

    urlForm.addEventListener('submit', e => {
      e.preventDefault(); e.stopPropagation();
      const ui = document.getElementById('fas-pov-urlinput');
      const url = _resolveProxyUrl(ui ? ui.value : '');
      if (url) _createTab(url);
    });

    if (!_povEscBound) {
      _povEscBound = true;
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          const o = document.getElementById('fas-pov');
          if (o && o.style.display !== 'none') { e.stopPropagation(); _closeBrowser(); }
        }
      }, true);
    }
  }

  function _saveProxyState(url) {
    try { sessionStorage.setItem('fas_proxy_restore', JSON.stringify({ url: url, ts: Date.now() })); } catch(e) {}
  }
  function _clearProxyState() {
    try { sessionStorage.removeItem('fas_proxy_restore'); } catch(e) {}
  }
  function _getSavedProxyState() {
    try {
      const raw = sessionStorage.getItem('fas_proxy_restore');
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && s.url && Date.now() - s.ts < 30 * 60 * 1000) return s;
    } catch(e) {}
    return null;
  }

  // ── Tab management ──
  function _createTab(url, title) {
    buildProxyOverlay();
    const ov = document.getElementById('fas-pov');
    const tabBar = document.getElementById('fas-pov-tabs');
    const content = document.getElementById('fas-pov-content');
    if (!ov || !tabBar || !content) return;

    ov.style.display = 'flex';
    // Hide the main site header so it doesn't bleed above the overlay
    try {
      const h = document.querySelector('header');
      if (h && h.id !== 'fas-pov') {
        h.style.setProperty('visibility', 'hidden', 'important');
        h.style.setProperty('pointer-events', 'none', 'important');
      }
    } catch(e) {}

    const id = ++_tabIdCounter;
    const ti = title || url || 'New Tab';

    // Iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'fas-pov-frame-' + id;
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:none;background:#fff;';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads allow-modals allow-top-navigation-by-user-activation');
    iframe.setAttribute('allow', 'autoplay; fullscreen; gamepad; clipboard-read; clipboard-write');

    // Tab button
    const tabEl = document.createElement('div');
    tabEl.id = 'fas-pov-tab-' + id;
    tabEl.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;font-size:11px;color:#aaa;cursor:pointer;border-radius:6px 6px 0 0;white-space:nowrap;flex-shrink:0;transition:background .15s;user-select:none;';
    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'max-width:120px;overflow:hidden;text-overflow:ellipsis;';
    titleSpan.textContent = ti;
    const closeSpan = document.createElement('span');
    closeSpan.style.cssText = 'font-size:14px;color:#666;padding:0 2px;border-radius:3px;line-height:1;';
    closeSpan.textContent = '\u00D7';
    closeSpan.onmouseover = () => closeSpan.style.color = '#e53935';
    closeSpan.onmouseout  = () => closeSpan.style.color = '#666';
    tabEl.append(titleSpan, closeSpan);

    // Create tab object
    const tab = { id, title: ti, url: url || '', iframe, tabEl, navStack: [url || ''], navIdx: 0 };
    _tabs.push(tab);

    // Insert tab button before the "+" new tab button
    tabBar.appendChild(tabEl);
    content.appendChild(iframe);

    // Wire events
    closeSpan.addEventListener('click', e => { e.stopPropagation(); _closeTab(id); });
    tabEl.addEventListener('click', () => _switchTab(id));

    iframe.addEventListener('load', () => {
      const lb = document.getElementById('fas-pov-loadbar');
      if (lb) { lb.style.width = '100%'; setTimeout(() => { lb.style.width = '0%'; }, 400); }
      // Update title from proxied URL
      try {
        const src = iframe.src || '';
        if (src && src !== 'about:blank') {
          const u = new URL(src, location.origin);
          const proxied = u.searchParams.get('url');
          if (proxied) {
            const decoded = decodeURIComponent(proxied);
            tab.url = decoded;
            if (id === _activeTabId) {
              const ui = document.getElementById('fas-pov-urlinput');
              if (ui) ui.value = decoded;
            }
            _updateTabLabel(id, decoded);
          }
        }
      } catch(e) {}
    });

    // New tab or first tab - switch to it
    _switchTab(id);

    // Load URL
    if (url && url !== 'about:blank') {
      const lb = document.getElementById('fas-pov-loadbar');
      if (lb) lb.style.width = '25%';
      iframe.src = '/px?url=' + encodeURIComponent(url);
    } else if (!url) {
      iframe.srcdoc = '<html><body style="background:#0d0e14;display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:sans-serif;color:#555;font-size:14px;margin:0;height:100%;"><div style="font-size:32px;margin-bottom:12px;">\uD83C\uDF10</div><div>Enter a URL or search to start browsing</div></body></html>';
    }

    _saveProxyState(url || '');
    return id;
  }

  function _closeTab(id) {
    const idx = _tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tab = _tabs[idx];
    tab.iframe.remove();
    tab.tabEl.remove();
    _tabs.splice(idx, 1);
    if (_tabs.length === 0) { _closeBrowser(); return; }
    if (id === _activeTabId) {
      const next = Math.min(idx, _tabs.length - 1);
      _switchTab(_tabs[next].id);
    }
  }

  function _switchTab(id) {
    const tab = _tabs.find(t => t.id === id);
    if (!tab) return;
    _activeTabId = id;
    _tabs.forEach(t => {
      t.iframe.style.display = 'none';
      if (t.tabEl) t.tabEl.style.background = 'transparent';
    });
    tab.iframe.style.display = 'block';
    if (tab.tabEl) tab.tabEl.style.background = 'rgba(255,255,255,0.08)';
    const ui = document.getElementById('fas-pov-urlinput');
    if (ui) ui.value = tab.url || '';
  }

  function _updateTabLabel(id, title) {
    const tab = _tabs.find(t => t.id === id);
    if (!tab || !tab.tabEl) return;
    tab.title = title;
    const span = tab.tabEl.querySelector('span');
    if (span) span.textContent = title;
  }

  function _closeBrowser() {
    const ov = document.getElementById('fas-pov');
    if (ov) ov.style.display = 'none';
    _tabs.forEach(t => { try { t.iframe.src = 'about:blank'; } catch(e) {} });
    _tabs = [];
    _activeTabId = null;
    _clearProxyState();
    // Restore main site header visibility
    try {
      const h = document.querySelector('header');
      if (h && h.id !== 'fas-pov') { h.style.removeProperty('visibility'); h.style.removeProperty('pointer-events'); }
    } catch(e) {}
  }

  function _loadInOverlay(urlOrQuery, skipResolve) {
    const url = skipResolve ? urlOrQuery : _resolveProxyUrl(urlOrQuery);
    if (!url) return;
    _createTab(url);
  }

  function launchProxyBar(query, mode) {
    const url = _resolveProxyUrl(query || '');
    if (!url) return;
    mode = mode || gs('fas_proxy_mode', 'overlay');
    if (mode === 'overlay') { _loadInOverlay(url, true); return; }
    const proxyUrl = '/px?url=' + encodeURIComponent(url);
    if (mode === 'direct') { window.location.href = proxyUrl; }
    else if (mode === 'newtab') { window.open(proxyUrl, '_blank'); }
    else if (mode === 'proxy1') { window.open('/proxy1?q=' + encodeURIComponent(url), '_blank'); }
    else if (mode === 'proxy2') { window.open('/proxy2?q=' + encodeURIComponent(url), '_blank'); }
  }

  /* =========================================================
     WINDOW.OPEN + IFRAME WRAPPER — proxy external URLs opened by hubs
     LimitedTimeHub and WebHub create a blank popup, then create an
     iframe inside it with f.src = actualUrl. We intercept both:
     1) window.open(extUrl) — direct external URL openings
     2) iframe.src setter on popups — catches the popup+iframe pattern
  ========================================================= */
  (function _wrapWindowOpen() {
    const _origOpen = window.open;
    window.open = function(url, name, features) {
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes(location.hostname)) {
        _createTab(url);
        return null;
      }
      return _origOpen.apply(this, arguments);
    };
  })();

  (function _wrapIframeSrc() {
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
      if (!desc || !desc.set) return;
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        set: function(val) {
          if (typeof val === 'string' && val && !val.startsWith('about:') && !val.startsWith('javascript:')) {
            try {
              var doc = this.ownerDocument;
              var win = doc ? doc.defaultView : null;
              if (win && win !== window && win.opener === window) {
                _createTab(val);
                return;
              }
            } catch(e) {}
          }
          desc.set.call(this, val);
        },
        get: function() { return desc.get.call(this); },
        configurable: true,
        enumerable: true,
      });
    } catch(e) {}
  })();

  /* =========================================================
     INTERCEPT HUBS — route LimitedTime / Web clicks through /px
  ========================================================= */
  function _interceptHubClicks() {
    document.addEventListener('click', e => {
      try {
        // Capture clicks on Visit Site buttons and Web hub cards
        const btn = e.target.closest('button, [class*="cursor-pointer"]');
        if (!btn) return;

        // Must be inside Limited Time or Web hub
        const container = btn.closest('[class*="max-w-4xl"], [class*="max-w-6xl"]');
        if (!container) return;

        const h1 = container.querySelector('h1');
        const isLimited = h1 && h1.textContent.includes('Limited Time');
        const isWeb = h1 && h1.textContent.trim() === 'Web';
        if (!isLimited && !isWeb) return;

        e.preventDefault();
        e.stopPropagation();

        if (isLimited) {
          const visitBtn = btn.closest('button');
          if (!visitBtn || !visitBtn.textContent.includes('Visit Site')) return;
          // Find the parent card which has the URL in its React scope
          const card = visitBtn.closest('[class*="rounded-xl"]');
          if (!card) return;
          // The URL is stored on the onclick of the button — can't access it from outside.
          // Instead, look for a nearby div with the URL in a data attribute or text
          // Fallback: just open duckduckgo — actually, scan card for url patterns in text
          const cardText = card.textContent || '';
          const urlMatch = cardText.match(/https?:\/\/[^\s]+/);
          if (urlMatch) { _createTab(urlMatch[0]); return; }
          // Last resort — open a new tab for the card's h3 text as search
          const h3 = card.querySelector('h3');
          if (h3) { _createTab('https://duckduckgo.com/?q=' + encodeURIComponent(h3.textContent)); }
        }

        if (isWeb) {
          // Intercept card clicks (they open via window.open or the b() popup)
          const card = btn.closest('[class*="rounded-xl"]');
          if (!card) return;
          const cardText = card.textContent || '';
          // Skip proxy1/proxy2 direct links (those should open normally)
          if (cardText.includes('proxy1') || cardText.includes('proxy2')) return;
          // Find URL in card text
          const urlMatch = cardText.match(/https?:\/\/[^\s]+/);
          if (urlMatch) { _createTab(urlMatch[0]); return; }
        }
      } catch(err) {}
    }, true);
  }

  // ── Autocomplete suggestions ──────────────────────────────
  let _acTimer = null;
  let _acAbort = null;

  function _buildSuggestionsDropdown(inp, container) {
    let dd = document.getElementById('fas-pb-dd');
    if (!dd) {
      dd = document.createElement('div');
      dd.id = 'fas-pb-dd';
      dd.style.cssText = [
        'position:absolute;top:100%;left:0;right:0;margin-top:4px;',
        'background:#161b22;border:1px solid rgba(255,255,255,0.1);',
        'border-radius:10px;overflow:hidden;z-index:2147483647;',
        'box-shadow:0 8px 32px rgba(0,0,0,0.5);display:none;',
      ].join('');
      container.style.position = 'relative';
      container.appendChild(dd);
    }
    return dd;
  }

  async function _fetchSuggestions(q) {
    try {
      if (_acAbort) _acAbort.abort();
      _acAbort = new AbortController();
      const r = await fetch('/suggestions?q=' + encodeURIComponent(q), { signal: _acAbort.signal });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data.slice(0, 7) : [];
    } catch(e) { return []; }
  }

  function _showSuggestions(dd, suggestions, inp, bar) {
    dd.innerHTML = '';
    if (!suggestions.length) { dd.style.display = 'none'; return; }
    suggestions.forEach(s => {
      const item = document.createElement('div');
      item.style.cssText = [
        'display:flex;align-items:center;gap:8px;padding:8px 12px;',
        'cursor:pointer;font-size:12px;color:#e8e9f0;',
        'transition:background .1s;border-bottom:1px solid rgba(255,255,255,0.04);',
      ].join('');
      item.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s}</span>`;
      item.onmouseover = () => item.style.background = 'rgba(229,57,53,0.1)';
      item.onmouseout  = () => item.style.background = '';
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        inp.value = s;
        dd.style.display = 'none';
        const mode = (document.getElementById('fas-proxy-mode')||{}).value || gs('fas_proxy_mode', 'overlay');
        launchProxyBar(s, mode);
      });
      dd.appendChild(item);
    });
    dd.style.display = 'block';
  }

  function _doInjectProxyBar() {
    if (document.getElementById('fas-proxy-bar')) return true;
    _proxyBarInjected = false;

    // Find header by tag name
    const header = document.querySelector('header');
    if (!header) return false;

    // Find the marquee wrapper by iterating children for overflow-hidden
    let wrapper = null;
    for (const child of header.children) {
      if (child.className && child.className.includes('overflow-hidden')) {
        wrapper = child;
        break;
      }
    }
    if (!wrapper) return false;

    _proxyBarInjected = true;
    wrapper.innerHTML = '';

    // Force visibility — override Tailwind's 'hidden lg:flex' on all viewports
    wrapper.style.setProperty('display', 'flex', 'important');
    wrapper.style.setProperty('opacity', '1', 'important');
    wrapper.style.setProperty('visibility', 'visible', 'important');

    const savedMode = gs('fas_proxy_mode', 'overlay');

    const bar = document.createElement('form');
    bar.id = 'fas-proxy-bar';
    bar.style.cssText = 'display:flex;align-items:center;width:100%;height:32px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:0 4px 0 10px;gap:4px;transition:border-color .2s;box-sizing:border-box;';

    bar.innerHTML = [
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      '<input id="fas-proxy-input" type="text" placeholder="Search or enter URL..." autocomplete="off" spellcheck="false" style="flex:1;background:none;border:none;outline:none;color:#e8e9f0;font-size:12px;font-family:inherit;min-width:0;caret-color:#e53935;">',
      '<select id="fas-proxy-mode" style="background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:2px 4px;font-size:9px;cursor:pointer;flex-shrink:0;outline:none;">',
        '<option value="overlay"' + (savedMode==='overlay'?' selected':'') + '>Overlay</option>',
        '<option value="direct"' + (savedMode==='direct'?' selected':'') + '>Direct</option>',
        '<option value="newtab"' + (savedMode==='newtab'?' selected':'') + '>New Tab</option>',
        '<option value="proxy1"' + (savedMode==='proxy1'?' selected':'') + '>Proxy 1</option>',
        '<option value="proxy2"' + (savedMode==='proxy2'?' selected':'') + '>Proxy 2</option>',
      '</select>',
      '<button type="submit" style="background:#e53935;border:none;color:#fff;border-radius:16px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;letter-spacing:.2px;transition:opacity .15s;" onmouseover="this.style.opacity=\'.8\'" onmouseout="this.style.opacity=\'1\'">Go</button>',
    ].join('');

    const inp = bar.querySelector('#fas-proxy-input');
    const dd = _buildSuggestionsDropdown(inp, wrapper);

    inp.addEventListener('focus', () => bar.style.borderColor = 'rgba(229,57,53,0.7)');
    inp.addEventListener('blur', () => {
      bar.style.borderColor = 'rgba(255,255,255,0.1)';
      setTimeout(() => { dd.style.display = 'none'; }, 200);
    });
    bar.onmouseover = () => { if (document.activeElement !== inp) bar.style.borderColor = 'rgba(229,57,53,0.4)'; };
    bar.onmouseout  = () => { if (document.activeElement !== inp) bar.style.borderColor = 'rgba(255,255,255,0.1)'; };

    inp.addEventListener('input', () => {
      const q = inp.value.trim();
      clearTimeout(_acTimer);
      if (q.length < 2) { dd.style.display = 'none'; return; }
      _acTimer = setTimeout(async () => {
        const suggestions = await _fetchSuggestions(q);
        _showSuggestions(dd, suggestions, inp, bar);
      }, 250);
    });

    inp.addEventListener('keydown', e => {
      if (e.key === 'Escape') { dd.style.display = 'none'; inp.blur(); }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = dd.querySelectorAll('div');
        if (items.length) items[0].focus();
      }
    });

    const modeSel = bar.querySelector('#fas-proxy-mode');
    modeSel.addEventListener('change', () => ss('fas_proxy_mode', modeSel.value));

    bar.addEventListener('submit', e => {
      e.preventDefault();
      e.stopPropagation();
      dd.style.display = 'none';
      const q = inp.value.trim();
      if (!q) return;
      launchProxyBar(q, modeSel.value);
    });

    wrapper.appendChild(bar);
    buildProxyOverlay();
  }

  /* =========================================================
     MUTATION OBSERVER  (Settings + Profile Modal injection)
     Debounced for performance.
  ========================================================= */
  let _moTimer = null;
  let _callTimer = null;

  const mo = new MutationObserver(muts => {
    let hadRemovals = false;

    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        try { tryInjectSettings(n); } catch(e) {}
        try { tryInjectProfileModal(n); } catch(e) {}
        // Try admin injection on every added node — the h1 may appear in any
        // subtree. _injectAdminCss() inside is idempotent so calling it
        // repeatedly (CSS already present) is a no-op.
        try { tryInjectAdmin(n); } catch(e) {}
      }
      if (m.removedNodes.length) hadRemovals = true;
    }

    // If nodes were removed, check whether the admin panel h1 has left the DOM
    // OR if our injected tools card was removed (e.g., by React re-render).
    // Both conditions reset the flag so the next mutation triggers a fresh injection.
    try {
      if (hadRemovals && window.__fas_adminInjected) {
        const stillThere = !!document.querySelector('h1') &&
          [...document.querySelectorAll('h1')].some(h => h.textContent.trim() === 'Admin Panel');
        const toolsGone = !document.getElementById('fas-admin-tools');
        if (!stillThere || toolsGone) {
          if (!stillThere) _removeAdminCss();
          window.__fas_adminInjected = false;
        }
      }
    } catch(e) {}

    // Also do a quick full-body CSS check on every mutation — handles the case
    // where the admin panel h1 was already in the DOM before this observer fired
    // (e.g., a parent wrapper was added, not the h1 itself).
    try { tryInjectAdmin(document.body); } catch(e) {}

    clearTimeout(_moTimer);
    _moTimer = setTimeout(() => {
      tryInjectHomepage();
      fixGameIframes();
      _doInjectProxyBar();
      _injectBlackMarketNav();
    }, 200);

    // Patch user cards whenever the DOM changes (debounced)
    scheduleUserCardPatch();

    clearTimeout(_callTimer);
    _callTimer = setTimeout(checkCallState, 400);
  });

  /* =========================================================
     ADMIN PAGE OVERLAY GUARD
     Clears every inject.js overlay the instant the user lands on
     the admin route — handles direct URL load, hash navigation,
     and SPA pushState/replaceState transitions.
  ========================================================= */
  function _clearAdminOverlays() {
    if (!_isAdminUrl()) return;

    // Inject CSS override immediately so Framer Motion can never hide the panel
    _injectAdminCss();

    // Remove maintenance overlay
    const maint = document.getElementById('fas-maint-overlay');
    if (maint) maint.remove();

    // Hide proxy overlay and reset its state
    const pov = document.getElementById('fas-pov');
    if (pov && pov.style.display !== 'none') {
      pov.style.display = 'none';
      const fr = document.getElementById('fas-pov-frame');
      if (fr) fr.src = 'about:blank';
      _clearProxyState();
    }

    // Hide search overlay
    const so = document.getElementById('fas-search-overlay');
    if (so) so.style.display = 'none';
  }

  // ── CSS-based admin panel visibility override ─────────────────────────────
  // Framer Motion sets inline `opacity: 0` (no !important) on its motion.div.
  // A <style> tag with `opacity: 1 !important` beats inline styles without
  // !important — this is the ONLY reliable way to prevent the black-screen
  // because Framer Motion overwrites JS-set inline styles on every animation
  // frame.  The rule targets the exact Tailwind class combo of the admin card.
  //
  // On non-admin pages the style tag is absent, so no other elements are
  // affected.  When the React component remounts (new DOM node, same classes)
  // the CSS rule still applies automatically — no element-reference bookkeeping.
  const _ADMIN_CSS_ID = 'fas-admin-vis-override';
  const _ADMIN_CSS_RULE = `
    /* Prevent Framer Motion from keeping the admin card invisible */
    .backdrop-blur-xl.rounded-2xl,
    [class*="backdrop-blur"][class*="rounded-2xl"] {
      opacity: 1 !important;
      transform: translateY(0) !important;
      visibility: visible !important;
    }
  `;

  function _injectAdminCss() {
    if (document.getElementById(_ADMIN_CSS_ID)) return;
    const s = document.createElement('style');
    s.id = _ADMIN_CSS_ID;
    // Only force opacity — never transform/visibility which can break React
    // animations and cause a frozen blue screen if the wrong element is targeted.
    s.textContent = `
      .backdrop-blur-xl.rounded-2xl,
      [class*="backdrop-blur"][class*="rounded-2xl"] {
        opacity: 1 !important;
      }
    `;
    try { document.head.appendChild(s); } catch(e) {}
  }

  function _removeAdminCss() {
    const s = document.getElementById(_ADMIN_CSS_ID);
    if (s) s.remove();
  }

  // Intercept history API so SPA navigation is always detected
  (function _installNavGuard() {
    const _origPush    = history.pushState.bind(history);
    const _origReplace = history.replaceState.bind(history);

    function _onNav() {
      if (_isAdminUrl()) {
        _clearAdminOverlays();
        _injectAdminCss();
        // Reset injection flag so tryInjectAdmin re-runs fresh each admin visit
        window.__fas_adminInjected = false;
      } else {
        // Leaving admin — remove the CSS override so other pages animate normally
        _removeAdminCss();
      }
    }

    history.pushState = function() {
      _origPush.apply(history, arguments);
      setTimeout(_onNav, 50);
    };
    history.replaceState = function() {
      _origReplace.apply(history, arguments);
      setTimeout(_onNav, 50);
    };

    window.addEventListener('hashchange', () => setTimeout(_onNav, 50));
    window.addEventListener('popstate',   () => setTimeout(_onNav, 50));
  })();

  /* =========================================================
     INIT
  ========================================================= */
  function init() {
    buildSearchOverlay();
    buildPanel();
    buildBanDialog();
    checkMaintenanceMode();
    _clearAdminOverlays();           // run immediately on page load
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      tryInjectAdmin(document.body);
      tryInjectHomepage();
      fixGameIframes();
      _injectBlackMarketNav();
    }, 1500);

    // After users cache loads, patch the DOM immediately and run admin batch fix
    waitForFBFull(async () => {
      await loadUsersCache();
      patchUserCardsInDOM();
      // Admin-only: repair all bad player records in Firestore once per session
      adminBatchFixUsers().then(count => {
        if (count > 0) {
          // Reload cache and re-patch after fixes are written
          loadUsersCache().then(() => patchUserCardsInDOM());
        }
      });
    });

    // Poll for the navbar marquee and replace with proxy bar (React may render it late)
    let _pbPoll = 0;
    const _pbInterval = setInterval(() => {
      if (_doInjectProxyBar() || ++_pbPoll > 30) clearInterval(_pbInterval);
    }, 500);

    // Restore proxy overlay if user did a browser refresh (F5/Ctrl+R)
    // Never restore on admin pages — it causes a black screen over the panel
    const saved = _getSavedProxyState();
    if (saved && saved.url && !_isAdminUrl()) {
      // Wait for the page to fully render before reopening
      setTimeout(() => {
        _loadInOverlay(saved.url, true);
      }, 800);
    } else if (_isAdminUrl()) {
      // Clear stale proxy state when landing on admin so it never blocks the panel
      _clearProxyState();
    }

    console.log('[FasahatHub Extensions] ✓ Loaded v4');

    // Persist user info to localStorage immediately via basic auth wait
    waitForFBAuth(() => {
      try {
        const user = window.__FIREBASE_USER__ || window.__USER__;
        if (!user) return;
        const resolvedName  = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
        const resolvedPhoto = user.photoURL || '';
        localStorage.setItem('fas_uid',   user.uid || '');
        localStorage.setItem('fas_name',  resolvedName);
        localStorage.setItem('fas_photo', resolvedPhoto);
      } catch {}
    });

    // PATCH Firestore with correct name/photo — waits for ALL Firestore functions to be ready
    waitForFBFull(() => {
      try {
        const user = window.__FIREBASE_USER__ || window.__USER__;
        if (!user) return;
        const resolvedName  = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
        const resolvedPhoto = user.photoURL || '';

          window.fsGetDoc(window.fsDoc(window.db, 'players', user.uid)).then(snap => {
          const d = snap ? (snap.data() || {}) : {};
          var _exp = d.premiumExpiresAt;
          localStorage.setItem('fas_premium', d.premium && (!_exp || _exp > Date.now()) ? '1' : '0');

          const patch = {};
          // Always overwrite displayName if it looks like a UID or is missing
          const storedName = d.displayName || '';
          if (!storedName || looksLikeUid(storedName)) patch.displayName = resolvedName;
          // Overwrite photo if missing — also check alternative Firestore fields
          const storedPhoto = d.photoURL || d.photo || d.avatar || d.avatarUrl || d.profilePicture || d.picture || '';
          if (!d.photoURL && resolvedPhoto) {
            patch.photoURL = resolvedPhoto;
          } else if (!d.photoURL && storedPhoto) {
            patch.photoURL = storedPhoto;
          }
          // Set joinedAt on first join only
          if (!d.joinedAt) patch.joinedAt = Date.now();

          if (Object.keys(patch).length) {
            window.fsSetDoc(window.fsDoc(window.db, 'players', user.uid), patch, { merge: true })
              .then(() => {
                // Bust the users cache so the corrected name is seen immediately
                window.__fas_usersCache = null;
                _usersCachePromise = null;
                // Re-run DOM patcher with fresh cache
                loadUsersCache().then(() => patchUserCardsInDOM());
              })
              .catch(() => {});
          }
        }).catch(() => {});
      } catch {}
    });

    // BACKFILL: fix posts in Firestore that have a UID stored as authorName.
    // This corrects old posts in the React feed without touching anything else.
    // Runs once per session; skipped if already done this session.
    waitForFBFull(async () => {
      if (window.__fas_postBackfillDone) return;
      window.__fas_postBackfillDone = true;
      try {
        const user = window.__FIREBASE_USER__ || window.__USER__;
        if (!user) return;
        const isAdmin = user.email && user.email.toLowerCase() === 'fasahatalhasan@gmail.com';

        // Load players cache so we have correct name/photo for every uid
        await loadUsersCache();
        const cache = window.__fas_usersCache || {};

        // Fetch posts — admin fetches all, regular user fetches only their own
        let postsSnap;
        if (isAdmin) {
          postsSnap = await window.fsGetDocs(window.fsCollection(window.db, 'posts'));
        } else {
          postsSnap = await window.fsGetDocs(
            window.fsQuery(window.fsCollection(window.db, 'posts'),
              window.fsWhere('authorUid', '==', user.uid))
          );
        }

        const updates = [];
        postsSnap.forEach(docSnap => {
          const d = docSnap.data() || {};
          const authorUid = d.authorUid;
          if (!authorUid) return;

          // Check if the post's name fields look like a UID (wrong stored value)
          // Posts may use authorName or author — patch both to be safe
          const postName  = d.authorName || d.author || '';
          const postPhoto = d.authorPhoto || '';
          const needsNameFix  = !postName || looksLikeUid(postName);
          const needsPhotoFix = !postPhoto;

          if (!needsNameFix && !needsPhotoFix) return;

          // Look up correct data from players cache
          const player = cache[authorUid];
          if (!player) return;

          const fix = {};
          if (needsNameFix && player.displayName) {
            // Patch both field variants so whichever the React app reads, it gets the correct name
            fix.authorName = player.displayName;
            fix.author     = player.displayName;
          }
          if (needsPhotoFix && player.photoURL) fix.authorPhoto = player.photoURL;
          if (!Object.keys(fix).length) return;

          updates.push(
            window.fsSetDoc(window.fsDoc(window.db, 'posts', docSnap.id), fix, { merge: true })
              .catch(() => {})
          );
        });

        await Promise.all(updates);
      } catch {}
    });
  }

  // Watchdog: re-inject Black Market nav & proxy bar every 1.5s
  // (React SPA navigation may re-render and remove our injected elements)
  // NOTE: tryInjectAdmin is NOT called here — it's disabled for crash isolation
  // Skip on admin pages to avoid interfering with React-managed DOM
  setInterval(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    try { _injectBlackMarketNav(); } catch(e) {}
    try { _doInjectProxyBar(); } catch(e) {}
  }, 1500);

  // Periodic badge re-injection (every 5s) to handle React re-renders that
  // remove our injected badges. The cache must be populated for this to work.
  setInterval(() => {
    try { scheduleUserCardPatch(); } catch(e) {}
  }, 5000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 150);
})();

/* ================================================================
   FasahatHub — Security & Bug-Fix Patch
   1. Right-click protection (home / web / movie / anime / manga)
      → shows "Access Denied" toast + red screen shake (0.5 s)
   2. Auth state reset: sign-out → sign-in forces a page reload
      so the admin panel never shows stale data
   3. Loading-state fix: if Firebase auth never resolves in 8 s,
      fire a synthetic "auth-changed" event so the React app
      exits its infinite-loading loop
================================================================ */
(function () {
  'use strict';

  /* ── 1. RIGHT-CLICK PROTECTION ── */

  var _rcStyle = document.createElement('style');
  _rcStyle.textContent = [
    '@keyframes fasShake{',
    '  0%{transform:translate(0,0) rotate(0)}',
    ' 10%{transform:translate(-8px,0) rotate(-1deg)}',
    ' 20%{transform:translate(8px,0) rotate(1deg)}',
    ' 30%{transform:translate(-8px,0) rotate(-1deg)}',
    ' 40%{transform:translate(8px,0) rotate(1deg)}',
    ' 50%{transform:translate(-4px,0) rotate(0)}',
    ' 60%{transform:translate(4px,0) rotate(0)}',
    ' 70%{transform:translate(-2px,0) rotate(0)}',
    ' 80%{transform:translate(2px,0) rotate(0)}',
    '100%{transform:translate(0,0) rotate(0)}',
    '}',
    '#fas-denied-flash{',
    '  position:fixed;inset:0;z-index:9999990;',
    '  background:rgba(220,0,0,0.30);',
    '  pointer-events:none;',
    '  transition:opacity 0.5s ease;',
    '}',
    '#fas-denied-msg{',
    '  position:fixed;top:50%;left:50%;',
    '  transform:translate(-50%,-50%);',
    '  z-index:9999999;',
    '  background:rgba(0,0,0,0.92);',
    '  border:2px solid rgba(220,0,0,0.85);',
    '  border-radius:16px;',
    '  padding:18px 48px;',
    '  font-family:Inter,sans-serif;',
    '  font-size:17px;font-weight:800;',
    '  color:#ff4444;',
    '  letter-spacing:2px;',
    '  text-transform:uppercase;',
    '  box-shadow:0 0 50px rgba(255,0,0,0.45);',
    '  pointer-events:none;',
    '  transition:opacity 0.35s ease;',
    '}',
    '.fas-shaking{animation:fasShake 0.5s ease-out!important;}',
  ].join('');
  document.head.appendChild(_rcStyle);

  function _showAccessDenied() {
    var existing = document.getElementById('fas-denied-msg');
    if (existing) return;

    var flash = document.createElement('div');
    flash.id = 'fas-denied-flash';
    document.body.appendChild(flash);

    var msg = document.createElement('div');
    msg.id = 'fas-denied-msg';
    msg.textContent = '⛔  Access Denied';
    document.body.appendChild(msg);

    document.body.classList.add('fas-shaking');

    setTimeout(function () {
      flash.style.opacity = '0';
      msg.style.opacity = '0';
      document.body.classList.remove('fas-shaking');
      setTimeout(function () {
        try { flash.remove(); } catch (e) {}
        try { msg.remove(); } catch (e) {}
      }, 380);
    }, 900);
  }

  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    e.stopPropagation();
    _showAccessDenied();
    return false;
  }, true);

  /* ── 2. AUTH STATE RESET (sign-out → sign-in forces reload) ── */

  var _authPrev = undefined;
  var _authWasSignedIn = false;

  var _authWatcher = setInterval(function () {
    var cur = window.__FIREBASE_USER__;
    if (cur === undefined) return;

    if (_authPrev === undefined) {
      _authPrev = cur;
      _authWasSignedIn = !!cur;
      return;
    }

    if (_authWasSignedIn && !cur) {
      _authWasSignedIn = false;
      try {
        localStorage.removeItem('fh_user_roles');
        localStorage.removeItem('fh_banned_users');
        localStorage.removeItem('fas_premium');
      } catch (e) {}
    }

    if (!_authWasSignedIn && cur && _authPrev !== undefined) {
      clearInterval(_authWatcher);
      window.location.reload();
      return;
    }

    _authPrev = cur;
    _authWasSignedIn = !!cur;
  }, 600);

  /* ── 3. LOADING-STATE FIX ── */

  setTimeout(function () {
    if (window.__FIREBASE_USER__ === undefined) {
      window.__FIREBASE_USER__ = null;
      try {
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: null }));
      } catch (e) {}
    }
  }, 8000);

  /* =========================================================
     GAME PROGRESS SAVING
     When signed in, syncs favorites + last-played + play time
     to Firestore players/{uid} so progress is never lost.
     Play time is saved every 10 seconds while a game is open.
  ========================================================= */
  (function () {
    var _gpDebTimer = null;
    var _gpPlayStart = null;
    var _gpCurGame = null;
    var _gpAutoSaveTimer = null;  // 10-second interval handle
    var _gpStoredTotal = 0;       // seconds in Firestore at game-open time
    var _gpAccumulated = 0;       // seconds added this session (not yet persisted)
    var _gpLastSaveTs = 0;        // Date.now() of the last flush

    function _gpUser() { return window.__FIREBASE_USER__ || window.__USER__ || null; }

    function _gpFbReady() {
      return !!(window.db && window.fsSetDoc && window.fsDoc && window.fsGetDoc);
    }

    // ── localStorage helpers for offline game save ─────────
    function _gpLocalSave(game, totalSeconds) {
      try {
        var existing = {};
        try { existing = JSON.parse(localStorage.getItem('fas_game_playtime') || '{}'); } catch(e) {}
        var fk = _gpFieldKey(game.url);
        existing[fk] = { title: game.title, url: game.url, seconds: totalSeconds, updated: Date.now() };
        localStorage.setItem('fas_game_playtime', JSON.stringify(existing));
      } catch(e) {}
    }

    function _gpLocalSaveLastPlayed(game) {
      try {
        localStorage.setItem('fas_last_played_game', JSON.stringify({ title: game.title, url: game.url, timestamp: Date.now() }));
      } catch(e) {}
    }

    // ── Debounced favorites write ──────────────────────────
    function _gpSaveFavs(favsArray) {
      var user = _gpUser();
      if (!user || !user.uid || !_gpFbReady()) return;
      clearTimeout(_gpDebTimer);
      _gpDebTimer = setTimeout(function () {
        try {
          window.fsSetDoc(
            window.fsDoc(window.db, 'players', user.uid),
            { gameFavorites: favsArray },
            { merge: true }
          );
        } catch (e) {}
      }, 1500);
    }

    // ── Load favorites from Firestore and merge with local ─
    function _gpLoadFavs() {
      var user = _gpUser();
      if (!user || !user.uid || !_gpFbReady()) return;
      window.fsGetDoc(window.fsDoc(window.db, 'players', user.uid))
        .then(function (doc) {
          if (!doc.exists()) return;
          var remote = (doc.data() || {}).gameFavorites;
          if (!Array.isArray(remote) || !remote.length) return;
          var local = [];
          try { local = JSON.parse(localStorage.getItem('fas_favorites') || '[]'); } catch {}
          if (!Array.isArray(local)) local = [];
          var merged = Array.from(new Set(remote.concat(local)));
          // Only update if different — avoids infinite loop
          if (JSON.stringify(merged) !== JSON.stringify(local)) {
            try {
              // Write directly without triggering our interceptor again
              Object.getPrototypeOf(localStorage).setItem.call(localStorage, 'fas_favorites', JSON.stringify(merged));
              window.dispatchEvent(new StorageEvent('storage', { key: 'fas_favorites', newValue: JSON.stringify(merged) }));
            } catch (e) {}
          }
        })
        .catch(function () {});
    }

    // ── Intercept localStorage.setItem to catch favorites ─
    var _origLSSet = Object.getPrototypeOf(localStorage).setItem;
    try {
      var _hooked = false;
      Object.defineProperty(localStorage, 'setItem', {
        configurable: true,
        enumerable: false,
        value: function (key, value) {
          _origLSSet.call(localStorage, key, value);
          if (key === 'fas_favorites' && !_hooked) {
            var user = _gpUser();
            if (user && user.uid) {
              try { _gpSaveFavs(JSON.parse(value)); } catch {}
            }
          }
        }
      });
    } catch (e) {}

    // ── Safe Firestore field key from URL ─────────────────
    function _gpFieldKey(url) {
      return (url || 'unknown').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
    }

    // ── Write accumulated play time to Firestore + localStorage ───
    function _gpFlushTime() {
      if (!_gpCurGame) return;
      var total = _gpStoredTotal + _gpAccumulated;
      if (total < 1) return;

      // Always save to localStorage (works without Firebase)
      _gpLocalSave(_gpCurGame, total);

      // Also save to Firestore if available
      if (!_gpFbReady()) return;
      var user = _gpUser();
      if (!user || !user.uid) return;
      var fk = _gpFieldKey(_gpCurGame.url);
      var update = { gamePlayTime: {} };
      update.gamePlayTime[fk] = total;
      try {
        window.fsSetDoc(
          window.fsDoc(window.db, 'players', user.uid),
          update,
          { merge: true }
        );
      } catch (e) {}
    }

    // ── Record a game opening ──────────────────────────────
    function _gpOnGameOpen(iframe) {
      var src = iframe.src || '';
      var hasSrcdoc = !!(iframe.srcdoc && iframe.srcdoc.length > 200);
      if (!src && !hasSrcdoc) return;
      if (src === 'about:blank') return;
      // Skip the proxy/overlay iframes (not game iframes)
      if (iframe.id && (iframe.id.startsWith('fas-pov-') || iframe.id === 'proxy-frame' || iframe.id === 'proxy-iframe' || iframe.id === 'fas-ov-frame' || iframe.id === 'fas-main-overlay')) return;

      // Ignore if a game is already tracked (avoid duplicates)
      if (_gpCurGame) return;

      // Try to grab the game title from nearby heading
      var title = '';
      try {
        var container = iframe.closest('[role="dialog"]') || iframe.parentElement;
        for (var depth = 0; depth < 5 && container; depth++) {
          var heading = container.querySelector('h1,h2,h3');
          if (heading) { title = heading.textContent.trim(); break; }
          container = container.parentElement;
        }
      } catch (e) {}
      if (!title && src) {
        try {
          var parts = new URL(src).pathname.split('/').filter(Boolean);
          title = (parts[parts.length - 1] || parts[0] || 'Game').replace(/[._-]+/g, ' ').replace(/\.html?$/i, '');
        } catch (e) {}
      }
      if (!title) title = 'Game';

      _gpCurGame = { title: title, url: src || 'srcdoc', ts: Date.now() };
      _gpPlayStart = Date.now();
      _gpLastSaveTs = Date.now();
      _gpAccumulated = 0;
      _gpStoredTotal = 0;

      // Always save last-played to localStorage immediately
      _gpLocalSaveLastPlayed(_gpCurGame);

      // Load stored total from localStorage as a fallback base
      try {
        var lsData = JSON.parse(localStorage.getItem('fas_game_playtime') || '{}');
        var lsFk = _gpFieldKey(_gpCurGame.url);
        _gpStoredTotal = Number((lsData[lsFk] || {}).seconds || 0);
      } catch(e) {}

      var user = _gpUser();
      if (user && user.uid && _gpFbReady()) {
        // Save last-played game to Firestore
        try {
          window.fsSetDoc(
            window.fsDoc(window.db, 'players', user.uid),
            { lastPlayedGame: { title: title, url: _gpCurGame.url, timestamp: Date.now() } },
            { merge: true }
          );
        } catch (e) {}
        // Load the stored play-time total from Firestore (may be higher than localStorage)
        var fk = _gpFieldKey(_gpCurGame.url);
        window.fsGetDoc(window.fsDoc(window.db, 'players', user.uid))
          .then(function (doc) {
            if (doc.exists()) {
              var fbTotal = Number(((doc.data() || {}).gamePlayTime || {})[fk] || 0);
              // Use the higher of the two (localStorage vs Firestore)
              if (fbTotal > _gpStoredTotal) _gpStoredTotal = fbTotal;
            }
          })
          .catch(function () {});
      }

      // ── 10-second autosave interval ────────────────────
      clearInterval(_gpAutoSaveTimer);
      _gpAutoSaveTimer = setInterval(function () {
        if (!_gpCurGame) { clearInterval(_gpAutoSaveTimer); return; }
        var now = Date.now();
        var delta = Math.round((now - _gpLastSaveTs) / 1000);
        _gpLastSaveTs = now;
        if (delta > 0) {
          _gpAccumulated += delta;
          _gpFlushTime();
        }
      }, 10000);
    }

    // ── Record play time when game iframe disappears ───────
    function _gpOnGameClose() {
      if (!_gpCurGame) return;

      // Stop the autosave interval
      clearInterval(_gpAutoSaveTimer);
      _gpAutoSaveTimer = null;

      // Flush any remaining seconds since the last 10s tick
      var remaining = Math.round((Date.now() - _gpLastSaveTs) / 1000);
      if (remaining > 0) _gpAccumulated += remaining;

      if (_gpAccumulated >= 5) _gpFlushTime(); // ignore <5s sessions

      _gpPlayStart = null;
      _gpCurGame = null;
      _gpAccumulated = 0;
      _gpStoredTotal = 0;
      _gpLastSaveTs = 0;
    }

    // ── MutationObserver: detect game iframes ──────────────
    var _gpMO = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType !== 1) continue;
          var frames = n.tagName === 'IFRAME' ? [n] : Array.from(n.querySelectorAll('iframe'));
          frames.forEach(function (f) { _gpOnGameOpen(f); });
        }
        for (var j = 0; j < m.removedNodes.length; j++) {
          var n = m.removedNodes[j];
          if (n.nodeType !== 1) continue;
          var hadFrame = n.tagName === 'IFRAME' || n.querySelector('iframe');
          if (hadFrame) _gpOnGameClose();
        }
      }
    });
    _gpMO.observe(document.body, { childList: true, subtree: true });

    // ── Load favorites once Firebase + auth are ready ──────
    function _gpInit() {
      if (!_gpFbReady()) {
        var _t = setInterval(function () {
          if (_gpFbReady()) { clearInterval(_t); _gpInit(); }
        }, 600);
        return;
      }
      var user = _gpUser();
      if (user && user.uid) { _gpLoadFavs(); return; }
      // Wait for auth to resolve
      var _authPoll = setInterval(function () {
        if (window.__FIREBASE_USER__ !== undefined) {
          clearInterval(_authPoll);
          var u = _gpUser();
          if (u && u.uid) _gpLoadFavs();
        }
      }, 600);
      setTimeout(function () { clearInterval(_authPoll); }, 20000);
    }

    _gpInit();
  })();

})();


