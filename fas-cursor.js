/* ================================================================
   FAS ANIMATED CURSOR
   Base style: Fire (everyone). Premium users can switch to Electric,
   Water or Devil from Settings → Premium Customization.
   Uses the cursor artwork in /assets/cursor plus a particle trail.
================================================================ */
(function () {
  'use strict';
  if (window.__fasCursorLoaded) return;
  window.__fasCursorLoaded = true;

  var mq = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  if (!mq || !mq.matches) return;

  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  var root = document.documentElement;
  var KEY = 'fas_cursor_style';
  var STYLES = ['fire', 'electric', 'water', 'devil'];
  var IMGS = {
    fire: '/assets/cursor/fire.png',
    electric: '/assets/cursor/electric.png',
    water: '/assets/cursor/water.png',
    devil: '/assets/cursor/devil.png'
  };
  var THEMES = {
    fire: {
      glow: '#ff8a1e',
      ring: '250, 204, 21',
      tones: [[255, 244, 184], [255, 176, 32], [255, 77, 0], [190, 18, 60]]
    },
    electric: {
      glow: '#a855f7',
      ring: '168, 85, 247',
      tones: [[245, 243, 255], [196, 181, 253], [139, 92, 246], [79, 70, 229]]
    },
    water: {
      glow: '#38bdf8',
      ring: '56, 189, 248',
      tones: [[236, 254, 255], [125, 211, 252], [56, 189, 248], [2, 132, 199]]
    },
    devil: {
      glow: '#ef4444',
      ring: '239, 68, 68',
      tones: [[255, 228, 230], [248, 113, 113], [220, 38, 38], [127, 29, 29]]
    }
  };

  var core = null, coreImg = null, ring = null, canvas = null, ctx = null, layer = null;
  var W = 0, H = 0, DPR = 1;
  var x = -300, y = -300, rx = -300, ry = -300;
  var velX = 0, velY = 0, speed = 0, lastMove = 0;
  var hot = false, down = false, overText = false, overFrame = false;
  var activated = false, visible = false, pageHidden = false;
  var scale = 1, spawnCarry = 0;
  var cursorHost = null;
  var parts = [], arcs = [], ripples = [];
  var current = 'fire', savedChoice = 'fire';
  var manualChoice = false;
  var prevTime = 0;
  var TAU = Math.PI * 2;

  /* ---------- theme / storage ---------- */

  function readChoice() {
    try {
      var v = localStorage.getItem(KEY);
      if (STYLES.indexOf(v) !== -1) return v;
    } catch (_) {}
    return 'fire';
  }

  function isPremiumUser() {
    try {
      var u = window.__FIREBASE_USER__ || window.__USER__;
      if (!u || !u.uid) return false;
      if (u.email && u.email.toLowerCase() === 'fasahatalhasan@gmail.com') return true;
      var roles = {};
      try { roles = JSON.parse(localStorage.getItem('fh_user_roles') || '{}') || {}; } catch (_) {}
      if (Object.prototype.hasOwnProperty.call(roles, u.uid)) {
        var r = roles[u.uid];
        return r === 'premium' || r === 'admin';
      }
      if (localStorage.getItem('fas_premium') === '1') return true;
    } catch (_) {}
    return false;
  }

  function setTheme(style, persist) {
    if (STYLES.indexOf(style) === -1) style = 'fire';
    var changed = style !== current;
    current = style;
    var t = THEMES[style];
    root.style.setProperty('--fcc-glow', t.glow);
    root.style.setProperty('--fcc-ring', t.ring);
    root.style.setProperty('--fcc-cursor', 'url("' + IMGS[style] + '") 8 8');
    if (coreImg) {
      if (changed || !coreImg.getAttribute('src')) coreImg.src = IMGS[style];
      coreImg.style.filter = 'drop-shadow(0 0 3px ' + t.glow + ') drop-shadow(0 0 10px ' + t.glow + ')';
    }
    if (changed) {
      parts.length = 0;
      arcs.length = 0;
      ripples.length = 0;
      spawnCarry = 0;
    }
    if (persist) {
      savedChoice = style;
      try { localStorage.setItem(KEY, style); } catch (_) {}
    }
  }

  function syncRole() {
    if (manualChoice) return;
    var target = isPremiumUser() ? savedChoice : 'fire';
    if (target !== current) setTheme(target, false);
  }

  /* ---------- DOM / chrome ---------- */

  function injectCss() {
    var st = document.createElement('style');
    st.id = 'fas-cursor-style';
    st.textContent =
      'html.fas-cursor-on,html.fas-cursor-on body,html.fas-cursor-on *,' +
      'html.fas-cursor-on *::before,html.fas-cursor-on *::after{cursor:none !important}' +
      'html.fas-cursor-on input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="range"]):not([type="color"]),' +
      'html.fas-cursor-on textarea,html.fas-cursor-on [contenteditable="true"],html.fas-cursor-on [contenteditable=""]{cursor:text !important}' +
      'html.fas-cursor-on iframe{cursor:auto !important}' +
      '#fas-cursor-layer{position:fixed;left:0;top:0;width:100%;height:100%;margin:0;padding:0;border:0;' +
      'background:transparent;max-width:none;max-height:none;overflow:visible;box-sizing:border-box;' +
      'pointer-events:none;z-index:2147483647!important;transform:translateZ(0);will-change:transform}' +
      '#fas-cursor-core{position:fixed;left:0;top:0;width:64px;height:64px;pointer-events:none;z-index:3;opacity:0;' +
      'transform-origin:8px 8px;transition:opacity .14s ease;will-change:transform}' +
      '#fas-cursor-core img{display:block;width:64px;height:64px;user-select:none;-webkit-user-select:none;-webkit-user-drag:none}' +
      '#fas-cursor-ring{position:fixed;left:0;top:0;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:9999px;' +
      'border:1.5px solid rgba(var(--fcc-ring),.82);box-shadow:0 0 14px rgba(var(--fcc-ring),.35),inset 0 0 10px rgba(var(--fcc-ring),.15);' +
      'pointer-events:none;z-index:2;opacity:0;transition:opacity .15s ease;will-change:transform}' +
      '#fas-cursor-fx{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:1}' +
      'html.fas-lightbox-open #fas-cursor-core{opacity:1!important}' +
      'html.fas-lightbox-open #fas-cursor-core img{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 9px #fff) drop-shadow(0 0 16px var(--fcc-glow))!important}' +
      'html.fas-lightbox-open #fas-cursor-ring{opacity:1!important;border-color:rgba(255,255,255,.92)!important;' +
      'box-shadow:0 0 0 1px rgba(0,0,0,.35),0 0 16px rgba(var(--fcc-ring),.65)!important}';
    document.head.appendChild(st);
  }

  function resize() {
    if (!canvas) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function buildDom() {
    if (core) return;
    layer = document.createElement('div');
    layer.id = 'fas-cursor-layer';
    layer.setAttribute('aria-hidden', 'true');
    /* Top-layer popover keeps the cursor above dialogs, image viewers and
       any other full-screen overlay, even if a browser mishandles the
       stacking of fixed elements with backdrop filters. */
    layer.setAttribute('popover', 'manual');

    core = document.createElement('div');
    core.id = 'fas-cursor-core';
    core.setAttribute('aria-hidden', 'true');
    coreImg = document.createElement('img');
    coreImg.alt = '';
    coreImg.draggable = false;
    core.appendChild(coreImg);

    ring = document.createElement('div');
    ring.id = 'fas-cursor-ring';
    ring.setAttribute('aria-hidden', 'true');

    canvas = document.createElement('canvas');
    canvas.id = 'fas-cursor-fx';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');

    layer.appendChild(canvas);
    layer.appendChild(ring);
    layer.appendChild(core);
    document.documentElement.appendChild(layer);

    resize();
    setTheme(current, false);
  }

  function keepOnTop() {
    if (!layer) return;
    if (layer.showPopover && layer.matches) {
      try {
        if (!layer.matches(':popover-open')) {
          layer.showPopover();
        }
        return;
      } catch (_) {}
    }
    if (cursorHost && !cursorHost.isConnected) cursorHost = null;
    var host = cursorHost || document.documentElement;
    if (layer.parentNode !== host || host.lastElementChild !== layer) {
      host.appendChild(layer);
    }
  }

  /* Called by full-screen overlays (image viewer, etc.) so the custom cursor
     is re-stacked inside their stacking context and stays clearly visible
     over photos. Pass the overlay element while it is open, then call with
     document.documentElement (or no argument after it closes) to restore. */
  window.__fasKeepCursorOnTop = function (host) {
    try {
      if (host && host.nodeType === 1 && host !== document.documentElement) {
        cursorHost = host;
      } else if (host === document.documentElement) {
        cursorHost = null;
      }
      keepOnTop();
      if (visible && core) core.style.opacity = '1';
      if (visible && ring) ring.style.opacity = '1';
    } catch (_) {}
  };
  window.__fasCursorRefresh = window.__fasKeepCursorOnTop;
  window.addEventListener('fas-cursor-refresh', function () {
    try { window.__fasKeepCursorOnTop(); } catch (_) {}
  });

  /* ---------- pointer ---------- */

  function updateHover(target) {
    var t = target && target.nodeType === 1 ? target : null;
    overText = !!(t && t.closest && t.closest(
      'input:not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="range"]):not([type="color"]),textarea,[contenteditable="true"],[contenteditable=""]'
    ));
    overFrame = !!(t && (t.tagName === 'IFRAME' || (t.closest && t.closest('iframe'))));
    hot = !overText && !overFrame && !!(t && t.closest && t.closest(
      'a,button,[role="button"],[role="link"],select,summary,label[for],.cursor-pointer,input[type="checkbox"],input[type="radio"],input[type="submit"],input[type="button"]'
    ));
  }

  function activate() {
    if (activated) return;
    activated = true;
    buildDom();
    keepOnTop();
    root.classList.add('fas-cursor-on');
    if (core) {
      core.style.transform = 'translate3d(' + (x - 8) + 'px,' + (y - 8) + 'px,0) scale(1)';
      core.style.opacity = (overText || overFrame) ? '0' : '1';
    }
    if (ring) {
      rx = x; ry = y;
      ring.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(1)';
    }
  }

  function onMove(e) {
    if (e.pointerType === 'touch') return;
    activate();
    if (e.buttons === 0) down = false;
    var dx = x < -100 ? 0 : e.clientX - x;
    var dy = y < -100 ? 0 : e.clientY - y;
    velX = velX * 0.5 + dx * 0.9;
    velY = velY * 0.5 + dy * 0.9;
    x = e.clientX;
    y = e.clientY;
    if (!visible) { rx = x; ry = y; }
    visible = true;
    lastMove = performance.now();
    updateHover(e.target);
  }

  function hide() {
    visible = false;
    down = false;
    if (core) core.style.opacity = '0';
    if (ring) ring.style.opacity = '0';
    parts.length = 0;
    arcs.length = 0;
    ripples.length = 0;
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  /* ---------- particles ---------- */

  function addFire() {
    parts.push({
      kind: 'fire',
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 26 - velX * 0.16,
      vy: -30 - Math.random() * 60 - Math.min(40, speed * 0.5),
      life: 0, max: 0.45 + Math.random() * 0.55,
      size: 2.2 + Math.random() * 4.4,
      seed: Math.random() * 6.283
    });
  }

  function addSpark() {
    parts.push({
      kind: 'spark',
      x: x + (Math.random() - 0.5) * 12,
      y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 160 - velX * 0.22,
      vy: (Math.random() - 0.5) * 160 - velY * 0.22,
      life: 0, max: 0.16 + Math.random() * 0.24,
      size: 1 + Math.random() * 1.8,
      seed: Math.random() * 6.283
    });
  }

  function addDrop() {
    parts.push({
      kind: 'drop',
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 34 - velX * 0.12,
      vy: (Math.random() - 0.5) * 34 - velY * 0.12 - 10,
      life: 0, max: 0.55 + Math.random() * 0.55,
      size: 1.6 + Math.random() * 2.8,
      seed: Math.random() * 6.283
    });
  }

  function addDevil() {
    if (Math.random() < 0.2) {
      parts.push({
        kind: 'spade',
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 18,
        vx: (Math.random() - 0.5) * 20 - velX * 0.08,
        vy: -16 - Math.random() * 24,
        life: 0, max: 0.7 + Math.random() * 0.7,
        size: 7 + Math.random() * 7,
        rot: Math.random() * 6.283,
        seed: Math.random() * 6.283
      });
    } else {
      parts.push({
        kind: 'ember',
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 9,
        vx: (Math.random() - 0.5) * 24 - velX * 0.13,
        vy: -20 - Math.random() * 46,
        life: 0, max: 0.6 + Math.random() * 0.7,
        size: 2 + Math.random() * 4.2,
        seed: Math.random() * 6.283
      });
    }
  }

  function makeArc() {
    var n = 5 + Math.floor(Math.random() * 4);
    var ang = Math.random() * TAU;
    var len = 18 + Math.random() * 46;
    var sx = x + Math.cos(ang) * 6;
    var sy = y + Math.sin(ang) * 6;
    var ex = x + Math.cos(ang) * len;
    var ey = y + Math.sin(ang) * len;
    var pts = [[sx, sy]];
    for (var i = 1; i < n; i++) {
      var t = i / n;
      var mx = sx + (ex - sx) * t;
      var my = sy + (ey - sy) * t;
      var nx = -(ey - sy), ny = ex - sx;
      var mag = Math.sqrt(nx * nx + ny * ny) || 1;
      var j = (Math.random() - 0.5) * 10;
      pts.push([mx + nx / mag * j, my + ny / mag * j]);
    }
    pts.push([ex, ey]);
    arcs.push({ pts: pts, life: 0, max: 0.12 + Math.random() * 0.14 });
  }

  function addRipple() {
    ripples.push({ x: x, y: y, life: 0, max: 0.55 + Math.random() * 0.25 });
  }

  function spawn(dt) {
    var rate;
    if (current === 'fire') rate = 44 + Math.min(180, speed * 7);
    else if (current === 'electric') rate = 30 + Math.min(150, speed * 6.5);
    else if (current === 'water') rate = 26 + Math.min(120, speed * 5);
    else rate = 34 + Math.min(140, speed * 6);

    spawnCarry += rate * dt;
    var n = Math.min(6, Math.floor(spawnCarry));
    spawnCarry -= n;
    for (var i = 0; i < n; i++) {
      if (parts.length >= 320) break;
      if (current === 'fire') addFire();
      else if (current === 'electric') addSpark();
      else if (current === 'water') addDrop();
      else addDevil();
    }

    if (current === 'electric' && Math.random() < 0.035 + Math.min(0.13, speed * 0.002)) makeArc();
    if (current === 'water' && Math.random() < 0.022 + Math.min(0.08, speed * 0.0015)) addRipple();
  }

  function burst() {
    if (reduceMotion || !visible || overText || overFrame) return;
    var n = current === 'electric' ? 18 : 22;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * TAU + Math.random() * 0.5;
      var sp = 50 + Math.random() * 180;
      var vx = Math.cos(ang) * sp;
      var vy = Math.sin(ang) * sp;
      if (current === 'water') {
        parts.push({ kind: 'drop', x: x, y: y, vx: vx * 0.5, vy: vy * 0.5 - 30, life: 0, max: 0.5 + Math.random() * 0.5, size: 1.8 + Math.random() * 2.6, seed: Math.random() * 6.283 });
      } else if (current === 'electric') {
        parts.push({ kind: 'spark', x: x, y: y, vx: vx, vy: vy, life: 0, max: 0.18 + Math.random() * 0.3, size: 1.2 + Math.random() * 1.8, seed: Math.random() * 6.283 });
      } else if (current === 'devil') {
        parts.push(Math.random() < 0.32
          ? { kind: 'spade', x: x, y: y, vx: vx * 0.5, vy: vy * 0.5 - 20, life: 0, max: 0.7 + Math.random() * 0.6, size: 7 + Math.random() * 7, rot: Math.random() * 6.283, seed: Math.random() * 6.283 }
          : { kind: 'ember', x: x, y: y, vx: vx * 0.5, vy: vy * 0.5, life: 0, max: 0.6 + Math.random() * 0.6, size: 2 + Math.random() * 4, seed: Math.random() * 6.283 });
      } else {
        parts.push({ kind: 'fire', x: x, y: y, vx: vx * 0.55, vy: vy * 0.55, life: 0, max: 0.45 + Math.random() * 0.5, size: 2.2 + Math.random() * 4.4, seed: Math.random() * 6.283 });
      }
    }
    if (current === 'electric') { makeArc(); makeArc(); }
    if (current === 'water') addRipple();
  }

  function update(dt) {
    var now = performance.now();
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.life += dt;
      if (p.life >= p.max || p.y < -60 || p.y > H + 80) { parts.splice(i, 1); continue; }
      if (p.kind === 'drop') {
        p.vy += 650 * dt;
      } else if (p.kind === 'spark') {
        p.vx *= Math.pow(0.02, dt);
        p.vy *= Math.pow(0.02, dt);
      } else if (p.kind === 'fire' || p.kind === 'ember') {
        p.vy -= 26 * dt;
        p.vx += Math.sin(p.seed + now * 0.006 + p.life * 7) * 26 * dt;
      } else if (p.kind === 'spade') {
        p.vy -= 5 * dt;
        p.vx += Math.sin(p.seed + now * 0.004) * 10 * dt;
        p.rot += dt * 1.6;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (i = arcs.length - 1; i >= 0; i--) {
      arcs[i].life += dt;
      if (arcs[i].life >= arcs[i].max) arcs.splice(i, 1);
    }
    for (i = ripples.length - 1; i >= 0; i--) {
      ripples[i].life += dt;
      if (ripples[i].life >= ripples[i].max) ripples.splice(i, 1);
    }
  }

  function toneAt(tones, t) {
    return t < 0.3 ? tones[0] : t < 0.62 ? tones[1] : t < 0.87 ? tones[2] : tones[3];
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    var tones = THEMES[current].tones;
    var additive = current !== 'water';
    ctx.globalCompositeOperation = additive ? 'lighter' : 'source-over';

    var i, t, c, a;
    for (i = 0; i < ripples.length; i++) {
      var rp = ripples[i];
      t = rp.life / rp.max;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 2 + t * 30, 0, TAU);
      ctx.strokeStyle = 'rgba(56,189,248,' + ((1 - t) * 0.45) + ')';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 1 + t * 14, 0, TAU);
      ctx.strokeStyle = 'rgba(236,254,255,' + ((1 - t) * 0.25) + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    for (i = 0; i < parts.length; i++) {
      var p = parts[i];
      t = p.life / p.max;
      c = toneAt(tones, t);

      if (p.kind === 'spade') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = 'bold ' + p.size.toFixed(1) + 'px Georgia,serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(248,113,113,' + ((1 - t) * 0.82) + ')';
        ctx.fillText('\u2660', 0, 0);
        ctx.restore();
        continue;
      }

      if (p.kind === 'spark') {
        var mag = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
        var len = 3 + p.size * 2.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx / mag * len, p.y - p.vy / mag * len);
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + ((1 - t) * 0.5) + ')';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(245,243,255,' + ((1 - t) * 0.9) + ')';
        ctx.lineWidth = 0.9;
        ctx.stroke();
        continue;
      }

      if (p.kind === 'drop') {
        a = 1 - t;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.72, p.size * 1.15, 0, 0, TAU);
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.55) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x - p.size * 0.22, p.y - p.size * 0.35, p.size * 0.3, 0, TAU);
        ctx.fillStyle = 'rgba(236,254,255,' + (a * 0.8) + ')';
        ctx.fill();
        continue;
      }

      /* fire / devil embers */
      a = (1 - t) * (t < 0.1 ? t / 0.1 : 1);
      var rr = p.size * (1 - t * 0.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr * 2.4, 0, TAU);
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.1) + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, TAU);
      ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a * 0.95) + ')';
      ctx.fill();
    }

    for (i = 0; i < arcs.length; i++) {
      var arc = arcs[i];
      t = arc.life / arc.max;
      a = 1 - t;
      ctx.beginPath();
      ctx.moveTo(arc.pts[0][0], arc.pts[0][1]);
      for (var j = 1; j < arc.pts.length; j++) ctx.lineTo(arc.pts[j][0], arc.pts[j][1]);
      ctx.strokeStyle = 'rgba(168,85,247,' + (a * 0.32) + ')';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(233,213,255,' + a + ')';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------- loop ---------- */

  function frame(now) {
    requestAnimationFrame(frame);
    keepOnTop();
    if (pageHidden) return;
    var dt = prevTime ? Math.min(0.05, (now - prevTime) / 1000) : 0.016;
    prevTime = now;
    if (!activated || !visible) return;

    speed = Math.sqrt(velX * velX + velY * velY);
    var target = down ? 0.88 : hot ? 1.1 : 1;
    scale += (target - scale) * Math.min(1, dt * 20);

    if (core) {
      core.style.transform = 'translate3d(' + (x - 8) + 'px,' + (y - 8) + 'px,0) scale(' + scale.toFixed(3) + ')';
      core.style.opacity = (overText || overFrame) ? '0' : '1';
    }
    if (ring) {
      rx += (x - rx) * Math.min(1, dt * 18);
      ry += (y - ry) * Math.min(1, dt * 18);
      ring.style.transform = 'translate3d(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px,0) scale(' + (hot ? 1.3 : 1) + ')';
      ring.style.opacity = (hot && !overText && !overFrame) ? '0.85' : '0';
    }

    if (!overText && !overFrame && !reduceMotion) {
      spawn(dt);
      update(dt);
      draw();
    } else if (ctx) {
      ctx.clearRect(0, 0, W, H);
    }

    var decay = Math.pow(0.001, dt);
    velX *= decay;
    velY *= decay;
  }

  /* ---------- init ---------- */

  injectCss();
  savedChoice = readChoice();
  buildDom();
  setTheme(isPremiumUser() ? savedChoice : 'fire', false);

  window.addEventListener('pointermove', onMove, { passive: true, capture: true });
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    activate();
    down = true;
    burst();
  }, true);
  window.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'touch') return;
    down = false;
  }, true);
  window.addEventListener('pointercancel', function () { down = false; }, true);
  window.addEventListener('blur', hide);
  window.addEventListener('resize', resize);
  document.documentElement.addEventListener('mouseleave', hide);

  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden;
    prevTime = performance.now();
    if (pageHidden) hide();
  });

  window.addEventListener('scroll', function () {
    if (!visible) return;
    updateHover(document.elementFromPoint(x, y));
  }, true);

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      savedChoice = readChoice();
      manualChoice = false;
      syncRole();
    } else if (e.key === 'fh_user_roles' || e.key === 'fas_premium') {
      manualChoice = false;
      syncRole();
    }
  });

  window.addEventListener('auth-changed', function () {
    manualChoice = false;
    syncRole();
    setTimeout(syncRole, 700);
    setTimeout(syncRole, 1800);
    setTimeout(syncRole, 3500);
  });

  /* Role data is fetched asynchronously after sign-in; re-check briefly. */
  var roleTries = 0;
  var roleTimer = setInterval(function () {
    roleTries++;
    syncRole();
    if (roleTries > 20) clearInterval(roleTimer);
  }, 1500);

  window.__fasSetCursor = function (style) {
    if (STYLES.indexOf(style) === -1) style = 'fire';
    manualChoice = true;
    setTheme(style, true);
  };
  window.__fasGetCursor = function () { return current; };
  window.__fasCursorStyles = STYLES.slice();

  requestAnimationFrame(frame);
})();
