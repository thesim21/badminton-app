/* i18n.js — Thai ⇄ English switch.
   Thai is the source language of every screen. In English mode the finished page text (and a few JS strings: confirm/alert,
   clipboard, share, QR card) is rewritten from a phrase table (i18n-en.js). Thai mode changes nothing. */
"use strict";
const I18N=(()=>{
  const KEY="bgo-lang",TH=/[\u0E00-\u0E7F]/,ATTRS=["placeholder","title","aria-label","alt","data-l"];
  let lang="th";try{const v=localStorage.getItem(KEY);if(v==="en"||v==="th")lang=v;}catch(e){}
  let by=null,prot=null,protFn=null,mo=null;
  const isTh=c=>c>=0xE00&&c<=0xE7F,an=/[A-Za-z0-9]/;
  function build(){by=new Map();const d=window.I18N_EN||{};for(const k in d){const c=k.charCodeAt(0);let a=by.get(c);if(!a)by.set(c,a=[]);a.push({th:k,en:d[k],sh:k.replace(/\s/g,"").length<=4});}by.forEach(a=>a.sort((x,y)=>y.th.length-x.th.length));}
  /* a Thai word that is made only of known phrases (e.g. "กำไร"+"สะสม") may be translated piece by piece */
  const segMemo=new Map();
  function segmentable(w){
    if(segMemo.has(w))return segMemo.get(w);
    const n=w.length,ok=new Array(n+1).fill(false);ok[0]=true;
    for(let j=0;j<n;j++){if(!ok[j])continue;const a=by.get(w.charCodeAt(j));if(a)for(const k of a)if(w.startsWith(k.th,j))ok[j+k.th.length]=true;}
    segMemo.set(w,ok[n]);return ok[n];
  }
  const run=(t,i,dir)=>{let j=i;if(dir<0){while(j>0&&isTh(t.charCodeAt(j-1))&&t.charCodeAt(j-1)!==0xE3F)j--;}else{while(j<t.length&&isTh(t.charCodeAt(j))&&t.charCodeAt(j)!==0xE3F)j++;}return j;};
  /* longest phrase first; short phrases (≤4 letters) only as whole words (or inside words that are fully known) so Thai names are not cut up */
  function xlRaw(t){
    let out="",last=0,i=0;const n=t.length;
    while(i<n){
      const c=t.charCodeAt(i);
      if(isTh(c)){
        const a=by.get(c);let hit=null;
        if(a)for(const k of a){if(t.startsWith(k.th,i)){
          if(k.sh){const e=i+k.th.length,p=i?t.charCodeAt(i-1):0,q=t.charCodeAt(e)||0;
            if((isTh(p)&&p!==0xE3F)||(isTh(q)&&q!==0xE3F)){if(!segmentable(t.slice(run(t,i,-1),run(t,e-1,1))))continue;}}
          hit=k;break;}}
        if(hit){
          out+=t.slice(last,i);
          const pv=out.slice(-1),nx=t.charAt(i+hit.th.length),en=hit.en;
          if(pv&&(an.test(pv)||isTh(pv.charCodeAt(0))||pv===")")&&an.test(en.charAt(0)))out+=" ";
          out+=en;
          if(nx&&an.test(en.slice(-1))&&(an.test(nx)||isTh(nx.charCodeAt(0))))out+=" ";
          i+=hit.th.length;last=i;continue;
        }
      }
      i++;
    }
    return last?out+t.slice(last):t;
  }
  /* text people typed themselves (names, titles, notes…) is kept as it is: translate only what is around it */
  function xlMask(t){
    const sp=[];
    for(const m of prot){let i=t.indexOf(m);while(i>=0){const e=i+m.length;
      if(m.length>=6||(!isTh(t.charCodeAt(i-1)||0)&&!isTh(t.charCodeAt(e)||0)))sp.push([i,e]);i=t.indexOf(m,e);}}
    if(!sp.length)return xlRaw(t);
    sp.sort((x,y)=>x[0]-y[0]||y[1]-x[1]);
    let out="",pos=0,changed=false;
    for(const [b,e] of sp){if(b<pos)continue;if(b>pos){const seg=t.slice(pos,b),r=xlRaw(seg);if(r!==seg)changed=true;out+=r;}out+=t.slice(b,e);pos=e;}
    if(pos<t.length){const seg=t.slice(pos),r=xlRaw(seg);if(r!==seg)changed=true;out+=r;}
    return changed?out:t;
  }
  function xl(s,keepWs){
    if(lang!=="en"||!s||!TH.test(s))return s;
    if(!by)build();
    let t=s;if(!keepWs&&/\s{2}|[\n\t]/.test(t))t=t.replace(/\s+/g," ");
    if(prot===null)prot=mkProt();
    const r=prot.length?xlMask(t):xlRaw(t);
    return r===t?s:r;
  }
  const mkProt=()=>{let a=[];try{a=protFn?[...protFn()]:[];}catch(e){}return [...new Set(a.map(x=>String(x||"").trim()).filter(x=>x.length>=2&&TH.test(x)))].sort((x,y)=>y.length-x.length);};
  const skip=p=>{const n=p.nodeName;return n==="SCRIPT"||n==="STYLE"||n==="TEXTAREA"||(p.closest&&p.closest('[translate="no"]'));};
  function tx(n){
    const v=n.nodeValue;if(!v||!TH.test(v))return;
    const p=n.parentNode;if(p&&skip(p))return;
    const r=xl(v,false);if(r!==v)n.nodeValue=r;
  }
  function attr(n,a){const v=n.getAttribute(a);if(v&&TH.test(v)){const r=xl(v,false);if(r!==v)n.setAttribute(a,r);}}
  function el(n){
    if(n.hasAttributes())for(const a of ATTRS)attr(n,a);
    if(n.hasAttribute("data-lang")&&!n.firstChild)mount(n);
  }
  function walk(root){
    if(root.nodeType===3){tx(root);return;}
    if(root.nodeType!==1)return;
    const w=document.createTreeWalker(root,5);let n=root;
    do{if(n.nodeType===3)tx(n);else el(n);}while((n=w.nextNode()));
  }
  /* the TH | EN switch */
  function mount(host){
    host.classList.add("lang");host.setAttribute("role","group");host.setAttribute("aria-label","Language");
    host.innerHTML=`<button type="button" data-lg="th" aria-pressed="${lang==="th"}">TH</button><button type="button" data-lg="en" aria-pressed="${lang==="en"}">EN</button>`;
  }
  const mountAll=()=>document.querySelectorAll("[data-lang]").forEach(h=>{if(!h.firstChild)mount(h);});
  function set(l){
    if(l!=="th"&&l!=="en"||l===lang)return;
    try{localStorage.setItem(KEY,l);}catch(e){}
    location.reload();
  }
  function init(){
    document.documentElement.lang=lang;
    mountAll();
    document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("[data-lg]");if(!b)return;e.preventDefault();e.stopPropagation();set(b.dataset.lg);},true);
    if(lang!=="en")return;
    walk(document.documentElement);
    mo=new MutationObserver(ms=>{
      prot=null;
      for(const m of ms){
        if(m.type==="childList")m.addedNodes.forEach(walk);
        else if(m.type==="characterData")tx(m.target);
        else if(m.type==="attributes"&&m.target.nodeType===1)attr(m.target,m.attributeName);
      }
    });
    mo.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    const w=window;
    ["alert","confirm"].forEach(f=>{const o=w[f];w[f]=m=>o.call(w,xl(String(m),true));});
    const op=w.prompt;w.prompt=(m,d)=>op.call(w,xl(String(m),true),d);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  return {
    get lang(){return lang;},
    get loc(){return lang==="en"?"en-GB":"th-TH";},
    t:s=>{prot=null;return xl(s==null?s:String(s),true);},
    protect:fn=>{protFn=fn;},
    mountAll,set
  };
})();
