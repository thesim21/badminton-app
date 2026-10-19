/* license.js — ใบอนุญาตแบบซื้อขาด: 1 ใบอนุญาต = 1 ที่นั่ง = ใช้ได้ทีละ 1 เครื่อง · ผูกกับก๊วน (repo) เดียว
   เปิดใช้เมื่อเซิร์ฟเวอร์ license ส่ง license-config.js ที่ required:true — ถ้าไม่ได้เปิด ไฟล์นี้ไม่ทำอะไร
   ที่นั่งต่ออายุเองเบื้องหลัง (heartbeat) · ย้ายเครื่อง = ออกจากระบบที่เครื่องเดิมก่อน */
"use strict";
const LIC=(()=>{
const on=!!(window.BGO_LICENSE&&window.BGO_LICENSE.required);
const LS="bgo-lic";
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let st=(()=>{try{return JSON.parse(localStorage.getItem(LS)||"null")||{};}catch(e){return {};}})();
let gateEl=null,lockEl=null,timer=null,started=false;
const save=()=>{try{localStorage.setItem(LS,JSON.stringify(st));}catch(e){}};
function deviceId(){if(!/^[a-f0-9]{32}$/.test(st.deviceId||"")){st.deviceId=[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,"0")).join("");save();}return st.deviceId;}
function guessDevice(){const u=navigator.userAgent;
  const os=/iPhone|iPad/.test(u)?"iPhone/iPad":/Android/.test(u)?"Android":/Windows/.test(u)?"Windows":/Mac/.test(u)?"Mac":/Linux/.test(u)?"Linux":"อุปกรณ์";
  const br=/Edg\//.test(u)?"Edge":/CriOS|Chrome/.test(u)?"Chrome":/Safari/.test(u)?"Safari":/Firefox/.test(u)?"Firefox":"";return os+(br?" · "+br:"");}
async function call(path,body){
  const r=await fetch(path,{method:body===undefined?"GET":"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
  let j={};try{j=await r.json();}catch(e){}return {status:r.status,json:j};
}
const fmtAgo=t=>{const m=Math.max(0,Math.round((Date.now()-t)/60000));return m<2?"เมื่อครู่":m<60?`${m} นาทีที่แล้ว`:m<1440?`${Math.round(m/60)} ชั่วโมงที่แล้ว`:`${Math.round(m/1440)} วันที่แล้ว`;};
function apply(j){st.licenseId=j.license?j.license.id:st.licenseId;st.label=j.license?j.license.label:st.label;
  if(j.graceUntil)st.graceUntil=j.graceUntil;if(j.heartbeatSec)st.heartbeatSec=j.heartbeatSec;
  if("bound" in j){st.bound=!!j.bound;st.repoHint=j.repoHint||"";st.rebindsLeft=j.rebindsLeft;}save();}

/* ---------- full-screen cards (same look as the GitHub connect screen) ---------- */
function card(inner,sub,cls){
  const el=document.createElement("div");el.className="gate "+(cls||"");
  el.innerHTML=`<div class="gate-in"><div class="gate-lang" data-lang></div><div class="gate-hero" aria-hidden="true"><svg class="lg" width="64" height="64" viewBox="0 0 40 40" aria-hidden="true"><rect class="lg-bg" width="40" height="40" rx="11"/><g transform="translate(-1.5 1.5) rotate(42 20 20)"><path class="lg-sk" d="M16 21.5 10.5 7Q20 3 29.5 7L24 21.5Z"/><path class="lg-rib" d="M17.4 21 14.2 5.8M20 21V4.6M22.6 21 25.8 5.8" stroke-width="1.1" stroke-linecap="round"/><circle class="lg-hd" cx="20" cy="26.2" r="5.6"/></g></svg></div><div class="gate-brand"><div><h1>ก๊วนแบด</h1><p>${esc(sub||"ยืนยันใบอนุญาตใช้งาน")}</p></div></div>${inner}</div>`;
  document.body.appendChild(el);if(typeof I18N!=="undefined")I18N.mountAll();return el;
}
const note=(t,kind)=>`<div class="notice ${kind==="info"?"":"warn"}" role="alert">${t}</div>`;
const busy=(b,on_,t)=>{if(!b)return;if(on_){b.dataset.t=b.textContent;b.textContent=t||"กำลังตรวจสอบ…";b.disabled=true;}else{b.textContent=b.dataset.t||b.textContent;b.disabled=false;}};

async function login(key,deviceName){return call("api/v1/login",{key,deviceId:deviceId(),deviceName});}
function inUseNote(j){return note(`<b>ใบอนุญาตนี้กำลังใช้งานบนเครื่อง “${esc(j.device)}”</b> (ใช้ล่าสุด ${esc(fmtAgo(j.lastSeen))})<br><span class="small">ใช้ได้ทีละ 1 เครื่อง — วิธีย้ายมาเครื่องนี้:<br>1) เปิดแอปบนเครื่อง “${esc(j.device)}” → ตั้งค่า → <b>ออกจากระบบใบอนุญาต</b> แล้วกลับมากด “ลองอีกครั้ง”<br>2) หรือรอให้เครื่องนั้นไม่ได้เปิดแอปครบ ${esc(j.idleHours)} ชั่วโมง ระบบจะปล่อยให้เอง<br>3) เครื่องเดิมหายหรือเสีย: ติดต่อผู้ขายให้รีเซ็ตที่นั่ง</span>`);}

/* gate: ask for the key; resolves when a seat has been granted */
function gate(first){
  return new Promise(resolve=>{
    const render=(msg)=>{
      if(gateEl)gateEl.remove();
      gateEl=card(`<form id="licForm" class="gform" novalidate><p class="small muted" style="margin:0">กรอก<b>รหัสใบอนุญาต</b>ที่ได้รับตอนซื้อ (ขึ้นต้น BGO-) — ใช้ครั้งเดียวต่อเครื่อง แอปจำไว้ให้</p>
        <div id="licNote">${msg||""}</div>
        <label class="f">รหัสใบอนุญาต<input name="key" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="BGO-XXXX-XXXX-XXXX-XXXX" value="${esc(st.key||"")}"><span class="ferr"></span></label>
        <label class="f">ชื่อเครื่องนี้ (ไว้บอกว่าเครื่องไหนกำลังใช้อยู่)<input name="dev" maxlength="40" autocomplete="off" value="${esc(st.deviceName||guessDevice())}"></label>
        <button class="primary" type="submit">เปิดใช้งาน</button></form>
        <p class="small muted gfoot">ซื้อขาด ใช้ได้ถาวร ไม่ต้องต่ออายุ · 1 ใบอนุญาตใช้ได้ทีละ 1 เครื่อง · ผู้เล่นไม่ต้องมีใบอนุญาต</p>`,"ยืนยันใบอนุญาตใช้งาน");
      const f=gateEl.querySelector("#licForm"),k=f.elements.key;setTimeout(()=>k.focus(),50);
      f.addEventListener("submit",async e=>{
        e.preventDefault();const key=k.value.trim(),dev=f.elements.dev.value.trim()||guessDevice();
        k.classList.remove("bad");f.querySelector(".ferr").textContent="";
        if(!/^BGO-/i.test(key)||key.length<12){k.classList.add("bad");f.querySelector(".ferr").textContent="รหัสต้องขึ้นต้นด้วย BGO- (ดูในข้อความที่ผู้ขายส่งให้)";k.focus();return;}
        const btn=f.querySelector("[type=submit]");busy(btn,true);
        try{
          const r=await login(key,dev);
          if(r.status===200){st.key=key.toUpperCase().replace(/\s+/g,"");st.deviceName=dev;apply(r.json);gateEl.remove();gateEl=null;resolve(true);return;}
          busy(btn,false);
          if(r.status===404){k.classList.add("bad");f.querySelector(".ferr").textContent=r.json.message||"ไม่พบรหัสนี้";k.focus();}
          else if(r.status===409){st.key=key;st.deviceName=dev;save();render(inUseNote(r.json)+`<div class="grow"><button type="button" class="ghost" id="licRetry">ลองอีกครั้ง</button></div>`);gateEl.querySelector("#licRetry").onclick=()=>gateEl.querySelector("#licForm").requestSubmit();}
          else document.getElementById("licNote").innerHTML=note(esc(r.json.message||"ไม่สำเร็จ ("+r.status+")"));
        }catch(err){busy(btn,false);document.getElementById("licNote").innerHTML=note("เชื่อมต่อเซิร์ฟเวอร์ใบอนุญาตไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่");}
      });
    };
    render(first||"");
  });
}

/* start: called before the app boots. resolves true when the app may run */
async function start(){
  if(!on)return true;
  if(started)return true;
  if(st.key){
    try{
      const r=await login(st.key,st.deviceName||guessDevice());
      if(r.status===200){apply(r.json);begin();return true;}
      if(r.status===409){await gate(inUseNote(r.json)+`<div class="grow"><button type="button" class="ghost" id="licRetry">ลองอีกครั้ง</button></div>`);begin();return true;}
      if(r.status===404||r.status===403){const m=r.json.message||"ใบอนุญาตใช้ไม่ได้";if(r.status===404){st.key="";save();}await gate(note(esc(m)));begin();return true;}
      await gate(note(esc(r.json.message||"ไม่สำเร็จ ("+r.status+")")));begin();return true;
    }catch(net){   // server unreachable: keep working inside the grace window
      if(st.graceUntil&&Date.now()<st.graceUntil){begin();return true;}
      await gate(note("ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อยืนยันใบอนุญาตก่อน (ออฟไลน์นานเกินกำหนดแล้ว)"));begin();return true;
    }
  }
  await gate();begin();return true;
}
function begin(){
  started=true;if(timer)clearInterval(timer);
  timer=setInterval(pulse,Math.max(5,st.heartbeatSec||300)*1000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")pulse();});
  window.addEventListener("online",()=>pulse());
}

/* ---------- heartbeat + lock screens ---------- */
function unlock(){if(lockEl){lockEl.remove();lockEl=null;}}
function lock(kind,j){
  unlock();const repo=(typeof GH!=="undefined"&&GH.cfg&&GH.cfg.repo)||"";
  const keep=`<p class="small muted" style="margin:0">ข้อมูลที่ยังไม่ได้ส่งขึ้น GitHub ยังอยู่ในเครื่องและจะส่งต่อเมื่อกลับมาใช้งานได้</p>`;
  let body="";
  if(kind==="seat_lost")body=`${note("<b>ใบอนุญาตนี้ถูกใช้งานบนเครื่องอื่นแล้ว</b> (หรือผู้ขายรีเซ็ตที่นั่ง) — เครื่องนี้ใช้ต่อไม่ได้จนกว่าจะได้ที่นั่งกลับ")}${keep}<div id="lkMsg"></div><div class="grow"><button class="primary" id="lkRetry">ขอใช้ที่นั่งนี้อีกครั้ง</button><button class="ghost" id="lkOut">ออกจากระบบใบอนุญาต</button></div>`;
  else if(kind==="revoked")body=`${note("<b>ใบอนุญาตนี้ถูกระงับ</b> — ติดต่อผู้ขาย")}${keep}<div class="grow"><button class="ghost" id="lkOut">ออกจากระบบใบอนุญาต</button></div>`;
  else if(kind==="mismatch"){const left=j&&j.rebindsLeft||0;body=`${note(`<b>ใบอนุญาตนี้ผูกกับก๊วน ${esc(j&&j.repoHint||"")} แล้ว</b> แต่เครื่องนี้กำลังใช้กับก๊วน <b>${esc(repo)}</b><br><span class="small">1 ใบอนุญาตใช้ได้กับ 1 ก๊วน${left>0?` — ถ้าต้องการย้ายมาใช้กับก๊วนนี้ กดปุ่มด้านล่าง (เหลือสิทธิ์ย้าย ${left} ครั้ง)`:" และสิทธิ์ย้ายหมดแล้ว — ติดต่อผู้ขาย"}</span>`)}${keep}<div id="lkMsg"></div><div class="grow">${left>0?`<button class="primary" id="lkRebind">ย้ายใบอนุญาตมาใช้กับก๊วนนี้</button>`:""}<button class="ghost" id="lkOut">ออกจากระบบใบอนุญาต</button></div>`;}
  else body=`${note("<b>ไม่ได้เชื่อมต่ออินเทอร์เน็ตนานเกินกำหนด</b> — ต้องเชื่อมต่อเพื่อยืนยันใบอนุญาตก่อนใช้งานต่อ")}${keep}<div class="grow"><button class="primary" id="lkRetry">ลองอีกครั้ง</button></div>`;
  lockEl=card(`<div class="gform">${body}</div>`,"ใบอนุญาต","lock");
  const q=id=>lockEl&&lockEl.querySelector(id),msg=t=>{const m=q("#lkMsg");if(m)m.innerHTML=t;};
  const retry=q("#lkRetry");if(retry)retry.onclick=async()=>{busy(retry,true);
    try{const r=await login(st.key,st.deviceName||guessDevice());if(r.status===200){apply(r.json);unlock();pulse();return;}busy(retry,false);
      if(r.status===409)msg(inUseNote(r.json));else msg(note(esc(r.json.message||"ไม่สำเร็จ")));}catch(e){busy(retry,false);msg(note("เชื่อมต่อไม่ได้ — ตรวจอินเทอร์เน็ต"));}};
  const rb=q("#lkRebind");if(rb)rb.onclick=async()=>{if(!confirm(`ย้ายใบอนุญาตไปผูกกับก๊วน ${repo}?\nสิทธิ์ย้ายจะลดลง 1 ครั้ง (เหลือ ${Math.max(0,(j.rebindsLeft||1)-1)} ครั้ง)`))return;busy(rb,true);
    try{const r=await call("api/v1/rebind",{repo});if(r.status===200){apply({...r.json});unlock();toast&&toast("ย้ายใบอนุญาตแล้ว ✓");}else{busy(rb,false);msg(note(esc(r.json.message||"ย้ายไม่สำเร็จ")));}}catch(e){busy(rb,false);msg(note("เชื่อมต่อไม่ได้"));}};
  const out=q("#lkOut");if(out)out.onclick=()=>logout(true);
}
let pulsing=false;
async function pulse(){
  if(!on||!started||gateEl||pulsing)return;pulsing=true;
  try{
    const repo=(typeof GH!=="undefined"&&GH.cfg&&GH.cfg.repo)||"";
    const r=await call("api/v1/heartbeat",{deviceId:deviceId(),...(repo?{repo}:{})});
    if(r.status===200){apply(r.json);if(lockEl)unlock();}
    else if(r.status===401)lock("seat_lost");
    else if(r.status===403&&r.json.error==="revoked")lock("revoked");
    else if(r.status===403&&r.json.error==="repo_mismatch")lock("mismatch",r.json);
  }catch(net){const g=(()=>{try{return JSON.parse(localStorage.getItem(LS)||"{}").graceUntil||st.graceUntil;}catch(e){return st.graceUntil;}})();   // read the shared copy: another tab may have renewed it
    if(g&&Date.now()>g)lock("offline");}
  finally{pulsing=false;}
}

/* ---------- logout (release the seat so another device can log in) ---------- */
async function logout(force){
  if(!force&&!confirm("ออกจากระบบใบอนุญาตบนเครื่องนี้?\n\nใช้เมื่อจะย้ายไปใช้แอปผู้จัดบนเครื่องอื่น — ข้อมูลก๊วนอยู่บน GitHub ไม่หาย"))return;
  try{const r=await call("api/v1/logout",{});if(r.status>=500)throw new Error("server");}
  catch(e){if(!force){alert("ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อออกจากระบบใบอนุญาต (เพื่อปล่อยที่นั่งให้เครื่องอื่น)");return;}}
  st={deviceId:st.deviceId};save();
  try{for(const k of await caches.keys()){const c=await caches.open(k);await c.delete("organizer.js");await c.delete(new URL("organizer.js",document.baseURI).href);}}catch(e){}
  location.reload();
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-lic]");if(b&&b.dataset.lic==="logout")logout(false);});

/* ---------- settings panel ---------- */
function panel(){
  if(!on||!st.key)return "";
  return `<section class="panel"><div class="ph"><h2>ใบอนุญาต</h2></div>
  <div class="tw"><table class="kvtbl"><tbody>
    <tr><th>ผู้ได้รับสิทธิ์</th><td>${esc(st.label||"")}</td></tr>
    <tr><th>เลขที่ใบอนุญาต</th><td class="num">${esc(st.licenseId||"")}</td></tr>
    <tr><th>เครื่องนี้</th><td>${esc(st.deviceName||"")}</td></tr>
    <tr><th>ผูกกับก๊วน</th><td>${st.bound?esc(st.repoHint||""):'<span class="muted">ยังไม่ผูก (ผูกอัตโนมัติเมื่อเชื่อม GitHub)</span>'}${st.bound?` <span class="muted">· ย้ายก๊วนได้อีก ${+st.rebindsLeft||0} ครั้ง</span>`:""}</td></tr>
    <tr><th>สิทธิ์</th><td>ซื้อขาด ใช้ได้ถาวร · ใช้ได้ทีละ 1 เครื่อง</td></tr></tbody></table></div>
  <p class="small muted" style="margin:10px 0 0">จะย้ายไปใช้เครื่องอื่น: กด <b>ออกจากระบบใบอนุญาต</b> ที่นี่ก่อน แล้วกรอกรหัสบนเครื่องใหม่ (ข้อมูลก๊วนอยู่บน GitHub ไม่หาย)</p>
  <div class="dlg-a" style="justify-content:flex-start;margin-top:10px"><button class="danger" data-lic="logout">ออกจากระบบใบอนุญาต (ย้ายเครื่อง)</button></div></section>`;
}

/* ---------- load the organizer code (served only to the seat holder when licensing is on) ---------- */
function loadScript(src){return new Promise((ok,bad)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=()=>bad(new Error(src));document.head.appendChild(s);});}
async function loadOrganizer(){
  try{await loadScript("organizer.js");return true;}
  catch(e){
    const el=card(`<div class="gform">${note("<b>โหลดแอปผู้จัดไม่สำเร็จ</b> — ตรวจอินเทอร์เน็ตหรือสถานะใบอนุญาต แล้วลองใหม่")}<div class="grow"><button class="primary" id="ldRetry">ลองใหม่</button>${on?'<button class="ghost" id="ldOut">ออกจากระบบใบอนุญาต</button>':""}</div></div>`,"โหลดไม่สำเร็จ","lock");
    el.querySelector("#ldRetry").onclick=()=>location.reload();const o=el.querySelector("#ldOut");if(o)o.onclick=()=>logout(true);return false;
  }
}
return {on,start,pulse,panel,logout,loadOrganizer,info:()=>({...st,key:undefined})};
})();
