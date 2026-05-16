(function(){
  var bm=0, pb=0, si=setInterval(function(){
    try {
      if(!bm && !document.getElementById('fas-bm-nav-btn')){
        var n=document.querySelector('nav');
        if(n){
          for(var i=0;i<n.children.length;i++){
            var c=n.children[i];
            if((c.tagName==='BUTTON'||c.tagName==='A')&&c.textContent.trim().toLowerCase()==='home'){
              var b=document.createElement('button');
              b.id='fas-bm-nav-btn';
              b.innerHTML='<span style=\"font-size:13px;\">\uD83C\uDFF4</span> Black Market';
              b.style.cssText='display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;background:linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.1));border:1.5px solid rgba(255,215,0,.35);color:rgba(255,215,0,.9);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;transition:all .18s;white-space:nowrap;font-family:inherit;box-shadow:0 0 12px rgba(255,215,0,.08);cursor:pointer;';
              b.onmouseenter=function(){this.style.background='linear-gradient(135deg,rgba(255,215,0,.25),rgba(255,140,0,.18))';this.style.borderColor='rgba(255,215,0,.6)';this.style.boxShadow='0 0 18px rgba(255,215,0,.18)';};
              b.onmouseleave=function(){this.style.background='linear-gradient(135deg,rgba(255,215,0,.15),rgba(255,140,0,.1))';this.style.borderColor='rgba(255,215,0,.35)';this.style.boxShadow='0 0 12px rgba(255,215,0,.08)';};
              b.onclick=function(){window.location.href='/blackmarket.html';};
              c.parentNode.insertBefore(b,c.nextSibling);
              bm=1;
              break;
            }
          }
        }
      }
      if(!pb && !document.getElementById('fas-proxy-bar')){
        var h=document.querySelector('header');
        if(h){
          for(var j=0;j<h.children.length;j++){
            var ch=h.children[j];
            if(ch.className&&ch.className.indexOf('overflow-hidden')!==-1){
              ch.innerHTML='';
              ch.style.setProperty('display','flex','important');
              ch.style.setProperty('opacity','1','important');
              ch.style.setProperty('visibility','visible','important');
var bar=document.createElement('div');
              bar.id='fas-proxy-bar';
              bar.style.cssText='display:flex;align-items:center;width:100%;height:32px;background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:0 4px 0 10px;gap:4px;box-sizing:border-box;';
              var icon='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
              var inp=document.createElement('input');
              inp.type='text';
              inp.placeholder='Search or enter URL...';
              inp.style.cssText='flex:1;background:none;border:none;outline:none;color:#e8e9f0;font-size:12px;font-family:inherit;min-width:0;';
              var pv='P1';try{pv=localStorage.getItem('fasPx')||'P1'}catch(e){}
              var pxWrap=document.createElement('div');
              pxWrap.style.cssText='display:flex;border:1px solid rgba(255,255,255,0.12);border-radius:10px;overflow:hidden;flex-shrink:0;height:20px;';
              var p1=document.createElement('button');
              p1.textContent='P1';
              p1.style.cssText='background:none;border:none;color:rgba(255,255,255,0.3);padding:0 6px;font-size:9px;font-weight:700;cursor:pointer;font-family:monospace;transition:all .2s;';
              var p2=document.createElement('button');
              p2.textContent='P2';
              p2.style.cssText='background:none;border:none;color:rgba(255,255,255,0.3);padding:0 6px;font-size:9px;font-weight:700;cursor:pointer;font-family:monospace;transition:all .2s;';
              var sel=function(v){
                var c1=v=='P1'&&'rgba(88,166,255,0.85)'||'rgba(255,255,255,0.3)';
                var c2=v=='P2'&&'rgba(203,166,247,0.85)'||'rgba(255,255,255,0.3)';
                var b1=v=='P1'?'rgba(88,166,255,0.12)':'transparent';
                var b2=v=='P2'?'rgba(203,166,247,0.12)':'transparent';
                p1.style.color=c1;p1.style.background=b1;
                p2.style.color=c2;p2.style.background=b2;
                try{localStorage.setItem('fasPx',v)}catch(e){}
              };
              sel(pv);
              p1.onclick=function(){sel('P1');};
              p2.onclick=function(){sel('P2');};
              pxWrap.appendChild(p1);
              pxWrap.appendChild(p2);
              var btn=document.createElement('button');
              btn.textContent='Go';
              btn.style.cssText='background:#e53935;border:none;color:#fff;border-radius:16px;padding:3px 10px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;';
              var go=function(){
                var v=inp.value.trim();
                if(v){
                  var url=v;
                  if(!v.startsWith('http://')&&!v.startsWith('https://')&&v.indexOf('.')>0){url='https://'+v;}
                  else if(v.indexOf(' ')>0||!v.startsWith('http')){url='https://www.google.com/search?q='+encodeURIComponent(v);}
                  var a;try{a=localStorage.getItem('fasPx')}catch(e){}
                  window.open((a=='P2'?'/proxy2.html':'/proxy1.html')+'?q='+encodeURIComponent(url),'_blank');
                }
              };
              btn.onclick=go;
              inp.onkeydown=function(e){if(e.key==='Enter')go();};
              bar.innerHTML=icon;
              bar.appendChild(inp);
              bar.appendChild(pxWrap);
              bar.appendChild(btn);
              ch.appendChild(bar);
              pb=1;
              break;
            }
          }
        }
      }
      if(bm&&pb)clearInterval(si);
    }catch(e){}
  }, 300);
})();
