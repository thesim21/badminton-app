/* ghui.js — หน้าจอเชื่อมต่อ GitHub: ผู้เล่นวางรหัสเชิญ · ผู้จัดตั้งระบบครั้งแรก/เครื่องใหม่ · สถานะซิงก์ · เชิญผู้เล่น (QR) · ทดสอบการเชื่อมต่อ */
"use strict";
const GHUI=(()=>{
const h=esc;
const wanted=()=>location.protocol!=="file:"&&!QS.get("local");
let fpCache="",gate=null;
const isOrgPage=()=>PAGE()==="index";
const DEV_API=(/^(localhost|127\.0\.0\.1)$/.test(location.hostname)&&QS.get("api"))||"";   // test servers only

/* ---------- full-screen gate (connect / unlock) ---------- */
function showGate(inner,opts={}){
  hideShells(true);
  if(!gate){gate=document.createElement("div");gate.id="ghGate";gate.className="gate";document.body.appendChild(gate);}
  gate.innerHTML=`<div class="gate-in"><div class="gate-lang" data-lang></div><div class="gate-hero" aria-hidden="true"><svg class="lg" width="64" height="64" viewBox="0 0 40 40" aria-hidden="true"><rect class="lg-bg" width="40" height="40" rx="11"/><g transform="translate(-1.5 1.5) rotate(42 20 20)"><path class="lg-sk" d="M16 21.5 10.5 7Q20 3 29.5 7L24 21.5Z"/><path class="lg-rib" d="M17.4 21 14.2 5.8M20 21V4.6M22.6 21 25.8 5.8" stroke-width="1.1" stroke-linecap="round"/><circle class="lg-hd" cx="20" cy="26.2" r="5.6"/></g></svg></div><div class="gate-brand">
    <div><h1>ก๊วนแบด</h1><p>${h(opts.sub||"เชื่อมต่อข้อมูลก๊วนผ่าน GitHub")}</p></div></div>${inner}</div>`;
  gate.hidden=false;if(typeof I18N!=="undefined")I18N.mountAll();return gate;
}
function hideShells(hide){["orgShell","plShell"].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=hide?"none":"";});}
function closeGate(){if(gate){gate.remove();gate=null;}hideShells(false);}
const gerr=(e)=>{const x=GH.explain(e);return `<div class="notice warn" role="alert"><b>${h(x.t)}</b>${x.fix?`<br><span class="small">${h(x.fix)}</span>`:""}</div>`;};
const msg=t=>`<div class="notice warn" role="alert">${h(t)}</div>`;
/* token expiry: a date typed by the organizer (YYYY-MM-DD, local). It counts as expired from the START of that day — the safe side. */
const expAt=x=>/^\d{4}-\d{2}-\d{2}$/.test(x||"")?new Date(x+"T00:00:00").getTime():0;
const daysLeft=x=>{const e=expAt(x);return e?Math.ceil((e-Date.now())/864e5):null;};
const fmtDate=x=>{const e=expAt(x);return e?new Date(e).toLocaleDateString(LOC(),{day:"numeric",month:"short",year:"numeric"}):"";};
function checkExp(x){if(!x)return "";const e=expAt(x);if(!e||isNaN(e))return "วันที่ไม่ถูกต้อง";if(e<=Date.now())return "วันหมดอายุต้องเป็นวันในอนาคต";if(e>Date.now()+800*864e5)return "ไกลเกินไป (GitHub ให้ตั้งได้สูงสุดประมาณ 1 ปี หรือไม่หมดอายุ) — เว้นว่างถ้าเลือก No expiration";return "";}
function busy(btn,on,txt){if(!btn)return;if(on){btn.dataset.t=btn.textContent;btn.textContent=txt||"กำลังตรวจสอบ…";btn.disabled=true;}else{btn.textContent=btn.dataset.t||btn.textContent;btn.disabled=false;}}

/* ---------- connect screen ---------- */
const TOKEN_LINK=days=>"https://github.com/settings/personal-access-tokens/new?name=badminton-club-data&description=Club+data+%28Contents+read+and+write%29&expires_in="+days+"&contents=write";
const HOWTO=`<details class="howto"><summary>ยังไม่มี repo / โทเคน? ดูวิธีทำ (ประมาณ 3 นาที)</summary><ol>
  <li><b>สร้าง repo เก็บข้อมูล</b> — GitHub → <b>New repository</b> → ตั้งชื่อ (เช่น <code>badminton-data</code>) → เลือก <b>Private</b> → ติ๊ก <b>Add a README file</b> → Create</li>
  <li><b>สร้างโทเคน</b> — กดลิงก์ลัดที่กรอกชื่อและสิทธิ์ให้แล้ว:<br>
    • <a href="${TOKEN_LINK("none")}" target="_blank" rel="noopener">โทเคนไม่หมดอายุ (No expiration) ↗</a> — ไม่ต้องต่ออายุ<br>
    • <a href="${TOKEN_LINK(366)}" target="_blank" rel="noopener">โทเคนอายุ 1 ปี ↗</a> — ปลอดภัยกว่า แต่ต้องต่อปีละครั้ง<br>
    แล้วตั้ง <b>Repository access → Only select repositories</b> → เลือก repo ข้อมูลอันนี้เท่านั้น (ข้อนี้ลิงก์ลัดตั้งให้ไม่ได้) → <b>Generate token</b> → คัดลอกโทเคน (ขึ้นต้น <code>github_pat_</code>)<br>
    <span class="muted">เปิดเองได้: รูปโปรไฟล์ → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token (Permissions → Contents: Read and write)</span></li>
  <li>กลับมากรอกช่องด้านล่าง (ถ้าตั้งวันหมดอายุไว้ ใส่วันที่ด้วย — แอปจะเตือนล่วงหน้า) แล้วตั้ง<b>รหัสผ่านผู้จัด</b> (ใช้ปลดล็อกข้อมูลสมาชิก/สลิป — <b>ลืมแล้วกู้คืนไม่ได้</b>)</li></ol></details>`;

function connectScreen(tab,note){
  tab=tab||(isOrgPage()?"setup":"join");
  const T=(k,t)=>`<button type="button" role="tab" class="${tab===k?"on":""}" aria-selected="${tab===k}" data-gtab="${k}">${t}</button>`;
  let body="";
  if(tab==="join")body=`<form id="gForm" novalidate class="gform"><p class="small muted" style="margin:0">ขอ<b>ลิงก์หรือรหัสเชิญ</b>จากผู้จัดก๊วน แล้ววางที่นี่ (หรือเปิดลิงก์เชิญบนมือถือเครื่องนี้ได้เลย)</p>
      <label class="f">รหัสเชิญ<textarea name="code" rows="3" placeholder="วางลิงก์หรือรหัสที่ขึ้นต้นด้วย BGO1." autocapitalize="off" autocomplete="off" spellcheck="false"></textarea><span class="ferr"></span></label>
      <label class="f">ชื่อที่ใช้ในก๊วน (ไม่บังคับ — ตั้งทีหลังได้)<input name="pname" maxlength="30" autocomplete="nickname"></label>
      <button class="primary" type="submit">เชื่อมต่อ</button></form>`;
  if(tab==="setup")body=`${HOWTO}<form id="gForm" novalidate class="gform">
      <label class="f">repo เก็บข้อมูล (เจ้าของ/ชื่อ)<input name="repo" placeholder="somchai/badminton-data" autocapitalize="off" autocomplete="off" spellcheck="false"><span class="ferr"></span></label>
      <label class="f">โทเคน (Fine-grained, Contents: Read and write)<input name="token" type="password" placeholder="github_pat_…" autocapitalize="off" autocomplete="off" spellcheck="false"><span class="ferr"></span></label>
      <label class="f">โทเคนหมดอายุวันที่ (เว้นว่างถ้าเลือก No expiration)<input name="texp" type="date"><span class="ferr"></span></label>
      <div class="fg2"><label class="f">branch<input name="branch" value="main" autocapitalize="off" autocomplete="off"></label>
      <label class="f">ชื่อก๊วน<input name="group" maxlength="40" placeholder="เช่น ก๊วนแบดวันศุกร์"></label></div>
      <label class="f">รหัสผ่านผู้จัด (อย่างน้อย 8 ตัว)<input name="pass" type="password" autocomplete="new-password"><span class="ferr"></span></label>
      <label class="f">ยืนยันรหัสผ่านผู้จัด<input name="pass2" type="password" autocomplete="new-password"><span class="ferr"></span></label>
      <p class="small muted" style="margin:0">รหัสผ่านนี้ไม่ถูกส่งไปที่ใดเลย ใช้เข้ารหัสข้อมูลสมาชิก บันทึกผู้จัด และสลิป — <b>จดเก็บไว้ ลืมแล้วกู้คืนไม่ได้</b></p>
      <button class="primary" type="submit">ตรวจสอบและสร้างระบบ</button></form>`;
  if(tab==="device")body=`<form id="gForm" novalidate class="gform"><p class="small muted" style="margin:0">ใช้เมื่อมีระบบก๊วนอยู่แล้ว และต้องการเปิดแอปผู้จัดบนเครื่องนี้ — ต้องมี<b>รหัสเชิญ</b>และ<b>รหัสผ่านผู้จัด</b>เดิม</p>
      <label class="f">รหัสเชิญ<textarea name="code" rows="3" placeholder="วางลิงก์หรือรหัสที่ขึ้นต้นด้วย BGO1." autocapitalize="off" autocomplete="off" spellcheck="false"></textarea><span class="ferr"></span></label>
      <label class="f">รหัสผ่านผู้จัด<input name="pass" type="password" autocomplete="current-password"><span class="ferr"></span></label>
      <label class="check"><input type="checkbox" name="remember" checked> จำเครื่องนี้ (ไม่ต้องใส่รหัสผ่านทุกครั้งที่เปิดแอป)</label>
      <button class="primary" type="submit">ปลดล็อกแอปผู้จัด</button></form>`;
  const g=showGate(`<div class="gtabs" role="tablist">${T("join","ผู้เล่น")}${T("setup","ผู้จัด · ตั้งระบบใหม่")}${T("device","ผู้จัด · เครื่องใหม่")}</div>
    <div id="gNote">${note||""}</div>${body}<p class="small muted gfoot">ข้อมูลทั้งหมดเก็บใน repo ส่วนตัวบน GitHub ของก๊วนเอง · แอปนี้ไม่มีเซิร์ฟเวอร์ของใคร</p>`);
  g.querySelectorAll("[data-gtab]").forEach(b=>b.addEventListener("click",()=>connectScreen(b.dataset.gtab)));
  const f=g.querySelector("#gForm");
  f.addEventListener("submit",e=>{e.preventDefault();({join:doJoin,setup:doSetup,device:doDevice})[tab](f);});
  const first=f.querySelector("textarea,input");if(first&&tab!=="join")setTimeout(()=>first.focus(),50);
}
const fe=(f,n,m)=>{const el=f.elements[n];if(el){el.classList.add("bad");const s=el.parentElement.querySelector(".ferr");if(s)s.textContent=m;el.focus();}return false;};
const clr=f=>f.querySelectorAll(".bad").forEach(x=>{x.classList.remove("bad");const s=x.parentElement.querySelector(".ferr");if(s)s.textContent="";});
const note=(h2)=>{const n=document.getElementById("gNote");if(n)n.innerHTML=h2||"";};

async function doJoin(f){
  clr(f);note("");const btn=f.querySelector("[type=submit]");
  let inv;try{inv=GH.parseInvite(f.elements.code.value);}catch(e){return fe(f,"code",e.message);}
  busy(btn,true);
  try{
    const cfg={...inv,uid:GH.newUid(),role:"player",name:f.elements.pname.value.trim()};
    const r=await GH.check(cfg);
    if(!r.private){busy(btn,false);return note(msg("repo นี้เป็นสาธารณะ — แจ้งผู้จัดให้เปลี่ยนเป็น Private ก่อน"));}
    GH.saveCfg(cfg);location.replace(location.pathname+location.search);
  }catch(e){busy(btn,false);note(gerr(e));}
}
async function doSetup(f){
  clr(f);note("");const v=n=>f.elements[n].value.trim();
  if(!/^[\w.-]+\/[\w.-]+$/.test(v("repo")))return fe(f,"repo","ใส่ในรูป เจ้าของ/ชื่อ เช่น somchai/badminton-data");
  if(!v("token"))return fe(f,"token","ใส่โทเคน");
  {const m=checkExp(v("texp"));if(m)return fe(f,"texp",m);}
  if(f.elements.pass.value.length<8)return fe(f,"pass","อย่างน้อย 8 ตัวอักษร");
  if(f.elements.pass.value!==f.elements.pass2.value)return fe(f,"pass2","รหัสผ่านสองช่องไม่ตรงกัน");
  const btn=f.querySelector("[type=submit]");busy(btn,true,"กำลังสร้างระบบ… (ตั้งกุญแจเข้ารหัส ใช้เวลาไม่กี่วินาที)");
  try{
    const r=await GH.setupOrg({repo:v("repo"),branch:v("branch")||"main",token:v("token"),api:DEV_API,pass:f.elements.pass.value,group:v("group"),tokenExp:v("texp")});
    if(r.exists){busy(btn,false);return note(msg("repo นี้มีระบบก๊วนอยู่แล้ว — ถ้าคุณคือผู้จัด ให้ใช้แท็บ “ผู้จัด · เครื่องใหม่” ด้วยรหัสเชิญและรหัสผ่านเดิม"));}
    r.cfg.name="";if(v("group"))r.cfg.initGroup=v("group");GH.saveCfg(r.cfg);
    const fp=r.cfg.fp;
    showGate(`<div class="panel gdone"><h2>สร้างระบบก๊วนแล้ว ✓</h2>
      <p>ข้อมูลถูกเก็บใน <b>${h(r.cfg.repo)}</b> (Private) และเข้ารหัสส่วนที่อ่อนไหวด้วยรหัสผ่านผู้จัดของคุณแล้ว</p>
      <div class="notice warn"><b>จดรหัสผ่านผู้จัดไว้ในที่ปลอดภัย</b> — ระบบไม่เก็บและกู้คืนให้ไม่ได้ ถ้าลืม ข้อมูลสมาชิกและบันทึกผู้จัดจะเปิดไม่ได้อีก</div>
      <p class="small muted">รหัสตรวจกุญแจผู้จัด: <b class="num">${h(fp)}</b></p>
      <p class="small">ขั้นต่อไป: เข้าแอปแล้วไปที่ <b>ตั้งค่า → เชิญผู้เล่น</b> เพื่อส่งลิงก์/QR ให้ผู้เล่นติดตั้งแอป</p>
      <button class="primary" id="gGo">เริ่มใช้งาน</button></div>`,{sub:"ตั้งค่าเสร็จแล้ว"});
    gate.querySelector("#gGo").addEventListener("click",()=>location.replace(location.pathname+location.search));
  }catch(e){busy(btn,false);if(e.kind==="public")note(msg(e.message));else if(e.kind||e.message)note(e.kind?gerr(e):msg(e.message));}
}
async function doDevice(f){
  clr(f);note("");
  let inv;try{inv=GH.parseInvite(f.elements.code.value);}catch(e){return fe(f,"code",e.message);}
  if(!f.elements.pass.value)return fe(f,"pass","ใส่รหัสผ่านผู้จัด");
  const btn=f.querySelector("[type=submit]");busy(btn,true,"กำลังปลดล็อก…");
  try{
    const cfg={...inv,uid:GH.newUid(),role:"org",name:""};
    const r=await GH.unlockOrg(cfg,f.elements.pass.value,f.elements.remember.checked);
    cfg.fp=r.fp;GH.saveCfg(cfg);location.replace(location.pathname+location.search);
  }catch(e){busy(btn,false);if(e.kind)note(gerr(e));else fe(f,"pass",e.message);}
}

/* ---------- unlock screen (organizer device without saved keys) ---------- */
function unlockScreen(cfg){
  const g=showGate(`<form id="gForm" class="gform" novalidate><h2 style="margin:0">ปลดล็อกแอปผู้จัด</h2><p class="small muted" style="margin:0">กลุ่ม ${h(cfg.repo)} — ใส่รหัสผ่านผู้จัดเพื่ออ่านข้อมูลสมาชิก สลิป และบันทึกผู้จัด</p>
    <div id="gNote"></div><label class="f">รหัสผ่านผู้จัด<input name="pass" type="password" autocomplete="current-password"><span class="ferr"></span></label>
    <label class="check"><input type="checkbox" name="remember" checked> จำเครื่องนี้</label>
    <button class="primary" type="submit">ปลดล็อก</button>
    <div class="grow"><button type="button" class="ghost" id="gAsPlayer">ใช้เป็นผู้เล่นก่อน</button><button type="button" class="ghost" id="gOut">ออกจากระบบเครื่องนี้</button></div></form>`,{sub:"แอปผู้จัดก๊วน"});
  const f=g.querySelector("#gForm");setTimeout(()=>f.elements.pass.focus(),50);
  return new Promise(()=>{   // never resolves: success reloads the page
    f.addEventListener("submit",async e=>{e.preventDefault();clr(f);if(!f.elements.pass.value)return fe(f,"pass","ใส่รหัสผ่าน");
      const btn=f.querySelector("[type=submit]");busy(btn,true,"กำลังปลดล็อก…");
      try{const r=await GH.unlockOrg(cfg,f.elements.pass.value,f.elements.remember.checked);if(!cfg.fp){cfg.fp=r.fp;GH.saveCfg(cfg);}location.replace(location.pathname+location.search);}
      catch(err){busy(btn,false);if(err.kind)note(gerr(err));else fe(f,"pass",err.message);}});
    g.querySelector("#gAsPlayer").addEventListener("click",()=>{GH.saveCfg({...cfg,role:"player"});location.replace("player.html");});
    g.querySelector("#gOut").addEventListener("click",()=>disconnect(true));
  });
}

/* ---------- boot ---------- */
function takeInviteFromUrl(){
  const m=location.hash.match(/(?:^#|&)(?:c|join)=([^&]+)/);if(!m)return null;
  try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}
  try{return GH.parseInvite(decodeURIComponent(m[1]));}catch(e){return {error:e.message};}
}
async function start(){
  if(!(window.crypto&&crypto.subtle)){showGate(msg("เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส — ต้องเปิดแอปผ่านลิงก์ https:// ของ GitHub Pages"),{sub:"เปิดไม่ได้"});return false;}
  let cfg=GH.loadCfg();
  const inv=takeInviteFromUrl();
  if(inv&&inv.error){connectScreen("join",msg(inv.error));return false;}
  if(inv){
    const same=cfg&&cfg.repo===inv.repo&&(cfg.api||"")===(inv.api||"");
    if(!cfg||same||confirm(`เปลี่ยนไปใช้ก๊วน ${inv.repo}?\nข้อมูลของก๊วนเดิมที่ยังไม่ได้ส่งขึ้น GitHub จะหายไป`)){
      cfg=same?{...cfg,token:inv.token,branch:inv.branch,fp:cfg.fp||inv.fp,tokenExp:inv.tokenExp}:{...inv,uid:GH.newUid(),role:"player",name:""};
      if(!same&&cfg0Exists())await GH.wipeLocal(GH.loadCfg()||cfg);
      GH.saveCfg(cfg);
    }
  }
  if(!cfg){connectScreen();return false;}
  if(cfg.role==="org"&&!(await GH.hasSavedKeys(cfg))){await unlockScreen(cfg);return false;}
  DB.mode="gh";DB.uid=cfg.uid;DB.meName=cfg.name||"";DB.viewOnly=false;
  GH.onStatus(onStatus);
  await Promise.race([GH.init(cfg),new Promise(r=>setTimeout(r,8000))]);
  DB.realOrg=cfg.role==="org"&&GH.status().unlocked;
  if(cfg.role==="org"&&!DB.realOrg){await unlockScreen(cfg);return false;}
  mount();
  if(cfg.initGroup&&DB.realOrg){   // first run after setup: save the group name the organizer typed
    try{if(!(await GH.readDoc("cfg/main")))await GH.setDoc("cfg/main",{group:cfg.initGroup});delete cfg.initGroup;GH.saveCfg(cfg);}catch(e){}
  }
  return true;
}
const cfg0Exists=()=>!!GH.loadCfg();
window.addEventListener("hashchange",()=>{   // an invite link opened while the app is already running
  if(DB.mode!=="gh"||!/(?:^#|&)(?:c|join)=/.test(location.hash))return;
  const inv=takeInviteFromUrl();if(!inv||inv.error){if(inv)toast(inv.error);return;}
  const c=GH.loadCfg();
  if(c&&inv.repo===c.repo&&(c.api||"")===(inv.api||"")){GH.saveCfg({...c,token:inv.token,branch:inv.branch,fp:c.fp||inv.fp,tokenExp:inv.tokenExp});toast("อัปเดตรหัสเข้าถึงแล้ว");setTimeout(()=>location.reload(),600);return;}   // same group (token renewed): no question asked
  if(confirm(`เปลี่ยนไปใช้ก๊วน ${inv.repo}?\nข้อมูลของก๊วนเดิมที่ยังไม่ได้ส่งขึ้น GitHub จะหายไป`)){GH.wipeLocal(c).then(()=>{GH.saveCfg({...inv,uid:GH.newUid(),role:"player",name:""});location.reload();});}
});

/* ---------- status text + dot ---------- */
function statusText(s){
  const need=GH.cfg&&!GH.meta&&GH.status().state==="ok";
  if(s.warn==="fp")return "⚠ กุญแจผู้จัดไม่ตรง — อย่าส่งสลิป";
  switch(s.state){
    case "init":return "กำลังเชื่อมต่อ…";
    case "ok":return need?"รอผู้จัดตั้งระบบ":"ซิงก์แล้ว";
    case "sync":return `กำลังส่ง ${s.pending} รายการ`;
    case "offline":return s.pending?`ออฟไลน์ · รอส่ง ${s.pending}`:"ออฟไลน์";
    case "rate":return s.pending?`รอโควตา GitHub · รอส่ง ${s.pending}`:"รอโควตา GitHub";
    case "auth":return s.pending?`โทเคนมีปัญหา · รอส่ง ${s.pending}`:"โทเคนมีปัญหา";
    case "err":return s.pending?`บันทึกไม่สำเร็จ · ${s.pending}`:"บันทึกไม่สำเร็จ";
  }return "";
}
const dotOf=s=>s.warn==="fp"?"bad":({ok:"ok",init:"wait",sync:"wait",offline:"warn",rate:"warn",auth:"bad",err:"bad"})[s.state]||"wait";
function connText(kind){const s=GH.status();return kind==="org"?`แอปผู้จัดก๊วน · ${statusText(s)}`:statusText(s);}
let lastSig="";
function onStatus(s){
  const sig=s.state+"|"+s.pending+"|"+s.warn+"|"+(GH.meta?1:0);
  [document.getElementById("connNote"),document.getElementById("pConn")].forEach(el=>{if(el)el.dataset.ghs=dotOf(s);});
  if(sig!==lastSig){lastSig=sig;if(typeof render==="function")render();}
  if(s.warn==="fp"&&!onStatus.warned){onStatus.warned=true;toast("⚠ กุญแจของผู้จัดใน repo ไม่ตรงกับที่ได้รับเชิญ — แจ้งผู้จัดก่อนส่งสลิป");}
}
function mount(){
  GH.fingerprint().then(f=>{fpCache=f;if(typeof render==="function")render();}).catch(()=>{});
  [document.getElementById("connNote"),document.getElementById("pConn")].forEach(el=>{if(!el)return;el.setAttribute("role","button");el.tabIndex=0;el.title="แตะเพื่อดูสถานะการเชื่อมต่อ";el.classList.add("ghnote");el.dataset.ghs=dotOf(GH.status());});
  onStatus(GH.status());
  if(typeof LIC!=="undefined"&&LIC.on)LIC.pulse();   // tell the licence server which club this seat is used for
  GH.ready.then(()=>{if(!GH.meta&&DB.realOrg)toast("ยังไม่พบไฟล์ตั้งค่าระบบใน repo — ลองเปิด ตั้งค่า → ทดสอบการเชื่อมต่อ");});
}
document.addEventListener("click",e=>{
  const n=e.target.closest("#connNote,#pConn");if(n&&DB.mode==="gh"){dlgStatus();return;}
  const b=e.target.closest("[data-gh]");if(!b||DB.mode!=="gh")return;
  ({status:dlgStatus,invite:dlgInvite,test:dlgTest,token:dlgToken,newcode:dlgNewCode,disconnect:()=>disconnect(false),retry:()=>{GH.retry();toast("กำลังลองใหม่…");}})[b.dataset.gh]?.();
});
document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("#connNote,#pConn")){e.preventDefault();dlgStatus();}});

/* ---------- dialogs ---------- */
const fmtT=ts=>ts?new Date(ts).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"}):"–";
function expText(x){const d=daysLeft(x);if(d===null)return '<span class="muted">ไม่ได้ระบุ (ไม่หมดอายุ หรือยังไม่ได้ใส่วันที่)</span>';
  return d<=0?`<b class="bad-t">หมดอายุแล้ว (${h(fmtDate(x))})</b>`:`${h(fmtDate(x))} <span class="muted">(อีก ${d} วัน)</span>`;}
function statusRows(s){
  const c=GH.cfg||{};
  const rate=s.rate?`${s.rate.remaining.toLocaleString(LOC())} / ${s.rate.limit.toLocaleString(LOC())} คำขอ/ชม.`:"–";
  return `<tr><th>repo ข้อมูล</th><td class="brk">${h(c.repo||"")} <span class="muted">(${h(c.branch||"")})</span></td></tr>
    <tr><th>สถานะ</th><td><span class="gdot ${dotOf(s)}"></span>${h(statusText(s))}</td></tr>
    <tr><th>ซิงก์ล่าสุด</th><td>${fmtT(s.lastSync)}</td></tr>
    <tr><th>รอส่งขึ้น GitHub</th><td>${s.pending} รายการ</td></tr>
    <tr><th>โควตา GitHub</th><td>${rate}</td></tr>
    <tr><th>โทเคนหมดอายุ</th><td>${expText(c.tokenExp)}</td></tr>
    <tr><th>บทบาทเครื่องนี้</th><td>${c.role==="org"?"ผู้จัด (ปลดล็อกแล้ว)":"ผู้เล่น"}</td></tr>`;
}
function dlgStatus(){
  const s=GH.status(),org=DB.realOrg;
  let alert="";
  if(s.err&&s.state!=="ok"&&s.state!=="init")alert=`<div class="notice warn">${h(s.err)}${s.state==="auth"?`<br><span class="small">${org?"ผู้จัด: สร้างโทเคนใหม่แล้วกด “ต่ออายุโทเคน” — ข้อมูลเดิมไม่หาย จากนั้นส่งลิงก์เชิญใหม่ให้ผู้เล่น":"แจ้งผู้จัดเพื่อขอลิงก์เชิญใหม่ แล้วกด “ใส่รหัสเชิญใหม่”"}</span>`:""}</div>`;
  if(s.truncated)alert+=`<div class="notice warn">ข้อมูลใน repo ใหญ่เกินที่ GitHub ส่งรายการให้ครบ — ควรแยกก๊วนหรือเริ่ม repo ใหม่ (ดูคู่มือ)</div>`;
  openDlg(`<div style="display:grid;gap:12px"><h2>การเชื่อมต่อ GitHub</h2>${alert}
    <div class="tw"><table class="kvtbl"><tbody>${statusRows(s)}</tbody></table></div>
    <p class="small muted" style="margin:0">ข้อมูลที่แก้ไขจะแสดงในเครื่องทันที แล้วส่งขึ้น GitHub ตามลำดับ · เครื่องอื่นเห็นภายในไม่กี่วินาที</p>
    <div class="dlg-a" style="justify-content:flex-start"><button data-gh="retry" data-close>ลองส่งใหม่</button><button data-gh="test">ทดสอบการเชื่อมต่อ</button>
      <a class="btnlike" href="https://github.com/${h((GH.cfg||{}).repo)}/commits/${h((GH.cfg||{}).branch)}" target="_blank" rel="noopener">ประวัติใน GitHub ↗</a>
      ${org?`<button data-gh="invite">เชิญผู้เล่น</button><button data-gh="token">ต่ออายุโทเคน</button>`:""}<button data-gh="newcode">ใส่รหัสเชิญใหม่</button>
      <button data-gh="disconnect" class="danger">ออกจากระบบเครื่องนี้</button><button class="ghost" data-close>ปิด</button></div></div>`);
}
async function dlgTest(){
  openDlg(`<div style="display:grid;gap:12px"><h2>ทดสอบการเชื่อมต่อ</h2><div id="gtOut" class="small">กำลังตรวจสอบ… (เขียน/อ่าน/ลบไฟล์ทดสอบเล็กๆ ใน repo)</div><div class="dlg-a"><button class="ghost" data-close>ปิด</button></div></div>`);
  const out=document.getElementById("gtOut");
  const r=await GH.selfTest().catch(e=>[{ok:false,title:"ทดสอบไม่สำเร็จ",detail:e.message}]);
  if(!document.getElementById("gtOut"))return;
  out.innerHTML=`<ul class="tests">${r.map(x=>`<li class="${x.ok?"ok":x.optional?"opt":"no"}"><b>${x.ok?"✓":x.optional?"!":"✗"}</b><span>${h(x.title)}${x.detail?`<br><span class="muted">${h(x.detail)}</span>`:""}${!x.ok&&x.fix?`<br><span class="fix">${h(x.fix)}</span>`:""}</span></li>`).join("")}</ul>
    <p class="small ${r.some(x=>!x.ok&&!x.optional)?"bad-t":"ok-t"}">${r.some(x=>!x.ok&&!x.optional)?"มีรายการที่ยังไม่ผ่าน — แก้ตามคำแนะนำด้านบนแล้วทดสอบใหม่":"พร้อมใช้งาน"}</p>`;
}
async function dlgInvite(){
  const c=GH.cfg,code=GH.makeInvite(c,c.fp||fpCache),link=new URL("player.html#c="+code,location.href).href;
  openDlg(`<div style="display:grid;gap:12px"><h2>เชิญผู้เล่น</h2>
    <p class="small" style="margin:0">ให้ผู้เล่นสแกน QR หรือเปิดลิงก์บนมือถือ จากนั้น <b>เพิ่มลงหน้าจอหลัก (Add to Home Screen / ติดตั้งแอป)</b></p>
    <div class="qrbox" id="qrBox" aria-label="QR code เชิญผู้เล่น">กำลังสร้าง QR…</div>
    <label class="f">ลิงก์เชิญ<input id="invLink" readonly value="${h(link)}"></label>
    <label class="f">รหัสเชิญ (สำหรับวางในแอปที่ติดตั้งแล้ว)<input id="invCode" readonly value="${h(code)}"></label>
    <div class="dlg-a" style="justify-content:flex-start"><button id="invCopy1" type="button">คัดลอกลิงก์</button><button id="invCopy2" type="button">คัดลอกรหัส</button><button id="invImgSave" type="button">บันทึกรูป QR</button><button id="invImgShare" type="button">ส่งรูป QR เข้า LINE</button>${navigator.share?`<button id="invShare" type="button">แชร์ลิงก์…</button>`:""}<button class="ghost" data-close>ปิด</button></div>
    <div class="notice warn small"><b>ลิงก์นี้ = กุญแจเข้าถึงข้อมูลก๊วน</b> — ส่งเฉพาะสมาชิกที่ไว้ใจ ถ้าหลุด ให้กด “ต่ออายุโทเคน” แล้วส่งลิงก์ใหม่ (ลิงก์เก่าจะใช้ไม่ได้)<br>รหัสตรวจกุญแจผู้จัด <b class="num">${h(c.fp||fpCache||"–")}</b> (ผู้เล่นเทียบกับที่ผู้จัดบอกได้)</div></div>`);
  const cp=async(t,btn)=>{try{await navigator.clipboard.writeText(t);}catch(e){const i=document.getElementById(btn.id==="invCopy1"?"invLink":"invCode");i.select();document.execCommand&&document.execCommand("copy");}const o=btn.textContent;btn.textContent="คัดลอกแล้ว ✓";setTimeout(()=>btn.textContent=o,1500);};
  document.getElementById("invCopy1").onclick=e=>cp(link,e.target);document.getElementById("invCopy2").onclick=e=>cp(code,e.target);
  const qrPic=()=>QRS.cardBlob({text:link,title:`${(typeof cfg==="function"&&cfg().group)||"ก๊วนแบด"} · สแกนเพื่อเข้าร่วม`,lines:["เปิดกล้องมือถือสแกน QR นี้","แล้วเพิ่มลงหน้าจอหลัก (Add to Home Screen)"]});
  document.getElementById("invImgSave").onclick=async e=>{const b=e.target,o=b.textContent;try{QRS.save(await qrPic(),"qr-join.png");b.textContent="บันทึกแล้ว ✓";}catch(x){b.textContent="บันทึกไม่ได้";}setTimeout(()=>b.textContent=o,1800);};
  document.getElementById("invImgShare").onclick=async e=>{const b=e.target,o=b.textContent;try{const r=await QRS.share(await qrPic(),"qr-join.png","เข้าร่วมก๊วนแบด — สแกน QR นี้");if(r==="saved")b.textContent="บันทึกรูปแล้ว — แนบใน LINE ได้เลย";}catch(x){b.textContent="ส่งไม่ได้";}setTimeout(()=>b.textContent=o,2400);};
  const sh=document.getElementById("invShare");if(sh)sh.onclick=()=>navigator.share({title:TT("เข้าร่วมก๊วนแบด"),text:TT("เปิดลิงก์นี้เพื่อเข้าร่วมก๊วน"),url:link}).catch(()=>{});
  try{if(!window.qrcode)await loadScript("lib/qrcode.js");const qr=qrcode(0,"M");qr.addData(link);qr.make();
    const box=document.getElementById("qrBox");if(box)box.innerHTML=qr.createSvgTag({cellSize:4,margin:3,scalable:true});}
  catch(e){const box=document.getElementById("qrBox");if(box)box.textContent="สร้าง QR ไม่ได้ — ใช้ลิงก์หรือรหัสด้านล่างแทน";}
}
function dlgToken(){
  const c=GH.cfg||{};
  openDlg(`<form novalidate style="display:grid;gap:12px"><h2>ต่ออายุโทเคน</h2>
    <div class="notice small"><b>ข้อมูลก๊วนไม่หาย</b> — ข้อมูลทั้งหมดอยู่ใน repo ของคุณ โทเคนเป็นแค่กุญแจเข้าไป เปลี่ยนกุญแจแล้วทุกอย่างยังอยู่ครบ</div>
    <ol class="small" style="margin:0;padding-left:1.3em;display:grid;gap:6px">
      <li>สร้างโทเคนใหม่ที่ GitHub: <a href="${TOKEN_LINK("none")}" target="_blank" rel="noopener">ไม่หมดอายุ ↗</a> หรือ <a href="${TOKEN_LINK(366)}" target="_blank" rel="noopener">อายุ 1 ปี ↗</a> → เลือก <b>Only select repositories</b> → <b>${h(c.repo||"repo ข้อมูล")}</b> → Generate token → คัดลอก<br><span class="muted">ถ้าหน้า Fine-grained tokens มีโทเคนเดิมของก๊วนและมีปุ่ม Regenerate token ใช้ได้เลย (สิทธิ์เดิม)</span></li>
      <li>วางโทเคนใหม่ด้านล่าง แล้วกดตรวจสอบ</li>
      <li>ส่ง<b>ลิงก์เชิญใหม่</b>ให้ผู้เล่น (และใส่ในเครื่องผู้จัดเครื่องอื่นด้วย “ใส่รหัสเชิญใหม่”)</li></ol>
    <label class="f">โทเคนใหม่<input name="token" type="password" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false"><span class="ferr"></span></label>
    <label class="f">โทเคนหมดอายุวันที่ (เว้นว่างถ้าไม่หมดอายุ)<input name="texp" type="date"><span class="ferr"></span></label>
    <div id="gtNote"></div>
    <p class="small muted" style="margin:0">ถ้าเปลี่ยนเพราะลิงก์เชิญหลุด ให้<b>ลบโทเคนเก่า</b>ที่ GitHub ด้วย (Settings → Developer settings → Fine-grained tokens → Delete)</p>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">ตรวจสอบและใช้โทเคนนี้</button></div></form>`,async f=>{
    const t=f.elements.token.value.trim();if(!t)return fieldErr(f,"token","ใส่โทเคนใหม่");
    const x=f.elements.texp.value.trim(),m=checkExp(x);if(m)return fieldErr(f,"texp",m);
    try{const c=GH.cfg;const r=await GH.check({...c,token:t});if(!r.push)return fieldErr(f,"token","โทเคนนี้เขียนข้อมูลไม่ได้ (ต้องเป็น Contents: Read and write)");
      GH.updateToken(t,undefined,x);toast("เปลี่ยนโทเคนแล้ว — ส่งลิงก์เชิญใหม่ให้ผู้เล่น");setTimeout(dlgInvite,200);return false;}
    catch(e){document.getElementById("gtNote").innerHTML=gerr(e);return false;}});
}
/* a new invite code pasted INSIDE the installed app (an installed iOS app cannot be reached by opening a link in Safari) */
function dlgNewCode(){
  openDlg(`<form novalidate style="display:grid;gap:12px"><h2>ใส่รหัสเชิญใหม่</h2>
    <p class="small" style="margin:0">ใช้เมื่อผู้จัดต่ออายุโทเคนแล้วส่งลิงก์หรือรหัสใหม่มา — วางที่นี่ได้เลย <b>ข้อมูลและชื่อของคุณในแอปไม่หาย</b></p>
    <label class="f">ลิงก์หรือรหัสเชิญใหม่<textarea name="code" rows="3" placeholder="วางลิงก์หรือรหัสที่ขึ้นต้นด้วย BGO1." autocapitalize="off" autocomplete="off" spellcheck="false"></textarea><span class="ferr"></span></label>
    <div id="gtNote"></div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">ตรวจสอบและใช้รหัสนี้</button></div></form>`,async f=>{
    let inv;try{inv=GH.parseInvite(f.elements.code.value);}catch(e){return fieldErr(f,"code",e.message);}
    const c=GH.cfg||{};
    if(inv.repo.toLowerCase()!==String(c.repo||"").toLowerCase()||(inv.api||"")!==(c.api||""))return fieldErr(f,"code",`รหัสนี้เป็นของก๊วนอื่น (${inv.repo}) — ถ้าต้องการย้ายไปก๊วนนั้น ให้กด “ออกจากระบบเครื่องนี้” ก่อน`);
    try{const r=await GH.check({...c,token:inv.token,branch:inv.branch});if(!r.push)return fieldErr(f,"code","โทเคนในรหัสนี้เขียนข้อมูลไม่ได้ — ขอรหัสใหม่จากผู้จัด");
      GH.updateToken(inv.token,c.fp?undefined:inv.fp,inv.tokenExp);toast("อัปเดตรหัสเข้าถึงแล้ว ✓");return true;}
    catch(e){document.getElementById("gtNote").innerHTML=gerr(e);return false;}});
}
/* bar at the top of the page: token about to expire / already broken. Organizer gets the fix button; a player gets the paste-new-code button. */
function tokenBar(){
  if(typeof DB==="undefined"||DB.mode!=="gh")return "";
  const c=GH.cfg||{},s=GH.status(),org=!!DB.realOrg,d=daysLeft(c.tokenExp);
  if(s.state==="auth"||(d!==null&&d<=0))
    return org?`<div class="endbar over" role="alert"><span><b>โทเคนใช้ไม่ได้แล้ว</b> (หมดอายุหรือถูกเพิกถอน) — ข้อมูลใน GitHub ปลอดภัย ไม่หาย</span><button class="primary" data-gh="token">ต่ออายุโทเคน</button></div>`
      :`<div class="endbar over" role="alert"><span><b>ลิงก์เชิญหมดอายุ</b> — ขอลิงก์ใหม่จากผู้จัด แล้ววางรหัส ข้อมูลของคุณไม่หาย</span><button class="primary" data-gh="newcode">ใส่รหัสเชิญใหม่</button></div>`;
  if(d!==null&&d<=(org?30:14))
    return org?`<div class="endbar"><span><b>โทเคนจะหมดอายุใน ${d} วัน</b> (${h(fmtDate(c.tokenExp))}) — ต่ออายุก่อนเพื่อไม่ให้ผู้เล่นใช้งานไม่ได้</span><button class="primary" data-gh="token">ต่ออายุโทเคน</button></div>`
      :`<div class="endbar"><span><b>ลิงก์เชิญจะหมดอายุใน ${d} วัน</b> — ผู้จัดจะส่งลิงก์ใหม่ให้ เมื่อได้รับให้กด “ใส่รหัสเชิญใหม่”</span><button data-gh="newcode">ใส่รหัสเชิญใหม่</button></div>`;
  return "";
}
async function disconnect(fromGate){
  const pend=GH.status().pending;
  if(!confirm(`ออกจากระบบบนเครื่องนี้?${pend?`\n\nมี ${pend} รายการที่ยังไม่ได้ส่งขึ้น GitHub — จะหายไป`:""}\n\nข้อมูลบน GitHub ไม่ถูกลบ เข้ามาใหม่ได้ด้วยรหัสเชิญ`))return;
  await GH.wipeLocal(GH.loadCfg()||GH.cfg||{repo:"",branch:""});location.replace(location.pathname+location.search);
}

/* ---------- organizer settings panel ---------- */
function settingsPanel(){
  const s=GH.status(),c=GH.cfg||{};
  return `<section class="panel"><div class="ph"><h2>เชื่อมต่อ GitHub</h2><span class="sp"></span><button class="primary" data-gh="invite">เชิญผู้เล่น (QR)</button></div>
  <div class="tw"><table class="kvtbl"><tbody>${statusRows(s)}
    <tr><th>รหัสตรวจกุญแจผู้จัด</th><td class="num">${h(c.fp||fpCache||"–")}</td></tr></tbody></table></div>
  <ul class="small" style="margin:10px 0 0;padding-left:1.2em;display:grid;gap:4px">
    <li>ผู้เล่นเปิด<b>ลิงก์เชิญ</b> (หรือสแกน QR) แล้วติดตั้งแอปลงหน้าจอหลัก — ลงชื่อ เช็คอิน ส่งสลิป โพสต์บอร์ดได้เอง</li>
    <li>ข้อมูลทุกอย่างเป็นไฟล์ใน repo ส่วนตัวของคุณ ดูประวัติ/ย้อนการแก้ไขได้ที่ GitHub · สมาชิก บันทึกผู้จัด และสลิป <b>เข้ารหัส</b> ด้วยรหัสผ่านผู้จัด</li>
    <li>ใครมีลิงก์เชิญ = เข้าถึง repo ข้อมูลได้ในระดับโทเคน — ส่งเฉพาะคนที่ไว้ใจ และจดวันหมดอายุโทเคนไว้ (ต่ออายุได้ด้านล่าง — ข้อมูลไม่หาย)</li></ul>
  <div class="dlg-a" style="justify-content:flex-start;margin-top:10px"><button data-gh="test">ทดสอบการเชื่อมต่อ</button><button data-gh="token">ต่ออายุโทเคน</button><button data-gh="newcode">ใส่รหัสเชิญใหม่</button><button data-gh="status">สถานะละเอียด</button><button data-gh="disconnect" class="danger">ออกจากระบบเครื่องนี้</button></div></section>`;
}

return {wanted,start,connText,settingsPanel,dlgStatus,dlgInvite,dlgTest,tokenBar,dlgToken,dlgNewCode};
})();
