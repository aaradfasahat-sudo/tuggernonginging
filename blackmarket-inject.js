(function(){
  'use strict';

  var bm=0, pb=0;

  function _createOverlay() {
    if (document.getElementById('fas-main-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'fas-main-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;flex-direction:column;background:#000;';

    var bar = document.createElement('div');
    bar.id = 'fas-ov-bar';
    bar.style.cssText = 'height:42px;background:rgba(10,10,20,0.97);border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:6px;padding:0 10px;flex-shrink:0;backdrop-filter:blur(12px);';

    var btnStyle = 'background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:rgba(255,255,255,0.7);cursor:pointer;padding:4px 9px;font-size:13px;line-height:1;transition:all .15s;';

    var backBtn = document.createElement('button');
    backBtn.title = 'Back';
    backBtn.innerHTML = '&#8592;';
    backBtn.style.cssText = btnStyle;
    backBtn.onclick = function(){ try { document.getElementById('fas-ov-frame').contentWindow.history.back(); } catch(e){} };
    backBtn.onmouseenter = function(){ this.style.background='rgba(255,255,255,0.14)'; };
    backBtn.onmouseleave = function(){ this.style.background='rgba(255,255,255,0.07)'; };

    var reloadBtn = document.createElement('button');
    reloadBtn.title = 'Reload';
    reloadBtn.innerHTML = '&#8635;';
    reloadBtn.style.cssText = btnStyle;
    reloadBtn.onclick = function(){
      var f = document.getElementById('fas-ov-frame');
      if (f && f.src && f.src !== 'about:blank') {
        var s = f.src; f.src = 'about:blank';
        requestAnimationFrame(function(){ f.src = s; });
      }
    };
    reloadBtn.onmouseenter = function(){ this.style.background='rgba(255,255,255,0.14)'; };
    reloadBtn.onmouseleave = function(){ this.style.background='rgba(255,255,255,0.07)'; };

    var urlInput = document.createElement('input');
    urlInput.id = 'fas-ov-url';
    urlInput.type = 'text';
    urlInput.placeholder = 'Enter URL or search...';
    urlInput.autocomplete = 'off';
    urlInput.style.cssText = 'flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:5px 12px;font-size:12px;color:rgba(255,255,255,0.9);font-family:inherit;outline:none;transition:border-color .2s;min-width:0;';
    urlInput.onfocus = function(){ this.style.borderColor='rgba(255,215,0,0.45)'; };
    urlInput.onblur = function(){ this.style.borderColor='rgba(255,255,255,0.15)'; };
    urlInput.onkeydown = function(e){ if(e.key==='Enter') _ovNavigate(this.value.trim()); };

    var goBtn = document.createElement('button');
    goBtn.textContent = 'Go';
    goBtn.style.cssText = btnStyle + 'background:rgba(255,215,0,0.15);border-color:rgba(255,215,0,0.3);color:rgba(255,215,0,0.9);';
    goBtn.onclick = function(){ _ovNavigate(document.getElementById('fas-ov-url').value.trim()); };
    goBtn.onmouseenter = function(){ this.style.background='rgba(255,215,0,0.25)'; };
    goBtn.onmouseleave = function(){ this.style.background='rgba(255,215,0,0.15)'; };

    var ntBtn = document.createElement('button');
    ntBtn.title = 'Open in new tab';
    ntBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    ntBtn.style.cssText = btnStyle;
    ntBtn.onclick = function(){
      var u = document.getElementById('fas-ov-url').value.trim();
      if (u) window.open('/proxy1.html?q=' + encodeURIComponent(u), '_blank');
    };
    ntBtn.onmouseenter = function(){ this.style.background='rgba(255,255,255,0.14)'; };
    ntBtn.onmouseleave = function(){ this.style.background='rgba(255,255,255,0.07)'; };

    var closeBtn = document.createElement('button');
    closeBtn.title = 'Close';
    closeBtn.innerHTML = '&#10005;';
    closeBtn.style.cssText = btnStyle + 'border-color:rgba(255,80,80,0.2);';
    closeBtn.onclick = function(){ _closeOverlay(); };
    closeBtn.onmouseenter = function(){ this.style.background='rgba(255,80,80,0.2)'; this.style.color='#ff5555'; };
    closeBtn.onmouseleave = function(){ this.style.background='rgba(255,255,255,0.07)'; this.style.color='rgba(255,255,255,0.7)'; };

    bar.appendChild(backBtn);
    bar.appendChild(reloadBtn);
    bar.appendChild(urlInput);
    bar.appendChild(goBtn);
    bar.appendChild(ntBtn);
    bar.appendChild(closeBtn);

    var frame = document.createElement('iframe');
    frame.id = 'fas-ov-frame';
    frame.style.cssText = 'flex:1;width:100%;border:none;';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-pointer-lock allow-downloads allow-top-navigation-by-user-activation');
    frame.setAttribute('allow', 'autoplay; fullscreen; pointer-lock; gamepad');

    frame.addEventListener('load', function(){
      try {
        var src = frame.src || '';
        if (!src || src === 'about:blank') return;
        var m = src.match(/[?&]url=([^&]+)/);
        if (m) {
          var decoded = decodeURIComponent(m[1]);
          var inp = document.getElementById('fas-ov-url');
          if (inp && document.activeElement !== inp) inp.value = decoded;
        }
      } catch(e) {}
    });

    ov.appendChild(bar);
    ov.appendChild(frame);
    document.body.appendChild(ov);

    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') {
        var o = document.getElementById('fas-main-overlay');
        if (o && o.style.display === 'flex') _closeOverlay();
      }
    });
  }

  function _ovNavigate(v) {
    if (!v) return;
    var url = v;
    if (!v.startsWith('http://') && !v.startsWith('https://') && v.indexOf('.') > 0 && v.indexOf(' ') < 0) {
      url = 'https://' + v;
    } else if (v.indexOf(' ') >= 0 || !v.startsWith('http')) {
      url = 'https://www.google.com/search?q=' + encodeURIComponent(v);
    }
    var frame = document.getElementById('fas-ov-frame');
    var inp = document.getElementById('fas-ov-url');
    if (frame) frame.src = '/px?url=' + encodeURIComponent(url);
    if (inp) inp.value = url;
    var ov = document.getElementById('fas-main-overlay');
    if (ov) ov.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function _closeOverlay() {
    var ov = document.getElementById('fas-main-overlay');
    var frame = document.getElementById('fas-ov-frame');
    if (ov) ov.style.display = 'none';
    if (frame) frame.src = 'about:blank';
    document.body.style.overflow = '';
  }

  var si = setInterval(function(){
    try {
      if (!bm && !document.getElementById('fas-bm-nav-btn')) {
        var n = document.querySelector('nav');
        if (n) {
          for (var i=0; i<n.children.length; i++) {
            var c = n.children[i];
            if ((c.tagName==='BUTTON'||c.tagName==='A') && c.textContent.trim().toLowerCase()==='home') {
              var b = document.createElement('button');
              b.id = 'fas-bm-nav-btn';
              b.innerHTML = '<span style="font-size:13px;">\uD83C\uDFF4</span> Black Market';
              b.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;background:linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.1));border:1.5px solid rgba(255,215,0,.35);color:rgba(255,215,0,.9);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;transition:all .18s;white-space:nowrap;font-family:inherit;box-shadow:0 0 12px rgba(255,215,0,.08);cursor:pointer;';
              b.onmouseenter = function(){ this.style.background='linear-gradient(135deg,rgba(255,215,0,.25),rgba(255,140,0,.18))';this.style.borderColor='rgba(255,215,0,.6)';this.style.boxShadow='0 0 18px rgba(255,215,0,.18)'; };
              b.onmouseleave = function(){ this.style.background='linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.1))';this.style.borderColor='rgba(255,215,0,.35)';this.style.boxShadow='0 0 12px rgba(255,215,0,.08)'; };
              b.onclick = function(){ window.location.href='/blackmarket.html'; };
              c.parentNode.insertBefore(b, c.nextSibling);
              bm = 1;
              break;
            }
          }
        }
      }

      if (!pb && !document.getElementById('fas-proxy-bar')) {
        var h = document.querySelector('header');
        if (h) {
          for (var j=0; j<h.children.length; j++) {
            var ch = h.children[j];
            if (ch.className && ch.className.indexOf('overflow-hidden') !== -1) {
              ch.innerHTML = '';
              ch.style.setProperty('display','flex','important');
              ch.style.setProperty('opacity','1','important');
              ch.style.setProperty('visibility','visible','important');

              var bar = document.createElement('div');
              bar.id = 'fas-proxy-bar';
              bar.style.cssText = 'display:flex;align-items:center;width:100%;height:32px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:0 4px 0 10px;gap:4px;box-sizing:border-box;';

              var icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';

              var inp = document.createElement('input');
              inp.type = 'text';
              inp.placeholder = 'Search or enter URL...';
              inp.autocomplete = 'off';
              inp.style.cssText = 'flex:1;background:none;border:none;outline:none;color:#e8e9f0;font-size:12px;font-family:inherit;min-width:0;';

              var savedMode;
              try { savedMode = localStorage.getItem('fasPxMode') || 'Overlay'; } catch(e) { savedMode = 'Overlay'; }

              var modeWrap = document.createElement('div');
              modeWrap.style.cssText = 'position:relative;flex-shrink:0;';

              var modeBtn = document.createElement('button');
              modeBtn.id = 'fas-mode-btn';
              modeBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.18);border-radius:10px;color:rgba(255,255,255,0.7);padding:0 8px;height:20px;font-size:9px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:3px;white-space:nowrap;transition:all .2s;';
              modeBtn.innerHTML = '<span id="fas-mode-label">' + savedMode + '</span><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';
              modeBtn.onmouseenter = function(){ this.style.borderColor='rgba(255,255,255,0.35)';this.style.color='#fff'; };
              modeBtn.onmouseleave = function(){ this.style.borderColor='rgba(255,255,255,0.18)';this.style.color='rgba(255,255,255,0.7)'; };

              var dropdown = document.createElement('div');
              dropdown.id = 'fas-mode-dropdown';
              dropdown.style.cssText = 'display:none;position:absolute;bottom:calc(100% + 6px);right:0;background:#161b22;border:1px solid rgba(255,255,255,0.12);border-radius:10px;overflow:hidden;min-width:100px;box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:9999;';

              var modes = ['Overlay','Direct','New Tab'];
              modes.forEach(function(m){
                var item = document.createElement('div');
                item.textContent = m;
                item.style.cssText = 'padding:7px 14px;font-size:10px;font-weight:700;cursor:pointer;color:rgba(255,255,255,0.6);transition:all .1s;white-space:nowrap;font-family:monospace;';
                item.onmouseenter = function(){ this.style.background='rgba(255,255,255,0.08)';this.style.color='#fff'; };
                item.onmouseleave = function(){ this.style.background='transparent';this.style.color='rgba(255,255,255,0.6)'; };
                item.onclick = function(e){
                  e.stopPropagation();
                  try { localStorage.setItem('fasPxMode', m); } catch(err) {}
                  var lbl = document.getElementById('fas-mode-label');
                  if (lbl) lbl.textContent = m;
                  dropdown.style.display = 'none';
                };
                dropdown.appendChild(item);
              });

              var ddOpen = false;
              modeBtn.onclick = function(e){
                e.stopPropagation();
                ddOpen = !ddOpen;
                dropdown.style.display = ddOpen ? 'block' : 'none';
              };

              document.addEventListener('click', function(){
                ddOpen = false;
                dropdown.style.display = 'none';
              });

              modeWrap.appendChild(modeBtn);
              modeWrap.appendChild(dropdown);

              var goBtn = document.createElement('button');
              goBtn.textContent = 'Go';
              goBtn.style.cssText = 'background:#e53935;border:none;color:#fff;border-radius:16px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;';

              var go = function(){
                var v = inp.value.trim();
                if (!v) return;
                var url = v;
                if (!v.startsWith('http://') && !v.startsWith('https://') && v.indexOf('.') > 0 && v.indexOf(' ') < 0) {
                  url = 'https://' + v;
                } else if (v.indexOf(' ') >= 0 || !v.startsWith('http')) {
                  url = 'https://www.google.com/search?q=' + encodeURIComponent(v);
                }
                var mode;
                try { mode = localStorage.getItem('fasPxMode') || 'Overlay'; } catch(e) { mode = 'Overlay'; }

                if (mode === 'New Tab') {
                  window.open('/proxy1.html?q=' + encodeURIComponent(url), '_blank');
                } else if (mode === 'Direct') {
                  window.location.href = '/proxy1.html?q=' + encodeURIComponent(url);
                } else {
                  _createOverlay();
                  _ovNavigate(url);
                }
              };

              goBtn.onclick = go;
              inp.onkeydown = function(e){ if(e.key==='Enter') go(); };

              bar.innerHTML = icon;
              bar.appendChild(inp);
              bar.appendChild(modeWrap);
              bar.appendChild(goBtn);
              ch.appendChild(bar);
              pb = 1;
              break;
            }
          }
        }
      }

      if (bm && pb) clearInterval(si);
    } catch(e) {}
  }, 300);
})();
