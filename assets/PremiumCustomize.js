import{u as q,r as o,j as e}from"./index-Be3LJ3MS.js";
const DB="fas_custom_bg",FN="fas_custom_font_name",FD="fas_custom_font_data";
const FONTS=[["","Site default (Cinzel)"],['"Cinzel Decorative", serif',"Cinzel Decorative"],['"Inter", sans-serif',"Inter"],['"Orbitron", sans-serif',"Orbitron"],['"Press Start 2P", cursive',"Press Start 2P"],['"Roboto Mono", monospace',"Roboto Mono"],['"Uncial Antiqua", serif',"Uncial Antiqua"],['"Exo 2", sans-serif',"Exo 2"],['"Goudy Medieval", "Uncial Antiqua", serif',"Goudy Medieval"],['"Luminari", fantasy',"Luminari"],['"Beleren", serif',"Beleren"],['system-ui, sans-serif',"System UI"],['Georgia, serif',"Georgia"],['Impact, fantasy',"Impact"]];
const CK="fas_cursor_style",CURSORS=[["fire","Fire","🔥"],["electric","Electric","⚡"],["water","Water","💧"],["devil","Devil","♠"]];
function P({theme:t,onChange:n}){
  const{user:d,isPremium:p,signIn:w}=q();
  const[msg,m]=o.useState("");
  const[busy,b]=o.useState(!1);
  const[cur,setCur]=o.useState(()=>{try{return localStorage.getItem(CK)||"fire"}catch(_){return"fire"}});
  const th=t||{};
  const isCustomFont=!!th.customFont;
  const isCustomBg=!!th.customBg;
  const setMsg=x=>m(x);

  const readFile=f=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(new Error("Could not read the file"));fr.readAsDataURL(f)});

  const uploadBg=async ev=>{
    const f=ev.target.files&&ev.target.files[0];ev.target.value="";
    if(!f)return;
    if(!/^image\//.test(f.type)){setMsg("Please choose an image file.");return}
    if(f.size>15*1024*1024){setMsg("That image is too large (max 15 MB).");return}
    b(!0);setMsg("Processing image…");
    try{
      const data=await readFile(f);
      const img=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error("That image could not be opened"));im.src=data});
      const max=1920,sc=Math.min(1,max/Math.max(img.width||1,img.height||1));
      const cv=document.createElement("canvas");
      cv.width=Math.max(1,Math.round((img.width||1)*sc));cv.height=Math.max(1,Math.round((img.height||1)*sc));
      const cx=cv.getContext("2d");cx.fillStyle="#0a0e1a";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,0,0,cv.width,cv.height);
      let out=cv.toDataURL("image/jpeg",.85);
      if(out.length>1.2e6)out=cv.toDataURL("image/jpeg",.7);
      if(out.length>1.2e6){
        const sc2=1280/Math.max(cv.width,cv.height),cv2=document.createElement("canvas");
        cv2.width=Math.max(1,Math.round(cv.width*sc2));cv2.height=Math.max(1,Math.round(cv.height*sc2));
        const c2=cv2.getContext("2d");c2.fillStyle="#0a0e1a";c2.fillRect(0,0,cv2.width,cv2.height);c2.drawImage(cv,0,0,cv2.width,cv2.height);
        out=cv2.toDataURL("image/jpeg",.72)
      }
      try{localStorage.setItem(DB,out)}catch(_){setMsg("The image is too big for your browser to remember. Try a smaller one.");b(!1);return}
      n({...th,bg:out,customBg:!0});
      setMsg("Background updated.");
    }catch(err){setMsg((err&&err.message)||"Could not use that image.")}
    b(!1);
  };

  const resetBg=()=>{
    try{localStorage.removeItem(DB)}catch(_){}
    n({...th,bg:"/assets/bg/default.jpg",customBg:!1});
    setMsg("Background reset to the default.");
  };

  const pickFont=val=>{
    if(!val)n({...th,fontFamily:"",customFont:!1});
    else n({...th,fontFamily:val,customFont:!1});
    setMsg("Font updated.");
  };

  const uploadFont=async ev=>{
    const f=ev.target.files&&ev.target.files[0];ev.target.value="";
    if(!f)return;
    if(!/\.(ttf|otf|woff2?|eot)$/i.test(f.name)){setMsg("Choose a .ttf, .otf, .woff or .woff2 font file.");return}
    if(f.size>3*1024*1024){setMsg("That font is too large (max 3 MB).");return}
    b(!0);setMsg("Loading font…");
    try{
      const data=await readFile(f);
      const name="FasCustom"+Date.now().toString(36);
      let st=document.getElementById("fas-custom-font-style");
      if(!st){st=document.createElement("style");st.id="fas-custom-font-style";document.head.appendChild(st)}
      st.textContent="@font-face{font-family:'"+name+"';src:url('"+data+"');font-display:swap}";
      try{await document.fonts.load('16px "'+name+'"')}catch(_){}
      try{localStorage.setItem(FN,name);localStorage.setItem(FD,data)}catch(_){
        n({...th,fontFamily:'"'+name+'", sans-serif',customFont:!0});
        setMsg("Font applied for this session, but it is too large to remember after a refresh.");
        b(!1);return
      }
      n({...th,fontFamily:'"'+name+'", sans-serif',customFont:!0});
      setMsg("Custom font applied.");
    }catch(err){setMsg("Could not load that font file.")}
    b(!1);
  };

  const resetFont=()=>{
    try{localStorage.removeItem(FN);localStorage.removeItem(FD)}catch(_){}
    const st=document.getElementById("fas-custom-font-style");
    if(st&&st.parentNode)st.parentNode.removeChild(st);
    n({...th,fontFamily:"",customFont:!1});
    setMsg("Font reset to the site default.");
  };

  const pickCursor=v=>{
    setCur(v);
    try{localStorage.setItem(CK,v)}catch(_){}
    try{window.__fasSetCursor&&window.__fasSetCursor(v)}catch(_){}
    const row=CURSORS.find(x=>x[0]===v);
    setMsg("Cursor style: "+(row?row[1]:"Fire")+".");
  };

  return e.jsxs("div",{className:"mb-8",children:[
    e.jsxs("div",{className:"text-[11px] text-[var(--mk-eye-glow)] uppercase mb-4 font-bold flex items-center gap-2",children:[e.jsx("span",{className:"text-sm",children:"🎨"})," Premium Customization"]}),
    !d?e.jsxs("div",{className:"p-3 bg-white/5 rounded-xl border border-yellow-400/10",children:[
      e.jsx("p",{className:"text-xs text-white/40 mb-3",children:"Sign in to customize your background and fonts"}),
      e.jsx("button",{onClick:w,className:"px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg text-xs font-bold transition-colors",children:"Sign in with Google"})
    ]}):!p?e.jsxs("div",{className:"p-3 bg-white/5 rounded-xl border border-yellow-400/10",children:[
      e.jsx("p",{className:"text-xs text-white/40",children:"Upload your own background, pick any font, upload a custom font, or switch your animated cursor with Premium."}),
      e.jsx("a",{href:"/blackmarket",className:"inline-block mt-3 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg text-xs font-bold transition-colors",children:"Get Premium"})
    ]}):e.jsxs("div",{className:"space-y-3",children:[
      e.jsxs("div",{className:"p-3 bg-white/5 rounded-xl border border-yellow-400/10",children:[
        e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[
          e.jsx("span",{className:"text-xs font-bold text-[var(--mk-gold)]",children:"Background Image"}),
          isCustomBg?e.jsx("span",{className:"text-[10px] uppercase tracking-wider text-green-400",children:"Custom"}):null
        ]}),
        e.jsx("div",{className:"rounded-lg border border-yellow-400/10 mb-2",style:{height:"72px",backgroundImage:"url("+(th.bg||"/assets/bg/default.jpg")+")",backgroundSize:"cover",backgroundPosition:"center"}}),
        e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[
          e.jsxs("label",{className:"px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg text-[11px] font-bold transition-colors cursor-pointer",children:[
            busy?"Working…":"Upload Background",
            e.jsx("input",{type:"file",accept:"image/*",onChange:uploadBg,disabled:busy,style:{display:"none"}})
          ]}),
          e.jsx("button",{onClick:resetBg,disabled:busy,className:"px-3 py-1.5 bg-white/10 hover:bg-white/20 text-[var(--mk-silver)] rounded-lg text-[11px] font-bold transition-colors",children:"Reset"})
        ]}),
        e.jsx("p",{className:"text-[10px] text-white/40 mt-2",children:"JPG, PNG or WebP. Images are scaled and compressed automatically."})
      ]}),
      e.jsxs("div",{className:"p-3 bg-white/5 rounded-xl border border-yellow-400/10",children:[
        e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[
          e.jsx("span",{className:"text-xs font-bold text-[var(--mk-gold)]",children:"Cursor FX"}),
          e.jsx("span",{className:"text-[10px] uppercase tracking-wider text-green-400",children:"Animated"})
        ]}),
        e.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"},children:CURSORS.map(([v,label,icon])=>e.jsxs("button",{
          type:"button",
          onClick:()=>pickCursor(v),
          style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"10px",border:"1px solid "+(cur===v?"rgba(250,204,21,.6)":"rgba(255,255,255,.1)"),background:cur===v?"rgba(250,204,21,.1)":"rgba(0,0,0,.3)",color:"var(--mk-silver)",cursor:"pointer",textAlign:"left",font:"inherit",transition:"border-color .15s, background .15s"},
          children:[
            e.jsx("span",{style:{fontSize:"16px",lineHeight:1,color:v==="devil"?"#f87171":undefined},children:icon}),
            e.jsx("span",{style:{fontSize:"11px",fontWeight:700},children:label}),
            cur===v?e.jsx("span",{style:{marginLeft:"auto",width:"6px",height:"6px",borderRadius:"9999px",background:"#facc15",boxShadow:"0 0 8px #facc15"}}):null
          ]
        },v))}),
        e.jsx("p",{className:"text-[10px] text-white/40 mt-2",children:"Fire is the default for everyone. Premium can switch to Electric, Water or Devil — move your mouse to preview (desktop)."})
      ]}),
      e.jsxs("div",{className:"p-3 bg-white/5 rounded-xl border border-yellow-400/10",children:[
        e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[
          e.jsx("span",{className:"text-xs font-bold text-[var(--mk-gold)]",children:"Font"}),
          isCustomFont?e.jsx("span",{className:"text-[10px] uppercase tracking-wider text-green-400",children:"Custom"}):null
        ]}),
        e.jsx("select",{value:isCustomFont?"__custom":(th.fontFamily||""),onChange:ev=>{const v=ev.target.value;if(v!=="__custom")pickFont(v)},className:"bg-[var(--mk-midnight)]/80 border border-yellow-400/30 text-[var(--mk-silver)] p-2.5 rounded-lg w-full outline-none text-xs mb-2",children:[
          isCustomFont?e.jsx("option",{value:"__custom",children:"Custom uploaded font"}):null,
          FONTS.map(([v,label])=>e.jsx("option",{value:v,children:label},v||"__default"))
        ]}),
        e.jsxs("div",{className:"flex items-center gap-2 flex-wrap mb-2",children:[
          e.jsx("select",{value:th.fontWeight||"",onChange:ev=>n({...th,fontWeight:ev.target.value}),className:"bg-[var(--mk-midnight)]/80 border border-yellow-400/30 text-[var(--mk-silver)] p-2 rounded-lg outline-none text-xs flex-1",children:[
            e.jsx("option",{value:"",children:"Default weight"}),
            [300,400,500,600,700,800,900].map(x=>e.jsx("option",{value:String(x),children:x},x))
          ]}),
          e.jsxs("label",{className:"flex items-center gap-2 text-[11px] text-[var(--mk-silver)] bg-white/5 px-2.5 py-2 rounded-lg border border-yellow-400/10 cursor-pointer",children:[
            e.jsx("input",{type:"checkbox",checked:(th.fontStyle||"normal")==="italic",onChange:ev=>n({...th,fontStyle:ev.target.checked?"italic":"normal"})}),
            "Italic"
          ]})
        ]}),
        e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[
          e.jsxs("label",{className:"px-3 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black rounded-lg text-[11px] font-bold transition-colors cursor-pointer",children:[
            busy?"Working…":"Upload Custom Font",
            e.jsx("input",{type:"file",accept:".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2",onChange:uploadFont,disabled:busy,style:{display:"none"}})
          ]}),
          e.jsx("button",{onClick:resetFont,disabled:busy,className:"px-3 py-1.5 bg-white/10 hover:bg-white/20 text-[var(--mk-silver)] rounded-lg text-[11px] font-bold transition-colors",children:"Reset"})
        ]}),
        e.jsx("p",{className:"text-[10px] text-white/40 mt-2",children:"TTF, OTF, WOFF or WOFF2 up to 3 MB. The font is applied across the whole site."})
      ]}),
      msg?e.jsx("p",{className:"text-[11px] text-[var(--mk-gold)]",children:msg}):null
    ]})
  ]});
}
export{P as default};
