/* Badminton Group Organizer — แอปผู้เล่น (player app).
   Uses core.js for data. Announcements the organizer publishes appear here live,
   and every sign-up, check-in, request and payment made here appears in organizer.js live. */
"use strict";
let ptab="home";
const PTABS=[
  {k:"home",t:"ประกาศ",i:"M4 10v4l12 5V5L4 10zm12-1h3v6h-3"},
  {k:"queue",t:"คิวของฉัน",i:"M4 6h16M4 12h10M4 18h7"},
  {k:"req",t:"ขอคู่",i:"M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19c0-3 2.5-5 5-5s5 2 5 5m-2 0c0-3 2.5-5 5-5s5 2 5 5"},
  {k:"pay",t:"จ่ายเงิน",i:"M3 7h18v10H3zM3 10h18M7 14h3"},
  {k:"board",t:"บอร์ด",i:"M4 5h16v11H8l-4 4z"}
];
let openList=new Set();

function pNoSession(){return `<section class="panel"><div class="empty"><h2>ยังไม่มีประกาศ</h2><p>เมื่อผู้จัดก๊วนประกาศรอบเล่น ประกาศจะขึ้นที่นี่ทันที</p></div></section>`;}
function canSelf(){return DB.mode==="local"||DB.mode==="gh"||(DB.mode==="db"&&!DB.viewOnly);}
function myProfile(){const d=selfDoc(DB.uid);return d&&d.name?d:null;}
function mySignup(sid){const d=selfDoc(DB.uid);const su=d&&d.signups&&d.signups[sid];return su&&!su.cancelled?su:null;}
function signupCount(s){
  if(s.id===S.sid){const r=rosterModel();return {conf:r.filter(p=>p.status==="confirmed").length,res:r.filter(p=>p.status==="reserve").length,list:r.filter(p=>p.status!=="removed")};}
  const list=S.selfDocs.filter(d=>{const su=d.signups&&d.signups[s.id];return su&&!su.cancelled;}).map(d=>({id:d.id,name:d.name,skill:d.skill,status:"confirmed"}));
  return {conf:Math.min(list.length,+s.maxPlayers||999),res:Math.max(0,list.length-(+s.maxPlayers||999)),list};
}

/* tell the player the moment something about them changes: their game is set / starts, a request is answered */
let pPrev=null;
function pNotify(){
  const me=myId();const s=curSession();if(!me||!s)return;
  const m=S.matches.find(x=>(x.status==="queued"||x.status==="playing")&&[...x.a,...x.b].includes(me));
  const reqs=requestModel().filter(r=>r.from===me);
  const rl=rosterModel();const mine=rl.find(x=>x.id===me);
  const cur={sid:s.id,match:m?`${m.id}:${m.status}`:"",req:Object.fromEntries(reqs.map(r=>[r.id,r.status])),st:mine?mine.status:"",slot:!!(mine&&mine.status==="reserve"&&!mine.checkedIn&&rl.openSlots)};
  if(pPrev&&pPrev.sid===cur.sid){
    let msg="";
    if(cur.st==="confirmed"&&pPrev.st==="reserve")msg="คุณได้เลื่อนเป็นตัวจริงแล้ว";
    if(cur.st==="noshow"&&pPrev.st!=="noshow")msg="เลยเวลาเช็คอินแล้ว — คุณเสียสิทธิ์ตัวจริง ถ้ามาถึงแล้วกดเช็คอินเพื่อรอที่ว่าง";
    if(cur.slot&&!pPrev.slot)msg="มีที่ว่างแล้ว! มาถึงสนามแล้วกดเช็คอินเพื่อได้สิทธิ์ก่อน";
    if(cur.match&&cur.match!==pPrev.match)msg=m.status==="playing"?`ถึงตาคุณแล้ว! ลงเล่นคอร์ด ${m.court} ได้เลย`:`คุณได้คิวคอร์ด ${m.court} — เตรียมตัวได้เลย`;
    reqs.forEach(r=>{const was=pPrev.req[r.id];if(was==="pending"&&(r.status==="accepted"||r.status==="rejected"))msg=msg||`ผู้จัด${r.status==="accepted"?"อนุมัติ":"ปฏิเสธ"}คำขอ${r.type==="partner"?"คู่":"คู่แข่ง"}กับ ${nameOf(r.to)}`;});
    if(msg){toast(msg);try{navigator.vibrate&&navigator.vibrate([180,80,180]);}catch(e){}}
  }
  pPrev=cur;
}
function pRender(){
  try{pNotify();}catch(e){}
  const c=cfg();
  $("#pgName").textContent=c.group||"Badminton Group Organizer";
  if(DB.mode==="gh")$("#pConn").textContent=GHUI.connText("player");   // sync status changes while the app is open
  const me=myProfile();
  $("#pMe").innerHTML=canSelf()?(me?`${skillChip(me.skill)}<span>${esc(me.name)}</span>`:"ตั้งชื่อ"):"ดูอย่างเดียว";
  $("#pMe").disabled=!canSelf();
  $("#pOrgBar").hidden=!DB.realOrg;
  // session chip
  const sel=$("#pSess");
  /* closed rounds stay reachable for 60 days if I played in them: that is where the bill is paid */
  const list=S.sessions.filter(s=>s.status!=="closed"||s.id===S.sid||(mySignup(s.id)&&dateDiff(s.date)>-60)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const opts=list.map(s=>`<option value="${esc(s.id)}">${esc(fmtD(s.date))} · ${esc(s.title||"รอบเล่น")}${s.status==="closed"?" (ปิดแล้ว · ดูบิล)":""}</option>`).join("")||'<option value="">ยังไม่มีประกาศ</option>';
  if(sel.dataset.h!==opts){sel.innerHTML=opts;sel.dataset.h=opts;}
  if(S.sid)sel.value=S.sid;
  // nav
  const pend=requestModel().filter(r=>r.from===DB.uid&&r.status==="accepted"&&!r.fulfilled).length;
  const nav=PTABS.map(x=>`<button data-ptab="${x.k}" aria-current="${ptab===x.k?"page":"false"}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${x.i}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${x.t}${x.k==="req"&&pend?` <b class="dot">${pend}</b>`:""}</span></button>`).join("");
  const nv=$("#pNav");if(nv.dataset.h!==nav){nv.innerHTML=nav;nv.dataset.h=nav;}
  const v=$("#pview");
  const html=({home:pHome,queue:pQueue,req:pReq,pay:pPay,board:vBoard}[ptab]||pHome)();
  paint(v,html,ptab);   // only repaint when something changed; keeps "press again" buttons armed
}

/* ---------- ประกาศ: see announcements, sign up ---------- */
function pHome(){
  let h="";
  const me=myProfile();const s=curSession();
  if(DB.mode==="db"&&DB.viewOnly)h+=`<div class="notice warn">บัญชีของคุณดูข้อมูลได้อย่างเดียว ลงชื่อเองไม่ได้ — แจ้งผู้จัดให้เพิ่มชื่อ แล้วดูคิวของตัวเองที่แท็บ "คิวของฉัน"</div>`;
  if(canSelf()){
    const su=s&&mySignup(s.id);const rp_=s&&S.sid===s.id?rosterModel().find(x=>x.id===DB.uid):null;const inNow=!!(rp_&&rp_.checkedIn)||!!(su&&su.checkedInAt&&!su.checkedOutAt);
    const steps=[[!!me,"ตั้งชื่อที่ใช้ในก๊วน","editProfile","ตั้งชื่อ"],[!!su,s?`ลงชื่อเล่นรอบ "${s.title||""}"`:"ลงชื่อเล่น (รอผู้จัดประกาศ)",s?"signupFor":"","ลงชื่อ"],[inNow,"เช็คอินเมื่อถึงสนาม แล้วระบบจะจัดคิวให้","selfCheckin","เช็คอิน"]];
    const next=steps.findIndex(x=>!x[0]);
    if(next>=0)h+=`<section class="panel steps-card"><div class="ph"><h2>เริ่มใช้งาน</h2><span class="muted small">${next}/3 ขั้น</span></div>
      <ol class="ostep">${steps.map((x,i)=>`<li class="${x[0]?"done":i===next?"now":""}"><span>${esc(x[1])}</span>${x[0]?'<span class="chip s-ready">เสร็จ</span>':i===next&&x[2]?`<button class="primary sm" data-pact="${x[2]}" data-id="${s?esc(s.id):""}">${x[3]}</button>`:""}</li>`).join("")}</ol></section>`;
  }
  const open=S.sessions.filter(x=>x.status!=="closed").sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if(!open.length)return h+pNoSession();
  h+=`<h2 class="sec">ประกาศรับสมัคร</h2>`;
  h+=open.map(x=>{
    const cnt=signupCount(x);const su=mySignup(x.id);
    const myRow=cnt.list.find(p=>p.id===DB.uid);
    const full=cnt.conf>=(+x.maxPlayers||999);
    const resPos=myRow&&myRow.status==="reserve"?cnt.list.filter(p=>p.status==="reserve").findIndex(p=>p.id===DB.uid)+1:0;
    const st=!su?"":myRow&&myRow.status==="noshow"?'<span class="chip s-bad">ไม่มาตามนัด</span>':resPos?`<span class="chip s-warn">สำรองลำดับที่ ${resPos}</span>`:'<span class="chip s-ready">ลงชื่อแล้ว</span>';
    const rlx=x.id===S.sid?rosterModel():null;const dlx=checkinDeadline(x);
    const ciNow=x.id===S.sid?!!(rosterModel().find(p=>p.id===DB.uid)||{}).checkedIn:!!(su&&su.checkedInAt&&!su.checkedOutAt);
    const tip=!su||ciNow?"":myRow&&myRow.status==="noshow"?`<div class="notice warn">เลยเวลาเช็คอิน ${hm(dlx)} — คุณเสียสิทธิ์ตัวจริงแล้ว ถ้ามาถึงแล้วกดเช็คอิน ระบบจะให้ลงเมื่อมีที่ว่าง</div>`
      :resPos&&rlx&&rlx.openSlots?`<div class="notice">มีที่ว่าง ${rlx.openSlots} ที่ — มาถึงสนามแล้วกดเช็คอินเพื่อได้สิทธิ์ก่อน</div>`
      :dlx&&now()<dlx&&!resPos?`<div class="small muted">เช็คอินที่สนามภายใน <b>${hm(dlx)}</b> ไม่งั้นเสียสิทธิ์ให้ตัวสำรอง</div>`:"";
    return `<article class="ann${x.id===S.sid?" cur":""}">
      <div class="ann-h"><div><h3>${esc(x.title||"รอบเล่น")}</h3><div class="small">${esc(fmtD(x.date))} · ${esc(x.start||"")}–${esc(x.end||"")} · ${(x.courts||[]).length} คอร์ด</div></div>${st}</div>
      ${x.desc?`<p class="small" style="margin:0;white-space:pre-wrap">${esc(x.desc)}</p>`:""}
      <div class="ann-c"><div class="bar"><span style="width:${Math.min(100,cnt.conf/Math.max(1,x.maxPlayers||1)*100)}%"></span></div><span class="small num">${cnt.conf}/${x.maxPlayers||"-"} คน${cnt.res?` · สำรอง ${cnt.res}`:""}</span></div>
      ${tip}
      <div class="ann-a">${canSelf()?(su?`${!ciNow?`<button class="primary sm" data-pact="selfCheckin" data-id="${esc(x.id)}">เช็คอิน (ถึงสนามแล้ว)</button>`:'<span class="chip s-ready">เช็คอินแล้ว</span>'}<button class="ghost sm" data-pact="cancelFor" data-id="${esc(x.id)}">ยกเลิกการลงชื่อ</button>`
        :`<button class="primary sm" data-pact="signupFor" data-id="${esc(x.id)}">${full?"ลงชื่อ (สำรอง)":"ลงชื่อเล่น"}</button>`):""}
        <button class="ghost sm" data-pact="toggleList" data-id="${esc(x.id)}">${openList.has(x.id)?"ซ่อนรายชื่อ":`ดูรายชื่อ (${cnt.list.length})`}</button>
        ${x.id!==S.sid?`<button class="ghost sm" data-pact="useSess" data-id="${esc(x.id)}">ดูคิวรอบนี้</button>`:""}</div>
      ${openList.has(x.id)?`<div class="names">${cnt.list.length?cnt.list.map(p=>`<span class="nm-chip${p.id===DB.uid?" me":""}">${skillChip(p.skill)}${esc(p.name||"ผู้เล่น")}${p.status==="reserve"?' <small>(สำรอง)</small>':""}</span>`).join(""):'<span class="muted small">ยังไม่มีคนลงชื่อ</span>'}</div>`:""}
    </article>`;}).join("");
  return h;
}

/* ---------- คิวของฉัน: live status, ETA, courts ---------- */
function pQueue(){
  const s=curSession();if(!s)return pNoSession();
  const roster=rosterModel(),ps=playerStats(),tl=timeline(roster,ps),t=now();
  let id=canSelf()?DB.uid:myIdentity;
  let h="";
  if(!canSelf()){
    h+=`<section class="panel"><div class="ph"><h2>ฉันคือใคร</h2></div><select data-pact="pickMe" aria-label="เลือกชื่อของฉัน"><option value="">— เลือกชื่อของคุณ —</option>${roster.filter(p=>p.status!=="removed").map(p=>`<option value="${esc(p.id)}" ${p.id===id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></section>`;
  }
  const p=roster.find(x=>x.id===id);
  if(!p)h+=`<section class="panel"><div class="empty">${canSelf()?`ยังไม่ได้ลงชื่อรอบ "${esc(s.title||"")}" — ไปที่แท็บ "ประกาศ" เพื่อลงชื่อ`:"เลือกชื่อเพื่อดูคิวของคุณ"}</div></section>`;
  else{
    const st=statusOf(p,ps,t),x=ps.get(p.id),w=tl.waiting.findIndex(q=>q.id===p.id),eta=tl.eta[p.id],cur=x.inMatch;
    h+=`<section class="me"><div class="me-row">
      <div class="me-stat"><span class="k">สถานะ</span><span class="chip s-${st.k}" ${st.until?`data-until="${st.until}"`:""} style="font-size:1rem">${esc(st.t)}</span></div>
      ${cur?`<div class="me-stat"><span class="k">${cur.status==="playing"?"กำลังเล่นที่":"คอร์ดที่จะลง"}</span><span class="big">คอร์ด ${esc(cur.court)}</span></div>`:""}
      ${w>=0?`<div class="me-stat"><span class="k">ลำดับคิว</span><span class="big num">${w+1}</span></div>`:""}
      ${eta&&!(cur&&cur.status==="playing")?`<div class="me-stat"><span class="k">คาดว่าได้ลง</span><span class="big num">${eta<=t+30000?"ตอนนี้":hm(eta)}</span>${eta>t+30000?`<span class="small muted">อีก ~${Math.round((eta-t)/MIN)} นาที</span>`:""}</div>`:""}
      <div class="me-stat"><span class="k">วันนี้</span><span class="big num">${x.games}</span><span class="small muted">เกม · ชนะ ${x.wins} แพ้ ${x.losses}${x.draws?` เสมอ ${x.draws}`:""}${x.helps?` · ช่วยแทน ${x.helps}`:""}</span></div></div>
      ${cur?matchMini(cur,ps,roster,t):""}
      ${st.k==="rest"?`<div class="small">พักขั้นต่ำ ${cfg().restMin} นาทีหลังจบเกม ระบบจะไม่จับคู่จนกว่าจะพักครบ</div>`:""}
      ${p.status==="reserve"?`<div class="small">คุณอยู่ในรายชื่อสำรอง${rosterModel().openSlots?` — มีที่ว่าง ${rosterModel().openSlots} ที่ มาถึงแล้วกดเช็คอินเพื่อได้สิทธิ์`:" รอที่ว่างหรือผู้จัดเลื่อนเป็นตัวจริง"}</div>`:""}
      ${p.status==="noshow"?'<div class="small" style="color:var(--shuttle)">เลยเวลาเช็คอิน — เสียสิทธิ์ตัวจริงแล้ว ถ้ามาถึงแล้วกดเช็คอิน จะได้ลงเมื่อมีที่ว่าง</div>':""}
      ${canSelf()&&p.id===DB.uid&&!p.checkedIn&&!p.checkedOutAt&&(p.status==="noshow"||p.status==="reserve")?`<div><button class="primary sm" data-pact="selfCheckin" data-id="${esc(s.id)}">เช็คอิน (ถึงสนามแล้ว)</button></div>`:""}
      ${canSelf()&&p.checkedIn&&!cur&&p.id===DB.uid?'<div><button class="sm" data-pact="selfCheckout">กลับบ้าน / เช็คเอาท์</button></div>':""}
      ${canSelf()&&p.checkedOutAt&&!p.checkedIn&&p.id===DB.uid?`<div class="small">เช็คเอาท์แล้ว — ระบบจะไม่จัดคุณลงคิว <button class="primary sm" data-pact="selfCheckin" data-id="${esc(s.id)}">กลับเข้าคิว</button></div>`:""}
      ${!p.checkedIn&&!p.checkedOutAt&&p.status==="confirmed"?`<div class="small">ยังไม่ได้เช็คอิน${canSelf()?` <button class="primary sm" data-pact="selfCheckin" data-id="${esc(s.id)}">เช็คอินตอนนี้</button>`:""}</div>`:""}
    </section>`;
  }
  const playing=S.matches.filter(m=>m.status==="playing");
  h+=`<section class="panel"><div class="ph"><h2>คอร์ดตอนนี้</h2><span class="muted small">${esc(fmtD(s.date))}</span></div><div class="courts">${(s.courts||[]).map(cn=>{const m=playing.find(x=>x.court===cn);
    return m?`<article class="court"><div class="court-h"><b>คอร์ด ${esc(cn)}</b><span class="sp"></span><span class="timer" data-since="${m.startAt}">${mmss(t-m.startAt)}</span></div><div class="court-b"><div class="vs"><div class="team a">${m.a.map(i=>pChip(i,ps,roster,t)).join("")}</div><span class="x">VS</span><div class="team b">${m.b.map(i=>pChip(i,ps,roster,t)).join("")}</div></div></div></article>`
      :`<article class="court free"><div class="court-h"><b>คอร์ด ${esc(cn)}</b><span class="sp"></span><span class="chip s-ready">ว่าง</span></div><div class="court-b">รอคู่ถัดไป</div></article>`;}).join("")}</div></section>`;
  const q=S.matches.filter(m=>m.status==="queued").sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  h+=`<section class="panel"><div class="ph"><h2>คิวถัดไป</h2><span class="muted small">${q.length} คู่ · รอ ${tl.waiting.length} คน</span></div>${q.length?`<div class="qlist">${q.map((m,i)=>`<div class="qcard"><span class="ord">${i+1}</span><div style="min-width:0">${matchMini(m,ps,roster,t)}<div class="small muted">คอร์ด ${esc(m.court)} · ~${tl.matchEta[m.id]?hm(tl.matchEta[m.id]):"–"}</div></div><span></span></div>`).join("")}</div>`:'<div class="empty">ยังไม่มีคู่ในคิว</div>'}</section>`;
  return h;
}

/* ---------- ขอคู่ ---------- */
function pReq(){
  const s=curSession();if(!s)return pNoSession();
  const mine=requestModel().filter(r=>r.from===DB.uid||r.to===DB.uid);
  return `<section class="panel"><div class="ph"><h2>คำขอคู่ / คู่แข่ง</h2><span class="sp"></span>${canSelf()&&mySignup(s.id)?'<button class="primary" data-pact="newRequest">+ ขอคู่ / คู่แข่ง</button>':""}</div>
    <p class="small muted" style="margin:0 0 10px">ส่งคำขอแล้วผู้จัดเป็นผู้อนุมัติ เมื่ออนุมัติระบบจะจัดลงแมตช์ถัดไปที่ทั้งคู่พักครบ ${cfg().restMin} นาที${cfg().autoMutual?" · ถ้าอีกฝ่ายขอคุณเป็นคู่ด้วย ระบบอนุมัติให้อัตโนมัติ":""}</p>
    ${!mySignup(s.id)&&canSelf()?'<div class="notice">ลงชื่อรอบนี้ก่อนจึงจะส่งคำขอได้</div>':""}
    ${mine.length?reqTable(mine,false):'<div class="empty">ยังไม่มีคำขอ</div>'}</section>`;
}

/* ---------- จ่ายเงิน ---------- */
function pPay(){
  const s=curSession();if(!s)return pNoSession();
  const c=priceCfg(curSession()),pm=payModel();const r=pm.rows.find(x=>x.id===myId());
  /* earlier rounds I played in that are already closed: their bill can still be checked and paid */
  const past=S.sessions.filter(x=>x.id!==s.id&&x.status==="closed"&&mySignup(x.id)&&dateDiff(x.date)>-45).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const pastBox=past.length?`<section class="panel" style="padding:12px 14px"><b>รอบก่อนหน้าที่ปิดแล้ว</b><span class="small muted"> — ตรวจบิลหรือชำระที่ค้างอยู่</span><div style="display:grid;gap:6px;margin-top:8px">${past.slice(0,4).map(x=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(fmtD(x.date))} · ${esc(x.title||"รอบเล่น")}</span><button class="sm" data-pact="useSessPay" data-id="${esc(x.id)}">ดูบิลรอบนี้</button></div>`).join("")}</div></section>`:"";
  return pastBox+`<section class="panel"><div class="ph"><h2>ค่าใช้จ่าย${s.status==="closed"?" (ปิดรอบแล้ว)":"รอบนี้"}</h2><span class="muted small">${esc(fmtD(s.date))}</span></div>
    ${r?`<div class="me-row"><div class="me-stat"><span class="k">ยอดของฉัน</span><span class="big num" style="font-family:var(--font-display);font-size:2rem;font-weight:700">${baht(r.due)} ฿</span></div><div class="me-stat"><span class="k">สถานะ</span>${payChip(r)}</div></div>
      <div class="tw" style="margin-top:10px"><table><tbody>
        <tr><td>ค่าสนาม</td><td class="n">${baht(r.courtPart)} ฿</td></tr>
        <tr><td>ค่าลูกใหม่ ${r.myShuttles} ลูก × ${unit(c.shuttleFee)} ฿${c.shuttleSplit==="shared"?" ÷ 4":""}<div class="small muted">นับจาก ${r.games} เกมที่คุณเริ่มเล่น · ลูกซ่อมไม่คิดเงิน${r.leftEarly?` · ออกกลางเกม ${r.leftEarly} เกม (ยังคิดค่าลูกของเกมนั้น)`:""}${r.helped?` · ช่วยตีแทน ${r.helped} เกม (ไม่คิดค่าลูก)`:""}</div></td><td class="n">${baht(r.shuttlePart)} ฿</td></tr>
        ${r.adjusted?`<tr><td>ผู้จัดปรับยอด${r.adjReason?` (${esc(r.adjReason)})`:""}</td><td class="n">${baht(r.due)} ฿</td></tr>`:""}
        <tr><td><b>รวม</b></td><td class="n"><b>${baht(r.due)} ฿</b></td></tr></tbody></table></div>
      ${r.state==="partial"?`<div class="notice warn">ยอดเพิ่มขึ้นหลังจากที่คุณจ่ายไปแล้ว ${baht(r.paidAmt)} ฿ — ค้างอีก <b>${baht(r.owe)} ฿</b></div>`:""}
      ${r.state==="rejected"&&r.rejectNote?`<div class="notice warn">ผู้จัดแจ้ง: ${esc(r.rejectNote)}</div>`:""}
      ${r.state!=="paid"&&selfService()?'<div style="margin-top:12px"><button class="primary" data-pact="paySlip">ชำระ / อัปโหลดสลิป</button></div>':""}
      ${r.state!=="paid"?'<p class="small muted">ยอดค่าลูกเพิ่มตามเกมที่เล่น — ชำระตอนเลิกเล่นจะได้ยอดที่ครบ</p>':""}`
      :'<div class="empty">ยังไม่มียอดของคุณ (คิดเมื่อเช็คอินหรือได้ลงเล่นแล้ว)</div>'}
    ${c.payInfo?`<div class="notice" style="margin-top:12px;white-space:pre-wrap">ช่องทางชำระ: ${esc(c.payInfo)}</div>`:""}
    <p class="small muted">อัตรา: ค่าสนาม ${baht(c.playerCourtFee)} ฿/คน + ค่าลูกใหม่ ${unit(c.shuttleFee)} ฿/ลูก${c.shuttleSplit==="shared"?" หาร 4 คนในเกม":" ต่อคน"}</p></section>`;
}

/* ---------- player actions ---------- */
async function pSignup(sid){
  const me=selfDoc(DB.uid);if(!me||!me.name){dlgProfile();toast("ตั้งชื่อก่อนลงชื่อเล่น");return;}
  const su={...(me.signups||{})};su[sid]={at:now()};
  if(await write(`self/${DB.uid}`,{...stripId(me),signups:su},"ลงชื่อแล้ว — ผู้จัดเห็นชื่อคุณแล้ว")){if(!S.sid||S.sid!==sid)selectSession(sid);}
}
document.addEventListener("click",async e=>{
  if(APP.name!=="player")return;
  const nb=e.target.closest("[data-ptab]");if(nb){ptab=nb.dataset.ptab;try{localStorage.setItem("bgo-ptab",ptab);}catch(_){}render();window.scrollTo(0,0);return;}
  if(e.target.closest("#pMe")){if(canSelf())dlgProfile();return;}
  if(e.target.closest("#pBack")){if(PAGE()==="player")goPage("org");else location.hash="";return;}
  const b=e.target.closest("[data-pact],[data-act]");if(!b||b.tagName==="SELECT")return;
  const a=b.dataset.pact||b.dataset.act,id=b.dataset.id;
  switch(a){
    case "editProfile":return dlgProfile();
    case "signupFor":return pSignup(id||S.sid);
    case "cancelFor":{const ps=S.sid===id?playerStats():null;if(ps&&ps.get(DB.uid).inMatch){toast("คุณอยู่ในแมตช์ ยกเลิกไม่ได้ — แจ้งผู้จัด");return;}
      if(ps&&ps.get(DB.uid).games>0){toast("คุณลงเล่นไปแล้ว ยกเลิกไม่ได้ — ถ้าจะกลับบ้านให้กด \"เช็คเอาท์\" ในคิวของฉัน");return;}
      if(!b.dataset.armed){b.dataset.armed="1";
        const s0=S.sessions.find(x=>x.id===id),dl=s0&&checkinDeadline(s0),fee=+cfg().noShowFee||0;
        if(dl&&now()>dl&&!((mySignup(id)||{}).checkedInAt)){b.textContent="ยืนยัน (นับเป็นไม่มา)";toast(`เลยเวลาเช็คอิน (${hm(dl)} น.) แล้ว — ถ้ายกเลิกตอนนี้จะนับเป็นไม่มาตามนัด${fee?` และมีค่าปรับ ${baht(fee)} ฿`:""}`);}
        else b.textContent="ยืนยันยกเลิก";return;}
      const me=selfDoc(DB.uid);const su={...(me.signups||{})};su[id]={...(su[id]||{}),cancelled:true,cancelledAt:now()};await write(`self/${DB.uid}`,{...stripId(me),signups:su},"ยกเลิกการลงชื่อแล้ว");return;}
    case "selfCheckin":{const sid=id||S.sid;const me=selfDoc(DB.uid);if(!me||!mySignup(sid)){toast("ลงชื่อรอบนี้ก่อน");return;}
      const su={...(me.signups||{})};su[sid]={...su[sid],checkedInAt:now()};delete su[sid].checkedOutAt;if(await write(`self/${DB.uid}`,{...stripId(me),signups:su},"เช็คอินแล้ว — เข้าคิวเรียบร้อย")){if(S.sid!==sid)selectSession(sid);ptab="queue";render();}return;}
    case "selfCheckout":{const sid=S.sid;const me=selfDoc(DB.uid);const ps=playerStats();if(!me||!mySignup(sid))return;
      if(ps.get(DB.uid).inMatch){toast("คุณอยู่ในแมตช์หรือคิว — แจ้งผู้จัดให้เปลี่ยนตัวก่อน");return;}
      if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันกลับบ้าน";return;}
      const su={...(me.signups||{})};su[sid]={...su[sid],checkedOutAt:now()};await write(`self/${DB.uid}`,{...stripId(me),signups:su},"เช็คเอาท์แล้ว — ระบบจะไม่จัดคุณลงคิวอีก");return;}
    case "toggleList":if(openList.has(id))openList.delete(id);else openList.add(id);return render();
    case "useSess":selectSession(id);ptab="queue";return render();
    case "useSessPay":selectSession(id);ptab="pay";try{localStorage.setItem("bgo-ptab",ptab);}catch(_){}window.scrollTo(0,0);return render();
    case "newRequest":return dlgRequest();
    case "reqCancel":{const me=selfDoc(DB.uid);const rq={...(me.requests||{})};if(rq[id])rq[id]={...rq[id],cancelled:true};await write(`self/${DB.uid}`,{...stripId(me),requests:rq},"ยกเลิกคำขอแล้ว");return;}
    case "paySlip":return dlgSlip();
    case "newPost":return dlgPost();
    case "comment":return dlgComment(id);
    case "delPost":{const me=S.posts.find(p=>p.id===DB.uid);if(!me)return;if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันลบ";return;}await write(`posts/${DB.uid}`,{items:(me.items||[]).filter(p=>p.id!==id),comments:me.comments||[]},"ลบโพสต์แล้ว");return;}
  }
});
document.addEventListener("change",e=>{
  if(APP.name!=="player")return;
  const el=e.target;
  if(el.id==="pSess"){selectSession(el.value);return;}
  if(el.dataset&&el.dataset.pact==="pickMe"){myIdentity=el.value||null;try{localStorage.setItem("bgo-me",myIdentity||"");}catch(_){}render();}
});
function startPlayer(){
  try{const t=localStorage.getItem("bgo-ptab");if(t&&PTABS.some(x=>x.k===t))ptab=t;}catch(e){}
  $("#pConn").textContent=SIM?"โหมดจำลอง · เชื่อมกับผู้จัด":DB.mode==="gh"?GHUI.connText("player"):DB.mode==="db"?"เชื่อมกับแอปผู้จัดแบบเรียลไทม์":"โหมดเครื่องเดียว";
  APP.render=pRender;
}
