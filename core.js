/* Badminton Group Organizer — shared core (data, rules, matching, shared dialogs).
   Loaded by both apps: organizer.js (ผู้จัดก๊วน) and player.js (ผู้เล่น). Both read and write the same live database. */
"use strict";
/* ================= utilities ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const now=()=>Date.now();
const MIN=60000;
/* language: dates / numbers follow the UI language; TT() turns Thai text that leaves the page (clipboard, share, picture) into the UI language */
const LOC=()=>typeof I18N!=="undefined"?I18N.loc:"th-TH";
const TT=s=>typeof I18N!=="undefined"?I18N.t(s):s;
const toISO=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>toISO(new Date());
const hm=ts=>{const d=new Date(ts);return `${pad(d.getHours())}:${pad(d.getMinutes())}`;};
const fmtD=iso=>{if(!iso)return "";const [y,m,d]=iso.split("-").map(Number);return new Date(y,m-1,d).toLocaleDateString(LOC(),{weekday:"short",day:"numeric",month:"short",year:"2-digit"});};
const mmss=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000);return `${Math.floor(s/60)}:${pad(s%60)}`;};
const uid=p=>(p||"x")+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const loadScript=src=>new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=()=>rej(new Error("load "+src));document.head.appendChild(s);});
const baht=n=>(Math.round(n)||0).toLocaleString(LOC());
let tt=null;function toast(t){const el=$("#toast");el.textContent=t;el.hidden=false;clearTimeout(tt);tt=setTimeout(()=>el.hidden=true,2800);}
/* Skill ladder used by Thai badminton groups and amateur tournaments (BG → A).
   c = the level code players already use, t = name, d = what a player at this level can do (for choosing honestly), w = weight for team balancing. */
const SKILL={
  L1:{c:"BG",t:"มือหน้าใหม่",w:1,tier:"beg",d:"เพิ่งเริ่มหัดเล่น ตีโดนบ้างไม่โดนบ้าง เสิร์ฟยังไม่ค่อยข้ามตาข่าย ยังไม่รู้กติกาและการนับแต้ม"},
  L2:{c:"N",t:"มือใหม่",w:2,tier:"beg",d:"โต้ลูกไปมาได้หลายจังหวะ รู้กติกาและนับแต้มเป็น โยนลูกได้แต่ยังไม่ถึงท้ายคอร์ด ตบหรือหยอดได้บ้างแต่ยังไม่นิ่ง"},
  L3:{c:"S",t:"มือเริ่มเล่นเป็น",w:3,tier:"beg",d:"เล่นเป็นเกมได้ต่อเนื่อง โยนลูกถึงท้ายคอร์ด เริ่มรู้การยืนหน้า-หลัง / ซ้าย-ขวาในเกมคู่ แต่ลูกแบ็คแฮนด์ยังอ่อน"},
  L4:{c:"P-",t:"มือกลางค่อนอ่อน",w:4,tier:"mid",d:"เบสิกเกือบครบ (โยน หยอด ตบ ดาด) รู้การหมุนตำแหน่งในเกมคู่ แต่ยังเสียแต้มเองบ่อยเมื่อเจอเกมเร็ว"},
  L5:{c:"P",t:"มือกลาง",w:5,tier:"mid",d:"เบสิกครบและนิ่ง รับลูกตบได้ ตีแบ็คแฮนด์ได้ วางลูกตามที่ตั้งใจ หมุนตำแหน่งเกมคู่คล่อง"},
  L6:{c:"P+",t:"มือกลางค่อนเก่ง",w:6,tier:"mid",d:"เล่นเร็วและหลากหลาย มีลูกหลอก อ่านเกมคู่ต่อสู้ได้ เกมรับดี ลงแข่งรายการสมัครเล่นเป็นประจำ"},
  L7:{c:"C",t:"มือแข่งขัน",w:7,tier:"pro",d:"คุมทิศทาง น้ำหนัก และความลึกได้แม่น ฟุตเวิร์กดี เสียแต้มเองน้อย มีประสบการณ์แข่งรายการเปิด"},
  L8:{c:"B",t:"มือแข่งขันระดับสูง",w:8,tier:"pro",d:"ระดับนักกีฬาเขต จังหวัด หรือมหาวิทยาลัย เทคนิคเกือบสมบูรณ์ ร่างกายฟิตมาก ได้รางวัลรายการใหญ่"},
  L9:{c:"A",t:"มืออาชีพ",w:9,tier:"pro",d:"นักกีฬาทีมชาติหรืออดีตทีมชาติ แข่งขันระดับนานาชาติ"}};
const SKILL_KEYS=Object.keys(SKILL);
const SKILL_TIERS={beg:{t:"เริ่มต้น",r:"BG–S"},mid:{t:"กลาง",r:"P-–P+"},pro:{t:"แข่งขัน",r:"C–A"}};
const SKILL_LEGACY={B:"L2",I:"L4",A:"L6"};   // the old 3-level scale: มือใหม่ / กลาง / เก่ง
const sk=k=>SKILL[k]?k:(SKILL_LEGACY[k]||"L2");   // players write their own skill: anything unknown falls back to N
const skLabel=k=>{k=sk(k);return `${SKILL[k].c} · ${SKILL[k].t}`;};
const skillChip=k=>{k=sk(k);return `<span class="skill ${k} t-${SKILL[k].tier}" title="${esc(skLabel(k)+" — "+SKILL[k].d)}">${esc(SKILL[k].c)}</span>`;};
/* level picker with what each level can do, so players choose honestly */
function skillPicker(name,cur){cur=sk(cur);
  return `<fieldset class="full skpick"><legend>ระดับฝีมือ <span class="muted small">— เลือกระดับที่ตรงกับที่ทำได้จริงตอนนี้ ระบบใช้จัดทีมให้สูสี</span></legend>
    ${SKILL_KEYS.map(k=>`<label class="skopt"><input type="radio" name="${name}" value="${k}" ${k===cur?"checked":""}>${skillChip(k)}<span class="sko-t"><b>${esc(SKILL[k].t)}</b><span>${esc(SKILL[k].d)}</span></span></label>`).join("")}</fieldset>`;}

/* ================= data layer: shared db or local fallback ================= */
/* Simulation mode (sim.html): each phone frame is a separate user on a shared in-browser "server" (sim storage key). */
const QS=new URLSearchParams(location.search);
const SIM=QS.get("sim");            // "org" | "player" | null
const DB={mode:"local",db:null,uid:(SIM&&QS.get("uid"))||"local-organizer",isOrg:true,canWrite:true,meName:""};
/* small per-device choices (open round, open tab) are kept per club, so a phone that serves two clubs never carries one club's choices into the other */
const uiKey=k=>{try{const c=DB.mode==="gh"&&typeof GH!=="undefined"&&GH.cfg;return c&&c.repo?`${k}|${c.repo}`:k;}catch(e){return k;}};
const LKEY=SIM?"bgo-sim-v1":"bgo-local-v1";
/* Each document is stored under its own key, so two pages/phones saving at the same moment never overwrite each other. */
const LP=LKEY+"|";
const lsubs=new Set();
function lload(){const o={};try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(LP)){try{o[k.slice(LP.length)]=JSON.parse(localStorage.getItem(k));}catch(e){}}}}catch(e){}return o;}
function lsig(){let s="";try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(LP))s+=k+"\u0001"+localStorage.getItem(k)+"\u0002";}}catch(e){}return s;}
try{const old=localStorage.getItem(LKEY);if(old){const o=JSON.parse(old)||{};Object.keys(o).forEach(k=>localStorage.setItem(LP+k,JSON.stringify(o[k])));localStorage.removeItem(LKEY);}}catch(e){}
let local=lload(),lastSig=lsig();
const lnotify=()=>lsubs.forEach(f=>f());
function lput(path,data){
  const before=local[path];
  if(data==null)delete local[path];else local[path]=JSON.parse(JSON.stringify(data));
  const prev=before;
  try{if(data==null)localStorage.removeItem(LP+path);else localStorage.setItem(LP+path,JSON.stringify(data));}
  catch(e){if(prev===undefined)delete local[path];else local[path]=prev;throw new Error("พื้นที่เก็บข้อมูลในเครื่องเต็ม — ดาวน์โหลดไฟล์สำรองที่หน้าตั้งค่า แล้วลบโพสต์ที่มีรูป");}
  lastSig=lsig();lnotify();
}
/* Live sync between pages/tabs/phones on the same device: pick up what others saved, without refresh. */
function lpull(){if(DB.mode!=="local")return;const s=lsig();if(s===lastSig)return;lastSig=s;local=lload();lnotify();}
window.addEventListener("storage",e=>{
  if(DB.mode!=="local")return;
  if(e.key===null){lpull();return;}
  if(!e.key.startsWith(LP))return;
  const p=e.key.slice(LP.length);
  if(e.newValue==null)delete local[p];else{try{local[p]=JSON.parse(e.newValue);}catch(_){return;}}
  lastSig=lsig();lnotify();
});
setInterval(lpull,1500);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)lpull();});
function lget(path){return local[path]?JSON.parse(JSON.stringify(local[path])):null;}
function lcol(path){const n=path.split("/").length;return Object.keys(local).filter(k=>k.startsWith(path+"/")&&k.split("/").length===n+1).map(k=>({id:k.split("/").pop(),...JSON.parse(JSON.stringify(local[k]))}));}
async function readDoc(path){
  if(DB.mode==="gh")return GH.readDoc(path);
  if(DB.mode==="db"){const d=await DB.db.doc(path).get();return d.exists?d.data():null;}
  return lget(path);
}
async function readCol(path){
  if(DB.mode==="gh")return GH.readCol(path);
  if(DB.mode==="db"){const q=await DB.db.collection(path).limit(1000).get();return q.docs.map(d=>({id:d.id,...d.data()}));}
  return lcol(path);
}
function watchDoc(path,cb){
  if(DB.mode==="gh")return GH.watchDoc(path,cb);
  if(DB.mode==="db"){return DB.db.doc(path).onSnapshot(s=>cb(s.exists?s.data():null),e=>dbErr(e));}
  const f=()=>cb(lget(path));lsubs.add(f);f();return ()=>lsubs.delete(f);
}
function watchCol(path,cb){
  if(DB.mode==="gh")return GH.watchCol(path,cb);
  if(DB.mode==="db"){return DB.db.collection(path).onSnapshot(q=>cb(q.docs.map(d=>({id:d.id,...d.data()}))),e=>dbErr(e));}
  const f=()=>cb(lcol(path));lsubs.add(f);f();return ()=>lsubs.delete(f);
}
const queues={};   // one write at a time per document
function serial(path,fn){const p=(queues[path]||Promise.resolve()).catch(()=>{}).then(fn);queues[path]=p;p.finally(()=>{if(queues[path]===p)delete queues[path];}).catch(()=>{});return p;}
function setDoc(path,data){
  if(DB.mode==="gh")return GH.setDoc(path,data);
  if(DB.mode==="db")return serial(path,()=>DB.db.doc(path).set(data));
  try{lput(path,data);}catch(e){return Promise.reject(e);}return Promise.resolve();
}
function delDoc(path){
  if(DB.mode==="gh")return GH.delDoc(path);
  if(DB.mode==="db")return serial(path,()=>DB.db.doc(path).delete());
  try{lput(path,null);}catch(e){return Promise.reject(e);}return Promise.resolve();
}
function dbErr(e){console.warn(e);if(e&&e.code&&e.code!=="invalid_argument")toast("การเชื่อมต่อข้อมูลขัดข้อง: "+(e.message||e.code));}
async function write(path,data,okMsg){
  try{await setDoc(path,data);if(okMsg)toast(okMsg);
    // a closed round's frozen summary follows later corrections and payments (the organizer's phone keeps it in step)
    if(DB.isOrg&&typeof refreshSummary==="function"&&/\/(pay|matches)\//.test(path)&&path.startsWith("sessions/")){const cs=curSession();if(cs&&cs.status==="closed"&&path.startsWith("sessions/"+cs.id+"/"))refreshSummary();}
    return true;}
  catch(e){if(e&&e.code==="invalid_argument"){
      if(!DB.isOrg&&DB.mode==="db"){DB.viewOnly=true;render();toast("บัญชีของคุณดูข้อมูลได้อย่างเดียว — ให้ผู้จัดเพิ่มชื่อและบันทึกแทน หรือขอสิทธิ์ Contributor");}
      else toast("คุณไม่มีสิทธิ์บันทึกส่วนนี้");}else toast("บันทึกไม่สำเร็จ: "+(e&&e.message||"ลองอีกครั้ง"));return false;}
}

/* ================= app switching ================= */
const APP={name:"",render:null};
let renderQ=false;
// Paint on the next frame; if the browser pauses frames (screen off-view, background tab), paint anyway shortly after so data is never stale.
function render(){if(renderQ)return;renderQ=true;const go=()=>{if(!renderQ)return;renderQ=false;if(APP.render)APP.render();tick();};requestAnimationFrame(go);setTimeout(go,150);}
function orgHook(kind,prev){if(APP.name==="org"&&typeof orgOnData==="function")orgOnData(kind,prev);}
function useApp(name){
  APP.name=name;
  DB.isOrg=name==="org"&&!!DB.realOrg;
  document.body.dataset.app=name;
  const os=$("#orgShell"),ps=$("#plShell");if(os)os.hidden=name!=="org";if(ps)ps.hidden=name!=="player";
  if(name==="org")startOrg();else startPlayer();
  render();
}
window.addEventListener("hashchange",()=>{if(PAGE()!=="index")return;const want=location.hash==="#player"||!DB.realOrg?"player":"org";if(want!==APP.name)useApp(want);});
/* ================= state ================= */
const S={notes:[],payqr:null,cfg:null,sessions:[],selfDocs:[],posts:[],slips:[],mod:null,inv:null,members:[],
  sid:null,roster:[],matches:[],decisions:[],pay:[],log:[],prep:null,joinDec:[]};
const CFG_DEF={group:"ก๊วนแบดของเรา",restMin:10,avgMin:15,queueDepth:1,balance:true,autoMutual:true,perCourtHour:3,buffer:20,payInfo:"",playerCourtFee:100,shuttleFee:15,shuttleSplit:"each",courtRent:0,shuttleCost:0,repairCost:0,noShowMin:20,noShowFee:0,setsPerGame:2,pointsToWin:21,shuttleDefault:"new"};
const cfg=()=>({...CFG_DEF,...(S.cfg||{})});
/* text people typed themselves (names, titles, notes, posts) is never translated: the English switch only changes the app's own wording */
if(typeof I18N!=="undefined")I18N.protect(()=>{const o=[],add=v=>{if(typeof v==="string"&&v.length<400)o.push(v);},pick=(a,ks)=>(a||[]).forEach(x=>x&&ks.forEach(k=>add(x[k])));
  pick(S.members,["name","nick","nickname","note"]);pick(S.selfDocs,["name","nick","nickname"]);pick(S.roster,["name","note","removedReason"]);pick(S.joinDec,["reason"]);(S.selfDocs||[]).forEach(d=>Object.values(d.joinReqs||{}).forEach(q=>q&&add(q.msg)));pick(S.sessions,["title","desc"]);
  pick(S.posts,["author","title","text"]);(S.posts||[]).forEach(d=>(d.comments||[]).forEach(c=>{add(c.text);add(c.author);}));pick(S.decisions,["note"]);
  (S.matches||[]).forEach(m=>(m.subs||[]).forEach(x=>add(x.reason)));
  (S.notes||[]).forEach(n=>Object.values(n.bySid||{}).forEach(v=>{add(v.nm);add(v.adjReason);add(v.rejectNote);}));
  const c=S.cfg||{};if(c.group&&c.group!==CFG_DEF.group)add(c.group);add(c.payInfo);if(S.payqr)add(S.payqr.ppName);
  return o;});
/* ---- game structure: sets per game · who started a game vs who only helped ---- */
function setsOf(s){const n=s&&+s.sets>0?+s.sets:+cfg().setsPerGame;return n>0?Math.min(9,Math.round(n)):2;}
/* shuttles of one game: what the organizer counted on the court card; until they touch it, the club's usual (new or repaired) is assumed */
function matchShuttles(m){const d=cfg().shuttleDefault==="repair"?{sh:0,rp:1}:{sh:1,rp:0};
  if(m&&m.free)return {sh:+m.shuttles||0,rp:m.repair!=null?+m.repair:1,free:true,explicit:true};
  const ex=!!m&&(m.shuttles!=null||m.repair!=null);
  return {sh:m&&m.shuttles!=null?+m.shuttles:d.sh,rp:m&&m.repair!=null?+m.repair:d.rp,free:false,explicit:ex};}
const matchOnCourt=m=>[...((m&&m.a)||[]),...((m&&m.b)||[])];
/* the four who started the game (m.orig is kept the first time somebody is swapped out of a running game) */
const matchStarters=m=>{const o=m&&m.orig?m.orig:m;return [...((o&&o.a)||[]),...((o&&o.b)||[])];};
/* substitutes who came in to a running game: they helped, so they are not charged for that game's shuttles */
function matchHelpers(m){const st=new Set(matchStarters(m));return [...new Set([...matchOnCourt(m),...((m&&m.subs)||[]).filter(x=>x.live).map(x=>x.in)])].filter(id=>id&&!st.has(id));}
const matchEveryone=m=>[...new Set([...matchStarters(m),...matchOnCourt(m),...matchHelpers(m)])];
function matchTimes(m){const stopAt={},joinAt={};(m.subs||[]).forEach(x=>{if(!x.live)return;stopAt[x.out]=x.at;joinAt[x.in]=x.at;delete stopAt[x.in];});return {stopAt,joinAt};}
function setsResult(sets){let a=0,b=0,d=0;(sets||[]).forEach(x=>{if(x&&x.w==="a")a++;else if(x&&x.w==="b")b++;else if(x&&x.w==="d")d++;});const n=a+b+d;return {a,b,d,n,winner:!n?"":a>b?"a":b>a?"b":"draw"};}
/* ---- badminton scoring (BWF Laws of Badminton, rally point) ----
   A set is won by the first side to T points (21) with a 2-point lead. At 20-all play goes on until one side leads by 2; at 29-all the side that scores the 30th point wins.
   So a finished set can only end 21-0 … 21-19, 22-20 … 29-27, 30-28 or 30-29.  Shorter games keep the same shape: 15 points (cap 21) and 11 points (cap 15). */
const PTS_CAP={21:30,15:21,11:15};
const ptsOf=()=>{const t=+cfg().pointsToWin;return PTS_CAP[t]?t:21;};
function checkSetScore(a,b,T){
  T=PTS_CAP[T]?T:ptsOf();const C=PTS_CAP[T];a=+a;b=+b;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0)return {ok:false,msg:"คะแนนต้องเป็นตัวเลขจำนวนเต็ม"};
  const hi=Math.max(a,b),lo=Math.min(a,b),fmt=`${hi}-${lo}`;
  if(a===b)return {ok:false,msg:`เสมอกัน ${a}-${b} ไม่ได้ — เซตต้องมีผู้ชนะ (ถ้าเล่นไม่จบ ให้เว้นช่องคะแนนว่างแล้วเลือกผู้ชนะแทน)`};
  if(hi>C)return {ok:false,msg:`${fmt} เป็นไปไม่ได้ — คะแนนสูงสุดของเซตคือ ${C} (${C}-${C-1})`};
  if(hi<T)return {ok:false,msg:`${fmt} ยังไม่จบเซต — ผู้ชนะต้องได้ถึง ${T} แต้ม`};
  if(hi===T)return lo<=T-2?{ok:true}:{ok:false,msg:`${fmt} ยังไม่จบเซต — ต้องนำ 2 แต้ม (เช่น ${T+1}-${T-1})`};
  if(hi<C)return hi-lo===2?{ok:true}:hi-lo<2?{ok:false,msg:`${fmt} ยังไม่จบเซต — ต้องนำ 2 แต้ม (เช่น ${hi+1}-${lo})`}
    :{ok:false,msg:`${fmt} เป็นไปไม่ได้ — เมื่อเกิน ${T} แต้ม ผู้ชนะต้องนำพอดี 2 แต้ม (เช่น ${T+2}-${T}, ${T+3}-${T+1})`};
  return lo>=C-2?{ok:true}:{ok:false,msg:`${fmt} เป็นไปไม่ได้ — ${C} แต้มชนะได้เฉพาะ ${C}-${C-2} หรือ ${C}-${C-1}`};
}
function resultText(m){
  if(!m.winner)return "ไม่บันทึกผล";
  const r=m.sets&&m.sets.length?setsResult(m.sets):null,sc=r&&(r.a||r.b)?` ${r.a}–${r.b}`:"";
  return m.winner==="a"?`ฝั่งซ้ายชนะ${sc}`:m.winner==="b"?`ฝั่งขวาชนะ${sc}`:`เสมอ${sc}`;}
const resultCls=m=>m.winner==="draw"?"s-queued":m.winner?"s-ready":"s-off";
let tab="courts";
let sessSubs=[];
let myIdentity=null; // for view-only players: chosen roster id
try{myIdentity=localStorage.getItem("bgo-me");}catch(e){}

/* ================= derived model ================= */
function curSession(){return S.sessions.find(s=>s.id===S.sid)||null;}
function selfDoc(id){return S.selfDocs.find(d=>d.id===id)||null;}
function rosterModel(){
  const s=curSession();if(!s)return [];
  const map={},cancelledAt={};
  /* Order and check-in times come from the organizer's device (seen/), not from the time a player's phone claims.
     A time no organizer has witnessed yet is placed after everything already witnessed. */
  const seen={};let lastSeen=+s.createdAt||0;(S.seen||[]).forEach(x=>{seen[x.id]=x;lastSeen=Math.max(lastSeen,+x.at||0,+x.ciAt||0);});
  const trustAt=(id,claim)=>{const w=seen[id];return w&&w.claim===claim&&w.at?+w.at:Math.max(+claim||0,lastSeen+1);};
  const trustCi=(id,claim)=>{if(!claim)return null;const w=seen[id];return w&&w.ci===claim&&w.ciAt?+w.ciAt:Math.max(+claim,lastSeen+1);};
  S.selfDocs.forEach(d=>{const su=d.signups&&d.signups[s.id];if(!su)return;
    if(su.cancelled){const dl0=checkinDeadline(s,roundsOf(s)&&su.round===2?2:1);
      if(!(dl0&&+su.cancelledAt>dl0&&!su.checkedInAt&&!S.roster.some(r=>r.id===d.id&&r.checkedInAt))){cancelledAt[d.id]=su.cancelledAt||Infinity;return;}}   // cancelled after the check-in deadline = no-show, not a free cancel
    map[d.id]={id:d.id,name:d.name||"ผู้เล่น",skill:sk(d.skill),account:true,signupAt:trustAt(d.id,su.at),claimAt:Math.max(+su.at||0,+s.createdAt||0),selfCheckIn:trustCi(d.id,su.checkedInAt),selfCheckOut:+su.checkedOutAt||null,chosen:su.round===2?2:1,early:su.round===2&&!!su.wantEarly};});
  S.roster.forEach(r=>{
    // the player cancelled after the organizer touched their row: the cancel wins unless the organizer re-added/checked them in later
    if(cancelledAt[r.id]&&!map[r.id]&&Math.max(+r.addedAt||0,+r.checkedInAt||0)<cancelledAt[r.id])return;
    const base=map[r.id]||{id:r.id,account:!r.walkin,signupAt:r.addedAt||0};
    if(!map[r.id]&&!r.walkin){const d=selfDoc(r.id);base.name=d?d.name:r.name;base.skill=d?d.skill:r.skill;}
    const mem=S.members.find(x=>x.id===r.id);
    map[r.id]={...base,chosen:r.round===1||r.round===2?r.round:(base.chosen||1),early:r.round===1||r.round===2?false:!!base.early,name:(mem&&mem.name)||r.name||base.name||"ผู้เล่น",skill:sk((mem&&mem.skill)||r.skill||base.skill),member:!!mem,walkin:!!r.walkin,override:r.status||null,checkedInAt:r.checkedInAt||null,checkedOutAt:Math.max(+r.checkedOutAt||0,+base.selfCheckOut||0)||null,note:r.note||"",removedReason:r.status==="removed"?(r.removedReason||""):""};
  });
  const list=Object.values(map).sort((a,b)=>(a.signupAt||0)-(b.signupAt||0)||(a.claimAt||0)-(b.claimAt||0));
  const max=+s.maxPlayers||999,R=roundsOf(s);
  list.forEach(p=>{
    if(p.selfCheckOut&&!p.checkedOutAt)p.checkedOutAt=p.selfCheckOut;
    const ci=Math.max(+p.checkedInAt||0,+p.selfCheckIn||0);
    p.checkedIn=ci>0&&(!p.checkedOutAt||ci>p.checkedOutAt);     // checking in again after a check-out counts
    p.ciAt=ci;
  });
  /* seats: who is in round 1, who is in round 2, who waits (see seatPlan) */
  const plan=seatPlan(list.map(p=>({id:p.id,chosen:p.chosen||1,early:!!p.early,fix:p.override==="removed"?"removed":(p.override==="confirmed"||p.override==="reserve")?p.override:p.checkedInAt?"confirmed":""})),s);
  list.forEach(p=>{const x=plan[p.id];p.status=x.status;p.round=x.round||0;p.want=x.want||0;p.no=x.no||0;p.rsvNo=x.rsvNo||0;p.upgraded=!!x.up;p.origConfirmed=p.status==="confirmed";});
  /* NO-SHOW: after the check-in deadline of a round, confirmed players of that round who have not checked in lose their place.
     Places go to checked-in players: those who arrived on time first, then latecomers and reserves in the order they checked in.
     Round 2 has its own deadline (round 2 start + noShowMin). Someone in round 2 who asked for round 1 can also take a freed round-1 place. */
  const dl=checkinDeadline(s,1),dl2=R?checkinDeadline(s,2):null;list.deadline=dl;list.deadline2=dl2;list.openSlots=0;list.openSlots2=0;list.rounds=R;
  const asOf=s.status==="closed"?Math.min(now(),+s.closedAt||sessEndEpoch(s)||0):now();    // a closed round keeps the no-shows it had when it closed
  const played=new Set(S.matches.filter(m=>m.status!=="cancelled").flatMap(m=>matchEveryone(m)));
  const fixed=p=>p.override||p.checkedInAt||played.has(p.id);
  [1,2].forEach(r=>{
    const dlr=r===1?dl:dl2,cap=r===1?max:(R?R.max:0);
    if(!dlr||asOf<=dlr)return;
    let n2=list.filter(p=>p.status==="confirmed"&&p.round===r&&fixed(p)).length;
    list.filter(p=>!fixed(p)&&p.checkedIn&&((p.status==="confirmed"&&p.round===r)||(p.status==="reserve"&&p.want===r)||(r===1&&p.status==="confirmed"&&p.round===2&&p.early)))
      .sort((a,b)=>((a.origConfirmed&&a.round===r&&a.ciAt<=dlr)?0:1)-((b.origConfirmed&&b.round===r&&b.ciAt<=dlr)?0:1)||a.ciAt-b.ciAt)
      .forEach(p=>{
        if(n2<cap){n2++;if(p.status!=="confirmed"||p.round!==r){p.upgraded=p.round===2;p.status="confirmed";p.round=r;p.want=0;p.promoted=true;}}
        else if(p.round===r&&p.status==="confirmed"){p.status="reserve";p.want=r;p.round=0;}});
    list.filter(p=>!fixed(p)&&!p.checkedIn&&p.status==="confirmed"&&p.round===r).forEach(p=>{if(!p.checkedOutAt){p.status="noshow";p.noShow=true;}else{p.status="reserve";p.want=r;p.round=0;}});
    if(r===1)list.openSlots=Math.max(0,cap-n2);else list.openSlots2=Math.max(0,cap-n2);
  });
  /* round 2 players are not drawn into games before round 2 starts (they may still check in early) */
  const t2=R?sessRoundStart(s,2):0;
  list.forEach(p=>{p.notYet=!!(R&&p.status==="confirmed"&&p.round===2&&t2&&asOf<t2&&s.status!=="closed");});
  /* numbers shown to players: place within the round (confirmed) or in the waiting line (reserve) */
  [1,2].forEach(r=>{let i=0;list.filter(p=>p.status==="confirmed"&&p.round===r).forEach(p=>p.no=++i);i=0;list.filter(p=>p.status==="reserve"&&p.want===r).forEach(p=>p.rsvNo=++i);});
  list.rsvTotal={1:list.filter(p=>p.status==="reserve"&&p.want!==2).length,2:list.filter(p=>p.status==="reserve"&&p.want===2).length};
  return list;
}
/* check-in deadline = session start + noShowMin (0 turns the rule off) */
function checkinDeadline(s,r){const m=+cfg().noShowMin||0;if(!m||!s||!s.date)return null;const t=sessRoundStart(s,r===2?2:1);return t?t+m*MIN:null;}
/* start time of round 1 (the session start) or round 2 (round2Start) as an epoch; 0 when not set */
function sessRoundStart(s,r){const hhmm=r===2?s&&s.round2Start:s&&s.start;if(!s||!s.date||!hhmm||!/^\d{1,2}:\d{2}$/.test(hhmm))return 0;
  const [y,mo,d]=s.date.split("-").map(Number);const [h,mi]=hhmm.split(":").map(Number);let t=new Date(y,mo-1,d,h,mi).getTime();
  if(r===2&&s.start&&/^\d{1,2}:\d{2}$/.test(s.start)){const [h1,m1]=s.start.split(":").map(Number);if(t<new Date(y,mo-1,d,h1,m1).getTime())t+=864e5;}   // round 2 after midnight
  return t;}
/* a session can have a second round: people who could not get a place at the start sign up for round 2 (e.g. 21:00) and join the draw from then on */
function roundsOf(s){const t=s&&s.round2Start;if(!t||!/^\d{1,2}:\d{2}$/.test(t))return null;const m=Math.floor(+s.round2Max);return {start:t,max:m>0?m:999};}
/* Who gets a place. items are in sign-up order: {id, chosen:1|2, early:bool (chose round 2 but wants round 1 if a place opens), fix:""|"confirmed"|"reserve"|"removed" (organizer decisions / checked in at the venue)}
   1) everybody who wants round 1 (chose round 1, or chose round 2 + wants early) fills the round-1 places in sign-up order
   2) the rest who chose round 2 fill the round-2 places in sign-up order; everybody else waits (reserve), in sign-up order.
   A round-1 cancellation therefore moves the first "wants round 1" person up, and frees their round-2 place for the next one. */
function seatPlan(items,s){
  const R=roundsOf(s),max=+s.maxPlayers>0?+s.maxPlayers:999,out={};let n1=0,n2=0;
  items.forEach(p=>{
    if(p.fix==="removed"){out[p.id]={status:"removed"};return;}
    const ch=R&&p.chosen===2?2:1;
    if(p.fix==="reserve"){out[p.id]={status:"reserve",want:ch};return;}
    if(p.fix==="confirmed"){out[p.id]={status:"confirmed",round:ch};if(ch===2)n2++;else n1++;return;}
    if(ch===1||p.early){if(n1<max){out[p.id]={status:"confirmed",round:1,up:ch===2};n1++;return;}}
    out[p.id]=null;});
  items.forEach(p=>{if(out[p.id]!==null)return;
    if(R&&p.chosen===2){if(n2<R.max){out[p.id]={status:"confirmed",round:2};n2++;}else out[p.id]={status:"reserve",want:2};}
    else out[p.id]={status:"reserve",want:1};});
  [1,2].forEach(r=>{let i=0;items.forEach(p=>{if(out[p.id].status==="confirmed"&&out[p.id].round===r)out[p.id].no=++i;});i=0;items.forEach(p=>{if(out[p.id].status==="reserve"&&out[p.id].want===r)out[p.id].rsvNo=++i;});});
  return out;}
function playerStats(){
  const r=cfg().restMin*MIN,st={};
  const g=id=>st[id]||(st[id]={games:0,wins:0,losses:0,draws:0,helps:0,minutes:0,lastEnd:0,restUntil:0,inMatch:null,partners:[]});
  const stop=(x,at)=>{if(at>(x.lastEnd||0)){x.lastEnd=at;x.restUntil=at+r;}};
  S.matches.forEach(m=>{
    const on=new Set(matchOnCourt(m)),starters=matchStarters(m),helpers=matchHelpers(m),{stopAt,joinAt}=matchTimes(m);
    on.forEach(id=>{const x=g(id);if(m.status==="playing"||m.status==="queued"){if(!x.inMatch||m.status==="playing")x.inMatch=m;}});
    if(m.status==="playing"){Object.entries(stopAt).forEach(([id,at])=>{if(!on.has(id))stop(g(id),at);});}   // swapped out of a running game: rest starts then
    if(m.status!=="done")return;
    const o=m.orig||m,teamA=o.a||[],teamB=o.b||[];
    starters.forEach(id=>{const x=g(id);x.games++;
      const end=on.has(id)?(m.endAt||0):(stopAt[id]||m.endAt||0);
      x.minutes+=Math.max(0,Math.round((end-(m.startAt||0))/MIN));
      if(m.winner==="draw")x.draws++;
      else if(m.winner){const inA=teamA.includes(id);if((m.winner==="a")===inA)x.wins++;else x.losses++;}
      stop(x,end);
      (teamA.includes(id)?teamA:teamB).forEach(p=>{if(p!==id)x.partners.push({id:p,at:m.endAt||0});});});
    helpers.forEach(id=>{const x=g(id);x.helps++;const end=on.has(id)?(m.endAt||0):(stopAt[id]||m.endAt||0);
      x.minutes+=Math.max(0,Math.round((end-(joinAt[id]||m.startAt||0))/MIN));stop(x,end);});
  });
  return {get:g};
}
function statusOf(p,ps,t){
  const x=ps.get(p.id);t=t||now();
  if(p.status==="removed")return {k:"off",t:"ถูกนำออก"};
  if(p.status==="noshow")return {k:"bad",t:"ไม่มาตามนัด"};
  if(p.status==="reserve")return {k:"off",t:"สำรอง"};
  if(!p.checkedIn)return {k:"off",t:p.checkedOutAt?"กลับแล้ว":"ยังไม่เช็คอิน"};
  if(p.notYet)return {k:"off",t:"รอรอบ "+((curSession()||{}).round2Start||"")};
  if(x.inMatch&&x.inMatch.status==="playing")return {k:"play",t:"กำลังเล่น"};
  if(x.inMatch&&x.inMatch.status==="queued")return {k:"queued",t:"รอลงคอร์ด"};
  if(x.restUntil>t)return {k:"rest",t:"พัก "+mmss(x.restUntil-t),until:x.restUntil};
  return {k:"ready",t:"พร้อม"};
}
function waitingOrder(roster,ps){
  return roster.filter(p=>p.status==="confirmed"&&p.checkedIn&&!p.notYet&&!ps.get(p.id).inMatch)
    .sort((a,b)=>{const A=ps.get(a.id),B=ps.get(b.id);
      if(A.games!==B.games)return A.games-B.games;
      const ta=A.lastEnd||a.checkedInAt||a.selfCheckIn||0,tb=B.lastEnd||b.checkedInAt||b.selfCheckIn||0;return ta-tb;});
}
/* requests: player-created (self docs) + organizer-created (decisions with from) */
/* "the round is full" messages: a player writes them in his own document (self/<id>.joinReqs); the organizer answers in joinreq/<id>
   (status queued = put in the line · removed = turned down with a reason the player reads). Cancelled messages are hidden. */
let jrMemo=null;
function joinReqModel(){
  if(jrMemo&&jrMemo.a===S.selfDocs&&jrMemo.b===S.joinDec)return jrMemo.v;
  const dec={};(S.joinDec||[]).forEach(d=>dec[d.id]=d);
  const out=[];
  (S.selfDocs||[]).forEach(d=>Object.entries(d.joinReqs||{}).forEach(([rid,r])=>{
    if(!r||typeof r!=="object")return;
    const x=dec[rid]||{},st=r.cancelled?"cancelled":x.status==="queued"||x.status==="removed"?x.status:"pending";
    if(st==="cancelled")return;
    out.push({id:rid,uid:d.id,name:d.name||"ผู้เล่น",skill:sk(d.skill),sid:r.sid||"",sTitle:r.sTitle||"",sDate:r.sDate||"",when:r.when==="this"?"this":"next",round:r.round===2?2:r.round===1?1:0,roundLabel:r.roundLabel||"",msg:r.msg||"",at:+r.at||0,
      status:st,ack:st==="removed"&&!!r.ack,reason:x.reason||"",by:x.by||"",decidedAt:+x.at||0,toSid:x.toSid||"",toRound:x.round===2?2:x.round===1?1:0});
  }));
  out.sort((a,b)=>a.at-b.at);
  jrMemo={a:S.selfDocs,b:S.joinDec,v:out};return out;
}
function requestModel(){
  const s=curSession();if(!s)return [];
  const dec={};S.decisions.forEach(d=>dec[d.id]=d);
  const out=[];
  S.selfDocs.forEach(d=>{Object.entries(d.requests||{}).forEach(([rid,r])=>{if(r.sid!==s.id)return;
    if(!r.to||r.to===d.id)return;                                   // ignore broken / self requests
    let x=dec[rid]||{};if(x.owner&&x.owner!==d.id)x={};                // a decision belongs to one requester only
    out.push({id:rid,from:d.id,to:r.to,type:r.type,at:r.at,cancelled:!!r.cancelled,status:r.cancelled?"cancelled":(x.status||"pending"),by:x.by,handledAt:x.at,note:x.note,fulfilled:x.fulfilled||null,mutualOf:x.mutualOf||null});});});
  S.decisions.forEach(x=>{if(x.from)out.push({id:x.id,from:x.from,to:x.to,type:x.type,at:x.createdAt,status:x.status||"pending",by:x.by,handledAt:x.at,note:x.note,fulfilled:x.fulfilled||null,byOrg:true});});
  // the mirror of a mutual partner request is used up together with the original (legacy "dup" marks are treated the same)
  const byId={};out.forEach(r=>byId[r.id]=r);
  out.forEach(r=>{if(r.fulfilled==="dup"){r.fulfilled=null;const m=out.find(q=>q.from===r.to&&q.to===r.from&&q.type===r.type&&q.id!==r.id);if(m)r.mutualOf=m.id;}});
  out.forEach(r=>{if(r.mutualOf&&!r.fulfilled){const m=byId[r.mutualOf];if(m)r.fulfilled=m.fulfilled||null;if(m&&!m.fulfilled)r.hiddenMirror=true;}});
  return out.sort((a,b)=>(b.at||0)-(a.at||0));
}
/* court timeline: ETA for queued matches and waiting players */
function timeline(roster,ps){
  const s=curSession();const c=cfg();const avg=c.avgMin*MIN;const t=now();
  const courts=(s&&s.courts||[]).map(name=>({name,free:t}));
  S.matches.filter(m=>m.status==="playing").forEach(m=>{const k=courts.find(x=>x.name===m.court);if(k)k.free=Math.max(t,(m.startAt||t)+avg);});
  const eta={},matchEta={};
  const q=S.matches.filter(m=>m.status==="queued").sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  q.forEach(m=>{const k=courts.find(x=>x.name===m.court)||courts.slice().sort((a,b)=>a.free-b.free)[0];if(!k)return;
    const rest=Math.max(0,...[...m.a,...m.b].map(id=>ps.get(id).restUntil||0));const st=Math.max(k.free,rest);matchEta[m.id]=st;k.free=st+avg;[...m.a,...m.b].forEach(id=>eta[id]=st);});
  const w=waitingOrder(roster,ps);
  for(let i=0;i<w.length;i+=4){const grp=w.slice(i,i+4);const k=courts.slice().sort((a,b)=>a.free-b.free)[0];if(!k)break;
    const rest=Math.max(0,...grp.map(p=>ps.get(p.id).restUntil||0));const st=Math.max(k.free,rest);
    if(grp.length===4)k.free=st+avg;grp.forEach(p=>eta[p.id]=st);}
  return {eta,matchEta,waiting:w};
}

/* ================= matching algorithm (rest rule + requests + skill balance) ================= */
function generateMatches(){
  const s=curSession();if(!s)return [];
  const c=cfg(),avg=c.avgMin*MIN,t=now();
  const roster=rosterModel(),ps=playerStats();
  const reqs=requestModel().filter(r=>r.status==="accepted"&&!r.fulfilled&&!r.hiddenMirror);
  const courts=(s.courts||[]).map(name=>({name,free:t,load:0}));
  // playing games first, so a queued game on the same court is planned after them
  [...S.matches].sort((x,y)=>(x.status==="playing"?0:1)-(y.status==="playing"?0:1)).forEach(m=>{const k=courts.find(x=>x.name===m.court);if(!k)return;
    if(m.status==="playing"){k.free=Math.max(k.free,(m.startAt||t)+avg);k.load++;}
    if(m.status==="queued"){k.free=Math.max(k.free,t)+avg;k.load++;}});
  const used=new Set();
  S.matches.forEach(m=>{if(m.status==="playing"||m.status==="queued")[...m.a,...m.b].forEach(id=>used.add(id));});
  const order=waitingOrder(roster,ps);
  const byId=Object.fromEntries(roster.map(p=>[p.id,p]));
  const created=[];
  const maxLoad=1+Math.max(0,+c.queueDepth||0);
  let guard=0;
  while(guard++<20){
    const k=courts.filter(x=>x.load<maxLoad).sort((a,b)=>a.free-b.free)[0];if(!k)break;
    const elig=order.filter(p=>!used.has(p.id));
    if(elig.length<4)break;
    // REST RULE: a match may only start once 4 players have rested; push the planned start back if needed
    const rests=elig.map(p=>ps.get(p.id).restUntil||0).sort((x,y)=>x-y);
    const start=Math.max(k.free,rests[3]);
    const pool=elig.filter(p=>(ps.get(p.id).restUntil||0)<=start);
    const inPool=id=>pool.some(p=>p.id===id);
    let a=[],b=[],reqIds=[];
    const pr=reqs.find(r=>r.type==="partner"&&inPool(r.from)&&inPool(r.to)&&!used.has(r.from)&&!used.has(r.to));
    if(pr){a=[pr.from,pr.to];reqIds.push(pr.id);}
    const orq=reqs.find(r=>r.type==="opponent"&&inPool(r.from)&&inPool(r.to)&&!reqIds.includes(r.id)&&(a.length===0||(a.includes(r.from)!==a.includes(r.to))));
    if(orq){if(a.length===0){a=[orq.from];b=[orq.to];}else{const other=a.includes(orq.from)?orq.to:orq.from;b=[other];}reqIds.push(orq.id);}
    const fixed=new Set([...a,...b]);
    const need=4-fixed.size;
    // keep players of a still-unused opponent request out of this game when possible, so their request can be honoured next
    const held=new Set();reqs.filter(r=>r.type==="opponent"&&!reqIds.includes(r.id)&&!used.has(r.from)&&!used.has(r.to)&&elig.some(p=>p.id===r.from)&&elig.some(p=>p.id===r.to)).forEach(r=>{held.add(r.from);held.add(r.to);});
    let cand=pool.filter(p=>!fixed.has(p.id)&&!held.has(p.id));
    if(cand.length<need)cand=pool.filter(p=>!fixed.has(p.id));
    cand=cand.slice(0,Math.min(8,cand.length));
    let best=null;
    const combos=(arr,k,st=0,cur=[],out=[])=>{if(cur.length===k){out.push(cur.slice());return out;}for(let i=st;i<arr.length;i++){cur.push(arr[i]);combos(arr,k,i+1,cur,out);cur.pop();}return out;};
    const w=id=>SKILL[sk(byId[id]&&byId[id].skill)].w;
    const lastPartner=(x,y)=>ps.get(x).partners.some(p=>p.id===y);
    combos(cand.map(p=>p.id),need).forEach(pick=>{
      const prio=pick.reduce((s,id)=>s+cand.findIndex(p=>p.id===id),0);
      const four=[...a,...b,...pick];
      const splits=[];
      if(a.length===2){splits.push([a,four.filter(x=>!a.includes(x))]);}
      else if(a.length===1&&b.length===1){const rest=pick;splits.push([[a[0],rest[0]],[b[0],rest[1]]],[[a[0],rest[1]],[b[0],rest[0]]]);}
      else{const [p,q,r,u]=four;splits.push([[p,q],[r,u]],[[p,r],[q,u]],[[p,u],[q,r]]);}
      splits.forEach(([A,B])=>{
        const diff=c.balance?Math.abs(A.reduce((s,x)=>s+w(x),0)-B.reduce((s,x)=>s+w(x),0)):0;
        const rep=(lastPartner(A[0],A[1])?1:0)+(lastPartner(B[0],B[1])?1:0);
        const score=prio*3+diff*4+rep*2;
        if(!best||score<best.score)best={score,A,B};
      });
    });
    if(!best)break;
    const id=uid("m");
    const m={court:k.name,a:best.A,b:best.B,status:"queued",createdAt:t+created.length,via:"auto",reqIds,estStart:start};
    created.push({id,m});
    [...best.A,...best.B].forEach(x=>used.add(x));
    reqIds.forEach(r=>{const i=reqs.findIndex(q=>q.id===r);if(i>=0)reqs.splice(i,1);});
    k.free=start+avg;k.load++;
  }
  return created;
}

/* ================= event log ================= */
function logEv(action,detail){const s=curSession();if(!s)return;const id=uid("l");write(`private/${s.id}/log/${id}`,{at:now(),by:DB.meName||"ผู้จัด",action,detail:detail||""});}
const nameOf=id=>{const p=rosterModel().find(x=>x.id===id);return p?p.name:(selfDoc(id)||{}).name||"?";};

function pChip(id,ps,roster,t){const p=roster.find(x=>x.id===id)||{id,name:nameOf(id),skill:"L2",status:"confirmed",checkedIn:true};const st=statusOf(p,ps,t);return `<div class="pn">${skillChip(p.skill)}<span class="nm">${esc(p.name)}</span>${st.k==="rest"?`<span class="chip s-rest" data-until="${st.until}">${esc(st.t)}</span>`:""}</div>`;}

function matchMini(m,ps,roster,t){const n=id=>{const p=roster.find(x=>x.id===id);return `${p?skillChip(p.skill):""}<span>${esc(nameOf(id))}</span>`;};
  return `<div class="mini"><span style="color:var(--a-team)">${m.a.map(n).join(" ")}</span><span class="t">vs</span><span style="color:var(--b-team)">${m.b.map(n).join(" ")}</span>${m.free?'<span class="chip s-ready">เกมฟรี · ลูกซ่อม</span>':""}</div>`;}

function selfService(){return DB.mode==="gh"||(DB.mode==="db"&&(DB.isOrg||!DB.viewOnly))||(DB.mode==="local"&&!DB.isOrg);}
function myId(){return selfService()?DB.uid:(myIdentity||null);}
function sessionCard(s){
  const roster=rosterModel();const conf=roster.filter(p=>p.status==="confirmed").length;const R=roundsOf(s),c1=roster.filter(p=>p.status==="confirmed"&&p.round===1).length,c2=roster.filter(p=>p.status==="confirmed"&&p.round===2).length;
  return `<div style="display:grid;gap:6px"><div class="pn"><h3>${esc(s.title||"รอบเล่น")}</h3>${s.status==="closed"?'<span class="chip s-off">ปิดแล้ว</span>':'<span class="chip s-ready">เปิดรับ</span>'}</div>
    <div class="small">${esc(fmtD(s.date))} · ${esc(s.start||"")}–${esc(s.end||"")} · ${(s.courts||[]).length} คอร์ด (${(s.courts||[]).map(esc).join(", ")}) · รับ ${s.maxPlayers||"-"} คน · ลงชื่อแล้ว ${conf} คน${roster.filter(p=>p.status==="reserve").length?` + สำรอง ${roster.filter(p=>p.status==="reserve").length}`:""}</div>
    ${R?`<div class="small">รอบ 2 เริ่ม ${esc(R.start)} · รับเพิ่ม ${R.max<999?R.max:"-"} คน · ลงชื่อรอบ 1 แล้ว ${c1} · รอบ 2 แล้ว ${c2}</div>`:""}
    <div class="bar"><span style="width:${Math.min(100,(R?c1:conf)/Math.max(1,s.maxPlayers||1)*100)}%"></span></div>
    ${s.desc?`<p class="small" style="margin:0;white-space:pre-wrap">${esc(s.desc)}</p>`:""}
    <div class="small muted">ค่าสนาม ${baht(cfg().playerCourtFee)} ฿/คน + ค่าลูก ${unit(cfg().shuttleFee)} ฿/ลูก${cfg().shuttleSplit==="shared"?" (หาร 4 คนในเกม)":" ต่อคน"} · ลูกซ่อมไม่คิดเงิน</div></div>`;
}

function reqTable(list,org){
  const roster=rosterModel(),ps=playerStats(),t=now();
  const conflict=r=>{const msgs=[];[r.from,r.to].forEach(id=>{const p=roster.find(x=>x.id===id);if(!p){msgs.push(`${nameOf(id)} ไม่อยู่ในรายชื่อ`);return;}const st=statusOf(p,ps,t);if(st.k==="off")msgs.push(`${p.name}: ${st.t}`);if(st.k==="rest")msgs.push(`${p.name} ยังพัก`);if(st.k==="play")msgs.push(`${p.name} กำลังเล่น`);});
    const dup=list.filter(x=>x!==r&&x.status!=="rejected"&&x.status!=="cancelled"&&x.type==="partner"&&r.type==="partner"&&(x.from===r.from||x.to===r.from||x.from===r.to||x.to===r.to)&&!(x.from===r.to&&x.to===r.from));if(dup.length)msgs.push("มีคำขอคู่ซ้อนกัน");return msgs;};
  const sc={pending:["s-warn","รอพิจารณา"],accepted:["s-ready","อนุมัติแล้ว"],rejected:["s-bad","ปฏิเสธ"],cancelled:["s-off","ยกเลิก"]};
  const typeTxt=r=>r.type==="partner"?"ขอเป็นคู่":"ขอเป็นคู่แข่ง";
  return `<div class="tw"><table class="reqtbl"><thead><tr><th>เวลา</th><th>จาก</th><th>ประเภท</th><th>ถึง</th><th>สถานะ</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>${list.map(r=>{const c=r.status==="pending"?conflict(r):[];
    const acts=`${org&&r.status==="accepted"&&!r.fulfilled&&!r.hiddenMirror?`<button class="ghost sm" data-act="reqReject" data-id="${esc(r.id)}">เพิกถอน</button>`:""}${org&&r.status==="pending"?`<button class="primary sm" data-act="reqAccept" data-id="${esc(r.id)}">อนุมัติ</button><button class="danger sm" data-act="reqReject" data-id="${esc(r.id)}">ปฏิเสธ</button>`:""}${!org&&r.status==="pending"&&r.from===DB.uid?`<button class="ghost sm" data-act="reqCancel" data-id="${esc(r.id)}">ยกเลิก</button>`:""}`;
    const note=`${c.length?`<span style="color:var(--warn)">${c.map(esc).join(" · ")}</span>`:esc(r.note||"")}${r.byOrg?' <span class="muted">(ผู้จัดบันทึก)</span>':""}`;
    return `<tr class="${r.status==="cancelled"?"dim":""}"><td class="num small c-time">${r.at?hm(r.at):""}</td><td class="c-from">${esc(nameOf(r.from))}</td><td class="c-type">${typeTxt(r)}</td><td class="c-to">${esc(nameOf(r.to))}</td>
      <td class="c-who"><b>${esc(nameOf(r.from))}</b> ${typeTxt(r)} <b>${esc(nameOf(r.to))}</b>${r.at?` <span class="small muted">· ${hm(r.at)}</span>`:""}</td>
      <td class="c-st"><span class="chip ${sc[r.status][0]}">${sc[r.status][1]}</span>${r.fulfilled?' <span class="chip s-play">จัดลงแมตช์แล้ว</span>':""}</td>
      <td class="small c-note">${note}</td>
      <td class="c-act">${acts?`<div class="acts">${acts}</div>`:""}</td></tr>`;}).join("")}</tbody></table></div>`;
}
/* Pricing (what players pay): flat court fee per player + shuttle fee for every NEW shuttle used in games they STARTED (injured/left early still pays; a substitute who came in mid-game does not).
   Repair shuttles (ลูกซ่อม) are never charged to players. Organizer P&L = what players owe − court rental − shuttle cost − other costs. */
function sessHours(s){let d=toMin(s.end)-toMin(s.start);if(d<=0)d+=24*60;return d/60;}   // 21:00–01:00 = 4 h
const sessStartEpoch=s=>{if(!s||!s.date||!s.start)return 0;const [y,mo,d]=s.date.split("-").map(Number),[h,mi]=s.start.split(":").map(Number);return new Date(y,mo-1,d,h,mi).getTime();};
/* booked end time as a timestamp (21:00–01:00 ends the next day); 0 when the round has no end time */
const sessEndEpoch=s=>{const st=sessStartEpoch(s);return st&&s&&s.end?st+sessHours(s)*3600000:0;};
/* prices a round is billed with: live settings while it is open, frozen copy (priceSnap) once it is closed */
const PRICE_KEYS=["playerCourtFee","shuttleFee","shuttleSplit","shuttleCost","repairCost","courtRent","noShowFee"];
const priceCfg=s=>({...cfg(),...((s&&s.priceSnap)||{})});
const priceSnapNow=()=>{const c=cfg(),o={};PRICE_KEYS.forEach(k=>{if(c[k]!==undefined)o[k]=c[k];});return o;};
/* unit prices may have decimals (฿37.50 per shuttle) — show them without rounding to whole baht */
const unit=n=>{n=+n||0;return Number.isInteger(n)?n.toLocaleString(LOC()):n.toLocaleString(LOC(),{minimumFractionDigits:2,maximumFractionDigits:2});};
function courtHoursOf(s,name){
  const total=sessHours(s)*60,cm=s.courtMeta&&s.courtMeta[name];if(!cm||!cm.from)return total/60;
  let off=toMin(cm.from)-toMin(s.start);if(off<-180)off+=1440;           // after midnight → next day; up to 3 h before the start counts as full time
  return Math.max(0,total-Math.max(0,off))/60;}
const courtHours=s=>(s.courts||[]).reduce((a,n)=>a+courtHoursOf(s,n),0);
function rentTotal(s){
  const c=priceCfg(s);const courts=(s.courts||[]).length;
  if(s.courtRent!=null)return courtHours(s)*(+s.courtRent||0);
  if(s.courtFee)return +s.courtFee;           // older sessions stored one total
  return courtHours(s)*(+c.courtRent||0);
}
function payModel(){
  const s=curSession();if(!s)return {rows:[],total:0,shuttles:0,repair:0,part:0,games:0,pnl:null};
  const c=priceCfg(s),roster=rosterModel(),ps=playerStats();
  const done=S.matches.filter(m=>m.status==="done");
  const shuttles=done.reduce((a,m)=>a+(+m.shuttles||0),0);
  const repair=done.reduce((a,m)=>a+(+m.repair||0),0);
  const freeGames=done.filter(m=>m.free).length;
  const part=roster.filter(p=>(p.status==="confirmed"&&(p.checkedIn||p.checkedOutAt))||ps.get(p.id).games>0);
  // anyone who appears in a finished game pays, even if they later cancelled or were removed
  const inPart=new Set(part.map(p=>p.id));
  done.forEach(m=>matchEveryone(m).forEach(id=>{if(!inPart.has(id)){inPart.add(id);part.push({id,name:nameOf(id)});}}));
  const fee=+c.noShowFee||0;if(fee)roster.filter(p=>p.status==="noshow"&&!inPart.has(p.id)).forEach(p=>{inPart.add(p.id);part.push({...p,noShowRow:true});});
  const games=part.reduce((a,p)=>a+ps.get(p.id).games,0);
  const payMap={};S.pay.forEach(x=>payMap[x.id]=x);
  const slipMap={};S.slips.forEach(x=>{const b=x.bySid&&x.bySid[s.id];if(b)slipMap[x.id]=b;});
  const perShuttle=c.shuttleSplit==="shared"?(+c.shuttleFee||0)/4:(+c.shuttleFee||0);
  const rows=part.map(p=>{
    const myShuttles=done.filter(m=>!m.free&&matchStarters(m).includes(p.id)).reduce((a,m)=>a+(+m.shuttles||0),0);   // the four who started a game pay its shuttles, even if injured and swapped out; substitutes only helped. A free game (repaired shuttle as a favour) is never billed.
    const myFree=done.filter(m=>m.free&&matchStarters(m).includes(p.id)).length;
    const freeOnly=!p.noShowRow&&myFree>0&&!S.matches.some(m=>m.status!=="cancelled"&&!m.free&&matchStarters(m).includes(p.id));   // came for the free game(s) only: nothing to pay
    const helped=done.filter(m=>matchHelpers(m).includes(p.id)).length,leftEarly=done.filter(m=>m.orig&&matchStarters(m).includes(p.id)&&!matchOnCourt(m).includes(p.id)).length;
    const noShowPart=p.noShowRow?fee:0;
    const courtPart=p.noShowRow||freeOnly?0:Math.ceil(+c.playerCourtFee||0),shuttlePart=Math.ceil(myShuttles*perShuttle);   // round per part so totals add up exactly
    let due=courtPart+shuttlePart+noShowPart;
    const calc=due,ov=payMap[p.id]||{};
    if(ov.dueAdj!=null)due=calc+(+ov.dueAdj||0);           // "ปรับยอด" is stored as a difference, so games played later are still billed
    else if(ov.dueOverride!=null)due=ov.dueOverride;      // older rounds: a fixed total
    const adjusted=ov.dueAdj!=null||ov.dueOverride!=null;
    const nt=((S.notes.find(x=>x.id===p.id)||{}).bySid||{})[s.id]||{};
    due=Math.max(0,Math.ceil(due));
    const slip=slipMap[p.id]||(DB.uid===p.id?((selfSlip()||{}).bySid||{})[s.id]:null);
    let state="unpaid";const paidAmt=ov.paidAmount!=null?+ov.paidAmount:(ov.status==="verified"||ov.status==="cash"?due:0);
    if(ov.status==="rejected"&&!(slip&&slip.at>(ov.at||0))&&paidAmt<due)state="rejected";
    else if(paidAmt>0)state=paidAmt>=due?"paid":(slip&&slip.at>(ov.at||0)?"pending":"partial");
    else if(ov.status==="rejected")state=slip&&slip.at>(ov.at||0)?"pending":"rejected";
    else if(slip)state="pending";
    if(freeOnly&&due<=0)state="paid";
    /* how the money came in: the receipts the organizer recorded (cash / transfer); an older bill without receipts counts as cash, or transfer if a slip was confirmed */
    const recs=Array.isArray(ov.rec)?ov.rec:[];let cashAmt=0,transAmt=0;recs.forEach(x=>{if(x.m==="transfer")transAmt+=+x.a||0;else cashAmt+=+x.a||0;});
    const legacy=Math.max(0,Math.min(paidAmt,due)-cashAmt-transAmt);if(legacy>0){if(ov.status==="verified")transAmt+=legacy;else cashAmt+=legacy;}
    return {id:p.id,name:p.name,games:ps.get(p.id).games,myShuttles,myFree,freeOnly,helped,leftEarly,courtPart,shuttlePart,noShowPart,due,calc:Math.ceil(calc),adjusted,state,ov,slip,paidAmt,recs,cashAmt,transAmt,owe:Math.max(0,due-paidAmt),adjReason:nt.adjReason||ov.adjReason||"",rejectNote:nt.rejectNote||ov.note||""};
  });
  const revCourt=rows.reduce((a,r)=>a+r.courtPart,0),revShuttle=rows.reduce((a,r)=>a+r.shuttlePart,0);
  const revenue=rows.reduce((a,r)=>a+r.due,0);
  const collected=rows.reduce((a,r)=>a+Math.min(r.paidAmt,r.due),0),collectedCash=rows.reduce((a,r)=>a+r.cashAmt,0),collectedTransfer=rows.reduce((a,r)=>a+r.transAmt,0);
  const rent=rentTotal(s),costNew=shuttles*(+c.shuttleCost||0),costRepair=repair*(+c.repairCost||0),other=+s.otherFee||0;
  const cost=rent+costNew+costRepair+other;
  const pnl={revenue,revCourt,revShuttle,revNoShow:rows.reduce((a,r)=>a+r.noShowPart,0),adjust:revenue-revCourt-revShuttle-rows.reduce((a,r)=>a+r.noShowPart,0),collected,collectedCash,collectedTransfer,rent,costNew,costRepair,other,cost,
    profit:revenue-cost,cashProfit:collected-cost,hours:sessHours(s),courts:(s.courts||[]).length,courtHours:courtHours(s),addedCourts:(s.courts||[]).filter(n=>s.courtMeta&&s.courtMeta[n]&&s.courtMeta[n].from).length,
    rentRate:s.courtRent!=null?+s.courtRent:(s.courtFee?null:+c.courtRent||0),
    breakEven:(+c.playerCourtFee||0)>0?Math.ceil(Math.max(0,rent+other)/(+c.playerCourtFee)):null};
  return {rows,total:revenue,shuttles,repair,freeGames,part:part.length,games,pnl};
}
let mySlipDoc=null;const selfSlip=()=>mySlipDoc;
function payChip(r){const paidTxt=r.freeOnly&&!r.due?"เล่นฟรี":r.cashAmt>0&&r.transAmt>0?"รับครบ (สด+โอน)":r.transAmt>0&&(r.recs.length||r.ov.status!=="verified")?"รับโอนแล้ว":r.recs.length||r.ov.status==="cash"?"จ่ายเงินสดแล้ว":"ยืนยันแล้ว";
  if(r.freeOnly&&!r.due)return `<span class="chip s-ready">เล่นฟรี</span>`;
  const m={paid:["s-ready",paidTxt],pending:["s-warn","รอตรวจสลิป"],partial:["s-warn",`ค้างเพิ่ม ${baht(r.owe)} ฿`],rejected:["s-bad","สลิปไม่ผ่าน"],unpaid:["s-off","ยังไม่จ่าย"]}[r.state];return `<span class="chip ${m[0]}">${m[1]}</span>`;}
/* ---------- board ---------- */
function vBoard(){
  const hidden=(S.mod&&S.mod.hidden)||{};
  const items=[];
  S.posts.forEach(d=>(d.items||[]).forEach(p=>items.push({...p,owner:d.id,key:d.id+":"+p.id})));
  const comments=[];S.posts.forEach(d=>(d.comments||[]).forEach(c=>comments.push({...c,owner:d.id})));
  const visible=items.filter(p=>DB.isOrg||!hidden[p.key]).sort((a,b)=>(b.at||0)-(a.at||0));
  const canPost=DB.mode==="local"||selfService();
  const ann=S.sessions.filter(s=>s.status!=="closed").sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  let h=`<section class="panel"><div class="ph"><h2>ประกาศรับสมัคร</h2></div>${ann.length?`<div class="feed">${ann.map(s=>`<article class="post pin"><div class="post-h"><b>📌 ${esc(s.title||"รอบเล่น")}</b><span>${esc(fmtD(s.date))} ${esc(s.start||"")}–${esc(s.end||"")}</span></div>${sessionCard(s)}${!DB.isOrg&&selfService()?`<div><button class="primary sm" data-act="signupFor" data-id="${esc(s.id)}">ลงชื่อ</button></div>`:""}</article>`).join("")}</div>`:`<div class="empty">ไม่มีประกาศที่เปิดรับ</div>`}</section>
  <section class="panel"><div class="ph"><h2>บอร์ดชุมชน</h2><span class="sp"></span>${canPost?`<button class="primary" data-act="newPost">+ โพสต์</button>`:""}</div>
  ${visible.length?`<div class="feed">${visible.map(p=>{const cs=comments.filter(c=>c.post===p.key).sort((a,b)=>a.at-b.at);
    return `<article class="post"><div class="post-h"><b>${esc(((selfDoc(p.owner)||{}).name)||p.author||nameOf(p.owner))}</b><span>${new Date(p.at).toLocaleString(LOC(),{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>${hidden[p.key]?'<span class="chip s-bad">ซ่อนจากผู้เล่น</span>':""}<span style="flex:1"></span>
      ${DB.isOrg?`<button class="ghost sm" data-act="hidePost" data-id="${esc(p.key)}">${hidden[p.key]?"เลิกซ่อน":"ซ่อน"}</button>`:""}${p.owner===DB.uid?`<button class="ghost sm" data-act="delPost" data-id="${esc(p.id)}">ลบ</button>`:""}</div>
      ${p.text?`<p>${esc(p.text)}</p>`:""}${p.img?`<img src="${esc(p.img)}" alt="รูปประกอบโพสต์">`:""}
      ${cs.length?`<div class="cmts">${cs.map(c=>`<div><b>${esc(((selfDoc(c.owner)||{}).name)||c.author||nameOf(c.owner))}</b> ${esc(c.text)}</div>`).join("")}</div>`:""}
      ${canPost&&p.allowComments!==false?`<div><button class="ghost sm" data-act="comment" data-id="${esc(p.key)}">แสดงความคิดเห็น</button></div>`:""}</article>`;}).join("")}</div>`:`<div class="empty">ยังไม่มีโพสต์</div>`}</section>`;
  return h;
}

const toMin=t=>{if(!t)return 0;const [h,m]=t.split(":").map(Number);return h*60+(m||0);};

/* ================= dialogs ================= */
function openDlg(html,onSubmit){
  const ov=$("#ov"),d=$("#dlg");d.innerHTML=html;ov.hidden=false;
  const f=d.querySelector("form");
  if(f)f.addEventListener("submit",async e=>{e.preventDefault();const btn=f.querySelector("[type=submit]");if(btn)btn.disabled=true;try{const r=await onSubmit(f);if(r!==false)closeDlg();}finally{if(btn)btn.disabled=false;}});
  setTimeout(()=>{const x=d.querySelector("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea");if(x)x.focus();},30);
}
function closeDlg(){$("#ov").hidden=true;$("#dlg").innerHTML="";}
$("#ov").addEventListener("click",e=>{if(e.target.id==="ov"||e.target.closest("[data-close]"))closeDlg();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#ov").hidden)closeDlg();});
const fv=(f,n)=>{const el=f.elements[n];return el?el.value.trim():"";};
function fieldErr(f,n,msg){const el=f.elements[n];if(el){el.classList.add("bad");const s=el.parentElement.querySelector(".ferr");if(s)s.textContent=msg;el.focus();}return false;}
const intIn=(n,lbl,v,min,max,ph)=>`<label class="f">${lbl}<input name="${n}" inputmode="numeric" value="${v??""}" placeholder="${ph||""}" data-int="${min}-${max}" autocomplete="off"><span class="ferr"></span></label>`;
function checkInt(f,n,req){const el=f.elements[n];const v=el.value.trim();const [lo,hi]=el.dataset.int.split("-").map(Number);
  if(v===""){if(req)return fieldErr(f,n,"กรุณากรอก");return null;}
  if(!/^\d+$/.test(v))return fieldErr(f,n,"ต้องเป็นตัวเลขจำนวนเต็ม");
  if(+v<lo||+v>hi)return fieldErr(f,n,`ต้องอยู่ระหว่าง ${lo}–${hi}`);return +v;}
/* money with up to 2 decimals (data-dec="min-max") */
const decIn=(n,lbl,v,min,max,ph)=>`<label class="f">${lbl}<input name="${n}" inputmode="decimal" value="${v??""}" placeholder="${ph||""}" data-dec="${min}-${max}" autocomplete="off"><span class="ferr"></span></label>`;
function checkDec(f,n,req){const el=f.elements[n];const v=el.value.trim().replace(",",".");const [lo,hi]=el.dataset.dec.split("-").map(Number);
  if(v===""){if(req)return fieldErr(f,n,"กรุณากรอก");return null;}
  if(!/^\d+(\.\d{1,2})?$/.test(v))return fieldErr(f,n,"ใส่ตัวเลข ทศนิยมไม่เกิน 2 ตำแหน่ง");
  if(+v<lo||+v>hi)return fieldErr(f,n,`ต้องอยู่ระหว่าง ${lo}–${hi}`);return Math.round(+v*100)/100;}
document.addEventListener("input",e=>{const el=e.target;if(el.dataset&&el.dataset.dec!==undefined){let v=el.value.replace(",",".").replace(/[^\d.]/g,"");const i=v.indexOf(".");if(i>=0)v=v.slice(0,i+1)+v.slice(i+1).replace(/\./g,"");if(v!==el.value)el.value=v;el.classList.remove("bad");const s=el.parentElement.querySelector(".ferr");if(s)s.textContent="";}});
document.addEventListener("focusin",e=>{const el=e.target;if(el&&el.tagName==="INPUT"&&el.dataset&&(el.dataset.int!==undefined||el.dataset.dec!==undefined)&&el.value)setTimeout(()=>{try{el.select();}catch(_){}},0);});
document.addEventListener("input",e=>{const t=e.target;if(t&&t.classList&&t.classList.contains("bad")&&t.dataset.int===undefined){t.classList.remove("bad");const s=t.parentElement&&t.parentElement.querySelector(".ferr");if(s)s.textContent="";}});
document.addEventListener("input",e=>{const el=e.target;if(el.dataset&&el.dataset.int!==undefined){el.value=el.value.replace(/\D/g,"");el.classList.remove("bad");const s=el.parentElement.querySelector(".ferr");if(s)s.textContent="";}});

function dlgProfile(){
  const me=selfDoc(DB.uid)||{name:DB.meName||"",skill:"L2"};
  openDlg(`<form novalidate><h2>โปรไฟล์ผู้เล่น</h2><div class="fg">
    <label class="f full">ชื่อที่ใช้ในก๊วน<input name="name" maxlength="30" value="${esc(me.name)}" required><span class="ferr"></span></label>
    ${skillPicker("skill",me.skill)}
  </div><div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const name=fv(f,"name");if(name.length<2)return fieldErr(f,"name","ชื่ออย่างน้อย 2 ตัวอักษร");
    const cur=selfDoc(DB.uid)||{};
    return write(`self/${DB.uid}`,{...stripId(cur),name,skill:sk(fv(f,"skill"))},"บันทึกโปรไฟล์แล้ว");
  });
}
const stripId=o=>{const x={...o};delete x.id;return x;};
function dlgRequest(){
  const s=curSession();const roster=rosterModel().filter(p=>p.status!=="removed");
  const from=DB.isOrg?"":DB.uid;
  openDlg(`<form novalidate><h2>${DB.isOrg?"บันทึกคำขอแทนผู้เล่น":"ขอคู่ / คู่แข่ง"}</h2><div class="fg">
    ${DB.isOrg?`<label class="f full">ผู้ขอ<select name="from"><option value="">— เลือก —</option>${roster.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select><span class="ferr"></span></label>`:""}
    <label class="f">ประเภท<select name="type"><option value="partner">ขอเป็นคู่ (ทีมเดียวกัน)</option><option value="opponent">ขอเป็นคู่แข่ง</option></select></label>
    <label class="f">กับ<select name="to"><option value="">— เลือก —</option>${roster.filter(p=>p.id!==from).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select><span class="ferr"></span></label>
  </div><p class="small muted" style="margin:0">ผู้จัดเป็นผู้อนุมัติ เมื่ออนุมัติแล้วระบบจะจัดลงแมตช์ถัดไปที่ทั้งคู่พักครบ ${cfg().restMin} นาที</p>
  <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">ส่งคำขอ</button></div></form>`,async f=>{
    const fr=DB.isOrg?fv(f,"from"):DB.uid,to=fv(f,"to"),type=fv(f,"type");
    if(DB.isOrg&&!fr)return fieldErr(f,"from","เลือกผู้ขอ");
    if(!to)return fieldErr(f,"to","เลือกผู้เล่น");if(to===fr)return fieldErr(f,"to","เลือกคนอื่น");
    if(requestModel().some(r=>r.from===fr&&r.to===to&&r.type===type&&(r.status==="pending"||(r.status==="accepted"&&!r.fulfilled))))return fieldErr(f,"to","มีคำขอนี้ค้างอยู่แล้ว");
    const rid=uid("r");
    if(DB.isOrg){const ok=await write(`sessions/${s.id}/decisions/${rid}`,{from:fr,to,type,createdAt:now(),status:"pending"},"บันทึกคำขอแล้ว");if(ok)logEv("บันทึกคำขอ",`${nameOf(fr)} → ${nameOf(to)} (${type==="partner"?"คู่":"คู่แข่ง"})`);return ok;}
    const me=selfDoc(DB.uid)||{};const rq={...(me.requests||{})};rq[rid]={sid:s.id,to,type,at:now()};
    return write(`self/${DB.uid}`,{...stripId(me),requests:rq},"ส่งคำขอแล้ว — รอผู้จัดอนุมัติ");
  });
}
async function compressImage(file,maxW,q){
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
    const sc=Math.min(1,maxW/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);let out=c.toDataURL("image/jpeg",q);
    if(out.length>150000)out=c.toDataURL("image/jpeg",q*0.6);return out;}
  finally{URL.revokeObjectURL(url);}
}
function dlgSlip(){
  const s=curSession();const r=payModel().rows.find(x=>x.id===DB.uid);
  openDlg(`<form novalidate><h2>ชำระเงิน · ${esc(s.title||"")}</h2>
    ${cfg().payInfo?`<div class="notice" style="white-space:pre-wrap">${esc(cfg().payInfo)}</div>`:""}
    <div class="fg">${intIn("amount","ยอดที่โอน (฿)",r?r.due:"",1,100000)}
    <label class="f">ช่องทาง<select name="method"><option>พร้อมเพย์</option><option>โอนผ่านธนาคาร</option><option>อื่น ๆ</option></select></label>
    <label class="f full">รูปสลิป<input type="file" name="file" accept="image/*"><span class="ferr"></span></label></div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">ส่งสลิป</button></div></form>`,async f=>{
    const amt=checkInt(f,"amount",true);if(amt===false)return false;
    const file=f.elements.file.files[0];if(!file)return fieldErr(f,"file","เลือกรูปสลิป");
    if(!/^image\//.test(file.type))return fieldErr(f,"file","ต้องเป็นไฟล์รูปภาพ");
    let img;try{img=await compressImage(file,1000,0.72);}catch(e){return fieldErr(f,"file","อ่านรูปไม่ได้");}
    const cur=mySlipDoc||{};const by={...(cur.bySid||{})};
    Object.keys(by).filter(k=>k!==s.id&&by[k].img).sort((a,b)=>(by[b].at||0)-(by[a].at||0)).slice(1).forEach(k=>{by[k]={...by[k],img:""};});      // keep this slip + the newest older one; the rest are dropped to stay within the document size limit
    by[s.id]={amount:amt,method:fv(f,"method"),img,at:now()};
    return write(`slips/${DB.uid}`,{bySid:by},"ส่งสลิปแล้ว — รอผู้จัดตรวจสอบ");
  });
}
function dlgPost(){
  openDlg(`<form novalidate><h2>โพสต์ใหม่</h2><div class="fg">
    <label class="f full">ข้อความ<textarea name="text" maxlength="1000" placeholder="แชร์ข่าว นัดซ้อม รูปจากสนาม"></textarea><span class="ferr"></span></label>
    <label class="f full">รูป (ไม่บังคับ)<input type="file" name="file" accept="image/*"><span class="ferr"></span></label>
    <label class="f">อนุญาตให้แสดงความคิดเห็น<select name="ac"><option value="1">ใช่</option><option value="">ไม่</option></select></label></div>
    <p class="small muted" style="margin:0">รองรับข้อความและรูปภาพ (วิดีโอยังไม่รองรับในเวอร์ชันนี้)</p>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">โพสต์</button></div></form>`,async f=>{
    const text=fv(f,"text");const file=f.elements.file.files[0];
    if(!text&&!file)return fieldErr(f,"text","พิมพ์ข้อความหรือเลือกรูป");
    let img="";if(file){if(!/^image\//.test(file.type))return fieldErr(f,"file","ต้องเป็นไฟล์รูปภาพ");try{img=await compressImage(file,800,0.65);}catch(e){return fieldErr(f,"file","อ่านรูปไม่ได้");}}
    const me=S.posts.find(p=>p.id===DB.uid)||{items:[],comments:[]};
    let items=[{id:uid("p"),text,img,at:now(),author:myName(),allowComments:!!fv(f,"ac")},...(me.items||[])].slice(0,30);
    let withImg=0;items=items.map(p=>{if(p.img){withImg++;if(withImg>2)return {...p,img:""};}return p;});   // size guard
    return write(`posts/${DB.uid}`,{items,comments:me.comments||[]},"โพสต์แล้ว");
  });
}
function myName(){const me=selfDoc(DB.uid);return (me&&me.name)||DB.meName||(DB.isOrg?"ผู้จัดก๊วน":"ผู้เล่น");}
function dlgComment(key){
  openDlg(`<form novalidate><h2>แสดงความคิดเห็น</h2><label class="f">ข้อความ<input name="text" maxlength="300"><span class="ferr"></span></label>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">ส่ง</button></div></form>`,async f=>{
    const text=fv(f,"text");if(!text)return fieldErr(f,"text","พิมพ์ข้อความ");
    const me=S.posts.find(p=>p.id===DB.uid)||{items:[],comments:[]};
    const comments=[...(me.comments||[]),{id:uid("c"),post:key,text,at:now(),author:myName()}].slice(-100);
    return write(`posts/${DB.uid}`,{items:me.items||[],comments},"ส่งความคิดเห็นแล้ว");
  });
}

/* ================= subscriptions ================= */
function selectSession(id,force){
  if(S.sid===id&&sessSubs.length&&!force)return;
  S.sid=id||null;try{localStorage.setItem(uiKey("bgo-sid"),S.sid||"");}catch(e){}
  sessSubs.forEach(u=>{try{u();}catch(e){}});sessSubs=[];
  S.roster=[];S.matches=[];S.decisions=[];S.pay=[];S.log=[];S.prep=null;S.seen=[];S.seenLoaded=false;
  if(!S.sid){render();return;}
  const p=`sessions/${S.sid}`;
  sessSubs.push(watchCol(p+"/roster",d=>{S.roster=d;render();}));
  sessSubs.push(watchCol(p+"/matches",d=>{S.matches=d;render();}));
  sessSubs.push(watchCol(p+"/decisions",d=>{S.decisions=d;render();orgHook("decisions");}));
  sessSubs.push(watchCol(p+"/pay",d=>{S.pay=d;render();}));
  sessSubs.push(watchCol(p+"/seen",d=>{S.seen=d;S.seenLoaded=true;render();orgHook("seen");}));   // organizer-witnessed sign-up / check-in times
  sessSubs.push(watchDoc(p+"/meta/prep",d=>{S.prep=d;render();}));
  if(DB.realOrg||DB.isOrg){sessSubs.push(watchCol(`private/${S.sid}/log`,d=>{S.log=d;render();}));if(typeof migratePrivate==="function")migratePrivate(S.sid);}
  render();
}
function startGlobal(){
  watchDoc("cfg/main",d=>{S.cfg=d;render();});
  watchDoc("cfg/pay",d=>{S.payqr=d;render();});
  watchDoc("inventory/main",d=>{S.inv=d;render();});
  watchDoc("board/mod",d=>{S.mod=d;render();});
  watchCol("self",d=>{const prev=S.selfDocs;S.selfDocs=d;render();orgHook("self",prev);});
  watchCol("joinreq",d=>{S.joinDec=d;render();orgHook("joinreq");});   // the organizer's answers to "the round is full" messages
  if(DB.realOrg)watchCol("notes",d=>{S.notes=d;render();});
  else if(DB.uid)watchDoc(`notes/${DB.uid}`,d=>{S.notes=d?[{id:DB.uid,...d}]:[];render();});
  watchCol("posts",d=>{S.posts=d;render();});
  if(DB.realOrg)watchCol("members",d=>{S.members=d;render();});
  if(DB.realOrg||DB.isOrg)watchCol("slips",d=>{S.slips=d;mySlipDoc=d.find(x=>x.id===DB.uid)||null;render();});
  else if(selfService())watchDoc(`slips/${DB.uid}`,d=>{mySlipDoc=d;S.slips=d?[{id:DB.uid,...d}]:[];render();});
  watchCol("sessions",d=>{const prevIds=new Set(S.sessions.map(x=>x.id));const first=!S._sessLoaded;S._sessLoaded=true;if(first&&DB.isOrg&&typeof migrateAllSessions==="function")setTimeout(()=>{migrateAllSessions();},500);
    if(!first&&APP.name==="player"){const nw=d.filter(x=>!prevIds.has(x.id)&&x.status!=="closed");if(nw.length)toast(`มีประกาศใหม่: ${nw[0].title||"รอบเล่น"} — เปิดแท็บ "ประกาศ" เพื่อลงชื่อ`);}
    S.sessions=d;
    if(!S.sid||!d.some(s=>s.id===S.sid)){let saved=null;try{saved=localStorage.getItem(uiKey("bgo-sid"));}catch(e){}
      let pick=d.find(s=>s.id===saved)||d.slice().sort((a,b)=>Math.abs(dateDiff(a.date))-Math.abs(dateDiff(b.date)))[0];
      /* a player who comes back after a closed round lands on the newest open round (the unpaid reminder and the old bills are one tap away there) */
      if(APP.name==="player"&&pick&&pick.status==="closed"){const nx=d.filter(x=>x.status!=="closed"&&(x.date||"")>=(pick.date||"")).sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0];if(nx)pick=nx;}
      selectSession(pick?pick.id:null);}
    render();});
}
const dateDiff=iso=>{if(!iso)return 1e9;const [y,m,d]=iso.split("-").map(Number);return (new Date(y,m-1,d)-new Date(new Date().toDateString()))/864e5;};

/* ================= clock / countdowns ================= */
let r2Fired=null;   // which round-2 start has already triggered its repaint
function tick(){
  const t=now();
  const ct=new Date(t).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit",second:"2-digit"});document.querySelectorAll(".clockTxt").forEach(el=>el.textContent=ct);
  document.querySelectorAll("[data-since]").forEach(el=>el.textContent=mmss(t-+el.dataset.since));
  let expired=false;
  document.querySelectorAll("[data-until]").forEach(el=>{const u=+el.dataset.until;if(u<=t)expired=true;else el.textContent=(el.dataset.pre!=null?el.dataset.pre:"พัก ")+mmss(u-t);});   // data-pre="" = a plain countdown (rest timers get the "พัก " prefix)
  if(expired)render();
  /* the moment round 2 starts, its players join the draw: repaint right then, not up to 30 s later */
  {const s=curSession(),t2=s&&s.status!=="closed"?sessRoundStart(s,2):0;if(t2&&t>=t2&&r2Fired!==s.id+"|"+t2){r2Fired=s.id+"|"+t2;render();}}
}
setInterval(tick,1000);
/* coming back to the app (unlocked phone, switched tab, network back): repaint at once so nobody reads a stale screen */
document.addEventListener("visibilitychange",()=>{if(!document.hidden){tick();render();}});
window.addEventListener("pageshow",()=>{tick();render();});
window.addEventListener("online",()=>render());
setInterval(()=>render(),30000);   // refresh ETAs and the no-show deadline
/* ================= boot ================= */
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return s.length+":"+h;}
function paint(v,html,key){
  const hk=key+"|"+hashStr(html);if(v.dataset.h===hk)return;
  const armed=[...v.querySelectorAll("[data-armed]")].map(b=>({k:(b.dataset.act||b.dataset.pact)+"|"+(b.dataset.id||""),t:b.textContent}));
  v.innerHTML=html;v.dataset.h=hk;
  armed.forEach(a=>{const [act,id]=a.k.split("|");const b=[...v.querySelectorAll(`[data-act="${act}"],[data-pact="${act}"]`)].find(x=>(x.dataset.id||"")===id);if(b){b.dataset.armed="1";b.textContent=a.t;}});
}
function PAGE(){return document.body.dataset.page||"index";}
const ORG_PAGE=()=>SIM?"organizer.html":location.protocol==="file:"?"index.html":"./";   // the organizer page is the site's main page
function goPage(p){location.href=p==="player"?"player.html":ORG_PAGE();}
async function bootApp(){
  let db=null,user=null;
  if(!SIM&&window.claude&&typeof claude.use==="function"){try{[db,user]=await Promise.all([claude.use("db"),claude.use("user")]);}catch(e){}}
  if(db&&user){
    let id=null;try{id=await user.id();}catch(e){}
    if(id){
      DB.mode="db";DB.db=db;DB.uid=id;
      try{DB.realOrg=!!(await user.canEdit());}catch(e){DB.realOrg=false;}
      try{const me=await user.me();DB.meName=me&&me.name||"";}catch(e){}
      DB.viewOnly=false;   // players write only their own area; a refused write switches this view to read-only
    }
  }
  const embedded=window.parent!==window;
  // Hosted on its own https site (GitHub Pages): the data lives in the group's GitHub repo. Shows the connect / unlock screen first when needed.
  if(DB.mode==="local"&&!SIM&&!embedded&&typeof GHUI!=="undefined"&&GHUI.wanted()){if(!(await GHUI.start()))return;}
  if(DB.mode==="local")DB.realOrg=SIM?SIM==="org":true;
  if(SIM)document.body.dataset.sim=SIM;
  // Installable app (PWA) when hosted on its own https site; never inside Claude or the simulator.
  if(!SIM&&!embedded&&"serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost"))navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).catch(()=>{});
  if(PAGE()==="player"){
    // Separate player page. If the shared-data runtime is not served on this page, fall back to the player view inside the main page (same data).
    if(DB.mode!=="db"&&embedded&&!SIM){location.replace(ORG_PAGE()+"#player");return;}
    DB.isOrg=false;startGlobal();useApp("player");return;
  }
  // Main page = organizer page. Anyone who is not an organizer goes to the player page.
  if((DB.mode==="db"||DB.mode==="gh")&&!DB.realOrg&&location.hash!=="#player"){location.replace("player.html");return;}
  const app=location.hash==="#player"||!DB.realOrg?"player":"org";
  DB.isOrg=app==="org";
  startGlobal();useApp(app);
}

/* ================= simulator agent =================
   Only active inside sim.html. The simulator drives this phone like a real finger (tap / type) through postMessage,
   so it works even when each phone frame is a separate origin (file://). */
if(SIM){
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const vis=el=>el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=="hidden";
  function find(sel,text){
    const els=[...document.querySelectorAll(sel)].filter(vis);
    return text?els.find(e=>e.textContent.includes(text)):els[0];
  }
  async function waitEl(sel,text,timeout){const end=Date.now()+(timeout||8000);for(;;){const el=find(sel,text);if(el)return el;if(Date.now()>end)throw new Error("ไม่พบ "+sel);await sleep(40);}}
  function ripple(el){
    const r=el.getBoundingClientRect(),d=document.createElement("div");
    d.style.cssText=`position:fixed;left:${r.left+r.width/2-22}px;top:${r.top+r.height/2-22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,184,0,.55);border:2px solid #E89B00;z-index:9999;pointer-events:none;transition:transform .45s,opacity .45s`;
    document.body.appendChild(d);requestAnimationFrame(()=>{d.style.transform="scale(1.6)";d.style.opacity="0";});setTimeout(()=>d.remove(),500);
  }
  const hasText=(texts,re)=>{const b=document.body.innerText;if(re){const m=b.match(new RegExp(re));return m?m[0]:null;}return texts.find(t=>b.includes(t));};
  async function cmd(m){
    if(m.cmd==="tap"){let el=await waitEl(m.sel,m.text,m.timeout);{const r=el.getBoundingClientRect();if(r.top<90||r.bottom>innerHeight-100)window.scrollBy(0,r.top-innerHeight/2);}  // scroll this phone only, never the simulator page
      await sleep(60);
      if(!el.isConnected)el=await waitEl(m.sel,m.text,m.timeout);   // the screen re-rendered under the finger: tap the fresh button
      ripple(el);el.click();return {t:Date.now()};}
    if(m.cmd==="fill"){const el=await waitEl(m.sel,null,m.timeout);el.focus();el.value=m.value;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return {t:Date.now()};}
    if(m.cmd==="waitText"){const texts=[].concat(m.text||[]);const end=Date.now()+(m.timeout||15000);
      for(;;){const hit=hasText(texts,m.re);if(hit)return {t:Date.now(),hit};if(Date.now()>end)throw new Error("ไม่เห็นข้อความ: "+texts.join(" / "));await sleep(15);}}
    if(m.cmd==="top"){window.scrollTo({top:0,behavior:"smooth"});return {t:Date.now()};}
    if(m.cmd==="has"){return {hit:hasText([].concat(m.text))||null};}
    throw new Error("unknown "+m.cmd);
  }
  window.addEventListener("message",async e=>{
    const m=e.data;if(!m||!m.simId)return;
    let res;try{res={ok:true,...(await cmd(m))};}catch(err){res={ok:false,error:String(err.message||err)};}
    (e.source||parent).postMessage({simReply:m.simId,res},"*");
  });
  const ready=()=>parent.postMessage({simReady:DB.uid},"*");
  if(document.readyState==="complete")setTimeout(ready,300);else window.addEventListener("load",()=>setTimeout(ready,300));
}
