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
  const R=roundsOf(s),max=+s.maxPlayers>0?+s.maxPlayers:999;let list;
  if(s.id===S.sid)list=rosterModel().filter(p=>p.status!=="removed");
  else{   // a round that is not open on this phone: work it out from the players' own sign-ups, with the same rules
    const raw=S.selfDocs.filter(d=>{const su=d.signups&&d.signups[s.id];return su&&!su.cancelled;}).map(d=>{const su=d.signups[s.id];return {id:d.id,name:d.name,skill:d.skill,at:+su.at||0,chosen:su.round===2?2:1,early:su.round===2&&!!su.wantEarly,fix:""};}).sort((a,b)=>a.at-b.at);
    const plan=seatPlan(raw,s);list=raw.map(p=>({...p,status:plan[p.id].status,round:plan[p.id].round||0,want:plan[p.id].want||0,no:plan[p.id].no||0,rsvNo:plan[p.id].rsvNo||0}));}
  const c1=list.filter(p=>p.status==="confirmed"&&p.round===1).length,c2=list.filter(p=>p.status==="confirmed"&&p.round===2).length;
  return {conf:c1+c2,res:list.filter(p=>p.status==="reserve").length,c1,c2,max,left1:Math.max(0,max-c1),left2:R?Math.max(0,R.max-c2):0,R,list};
}
/* "you are number 12 of round 20:00" · "reserve number 2" — the line a player reads right after signing up */
function myPlaceText(s,row){
  if(!row)return "";const R=roundsOf(s);
  if(row.status==="confirmed")return R?`คุณเป็นคนที่ ${row.no} ของรอบ ${row.round===2?R.start:s.start}${row.upgraded?" (เลื่อนขึ้นจากรอบ "+R.start+")":""}`:`คุณเป็นคนที่ ${row.no}`;
  if(row.status==="reserve")return `คุณอยู่ลำดับสำรองที่ ${row.rsvNo||"-"}${R?` ของรอบ ${row.want===2?R.start:s.start}`:""}`;
  return "";
}

/* every place of every round is taken: a new player cannot sign up, but can leave a message for the organizer
   (with one round only, signing up as a reserve stays possible, and the message is offered next to it) */
const isFull=cnt=>cnt.left1<=0&&(!cnt.R||cnt.left2<=0);
const myJoinReqs=()=>joinReqModel().filter(r=>r.uid===DB.uid);
const myPendingJR=sid=>myJoinReqs().find(r=>r.sid===sid&&r.status==="pending");
/* the organizer put me in the line (joinreq says queued): write my own sign-up for that round so every screen counts me like anybody else */
const qSyncing=new Set();
async function pQueuedSync(){
  if(!canSelf()||!DB.uid)return;
  const me=selfDoc(DB.uid);if(!me||!me.name)return;
  const todo=myJoinReqs().filter(r=>r.status==="queued"&&r.toSid&&!(me.signups&&me.signups[r.toSid])&&!qSyncing.has(r.id)&&S.sessions.some(x=>x.id===r.toSid&&x.status!=="closed"));
  if(!todo.length)return;
  todo.forEach(r=>qSyncing.add(r.id));
  const su={...(me.signups||{})};todo.forEach(r=>{su[r.toSid]={at:r.decidedAt||now(),viaReq:r.id,...(r.toRound===2?{round:2,wantEarly:false}:{})};});
  const ok=await write(`self/${DB.uid}`,{...stripId(me),signups:su});
  if(!ok)setTimeout(()=>todo.forEach(r=>qSyncing.delete(r.id)),30000);
}
/* "messages to the organizer": waiting, accepted into the line, or turned down with the organizer's reason */
function pJoinReqs(){
  const t=now(),mine=myJoinReqs().filter(r=>!r.ack&&(r.status==="pending"||t-(r.decidedAt||r.at)<14*864e5)).slice().reverse().slice(0,5);
  if(!mine.length)return "";
  return `<section class="panel jrp"><div class="ph"><h2>ข้อความถึงผู้จัด</h2></div><div class="jrl">${mine.map(r=>{
    const where=`${r.sTitle||"รอบเล่น"}${r.sDate?" · "+fmtD(r.sDate):""}`,want=`${r.when==="next"?"ขอจองรอบหน้า":"ขอรอบนี้"}${r.roundLabel?" · "+r.roundLabel:""}`;
    const chip=r.status==="queued"?'<span class="chip s-ready">ผู้จัดรับเข้าคิวแล้ว</span>':r.status==="removed"?'<span class="chip s-bad">ผู้จัดรับไม่ได้</span>':'<span class="chip s-warn">รอผู้จัดพิจารณา</span>';
    const tos=r.status==="queued"?S.sessions.find(x=>x.id===r.toSid):null;
    return `<div class="jr jr-${r.status}"><div class="jr-h">${chip}<b>${esc(want)}</b></div><div class="small muted">จากรอบ ${esc(where)}</div>${r.msg?`<p class="jr-m">${esc(r.msg)}</p>`:""}
      ${r.status==="queued"?`<div class="small">คุณถูกใส่ชื่อในรอบ <b>${esc(tos?(tos.title||"รอบเล่น")+" · "+fmtD(tos.date):"ที่ผู้จัดเปิด")}</b> แล้ว — ดูตำแหน่งที่การ์ดประกาศด้านล่าง</div>`:""}
      ${r.status==="removed"?`<div class="notice warn jr-why"><b>เหตุผลจากผู้จัด:</b> ${esc(r.reason||"ไม่ได้ระบุ")}</div>`:""}
      <div class="jr-a">${r.status==="pending"?`<button class="ghost sm" data-pact="jrCancel" data-id="${esc(r.id)}">ยกเลิกข้อความ</button>`:r.status==="removed"?`<button class="ghost sm" data-pact="jrAck" data-id="${esc(r.id)}">รับทราบ</button>`:""}</div></div>`;}).join("")}</div></section>`;
}
function dlgJoinReq(sid){
  const x=S.sessions.find(q=>q.id===sid);if(!x)return;
  const me=selfDoc(DB.uid);if(!me||!me.name){dlgProfile();toast("ตั้งชื่อก่อนส่งข้อความ");return;}
  if(myPendingJR(sid)){toast("คุณส่งข้อความของรอบนี้ไปแล้ว — รอผู้จัดพิจารณา");return;}
  const R=roundsOf(x);
  const rd=(n,v,t,chk)=>`<label class="rd"><input type="radio" name="${n}" value="${v}"${chk?" checked":""}><span><b>${t}</b></span></label>`;
  openDlg(`<form novalidate style="display:grid;gap:12px"><h2>ส่งข้อความถึงผู้จัด</h2>
    <div class="small muted">${esc(x.title||"รอบเล่น")} · ${esc(fmtD(x.date))}</div>
    <div class="notice small">${R?"รอบแรกและรอบสองเต็มทั้งคู่แล้ว":"รอบนี้เต็มแล้ว"} ลงชื่อไม่ได้ — ฝากข้อความไว้ให้ผู้จัดพิจารณา ถ้ามีที่ว่างหรือเปิดรอบใหม่ ผู้จัดจะเลือกคุณเข้าคิว ถ้ารับไม่ได้ผู้จัดจะบอกเหตุผล</div>
    <div class="rds">${rd("when","next","ขอจองรอบหน้า",1)}${rd("when","this","ขอรอบนี้ (ถ้ามีคนยกเลิก)",0)}</div>
    ${R?`<div><div class="small muted" style="margin-bottom:6px">อยากเล่นรอบไหน</div><div class="rds">${rd("rnd","0","ไม่ระบุ",1)}${rd("rnd","1",`รอบ ${esc(x.start||"")}`,0)}${rd("rnd","2",`รอบ ${esc(R.start)}`,0)}</div></div>`:""}
    <label class="f">ข้อความถึงผู้จัด (ไม่บังคับ)<textarea name="msg" rows="3" maxlength="200" placeholder="เช่น ขอจองรอบหน้าได้ไหมครับ มา 2 คน"></textarea><span class="ferr"></span></label>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ปิด</button><button type="submit" class="primary">ส่งข้อความ</button></div></form>`,async f=>{
    const m=selfDoc(DB.uid);if(!m)return false;
    if(myPendingJR(sid)){toast("คุณส่งข้อความของรอบนี้ไปแล้ว");return true;}
    const when=f.elements.when.value==="this"?"this":"next",rnd=R?(+f.elements.rnd.value||0):0,msg=fv(f,"msg").slice(0,200);
    const all={...(m.joinReqs||{})};
    all[uid("jr")]={sid,when,round:rnd,roundLabel:rnd===1?`รอบ ${x.start||""}`:rnd===2?`รอบ ${R.start}`:"",msg,at:now(),sTitle:x.title||"",sDate:x.date||""};
    const keep=Object.entries(all).sort((a,b)=>(+b[1].at||0)-(+a[1].at||0)).slice(0,20);    // old messages drop out so the document stays small
    return write(`self/${DB.uid}`,{...stripId(m),joinReqs:Object.fromEntries(keep)},"ส่งข้อความถึงผู้จัดแล้ว — ผู้จัดจะเห็นทันที");});
}
/* tell the player the moment something about them changes: their game is set / starts, a request is answered */
let pPrev=null;
function pNotify(){
  const me=myId();const s=curSession();if(!me||!s)return;
  const m=S.matches.find(x=>(x.status==="queued"||x.status==="playing")&&[...x.a,...x.b].includes(me));
  const reqs=requestModel().filter(r=>r.members.includes(me)&&!r.hiddenMirror);   // my own requests and the ones that name me
  const rl=rosterModel();const mine=rl.find(x=>x.id===me);
  const cur={jr:Object.fromEntries(myJoinReqs().map(r=>[r.id,r.status])),sid:s.id,match:m?`${m.id}:${m.status}`:"",req:Object.fromEntries(reqs.map(r=>[r.id,r.stage])),st:mine?mine.status:"",rd:mine&&mine.status==="confirmed"?mine.round:0,slot:!!(mine&&mine.status==="reserve"&&!mine.checkedIn&&rl.openSlots)};
  if(pPrev&&pPrev.sid===cur.sid){
    let msg="";
    if(cur.st==="confirmed"&&pPrev.st==="reserve")msg=cur.rd===2?`คุณได้ที่เล่นรอบ ${s.round2Start} แล้ว`:"คุณได้เลื่อนเป็นตัวจริงแล้ว";
    if(cur.rd===1&&pPrev.rd===2)msg=`มีที่ว่าง! คุณได้เลื่อนขึ้นมาเล่นตั้งแต่รอบ ${s.start} แล้ว`;
    if(cur.st==="noshow"&&pPrev.st!=="noshow")msg="เลยเวลาเช็คอินแล้ว — คุณเสียสิทธิ์ตัวจริง ถ้ามาถึงแล้วกดเช็คอินเพื่อรอที่ว่าง";
    if(cur.slot&&!pPrev.slot)msg="มีที่ว่างแล้ว! มาถึงสนามแล้วกดเช็คอินเพื่อได้สิทธิ์ก่อน";
    if(cur.match&&cur.match!==pPrev.match)msg=m.status==="playing"?`ถึงตาคุณแล้ว! ลงเล่นคอร์ด ${m.court} ได้เลย`:`คุณได้คิวคอร์ด ${m.court} — เตรียมตัวได้เลย`;
    reqs.forEach(r=>{const was=pPrev.req[r.id],mineR=r.from===me;
      if(mineR){
        if(was==="pending"&&r.stage==="approved")msg=msg||`ผู้จัดอนุมัติคำขอแล้ว — ${reqText(r)}`;
        if(was==="pending"&&r.stage==="rejected")msg=msg||`ผู้จัดไม่อนุมัติคำขอ — ${reqText(r)}`;
        if((was==="pending"||was==="approved")&&r.stage==="arranged")msg=msg||`จัดให้ลงแข่งเรียบร้อยแล้ว${r.match?` — คอร์ด ${r.match.court}`:""}`;}
      else{
        if(was===undefined&&r.stage==="pending")msg=msg||`${nameOf(r.from)} ขอเล่นกับคุณ (${r.partner===me?"เป็นคู่":"เป็นคู่แข่ง"}) — รอผู้จัดอนุมัติ`;
        if(was==="pending"&&r.stage==="approved")msg=msg||`ผู้จัดอนุมัติคำขอของ ${nameOf(r.from)} ที่ขอเล่นกับคุณแล้ว`;
        if(was==="pending"&&r.stage==="rejected")msg=msg||`ผู้จัดไม่อนุมัติคำขอของ ${nameOf(r.from)} ที่ขอเล่นกับคุณ`;
        if((was==="pending"||was==="approved")&&r.stage==="arranged")msg=msg||`จัดให้ลงแข่งเรียบร้อยแล้ว — ตามคำขอของ ${nameOf(r.from)}${r.match?` คอร์ด ${r.match.court}`:""}`;}});
    myJoinReqs().forEach(r=>{const was=(pPrev.jr||{})[r.id];if(was==="pending"&&r.status==="queued")msg=msg||"ผู้จัดรับคุณเข้าคิวแล้ว!";if(was==="pending"&&r.status==="removed")msg=msg||`ผู้จัดไม่สามารถรับคุณได้${r.reason?" — "+r.reason:""}`;});
    if(msg){toast(msg);try{navigator.vibrate&&navigator.vibrate([180,80,180]);}catch(e){}}
  }
  pPrev=cur;
}
function pRender(){
  try{pNotify();}catch(e){}
  try{pQueuedSync();}catch(e){}
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
  const pend=requestModel().filter(r=>!r.hiddenMirror&&r.members.includes(DB.uid)&&(r.stage==="approved"||(r.stage==="pending"&&r.from!==DB.uid))).length;   // approved and waiting for a game, or somebody asked to play with me
  const nav=PTABS.map(x=>`<button data-ptab="${x.k}" aria-current="${ptab===x.k?"page":"false"}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${x.i}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${x.t}${x.k==="req"&&pend?` <b class="dot">${pend}</b>`:""}</span></button>`).join("");
  const nv=$("#pNav");if(nv.dataset.h!==nav){nv.innerHTML=nav;nv.dataset.h=nav;}
  const v=$("#pview");
  const html=({home:pHome,queue:pQueue,req:pReq,pay:pPay,board:vBoard}[ptab]||pHome)();
  paint(v,(DB.mode==="gh"?GHUI.tokenBar():"")+html,ptab);   // only repaint when something changed; keeps "press again" buttons armed
  fillPayQr();
}

/* QR pictures that carry the player's own amount are drawn after the page is painted (PromptPay number saved by the organizer) */
const qrCache=new Map();
function fillPayQr(){
  const pq=S.payqr;if(!pq||!pq.pp)return;
  document.querySelectorAll("img[data-qrpay]").forEach(async im=>{
    const amt=+im.dataset.qrpay||0,key=pq.pp+"|"+amt+"|"+(pq.ppName||"");
    let url=qrCache.get(key);
    if(!url){try{const b=await QRS.cardBlob({text:QRS.ppPayload(pq.pp,amt),title:"สแกนจ่ายค่าเล่น",lines:[pq.ppName?`บัญชี ${pq.ppName}`:"",amt>0?`ยอด ${baht(amt)} บาท`:""].filter(Boolean)});url=URL.createObjectURL(b);qrCache.set(key,url);}catch(e){return;}}
    if(im.isConnected&&!im.getAttribute("src"))im.src=url;});
}
/* ---------- ประกาศ: see announcements, sign up ---------- */
function pHome(){
  let h="";
  const me=myProfile();const s=curSession();
  if(DB.mode==="db"&&DB.viewOnly)h+=`<div class="notice warn">บัญชีของคุณดูข้อมูลได้อย่างเดียว ลงชื่อเองไม่ได้ — แจ้งผู้จัดให้เพิ่มชื่อ แล้วดูคิวของตัวเองที่แท็บ "คิวของฉัน"</div>`;
  if(canSelf()){
    const su=s&&mySignup(s.id);const rp_=s&&S.sid===s.id?rosterModel().find(x=>x.id===DB.uid):null;const inNow=!!(rp_&&rp_.checkedIn)||!!(su&&su.checkedInAt&&!su.checkedOutAt);
    const blk=!!(s&&!su&&roundsOf(s)&&isFull(signupCount(s)));
    const steps=[[!!me,"ตั้งชื่อที่ใช้ในก๊วน","editProfile","ตั้งชื่อ"],[!!su,blk?`รอบ "${s.title||""}" เต็มทั้งสองรอบ — ส่งข้อความถึงผู้จัดเพื่อขอจองรอบหน้า`:s?`ลงชื่อเล่นรอบ "${s.title||""}"`:"ลงชื่อเล่น (รอผู้จัดประกาศ)",blk?"joinReq":s?"signupFor":"",blk?"ส่งข้อความ":"ลงชื่อ"],[inNow,"เช็คอินเมื่อถึงสนาม แล้วระบบจะจัดคิวให้","selfCheckin","เช็คอิน"]];
    const next=steps.findIndex(x=>!x[0]);
    if(next>=0)h+=`<section class="panel steps-card"><div class="ph"><h2>เริ่มใช้งาน</h2><span class="muted small">${next}/3 ขั้น</span></div>
      <ol class="ostep">${steps.map((x,i)=>`<li class="${x[0]?"done":i===next?"now":""}"><span>${esc(x[1])}</span>${x[0]?'<span class="chip s-ready">เสร็จ</span>':i===next&&x[2]?`<button class="primary sm" data-pact="${x[2]}" data-id="${s?esc(s.id):""}">${x[3]}</button>`:""}</li>`).join("")}</ol></section>`;
  }
  if(canSelf())h+=pJoinReqs();
  const open=S.sessions.filter(x=>x.status!=="closed").sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  if(!open.length)return h+pNoSession();
  h+=`<h2 class="sec">ประกาศรับสมัคร</h2>`;
  h+=open.map(x=>{
    const cnt=signupCount(x);const su=mySignup(x.id);
    const myRow=cnt.list.find(p=>p.id===DB.uid);
    const R=cnt.R,full=cnt.left1<=0;
    const noRoom=!su&&isFull(cnt),blocked=noRoom&&!!R,pjr=myPendingJR(x.id);     // both rounds are full: no sign-up, only a message to the organizer
    const gone=x.id===S.sid?rosterModel().find(p=>p.id===DB.uid&&p.status==="removed"):null;     // the organizer took me out of this round
    const resPos=myRow&&myRow.status==="reserve"?(myRow.rsvNo||cnt.list.filter(p=>p.status==="reserve").findIndex(p=>p.id===DB.uid)+1):0;
    const st=!su||gone?"":myRow&&myRow.status==="noshow"?'<span class="chip s-bad">ไม่มาตามนัด</span>':resPos?`<span class="chip s-warn">สำรองลำดับที่ ${resPos}</span>`:'<span class="chip s-ready">ลงชื่อแล้ว</span>';
    const place=su&&myRow?myPlaceText(x,myRow):"";
    const rlx=x.id===S.sid?rosterModel():null;const dlx=checkinDeadline(x);
    const ciNow=x.id===S.sid?!!(rosterModel().find(p=>p.id===DB.uid)||{}).checkedIn:!!(su&&su.checkedInAt&&!su.checkedOutAt);
    const early2=myRow&&myRow.status==="confirmed"&&myRow.round===2&&R&&now()<sessRoundStart(x,2);
    const tip=!su||gone?"":early2?`<div class="notice">คุณลงชื่อ <b>รอบ ${esc(R.start)}</b> — ${ciNow?"เช็คอินแล้ว แต่":"ถึงสนามก่อนได้ เช็คอินไว้ได้เลย แต่"} ระบบจะเริ่มจัดคุณลงคอร์ดตั้งแต่ <b>${esc(R.start)}</b> เท่านั้น</div>`:ciNow?"":myRow&&myRow.status==="noshow"?`<div class="notice warn">เลยเวลาเช็คอิน ${hm(dlx)} — คุณเสียสิทธิ์ตัวจริงแล้ว ถ้ามาถึงแล้วกดเช็คอิน ระบบจะให้ลงเมื่อมีที่ว่าง</div>`
      :resPos&&rlx&&rlx.openSlots?`<div class="notice">มีที่ว่าง ${rlx.openSlots} ที่ — มาถึงสนามแล้วกดเช็คอินเพื่อได้สิทธิ์ก่อน</div>`
      :dlx&&now()<dlx&&!resPos?`<div class="small muted">เช็คอินที่สนามภายใน <b>${hm(dlx)}</b> ไม่งั้นเสียสิทธิ์ให้ตัวสำรอง</div>`:"";
    return `<article class="ann${x.id===S.sid?" cur":""}">
      <div class="ann-h"><div><h3>${esc(x.title||"รอบเล่น")}</h3><div class="small">${esc(fmtD(x.date))} · ${esc(x.start||"")}–${esc(x.end||"")} · ${(x.courts||[]).length} คอร์ด</div></div>${st}</div>
      ${x.desc?`<p class="small" style="margin:0;white-space:pre-wrap">${esc(x.desc)}</p>`:""}
      <div class="ann-c"><div class="bar"><span style="width:${Math.min(100,cnt.c1/Math.max(1,x.maxPlayers||1)*100)}%"></span></div><span class="small num">${R?`รอบ ${esc(x.start||"")} ${cnt.c1}/${x.maxPlayers||"-"} คน`:`${cnt.conf}/${x.maxPlayers||"-"} คน`}${cnt.res?` · สำรอง ${cnt.res}`:""}</span></div>
      ${R?`<div class="ann-c"><div class="bar"><span style="width:${R.max<999?Math.min(100,cnt.c2/Math.max(1,R.max)*100):0}%"></span></div><span class="small num">รอบ ${esc(R.start)} ${cnt.c2}/${R.max<999?R.max:"-"} คน</span></div>`:""}
      ${place?`<div class="myplace"><b>${esc(place)}</b></div>`:""}
      ${tip}
      ${gone?`<div class="notice warn"><b>ผู้จัดนำคุณออกจากรอบนี้</b>${gone.removedReason?`<br>เหตุผล: ${esc(gone.removedReason)}`:""}</div>`:""}
      ${blocked?`<div class="notice warn">รอบนี้เต็มทั้งรอบ ${esc(x.start||"")} และรอบ ${esc(R.start)} แล้ว — ลงชื่อไม่ได้ แต่ส่งข้อความถึงผู้จัดเพื่อขอจองรอบหน้าได้</div>`:""}
      <div class="ann-a">${canSelf()?(gone?"":su?`${!ciNow?`<button class="primary sm" data-pact="selfCheckin" data-id="${esc(x.id)}">เช็คอิน (ถึงสนามแล้ว)</button>`:'<span class="chip s-ready">เช็คอินแล้ว</span>'}${R&&myRow&&myRow.status!=="noshow"&&!(myRow.status==="confirmed"&&ciNow)&&!(x.id===S.sid&&S.roster.some(r=>r.id===DB.uid&&(r.round===1||r.round===2)))?`<button class="ghost sm" data-pact="switchRound" data-id="${esc(x.id)}">เปลี่ยนรอบ</button>`:""}<button class="ghost sm" data-pact="cancelFor" data-id="${esc(x.id)}">ยกเลิกการลงชื่อ</button>`
        :blocked?(pjr?'<span class="chip s-warn">ส่งข้อความแล้ว · รอผู้จัด</span>':`<button class="primary sm" data-pact="joinReq" data-id="${esc(x.id)}">ส่งข้อความถึงผู้จัด</button>`)
        :`<button class="primary sm" data-pact="signupFor" data-id="${esc(x.id)}">${full&&!R?"ลงชื่อ (สำรอง)":"ลงชื่อเล่น"}</button>${noRoom&&!pjr?`<button class="ghost sm" data-pact="joinReq" data-id="${esc(x.id)}">ส่งข้อความถึงผู้จัด</button>`:""}`):""}
        <button class="ghost sm" data-pact="toggleList" data-id="${esc(x.id)}">${openList.has(x.id)?"ซ่อนรายชื่อ":`ดูรายชื่อ (${cnt.list.length})`}</button>
        ${x.id!==S.sid?`<button class="ghost sm" data-pact="useSess" data-id="${esc(x.id)}">ดูคิวรอบนี้</button>`:""}</div>
      ${openList.has(x.id)?pNames(x,cnt):""}
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
      <div class="me-stat"><span class="k">วันนี้</span><span class="big num">${x.games}</span><span class="small muted">เกม · ชนะ ${x.wins} · แพ้ ${x.losses}${x.draws?` เสมอ ${x.draws}`:""}${x.helps?` · ช่วยแทน ${x.helps}`:""}</span></div></div>
      ${cur?matchMini(cur,ps,roster,t):""}
      ${p.status==="confirmed"||p.status==="reserve"?`<div class="myplace"><b>${esc(myPlaceText(s,p))}</b></div>`:""}
      ${p.notYet?`<div class="notice">คุณลงชื่อ <b>รอบ ${esc(s.round2Start)}</b> — ${p.checkedIn?"เช็คอินแล้ว":"ถึงสนามก่อนได้"} · ระบบจะเริ่มจัดคุณลงคอร์ดตั้งแต่ <b>${esc(s.round2Start)}</b> (อีก ~${Math.max(1,Math.round((sessRoundStart(s,2)-t)/MIN))} นาที)</div>`:""}
      ${p.upgraded&&p.status==="confirmed"?`<div class="small">คุณได้เลื่อนขึ้นมาเล่นตั้งแต่รอบ ${esc(s.start||"")} แล้ว</div>`:""}
      ${st.k==="rest"?`<div class="small">พักขั้นต่ำ ${cfg().restMin} นาทีหลังจบเกม ระบบจะไม่จับคู่จนกว่าจะพักครบ</div>`:""}
      ${p.status==="removed"?`<div class="notice warn"><b>ผู้จัดนำคุณออกจากรอบนี้</b>${p.removedReason?`<br>เหตุผล: ${esc(p.removedReason)}`:""}</div>`:""}
      ${p.status==="reserve"?`<div class="small">คุณอยู่ในรายชื่อสำรอง${(p.want===2?rosterModel().openSlots2:rosterModel().openSlots)?` — มีที่ว่าง ${p.want===2?rosterModel().openSlots2:rosterModel().openSlots} ที่ มาถึงแล้วกดเช็คอินเพื่อได้สิทธิ์`:" รอที่ว่างหรือผู้จัดเลื่อนเป็นตัวจริง"}</div>`:""}
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
  const all=requestModel().filter(r=>r.members.includes(DB.uid));
  const mine=all.filter(r=>r.from===DB.uid);
  // requests that name me; a mutual partner request shows once, in my own list
  const about=all.filter(r=>r.from!==DB.uid&&r.status!=="cancelled"&&!r.hiddenMirror&&!mine.some(m=>m.mutualOf===r.id||r.mutualOf===m.id));
  const aboutBox=about.length?`<section class="panel reqabout"><div class="ph"><h2>คนที่ขอเล่นกับคุณ</h2><span class="chip s-warn">${about.length}</span></div>
    <p class="small muted" style="margin:0 0 10px">เพื่อนในก๊วนส่งคำขอที่มีชื่อคุณ — ผู้จัดเป็นผู้อนุมัติ และจัดให้เฉพาะเกมถัดไปครั้งเดียว หลังจากนั้นจัดตามปกติ</p>${reqTable(about,false,DB.uid)}</section>`:"";
  return aboutBox+`<section class="panel"><div class="ph"><h2>คำขอคู่ / คู่แข่ง</h2><span class="sp"></span>${canSelf()&&mySignup(s.id)?'<button class="primary" data-pact="newRequest">+ ขอคู่ / คู่แข่ง</button>':""}</div>
    <p class="small muted" style="margin:0 0 10px">ขอได้ 2–4 คน (คู่ 1 คน + คู่แข่งไม่เกิน 2 คน) ส่งคำขอแล้วผู้จัดเป็นผู้อนุมัติ เมื่ออนุมัติระบบจะจัดลงแมตช์ถัดไปที่ทุกคนพักครบ ${cfg().restMin} นาที — ใช้ครั้งเดียว หลังจากนั้นจัดตามปกติ${cfg().autoMutual?" · ถ้าอีกฝ่ายขอเป็นคู่กลับมา ระบบอนุมัติให้อัตโนมัติ":""}</p>
    ${!mySignup(s.id)&&canSelf()?'<div class="notice">ลงชื่อรอบนี้ก่อนจึงจะส่งคำขอได้</div>':""}
    ${mine.length?reqTable(mine,false,DB.uid):'<div class="empty">ยังไม่มีคำขอ</div>'}</section>`;
}

/* ---------- จ่ายเงิน ---------- */
function pPay(){
  const s=curSession();if(!s)return pNoSession();
  const c=priceCfg(curSession()),pm=payModel();const r=pm.rows.find(x=>x.id===myId());
  /* earlier rounds I played in that are already closed: their bill can still be checked and paid */
  const past=S.sessions.filter(x=>x.id!==s.id&&x.status==="closed"&&mySignup(x.id)&&dateDiff(x.date)>-45).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const pastBox=past.length?`<section class="panel" style="padding:12px 14px"><b>รอบก่อนหน้าที่ปิดแล้ว</b><span class="small muted"> — ตรวจบิลหรือชำระที่ค้างอยู่</span><div style="display:grid;gap:6px;margin-top:8px">${past.slice(0,4).map(x=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(fmtD(x.date))} · ${esc(x.title||"รอบเล่น")}</span><button class="sm" data-pact="useSessPay" data-id="${esc(x.id)}">ดูบิลรอบนี้</button></div>`).join("")}</div></section>`:"";
  /* what I still owe from rounds that are already closed (recorded privately by the organizer) */
  const mine=((S.notes||[]).find(n=>n.id===DB.uid)||{}).bySid||{};
  const debts=Object.entries(mine).map(([sid,v])=>({sid,v,ss:S.sessions.find(x=>x.id===sid)})).filter(x=>x.ss&&x.ss.status==="closed"&&+x.v.owe>0&&x.ss.id!==s.id).sort((a,b)=>(a.ss.date||"").localeCompare(b.ss.date||""));
  const debtBox=debts.length?`<section class="panel" style="padding:12px 14px"><b>ยอดค้างจากรอบก่อน ${baht(debts.reduce((a,x)=>a+(+x.v.owe),0))} ฿</b><span class="small muted"> — จ่ายเพิ่มได้ตอนมาเล่นรอบหน้า หรือโอนแล้วอัปโหลดสลิป</span><div style="display:grid;gap:6px;margin-top:8px">${debts.map(x=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><span>${esc(fmtD(x.ss.date))} · ${esc(x.ss.title||"รอบเล่น")} <b>ค้าง ${baht(x.v.owe)} ฿</b></span><button class="sm" data-pact="useSessPay" data-id="${esc(x.sid)}">ดูบิลรอบนี้</button></div>`).join("")}</div></section>`:"";
  return debtBox+pastBox+`<section class="panel"><div class="ph"><h2>ค่าใช้จ่าย${s.status==="closed"?" (ปิดรอบแล้ว)":"รอบนี้"}</h2><span class="muted small">${esc(fmtD(s.date))}</span></div>
    ${r?`<div class="me-row"><div class="me-stat"><span class="k">ยอดของฉัน</span><span class="big num" style="font-family:var(--font-display);font-size:2rem;font-weight:700">${baht(r.due)} ฿</span></div><div class="me-stat"><span class="k">สถานะ</span>${payChip(r)}</div></div>
      <div class="tw" style="margin-top:10px"><table><tbody>
        <tr><td>ค่าสนาม</td><td class="n">${baht(r.courtPart)} ฿</td></tr>
        <tr><td>ค่าลูกใหม่ ${r.myShuttles} ลูก × ${unit(c.shuttleFee)} ฿${c.shuttleSplit==="shared"?" ÷ 4":""}<div class="small muted">นับจาก ${r.games} เกมที่คุณเริ่มเล่น · ลูกซ่อมไม่คิดเงิน${r.leftEarly?` · ออกกลางเกม ${r.leftEarly} เกม (ยังคิดค่าลูกของเกมนั้น)`:""}${r.helped?` · ช่วยตีแทน ${r.helped} เกม (ไม่คิดค่าลูก)`:""}</div></td><td class="n">${baht(r.shuttlePart)} ฿</td></tr>
        ${r.adjusted?`<tr><td>ผู้จัดปรับยอด${r.adjReason?` (${esc(r.adjReason)})`:""}</td><td class="n">${baht(r.due)} ฿</td></tr>`:""}
        <tr><td><b>รวม</b></td><td class="n"><b>${baht(r.due)} ฿</b></td></tr></tbody></table></div>
      ${r.recs&&r.recs.length?`<div class="small muted" style="margin-top:8px">รับแล้ว: ${r.recs.map(x=>`${x.m==="transfer"?"โอน":"เงินสด"} ${baht(x.a)} ฿`).join(" + ")}</div>`:""}
      ${r.state==="partial"?`<div class="notice warn">ยอดเพิ่มขึ้นหลังจากที่คุณจ่ายไปแล้ว ${baht(r.paidAmt)} ฿ — ค้างอีก <b>${baht(r.owe)} ฿</b></div>`:""}
      ${r.state==="rejected"&&r.rejectNote?`<div class="notice warn">ผู้จัดแจ้ง: ${esc(r.rejectNote)}</div>`:""}
      ${r.state!=="paid"&&selfService()?'<div style="margin-top:12px"><button class="primary" data-pact="paySlip">ชำระ / อัปโหลดสลิป</button></div>':""}
      ${r.state!=="paid"?'<p class="small muted">ยอดค่าลูกเพิ่มตามเกมที่เล่น — ชำระตอนเลิกเล่นจะได้ยอดที่ครบ</p>':""}`
      :'<div class="empty">ยังไม่มียอดของคุณ (คิดเมื่อเช็คอินหรือได้ลงเล่นแล้ว)</div>'}
    ${(()=>{const pq=S.payqr;if(!pq||!(pq.img||pq.pp))return "";const owe=r&&r.state!=="paid"?Math.ceil(r.owe):0;
      return `<div class="paycard"><b>สแกนจ่ายด้วย QR</b>${pq.pp&&owe>0?`<img class="qrprev" data-qrpay="${owe}" alt="QR จ่ายเงินยอด ${owe} บาท"><div class="small">ยอด <b>${baht(owe)} ฿</b> อยู่ใน QR แล้ว${pq.ppName?` · บัญชี ${esc(pq.ppName)}`:""}</div>`
        :pq.img?`<img class="qrprev" src="${esc(pq.img)}" alt="QR จ่ายเงิน"><div class="small">${pq.ppName?`บัญชี ${esc(pq.ppName)} · `:""}ใส่ยอดเองตามบิลด้านบน</div>`:`<img class="qrprev" data-qrpay="0" alt="QR พร้อมเพย์"><div class="small">${pq.ppName?`บัญชี ${esc(pq.ppName)} · `:""}ใส่ยอดเองตามบิลด้านบน</div>`}
        <button class="sm" data-pact="qrSaveMine" data-amt="${owe}">บันทึกรูป QR (เปิดจากแกลเลอรีในแอปธนาคาร)</button></div>`;})()}
    ${c.payInfo?`<div class="notice" style="margin-top:12px;white-space:pre-wrap">ช่องทางชำระ: ${esc(c.payInfo)}</div>`:""}
    <p class="small muted">อัตรา: ค่าสนาม ${baht(c.playerCourtFee)} ฿/คน + ค่าลูกใหม่ ${unit(c.shuttleFee)} ฿/ลูก${c.shuttleSplit==="shared"?" หาร 4 คนในเกม":" ต่อคน"}</p></section>`;
}

/* ---------- player actions ---------- */
async function pSignup(sid,opt){
  const me=selfDoc(DB.uid);if(!me||!me.name){dlgProfile();toast("ตั้งชื่อก่อนลงชื่อเล่น");return;}
  const su={...(me.signups||{})};su[sid]={at:now(),...(opt&&opt.round===2?{round:2,wantEarly:!!opt.early}:{})};
  if(await write(`self/${DB.uid}`,{...stripId(me),signups:su},"ลงชื่อแล้ว — ผู้จัดเห็นชื่อคุณแล้ว")){if(!S.sid||S.sid!==sid)selectSession(sid);}
}
/* the list of who is coming, in the order of the places: round 1, round 2, reserve */
function pNames(x,cnt){
  const R=cnt.R,L=cnt.list;if(!L.length)return `<div class="names"><span class="muted small">ยังไม่มีคนลงชื่อ</span></div>`;
  const chip=(p,n)=>`<span class="nm-chip${p.id===DB.uid?" me":""}">${n?`<b class="no">${n}</b>`:""}${skillChip(p.skill)}${esc(p.name||"ผู้เล่น")}</span>`;
  const grp=(title,arr,key)=>arr.length?`<div class="ngrp"><div class="small"><b>${title}</b> · ${arr.length} คน</div><div class="names">${arr.map(p=>chip(p,key?p[key]:0)).join("")}</div></div>`:"";
  const conf=L.filter(p=>p.status==="confirmed");
  return `<div class="ngrps">${grp(R?`รอบ ${esc(x.start||"")}`:"ตัวจริง",conf.filter(p=>p.round!==2),"no")}${R?grp(`รอบ ${esc(R.start)}`,conf.filter(p=>p.round===2),"no"):""}${grp("สำรอง",L.filter(p=>p.status==="reserve"),"rsvNo")}${grp("ไม่มาตามนัด",L.filter(p=>p.status==="noshow"),"")}</div>`;
}
/* sign up for a round that has a second round: pick round 1 or round 2 (and say whether you still want round 1 if a place opens) */
function dlgJoin(sid){
  const x=S.sessions.find(q=>q.id===sid);if(!x)return;const cnt=signupCount(x),R=cnt.R;if(!R)return pSignup(sid);
  const me=selfDoc(DB.uid);if(!me||!me.name){dlgProfile();toast("ตั้งชื่อก่อนลงชื่อเล่น");return;}
  const su=mySignup(sid),cur=su?(su.round===2?2:1):0,row=cnt.list.find(p=>p.id===DB.uid);
  if(!su&&isFull(cnt)){toast("รอบนี้เต็มทั้งสองรอบ — ส่งข้อความถึงผู้จัดแทน");return dlgJoinReq(sid);}
  const def=cur||(cnt.left1>0?1:2);
  const sub1=cnt.left1>0?`ที่นั่งเหลือ ${cnt.left1}`:"เต็มแล้ว — ต่อคิวสำรอง ถ้ามีคนยกเลิกจะได้เลื่อนขึ้นตามลำดับ";
  const sub2=cnt.left2>0?`ที่นั่งเหลือ ${cnt.left2} · ระบบจัดลงคอร์ดตั้งแต่ ${R.start}`:`เต็มแล้ว — ต่อคิวสำรองรอบ ${R.start}`;
  const rd=(v,t,sb)=>`<label class="rd"><input type="radio" name="round" value="${v}"${def===v?" checked":""}><span><b>${t}</b><span class="small muted">${sb}</span></span></label>`;
  const warn=su&&cur===1&&row&&row.status==="confirmed"?`<div class="notice warn small">ถ้าย้ายไปรอบ ${esc(R.start)} คุณจะเสียที่รอบ ${esc(x.start||"")} ให้คนถัดไป</div>`:"";
  openDlg(`<form novalidate style="display:grid;gap:12px"><h2>${su?"เปลี่ยนรอบ":"ลงชื่อเล่น"} · ${esc(x.title||"รอบเล่น")}</h2>
    <div class="rds">${rd(1,`รอบ ${esc(x.start||"")} (เริ่มตามปกติ)`,sub1)}${rd(2,`รอบ ${esc(R.start)} (เข้าทีหลัง)`,sub2)}</div>
    <label class="ck" id="earlyBox"><input type="checkbox" name="early"${su?(su.wantEarly?" checked":""):" checked"}><span>ถ้ามีที่ว่างรอบ ${esc(x.start||"")} ให้เลื่อนฉันขึ้นไปเล่นรอบนั้นก่อน <span class="small muted">(เรียงตามลำดับคนลงชื่อ)</span></span></label>
    ${warn}<div class="notice small">คนที่ลงรอบ ${esc(R.start)} เช็คอินที่สนามก่อนเวลาได้ แต่ระบบจะเริ่มจัดลงคอร์ดตั้งแต่ ${esc(R.start)} เท่านั้น</div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ปิด</button><button type="submit" class="primary">${su?"บันทึกการเปลี่ยน":"ลงชื่อ"}</button></div></form>`,async f=>{
    const round=+f.elements.round.value,early=round===2&&f.elements.early.checked;
    const m=selfDoc(DB.uid),all={...(m.signups||{})},old=all[sid]&&!all[sid].cancelled?all[sid]:null;
    if(old&&(old.round===2?2:1)===round&&!!old.wantEarly===early&&round===2){toast("ไม่มีอะไรเปลี่ยน");return true;}
    if(old&&(old.round===2?2:1)===round&&round===1){toast("คุณอยู่รอบนี้อยู่แล้ว");return true;}
    const moved=!old||(old.round===2?2:1)!==round;
    all[sid]={...(old||{}),at:moved?now():old.at,round:round===2?2:1,wantEarly:early};if(round===1)delete all[sid].wantEarly;
    delete all[sid].cancelled;delete all[sid].cancelledAt;
    const ok=await write(`self/${DB.uid}`,{...stripId(m),signups:all},old?"เปลี่ยนรอบแล้ว":"ลงชื่อแล้ว — ผู้จัดเห็นชื่อคุณแล้ว");
    if(ok&&(!S.sid||S.sid!==sid))selectSession(sid);return ok;});
  const sync=()=>{const f=document.querySelector("#dlg form");if(!f)return;const b=document.getElementById("earlyBox");if(b)b.hidden=f.elements.round.value!=="2";};
  document.querySelectorAll('#dlg input[name=round]').forEach(r=>r.addEventListener("change",sync));sync();
}
document.addEventListener("click",async e=>{
  if(APP.name!=="player")return;
  const nb=e.target.closest("[data-ptab]");if(nb){ptab=nb.dataset.ptab;try{localStorage.setItem(uiKey("bgo-ptab"),ptab);}catch(_){}render();window.scrollTo(0,0);return;}
  if(e.target.closest("#pMe")){if(canSelf())dlgProfile();return;}
  if(e.target.closest("#pBack")){if(PAGE()==="player")goPage("org");else location.hash="";return;}
  const b=e.target.closest("[data-pact],[data-act]");if(!b||b.tagName==="SELECT")return;
  const a=b.dataset.pact||b.dataset.act,id=b.dataset.id;
  switch(a){
    case "editProfile":return dlgProfile();
    case "signupFor":{const sid=id||S.sid,x=S.sessions.find(q=>q.id===sid);return x&&roundsOf(x)?dlgJoin(sid):pSignup(sid);}
    case "switchRound":return dlgJoin(id||S.sid);
    case "joinReq":return dlgJoinReq(id||S.sid);
    case "jrAck":{const me=selfDoc(DB.uid);if(!me)return;const jr={...(me.joinReqs||{})};if(jr[id])jr[id]={...jr[id],ack:true};await write(`self/${DB.uid}`,{...stripId(me),joinReqs:jr},"รับทราบแล้ว");return;}
    case "jrCancel":{const me=selfDoc(DB.uid);if(!me)return;const jr={...(me.joinReqs||{})};if(jr[id])jr[id]={...jr[id],cancelled:true};await write(`self/${DB.uid}`,{...stripId(me),joinReqs:jr},"ปิดข้อความแล้ว");return;}
    case "cancelFor":{const ps=S.sid===id?playerStats():null;if(ps&&ps.get(DB.uid).inMatch){toast("คุณอยู่ในแมตช์ ยกเลิกไม่ได้ — แจ้งผู้จัด");return;}
      if(ps&&ps.get(DB.uid).games>0){toast("คุณลงเล่นไปแล้ว ยกเลิกไม่ได้ — ถ้าจะกลับบ้านให้กด \"เช็คเอาท์\" ในคิวของฉัน");return;}
      if(!b.dataset.armed){b.dataset.armed="1";
        const s0=S.sessions.find(x=>x.id===id),dl=s0&&checkinDeadline(s0),fee=+cfg().noShowFee||0;
        if(dl&&now()>dl&&!((mySignup(id)||{}).checkedInAt)){b.textContent="ยืนยัน (นับเป็นไม่มา)";toast(`เลยเวลาเช็คอิน (${hm(dl)} น.) แล้ว — ถ้ายกเลิกตอนนี้จะนับเป็นไม่มาตามนัด${fee?` และมีค่าปรับ ${baht(fee)} ฿`:""}`);}
        else b.textContent="ยืนยันยกเลิก";return;}
      const me=selfDoc(DB.uid);const su={...(me.signups||{})};su[id]={...(su[id]||{}),cancelled:true,cancelledAt:now()};await write(`self/${DB.uid}`,{...stripId(me),signups:su},"ยกเลิกการลงชื่อแล้ว");return;}
    case "selfCheckin":{const sid=id||S.sid;const me=selfDoc(DB.uid);if(!me||!mySignup(sid)){toast("ลงชื่อรอบนี้ก่อน");return;}
      const su={...(me.signups||{})};su[sid]={...su[sid],checkedInAt:now()};delete su[sid].checkedOutAt;
      const sx=S.sessions.find(q=>q.id===sid),r2=sx&&roundsOf(sx)&&su[sid].round===2&&now()<sessRoundStart(sx,2)&&!(S.sid===sid&&(rosterModel().find(q=>q.id===DB.uid)||{}).round===1);
      if(await write(`self/${DB.uid}`,{...stripId(me),signups:su},r2?`เช็คอินแล้ว — คุณลงรอบ ${sx.round2Start} รอถึงเวลาแล้วระบบจะจัดคุณลงคอร์ด`:"เช็คอินแล้ว — เข้าคิวเรียบร้อย")){if(S.sid!==sid)selectSession(sid);ptab="queue";render();}return;}
    case "selfCheckout":{const sid=S.sid;const me=selfDoc(DB.uid);const ps=playerStats();if(!me||!mySignup(sid))return;
      if(ps.get(DB.uid).inMatch){toast("คุณอยู่ในแมตช์หรือคิว — แจ้งผู้จัดให้เปลี่ยนตัวก่อน");return;}
      if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันกลับบ้าน";return;}
      const su={...(me.signups||{})};su[sid]={...su[sid],checkedOutAt:now()};await write(`self/${DB.uid}`,{...stripId(me),signups:su},"เช็คเอาท์แล้ว — ระบบจะไม่จัดคุณลงคิวอีก");return;}
    case "toggleList":if(openList.has(id))openList.delete(id);else openList.add(id);return render();
    case "useSess":selectSession(id);ptab="queue";return render();
    case "useSessPay":selectSession(id);ptab="pay";try{localStorage.setItem(uiKey("bgo-ptab"),ptab);}catch(_){}window.scrollTo(0,0);return render();
    case "newRequest":return dlgRequest();
    case "reqCancel":{const me=selfDoc(DB.uid);const rq={...(me.requests||{})};if(rq[id])rq[id]={...rq[id],cancelled:true};await write(`self/${DB.uid}`,{...stripId(me),requests:rq},"ยกเลิกคำขอแล้ว");return;}
    case "qrSaveMine":{const amt=+b.dataset.amt||0,pq=S.payqr;if(!pq)return;try{
      const blob=pq.pp&&(amt>0||!pq.img)?await QRS.cardBlob({text:QRS.ppPayload(pq.pp,amt),title:"สแกนจ่ายค่าเล่น",lines:[pq.ppName?`บัญชี ${pq.ppName}`:"",amt>0?`ยอด ${baht(amt)} บาท`:""].filter(Boolean)}):QRS.dataToBlob(pq.img);
      const r=await QRS.share(blob,"qr-pay.png","");if(r==="saved")toast("บันทึกรูปแล้ว");}catch(e){toast("สร้างรูป QR ไม่ได้");}return;}
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
  try{const t=localStorage.getItem(uiKey("bgo-ptab"));if(t&&PTABS.some(x=>x.k===t))ptab=t;}catch(e){}
  $("#pConn").textContent=SIM?"โหมดจำลอง · เชื่อมกับผู้จัด":DB.mode==="gh"?GHUI.connText("player"):DB.mode==="db"?"เชื่อมกับแอปผู้จัดแบบเรียลไทม์":"โหมดเครื่องเดียว";
  APP.render=pRender;
}
