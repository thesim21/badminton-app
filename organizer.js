/* Badminton Group Organizer — แอปผู้จัดก๊วน (organizer app).
   Uses core.js for data and matching; everything a player does in player.js shows up here live. */
"use strict";
/* ================= rendering ================= */
const TABS=[
  {k:"courts",t:"สนาม & คิว"},
  {k:"players",t:"ประกาศ & ผู้เล่น"},
  {k:"members",t:"สมาชิกก๊วน",org:true},
  {k:"requests",t:"คำขอคู่/คู่แข่ง"},
  {k:"money",t:"ค่าใช้จ่าย"},
  {k:"board",t:"บอร์ด"},
  {k:"stock",t:"ลูกแบด & อุปกรณ์",org:true},
  {k:"stats",t:"สถิติ & ประวัติ"},
  {k:"settings",t:"ตั้งค่า",org:true}
];
let dlToastFor=null,endToastFor=null;
function doRender(){
  {const s=curSession();if(s&&DB.isOrg){const r=rosterModel();if(r.deadline&&now()>r.deadline&&dlToastFor!==s.id){dlToastFor=s.id;const ns=r.filter(p=>p.status==="noshow").length;
    if(ns&&now()-r.deadline<10*MIN)setTimeout(()=>toast(`เลยเวลาเช็คอินแล้ว — ไม่มาตามนัด ${ns} คน${r.filter(p=>p.promoted).length?` · เลื่อนตัวสำรองขึ้นแทน ${r.filter(p=>p.promoted).length} คน`:""}`),200);}}}
  {const s=curSession();if(s&&DB.isOrg&&s.status!=="closed"){const e=sessEndEpoch(s);if(e&&now()>=e&&endToastFor!==s.id&&now()-e<60*MIN){endToastFor=s.id;setTimeout(()=>toast(`ครบเวลาจอง ${s.end} น. แล้ว — เล่นเสร็จแล้วกด "ปิดรอบเล่น"`),300);}}}
  const c=cfg();
  $("#gName").textContent=c.group||"Badminton Group Organizer";
  $("#connNote").textContent=SIM?"โหมดจำลอง · เชื่อมกับมือถือผู้เล่นทุกเครื่อง":DB.mode==="gh"?GHUI.connText("org"):DB.mode==="db"?"แอปผู้จัดก๊วน · เชื่อมกับแอปผู้เล่นแบบเรียลไทม์":(window.claude?"โหมดเครื่องเดียว (ยังไม่ได้เข้าสู่ระบบ) — ข้อมูลเก็บในเบราว์เซอร์นี้":"โหมดเครื่องเดียว — ข้อมูลเก็บในเบราว์เซอร์นี้");
  // session selector
  const sel=$("#sessSel");const ss=S.sessions.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")||((b.createdAt||0)-(a.createdAt||0)));
  const opts=ss.map(s=>`<option value="${esc(s.id)}">${esc(fmtD(s.date))} · ${esc(s.title||"รอบเล่น")}${s.status==="closed"?" (ปิดแล้ว)":""}</option>`).join("")||'<option value="">ยังไม่มีรอบเล่น</option>';
  if(sel.dataset.h!==opts){sel.innerHTML=opts;sel.dataset.h=opts;}
  if(S.sid)sel.value=S.sid;
  // tabs
  const reqPending=requestModel().filter(r=>r.status==="pending").length;
  const payPending=DB.isOrg?payModel().rows.filter(r=>r.state==="pending").length:0;
  const joinPending=DB.isOrg?joinReqModel().filter(r=>r.status==="pending").length:0;
  const tabsHtml=TABS.filter(x=>(!x.org||DB.isOrg)&&(!x.player||!DB.isOrg||true)).map(x=>{
    const b=x.k==="requests"&&DB.isOrg&&reqPending?`<span class="badge">${reqPending}</span>`:x.k==="money"&&payPending?`<span class="badge">${payPending}</span>`:x.k==="players"&&joinPending?`<span class="badge">${joinPending}</span>`:"";
    return `<button role="tab" data-tab="${x.k}" aria-selected="${tab===x.k}">${esc(x.t)}${b}</button>`;}).join("");
  const tabsEl=$("#tabs");if(tabsEl.dataset.h!==tabsHtml){tabsEl.innerHTML=tabsHtml;tabsEl.dataset.h=tabsHtml;}
  const v=$("#view");
  const fn={members:vMembers,courts:vCourts,players:vPlayers,requests:vRequests,money:vMoney,board:vBoard,stock:vStock,stats:vStats,settings:vSettings}[tab]||vCourts;
  paint(v,(DB.mode==="gh"?GHUI.tokenBar():"")+roundBanner()+fn(),tab);
  tick();
}
/* bar above every tab: the booked time is almost over / over → one tap to close the round */
function roundBanner(){
  const s=curSession();if(!s||!DB.isOrg)return "";
  if(s.status==="closed")return `<div class="endbar closed" role="status"><div><b>ปิดรอบแล้ว${s.closedAt?` ${hm(s.closedAt)} น.`:""}</b><span class="small"> · ราคาของรอบนี้ถูกล็อก</span></div><button data-act="reopenSession">เปิดรอบอีกครั้ง</button></div>`;
  const end=sessEndEpoch(s);if(!end)return "";
  const left=end-now(),playing=S.matches.filter(m=>m.status==="playing").length;
  if(left>15*MIN)return "";
  if(left>0)return `<div class="endbar soon" role="status"><div><b>ใกล้ครบเวลาจอง ${esc(s.end)} น.</b><span class="small"> · อีก ${Math.ceil(left/MIN)} นาที</span></div><button data-act="closeSession">ปิดรอบเล่น…</button></div>`;
  return `<div class="endbar over" role="status"><div><b>ครบเวลาจอง ${esc(s.end)} น. แล้ว</b><span class="small">${playing?` · ยังมีเกมเล่นอยู่ ${playing} คอร์ด`:" · ปิดรอบเพื่อสรุปยอดและเก็บเงิน"}</span></div><button class="primary" data-act="closeSession">ปิดรอบเล่น</button></div>`;
}
function noSession(){
  return `<section class="panel"><div class="empty"><h2>ยังไม่มีรอบเล่น</h2><p>${DB.isOrg?"สร้างรอบเล่นแรก (ประกาศรับสมัคร) เพื่อเริ่มลงชื่อผู้เล่น จัดคิว และจับคู่":"รอผู้จัดก๊วนสร้างรอบเล่นและประกาศรับสมัคร"}</p>${DB.isOrg?'<button class="primary" data-act="newSession">+ สร้างรอบเล่น / ประกาศ</button>':""}</div></section>`;
}
/* ---------- members (organizer's master player list) ---------- */
let memFilter="all";
const memSel=new Set();     // members ticked on this page, waiting to be added to the open round
const SK_ORDER=k=>-SKILL[sk(k)].w;
/* how many people the open round takes: round 1 + round 2 (null when there is no limit to compare with) */
function sessQuota(s){
  const max=+s.maxPlayers>0?Math.floor(+s.maxPlayers):0,R=roundsOf(s);
  if(!max)return null;
  if(R){if(R.max>=999)return null;return {total:max+R.max,r1:max,r2:R.max,R};}
  return {total:max,r1:max,r2:0,R:null};
}
const quotaText=q=>q.R?`รอบแรก ${q.r1} + รอบสอง ${q.r2}`:`รับ ${q.r1} คน`;
/* everybody who holds or waits for a place in the round (confirmed + reserve); removed and no-show players do not count */
const sessHeadcount=()=>rosterModel().filter(p=>p.status==="confirmed"||p.status==="reserve").length;
/* "26/25" — the figure goes red when it is more than the quota */
const quotaFig=(n,q)=>`<span class="quotafig${q&&n>q.total?" over":""}"><b class="num">${n}</b>${q?`<span class="of">/${q.total}</span>`:""}</span>`;
/* a small pop-up that asks a yes/no question. It sits above any dialog that is already open, so asking from inside a form does not close the form. */
function askConfirm({title,body,ok="ตกลง",cancel="ยกเลิก",danger=false}){
  return new Promise(res=>{
    const ov=document.createElement("div");ov.className="ov cfm";
    ov.innerHTML=`<div class="dlg cfm-d" role="alertdialog" aria-modal="true" aria-labelledby="cfmT" aria-describedby="cfmB"><h2 id="cfmT">${esc(title)}</h2><div id="cfmB" class="cfm-b">${body}</div><div class="dlg-a"><button type="button" class="ghost" data-no>${esc(cancel)}</button><button type="button" class="${danger?"danger":"primary"}" data-yes>${esc(ok)}</button></div></div>`;
    const prev=document.activeElement;
    const done=v=>{document.removeEventListener("keydown",key,true);ov.remove();try{prev&&prev.focus&&prev.focus({preventScroll:true});}catch(e){}res(v);};
    const key=e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();done(false);}
      else if(e.key==="Tab"){const bs=[...ov.querySelectorAll("button")],i=bs.indexOf(document.activeElement);e.preventDefault();bs[(i+(e.shiftKey?-1:1)+bs.length)%bs.length].focus();}};
    document.addEventListener("keydown",key,true);
    ov.addEventListener("click",e=>{if(e.target===ov||e.target.closest("[data-no]"))done(false);else if(e.target.closest("[data-yes]"))done(true);});
    document.body.appendChild(ov);ov.querySelector("[data-no]").focus();
  });
}
/* adding people would go over the places of this round: say so and let the organizer decide */
async function confirmOverQuota(s,add){
  const q=sessQuota(s);if(!q||add<=0)return true;
  const have=sessHeadcount(),after=have+add;if(after<=q.total)return true;
  return askConfirm({title:"เกินโควต้า",ok:"เพิ่มต่อ",cancel:"ยกเลิก",
    body:`<p>รอบ "${esc(s.title||"")}" รับได้ <b>${q.total} คน</b> (${quotaText(q)}) · ตอนนี้มี ${have} คน</p><p>เพิ่มอีก ${add} คนจะเป็น <b class="over-t">${after} คน เกินโควต้า ${after-q.total} คน</b></p><p>ต้องการเพิ่มสมาชิกต่อหรือไม่?</p><p class="small muted">คนที่เกินโควต้าจะอยู่ในรายชื่อสำรองจนกว่าจะมีที่ว่าง (ถ้าเลือก “เช็คอินทันที” จะนับเป็นตัวจริงเลย)</p>`});
}
function vMembers(){
  const s=curSession(),open=!!s&&s.status!=="closed";const roster=s?rosterModel():[];
  const inSess=id=>{const p=roster.find(x=>x.id===id);return p&&p.status!=="removed"?p:null;};
  const all=S.members.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"","th"));
  const tierOf=m=>SKILL[sk(m.skill)].tier;
  const list=memFilter==="all"?all:all.filter(m=>tierOf(m)===memFilter);
  const cnt=k=>all.filter(m=>tierOf(m)===k).length;
  for(const id of [...memSel])if(!open||!S.members.some(m=>m.id===id)||inSess(id))memSel.delete(id);   // someone already added (or deleted) is no longer "waiting"
  const q=open?sessQuota(s):null,have=open?sessHeadcount():0,pend=memSel.size,after=have+pend,over=!!q&&after>q.total;
  const pickable=list.filter(m=>!inSess(m.id)),allTicked=pickable.length>0&&pickable.every(m=>memSel.has(m.id));
  return `<section class="kpis">
    <div class="kpi"><span class="k">สมาชิกทั้งหมด</span><span class="v">${all.length}</span><span class="s">คน</span></div>
    ${Object.entries(SKILL_TIERS).map(([k,v])=>`<div class="kpi"><span class="k">${v.t} (${v.r})</span><span class="v">${cnt(k)}</span><span class="s">คน</span></div>`).join("")}
  </section>
  <section class="panel"><div class="ph"><h2>สมาชิกก๊วน</h2>
    <div class="seg" role="group">${[["all","ทั้งหมด"],...Object.entries(SKILL_TIERS).map(([k,v])=>[k,`${v.t} ${v.r}`])].map(([k,t])=>`<button data-act="memFilter" data-k="${k}" aria-pressed="${memFilter===k}">${t}</button>`).join("")}</div>
    <span class="sp"></span><button class="primary" data-act="addMember">+ เพิ่มสมาชิก</button><button data-act="bulkMembers">เพิ่มหลายคน</button>
    ${s&&all.length?`<button data-act="addFromMembers">เพิ่มเข้ารอบ "${esc(s.title||"")}"</button>`:""}</div>
    ${open?`<div class="quota${over?" over":""}" id="quotaBox" role="status"><span class="k">เลือกเข้ารอบนี้</span>${quotaFig(have,q)}<span class="small">คน${q?` · ${quotaText(q)}`:""}${over?` · <b class="over-t">เกินโควต้า ${have-q.total} คน</b>`:""}</span></div>`:""}
    <p class="small muted" style="margin:0 0 10px">บันทึกรายชื่อและระดับฝีมือไว้ครั้งเดียว แล้วดึงเข้ารอบเล่นไหนก็ได้ · แก้ระดับฝีมือที่นี่ ระบบจับคู่จะใช้ค่าใหม่ทันที${open?" · ติ๊กเลือกหลายคนแล้วกด “เพิ่มเข้ารอบ” ได้":""}</p>
    ${list.length?`<div class="tw"><table class="memtbl${open?"":" nosel"}"><thead><tr>${open?`<th class="c-sel"><input type="checkbox" data-memall aria-label="เลือกทุกคนที่ยังไม่อยู่ในรอบ"${allTicked?" checked":""}${pickable.length?"":" disabled"}></th>`:""}<th>ชื่อ</th><th>ระดับฝีมือ</th><th>เบอร์โทร</th><th>หมายเหตุ</th>${s?"<th>รอบนี้</th>":""}<th></th></tr></thead><tbody>${list.map(m=>{const p=inSess(m.id);
      return `<tr${memSel.has(m.id)?' class="sel"':""}>${open?`<td class="c-sel">${p?"":`<input type="checkbox" data-memsel="${esc(m.id)}" aria-label="เลือก ${esc(m.name)} เข้ารอบนี้"${memSel.has(m.id)?" checked":""}>`}</td>`:""}<td class="c-name"><b>${esc(m.name)}</b></td><td class="c-lv">${skillChip(m.skill)} <span class="small">${esc(SKILL[sk(m.skill)].t)}</span></td><td class="c-phone num small${m.phone?"":" none"}">${esc(m.phone||"–")}</td><td class="c-note small${m.note?"":" none"}">${esc(m.note||"")}</td>
      ${s?`<td class="c-sess">${p?`<span class="chip ${p.checkedIn?"s-ready":"s-queued"}">${p.checkedIn?"เช็คอินแล้ว":p.status==="reserve"?"สำรอง":"อยู่ในรอบ"}</span>`:`<button class="sm" data-act="memToSession" data-id="${esc(m.id)}">+ เข้ารอบนี้</button>`}</td>`:""}
      <td class="c-act"><div class="acts"><button class="ghost sm" data-act="editMember" data-id="${esc(m.id)}">แก้ไข</button><button class="ghost sm" data-act="delMember" data-id="${esc(m.id)}">ลบ</button></div></td></tr>`;}).join("")}</tbody></table></div>`
      :`<div class="empty">${all.length?"ไม่มีสมาชิกในระดับนี้":"ยังไม่มีสมาชิก — กด \"+ เพิ่มสมาชิก\" หรือ \"เพิ่มหลายคน\" เพื่อวางรายชื่อจาก LINE / Excel"}</div>`}
    ${open&&pend?`<div class="selbar${over?" over":""}" role="status"><span class="msg">เลือกไว้ <b>${pend}</b> คน · รอบนี้จะมี ${quotaFig(after,q)} คน${over?` · <b class="over-t">เกินโควต้า ${after-q.total} คน</b>`:""}</span><span class="sp"></span><button class="ghost sm" data-act="memClear">ล้าง</button><button class="primary" data-act="memAddSel">เพิ่มเข้ารอบ ${pend} คน</button></div>`:""}
  </section>`;
}
/* ticking boxes on the members page: keep the choice, repaint at once and keep the keyboard where it was */
document.addEventListener("change",e=>{
  if(APP.name!=="org")return;const el=e.target;if(!el||!el.dataset)return;
  if(el.dataset.memsel!==undefined){if(el.checked)memSel.add(el.dataset.memsel);else memSel.delete(el.dataset.memsel);memRepaint(`[data-memsel="${el.dataset.memsel.replace(/"/g,'\\"')}"]`);}
  else if(el.dataset.memall!==undefined){const s=curSession(),ro=s?rosterModel():[],ids=(memFilter==="all"?S.members:S.members.filter(m=>SKILL[sk(m.skill)].tier===memFilter)).filter(m=>!ro.some(p=>p.id===m.id&&p.status!=="removed")).map(m=>m.id);
    ids.forEach(id=>el.checked?memSel.add(id):memSel.delete(id));memRepaint("[data-memall]");}
});
function memRepaint(focusSel){if(APP.render)APP.render();const f=focusSel&&document.querySelector(focusSel);if(f)try{f.focus({preventScroll:true});}catch(e){}}
/* reads a level from pasted text: codes (BG N S P- P P+ C B A), 1–9, Thai names, or the old มือใหม่/กลาง/เก่ง words */
function parseSkill(t){t=String(t||"").trim();if(!t)return null;const u=t.toUpperCase().replace(/\s+/g,"").replace("มือ","");
  const byCode=SKILL_KEYS.find(k=>SKILL[k].c===u);if(byCode)return byCode;
  if(/^[1-9]$/.test(u))return "L"+u;
  const byName=SKILL_KEYS.find(k=>SKILL[k].t===t||SKILL[k].t.replace("มือ","")===t.replace("มือ",""));if(byName)return byName;
  if(/^(ใหม่|เริ่มต้น|beginner|newbie)$/i.test(t.replace("มือ","")))return "L2";
  if(/^(กลาง|ปานกลาง|intermediate|mid)$/i.test(t.replace("มือ","")))return "L4";
  if(/^(เก่ง|โปร|advanced|pro)$/i.test(t.replace("มือ","")))return "L6";
  return null;}
function dlgMember(m){
  const isNew=!m;m=m||{name:"",skill:"L2",phone:"",note:""};
  openDlg(`<form novalidate><h2>${isNew?"เพิ่มสมาชิกก๊วน":"แก้ไขสมาชิก"}</h2><div class="fg">
    <label class="f full">ชื่อ / ชื่อเล่น<input name="name" maxlength="30" value="${esc(m.name)}" autocomplete="off"><span class="ferr"></span></label>
    ${skillPicker("skill",m.skill)}
    <label class="f">เบอร์โทร (ไม่บังคับ)<input name="phone" inputmode="tel" maxlength="12" value="${esc(m.phone||"")}" autocomplete="off"><span class="ferr"></span></label>
    <label class="f">หมายเหตุ<input name="note" maxlength="60" value="${esc(m.note||"")}" placeholder="เช่น ถนัดซ้าย, มาวันอังคาร"></label>
    ${isNew&&curSession()?`<label class="f full">เพิ่มเข้ารอบ "${esc(curSession().title||"")}" ด้วย<select name="toSess"><option value="">ไม่</option><option value="1">ใช่</option><option value="ci">ใช่ และเช็คอินเลย</option></select></label>`:""}
  </div><div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button>${isNew?'<button type="submit" class="ghost" data-more="1">บันทึกแล้วเพิ่มคนต่อไป</button>':""}<button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const name=fv(f,"name").replace(/\s+/g," ");
    if(name.length<2)return fieldErr(f,"name","ชื่ออย่างน้อย 2 ตัวอักษร");
    if(S.members.some(x=>x.id!==m.id&&(x.name||"").toLowerCase()===name.toLowerCase()))return fieldErr(f,"name","มีสมาชิกชื่อนี้แล้ว");
    const phone=fv(f,"phone").replace(/[\s-]/g,"");if(phone&&!/^0\d{8,9}$/.test(phone))return fieldErr(f,"phone","เบอร์ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก");
    const skill=sk((f.querySelector("[name=skill]:checked")||{}).value);
    const id=isNew?uid("mb"):m.id;
    const ok=await write(`members/${id}`,{name,skill,phone,note:fv(f,"note"),createdAt:m.createdAt||now()},isNew?`เพิ่ม ${name} แล้ว`:"บันทึกแล้ว");
    if(!ok)return false;
    if(!isNew&&m.skill!==skill)logEv("เปลี่ยนระดับฝีมือ",`${name}: ${skLabel(m.skill)} → ${skLabel(skill)}`);
    const s=curSession();const ex=s&&S.roster.find(r=>r.id===id);if(ex&&(ex.name!==name||ex.skill!==skill))await write(`sessions/${s.id}/roster/${id}`,{...stripId(ex),name,skill});   // players see the roster copy
    const ts=isNew?fv(f,"toSess"):"";if(ts)await addMembersToSession([id],ts==="ci",[{id,name,skill}]);
    if(f.dataset.more){setTimeout(()=>dlgMember(),50);}
    return true;
  });
  const more=$("#dlg [data-more]");if(more){const fm=more.closest("form");more.addEventListener("click",()=>{fm.dataset.more="1";});fm.querySelector("button.primary[type=submit]").addEventListener("click",()=>{delete fm.dataset.more;});}
}
function dlgBulk(){
  openDlg(`<form novalidate><h2>เพิ่มสมาชิกหลายคน</h2>
    <p class="small muted" style="margin:0">วางรายชื่อ บรรทัดละ 1 คน ใส่ระดับหลังชื่อโดยคั่นด้วยจุลภาคหรือแท็บ ใช้รหัสระดับ BG N S P- P P+ C B A เช่น <b>ต้น, P+</b> · <b>ฝน, S</b> · <b>บี</b> (ไม่ใส่ระดับ = N) · ใช้ A/I/B หรือ 3/2/1 ก็ได้</p>
    <label class="f">รายชื่อ<textarea name="list" rows="9" placeholder="ต้น, P+&#10;ฝน, S&#10;บี"></textarea><span class="ferr"></span></label>
    <p class="small" id="bulkPrev" style="margin:0"></p>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">เพิ่มสมาชิก</button></div></form>`,async f=>{
    const r=parseBulk(fv(f,"list"));
    if(!r.ok.length)return fieldErr(f,"list",r.bad.length?`อ่านไม่ได้: ${r.bad.slice(0,3).join(" · ")}`:"ยังไม่มีรายชื่อ");
    if(r.bad.length&&!f.dataset.force){f.dataset.force="1";return fieldErr(f,"list",`ข้าม ${r.bad.length} บรรทัด: ${r.bad.slice(0,4).join(" · ")} — กดเพิ่มอีกครั้งเพื่อเพิ่มเฉพาะ ${r.ok.length} คนที่ถูกต้อง`);}
    for(const x of r.ok)await write(`members/${uid("mb")}`,{name:x.name,skill:x.skill,phone:"",note:"",createdAt:now()});
    toast(`เพิ่มสมาชิก ${r.ok.length} คนแล้ว`);logEv("เพิ่มสมาชิกหลายคน",`${r.ok.length} คน`);return true;
  });
  const ta=$("#dlg [name=list]");ta.addEventListener("input",()=>{const r=parseBulk(ta.value);
    $("#bulkPrev").innerHTML=ta.value.trim()?`พร้อมเพิ่ม <b>${r.ok.length}</b> คน (${Object.entries(SKILL_TIERS).map(([k,v])=>`${v.t} ${r.ok.filter(x=>SKILL[x.skill].tier===k).length}`).join(" · ")})${r.bad.length?` · <span style="color:var(--bad)">ข้าม ${r.bad.length}: ${esc(r.bad.slice(0,3).join(" · "))}</span>`:""}`:"";});
}
function parseBulk(text){
  const ok=[],bad=[],seen=new Set(S.members.map(m=>(m.name||"").toLowerCase()));
  text.split(/\r?\n/).forEach(line=>{
    line=line.replace(/^\s*\d+[.)]\s*/,"").trim();if(!line)return;
    let parts=line.split(/\t|,|，/).map(x=>x.trim()).filter(Boolean);
    if(parts.length===1){const m=line.match(/^(.+?)\s+(\S+)$/);if(m&&parseSkill(m[2]))parts=[m[1],m[2]];}
    const name=(parts[0]||"").replace(/\s+/g," ");let skill="L2";
    if(parts[1]){const k=parseSkill(parts[1]);if(!k){bad.push(`"${line}" (ระดับไม่รู้จัก)`);return;}skill=k;}
    if(name.length<2||name.length>30){bad.push(`"${line}" (ชื่อสั้น/ยาวเกินไป)`);return;}
    if(seen.has(name.toLowerCase())){bad.push(`"${name}" (ชื่อซ้ำ)`);return;}
    seen.add(name.toLowerCase());ok.push({name,skill});
  });
  return {ok,bad};
}
async function addMembersToSession(ids,checkin,fallback){
  const s=curSession();if(!s)return false;
  const dupSkipped=[],todo=[],ro=rosterModel();
  for(const id of ids){
    const m=S.members.find(x=>x.id===id)||(fallback||[]).find(x=>x.id===id);if(!m)continue;
    const ex=S.roster.find(r=>r.id===id);
    if(!ex&&ro.some(p=>p.status!=="removed"&&p.id!==id&&(p.name||"").trim().toLowerCase()===(m.name||"").trim().toLowerCase())){dupSkipped.push(m.name);continue;}
    todo.push({id,m,ex});
  }
  /* more people than the round takes: ask before adding (the organizer may still go ahead) */
  const fresh=todo.filter(x=>!ro.some(p=>p.id===x.id&&(p.status==="confirmed"||p.status==="reserve"))).length;
  if(s.status!=="closed"&&!await confirmOverQuota(s,fresh)){toast("ยกเลิกการเพิ่มเข้ารอบ");return false;}
  let n=0;
  /* with a second round, the people beyond round 1's places go to round 2 while it still has room (otherwise they would just wait as reserve) */
  const R=roundsOf(s),r1=+s.maxPlayers>0?+s.maxPlayers:999;
  let c1=ro.filter(p=>(p.status==="confirmed"&&p.round===1)||(p.status==="reserve"&&p.want!==2)).length,c2=ro.filter(p=>(p.status==="confirmed"&&p.round===2)||(p.status==="reserve"&&p.want===2)).length;
  for(const {id,m,ex} of todo){
    const data={...(ex?stripId(ex):{}),name:m.name,skill:m.skill,walkin:true,memberId:id,addedAt:(ex&&ex.addedAt)||now()+n};
    if(ex&&ex.status==="removed")data.status=null;
    if(!(ex&&(ex.round===1||ex.round===2))){
      if(R&&c1>=r1&&c2<R.max){data.round=2;c2++;}else c1++;}
    if(checkin){data.checkedInAt=now();data.checkedOutAt=null;}
    if(await write(`sessions/${s.id}/roster/${id}`,data))n++;
  }
  toast(`เพิ่มเข้ารอบแล้ว ${n} คน${checkin?" (เช็คอินแล้ว)":""}${dupSkipped.length?` · ข้ามชื่อซ้ำ: ${dupSkipped.join(", ")}`:""}`);logEv("เพิ่มสมาชิกเข้ารอบ",`${n} คน`);
  return true;
}
function dlgAddFromMembers(){
  const s=curSession();if(!s){toast("สร้างรอบเล่นก่อน");return;}
  const roster=rosterModel();
  const nn=x=>(x||"").trim().replace(/\s+/g," ").toLowerCase();
  const live=roster.filter(p=>p.status!=="removed"),sameName=m=>live.some(p=>p.id!==m.id&&nn(p.name)===nn(m.name));
  const dups=S.members.filter(m=>!live.some(p=>p.id===m.id)&&sameName(m));
  const avail=S.members.filter(m=>!live.some(p=>p.id===m.id)&&!sameName(m)).sort((a,b)=>SK_ORDER(a.skill)-SK_ORDER(b.skill)||(a.name||"").localeCompare(b.name||"","th"));
  if(!S.members.length){dlgMember();toast("ยังไม่มีสมาชิก — เพิ่มสมาชิกก่อน");return;}
  openDlg(`<form novalidate><h2>เพิ่มสมาชิกเข้ารอบ "${esc(s.title||"")}"</h2>
    ${avail.length?`<div class="ph" style="margin:0"><span class="small muted">เลือกแล้ว <b id="selCnt">0</b> จาก ${avail.length} คน${(()=>{const q=s.status!=="closed"?sessQuota(s):null;return q?` · รอบนี้จะมี <span id="selTot">${quotaFig(sessHeadcount(),q)}</span> คน`:"";})()}</span><span class="sp"></span><button type="button" class="ghost sm" data-pickall="1">เลือกทั้งหมด</button><button type="button" class="ghost sm" data-pickall="">ล้าง</button></div>
    <div class="pick">${avail.map(m=>`<label><input type="checkbox" name="m" value="${esc(m.id)}">${skillChip(m.skill)}<span>${esc(m.name)}</span></label>`).join("")}</div>
    <label class="f">สถานะ<select name="ci"><option value="1">เช็คอินทันที (อยู่ที่สนามแล้ว)</option><option value="">ลงชื่อไว้ก่อน ยังไม่เช็คอิน</option></select></label><span class="ferr" id="pickErr"></span>`
    :`<div class="empty">สมาชิกทุกคนอยู่ในรอบนี้แล้ว</div>`}
    ${dups.length?`<div class="notice warn small" style="margin-top:8px"><b>ข้าม ${dups.length} คนที่ชื่อซ้ำกับคนที่ลงชื่อในรอบนี้แล้ว:</b> ${dups.map(m=>esc(m.name)).join(", ")}<br>ป้องกันไม่ให้คนเดียวกันถูกนับและเก็บเงินสองครั้ง — ถ้าเป็นคนละคน ให้ตั้งชื่อสมาชิกให้ต่างกันก่อน</div>`:""}
    <div class="dlg-a"><button type="button" class="ghost" data-close>ปิด</button><button type="button" data-act="addMember">+ สมาชิกใหม่</button>${avail.length?'<button type="submit" class="primary">เพิ่มเข้ารอบ</button>':""}</div></form>`,async f=>{
    const ids=[...f.querySelectorAll("[name=m]:checked")].map(x=>x.value);
    if(!ids.length){$("#pickErr").textContent="เลือกอย่างน้อย 1 คน";return false;}
    return (await addMembersToSession(ids,!!fv(f,"ci")))!==false;
  });
  const f=$("#dlg form");const upd=()=>{const n=f.querySelectorAll("[name=m]:checked").length,c=$("#selCnt");if(c)c.textContent=n;
    const t=$("#selTot"),q=sessQuota(s);if(t&&q&&s.status!=="closed")t.innerHTML=quotaFig(sessHeadcount()+n,q);};
  f.addEventListener("change",upd);
  f.querySelectorAll("[data-pickall]").forEach(b=>b.addEventListener("click",()=>{f.querySelectorAll("[name=m]").forEach(x=>x.checked=!!b.dataset.pickall);upd();}));
}

/* ---------- courts & queue ---------- */
/* live shuttle counters on a running court: a new shuttle is billed to the four players of this court, a repaired one is free */
function shuttleBox(m){
  const c=priceCfg(curSession()),x=matchShuttles(m),per=(c.shuttleSplit==="shared"?(+c.shuttleFee||0)/4:(+c.shuttleFee||0))*x.sh;
  const stp=(k,label,n,sub)=>`<div class="shg"><span class="k">${label}</span><div class="stp"><button type="button" class="sm" data-act="shAdj" data-id="${esc(m.id)}" data-k="${k}" data-d="-1" aria-label="ลด${label}"${n<=0?" disabled":""}>−</button><b class="num">${n}</b><button type="button" class="sm primary" data-act="shAdj" data-id="${esc(m.id)}" data-k="${k}" data-d="1" aria-label="เพิ่ม${label}"${m.free&&k==="new"?" disabled":""}>+</button></div><span class="small muted">${sub}</span></div>`;
  return `<div class="shuts">${stp("new","ลูกใหม่",x.sh,m.free?"เกมฟรี ไม่คิดเงิน":x.sh?`คิดเงิน 4 คน คนละ ${baht(per)} ฿`:"ไม่คิดเงิน")}${stp("repair","ลูกซ่อม",x.rp,"ฟรี ไม่คิดเงิน")}</div>`;
}
function dlgFree(m){
  const N=setsOf(curSession());
  openDlg(`<form novalidate><h2>เกมฟรี (ลูกซ่อม) · คอร์ด ${esc(m.court)}</h2>
    <p class="small" style="margin:0 0 8px">ใช้เมื่อเวลาเหลือน้อย ผู้จัดใจดีให้ผู้เล่นได้เล่นต่อ — เกมนี้ใช้<b>ลูกซ่อม</b> ไม่คิดค่าลูกใหม่ของ 4 คนนี้ · ถ้าใครมาเล่นเฉพาะเกมฟรี ไม่ต้องจ่ายค่าสนาม</p>
    <div class="fg"><label class="f">จำนวนเซตของเกมนี้<select name="n"><option value="">ตามปกติ (${N} เซต)</option>${[1,2,3].map(i=>`<option value="${i}">${i} เซต</option>`).join("")}</select></label></div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">ตั้งเป็นเกมฟรี</button></div></form>`,async f=>{
    const live=S.matches.find(x=>x.id===m.id);if(!live||(live.status!=="queued"&&live.status!=="playing")){toast("เกมนี้จบหรือถูกยกเลิกไปแล้ว");return true;}
    const n=+fv(f,"n")||0,s=curSession();
    const data={...stripId(live),free:true,shuttles:0,repair:Math.max(1,+live.repair||0)};if(n)data.setsN=n;else delete data.setsN;
    const ok=await write(`sessions/${s.id}/matches/${m.id}`,data,"ตั้งเป็นเกมฟรี (ลูกซ่อม) แล้ว");
    if(ok)logEv("เกมฟรี (ลูกซ่อม)",`คอร์ด ${m.court}: ${[...m.a,...m.b].map(nameOf).join(", ")}${n?` · ${n} เซต`:""}`);return ok;});
}
function vCourts(){
  const s=curSession();if(!s)return noSession();
  const c=cfg(),roster=rosterModel(),ps=playerStats(),tl=timeline(roster,ps),t=now();
  const present=roster.filter(p=>p.status==="confirmed"&&p.checkedIn&&!p.notYet);
  const playing=S.matches.filter(m=>m.status==="playing");
  const queued=S.matches.filter(m=>m.status==="queued").sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const ready=tl.waiting.filter(p=>!(ps.get(p.id).restUntil>t));
  const resting=tl.waiting.filter(p=>ps.get(p.id).restUntil>t);
  let h=`<section class="kpis">
    <div class="kpi"><span class="k">เช็คอินแล้ว</span><span class="v">${present.length}</span><span class="s">จากผู้ลงชื่อ ${roster.filter(p=>p.status==="confirmed").length} คน</span></div>
    <div class="kpi"><span class="k">กำลังเล่น</span><span class="v">${playing.length}/${(s.courts||[]).length}</span><span class="s">คอร์ด</span></div>
    <div class="kpi"><span class="k">พร้อมลงเล่น</span><span class="v">${ready.length}</span><span class="s">พักอยู่ ${resting.length} คน (กฎพัก ${c.restMin} นาที)</span></div>
    <div class="kpi ${requestModel().filter(r=>r.status==="pending").length&&DB.isOrg?"alert":""}"><span class="k">คำขอรอพิจารณา</span><span class="v">${requestModel().filter(r=>r.status==="pending").length}</span><span class="s">คู่/คู่แข่ง</span></div>
  </section>`;
  if(s.status==="closed")h+=`<div class="notice warn">รอบเล่นนี้ปิดแล้ว — ดูผลได้อย่างเดียว</div>`;
  h+=`<section class="panel"><div class="ph"><h2>คอร์ด</h2><span class="muted small">${esc(fmtD(s.date))} ${esc(s.start||"")}–${esc(s.end||"")} · เกมละ ~${c.avgMin} นาที</span><span class="sp"></span>
    ${DB.isOrg&&s.status!=="closed"?`<button class="primary" data-act="autoMatch">จัดคู่อัตโนมัติ</button><button data-act="manualMatch">จัดคู่เอง</button><button class="ghost" data-act="closeSession">ปิดรอบ</button>`:""}</div>
    <div class="courts">${(s.courts||[]).map(cn=>{
      const m=playing.find(x=>x.court===cn);
      const nextQ=queued.filter(x=>x.court===cn);
      if(!m)return `<article class="court free"><div class="court-h"><b>คอร์ด ${esc(cn)}</b><span class="sp"></span><span class="chip s-ready">ว่าง</span></div>
        <div class="court-b">${nextQ.length?(()=>{const q=nextQ[0];const ru=Math.max(0,...[...q.a,...q.b].map(id=>ps.get(id).restUntil||0));
          return `<div style="text-align:center;display:grid;gap:4px"><div class="small">คู่ถัดไปรออยู่</div>${matchMini(q,ps,roster,t)}${ru>t?`<div class="small">ผู้เล่นพักครบเวลา ${hm(ru)} <span class="chip s-rest" data-until="${ru}">พัก ${mmss(ru-t)}</span></div>`:`<div class="small" style="color:var(--ready)">ทุกคนพักครบแล้ว เริ่มได้เลย</div>`}</div>`;})():"<span>ยังไม่มีคู่ลงคอร์ดนี้</span>"}</div>
        <div class="court-f">${DB.isOrg&&nextQ.length?(()=>{const q=nextQ[0];const rb=[...q.a,...q.b].some(id=>(ps.get(id).restUntil||0)>t);return `<button class="${rb?"":"primary "}sm" data-act="startMatch" data-id="${q.id}">${rb?"เริ่ม (ยังพักไม่ครบ)":"เริ่มเกม"}</button>`;})():""}</div></article>`;
      return `<article class="court"><div class="court-h"><b>คอร์ด ${esc(cn)}</b><span class="sp"></span>${m.free?'<span class="chip s-ready">เกมฟรี</span>':""}<span class="chip s-play">กำลังเล่น</span><span class="timer" data-since="${m.startAt}">${mmss(t-m.startAt)}</span></div>
        <div class="court-b"><div class="vs"><div class="team a">${m.a.map(id=>pChip(id,ps,roster,t)).join("")}</div><span class="x">VS</span><div class="team b">${m.b.map(id=>pChip(id,ps,roster,t)).join("")}</div></div>
        ${DB.isOrg?shuttleBox(m):""}
        ${nextQ.length?`<div class="small muted">ถัดไป: ${nextQ.map(q=>[...q.a,...q.b].map(nameOf).map(esc).join(", ")).join(" · ")}</div>`:""}</div>
        <div class="court-f">${DB.isOrg?`<button class="primary sm" data-act="endMatch" data-id="${m.id}">จบเกม / บันทึกผล</button><button class="sm" data-act="swap" data-id="${m.id}">เปลี่ยนตัว</button><button class="ghost sm" data-act="freeGame" data-id="${m.id}">${m.free?"เลิกเกมฟรี":"เกมฟรี"}</button><button class="ghost sm" data-act="cancelMatch" data-id="${m.id}">ยกเลิก</button>`:""}</div></article>`;
    }).join("")}${DB.isOrg&&s.status!=="closed"?`<button type="button" class="court-add" data-act="addCourt"><span class="plus">+</span>เพิ่มคอร์ด<small>ใช้ได้ทันที · ค่าเช่าคิดตั้งแต่เวลาที่เพิ่ม</small></button>`:""}</div></section>`;
  h+=`<div class="grid2"><section class="panel"><div class="ph"><h2>คู่ที่รอลงคอร์ด</h2><span class="muted small">${queued.length} คู่</span></div>
    ${queued.length?`<div class="qlist">${queued.map((m,i)=>{const eta=tl.matchEta[m.id];const restBlock=[...m.a,...m.b].some(id=>(ps.get(id).restUntil||0)>t);
      return `<div class="qcard"><span class="ord">${i+1}</span><div style="min-width:0">${matchMini(m,ps,roster,t)}<div class="small muted">คอร์ด ${esc(m.court)} · คาดว่าเริ่ม ${eta?hm(eta):"–"}${m.via==="manual"?" · จัดเอง":""}${m.reqIds&&m.reqIds.length?" · ตามคำขอ":""}</div>${(()=>{const end=sessEndEpoch(s),st=eta||t;return DB.isOrg&&!m.free&&end&&end-st<c.avgMin*MIN&&end-st>-30*MIN?`<div class="small" style="color:var(--warn)">เวลาเหลือไม่พอเล่นครบ ${setsOf(s)} เซต — ให้เล่นแบบ "เกมฟรี" (ลูกซ่อม) ได้</div>`:"";})()}</div>
      <div class="acts" style="display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end">${DB.isOrg?`<button class="${restBlock?"":"primary "}sm" data-act="startMatch" data-id="${m.id}" ${playing.some(x=>x.court===m.court)?"disabled title=\"คอร์ดยังไม่ว่าง\"":""}>${restBlock?"เริ่ม (ยังพักไม่ครบ)":"เริ่มเกม"}</button><button class="sm" data-act="swap" data-id="${m.id}">เปลี่ยนตัว</button><button class="ghost sm" data-act="freeGame" data-id="${m.id}">${m.free?"เลิกเกมฟรี":"เกมฟรี"}</button><button class="ghost sm" data-act="cancelMatch" data-id="${m.id}">ยกเลิก</button>`:""}</div></div>`;}).join("")}</div>`:`<div class="empty">ยังไม่มีคู่ในคิว${DB.isOrg?" — กด \"จัดคู่อัตโนมัติ\"":""}</div>`}
  </section>
  <section class="panel"><div class="ph"><h2>ผู้เล่นที่รอ</h2><span class="muted small">เรียงตามเกมน้อย → รอนาน</span></div>
    ${tl.waiting.length?`<div class="tw"><table class="wtbl"><thead><tr><th>#</th><th>ผู้เล่น</th><th>สถานะ</th><th class="n">เกม</th><th class="n">คาดว่าได้ลง</th></tr></thead><tbody>${tl.waiting.map((p,i)=>{const st=statusOf(p,ps,t);const x=ps.get(p.id);
      return `<tr><td class="num">${i+1}</td><td><div class="pn">${skillChip(p.skill)}<span class="nm">${esc(p.name)}</span></div></td><td><span class="chip s-${st.k}" ${st.until?`data-until="${st.until}"`:""}>${esc(st.t)}</span></td><td class="n">${x.games}</td><td class="n">${tl.eta[p.id]?(tl.eta[p.id]<=t+30000?"ตอนนี้":hm(tl.eta[p.id])+" ("+Math.round((tl.eta[p.id]-t)/MIN)+" นาที)"):"–"}</td></tr>`;}).join("")}</tbody></table></div>`:`<div class="empty">${present.length?"ทุกคนอยู่ในคอร์ดหรือคิวแล้ว":"ยังไม่มีผู้เล่นเช็คอิน — เช็คอินที่แท็บ \"ประกาศ & ผู้เล่น\""}</div>`}
  </section></div>`;
  return h;
}
/* ---------- announcements & roster ---------- */
let rosterTab="confirmed";
function vPlayers(){
  const s=curSession();
  let h="";
  if(DB.isOrg)h+=`<section class="panel"><div class="ph"><h2>รอบเล่น / ประกาศรับสมัคร</h2><span class="sp"></span><button class="primary" data-act="newSession">+ สร้างรอบใหม่</button>${s?`<button data-act="copyAnnounce">คัดลอกประกาศ</button><button data-act="editSession">แก้ไขรอบนี้</button>${s.status!=="closed"?`<button class="ghost" data-act="closeSession">ปิดรอบ</button>`:`<button class="ghost" data-act="reopenSession">เปิดรอบอีกครั้ง</button>`}`:""}</div>
    ${s?sessionCard(s):"<div class='empty'>ยังไม่มีรอบเล่น</div>"}</section>`;
  else if(s)h+=`<section class="panel">${sessionCard(s)}</section>`;
  if(!s)return (h+jrPanel())||noSession();
  const roster=rosterModel(),ps=playerStats(),t=now();
  const groups={confirmed:roster.filter(p=>p.status==="confirmed"),reserve:roster.filter(p=>p.status==="reserve"),noshow:roster.filter(p=>p.status==="noshow"),removed:roster.filter(p=>p.status==="removed")};
  const dl=roster.deadline;
  if(dl&&s.status!=="closed")h+=t<dl
    ?`<div class="notice">เช็คอินภายใน <b>${hm(dl)}</b> (อีก <span data-until="${dl}" data-pre="">${mmss(dl-t)}</span>) — หลังจากนั้นตัวจริงที่ยังไม่มาจะเสียสิทธิ์ให้ตัวสำรองที่มาถึงแล้ว · ยังไม่เช็คอิน ${groups.confirmed.filter(p=>!p.checkedIn).length} คน</div>`
    :(groups.noshow.length?`<div class="notice warn">เลยเวลาเช็คอิน ${hm(dl)} แล้ว — ไม่มาตามนัด ${groups.noshow.length} คน${roster.filter(p=>p.promoted).length?` · เลื่อนตัวสำรองที่มาแล้วขึ้นแทน ${roster.filter(p=>p.promoted).length} คน`:""}${roster.openSlots?` · ยังว่าง ${roster.openSlots} ที่`:""}${cfg().noShowFee?` · คิดค่าปรับคนละ ${baht(cfg().noShowFee)} ฿`:""}</div>`:"");
  const R=roster.rounds,dl2=roster.deadline2;
  if(R&&s.status!=="closed"){const n1=groups.confirmed.filter(p=>p.round===1).length,n2=groups.confirmed.filter(p=>p.round===2).length;
    h+=`<div class="notice">รอบ ${esc(s.start||"")}: ${n1}/${s.maxPlayers||"-"} คน · รอบ ${esc(R.start)}: ${n2}/${R.max<999?R.max:"-"} คน · สำรองรอรอบ ${esc(s.start||"")} ${roster.rsvTotal[1]} · สำรองรอรอบ ${esc(R.start)} ${roster.rsvTotal[2]}${dl2&&t<dl2?` · เช็คอินรอบ ${esc(R.start)} ได้ถึง <b>${hm(dl2)}</b>`:""}${roster.some(p=>p.notYet&&p.checkedIn)?` · เช็คอินรอรอบ ${esc(R.start)} แล้ว ${roster.filter(p=>p.notYet&&p.checkedIn).length} คน (ยังไม่ถูกจัดลงคอร์ด)`:""}</div>`;
    /* say WHY round-2 players are not in the draw yet: this device thinks round 2 has not started (wrong round date, or the device clock is behind) */
    const t2=sessRoundStart(s,2),wait2=t2-t;
    if(wait2>0&&roster.some(p=>p.notYet))h+=wait2>12*3600e3
      ?`<div class="notice warn">ผู้เล่นรอบ ${esc(R.start)} ยังไม่เข้าคิว เพราะวันที่ของรอบนี้คือ <b>${esc(fmtD(s.date))}</b> แต่นาฬิกาเครื่องนี้ตอนนี้คือ ${esc(hm(t))} — ยังไม่ถึงรอบ ${esc(R.start)} ของวันนั้น · ถ้าเล่นวันนี้ให้กด "แก้ไขรอบนี้" แล้วแก้วันที่</div>`
      :`<div class="notice">ผู้เล่นรอบ ${esc(R.start)} จะเข้าคิวอีก <b><span data-until="${t2}" data-pre="">${mmss(wait2)}</span></b> · นาฬิกาเครื่องนี้ ${esc(hm(t))} (ถ้าไม่ตรงกับนาฬิกาจริง ให้ตั้งเวลาเครื่องเป็นอัตโนมัติ)</div>`;}
  h+=jrPanel();
  const list=groups[rosterTab]||[];
  h+=`<section class="panel"><div class="ph"><h2>รายชื่อผู้เล่น</h2>
    <div class="seg" role="group">${[["confirmed","ตัวจริง"],["reserve","สำรอง"],...(groups.noshow.length?[["noshow","ไม่มา"]]:[]),["removed","นำออก"]].map(([k,tx])=>`<button data-act="rosterTab" data-k="${k}" aria-pressed="${rosterTab===k}">${tx} ${groups[k].length}</button>`).join("")}</div>
    <span class="sp"></span>${DB.isOrg?`<button class="primary" data-act="addFromMembers">+ เพิ่มจากสมาชิกก๊วน</button><button data-act="addWalkin">+ เพิ่มผู้เล่นใหม่</button><button class="ghost" data-act="checkinAll">เช็คอินทั้งหมด</button><button class="ghost" data-act="qrOpen">QR ก๊วน</button>`:""}</div>
    ${list.length?`<div class="tw"><table class="rostbl"><thead><tr><th>#</th><th>ชื่อ</th><th>ระดับ</th><th>สถานะ</th><th class="n">เกม</th><th>ประเภท</th>${DB.isOrg?"<th></th>":""}</tr></thead><tbody>${list.map((p,i)=>{const st=statusOf(p,ps,t);
      const rchip=R&&(p.status==="confirmed"||p.status==="reserve")?` <span class="chip ${(p.round||p.want)===2?"s-warn":"s-queued"}">${p.status==="reserve"?"สำรอง ":""}รอบ ${esc((p.round||p.want)===2?R.start:s.start||"")}${p.upgraded?" ↑":""}</span>`:"";
      return `<tr><td class="num c-num">${p.status==="confirmed"?p.no||i+1:p.status==="reserve"?p.rsvNo||i+1:i+1}</td><td class="c-name"><b>${esc(p.name)}</b>${rchip}</td><td class="c-lv">${skillChip(p.skill)} <span class="small muted">${esc(SKILL[sk(p.skill)].t)}</span></td><td class="c-st"><span class="chip s-${st.k}" ${st.until?`data-until="${st.until}"`:""}>${esc(st.t)}</span></td><td class="n c-games" data-l="เกม">${ps.get(p.id).games}</td><td class="small muted c-type">${p.member?"สมาชิกก๊วน":p.walkin?"walk-in":"ลงชื่อเอง"}</td>
      ${DB.isOrg?`<td class="c-act"><div class="acts">${p.status==="confirmed"?(p.checkedIn?`<button class="sm" data-act="checkout" data-id="${esc(p.id)}">เช็คเอาท์</button>`:`<button class="primary sm" data-act="checkin" data-id="${esc(p.id)}">เช็คอิน</button>`):""}
        ${p.status==="reserve"?`<button class="sm" data-act="promote" data-id="${esc(p.id)}">เลื่อนเป็นตัวจริง</button>`:""}
        ${R&&(p.status==="confirmed"||p.status==="reserve")?`<button class="ghost sm" data-act="moveRound" data-id="${esc(p.id)}">ย้ายไปรอบ ${esc((p.round||p.want)===2?s.start||"":R.start)}</button>`:""}
        ${p.status==="noshow"?`<button class="primary sm" data-act="checkin" data-id="${esc(p.id)}">มาแล้ว · เช็คอิน</button>`:""}
        ${p.status==="removed"?`<button class="sm" data-act="restore" data-id="${esc(p.id)}">คืนรายชื่อ</button>`:`<button class="ghost sm" data-act="editPlayer" data-id="${esc(p.id)}">แก้ไข</button><button class="ghost sm" data-act="removeP" data-id="${esc(p.id)}">นำออก</button>`}</div></td>`:""}</tr>`;}).join("")}</tbody></table></div>`:`<div class="empty">ไม่มีผู้เล่นในกลุ่มนี้</div>`}
  </section>`;
  return h;
}
/* ---------- "the round is full" messages from players ---------- */
/* the organizer keeps the wishes of people who could not sign up: puts them in the line of the open round, or turns them down with a reason they read */
function jrPanel(){
  if(!DB.isOrg)return "";
  const all=joinReqModel(),pend=all.filter(r=>r.status==="pending"),done=all.filter(r=>r.status!=="pending").sort((a,b)=>(b.decidedAt||b.at)-(a.decidedAt||a.at)).slice(0,6);
  if(!pend.length&&!done.length)return "";
  const s=curSession(),open=!!s&&s.status!=="closed",ro=open?rosterModel():[];
  const where=r=>`${r.sTitle||"รอบเล่น"}${r.sDate?" · "+fmtD(r.sDate):""}`;
  const card=r=>{const inNow=open&&ro.some(p=>p.id===r.uid&&p.status!=="removed");
    return `<article class="jr"><div class="jr-h"><b>${esc(r.name)}</b>${skillChip(r.skill)}<span class="chip s-warn">${r.when==="next"?"ขอจองรอบหน้า":"ขอรอบนี้"}</span>${r.roundLabel?`<span class="chip s-queued">${esc(r.roundLabel)}</span>`:""}</div>
      <div class="small muted">ส่งเมื่อ ${esc(fmtDT(r.at))} · จากรอบ ${esc(where(r))}</div>${r.msg?`<p class="jr-m">${esc(r.msg)}</p>`:""}
      ${inNow?`<div class="small">อยู่ในรอบ “${esc(s.title||"")}” แล้ว</div>`:""}
      <div class="jr-a"><button class="primary sm" data-act="jrQueue" data-id="${esc(r.id)}">เข้าคิว</button><button class="ghost sm" data-act="jrRemove" data-id="${esc(r.id)}">นำออก</button></div></article>`;};
  const row=r=>`<div class="jr jr-${r.status}"><div class="jr-h"><b>${esc(r.name)}</b><span class="chip ${r.status==="queued"?"s-ready":"s-bad"}">${r.status==="queued"?"เข้าคิวแล้ว":"นำออกแล้ว"}</span><span class="small muted">${esc(r.when==="next"?"ขอจองรอบหน้า":"ขอรอบนี้")}${r.roundLabel?" · "+esc(r.roundLabel):""}</span></div>
      ${r.status==="removed"?`<div class="small jr-why"><b>เหตุผลที่แจ้งผู้เล่น:</b> ${esc(r.reason||"-")}</div><div class="jr-a"><button class="ghost sm" data-act="jrReopen" data-id="${esc(r.id)}">กลับไปรอพิจารณา</button></div>`:""}</div>`;
  return `<section class="panel jrp" id="jrPanel"><div class="ph"><h2>คำขอเล่นเมื่อรอบเต็ม</h2><span class="muted small">${pend.length?`รอพิจารณา ${pend.length} คน`:"ไม่มีคำขอค้าง"}</span></div>
    ${pend.length?`<p class="small muted" style="margin:0 0 10px">${open?`“เข้าคิว” = ใส่ชื่อเข้ารอบ “${esc(s.title||"รอบเล่น")}” · `:`ยังไม่มีรอบที่เปิดอยู่ — สร้างรอบใหม่ก่อนจึงจะเข้าคิวได้ · `}“นำออก” = ปฏิเสธและบอกเหตุผลให้ผู้เล่น</p><div class="jrl">${pend.map(card).join("")}</div>`:""}
    ${done.length?`<details class="jr-done"${pend.length?"":" open"}><summary class="small">ตอบแล้วล่าสุด ${done.length} รายการ</summary><div class="jrl" style="margin-top:8px">${done.map(row).join("")}</div></details>`:""}</section>`;
}
async function jrQueue(id){
  const r=joinReqModel().find(x=>x.id===id);if(!r||r.status!=="pending")return;
  const s=curSession();
  if(!s||s.status==="closed"){toast("ยังไม่มีรอบที่เปิดอยู่ — สร้างรอบใหม่ก่อน แล้วค่อยกด “เข้าคิว”");return;}
  const ro=rosterModel(),have=ro.find(p=>p.id===r.uid&&p.status!=="removed");
  let rd=0;
  if(!have){
    if(!await confirmOverQuota(s,1)){toast("ยังไม่ได้เข้าคิว");return;}
    /* with a second round: the player's wish if he named a round, otherwise round 2 while round 1 is full and round 2 still has room */
    const R=roundsOf(s),r1=+s.maxPlayers>0?+s.maxPlayers:999;
    const c1=ro.filter(p=>(p.status==="confirmed"&&p.round===1)||(p.status==="reserve"&&p.want!==2)).length,c2=ro.filter(p=>(p.status==="confirmed"&&p.round===2)||(p.status==="reserve"&&p.want===2)).length;
    rd=R?(r.round===2?2:r.round===1?0:(c1>=r1&&c2<R.max?2:0)):0;
    const ex=S.roster.find(x=>x.id===r.uid);
    const data={...(ex?stripId(ex):{addedAt:now(),walkin:false}),...(rd?{round:rd}:{})};
    if(ex&&ex.status==="removed"){data.status=null;delete data.removedReason;delete data.removedAt;}
    if(!await write(`sessions/${s.id}/roster/${r.uid}`,data))return;
  }
  if(await write(`joinreq/${id}`,{owner:r.uid,status:"queued",toSid:s.id,round:have?(have.round||have.want||0):rd,at:now(),by:DB.meName||"ผู้จัด"},`เข้าคิวแล้ว: ${r.name}`))logEv("รับคำขอเข้าคิว",`${r.name} → ${s.title||"รอบเล่น"}`);
}
/* a small form with one reason box; the player reads the text (required for a turned-down request, optional when taking someone off the list) */
function dlgReason({title,hint,required,ph,ok="ตกลง",onOk}){
  const quick=["รอบนี้เต็มโควต้าแล้ว","ขอเชิญรอบหน้า"];
  openDlg(`<form novalidate style="display:grid;gap:12px"><h2>${esc(title)}</h2>${hint?`<p class="small muted" style="margin:0">${hint}</p>`:""}
    <label class="f">เหตุผล${required?"":" (ไม่บังคับ)"}<textarea name="reason" rows="3" maxlength="200" placeholder="${esc(ph||"")}"></textarea><span class="ferr"></span></label>
    <div class="jr-quick">${quick.map(t=>`<button type="button" class="ghost sm" data-fill="${esc(t)}">${esc(t)}</button>`).join("")}</div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">${esc(ok)}</button></div></form>`,async f=>{
    const reason=fv(f,"reason");if(required&&!reason)return fieldErr(f,"reason","ใส่เหตุผลก่อน — ผู้เล่นจะเห็นข้อความนี้");
    return onOk(reason);});
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-fill]");if(!b)return;const t=document.querySelector("#dlg textarea[name=reason]");if(!t)return;t.value=b.dataset.fill;t.classList.remove("bad");const er=t.parentElement.querySelector(".ferr");if(er)er.textContent="";t.focus();});
function dlgJoinRemove(id){
  const r=joinReqModel().find(x=>x.id===id);if(!r||r.status!=="pending")return;
  dlgReason({title:`นำออก · ${r.name}`,hint:"ผู้เล่นจะเห็นเหตุผลนี้ในแอปของเขา",required:true,ph:"เช่น รอบนี้เต็มโควต้าแล้ว ขอเชิญรอบหน้า",
    onOk:async reason=>{const ok=await write(`joinreq/${id}`,{owner:r.uid,status:"removed",reason,at:now(),by:DB.meName||"ผู้จัด"},`นำออกแล้ว: ${r.name} — ผู้เล่นจะเห็นเหตุผล`);if(ok)logEv("ปฏิเสธคำขอเล่นเมื่อรอบเต็ม",`${r.name}: ${reason}`);return ok;}});
}
/* taking someone off the list of the open round (confirmed or reserve) */
function dlgRemovePlayer(p){
  const reserve=p.status==="reserve",acct=!p.walkin&&!p.member;
  dlgReason({title:`นำออก · ${p.name}`,hint:acct?"ผู้เล่นเห็นเหตุผลนี้ในแอปของเขา · กด “คืนรายชื่อ” ได้ภายหลัง":"คนนี้ไม่ได้ลงชื่อเองในแอป — เหตุผลเก็บไว้ให้ผู้จัดดู · กด “คืนรายชื่อ” ได้ภายหลัง",required:reserve,ph:"เช่น รอบนี้เต็มโควต้าแล้ว",
    onOk:async reason=>{const ok=await rosterPatch(p.id,{status:"removed",removedReason:reason,removedAt:now()},"นำออกแล้ว");if(ok)logEv("นำผู้เล่นออก",`${p.name}${reason?": "+reason:""}`);return ok;}});
}
let jrSeen=null;
/* a new message from a player: tell the organizer once */
function jrWatch(){
  if(!DB.isOrg)return;
  const pend=joinReqModel().filter(r=>r.status==="pending");
  if(jrSeen){const nw=pend.filter(r=>!jrSeen.has(r.id));if(nw.length)toast(`มีข้อความขอเล่นใหม่จาก ${nw.map(r=>r.name).join(", ")} — ดูแท็บ “ประกาศ & ผู้เล่น”`);}
  jrSeen=new Set([...(jrSeen||[]),...pend.map(r=>r.id)]);
}
/* ---------- requests ---------- */
function vRequests(){
  const s=curSession();if(!s)return noSession();
  const all=requestModel();
  const pend=all.filter(r=>r.status==="pending");
  let h=`<section class="panel"><div class="ph"><h2>คำขอที่รอพิจารณา</h2><span class="muted small">ลำดับความสำคัญในการจับคู่: ขอเป็นคู่ → ขอเป็นคู่แข่ง → คิวปกติ</span><span class="sp"></span>
    ${DB.isOrg?`<button data-act="newRequest">+ บันทึกคำขอแทนผู้เล่น</button>`:(selfService()&&selfDoc(DB.uid)?`<button data-act="newRequest">+ ขอคู่ / คู่แข่ง</button>`:"")}</div>
    ${cfg().autoMutual?`<div class="small muted" style="margin-bottom:8px">ถ้าสองคนขอเป็นคู่กันเอง ระบบอนุมัติให้อัตโนมัติ</div>`:""}
    ${pend.length?reqTable(pend,DB.isOrg):`<div class="empty">ไม่มีคำขอค้าง</div>`}</section>
    <section class="panel"><div class="ph"><h2>ประวัติคำขอ</h2></div>${all.filter(r=>r.status!=="pending").length?reqTable(all.filter(r=>r.status!=="pending"),DB.isOrg):`<div class="empty">ยังไม่มี</div>`}</section>`;
  return h;
}

/* ---------- QR for the group ---------- */
/* picture of the pay QR: with a PromptPay number the amount can be inside the QR; otherwise the picture the organizer saved */
async function payQrBlob(amount,who){
  const pay=S.payqr||{},c=cfg();
  const lines=[who||"",pay.ppName?`บัญชี ${pay.ppName}`:"",amount>0?`ยอดที่ต้องจ่าย ${baht(amount)} บาท`:"",c.payInfo&&!pay.pp&&!amount?c.payInfo.split("\n")[0]:""].filter(Boolean);
  if(pay.pp&&(amount>0||!pay.img))return QRS.cardBlob({text:QRS.ppPayload(pay.pp,amount),title:"สแกนจ่ายค่าเล่น",lines:lines.length?lines:[c.group||"ก๊วนแบด"]});
  if(pay.img)return QRS.cardBlob({img:pay.img,title:"สแกนจ่ายค่าเล่น",lines:lines.length?lines:[c.group||"ก๊วนแบด"]});
  throw new Error("ยังไม่ได้บันทึก QR จ่ายเงิน");
}
async function sendPayQr(amount,who,btn){
  const o=btn&&btn.textContent;
  try{const r=await QRS.share(await payQrBlob(amount,who),"qr-pay.png",`${amount>0?`${who||""} ยอด ${baht(amount)} บาท — `:""}สแกนจ่ายค่าเล่น`);if(btn&&r==="saved")toast("บันทึกรูปแล้ว — แนบส่งใน LINE ได้เลย");}
  catch(e){toast(e.message||"สร้างรูป QR ไม่ได้");}
  if(btn)btn.textContent=o;
}
function dlgQr(){
  const pay=S.payqr||{},has=!!(pay.img||pay.pp),isGh=DB.mode==="gh";
  openDlg(`<div style="display:grid;gap:14px"><h2>QR ของก๊วน</h2>
    <section class="qrsec"><h3>QR เข้าร่วมก๊วน</h3>
      <p class="small" style="margin:0">QR ลิงก์เชิญผู้เล่น — บันทึกเป็นรูปหรือส่งเข้ากลุ่ม LINE ของผู้จัดได้</p>
      ${isGh?`<div class="dlg-a" style="justify-content:flex-start"><button class="primary" data-act="openInvite">เปิด QR เข้าร่วม (บันทึก / ส่งเข้า LINE)</button></div>`:`<div class="notice small">โหมดเครื่องเดียวยังไม่มีลิงก์เชิญ — เชื่อมกับ GitHub ก่อนแล้ว QR เข้าร่วมจะขึ้นที่นี่</div>`}
    </section>
    <section class="qrsec"><h3>QR จ่ายค่าเล่น</h3>
      ${has?(pay.img?`<img class="qrprev" src="${esc(pay.img)}" alt="QR จ่ายเงินที่บันทึกไว้">`:`<img class="qrprev" id="qrGen" alt="QR พร้อมเพย์">`):`<div class="notice small">ยังไม่ได้บันทึก — เลือกรูป QR จากแอปธนาคาร (ภาพหน้าจอ) หรือใส่เลขพร้อมเพย์ให้แอปสร้างให้</div>`}
      <div class="dlg-a" style="justify-content:flex-start"><label class="btn-file"><input type="file" id="qrFile" accept="image/*" hidden><span class="sm-btn">${pay.img?"เปลี่ยนรูป QR":"เลือกรูป QR จากเครื่อง"}</span></label>
        ${has?`<button class="sm" data-act="qrSave">บันทึกรูป</button><button class="sm primary" data-act="qrSend">ส่งเข้า LINE</button>`:""}${pay.img?`<button class="ghost sm" data-act="qrDel" data-k="img">ลบรูป</button>`:""}</div>
      <form id="ppForm" novalidate style="display:grid;gap:8px"><div class="fg">
        <label class="f">เลขพร้อมเพย์ (ไม่บังคับ)<input name="pp" inputmode="numeric" maxlength="20" value="${esc(pay.pp||"")}" placeholder="เบอร์มือถือ / เลขบัตรประชาชน" autocomplete="off"><span class="ferr"></span></label>
        <label class="f">ชื่อบัญชี (แสดงบนรูป)<input name="ppName" maxlength="60" value="${esc(pay.ppName||"")}" autocomplete="off"></label></div>
        <p class="small muted" style="margin:0">ใส่เลขพร้อมเพย์แล้ว ปุ่ม “QR ยอด” ในหน้าค่าใช้จ่ายจะสร้าง QR ที่ใส่ยอดของแต่ละคนให้ · <b>ลองสแกนด้วยแอปธนาคารของคุณก่อนใช้จริงทุกครั้ง</b></p>
        <div class="dlg-a" style="justify-content:flex-start"><button type="submit" class="sm">บันทึกพร้อมเพย์</button>${pay.pp?`<button type="button" class="ghost sm" data-act="qrDel" data-k="pp">ลบพร้อมเพย์</button>`:""}<button type="button" class="ghost" data-close>ปิด</button></div></form>
    </section></div>`,async()=>false);   // the PromptPay form below handles its own submit
  const pf=document.getElementById("ppForm");
  pf.addEventListener("submit",async e=>{e.preventDefault();const pp=pf.elements.pp.value.trim();
    if(pp&&!QRS.ppValid(pp)){fieldErr(pf,"pp","เบอร์มือถือ 10 หลัก, เลขบัตร/ภาษี 13 หลัก หรือ e-Wallet 15 หลัก");return;}
    const d={...(S.payqr||{})};delete d.id;if(pp)d.pp=QRS.ppValid(pp);else delete d.pp;const nm=pf.elements.ppName.value.trim();if(nm)d.ppName=nm;else delete d.ppName;
    if(await write("cfg/pay",d,"บันทึกข้อมูล QR จ่ายเงินแล้ว"))setTimeout(dlgQr,150);});
  document.getElementById("qrFile").addEventListener("change",async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;
    try{const img=await QRS.shrink(f);const d={...(S.payqr||{})};delete d.id;d.img=img;d.upAt=now();
      if(await write("cfg/pay",d,"บันทึก QR จ่ายเงินแล้ว — ผู้เล่นเห็นในแท็บจ่ายเงิน"))setTimeout(dlgQr,150);}
    catch(x){toast(x.message||"อ่านรูปไม่ได้");}});
  const g=document.getElementById("qrGen");if(g)QRS.cardBlob({text:QRS.ppPayload(pay.pp,0),title:"สแกนจ่ายค่าเล่น",lines:[pay.ppName||cfg().group||""]}).then(b=>{g.src=URL.createObjectURL(b);}).catch(()=>{});
}
/* ---------- money ---------- */
const METHOD_TH={cash:"เงินสด",transfer:"โอน"};
const fmtDT=ts=>{const d=new Date(ts);return `${pad(d.getDate())}/${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;};
/* what was received so far, each receipt with how it came in */
function recLine(r){
  if(!r.recs.length&&!(r.paidAmt>0))return "";
  const parts=r.recs.length?r.recs.map(x=>`${METHOD_TH[x.m]||"เงินสด"} ${baht(x.a)} ฿ (${fmtDT(x.at)})`):[`${r.transAmt>0?"โอน":"เงินสด"} ${baht(r.paidAmt)} ฿`];
  return `<div class="small recl">รับแล้ว: ${parts.map(esc).join(" + ")}${r.owe>0?` · <b style="color:var(--warn)">ค้าง ${baht(r.owe)} ฿</b>`:""}</div>`;
}
/* the new pay document after a receipt (cash or transfer); r is a row of payModel() */
function receiptDoc(r,amount,method,extra){
  const x={...(r.ov||{})},add=Math.max(0,Math.min(amount,r.owe)),by=DB.meName||"ผู้จัด";
  x.status=method==="transfer"?"verified":"cash";x.by=by;x.at=now();x.paidAmount=Math.min(r.due,r.paidAmt+add);
  x.rec=[...(Array.isArray(x.rec)?x.rec:[]),{a:add,m:method==="transfer"?"transfer":"cash",at:now(),by,...(extra||{})}];
  delete x.note;delete x.adjReason;return x;
}
/* ---- who still owes from rounds that are already closed (kept per player in notes/{id}, which only the player and organizers can read) ---- */
function debtLedger(){
  const out=[];
  (S.notes||[]).forEach(n=>{Object.entries(n.bySid||{}).forEach(([sid,v])=>{
    const ss=S.sessions.find(x=>x.id===sid);if(!ss||ss.status!=="closed"||!(+v.owe>0))return;
    out.push({pid:n.id,sid,owe:+v.owe,due:+v.due||+v.owe,name:v.nm||(selfDoc(n.id)||{}).name||"ผู้เล่น",date:ss.date||"",title:ss.title||"รอบเล่น"});});});
  return out.sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,"th"));
}
/* write the debts of the CURRENT closed round into the players' notes (only when something changed) */
async function syncDebts(){
  const s=curSession();if(!s||s.status!=="closed"||!DB.isOrg)return;
  const pm=payModel();
  for(const r of pm.rows){
    const nt=((S.notes.find(x=>x.id===r.id)||{}).bySid||{})[s.id]||{},owe=Math.round(r.owe*100)/100;
    if(owe>0&&(+nt.owe!==owe||+nt.due!==r.due||nt.nm!==r.name))await setNote(r.id,s.id,{owe,due:r.due,nm:r.name,debtAt:now()});
    else if(owe<=0&&nt.owe)await setNote(r.id,s.id,{owe:"",due:"",nm:"",debtAt:""});
  }
}
const debtSig={};let debtTimer=null;
/* whenever who-owes-what changes in a closed round (receipts, adjustments, edits) the players' notes are brought up to date */
function ensureDebtSync(){const s=curSession();if(!s||s.status!=="closed"||!DB.isOrg)return;
  const sig=payModel().rows.map(r=>r.id+":"+Math.round(r.owe*100)+":"+r.due).join("|");
  if(debtSig[s.id]===sig)return;debtSig[s.id]=sig;
  clearTimeout(debtTimer);debtTimer=setTimeout(()=>syncDebts().catch(()=>{}),700);}
/* money received later for a round that is already closed */
async function receiveDebt(e,amount,method){
  const add=Math.max(0,Math.min(Math.round(amount*100)/100,e.owe));if(!add)return false;
  let ov=null;try{ov=await readDoc(`sessions/${e.sid}/pay/${e.pid}`);}catch(_){}ov={...(ov||{})};delete ov.id;
  const paidBefore=ov.paidAmount!=null?+ov.paidAmount:Math.max(0,e.due-e.owe),by=DB.meName||"ผู้จัด";
  const x={...ov,status:method==="transfer"?"verified":"cash",by,at:now(),paidAmount:Math.min(e.due,paidBefore+add),rec:[...(Array.isArray(ov.rec)?ov.rec:[]),{a:add,m:method==="transfer"?"transfer":"cash",at:now(),by,late:true}]};
  delete x.note;delete x.adjReason;
  const left=Math.max(0,Math.round((e.owe-add)*100)/100);
  const ok=await write(`sessions/${e.sid}/pay/${e.pid}`,x,left?`รับ${METHOD_TH[method==="transfer"?"transfer":"cash"]} ${baht(add)} ฿ แล้ว — ค้างอีก ${baht(left)} ฿`:"รับเงินครบแล้ว — ปิดยอดค้าง");
  if(!ok)return false;
  await setNote(e.pid,e.sid,left?{owe:left}:{owe:"",due:"",nm:"",debtAt:""});
  const ss=S.sessions.find(q=>q.id===e.sid);
  if(ss&&ss.summary)await write(`sessions/${ss.id}`,{...stripId(ss),summary:{...ss.summary,owed:Math.max(0,Math.round(((+ss.summary.owed||0)-add)*100)/100)}});
  logEv("รับเงินค้างรอบก่อน",`${e.name} · ${fmtD(e.date)} · ${METHOD_TH[method==="transfer"?"transfer":"cash"]} ${add} ฿${left?` (ค้างอีก ${left})`:" (ครบ)"}`);
  return true;
}
function dlgDebtPay(e){
  openDlg(`<form novalidate><h2>รับเงินค้าง · ${esc(e.name)}</h2>
    <p class="small" style="margin:0 0 8px">รอบ ${esc(fmtD(e.date))} · ${esc(e.title)} · ยอดเต็ม ${baht(e.due)} ฿ · ค้างอยู่ <b>${baht(e.owe)} ฿</b></p>
    <div class="fg">${intIn("amt","รับครั้งนี้ (฿)",e.owe,1,100000)}</div>
    ${methodPick("cash")}
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึกรับเงิน</button></div></form>`,async f=>{
    const a=checkInt(f,"amt",true);if(a===false)return false;if(a>e.owe)return fieldErr(f,"amt",`เกินยอดค้าง ${baht(e.owe)} ฿`);
    return receiveDebt(e,a,f.elements.method.value);});
}
const methodPick=def=>`<div class="mpick" role="radiogroup" aria-label="วิธีรับเงิน"><label class="rd"><input type="radio" name="method" value="cash"${def==="cash"?" checked":""}><span><b>เงินสด</b></span></label><label class="rd"><input type="radio" name="method" value="transfer"${def==="transfer"?" checked":""}><span><b>โอน</b></span></label></div>`;
function vDebts(){
  const L=debtLedger(),legacy=S.sessions.filter(x=>x.status==="closed"&&x.summary&&+x.summary.owed>0&&!L.some(e=>e.sid===x.id));
  if(!L.length&&!legacy.length)return "";
  const by={};L.forEach(e=>{(by[e.pid]=by[e.pid]||{pid:e.pid,name:e.name,total:0,items:[]});by[e.pid].total+=e.owe;by[e.pid].items.push(e);});
  const groups=Object.values(by).sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"th")),sum=L.reduce((a,e)=>a+e.owe,0);
  return `<section class="panel" id="debts"><div class="ph"><h2>ยอดค้างจ่ายสะสม</h2><span class="sp"></span>${L.length?`<button class="sm" data-act="copyDebts">คัดลอกรายชื่อ (ส่งกลุ่มไลน์)</button>`:""}</div>
    <p class="small" style="margin:0 0 8px">คนที่จ่ายไม่ครบในรอบที่ปิดแล้ว <b>${groups.length} คน รวม ${baht(sum)} ฿</b> — คราวหน้าเขามาจ่ายเพิ่ม กดรับเงินที่นี่ได้เลย ระบบบันทึกเป็นประวัติและหักยอดค้างให้</p>
    <div class="debts">${groups.map(g=>`<div class="debt"><div class="debt-h"><b>${esc(g.name)}</b><span class="chip s-warn">ค้าง ${baht(g.total)} ฿</span></div>${g.items.map(e=>`<div class="debt-r"><span class="small">${esc(fmtD(e.date))} · ${esc(e.title)}<br><b>${baht(e.owe)} ฿</b>${e.due!==e.owe?` <span class="muted">จาก ${baht(e.due)}</span>`:""}</span><span class="acts"><button class="sm" data-act="debtPay" data-k="cash" data-sid="${esc(e.sid)}" data-id="${esc(e.pid)}">รับสด</button><button class="sm" data-act="debtPay" data-k="transfer" data-sid="${esc(e.sid)}" data-id="${esc(e.pid)}">รับโอน</button><button class="ghost sm" data-act="debtPart" data-sid="${esc(e.sid)}" data-id="${esc(e.pid)}">บางส่วน</button></span></div>`).join("")}</div>`).join("")}</div>
    ${legacy.length?`<p class="small muted" style="margin:10px 0 0">รอบที่ปิดไว้ก่อนมีลิสต์นี้: ${legacy.map(x=>`${esc(fmtD(x.date))} ค้าง ${baht(x.summary.owed)} ฿ <button class="ghost sm" data-act="gotoSess" data-id="${esc(x.id)}">เปิดรอบ</button>`).join(" · ")}</p>`:""}</section>`;
}
function vMoney(){
  const s=curSession();if(!s)return noSession();
  const c=priceCfg(curSession()),pm=payModel(),P=pm.pnl;
  const paid=pm.rows.filter(r=>r.state==="paid");
  const sign=n=>`${n<0?"−":n>0?"+":""}${baht(Math.abs(n))}`;
  const pc=n=>n>0?"var(--ready)":n<0?"var(--bad)":"var(--muted)";
  const line=(k,v,sub,neg)=>`<tr><td>${k}${sub?`<div class="small muted">${sub}</div>`:""}</td><td class="n">${neg&&v>0?"−":""}${baht(v)}</td></tr>`;
  let h=`<section class="kpis">
    <div class="kpi"><span class="k">รายรับที่ต้องเก็บ</span><span class="v">${baht(P.revenue)} ฿</span><span class="s">ค่าสนาม ${baht(P.revCourt)} + ค่าลูก ${baht(P.revShuttle)}</span></div>
    <div class="kpi"><span class="k">ต้นทุนผู้จัด</span><span class="v">${baht(P.cost)} ฿</span><span class="s">ค่าเช่า ${baht(P.rent)} + ลูก ${baht(P.costNew+P.costRepair)} + อื่น ๆ ${baht(P.other)}</span></div>
    <div class="kpi" style="border-color:${pc(P.profit)}"><span class="k">${P.profit>=0?"กำไร":"ขาดทุน"} (ถ้าเก็บครบ)</span><span class="v" style="color:${pc(P.profit)}">${sign(P.profit)} ฿</span><span class="s">${P.revenue?Math.round(P.profit/P.revenue*100):0}% ของรายรับ</span></div>
    <div class="kpi" style="border-color:${pc(P.cashProfit)}"><span class="k">${P.cashProfit>=0?"กำไร":"ขาดทุน"} ตามเงินที่เก็บได้จริง</span><span class="v" style="color:${pc(P.cashProfit)}">${sign(P.cashProfit)} ฿</span><span class="s">เก็บแล้ว ${baht(P.collected)} ฿ (สด ${baht(P.collectedCash)} · โอน ${baht(P.collectedTransfer)}) · ${paid.length}/${pm.rows.length} คน</span></div>
  </section>`;
  if(!c.shuttleCost||P.rent===0)h+=`<div class="notice warn">${P.rent===0?"ยังไม่ได้ใส่ค่าเช่าคอร์ดของรอบนี้ ":""}${!c.shuttleCost?"ยังไม่ได้ตั้งราคาทุนลูกใหม่ในหน้าตั้งค่า ":""}— กำไร/ขาดทุนจะยังไม่ตรงความจริง <button class="sm" data-act="${P.rent===0?"editCosts":"editCfg"}">ตั้งค่าตอนนี้</button></div>`;
  h+=`<div class="grid2"><section class="panel"><div class="ph"><h2>งบกำไรขาดทุนรอบนี้</h2><span class="sp"></span><button class="sm" data-act="editCosts">แก้ต้นทุน</button></div>
    <div class="tw"><table><tbody>
      <tr><th colspan="2">รายรับ (เก็บจากผู้เล่น)</th></tr>
      ${line(`ค่าสนาม ${pm.rows.filter(r=>!r.noShowPart).length} คน × ${baht(c.playerCourtFee)} ฿`,P.revCourt)}
      ${line(`ค่าลูกใหม่`,P.revShuttle,`${pm.shuttles} ลูก × ${unit(c.shuttleFee)} ฿ ${c.shuttleSplit==="shared"?"หาร 4 คน":"× ผู้เล่นในเกม"} · ลูกซ่อม ${pm.repair} ลูกไม่คิดเงิน`)}
      ${P.revNoShow?line("ค่าปรับคนไม่มา",P.revNoShow,`${pm.rows.filter(r=>r.noShowPart).length} คน × ${baht(c.noShowFee)} ฿`):""}
      ${P.adjust?line("ปรับยอดรายคน",Math.abs(P.adjust),"",P.adjust<0):""}
      <tr><td><b>รวมรายรับ</b></td><td class="n"><b>${baht(P.revenue)}</b></td></tr>
      <tr><th colspan="2">ต้นทุน (ผู้จัดจ่าย)</th></tr>
      ${line("ค่าเช่าคอร์ด",P.rent,P.rentRate!=null?(P.addedCourts?`${P.courts} คอร์ด (เพิ่มระหว่างเล่น ${P.addedCourts}) · รวม ${(Math.round(P.courtHours*100)/100)} ชม.-คอร์ด × ${baht(P.rentRate)} ฿`:`${P.courts} คอร์ด × ${P.hours.toFixed(1)} ชม. × ${baht(P.rentRate)} ฿`):"ยอดรวมที่บันทึกไว้",true)}
      ${line("ลูกใหม่",P.costNew,`${pm.shuttles} ลูก × ทุน ${unit(c.shuttleCost)} ฿`,true)}
      ${line("ลูกซ่อม",P.costRepair,`${pm.repair} ลูก × ${unit(c.repairCost)} ฿`,true)}
      ${P.other?line("ค่าใช้จ่ายอื่น",P.other,"",true):""}
      <tr><td><b>รวมต้นทุน</b></td><td class="n"><b>${P.cost>0?"−":""}${baht(P.cost)}</b></td></tr>
      <tr><td><b style="color:${pc(P.profit)}">${P.profit>=0?"กำไรสุทธิ":"ขาดทุนสุทธิ"}</b></td><td class="n"><b style="color:${pc(P.profit)};font-size:1.1rem">${sign(P.profit)} ฿</b></td></tr>
    </tbody></table></div>
    ${P.breakEven!=null?`<p class="small" style="margin:10px 0 0">จุดคุ้มทุนค่าเช่า: ต้องมีผู้เล่นอย่างน้อย <b>${P.breakEven}</b> คน (มี ${pm.rows.length} คน)${pm.shuttles&&c.shuttleCost?` · ค่าลูกได้ ${baht(P.revShuttle)} ฿ ต้นทุน ${baht(P.costNew)} ฿ (${P.revShuttle-P.costNew>=0?"กำไร":"ขาดทุน"} ${baht(Math.abs(P.revShuttle-P.costNew))} ฿)`:""}</p>`:""}
  </section>
  <section class="panel"><div class="ph"><h2>สถานะการเก็บเงิน</h2></div>
    <div class="bar" style="height:12px"><span style="width:${P.revenue?Math.min(100,P.collected/P.revenue*100):0}%;background:var(--ready)"></span></div>
    <p class="small">เก็บแล้ว <b>${baht(P.collected)}</b> จาก ${baht(P.revenue)} ฿ · รอตรวจสลิป ${pm.rows.filter(r=>r.state==="pending").length} คน · ยังไม่จ่าย ${pm.rows.filter(r=>r.state==="unpaid"||r.state==="rejected").length} คน${pm.rows.some(r=>r.state==="partial")?` · ค้างเพิ่ม ${pm.rows.filter(r=>r.state==="partial").length} คน`:""}</p>
    ${pm.rows.some(r=>r.owe>0)?'<p style="margin:0 0 8px"><button class="sm" data-act="copyUnpaid">คัดลอกรายชื่อค้างจ่าย (ส่งในกลุ่มไลน์)</button></p>':""}
    <p style="margin:0 0 8px"><button class="sm" data-act="qrOpen">QR จ่ายเงิน${S.payqr&&(S.payqr.img||S.payqr.pp)?" (บันทึก / ส่งเข้า LINE)":" — ตั้งค่า"}</button></p>
    <p class="small muted">ยังต้องเก็บอีก ${baht(Math.max(0,P.revenue-P.collected))} ฿ ${P.collected<P.cost?`· ตอนนี้ยังไม่คืนทุน (ขาดอีก ${baht(P.cost-P.collected)} ฿)`:"· คืนทุนแล้ว"}</p>
  </section></div>`;
  h+=`<section class="panel"><div class="ph"><h2>รายการชำระเงินรายคน</h2><span class="sp"></span><button data-act="exportXlsx">ส่งออก Excel</button></div>
    ${pm.rows.length?`<div class="tw"><table class="paytbl"><thead><tr><th>ผู้เล่น</th><th class="n">เกม</th><th class="n">ค่าสนาม</th><th class="n">ค่าลูก</th><th class="n">ยอด (฿)</th><th>สถานะ</th><th>สลิป</th><th></th></tr></thead><tbody>${pm.rows.map(r=>`<tr>
      <td class="c-name"><b>${esc(r.name)}</b></td>
      <td class="c-meta">${r.noShowPart?`ค่าปรับไม่มา ${baht(r.noShowPart)}`:`ค่าสนาม ${baht(r.courtPart)} + ค่าลูก ${baht(r.shuttlePart)} (${r.myShuttles} ลูก)`} · ${r.games} เกม${r.helped?` · ช่วยแทน ${r.helped} เกม (ไม่คิดค่าลูก)`:""}${r.leftEarly?` · ออกกลางเกม ${r.leftEarly} (ยังคิดค่าลูก)`:""}${r.myFree?` · เกมฟรี ${r.myFree} เกม (ลูกซ่อม)${r.freeOnly?" — เล่นเฉพาะเกมฟรี ไม่คิดค่าสนาม":""}`:""}${recLine(r)}</td>
      <td class="n c-games" data-l="เกม">${r.games}</td>
      <td class="n c-court" data-l="${r.noShowPart?"ค่าปรับไม่มา":"ค่าสนาม"}">${baht(r.noShowPart||r.courtPart)}</td>
      <td class="n c-shut" data-l="ค่าลูก">${baht(r.shuttlePart)}<div class="small muted">${r.myShuttles} ลูก</div></td>
      <td class="n c-due"><b>${baht(r.due)}</b>${r.adjusted?' <span class="small muted">(ปรับ)</span>':""}</td>
      <td class="c-st">${payChip(r)}</td>
      <td class="c-slip">${r.slip?`<button class="sm" data-act="viewSlip" data-id="${esc(r.id)}">ดูสลิป ${baht(r.slip.amount)} ฿</button>`:'<span class="muted small nos">–</span>'}</td>
      <td class="c-act"><div class="acts">${r.state!=="paid"?`<button class="sm" data-act="cashPaid" data-id="${esc(r.id)}">รับเงินสด${r.state==="partial"?` ${baht(r.owe)} ฿`:""}</button><button class="sm" data-act="transferPaid" data-id="${esc(r.id)}">รับโอน${r.state==="partial"?` ${baht(r.owe)} ฿`:""}</button>`:(r.recs.length||r.paidAmt>0)?`<button class="ghost sm" data-act="unpay" data-id="${esc(r.id)}">ยกเลิกสถานะจ่าย</button>`:""}${r.state!=="paid"&&r.owe>1?`<button class="ghost sm" data-act="partialPay" data-id="${esc(r.id)}">รับบางส่วน</button>`:""}<button class="ghost sm" data-act="adjustDue" data-id="${esc(r.id)}">ปรับยอด</button>${r.state!=="paid"&&r.owe>0&&S.payqr&&S.payqr.pp?`<button class="ghost sm" data-act="qrPay" data-id="${esc(r.id)}">QR ยอด ${baht(Math.ceil(r.owe))}</button>`:""}</div></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">ยังไม่มีผู้เล่นที่ต้องชำระ (นับเฉพาะผู้ที่เช็คอินหรือเล่นแล้ว)</div>`}
  </section>`;
  h+=vDebts()+vMonthly();
  ensureDebtSync();
  return h;
}

/* ---------- per-round summary (frozen on the session when it closes) + monthly report ---------- */
const SUM_KEYS=["revenue","cost","profit","players","games","shuttles","repair","owed"];
function sessionSummary(){const pm=payModel(),P=pm.pnl;
  const r2=n=>Math.round((+n||0)*100)/100;
  return {revenue:r2(P.revenue),cost:r2(P.cost),profit:r2(P.profit),players:pm.rows.length,games:S.matches.filter(m=>m.status==="done").length,shuttles:pm.shuttles,repair:pm.repair,owed:pm.rows.reduce((a,r)=>a+r.owe,0)};}
let sumTimer=null;
/* write (or correct) the summary of the CURRENT closed round once the data has settled; safe to call repeatedly */
function refreshSummary(tries=0){
  const sid=S.sid;clearTimeout(sumTimer);
  sumTimer=setTimeout(async()=>{
    const s=curSession();if(!s||s.id!==sid||!DB.isOrg)return;
    if(s.status!=="closed"||S.matches.some(m=>m.status==="playing"||m.status==="queued")){if(tries<6)refreshSummary(tries+1);return;}
    const sm=sessionSummary(),o=s.summary||{};
    if(SUM_KEYS.every(k=>o[k]===sm[k])){await syncDebts();return;}
    await write(`sessions/${s.id}`,{...stripId(s),summary:{...sm,at:now()}});
    await syncDebts();
  },tries?900:1300);
}
function vMonthly(){
  const closed=S.sessions.filter(s=>s.status==="closed");if(!closed.length)return "";
  const has=closed.filter(s=>s.summary&&s.date),miss=closed.length-has.length;
  const byM={};has.forEach(s=>{const k=s.date.slice(0,7);(byM[k]=byM[k]||[]).push(s);});
  const months=Object.keys(byM).sort().reverse();
  const mName=k=>{const [y,m]=k.split("-").map(Number);return new Date(y,m-1,1).toLocaleDateString(LOC(),{month:"long",year:"numeric"});};
  const sign=n=>`${n<0?"−":n>0?"+":""}${baht(Math.abs(n))}`,col=n=>n>0?"var(--ready)":n<0?"var(--bad)":"var(--muted)";
  const T=a=>({n:a.length,owed:a.reduce((x,s)=>x+(+s.summary.owed||0),0),rev:a.reduce((x,s)=>x+s.summary.revenue,0),cost:a.reduce((x,s)=>x+s.summary.cost,0),profit:a.reduce((x,s)=>x+s.summary.profit,0),pl:a.reduce((x,s)=>x+s.summary.players,0)});
  const all=T(has);
  return `<section class="panel" id="monthly"><div class="ph"><h2>สรุปรายเดือน</h2><span class="sp"></span><span class="muted small">เฉพาะรอบที่ปิดแล้ว · ใช้ราคาที่ล็อกตอนปิดรอบ</span></div>
  ${has.length?`<div class="kpis" style="margin-bottom:10px"><div class="kpi"><span class="k">รวมทุกรอบที่ปิด</span><span class="v">${all.n} รอบ</span><span class="s">ผู้เล่นเฉลี่ย ${Math.round(all.pl/all.n)} คน/รอบ</span></div><div class="kpi" style="border-color:${col(all.profit)}"><span class="k">${all.profit>=0?"กำไร":"ขาดทุน"}สะสม</span><span class="v" style="color:${col(all.profit)}">${sign(all.profit)} ฿</span><span class="s">รายรับ ${baht(all.rev)} − ต้นทุน ${baht(all.cost)}</span></div></div>
  ${all.owed>0?`<div class="notice warn" style="margin:0 0 10px"><b>ยังค้างเก็บรวม ${baht(all.owed)} ฿</b> จาก ${has.filter(s=>s.summary.owed>0).length} รอบ — กด "เปิดรอบนี้" เพื่อดูรายชื่อคนที่ค้าง</div>`:""}`:""}
  ${months.map(k=>{const a=byM[k].sort((x,y)=>(y.date||"").localeCompare(x.date||"")),t=T(a);
    return `<h3 style="margin:12px 0 6px">${esc(mName(k))} <span class="muted small">· ${t.n} รอบ · <b style="color:${col(t.profit)};white-space:nowrap">${sign(t.profit)} ฿</b> <span style="white-space:nowrap">(รายรับ ${baht(t.rev)} − ต้นทุน ${baht(t.cost)})</span></span></h3>
    <div class="qlist">${a.map(s=>{const m=s.summary;return `<div class="qcard"><span class="ord small">${esc((s.date||"").slice(8,10))}/${esc((s.date||"").slice(5,7))}</span><div style="min-width:0"><b>${esc(s.title||"รอบเล่น")}</b><div class="small muted">ผู้เล่น ${m.players} · เกม ${m.games} · ลูกใหม่ ${m.shuttles} · รายรับ ${baht(m.revenue)} · ต้นทุน ${baht(m.cost)}${m.owed>0?` · <b style="color:var(--warn)">ค้างเก็บ ${baht(m.owed)}</b>`:""}</div>${s.id!==S.sid?`<button class="ghost sm" style="margin-top:6px" data-act="gotoSess" data-id="${esc(s.id)}">เปิดรอบนี้</button>`:""}</div><span class="chip ${m.profit>0?"s-ready":m.profit<0?"s-bad":""}">${sign(m.profit)} ฿</span></div>`;}).join("")}</div>`;}).join("")}
  ${!has.length?`<div class="empty">ยังไม่มีสรุป — ปิดรอบเล่นแล้วตัวเลขจะมารวมที่นี่</div>`:""}
  ${miss?`<p class="small muted" style="margin:10px 0 0">มี ${miss} รอบที่ปิดไว้ก่อนมีระบบสรุป — เปิดรอบอีกครั้งแล้วปิดใหม่ถ้าอยากนับรวม</p>`:""}</section>`;
}

/* ---------- stock ---------- */
function vStock(){
  const s=curSession(),c=cfg();
  const inv=(S.inv&&S.inv.items)||[];
  const shuttleItem=inv.find(i=>i.shuttle);
  const hours=s?sessHours(s):0;
  const courts=s?(s.courts||[]).length:0;
  const chrs=s?courtHours(s):0;const needBase=Math.ceil(chrs*(+c.perCourtHour||0));
  const need=Math.ceil(needBase*(1+(+c.buffer||0)/100));
  const left=shuttleItem?(shuttleItem.total-shuttleItem.used):0;
  const usedToday=S.matches.filter(m=>m.status==="done").reduce((a,m)=>a+(+m.shuttles||0),0);const repairToday=S.matches.filter(m=>m.status==="done").reduce((a,m)=>a+(+m.repair||0),0);
  const prep=(S.prep&&S.prep.items)||{};
  const CHECK=[["net","ตาข่าย"],["shuttle","ลูกแบด"],["score","ป้ายคะแนน"],["aid","ชุดปฐมพยาบาล"],["water","น้ำดื่ม"],["broom","ไม้กวาด/ผ้าเช็ดพื้น"]];
  let h=`<section class="kpis">
    <div class="kpi ${shuttleItem&&left<=shuttleItem.threshold?"alert":""}"><span class="k">ลูกแบดคงเหลือ</span><span class="v">${shuttleItem?left:"–"}</span><span class="s">${shuttleItem?`แจ้งเตือนเมื่อเหลือ ≤ ${shuttleItem.threshold}`:"ยังไม่ได้ตั้งรายการลูกแบด"}</span></div>
    <div class="kpi"><span class="k">ใช้ในรอบนี้</span><span class="v">${usedToday}</span><span class="s">ลูกใหม่ · ลูกซ่อม ${repairToday} ลูก</span></div>
    <div class="kpi ${s&&shuttleItem&&left<need?"alert":""}"><span class="k">ควรเตรียมสำหรับรอบนี้</span><span class="v">${s?need:"–"}</span><span class="s">${courts} คอร์ด ${Math.abs(chrs-courts*hours)<0.01?"× "+hours.toFixed(1)+" ชม.":"· รวม "+(Math.round(chrs*100)/100)+" ชม.-คอร์ด"} × ${c.perCourtHour} ลูก + เผื่อ ${c.buffer}%</span></div>
  </section>`;
  {const NEW=inv.find(i=>i.shuttle),REP=inv.find(i=>i.repair),lf=i=>i?Math.max(0,i.total-i.used):0;
   h+=`<section class="panel"><div class="ph"><h2>เพิ่มสต็อกลูกแบด</h2><span class="muted small">เกมที่จบแล้วหักสต็อกให้อัตโนมัติ — ลูกใหม่ที่ใช้ ${usedToday} · ลูกซ่อม ${repairToday} ในรอบนี้</span></div>
    <div class="shpair">
      <div class="shtile${NEW&&lf(NEW)<=NEW.threshold?" low":""}"><span class="k">ลูกใหม่ (ลูกจริง)</span><span class="v num">${NEW?lf(NEW):0}</span><span class="small muted">คงเหลือ${NEW?` · แจ้งเตือนเมื่อ ≤ ${NEW.threshold}`:" · ยังไม่มีรายการ"}</span><button class="primary" data-act="shuttleIn" data-k="new">+ เพิ่มลูกใหม่</button></div>
      <div class="shtile${REP&&lf(REP)<=REP.threshold&&REP.threshold>0?" low":""}"><span class="k">ลูกซ่อม</span><span class="v num">${REP?lf(REP):0}</span><span class="small muted">คงเหลือ${REP?"":" · ยังไม่มีรายการ"}</span><button class="primary" data-act="shuttleIn" data-k="repair">+ เพิ่มลูกซ่อม</button></div>
    </div></section>`;}
  if(s&&shuttleItem&&left<need)h+=`<div class="notice warn">ลูกแบดคงเหลือ ${left} ลูก น้อยกว่าที่ควรเตรียม ${need} ลูก — ควรซื้อเพิ่ม ${need-left} ลูก</div>`;
  h+=`<div class="grid2"><section class="panel"><div class="ph"><h2>สต็อก</h2><span class="sp"></span><button data-act="addItem">+ เพิ่มรายการ</button></div>
    ${inv.length?`<div class="tw"><table class="stktbl"><thead><tr><th>รายการ</th><th class="n">ทั้งหมด</th><th class="n">ใช้ไป</th><th class="n">คงเหลือ</th><th></th></tr></thead><tbody>${inv.map(i=>{const l=i.total-i.used;return `<tr><td class="c-name"><b>${esc(i.name)}</b>${i.shuttle?' <span class="chip s-queued">ลูกใหม่ · หักอัตโนมัติ</span>':i.repair?' <span class="chip s-off">ลูกซ่อม · หักอัตโนมัติ</span>':""}</td><td class="n c-tot" data-l="ทั้งหมด">${i.total}</td><td class="n c-used" data-l="ใช้ไป">${i.used}</td><td class="n c-left" data-l="คงเหลือ" style="${l<=i.threshold?"color:var(--warn);font-weight:700":""}">${l} ${esc(i.unit||"")}</td>
      <td class="c-act"><div class="acts"><button class="sm" data-act="stockAdd" data-id="${esc(i.id)}">+ รับเข้า</button><button class="sm" data-act="stockUse" data-id="${esc(i.id)}">− ใช้</button><button class="ghost sm" data-act="editItem" data-id="${esc(i.id)}">แก้ไข</button></div></td></tr>`;}).join("")}</tbody></table></div>`:`<div class="empty">ยังไม่มีรายการ — เพิ่ม "ลูกแบด" และตั้งเป็นรายการที่หักอัตโนมัติจากผลเกม</div>`}</section>
    <section class="panel"><div class="ph"><h2>เช็กลิสต์อุปกรณ์รอบนี้</h2><span class="muted small">${s?esc(fmtD(s.date)):""}</span></div>
    ${s?`<div class="check">${CHECK.map(([k,t])=>`<label><input type="checkbox" data-act="prep" data-k="${k}" ${prep[k]?"checked":""}>${t}</label>`).join("")}</div><p class="small muted">${CHECK.filter(([k])=>prep[k]).length}/${CHECK.length} พร้อม</p>`:"<div class='empty'>เลือกรอบเล่นก่อน</div>"}</section></div>`;
  return h;
}
/* ---------- stats & log ---------- */
function vStats(){
  const s=curSession();if(!s)return noSession();
  const roster=rosterModel(),ps=playerStats();
  const rows=roster.filter(p=>ps.get(p.id).games>0).map(p=>({p,x:ps.get(p.id)})).sort((a,b)=>b.x.wins-a.x.wins||b.x.games-a.x.games);
  const done=S.matches.filter(m=>m.status==="done").sort((a,b)=>(b.endAt||0)-(a.endAt||0));
  const avgLen=done.length?Math.round(done.reduce((a,m)=>a+((m.endAt-m.startAt)/MIN),0)/done.length):0;
  let h=`<section class="kpis"><div class="kpi"><span class="k">เกมที่จบแล้ว</span><span class="v">${done.length}</span></div><div class="kpi"><span class="k">เวลาเฉลี่ยต่อเกม</span><span class="v">${avgLen}</span><span class="s">นาที (ตั้งไว้ ${cfg().avgMin})</span></div><div class="kpi"><span class="k">ผู้เล่นที่ได้ลง</span><span class="v">${rows.length}</span></div></section>
  <div class="grid2"><section class="panel"><div class="ph"><h2>ตารางผู้เล่นรอบนี้</h2></div>${rows.length?`<div class="tw"><table><thead><tr><th>ผู้เล่น</th><th class="n">เกม</th><th class="n">ชนะ</th><th class="n">แพ้</th><th class="n">เสมอ</th><th class="n">นาทีที่เล่น</th></tr></thead><tbody>${rows.map(({p,x})=>`<tr><td><div class="pn">${skillChip(p.skill)}<span>${esc(p.name)}</span></div></td><td class="n">${x.games}</td><td class="n">${x.wins}</td><td class="n">${x.losses}</td><td class="n">${x.draws}</td><td class="n">${x.minutes}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">ยังไม่มีเกมที่จบ</div>`}</section>
  <section class="panel"><div class="ph"><h2>ผลการแข่งขัน</h2></div>${done.length?`<div class="qlist">${done.map(m=>`<div class="qcard"><span class="ord small">${hm(m.endAt)}</span><div style="min-width:0">${matchMini(m,ps,roster)}<div class="small muted">คอร์ด ${esc(m.court)} · ${Math.round((m.endAt-m.startAt)/MIN)} นาที${m.score?" · "+esc(m.score):""} · ลูกใหม่ ${m.shuttles||0}${m.repair?` · ลูกซ่อม ${m.repair}`:""}${(m.subs||[]).some(x=>x.live)?` · เปลี่ยนตัว ${esc(m.subs.filter(x=>x.live).map(x=>nameOf(x.out)+"→"+nameOf(x.in)).join(", "))}`:""}</div>${DB.isOrg?`<button class="ghost sm" style="margin-top:6px;white-space:nowrap" data-act="editResult" data-id="${esc(m.id)}" aria-label="แก้ไขผลเกมและจำนวนลูก คอร์ด ${esc(m.court)}">แก้ไขผลเกม</button>`:""}</div><span class="chip ${resultCls(m)}">${esc(resultText(m))}</span></div>`).join("")}</div>`:`<div class="empty">ยังไม่มี</div>`}</section></div>
  ${DB.isOrg?`<section class="panel"><div class="ph"><h2>บันทึกเหตุการณ์ (Event log)</h2><span class="muted small">ทุกการ override / swap / อนุมัติ / ปรับยอด บันทึกพร้อมผู้ทำและเหตุผล</span></div>${S.log.length?`<div class="loglist">${S.log.slice().sort((a,b)=>b.at-a.at).map(l=>`<div><span class="num muted">${hm(l.at)}</span><span><b>${esc(l.action)}</b> ${esc(l.detail)} <span class="muted">— ${esc(l.by)}</span></span></div>`).join("")}</div>`:`<div class="empty">ยังไม่มีเหตุการณ์</div>`}</section>`:""}`;
  return h;
}

/* ---------- settings ---------- */
function vSettings(){
  const c=cfg();
  return `<section class="panel"><div class="ph"><h2>ตั้งค่าก๊วน</h2><span class="sp"></span><button class="primary" data-act="editCfg">แก้ไขการตั้งค่า</button></div>
  <div class="tw"><table class="kvtbl"><tbody>
    <tr><th>ชื่อก๊วน</th><td>${esc(c.group)}</td></tr>
    <tr><th>กฎพักขั้นต่ำหลังจบเกม</th><td><b>${c.restMin} นาที</b> — ระบบจับคู่อัตโนมัติจะไม่เลือกผู้เล่นที่ยังพักไม่ครบ</td></tr>
    <tr><th>เวลาเฉลี่ยต่อเกม</th><td>${c.avgMin} นาที (ใช้คำนวณเวลาที่คาดว่าจะได้ลง)</td></tr>
    <tr><th>จำนวนเซตต่อเกม</th><td><b>${setsOf(null)} เซต</b> — ชนะเซตเท่ากันนับเป็นเสมอ · ตั้งเฉพาะรอบได้ตอนสร้าง/แก้ไขรอบเล่น</td></tr>
    <tr><th>คะแนนต่อเซต</th><td><b>${ptsOf()} แต้ม</b> — นำ 2 แต้ม · ถ้า ${ptsOf()-1}-${ptsOf()-1} เล่นต่อจนนำ 2 แต้ม · สูงสุด ${PTS_CAP[ptsOf()]}-${PTS_CAP[ptsOf()]-1} (กติกา BWF) · ระบบไม่รับคะแนนที่เป็นไปไม่ได้</td></tr>
    <tr><th>คู่ล่วงหน้าต่อคอร์ด</th><td>${c.queueDepth} คู่</td></tr>
    <tr><th>จัดคู่ให้ฝีมือสมดุล</th><td>${c.balance?"เปิด":"ปิด"}</td></tr>
    <tr><th>อนุมัติคำขอคู่ที่ขอกันเองอัตโนมัติ</th><td>${c.autoMutual?"เปิด":"ปิด"}</td></tr>
    <tr><th>คนไม่มาตามนัด</th><td>${c.noShowMin?`ตัวจริงต้องเช็คอินภายใน <b>${c.noShowMin} นาที</b> หลังเวลาเริ่ม ไม่งั้นเสียสิทธิ์ให้ตัวสำรองที่มาถึงแล้ว${c.noShowFee?` · ค่าปรับ ${baht(c.noShowFee)} ฿`:""}`:"ปิดอยู่"}</td></tr>
    <tr><th>ผู้เล่นจ่าย</th><td>ค่าสนาม <b>${baht(c.playerCourtFee)} ฿/คน</b> + ค่าลูกใหม่ <b>${unit(c.shuttleFee)} ฿/ลูก</b> ${c.shuttleSplit==="shared"?"(หาร 4 คนในเกม)":"(ทุกคนในเกมจ่าย)"} · ลูกซ่อมไม่คิดเงิน · คนที่เริ่มเกมต้องจ่ายค่าลูกของเกมนั้นแม้บาดเจ็บ/ออกกลางเกม ส่วนคนที่เข้าแทนไม่ต้องจ่าย (ถือว่าช่วย)</td></tr>
    <tr><th>ต้นทุนผู้จัด</th><td>ค่าเช่าคอร์ดตั้งต้น ${baht(c.courtRent)} ฿/คอร์ด/ชม. · ทุนลูกใหม่ ${unit(c.shuttleCost)} ฿/ลูก · ลูกซ่อม ${unit(c.repairCost)} ฿/ลูก${!c.shuttleCost?' <span class="chip s-warn">ยังไม่ได้ตั้งราคาทุนลูก</span>':""}</td></tr>
    <tr><th>ลูกแบดในสต็อก</th><td>${(()=>{const inv=(S.inv&&S.inv.items)||[],n=inv.find(i=>i.shuttle),r=inv.find(i=>i.repair),lf=i=>i.total-i.used;
      return (n?`ลูกใหม่ <b>${lf(n)} ลูก</b>${lf(n)<=n.threshold?' <span class="chip s-warn">ใกล้หมด</span>':""}`:'<span class="chip s-warn">ยังไม่ได้ตั้งสต็อกลูกใหม่</span>')+" · "+(r?`ลูกซ่อม <b>${lf(r)} ลูก</b>`:"ลูกซ่อมยังไม่ได้ตั้งสต็อก")+` · แจ้งเตือนเมื่อลูกใหม่เหลือ ≤ ${n?n.threshold:12}`;})()}</td></tr>
    <tr><th>ลูกที่ใช้ต่อคอร์ดต่อชั่วโมง</th><td>${c.perCourtHour} ลูก · เผื่อ ${c.buffer}%</td></tr>

    <tr><th>ช่องทางชำระเงิน</th><td style="white-space:pre-wrap">${esc(c.payInfo||"–")}</td></tr>
  </tbody></table></div></section>
  ${DB.mode==="local"?`<section class="panel"><div class="ph"><h2>สำรองข้อมูล</h2></div>
    <p class="small" style="margin:0 0 10px">โหมดเครื่องเดียว เก็บข้อมูลไว้ในเบราว์เซอร์นี้ — ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะหาย <b>ควรดาวน์โหลดไฟล์สำรองเป็นระยะ</b></p>
    <div class="acts"><button class="primary" data-act="exportBackup">ดาวน์โหลดไฟล์สำรอง (.json)</button><button class="ghost" data-act="importBackup">กู้คืนจากไฟล์สำรอง</button></div></section>`:""}
  ${LIC.on?LIC.panel():""}
  ${DB.mode==="gh"?GHUI.settingsPanel():`<section class="panel"><h2>การใช้งานร่วมกับผู้เล่น</h2><ul class="small" style="margin:8px 0 0;padding-left:1.2em;display:grid;gap:4px">
    <li>แชร์ลิงก์หน้านี้ให้ผู้เล่นผ่านเมนู Share ของ claude.ai</li>
    <li>ผู้เล่นที่เป็นสมาชิกองค์กรเดียวกันและได้สิทธิ์ <b>Contributor</b> ลงชื่อ ส่งคำขอคู่ เช็คอิน อัปโหลดสลิป และโพสต์บอร์ดได้เอง</li>
    <li>ผู้เล่นภายนอกองค์กรจะ <b>ดูได้อย่างเดียว</b> (คิว เวลาที่คาดว่าได้ลง ผล) — ผู้จัดเพิ่มชื่อเป็น walk-in และบันทึกคำขอ/การชำระเงินแทน</li>
    <li>ผู้ช่วยผู้จัดที่ได้สิทธิ์ <b>Editor</b> ใช้เครื่องมือผู้จัดได้ทั้งหมด</li></ul></section>`}
  ${levelGuide()}`;
}
function levelGuide(){return `<section class="panel"><div class="ph"><h2>ระดับฝีมือ (BG → A)</h2><span class="muted small">ผู้เล่นเลือกเองตอนตั้งโปรไฟล์ · ผู้จัดแก้ได้ที่สมาชิกก๊วน</span></div>
  <div class="lvguide">${SKILL_KEYS.map(k=>`<div class="lv">${skillChip(k)}<div><b>${esc(SKILL[k].t)}</b><span>${esc(SKILL[k].d)}</span></div></div>`).join("")}</div></section>`;}

/* the same weekday as `iso`: a week later if that round is still ahead, otherwise the next such day from today */
function nextRoundDate(iso){
  const [y,m,d]=iso.split("-").map(Number),t=new Date(y,m-1,d),td=new Date(new Date().toDateString());
  if(t>=td)t.setDate(t.getDate()+7);else while(t<td)t.setDate(t.getDate()+7);
  return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;
}
function dlgSession(s){
  const isNew=!s;
  const last=isNew?S.sessions.filter(x=>x.date).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.createdAt||0)-(a.createdAt||0))[0]:null;
  s=s||(last?{date:nextRoundDate(last.date),start:last.start||"18:00",end:last.end||"21:00",courts:(last.courts||[]).filter(c=>!(last.courtMeta&&last.courtMeta[c]&&last.courtMeta[c].from)),maxPlayers:last.maxPlayers||16,title:last.title||"ก๊วนแบดประจำสัปดาห์",courtRent:last.courtRent!=null?last.courtRent:(cfg().courtRent||0),otherFee:last.otherFee||0,desc:last.desc||"",sets:last.sets,_from:last.title||"รอบก่อน"}
    :{date:today(),start:"18:00",end:"21:00",courts:["1","2"],maxPlayers:16,title:"ก๊วนแบดประจำสัปดาห์",courtRent:cfg().courtRent||0,otherFee:0});
  openDlg(`<form novalidate><h2>${isNew?"สร้างรอบเล่น / ประกาศรับสมัคร":"แก้ไขรอบเล่น"}</h2>${s._from?`<p class="small muted" style="margin:0 0 8px">ตั้งค่าเริ่มต้นตามรอบ "${esc(s._from)}" ล่าสุด (วันเดียวกันของสัปดาห์ถัดไป) — แก้ไขได้ก่อนสร้าง</p>`:""}<div class="fg">
    <label class="f full">ชื่อประกาศ<input name="title" maxlength="80" value="${esc(s.title)}" required><span class="ferr"></span></label>
    <label class="f">วันที่<input type="date" name="date" value="${esc(s.date)}" required><span class="ferr"></span></label>
    ${intIn("maxPlayers","รับผู้เล่นสูงสุด (คน)",s.maxPlayers,4,200)}
    ${intIn("sets","จำนวนเซตต่อเกม (เว้นว่าง = ค่าตั้งต้น "+setsOf(null)+")",s.sets||"",1,9,"ค่าตั้งต้น")}
    <label class="f">เวลาเริ่ม<input type="time" name="start" value="${esc(s.start)}" required></label>
    <label class="f">เวลาเลิก<input type="time" name="end" value="${esc(s.end)}" required><span class="ferr"></span></label>
    <div class="full round2box"><b>รอบที่ 2 (ไม่บังคับ)</b><p class="small muted" style="margin:2px 0 8px">คนที่ลงชื่อไม่ทันรอบแรกจะลงรอบที่ 2 ได้ — ระบบไม่สุ่มเขาเข้าเกมก่อนเวลานั้น แต่เช็คอินล่วงหน้าได้ และถ้ารอบแรกมีคนยกเลิก จะเลื่อนคนที่ขอไว้ขึ้นมาให้</p>
      <div class="fg"><label class="f">เริ่มรอบที่ 2 (เว้นว่าง = ไม่มีรอบ 2)<input type="time" name="round2Start" value="${esc(s.round2Start||"")}"><span class="ferr"></span></label>
      ${intIn("round2Max","รับเพิ่มรอบที่ 2 (คน)",s.round2Max||"",1,200,"เช่น 5")}</div></div>
    <label class="f full">ชื่อคอร์ด (คั่นด้วย ,)<input name="courts" value="${esc((s.courts||[]).join(", "))}" placeholder="เช่น 1, 2, 3"><span class="ferr"></span></label>
    ${intIn("courtRent","ค่าเช่าที่ผู้จัดจ่าย (฿/คอร์ด/ชั่วโมง)",s.courtRent!=null?s.courtRent:(cfg().courtRent||0),0,100000)}
    ${intIn("otherFee","ค่าใช้จ่ายอื่นของผู้จัด (฿)",s.otherFee||0,0,1000000)}
    <p class="small muted full" style="margin:0" id="rentPrev"></p>
    <label class="f full">รายละเอียดประกาศ<textarea name="desc" maxlength="1000" placeholder="สถานที่ กติกา สิ่งที่ต้องเตรียม">${esc(s.desc||"")}</textarea></label>
  </div><div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">${isNew?"สร้างและประกาศ":"บันทึก"}</button></div></form>`,async f=>{
    const title=fv(f,"title");if(!title)return fieldErr(f,"title","กรุณากรอกชื่อ");
    if(!fv(f,"date"))return fieldErr(f,"date","กรุณาเลือกวันที่");
    const mp=checkInt(f,"maxPlayers",true);if(mp===false)return false;
    if(toMin(fv(f,"end"))===toMin(fv(f,"start")))return fieldErr(f,"end","เวลาเลิกต้องไม่ตรงกับเวลาเริ่ม (ถ้าเลยเที่ยงคืน ใส่เวลาเลิกของวันถัดไปได้เลย)");
    const r2=fv(f,"round2Start");let r2m=null;
    if(r2){const rel=m=>((toMin(m)-toMin(fv(f,"start")))%1440+1440)%1440,span=rel(fv(f,"end"))||1440;
      if(!rel(r2)||rel(r2)>=span)return fieldErr(f,"round2Start","เวลารอบที่ 2 ต้องอยู่หลังเวลาเริ่มและก่อนเวลาเลิก");
      r2m=checkInt(f,"round2Max");if(r2m===false)return false;}
    const courts=fv(f,"courts").split(/[,，]/).map(x=>x.trim()).filter(Boolean);
    if(!courts.length)return fieldErr(f,"courts","ต้องมีอย่างน้อย 1 คอร์ด");
    if(new Set(courts).size!==courts.length)return fieldErr(f,"courts","ชื่อคอร์ดซ้ำกัน");
    const cr=checkInt(f,"courtRent",true);if(cr===false)return false;const of=checkInt(f,"otherFee");if(of===false)return false;
    const sets=checkInt(f,"sets");if(sets===false)return false;
    const id=isNew?uid("s"):s.id;
    if(!isNew){const gone=(s.courts||[]).filter(c=>!courts.includes(c));
      if(gone.some(c=>S.matches.some(m=>(m.status==="playing"||m.status==="queued")&&m.court===c)))return fieldErr(f,"courts","คอร์ดที่เอาออกยังมีเกมเล่นอยู่หรือมีคู่ในคิว — จบเกม/ยกเลิกคู่ก่อน");}
    // courts that already had an "added at" time keep it; a court typed in here after the session has started is rented only from now
    const meta={};courts.forEach(c=>{if(s.courtMeta&&s.courtMeta[c])meta[c]=s.courtMeta[c];else if(!isNew&&(s.courts||[]).length&&!(s.courts||[]).includes(c)&&now()>=sessStartEpoch({date:fv(f,"date"),start:fv(f,"start")}))meta[c]={from:hm(now()),addedAt:now()};});
    const data={...(isNew?{createdAt:now(),status:"open"}:s),title,date:fv(f,"date"),start:fv(f,"start"),end:fv(f,"end"),courts,maxPlayers:mp,courtRent:cr,otherFee:of||0,desc:fv(f,"desc"),sets:sets||null,courtMeta:meta,round2Start:r2||null,round2Max:r2&&r2m?r2m:null};
    delete data.id;delete data.courtFee;if(!data.sets)delete data.sets;if(!data.round2Start){delete data.round2Start;delete data.round2Max;}else if(!data.round2Max)delete data.round2Max;if(!Object.keys(meta).length)delete data.courtMeta;
    const ok=await write(`sessions/${id}`,data,isNew?"สร้างรอบเล่นแล้ว":"บันทึกแล้ว");
    if(ok&&isNew){selectSession(id);}
    return ok;
  });
  rentCtx={meta:s.courtMeta||{}};rentPreview();["courtRent","courts","start","end"].forEach(n=>{const el=$("#dlg [name="+n+"]");if(el)el.addEventListener("input",rentPreview);});
}
let rentCtx={meta:{}};
function rentPreview(){
  const f=$("#dlg form");const el=$("#rentPrev");if(!f||!el)return;
  const names=fv(f,"courts").split(/[,，]/).map(x=>x.trim()).filter(Boolean);
  const fake={start:fv(f,"start"),end:fv(f,"end"),courtMeta:rentCtx.meta,courts:names};
  const h=sessHours(fake),ch=courtHours(fake),r=+fv(f,"courtRent")||0;
  const tot=ch*r;const fee=+cfg().playerCourtFee||0,same=Math.abs(ch-names.length*h)<0.01;
  el.innerHTML=`ค่าเช่าคอร์ดรวม = ${same?`${names.length} คอร์ด × ${h.toFixed(1)} ชม.`:`${names.length} คอร์ด (บางคอร์ดเพิ่มระหว่างเล่น) รวม ${Math.round(ch*100)/100} ชม.-คอร์ด`} × ${baht(r)} ฿ = <b>${baht(tot)} ฿</b>${fee?` · ต้องมีผู้เล่นอย่างน้อย <b>${Math.ceil(tot/fee)}</b> คน (คนละ ${baht(fee)} ฿) จึงคุ้มค่าเช่า`:""}`;
}
/* add a court while the session is running: rent counts only from the time it opens */
function dlgAddCourt(){
  const s=curSession();if(!s||s.status==="closed")return;
  const names=s.courts||[];let k=names.filter(n=>/^\d+$/.test(n)).map(Number);k=k.length?Math.max(...k)+1:names.length+1;while(names.includes(String(k)))k++;
  openDlg(`<form novalidate><h2>เพิ่มคอร์ด</h2><div class="fg">
    <label class="f">ชื่อคอร์ด<input name="cname" maxlength="20" value="${k}" required><span class="ferr"></span></label>
    <label class="f">เริ่มใช้/คิดค่าเช่าตั้งแต่<input type="time" name="from" value="${hm(now())}" required><span class="ferr"></span></label>
    <p class="small muted full" style="margin:0" id="addPrev"></p>
    <label class="check full"><input type="checkbox" name="auto" checked> จัดคู่ลงคอร์ดใหม่ทันที (ถ้ามีผู้เล่นพร้อม)</label></div>
    <p class="small muted" style="margin:0">เกมที่กำลังเล่นอยู่ไม่ถูกกระทบ</p>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">เพิ่มคอร์ด</button></div></form>`,async f=>{
    const name=fv(f,"cname");if(!name)return fieldErr(f,"cname","กรุณากรอกชื่อคอร์ด");
    if(/[,，]/.test(name))return fieldErr(f,"cname","ชื่อคอร์ดห้ามมีเครื่องหมายจุลภาค");
    if(names.includes(name))return fieldErr(f,"cname","มีคอร์ดชื่อนี้แล้ว");
    const from=fv(f,"from");if(!from)return fieldErr(f,"from","กรุณาเลือกเวลา");
    const live=curSession();if(!live||live.status==="closed"){toast("รอบเล่นนี้ปิดแล้ว");return true;}
    if((live.courts||[]).includes(name))return fieldErr(f,"cname","มีคอร์ดชื่อนี้แล้ว");
    const ok=await write(`sessions/${live.id}`,{...stripId(live),courts:[...(live.courts||[]),name],courtMeta:{...(live.courtMeta||{}),[name]:{from,addedAt:now()}}},`เพิ่มคอร์ด ${name} แล้ว`);
    if(ok){logEv("เพิ่มคอร์ด",`คอร์ด ${name} เริ่ม ${from}`);if(f.elements.auto.checked)setTimeout(()=>autoMatch(true),700);}
    return ok;
  });
  const f=$("#dlg form"),upd=()=>{const el=$("#addPrev");if(!el)return;const from=fv(f,"from");
    if(!from){el.textContent="";return;}const h=courtHoursOf({...s,courtMeta:{__n:{from}}},"__n"),r=+s.courtRent||0;
    el.innerHTML=r?`ค่าเช่าที่เพิ่ม ≈ <b>${baht(Math.round(h*r))} ฿</b> (${Math.round(h*100)/100} ชม. × ${baht(r)} ฿ จนถึง ${esc(s.end)})`:`คอร์ดนี้ใช้ ${Math.round(h*100)/100} ชม. จนถึง ${esc(s.end)} — ยังไม่ได้ตั้งค่าเช่า (แก้ที่ "แก้ต้นทุน")`;};
  f.addEventListener("input",upd);upd();
}
function dlgWalkin(p){
  const isNew=!p;p=p||{name:"",skill:"L2"};
  openDlg(`<form novalidate><h2>${isNew?"เพิ่มผู้เล่น (walk-in)":"แก้ไขผู้เล่น"}</h2><div class="fg">
    <label class="f full">ชื่อ<input name="name" maxlength="30" value="${esc(p.name)}" required><span class="ferr"></span></label>
    <label class="f">ระดับฝีมือ<select name="skill">${SKILL_KEYS.map(k=>`<option value="${k}" ${sk(p.skill)===k?"selected":""}>${esc(skLabel(k))}</option>`).join("")}</select><span class="small muted">ดูคำอธิบายแต่ละระดับในแท็บตั้งค่า</span></label>
    ${isNew?`<label class="f">เช็คอินทันที<select name="ci"><option value="1">ใช่ (อยู่ที่สนามแล้ว)</option><option value="">ยัง</option></select></label>
    <label class="f full">บันทึกเป็นสมาชิกก๊วนด้วย<select name="asMember"><option value="1">ใช่ — ครั้งหน้าเลือกจากรายชื่อได้เลย</option><option value="">ไม่ (ขาจรครั้งเดียว)</option></select></label>`:""}
  </div><div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const name=fv(f,"name");if(name.length<2)return fieldErr(f,"name","ชื่ออย่างน้อย 2 ตัวอักษร");
    const s=curSession();
    if(isNew&&rosterModel().some(x=>x.name===name&&x.status!=="removed"))return fieldErr(f,"name","มีชื่อนี้ในรายชื่อแล้ว");
    const asMember=isNew&&!!fv(f,"asMember");
    if(asMember&&S.members.some(x=>(x.name||"").toLowerCase()===name.toLowerCase()))return fieldErr(f,"name","มีสมาชิกชื่อนี้แล้ว — ใช้ปุ่ม \"เพิ่มจากสมาชิกก๊วน\"");
    const id=isNew?uid(asMember?"mb":"w"):p.id;const ex=S.roster.find(r=>r.id===id)||{};
    if(asMember){if(!await write(`members/${id}`,{name,skill:sk(fv(f,"skill")),phone:"",note:"",createdAt:now()}))return false;}
    const data={...stripId(ex),name,skill:sk(fv(f,"skill")),walkin:isNew?true:!!ex.walkin||!!p.walkin};if(asMember)data.memberId=id;
    if(isNew){data.addedAt=now();if(fv(f,"ci"))data.checkedInAt=now();}
    const ok=await write(`sessions/${s.id}/roster/${id}`,data,isNew?"เพิ่มผู้เล่นแล้ว":"บันทึกแล้ว");
    if(ok)logEv(isNew?"เพิ่มผู้เล่น":"แก้ไขผู้เล่น",name);return ok;
  });
}
/* take shuttles out of stock (new / repaired); warns when the count goes below zero */
function deductStock(sh,rpr){
  const inv=(S.inv&&S.inv.items)||[];sh=+sh||0;rpr=+rpr||0;if(!sh&&!rpr)return;   // a negative number puts shuttles back (result corrected)
  const items=inv.map(i=>i.shuttle&&sh?{...i,used:Math.max(0,i.used+sh)}:i.repair&&rpr?{...i,used:Math.max(0,i.used+rpr)}:i);
  if(!items.some((x,k)=>x!==inv[k]))return;
  write("inventory/main",{...(S.inv||{}),items});
  const short=items.filter(i=>(i.shuttle||i.repair)&&i.used>i.total);
  if(short.length)setTimeout(()=>toast(`สต็อก${short.map(i=>i.name).join(", ")}ติดลบ — ตรวจนับและเติมสต็อกในหน้าตั้งค่า`),3000);
}
/* ---------- close the round ---------- */
function dlgClose(){
  const s=curSession();if(!s||s.status==="closed")return;
  const playing=S.matches.filter(m=>m.status==="playing"),queued=S.matches.filter(m=>m.status==="queued");
  const present=rosterModel().filter(p=>p.status==="confirmed"&&p.checkedIn&&!p.checkedOutAt);
  const pm=payModel(),P=pm.pnl,unpaid=pm.rows.filter(r=>r.owe>0),owed=unpaid.reduce((a,r)=>a+r.owe,0);
  const end=sessEndEpoch(s),left=end?end-now():0;
  const timeLine=!end?"":left>0?`<span class="chip s-warn">ยังไม่ครบเวลาจอง ${esc(s.end)} น. (อีก ${Math.ceil(left/MIN)} นาที)</span>`:`<span class="chip s-ready">ครบเวลาจอง ${esc(s.end)} น. แล้ว</span>`;
  const sign=n=>`${n<0?"−":n>0?"+":""}${baht(Math.abs(n))}`;
  openDlg(`<form novalidate><h2>ปิดรอบเล่น</h2>
    <div style="display:grid;gap:6px"><b>${esc(s.title||"รอบเล่น")}</b><span class="small muted">${esc(fmtD(s.date))} · ${esc(s.start||"")}–${esc(s.end||"")}</span>${timeLine}</div>
    ${playing.length?`<div class="notice warn"><b>ยังมีเกมเล่นอยู่ ${playing.length} คอร์ด</b> (คอร์ด ${esc(playing.map(m=>m.court).join(", "))})
      <label class="f" style="margin-top:8px;color:inherit">จัดการเกมที่ค้าง<select name="playing"><option value="finish">จบเกม (ไม่บันทึกผล) · คิดค่าลูก</option><option value="cancel">ยกเลิกเกม · ไม่คิดค่าลูก</option></select></label>
      <div class="fg" style="margin-top:8px">${intIn("shuttles","ลูกใหม่ที่ใช้ต่อเกมที่ค้าง (ถ้าเลือกจบเกม)",1,0,30)}</div>
      <span class="small">อยากบันทึกผลแพ้ชนะ? กด "ยังไม่ปิด" แล้วใช้ปุ่ม "จบเกม / บันทึกผล" ที่การ์ดคอร์ดก่อน</span></div>`:""}
    <ul class="small" style="margin:0;padding-left:1.2em;display:grid;gap:4px">
      ${queued.length?`<li>คู่ที่รอในคิว ${queued.length} คู่ — จะถูกยกเลิก</li>`:""}
      ${present.length?`<li>ผู้เล่นที่ยังไม่เช็คเอาท์ ${present.length} คน — ระบบเช็คเอาท์ให้ทั้งหมด</li>`:""}
      <li>ยังไม่จ่าย ${unpaid.length} คน รวม <b>${baht(owed)} ฿</b> — จะเข้าลิสต์ “ยอดค้างจ่ายสะสม” (แท็บค่าใช้จ่าย) ปิดรอบแล้วยังรับเงิน/ตรวจสลิปต่อได้</li>
      <li>สรุปตอนนี้${playing.length?" (ยังไม่รวมเกมที่ค้าง)":""}: รายรับ ${baht(P.revenue)} − ต้นทุน ${baht(P.cost)} = <b>${sign(P.profit)} ฿</b></li>
      <li>ราคาของรอบนี้ถูกล็อกที่ราคาตอนปิด (เปลี่ยนราคาทีหลังไม่กระทบบิลรอบนี้) · เปิดรอบอีกครั้งได้ถ้าต้องแก้</li>
    </ul>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยังไม่ปิด</button><button type="submit" class="primary">ปิดรอบเล่น</button></div></form>`,async f=>{
    const live=curSession();if(!live||live.status==="closed"){toast("รอบนี้ปิดไปแล้ว");return true;}
    const mode=f.elements.playing?fv(f,"playing"):"";let sh=0;
    if(f.elements.shuttles){sh=checkInt(f,"shuttles",true);if(sh===false)return false;}
    const N=setsOf(live),t=now();
    for(const m of S.matches.filter(x=>x.status==="playing")){
      const path=`sessions/${live.id}/matches/${m.id}`;
      if(mode==="cancel"){if(!await write(path,{...stripId(m),status:"cancelled",cancelledAt:t}))return false;}
      else{const x=matchShuttles(m),shN=m.free?0:(x.explicit?x.sh:sh),rpN=x.explicit?x.rp:0;
        if(!await write(path,{...stripId(m),status:"done",endAt:t,winner:"",sets:Array.from({length:N},()=>({w:"",s:""})),nsets:N,setsA:0,setsB:0,score:"",shuttles:shN,repair:rpN,closedWithRound:true}))return false;
        deductStock(shN,rpN);}
    }
    for(const m of S.matches.filter(x=>x.status==="queued")){
      if(!await write(`sessions/${live.id}/matches/${m.id}`,{...stripId(m),status:"cancelled",cancelledAt:t}))return false;
      for(const d of S.decisions.filter(x=>x.fulfilled===m.id)){const o2={...stripId(d)};delete o2.fulfilled;await write(`sessions/${live.id}/decisions/${d.id}`,o2);}
    }
    for(const p of rosterModel().filter(p=>p.status==="confirmed"&&p.checkedIn&&!p.checkedOutAt))await rosterPatch(p.id,{checkedOutAt:t});
    const ok=await write(`sessions/${live.id}`,{...stripId(live),status:"closed",closedAt:t,priceSnap:priceSnapNow()},"ปิดรอบแล้ว — ตรวจยอดเงินได้ที่แท็บค่าใช้จ่าย");
    if(ok){refreshSummary();logEv("ปิดรอบ",`${playing.length?`เกมที่ค้าง ${playing.length} (${mode==="cancel"?"ยกเลิก":"จบไม่บันทึกผล"}) · `:""}ค้างจ่าย ${unpaid.length} คน ${baht(owed)} ฿`);tab="money";try{localStorage.setItem(uiKey("bgo-tab"),tab);}catch(_){}render();}
    return ok;
  });
}
function dlgEnd(m,edit){
  const inv=(S.inv&&S.inv.items)||[],N=edit?((m.sets&&m.sets.length)||m.nsets||setsOf(curSession())):(+m.setsN>0?+m.setsN:setsOf(curSession())),X=matchShuttles(m);
  const L=esc(m.a.map(nameOf).join(" + ")),R=esc(m.b.map(nameOf).join(" + "));
  const rows=Array.from({length:N},(_,i)=>`<div class="setrow"><span class="sn">เซต ${i+1}</span>
      <select name="sw${i}" aria-label="ผลเซต ${i+1}"><option value="">—</option><option value="a">ซ้ายชนะ</option><option value="b">ขวาชนะ</option><option value="d">เสมอ</option></select>
      <input name="ss${i}" maxlength="14" placeholder="คะแนน ${ptsOf()}-18" autocomplete="off" aria-label="คะแนนเซต ${i+1}"><span class="ferr"></span></div>`).join("");
  const starters=matchStarters(m),payers=starters.map(nameOf).join(", ");
  openDlg(`<form novalidate><h2>${edit?"แก้ไขผลเกม":"จบเกม"} · คอร์ด ${esc(m.court)}</h2>
    <div class="vsline"><span class="ta">ซ้าย: ${L}</span><span class="tb">ขวา: ${R}</span></div>
    <div class="sets" data-n="${N}">${rows}</div>
    <div class="notice" id="resSum" role="status" style="margin:10px 0 4px"></div>
    ${m.free?`<div class="notice" style="margin:0 0 8px"><b>เกมฟรี (ลูกซ่อม)</b> — ไม่คิดค่าลูกของผู้เล่น${m.setsN?` · ${m.setsN} เซต`:""}</div>`:""}
    <div class="fg">${intIn("shuttles","ลูกใหม่ที่ใช้ (คิดเงิน)",m.free?0:(edit?(m.shuttles||0):X.sh),0,30)}${intIn("repair","ลูกซ่อมที่ใช้ (ไม่คิดเงิน)",edit?(m.repair||0):X.rp,0,30)}</div>
    <p class="small muted" style="margin:0">ใส่แค่ผู้ชนะของแต่ละเซต หรือใส่แค่คะแนน (ระบบดูผู้ชนะให้) · ชนะเซตเท่ากัน = เสมอ · ไม่ใส่เลย = ไม่บันทึกผล<br>คะแนนตามกติกา BWF: ถึง ${ptsOf()} แต้มและนำ 2 แต้ม · ถ้า ${ptsOf()-1}-${ptsOf()-1} เล่นต่อจนนำ 2 แต้ม · สูงสุด ${PTS_CAP[ptsOf()]} (${PTS_CAP[ptsOf()]}-${PTS_CAP[ptsOf()]-1}) · เล่นไม่จบ → เว้นคะแนนว่าง เลือกแค่ผู้ชนะ<br>${edit?"แก้ไขแล้วบิลของผู้เล่นและสต็อกลูกจะปรับตามอัตโนมัติ · เวลาพักไม่เปลี่ยน":`ผู้เล่นเริ่มพัก ${cfg().restMin} นาทีนับจากตอนนี้${inv.some(i=>i.shuttle||i.repair)?" · หักจากสต็อกอัตโนมัติ":""}`}${m.free?"":` · ค่าลูกใหม่ลูกละ ${unit(cfg().shuttleFee)} ฿${cfg().shuttleSplit==="shared"?" หาร 4":" ต่อคน"} — ผู้จ่าย: <b>${esc(payers)}</b>${m.orig?" (คนที่เริ่มเกม รวมคนที่ออกกลางเกม · คนที่เข้าแทนไม่จ่าย)":""}`}</p>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">${edit?"บันทึกการแก้ไข":"บันทึกผล"}</button></div></form>`,async f=>{
    let sh=checkInt(f,"shuttles",true);if(sh===false)return false;const rpr=checkInt(f,"repair",true);if(rpr===false)return false;
    if(m.free)sh=0;   // a free game uses repaired shuttles only
    if(sh+rpr>5&&f.dataset.okShuttles!==String(sh+"/"+rpr)){f.dataset.okShuttles=sh+"/"+rpr;return fieldErr(f,"shuttles",`ใช้ ${sh} ลูกใหม่ + ${rpr} ลูกซ่อมในเกมเดียว — ถูกต้องไหม? กด "${edit?"บันทึกการแก้ไข":"บันทึกผล"}" อีกครั้งเพื่อยืนยัน`);}
    const sets=readSets(f,N);if(!sets)return false;
    const live=S.matches.find(x=>x.id===m.id);if(!live||live.status!==(edit?"done":"playing")){toast(edit?"เกมนี้ไม่อยู่ในสถานะจบแล้ว":"เกมนี้ถูกบันทึกหรือยกเลิกไปแล้ว");return true;}
    m=live;const inv=(S.inv&&S.inv.items)||[],R=setsResult(sets);
    const s=curSession();
    if(edit){
      const was=resultText(m),oldSh=+m.shuttles||0,oldRp=+m.repair||0;
      const nd={...stripId(m),winner:R.winner,sets,nsets:N,setsA:R.a,setsB:R.b,score:sets.map(x=>x.s).filter(Boolean).join(", "),shuttles:sh,repair:rpr};delete nd.closedWithRound;
      const ok=await write(`sessions/${s.id}/matches/${m.id}`,nd,"แก้ไขผลเกมแล้ว — บิลและสต็อกปรับตามแล้ว");
      if(ok){deductStock(sh-oldSh,rpr-oldRp);
        logEv("แก้ไขผลเกม",`คอร์ด ${m.court}: ${m.a.map(nameOf).join("+")} vs ${m.b.map(nameOf).join("+")} · ผล ${was} → ${resultText(nd)} · ลูกใหม่ ${oldSh} → ${sh}${oldRp!==rpr?` · ลูกซ่อม ${oldRp} → ${rpr}`:""}`);
        if(s.status==="closed")refreshSummary();}
      return ok;}
    const data={...stripId(m),status:"done",endAt:now(),winner:R.winner,sets,nsets:N,setsA:R.a,setsB:R.b,score:sets.map(x=>x.s).filter(Boolean).join(", "),shuttles:sh,repair:rpr};
    const ok=await write(`sessions/${s.id}/matches/${m.id}`,data,"บันทึกผลแล้ว — ผู้เล่นเริ่มพัก");
    if(ok){deductStock(sh,rpr);
      logEv("จบเกม",`คอร์ด ${m.court}: ${m.a.map(nameOf).join("+")} vs ${m.b.map(nameOf).join("+")} (${resultText(data)}${data.score?" · "+data.score:""})`);
      if(cfg().autoAfterEnd!==false)setTimeout(()=>autoMatch(true),700);}
    return ok;
  });
  const f=$("#dlg form"),sum=$("#resSum"),upd=()=>{const sets=[];for(let i=0;i<N;i++){const sc=parseScore(fv(f,"ss"+i));let w=fv(f,"sw"+i);if(!w&&sc&&sc[0]!==sc[1])w=sc[0]>sc[1]?"a":"b";sets.push({w});}
    const r=setsResult(sets);sum.className="notice"+(r.winner==="draw"?" warn":"");
    sum.innerHTML=!r.n?"ผลเกม: <b>ไม่บันทึกผล</b>":r.winner==="draw"?`ผลเกม: <b>เสมอ</b>${r.a||r.b?` (${r.a}–${r.b})`:""}`:`ผลเกม: <b>${r.winner==="a"?"ฝั่งซ้ายชนะ":"ฝั่งขวาชนะ"}</b> (${r.a}–${r.b})`;};
  if(edit)(m.sets||[]).forEach((x,i)=>{if(f.elements["sw"+i])f.elements["sw"+i].value=x.w||"";if(f.elements["ss"+i])f.elements["ss"+i].value=x.s||"";});
  f.addEventListener("input",upd);f.addEventListener("change",upd);upd();
  /* tell the organizer right away (when they leave the box) if a set score is not a possible final score */
  f.addEventListener("change",e=>{const el=e.target;if(!el||!/^ss\d+$/.test(el.name||""))return;const t=el.value.trim(),sc=parseScore(t),box=el.parentElement.querySelector(".ferr");let msg="";
    if(t&&!sc)msg=`ใส่คะแนนแบบ ${ptsOf()}-18`;else if(sc){const v=checkSetScore(sc[0],sc[1]);if(!v.ok)msg=v.msg;}
    if(box)box.textContent=msg;el.classList.toggle("bad",!!msg);});
}
const parseScore=t=>{const x=/^\s*(\d{1,3})\s*[-–:]\s*(\d{1,3})\s*$/.exec(t||"");return x?[+x[1],+x[2]]:null;};
/* read the set rows; a score like 21-18 decides an empty set, and must agree with a chosen winner */
function readSets(f,N){const out=[];
  for(let i=0;i<N;i++){const t=fv(f,"ss"+i),sc=parseScore(t);let w=fv(f,"sw"+i);
    if(t&&!sc)return fieldErr(f,"ss"+i,`ใส่คะแนนแบบ ${ptsOf()}-18`);
    if(sc&&w==="d")return fieldErr(f,"ss"+i,"เซตเสมอไม่มีคะแนน — เว้นช่องคะแนนว่าง หรือเปลี่ยนผลเซตเป็นฝั่งที่ชนะ");
    if(sc){const v=checkSetScore(sc[0],sc[1]);if(!v.ok)return fieldErr(f,"ss"+i,v.msg);
      const sw=sc[0]>sc[1]?"a":"b";if(!w)w=sw;else if(w!==sw)return fieldErr(f,"ss"+i,"คะแนนไม่ตรงกับผู้ชนะของเซต");}
    out.push({w,s:sc?`${sc[0]}-${sc[1]}`:""});}
  return out;}
function dlgSwap(m){
  const roster=rosterModel(),ps=playerStats(),t=now(),running=m.status==="playing";
  const cands=roster.filter(p=>p.status==="confirmed"&&p.checkedIn&&!p.notYet&&!ps.get(p.id).inMatch);
  openDlg(`<form novalidate><h2>เปลี่ยนตัวผู้เล่น · คอร์ด ${esc(m.court)}</h2><div class="fg">
    <label class="f">ผู้เล่นที่ออก<select name="out">${[...m.a,...m.b].map(id=>`<option value="${esc(id)}">${esc(nameOf(id))}</option>`).join("")}</select></label>
    <label class="f">ผู้เล่นที่เข้า<select name="in"><option value="">— เลือก —</option>${cands.map(p=>{const st=statusOf(p,ps,t);return `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(st.t)}</option>`;}).join("")}</select><span class="ferr"></span></label>
    <label class="f full">เหตุผล (จำเป็น)<input name="reason" maxlength="120" placeholder="เช่น บาดเจ็บ, ขอกลับก่อน"><span class="ferr"></span></label>
    ${running?`<label class="f full">หลังออกจากเกมนี้<select name="leave"><option value="">พักตามกฎ แล้วกลับมาลงเล่นได้</option><option value="checkout">เช็คเอาท์ (บาดเจ็บ/กลับบ้าน)</option></select></label>`:""}</div>
    ${running?`<div class="notice small" id="swapNote" style="margin:10px 0 0"></div>`:`<p class="small muted" style="margin:0">คู่นี้ยังไม่เริ่ม — เปลี่ยนตัวได้เลยโดยไม่มีผลกับค่าลูก</p>`}
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">เปลี่ยนตัว</button></div></form>`,async f=>{
    const out=fv(f,"out"),inn=fv(f,"in"),reason=fv(f,"reason");
    if(!inn)return fieldErr(f,"in","เลือกผู้เล่นที่เข้า");if(reason.length<3)return fieldErr(f,"reason","ระบุเหตุผล");
    const x=ps.get(inn);if(x.restUntil>now()&&!f.dataset.force){f.dataset.force="1";return fieldErr(f,"in",`${nameOf(inn)} ยังพักไม่ครบ (อีก ${mmss(x.restUntil-now())}) — กดเปลี่ยนตัวอีกครั้งเพื่อยืนยัน override`);}
    const live=S.matches.find(x=>x.id===m.id);if(!live||(live.status!=="playing"&&live.status!=="queued")){toast("แมตช์นี้จบหรือถูกยกเลิกไปแล้ว");return true;}
    m=live;if(![...m.a,...m.b].includes(out))return fieldErr(f,"in","ผู้เล่นที่ออกไม่ได้อยู่ในแมตช์นี้แล้ว");
    if(playerStats().get(inn).inMatch)return fieldErr(f,"in",`${nameOf(inn)} ถูกจัดลงแมตช์อื่นไปแล้ว`);
    const s=curSession();const rep=a=>a.map(id=>id===out?inn:id),mid=m.status==="playing";
    // mid-game: remember the four who started — they stay responsible for this game's shuttles; the substitute only helps
    const subs=[...(m.subs||[]),{at:now(),out,in:inn,reason,by:DB.meName||"ผู้จัด",...(mid?{live:true}:{})}];
    const data={...stripId(m),a:rep(m.a),b:rep(m.b),subs};if(mid&&!m.orig)data.orig={a:[...m.a],b:[...m.b]};
    const ok=await write(`sessions/${s.id}/matches/${m.id}`,data,"เปลี่ยนตัวแล้ว");
    if(ok){if(mid&&fv(f,"leave")==="checkout"&&!matchOnCourt(data).includes(out))await rosterPatch(out,{checkedOutAt:now()});
      logEv(x.restUntil>now()?"เปลี่ยนตัว (override กฎพัก)":"เปลี่ยนตัว",`คอร์ด ${m.court}: ${nameOf(out)} → ${nameOf(inn)} · ${reason}${mid?` · ${nameOf(out)} ยังจ่ายค่าลูกเกมนี้, ${nameOf(inn)} ช่วยแทน ไม่จ่ายค่าลูก`:""}`);}
    return ok;
  });
  if(running){const f=$("#dlg form"),n=$("#swapNote"),upd=()=>{const out=fv(f,"out"),inn=fv(f,"in"),st=new Set(matchStarters(m));const outPays=st.has(out);
      n.innerHTML=`${esc(nameOf(out))} ${outPays?"<b>ยังจ่ายค่าลูก</b>ของเกมนี้ (เริ่มเกมแล้ว)":"ไม่ต้องจ่ายค่าลูกเกมนี้ (เป็นตัวแทน)"} · ${inn?esc(nameOf(inn)):"ผู้เล่นที่เข้า"} <b>ไม่ต้องจ่ายค่าลูก</b>ของเกมนี้ (ถือว่าช่วยแทน)`;};
    f.addEventListener("change",upd);upd();}
}
function dlgManual(){
  const s=curSession();const roster=rosterModel(),ps=playerStats(),t=now();
  const cands=roster.filter(p=>p.status==="confirmed"&&p.checkedIn&&!p.notYet&&!ps.get(p.id).inMatch);
  const opt=cands.map(p=>{const st=statusOf(p,ps,t);return `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(st.t)}</option>`;}).join("");
  const sel=n=>`<select name="${n}"><option value="">—</option>${opt}</select>`;
  openDlg(`<form novalidate><h2>จัดคู่เอง</h2><div class="fg">
    <label class="f full">คอร์ด<select name="court">${(s.courts||[]).map(c=>`<option>${esc(c)}</option>`).join("")}</select></label>
    <label class="f" style="color:var(--a-team)">ทีมซ้าย คนที่ 1${sel("a1")}</label><label class="f" style="color:var(--a-team)">ทีมซ้าย คนที่ 2${sel("a2")}</label>
    <label class="f" style="color:var(--b-team)">ทีมขวา คนที่ 1${sel("b1")}</label><label class="f" style="color:var(--b-team)">ทีมขวา คนที่ 2${sel("b2")}<span class="ferr"></span></label>
    <label class="f full">เหตุผล (จำเป็นถ้ามีคนพักไม่ครบ)<input name="reason" maxlength="120"><span class="ferr"></span></label></div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">เพิ่มเข้าคิว</button></div></form>`,async f=>{
    const ids=["a1","a2","b1","b2"].map(n=>fv(f,n));
    if(ids.some(x=>!x))return fieldErr(f,"b2","เลือกให้ครบ 4 คน");
    if(new Set(ids).size!==4)return fieldErr(f,"b2","เลือกผู้เล่นซ้ำ");
    const busy=ids.filter(id=>playerStats().get(id).inMatch);if(busy.length)return fieldErr(f,"b2",`${busy.map(nameOf).join(", ")} ถูกจัดลงแมตช์อื่นไปแล้ว`);
    const resting=ids.filter(id=>ps.get(id).restUntil>now());
    const reason=fv(f,"reason");
    if(resting.length&&reason.length<3)return fieldErr(f,"reason",`${resting.map(nameOf).join(", ")} ยังพักไม่ครบ ${cfg().restMin} นาที — ระบุเหตุผลเพื่อ override`);
    const id=uid("m");
    const ok=await write(`sessions/${s.id}/matches/${id}`,{court:fv(f,"court"),a:ids.slice(0,2),b:ids.slice(2),status:"queued",createdAt:now(),via:"manual",reqIds:[],override:resting.length?reason:""},"เพิ่มคู่เข้าคิวแล้ว");
    if(ok)logEv(resting.length?"จัดคู่เอง (override กฎพัก)":"จัดคู่เอง",`คอร์ด ${fv(f,"court")}: ${ids.map(nameOf).join(", ")}${reason?" · "+reason:""}`);return ok;
  });
}
function dlgCfg(){
  const c=cfg();
  const inv0=(S.inv&&S.inv.items)||[],NEW=inv0.find(i=>i.shuttle)||null,REP=inv0.find(i=>i.repair)||null;
  const stockLeft=it=>it?Math.max(0,it.total-it.used):"";
  openDlg(`<form novalidate><h2>ตั้งค่าก๊วน</h2><div class="fg">
    <label class="f full">ชื่อก๊วน<input name="group" maxlength="60" value="${esc(c.group)}"></label>
    ${intIn("restMin","กฎพักขั้นต่ำ (นาที)",c.restMin,0,60)}${intIn("avgMin","เวลาเฉลี่ยต่อเกม (นาที)",c.avgMin,5,60)}
    ${intIn("setsPerGame","จำนวนเซตต่อเกม (ค่าตั้งต้น)",setsOf(null),1,9)}
    <label class="f">คะแนนต่อเซต (กติกาสากล)<select name="pointsToWin">${Object.entries(PTS_CAP).sort((a,b)=>b[0]-a[0]).map(([t,cap])=>`<option value="${t}"${ptsOf()===+t?" selected":""}>${t} แต้ม · ดิวได้ถึง ${cap}</option>`).join("")}</select></label>
    ${intIn("noShowMin","เช็คอินได้ถึงกี่นาทีหลังเริ่ม (0 = ปิด)",c.noShowMin,0,240)}${intIn("noShowFee","ค่าปรับคนไม่มา (฿, 0 = ไม่ปรับ)",c.noShowFee,0,10000)}
    ${intIn("queueDepth","คู่ล่วงหน้าต่อคอร์ด",c.queueDepth,0,5)}
    <label class="f">จัดคู่ให้ฝีมือสมดุล<select name="balance"><option value="1" ${c.balance?"selected":""}>เปิด</option><option value="" ${!c.balance?"selected":""}>ปิด</option></select></label>
    <label class="f">อนุมัติคำขอคู่ที่ขอกันเองอัตโนมัติ<select name="autoMutual"><option value="1" ${c.autoMutual?"selected":""}>เปิด</option><option value="" ${!c.autoMutual?"selected":""}>ปิด</option></select></label>
    <label class="f">จัดคู่ใหม่อัตโนมัติเมื่อจบเกม<select name="autoAfterEnd"><option value="1" ${c.autoAfterEnd!==false?"selected":""}>เปิด</option><option value="" ${c.autoAfterEnd===false?"selected":""}>ปิด</option></select></label>
    <h3 class="full" style="margin-top:6px">ราคาที่ผู้เล่นจ่าย</h3>
    ${intIn("playerCourtFee","ค่าสนาม (฿/คน/รอบ)",c.playerCourtFee,0,10000)}${decIn("shuttleFee","ค่าลูกใหม่ (฿/ลูก)",c.shuttleFee,0,1000)}
    <label class="f full">วิธีคิดค่าลูก<select name="shuttleSplit"><option value="each" ${c.shuttleSplit!=="shared"?"selected":""}>ทุกคนจ่ายลูกละ ${unit(c.shuttleFee)} ฿ (รวม ${unit(c.shuttleFee*4)}/ลูก)</option><option value="shared" ${c.shuttleSplit==="shared"?"selected":""}>ลูกละ ${unit(c.shuttleFee)} ฿ หาร 4 คน</option></select></label>
    <label class="f full">ลูกที่ใช้เริ่มเกมตามปกติ<select name="shuttleDefault"><option value="new" ${c.shuttleDefault!=="repair"?"selected":""}>ลูกใหม่ (คิดเงิน) — ผู้เล่นขอลูกซ่อมเพิ่มได้ที่การ์ดคอร์ด</option><option value="repair" ${c.shuttleDefault==="repair"?"selected":""}>ลูกซ่อม (ฟรี) — ผู้เล่นขอลูกใหม่แล้วกด + ลูกใหม่ที่การ์ดคอร์ด</option></select></label>
    <h3 class="full" style="margin-top:6px">ต้นทุนของผู้จัด</h3>
    ${intIn("courtRent","ค่าเช่าคอร์ดตั้งต้น (฿/คอร์ด/ชม.)",c.courtRent,0,100000)}${intIn("perCourtHour","ลูกต่อคอร์ดต่อชั่วโมง (เตรียมสต็อก)",c.perCourtHour,0,20)}
    ${intIn("buffer","เผื่อลูกสำรอง (%)",c.buffer,0,200)}
    <h3 class="full" style="margin-top:6px">ลูกแบด: สต็อกและราคาทุน</h3>
    ${intIn("stockNew","ลูกใหม่ คงเหลือในสต็อก (ลูก)",stockLeft(NEW),0,100000,"เช่น 48")}${decIn("shuttleCost","ราคาทุนลูกใหม่ (฿/ลูก)",c.shuttleCost||"",0,1000,"เช่น 50")}
    ${intIn("stockRepair","ลูกซ่อม คงเหลือในสต็อก (ลูก)",stockLeft(REP),0,100000,"เช่น 24")}${decIn("repairCost","ราคาทุนลูกซ่อม (฿/ลูก)",c.repairCost||"",0,1000,"เช่น 15")}
    ${intIn("stockAlert","แจ้งเตือนเมื่อลูกใหม่เหลือ ≤",(NEW?NEW.threshold:12),0,100000)}
    <p class="small muted full" style="margin:0">ซื้อเป็นหลอด: ราคาหลอด ÷ จำนวนลูก (เช่น 600 ÷ 12 = 50 ฿/ลูก) · ลูกที่ใช้ในแต่ละเกมถูกหักจากสต็อกอัตโนมัติ · เว้นช่องสต็อกว่างไว้ = ไม่ตั้ง/ไม่เปลี่ยน · ยังไม่มีรายการ ระบบสร้างให้เอง</p>
    <label class="f" hidden>วิธีหารค่าใช้จ่าย<select name="split"><option value="equal" ${c.split==="equal"?"selected":""}>หารเท่ากัน</option><option value="games" ${c.split==="games"?"selected":""}>ตามจำนวนเกม</option></select></label>
    <label class="f full">ช่องทางชำระเงิน (แสดงให้ผู้เล่น)<textarea name="payInfo" maxlength="300" placeholder="เช่น พร้อมเพย์ 08x-xxx-xxxx ชื่อบัญชี ...">${esc(c.payInfo)}</textarea></label>
  </div><div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const out={group:fv(f,"group")||CFG_DEF.group,pointsToWin:PTS_CAP[+fv(f,"pointsToWin")]?+fv(f,"pointsToWin"):21,balance:!!fv(f,"balance"),autoMutual:!!fv(f,"autoMutual"),autoAfterEnd:!!fv(f,"autoAfterEnd"),shuttleSplit:fv(f,"shuttleSplit")==="shared"?"shared":"each",shuttleDefault:fv(f,"shuttleDefault")==="repair"?"repair":"new",payInfo:fv(f,"payInfo")};
    for(const k of ["restMin","avgMin","setsPerGame","noShowMin","noShowFee","queueDepth","playerCourtFee","courtRent","perCourtHour","buffer"]){const v=checkInt(f,k,true);if(v===false)return false;out[k]=v;}
    {const v=checkDec(f,"shuttleFee",true);if(v===false)return false;out.shuttleFee=v;}   // the fee players pay must be filled in (0 = free)
    for(const k of ["shuttleCost","repairCost"]){const v=checkDec(f,k,false);if(v===false)return false;out[k]=v===null?0:v;}   // blank = cost not set
    const sN=checkInt(f,"stockNew",false);if(sN===false)return false;const sR=checkInt(f,"stockRepair",false);if(sR===false)return false;const sA=checkInt(f,"stockAlert",true);if(sA===false)return false;
    {const c0=cfg();if(PRICE_KEYS.some(k=>k==="shuttleSplit"?(out[k]||"each")!==(c0[k]||"each"):(+out[k]||0)!==(+c0[k]||0)))await freezePastRounds(priceSnapNow());}   // old rounds keep the prices they were played at
    const before=cfg().restMin;const ok=await write("cfg/main",out,"บันทึกการตั้งค่าแล้ว");if(ok&&out.restMin!==before)logEv("เปลี่ยนกฎพัก",`${before} → ${out.restMin} นาที`);
    if(ok)await applyShuttleStock(sN,sR,sA);
    return ok;
  });
}
/* before prices change: rounds that are over (closed, or dated before today) and have no frozen prices yet keep the current ones */
async function freezePastRounds(snap){
  for(const s of S.sessions.slice()){if(s.priceSnap||!(s.status==="closed"||dateDiff(s.date)<0))continue;await write(`sessions/${s.id}`,{...stripId(s),priceSnap:snap});}
}
/* settings → stock: set what is left in hand for new / repaired shuttles; creates the stock item when it does not exist yet */
async function applyShuttleStock(left,leftRep,alertAt){
  let items=((S.inv&&S.inv.items)||[]).map(i=>({...i}));let changed=false;
  const apply=(flag,left,name,thr)=>{
    if(left===null&&flag==="repair")return;
    let it=items.find(i=>i[flag]);
    if(!it){if(left===null)return;items.push({id:uid("i"),name,unit:"ลูก",total:left,used:0,threshold:thr,[flag]:true});changed=true;return;}
    if(left!==null&&left!==Math.max(0,it.total-it.used)){it.total=it.used+left;changed=true;}
    if(flag==="shuttle"&&thr!==it.threshold){it.threshold=thr;changed=true;}
  };
  apply("shuttle",left,"ลูกแบด (ใหม่)",alertAt);apply("repair",leftRep,"ลูกซ่อม",0);
  if(changed)await write("inventory/main",{...(S.inv||{}),items});
}
function dlgItem(it){
  const isNew=!it;it=it||{name:"ลูกแบด",total:0,used:0,threshold:12,unit:"ลูก",shuttle:!((S.inv&&S.inv.items)||[]).some(i=>i.shuttle)};
  openDlg(`<form novalidate><h2>${isNew?"เพิ่มรายการสต็อก":"แก้ไขรายการ"}</h2><div class="fg">
    <label class="f">ชื่อรายการ<input name="name" maxlength="40" value="${esc(it.name)}"><span class="ferr"></span></label>
    <label class="f">หน่วย<input name="unit" maxlength="10" value="${esc(it.unit||"")}"></label>
    ${intIn("total","จำนวนทั้งหมด",it.total,0,100000)}${intIn("used","ใช้ไปแล้ว",it.used,0,100000)}
    ${intIn("threshold","แจ้งเตือนเมื่อเหลือ ≤",it.threshold,0,100000)}
    <label class="f">หักอัตโนมัติจากผลเกม<select name="kind"><option value="new" ${it.shuttle?"selected":""}>ลูกใหม่</option><option value="repair" ${it.repair?"selected":""}>ลูกซ่อม</option><option value="" ${!it.shuttle&&!it.repair?"selected":""}>ไม่หัก</option></select></label>
  </div><div class="dlg-a">${!isNew?`<button type="button" class="danger" data-act="delItem" data-id="${esc(it.id)}" style="margin-right:auto">ลบรายการ</button>`:""}<button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const name=fv(f,"name");if(!name)return fieldErr(f,"name","กรอกชื่อ");
    const o={id:isNew?uid("i"):it.id,name,unit:fv(f,"unit"),shuttle:fv(f,"kind")==="new",repair:fv(f,"kind")==="repair"};
    for(const k of ["total","used","threshold"]){const v=checkInt(f,k,true);if(v===false)return false;o[k]=v;}
    if(o.used>o.total)return fieldErr(f,"used","ใช้ไปมากกว่าจำนวนทั้งหมดไม่ได้");
    let items=((S.inv&&S.inv.items)||[]).filter(i=>i.id!==o.id);if(o.shuttle)items=items.map(i=>({...i,shuttle:false}));if(o.repair)items=items.map(i=>({...i,repair:false}));
    items.push(o);return write("inventory/main",{...(S.inv||{}),items},"บันทึกสต็อกแล้ว");
  });
}
/* add shuttles to stock: new ones and repaired ones are counted separately; the stock line is created the first time */
function dlgShuttleIn(kind){
  const nw=kind==="new",flag=nw?"shuttle":"repair",it=((S.inv&&S.inv.items)||[]).find(i=>i[flag]);
  openDlg(`<form novalidate><h2>เพิ่ม${nw?"ลูกใหม่":"ลูกซ่อม"}เข้าสต็อก</h2>
    <p class="small" style="margin:0 0 8px">${nw?"ลูกใหม่ = ลูกจริงที่ซื้อมา (คิดเงินผู้เล่นเมื่อใช้)":"ลูกซ่อม = ลูกที่ซ่อม/คัดกลับมาใช้ (ไม่คิดเงินผู้เล่น)"} · ตอนนี้คงเหลือ <b>${it?Math.max(0,it.total-it.used):0}</b> ลูก</p>
    <div class="fg">${intIn("n","จำนวนที่เพิ่ม (ลูก)",nw?12:6,1,100000)}</div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">เพิ่มเข้าสต็อก</button></div></form>`,async f=>{
    const n=checkInt(f,"n",true);if(n===false)return false;
    const inv=(S.inv&&S.inv.items)||[],cur=inv.find(i=>i[flag]);
    const items=cur?inv.map(i=>i.id===cur.id?{...i,total:i.total+n}:i):[...inv,{id:uid("i"),name:nw?"ลูกแบด (ใหม่)":"ลูกซ่อม",unit:"ลูก",total:n,used:0,threshold:nw?12:0,[flag]:true}];
    const ok=await write("inventory/main",{...(S.inv||{}),items},`เพิ่ม${nw?"ลูกใหม่":"ลูกซ่อม"} ${n} ลูกแล้ว — คงเหลือ ${items.find(i=>i[flag]).total-items.find(i=>i[flag]).used} ลูก`);
    if(ok)logEv("เพิ่มสต็อก"+(nw?"ลูกใหม่":"ลูกซ่อม"),`+${n} ลูก`);return ok;});
}
function dlgStock(it,mode){
  openDlg(`<form novalidate><h2>${mode==="add"?"รับเข้า":"เบิกใช้"} · ${esc(it.name)}</h2><div class="fg">${intIn("n","จำนวน",mode==="add"?12:1,1,10000)}</div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const n=checkInt(f,"n",true);if(n===false)return false;
    if(mode!=="add"&&it.used+n>it.total)return fieldErr(f,"n",`คงเหลือแค่ ${it.total-it.used}`);
    const items=S.inv.items.map(i=>i.id===it.id?{...i,total:mode==="add"?i.total+n:i.total,used:mode==="add"?i.used:i.used+n}:i);
    return write("inventory/main",{...S.inv,items},"บันทึกแล้ว");
  });
}
function dlgCosts(){
  const s=curSession();
  openDlg(`<form novalidate><h2>ต้นทุนรอบนี้ (ฝั่งผู้จัด)</h2><div class="fg">
    ${intIn("courtRent","ค่าเช่าคอร์ด (฿/คอร์ด/ชั่วโมง)",s.courtRent!=null?s.courtRent:(cfg().courtRent||0),0,100000)}
    ${intIn("otherFee","ค่าใช้จ่ายอื่น (฿)",s.otherFee||0,0,1000000)}</div>
    <p class="small muted" style="margin:0">${(s.courts||[]).length} คอร์ด × ${sessHours(s).toFixed(1)} ชม. (${esc(s.start)}–${esc(s.end)}) · ต้นทุนลูกแบดคิดจากลูกที่บันทึกในผลแต่ละเกม × ราคาทุนในตั้งค่า</p>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const a=checkInt(f,"courtRent",true);if(a===false)return false;const b=checkInt(f,"otherFee",true);if(b===false)return false;
    const d={...stripId(s),courtRent:a,otherFee:b};delete d.courtFee;
    const ok=await write(`sessions/${s.id}`,d,"บันทึกแล้ว");if(ok)logEv("แก้ต้นทุน",`ค่าเช่า ${a} ฿/คอร์ด/ชม. · อื่น ๆ ${b} ฿`);return ok;
  });
}
/* money received in part (cash or transfer): the rest stays unpaid and can be collected later, even in a later round */
function dlgPartial(r){
  openDlg(`<form novalidate><h2>รับเงินบางส่วน · ${esc(r.name)}</h2>
    <p class="small" style="margin:0 0 8px">ยอดที่ต้องจ่าย <b>${baht(r.due)} ฿</b> · รับแล้ว ${baht(r.paidAmt)} ฿ · ค้างอยู่ <b>${baht(r.owe)} ฿</b></p>
    <div class="fg">${intIn("amt","รับครั้งนี้ (฿)","",1,100000)}</div>
    ${methodPick("cash")}
    <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึกรับเงิน</button></div></form>`,async f=>{
    const a=checkInt(f,"amt",true);if(a===false)return false;
    if(a>r.owe)return fieldErr(f,"amt",`เกินยอดค้าง ${baht(r.owe)} ฿`);
    const m=f.elements.method.value==="transfer"?"transfer":"cash",s=curSession(),x=receiptDoc(r,a,m);
    const ok=await write(`sessions/${s.id}/pay/${r.id}`,x,a>=r.owe?"รับเงินครบแล้ว":`รับ${METHOD_TH[m]} ${baht(a)} ฿ แล้ว — ค้างอีก ${baht(r.owe-a)} ฿`);
    if(ok)logEv(m==="transfer"?"รับโอนบางส่วน":"รับเงินสดบางส่วน",`${r.name} ${a} ฿ (ค้างอีก ${Math.max(0,r.owe-a)})`);return ok;
  });
}
function dlgAdjust(r){
  openDlg(`<form novalidate><h2>ปรับยอด · ${esc(r.name)}</h2><p class="small muted" style="margin:0 0 8px">ยอดที่ระบบคำนวณ ${baht(r.calc)} ฿ — ถ้าคนนี้เล่นเพิ่มทีหลัง ส่วนต่างที่ปรับไว้ยังคงอยู่</p><div class="fg">${intIn("due","ยอดใหม่ (฿)",r.due,0,100000)}<label class="f">เหตุผล<input name="reason" maxlength="100"><span class="ferr"></span></label></div>
    <div class="dlg-a"><button type="button" class="ghost" data-act="clearAdjust" data-id="${esc(r.id)}">ใช้ยอดคำนวณ</button><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">บันทึก</button></div></form>`,async f=>{
    const d=checkInt(f,"due",true);if(d===false)return false;const reason=fv(f,"reason");if(reason.length<2)return fieldErr(f,"reason","ระบุเหตุผล");
    const s=curSession();const o2={...(r.ov||{}),dueAdj:d-r.calc};delete o2.dueOverride;delete o2.adjReason;   // stored as a difference from the calculated bill
    const ok=await write(`sessions/${s.id}/pay/${r.id}`,o2,"ปรับยอดแล้ว");if(ok){await setNote(r.id,s.id,{adjReason:reason});logEv("ปรับยอด",`${r.name}: ${r.due} → ${d} ฿ · ${reason}`);}return ok;
  });
}
/* private notes for one player (only that player and organizers can read notes/{id}) */
async function setNote(pid,sid,patch){
  let cur=null;try{cur=await readDoc(`notes/${pid}`);}catch(e){}cur=cur||S.notes.find(x=>x.id===pid)||{};   // fresh read: several sessions may write the same player's notes
  const by={...(cur.bySid||{})};by[sid]={...(by[sid]||{}),...patch};
  Object.keys(by[sid]).forEach(k=>{if(by[sid][k]==="")delete by[sid][k];});
  return setDoc(`notes/${pid}`,{bySid:by}).catch(()=>{});
}
/* older versions kept the event log and payment reasons where every viewer could read them: move them once */
const migrated=new Set();
async function migratePrivate(sid){
  if(!DB.isOrg||!sid||migrated.has(sid))return;migrated.add(sid);
  try{
    const logs=await readCol(`sessions/${sid}/log`);
    for(const l of logs){const x={...l};delete x.id;await setDoc(`private/${sid}/log/${l.id}`,x);await delDoc(`sessions/${sid}/log/${l.id}`);}
    const pays=await readCol(`sessions/${sid}/pay`);
    for(const p of pays){if(p.adjReason==null&&!p.note)continue;
      const patch={};if(p.adjReason)patch.adjReason=p.adjReason;if(p.note)patch.rejectNote=p.note;
      if(Object.keys(patch).length)await setNote(p.id,sid,patch);
      const x={...p};delete x.id;delete x.adjReason;delete x.note;await setDoc(`sessions/${sid}/pay/${p.id}`,x);}
  }catch(e){migrated.delete(sid);console.warn("migrate",e);}
}
async function migrateAllSessions(){for(const s of S.sessions.slice())await migratePrivate(s.id);}
function dlgViewSlip(r){
  openDlg(`<div><h2>สลิป · ${esc(r.name)}</h2><p class="small"${+r.slip.amount!==r.owe?' style="color:var(--warn);font-weight:600"':""}>ยอดในสลิป ${baht(r.slip.amount)} ฿ (ยอดค้างจ่าย ${baht(r.owe)} ฿)${+r.slip.amount<r.owe?" — น้อยกว่ายอดค้าง":+r.slip.amount>r.owe?" — มากกว่ายอดค้าง":""} · ${esc(r.slip.method||"")} · ${new Date(r.slip.at).toLocaleString(LOC())}</p>
    ${r.slip.img?`<img class="slipimg" src="${esc(r.slip.img)}" alt="สลิปโอนเงิน">`:"<div class='empty'>ไม่มีรูป</div>"}
    <label class="f" style="margin-top:10px">หมายเหตุ (ถ้าปฏิเสธ)<input id="slipNote" maxlength="100"></label></div>
    <div class="dlg-a"><button type="button" class="ghost" data-close>ปิด</button><button type="button" class="danger" data-act="slipReject" data-id="${esc(r.id)}">ปฏิเสธ</button><button type="button" class="primary" data-act="slipOk" data-id="${esc(r.id)}">ยืนยันรับเงิน</button></div>`);
}
/* ================= actions ================= */
async function autoMatch(silent){
  const s=curSession();if(!s||s.status==="closed")return;
  {const e=sessEndEpoch(s);if(silent&&e&&now()>e)return;}   // booked time is over: no new games are queued automatically
  const made=generateMatches();
  if(!made.length){if(!silent)toast("ยังจัดคู่ไม่ได้ — ต้องมีผู้เล่นพร้อม (พักครบ) อย่างน้อย 4 คนและคอร์ดที่ว่าง");return;}
  for(const {id,m} of made){await write(`sessions/${s.id}/matches/${id}`,m);
    for(const r of m.reqIds){const d=S.decisions.find(x=>x.id===r)||{};await write(`sessions/${s.id}/decisions/${r}`,{...stripId(d),status:"accepted",fulfilled:id});}}
  toast(`จัดคู่ใหม่ ${made.length} คู่ (เคารพกฎพัก ${cfg().restMin} นาที)`);
  logEv("จัดคู่อัตโนมัติ",made.map(({m})=>`คอร์ด ${m.court}: ${[...m.a,...m.b].map(nameOf).join(", ")}`).join(" | "));
}
async function rosterPatch(id,patch,msg){
  const s=curSession();const ex=S.roster.find(r=>r.id===id);
  const p=rosterModel().find(x=>x.id===id)||{};
  const base=ex?stripId(ex):{addedAt:p.signupAt||now(),walkin:false};
  return write(`sessions/${s.id}/roster/${id}`,{...base,...patch},msg);
}
async function handleReq(id,status){
  const s=curSession();const r=requestModel().find(x=>x.id===id);if(!r)return;
  const d=S.decisions.find(x=>x.id===id);
  const ok=await write(`sessions/${s.id}/decisions/${id}`,{...(d?stripId(d):{}),status,by:DB.meName||"ผู้จัด",at:now(),...(r.byOrg?{}:{owner:r.from})},status==="accepted"?"อนุมัติแล้ว — จะจัดลงแมตช์ถัดไปที่ทั้งคู่พักครบ":"ปฏิเสธแล้ว");
  if(ok)logEv(status==="accepted"?"อนุมัติคำขอ":"ปฏิเสธคำขอ",`${nameOf(r.from)} → ${nameOf(r.to)} (${r.type==="partner"?"คู่":"คู่แข่ง"})`);
}
let mutualBusy=false;
async function autoMutualCheck(){
  if(!DB.isOrg||!cfg().autoMutual||mutualBusy)return;
  const pend=requestModel().filter(r=>r.status==="pending"&&r.type==="partner");
  const pair=pend.find(r=>pend.some(q=>q.from===r.to&&q.to===r.from));if(!pair)return;
  mutualBusy=true;
  try{const other=pend.find(q=>q.from===pair.to&&q.to===pair.from);
    await handleReq(pair.id,"accepted");const s=curSession();const d=S.decisions.find(x=>x.id===other.id);
    await write(`sessions/${s.id}/decisions/${other.id}`,{...(d?stripId(d):{}),status:"accepted",by:"อัตโนมัติ (ขอกันเอง)",at:now(),owner:other.from,mutualOf:pair.id});}
  finally{mutualBusy=false;}
}
async function exportXlsx(){
  const s=curSession();if(!s)return;
  if(!window.XLSX){try{await loadScript("lib/xlsx.full.min.js");}catch(e){}}
  if(!window.XLSX){toast("ตัวสร้างไฟล์ Excel โหลดไม่สำเร็จ — ต้องออนไลน์ครั้งแรก");return;}
  const X=XLSX.utils,wb=X.book_new(),roster=rosterModel(),ps=playerStats(),pm=payModel();
  X.book_append_sheet(wb,X.aoa_to_sheet([["ชื่อ","ระดับ","สถานะ","เช็คอิน","เกม","ชนะ","แพ้","เสมอ","ช่วยแทน (เกม)","นาที"],...roster.map(p=>{const x=ps.get(p.id);return [p.name,skLabel(p.skill),p.status,p.checkedIn?"ใช่":"",x.games,x.wins,x.losses,x.draws,x.helps,x.minutes];})]),"ผู้เล่น");
  X.book_append_sheet(wb,X.aoa_to_sheet([["คอร์ด","ทีมซ้าย","ทีมขวา","สถานะ","เริ่ม","จบ","ผลเกม","เซตซ้าย","เซตขวา","คะแนนรายเซต","ลูกใหม่","ลูกซ่อม","เปลี่ยนตัว"],...S.matches.map(m=>[m.court,m.a.map(nameOf).join(" + "),m.b.map(nameOf).join(" + "),m.status,m.startAt?hm(m.startAt):"",m.endAt?hm(m.endAt):"",m.status==="done"?resultText(m):"",m.setsA??"",m.setsB??"",m.score||"",m.shuttles||0,m.repair||0,(m.subs||[]).filter(x=>x.live).map(x=>nameOf(x.out)+"→"+nameOf(x.in)).join(", ")])]),"แมตช์");
  const P=pm.pnl;
  X.book_append_sheet(wb,X.aoa_to_sheet([["ชื่อ","เกม","ลูกที่เล่น","ช่วยแทน (เกม)","ออกกลางเกม (เกม)","ค่าสนาม","ค่าลูก","ยอด (฿)","สถานะ","ยอดในสลิป","ค่าปรับไม่มา","จ่ายแล้ว","ค้างจ่าย","รับเงินสด","รับโอน","เกมฟรี"],...pm.rows.map(r=>[r.name,r.games,r.myShuttles,r.helped,r.leftEarly,r.courtPart,r.shuttlePart,r.due,{paid:"จ่ายแล้ว",partial:"จ่ายบางส่วน",pending:"รอตรวจ",rejected:"สลิปไม่ผ่าน",unpaid:"ยังไม่จ่าย"}[r.state],r.slip?r.slip.amount:"",r.noShowPart,r.paidAmt,r.owe,r.cashAmt,r.transAmt,r.myFree||0])]),"ค่าใช้จ่ายผู้เล่น");
  X.book_append_sheet(wb,X.aoa_to_sheet([["งบกำไรขาดทุน",s.title||"",fmtD(s.date)],[],["รายรับ"],["ค่าสนาม",P.revCourt],["ค่าลูกใหม่",P.revShuttle],["ค่าปรับคนไม่มา",P.revNoShow],["ปรับยอด",P.adjust],["รวมรายรับ",P.revenue],[],["ต้นทุน"],["ค่าเช่าคอร์ด",P.rent],["ลูกใหม่",P.costNew],["ลูกซ่อม",P.costRepair],["อื่น ๆ",P.other],["รวมต้นทุน",P.cost],[],[P.profit>=0?"กำไรสุทธิ":"ขาดทุนสุทธิ",P.profit],["เก็บได้จริง",P.collected],["กำไร/ขาดทุนตามเงินจริง",P.cashProfit]]),"กำไรขาดทุน");
  // one row per closed round: the numbers frozen when the round was closed
  {const rows=S.sessions.filter(x=>x.status==="closed"&&x.summary).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
   if(rows.length)X.book_append_sheet(wb,X.aoa_to_sheet([["วันที่","รอบ","ผู้เล่น","เกม","ลูกใหม่","ลูกซ่อม","รายรับ","ต้นทุน","กำไร/ขาดทุน","ค้างเก็บ"],...rows.map(x=>[x.date,x.title||"",x.summary.players,x.summary.games,x.summary.shuttles,x.summary.repair,x.summary.revenue,x.summary.cost,x.summary.profit,x.summary.owed||0]),[],["รวม","","","","","",rows.reduce((a,x)=>a+x.summary.revenue,0),rows.reduce((a,x)=>a+x.summary.cost,0),rows.reduce((a,x)=>a+x.summary.profit,0),rows.reduce((a,x)=>a+(x.summary.owed||0),0)]]),"สรุปรายรอบ");}
  {const L=debtLedger();if(L.length)X.book_append_sheet(wb,X.aoa_to_sheet([["ผู้เล่น","รอบ","วันที่","ยอดเต็ม","ค้างอยู่"],...L.map(e=>[e.name,e.title,e.date,e.due,e.owe]),[],["รวม","","","",L.reduce((a,e)=>a+e.owe,0)]]),"ค้างจ่ายสะสม");}
  const data=new Uint8Array(XLSX.write(wb,{bookType:"xlsx",type:"array"}));
  saveBytes(`badminton-${s.date}.xlsx`,data);
}
/* ---------- backup / restore (single-device mode keeps everything in this browser) ---------- */
function exportBackup(){
  const data=lload();const n=Object.keys(data).length;
  if(!n){toast("ยังไม่มีข้อมูลให้สำรอง");return;}
  const bytes=new TextEncoder().encode(JSON.stringify({app:"bgo",v:1,at:now(),data}));
  const d=new Date();saveBytes(`badminton-backup-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`,bytes,"application/json");
}
function importBackup(){
  const inp=document.createElement("input");inp.type="file";inp.accept="application/json,.json";
  inp.onchange=async()=>{const file=inp.files&&inp.files[0];if(!file)return;
    let o=null;try{o=JSON.parse(await file.text());}catch(e){}
    if(!o||o.app!=="bgo"||!o.data||typeof o.data!=="object"||Array.isArray(o.data)){toast("ไม่ใช่ไฟล์สำรองของระบบนี้");return;}
    const keys=Object.keys(o.data).filter(k=>/^[A-Za-z0-9_\-\/.]{1,300}$/.test(k)&&o.data[k]!==null&&typeof o.data[k]==="object");
    if(!keys.length){toast("ไฟล์สำรองว่างเปล่า");return;}
    const nSess=keys.filter(k=>/^sessions\/[^/]+$/.test(k)).length;
    openDlg(`<form novalidate><h2>กู้คืนข้อมูลจากไฟล์สำรอง</h2>
      <p style="margin:0 0 8px">ไฟล์นี้มี ${keys.length} รายการ · ${nSess} รอบเล่น${o.at?` · สำรองเมื่อ ${esc(fmtD(new Date(o.at).toISOString().slice(0,10)))} ${esc(hm(o.at))} น.`:""}</p>
      <div class="notice warn">ข้อมูลที่อยู่ในเครื่องนี้ตอนนี้จะถูก<b>แทนที่ทั้งหมด</b> — ถ้ายังไม่ได้สำรองของปัจจุบัน กด "ยกเลิก" แล้วดาวน์โหลดไฟล์สำรองก่อน</div>
      <div class="dlg-a"><button type="button" class="ghost" data-close>ยกเลิก</button><button type="submit" class="primary">แทนที่ข้อมูลทั้งหมด</button></div></form>`,async()=>{
      try{const old=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(LP))old.push(k);}
        old.forEach(k=>localStorage.removeItem(k));
        keys.forEach(k=>localStorage.setItem(LP+k,JSON.stringify(o.data[k])));}
      catch(e){toast("กู้คืนไม่สำเร็จ — พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็มหรือถูกปิด");return false;}
      toast("กู้คืนข้อมูลแล้ว กำลังโหลดใหม่…");setTimeout(()=>location.reload(),700);return true;});
  };
  inp.click();
}
/* hand a generated file to the person (download prompt in the viewer, or a normal browser download) */
function saveBytes(fn,data,mime){
  (async()=>{let dl=null;try{dl=await claude.use("downloads");}catch(e){}
    if(dl){try{await dl.save({filename:fn,data});toast("ส่งออกแล้ว");}catch(e){if(!e||e.code!=="declined")toast("ส่งออกไม่สำเร็จ");}return;}
    if(!window.claude){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],mime?{type:mime}:{}));a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},800);toast("ส่งออกแล้ว");return;}
    toast("มุมมองนี้ส่งออกไฟล์ไม่ได้");})();
}

document.addEventListener("click",async e=>{
  if(APP.name!=="org")return;
  const tb=e.target.closest("[data-tab]");if(tb){tab=tb.dataset.tab;try{localStorage.setItem(uiKey("bgo-tab"),tab);}catch(_){}render();return;}
  const b=e.target.closest("[data-act]");if(!b||b.tagName==="SELECT"||b.type==="checkbox")return;
  const a=b.dataset.act,id=b.dataset.id,s=curSession();
  const m=id?S.matches.find(x=>x.id===id):null;
  switch(a){
    case "newSession":return dlgSession();
    case "editSession":return dlgSession(s);
    case "closeSession":return s&&dlgClose();
    case "reopenSession":{const o={...stripId(s),status:"open"};delete o.closedAt;delete o.priceSnap;delete o.summary;await write(`sessions/${s.id}`,o,"เปิดรอบอีกครั้งแล้ว — ใช้ราคาตามการตั้งค่าปัจจุบัน");logEv("เปิดรอบอีกครั้ง","");return;}
    case "autoMatch":return autoMatch(false);
    case "manualMatch":return dlgManual();
    case "addCourt":return dlgAddCourt();
    case "startMatch":{if(!m)return;const ps=playerStats();const resting=[...m.a,...m.b].filter(x=>ps.get(x).restUntil>now());
      if(S.matches.some(x=>x.status==="playing"&&x.court===m.court)){toast("คอร์ดนี้ยังมีเกมเล่นอยู่");return;}
      {const busy=[...m.a,...m.b].filter(id=>S.matches.some(x=>x.id!==m.id&&x.status==="playing"&&[...x.a,...x.b].includes(id)));if(busy.length){toast(`${busy.map(nameOf).join(", ")} กำลังเล่นอยู่อีกคอร์ด — เปลี่ยนตัวก่อน`);return;}}
      if(resting.length&&!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันเริ่ม (override)";toast(`${resting.map(nameOf).join(", ")} ยังพักไม่ครบ ${cfg().restMin} นาที — กดอีกครั้งเพื่อเริ่มโดย override`);return;}
      const ok=await write(`sessions/${s.id}/matches/${m.id}`,{...stripId(m),status:"playing",startAt:now()},"เริ่มเกมแล้ว");
      if(ok)logEv(resting.length?"เริ่มเกม (override กฎพัก)":"เริ่มเกม",`คอร์ด ${m.court}`);return;}
    case "openInvite":closeDlg();return typeof dlgInvite==="function"&&dlgInvite();
    case "qrSave":case "qrSend":{try{const blob=await payQrBlob(0,"");if(a==="qrSave"){QRS.save(blob,"qr-pay.png");toast("บันทึกรูปแล้ว");}else{const r=await QRS.share(blob,"qr-pay.png","สแกนจ่ายค่าเล่น");if(r==="saved")toast("บันทึกรูปแล้ว — แนบส่งใน LINE ได้เลย");}}catch(e){toast(e.message||"สร้างรูป QR ไม่ได้");}return;}
    case "qrDel":{if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันลบ";return;}const d={...(S.payqr||{})};delete d.id;delete d[b.dataset.k];
      if(await write("cfg/pay",d,"ลบแล้ว"))setTimeout(dlgQr,150);return;}
    case "qrOpen":return dlgQr();
    case "qrPay":{const r=payModel().rows.find(x=>x.id===id);if(!r)return;return sendPayQr(Math.ceil(r.owe),`${r.name} · ${fmtD(s.date)}`,b);}
    case "shuttleIn":return dlgShuttleIn(b.dataset.k==="repair"?"repair":"new");
    case "endMatch":return m&&dlgEnd(m);
    case "freeGame":{if(!m)return;if(!m.free)return dlgFree(m);
      const d={...stripId(m)};delete d.free;delete d.setsN;const dd=cfg().shuttleDefault==="repair"?{shuttles:0,repair:1}:{shuttles:1,repair:0};
      if(await write(`sessions/${s.id}/matches/${m.id}`,{...d,...(m.status==="playing"?dd:{})},"เลิกเกมฟรีแล้ว — กลับมาคิดค่าลูกตามปกติ"))logEv("เลิกเกมฟรี",`คอร์ด ${m.court}`);return;}
    case "shAdj":{if(!m||m.status!=="playing")return;const k=b.dataset.k,dlt=+b.dataset.d||0,x=matchShuttles(m);
      if(m.free&&k==="new"){toast("เกมฟรีใช้ลูกซ่อมเท่านั้น");return;}
      const nx={sh:Math.max(0,x.sh+(k==="new"?dlt:0)),rp:Math.max(0,x.rp+(k==="repair"?dlt:0))};if(nx.sh===x.sh&&nx.rp===x.rp)return;
      const c=priceCfg(s),per=(c.shuttleSplit==="shared"?(+c.shuttleFee||0)/4:(+c.shuttleFee||0));
      const ok=await write(`sessions/${s.id}/matches/${m.id}`,{...stripId(m),shuttles:nx.sh,repair:nx.rp},k==="new"?(dlt>0?`เพิ่มลูกใหม่ ${nx.sh} ลูก — คิดเงินผู้เล่น 4 คนในคอร์ด ${m.court} คนละ ${baht(Math.ceil(nx.sh*per))} ฿`:`ลดลูกใหม่เหลือ ${nx.sh} ลูก`):(dlt>0?`เพิ่มลูกซ่อม ${nx.rp} ลูก — ไม่คิดเงิน`:`ลดลูกซ่อมเหลือ ${nx.rp} ลูก`));
      if(ok&&dlt>0)logEv(k==="new"?"เพิ่มลูกใหม่":"เพิ่มลูกซ่อม",`คอร์ด ${m.court}: ใหม่ ${nx.sh} · ซ่อม ${nx.rp}`);return;}
    case "copyAnnounce":{const c=priceCfg(s);
      const txt=`🏸 ${s.title||"ก๊วนแบด"}\n📅 ${fmtD(s.date)} · ${s.start||""}–${s.end||""} น.\n🏟 ${(s.courts||[]).length} คอร์ด · รับ ${s.maxPlayers||"-"} คน\n💰 ค่าสนาม ${baht(c.playerCourtFee)} ฿/คน + ค่าลูกใหม่ ${unit(c.shuttleFee)} ฿/ลูก${c.shuttleSplit==="shared"?" (หาร 4 คนในเกม)":" ต่อคน"}${s.desc?`\n\n${s.desc}`:""}\n\nลงชื่อได้ในแอปก๊วน`;
      try{await navigator.clipboard.writeText(TT(txt));toast("คัดลอกประกาศแล้ว — วางในกลุ่มไลน์ได้เลย");}
      catch(_){openDlg(`<form novalidate><h2>ข้อความประกาศ</h2><textarea readonly style="min-height:200px">${esc(txt)}</textarea><div class="dlg-a"><button type="button" class="primary" data-close>ปิด</button></div></form>`,()=>true);}
      return;}
    case "gotoSess":{selectSession(id);tab="money";try{localStorage.setItem(uiKey("bgo-tab"),tab);}catch(_){}render();window.scrollTo(0,0);return;}
    case "exportBackup":return exportBackup();
    case "importBackup":return importBackup();
    case "editResult":return m&&m.status==="done"&&dlgEnd(m,true);
    case "swap":return m&&dlgSwap(m);
    case "cancelMatch":if(!m)return;if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันยกเลิก";return;}
      if(await write(`sessions/${s.id}/matches/${m.id}`,{...stripId(m),status:"cancelled",cancelledAt:now()},"ยกเลิกแมตช์แล้ว")){logEv("ยกเลิกแมตช์",`คอร์ด ${m.court}: ${[...m.a,...m.b].map(nameOf).join(", ")}`);
        for(const d of S.decisions.filter(x=>x.fulfilled===m.id)){const o2={...stripId(d)};delete o2.fulfilled;await write(`sessions/${s.id}/decisions/${d.id}`,o2);}}return;
    case "rosterTab":rosterTab=b.dataset.k;return render();
    case "addWalkin":return dlgWalkin();
    case "addMember":return dlgMember();
    case "bulkMembers":return dlgBulk();
    case "editMember":return dlgMember(S.members.find(x=>x.id===id));
    case "memFilter":memFilter=b.dataset.k;return render();
    case "addFromMembers":return dlgAddFromMembers();
    case "memToSession":return addMembersToSession([id],false);
    case "memClear":memSel.clear();return render();
    case "memAddSel":{const ids=[...memSel];if(!ids.length)return;const ok=await addMembersToSession(ids,false);if(ok!==false)ids.forEach(x=>memSel.delete(x));return render();}
    case "delMember":{const m=S.members.find(x=>x.id===id);if(!m)return;
      if(!await askConfirm({title:"ลบสมาชิก",danger:true,ok:"ลบสมาชิก",cancel:"ยกเลิก",body:`<p>ต้องการลบสมาชิกชื่อ <b>${esc(m.name)}</b> ออกจากก๊วนใช่หรือไม่?</p><p class="small muted">ชื่อในรอบเล่นที่ผ่านมาและยอดเงินเดิมจะยังอยู่ ลบแล้วเพิ่มกลับได้ภายหลัง</p>`}))return;
      try{await delDoc(`members/${id}`);memSel.delete(id);toast(`ลบ ${m.name} แล้ว (ชื่อในรอบเล่นเดิมยังอยู่)`);logEv("ลบสมาชิก",m.name);}catch(e){toast("ลบไม่สำเร็จ");}return;}
    case "editPlayer":{const mem=S.members.find(x=>x.id===id);if(mem)return dlgMember(mem);const p=rosterModel().find(x=>x.id===id);return p&&dlgWalkin(p);}
    case "checkin":await rosterPatch(id,{checkedInAt:now(),checkedOutAt:null},"เช็คอินแล้ว");return;
    case "checkout":{const ps=playerStats();if(ps.get(id).inMatch){toast("ผู้เล่นอยู่ในแมตช์ — เปลี่ยนตัวหรือจบเกมก่อน");return;}await rosterPatch(id,{checkedOutAt:now()},"เช็คเอาท์แล้ว");return;}
    case "checkinAll":{const list=rosterModel().filter(p=>p.status==="confirmed"&&!p.checkedIn&&!p.checkedOutAt&&!p.notYet);/* round-2 players arrive later: check them in one by one */for(const p of list)await rosterPatch(p.id,{checkedInAt:now()});toast(`เช็คอิน ${list.length} คน`);return;}
    case "moveRound":{const p=rosterModel().find(x=>x.id===id),R=roundsOf(s);if(!p||!R)return;if(playerStats().get(id).inMatch){toast("ผู้เล่นอยู่ในแมตช์ — เปลี่ยนตัวก่อน");return;}
      const to=(p.round||p.want)===2?1:2;await rosterPatch(id,{round:to},`ย้าย ${p.name} ไปรอบ ${to===2?R.start:s.start} แล้ว`);logEv("ย้ายรอบ",`${p.name} → รอบ ${to===2?R.start:s.start}`);return;}
    case "promote":await rosterPatch(id,{status:"confirmed"},"เลื่อนเป็นตัวจริงแล้ว");logEv("เลื่อนตัวสำรอง",nameOf(id));return;
    case "removeP":{const ps=playerStats();if(ps.get(id).inMatch){toast("ผู้เล่นอยู่ในแมตช์ — เปลี่ยนตัวก่อน");return;}const p=rosterModel().find(x=>x.id===id);if(!p)return;return dlgRemovePlayer(p);}
    case "jrQueue":return jrQueue(id);
    case "jrRemove":return dlgJoinRemove(id);
    case "jrReopen":{if(await askConfirm({title:"กลับไปรอพิจารณา",body:"<p>ยกเลิกการนำออก แล้วให้คำขอนี้กลับไปรอพิจารณาอีกครั้งใช่หรือไม่?</p><p class=\"small muted\">ผู้เล่นจะไม่เห็นเหตุผลเดิมแล้ว</p>",ok:"กลับไปรอพิจารณา"}))try{await delDoc(`joinreq/${id}`);toast("กลับไปรอพิจารณาแล้ว");}catch(e){toast("ทำรายการไม่สำเร็จ");}return;}
    case "restore":await rosterPatch(id,{status:null,removedReason:null,removedAt:null},"คืนรายชื่อแล้ว");return;
    case "editProfile":return dlgProfile();
    case "signup":case "signupFor":{const sid=a==="signupFor"?id:s.id;const me=selfDoc(DB.uid);if(!me||!me.name){dlgProfile();toast("ตั้งชื่อก่อนลงชื่อเล่น");return;}
      const su={...(me.signups||{})};su[sid]={at:now()};await write(`self/${DB.uid}`,{...stripId(me),signups:su},"ลงชื่อแล้ว");return;}
    case "cancelSignup":{const me=selfDoc(DB.uid);const ps=playerStats();if(ps.get(DB.uid).inMatch){toast("คุณอยู่ในแมตช์ ยกเลิกไม่ได้ — แจ้งผู้จัด");return;}if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันยกเลิก";return;}
      const su={...(me.signups||{})};su[s.id]={...(su[s.id]||{}),cancelled:true,cancelledAt:now()};await write(`self/${DB.uid}`,{...stripId(me),signups:su},"ยกเลิกการลงชื่อแล้ว");return;}
    case "selfCheckin":{const me=selfDoc(DB.uid);const su={...(me.signups||{})};su[s.id]={...(su[s.id]||{at:now()}),checkedInAt:now()};await write(`self/${DB.uid}`,{...stripId(me),signups:su},"เช็คอินแล้ว — เข้าคิวเรียบร้อย");return;}
    case "newRequest":return dlgRequest();
    case "reqAccept":return handleReq(id,"accepted");
    case "reqReject":return handleReq(id,"rejected");
    case "reqCancel":{const me=selfDoc(DB.uid);const rq={...(me.requests||{})};if(rq[id])rq[id]={...rq[id],cancelled:true};await write(`self/${DB.uid}`,{...stripId(me),requests:rq},"ยกเลิกคำขอแล้ว");return;}
    case "editCosts":return dlgCosts();
    case "exportXlsx":return exportXlsx();
    case "paySlip":return dlgSlip();
    case "viewSlip":{const r=payModel().rows.find(x=>x.id===id);return r&&r.slip&&dlgViewSlip(r);}
    case "slipOk":case "slipReject":case "cashPaid":case "transferPaid":{if(a==="slipReject")await setNote(id,s.id,{rejectNote:(($("#slipNote")||{}).value||"").trim()});const r=payModel().rows.find(x=>x.id===id);if(!r)return;
      const status=a==="slipOk"?"verified":a==="cashPaid"?"cash":a==="transferPaid"?"verified":"rejected";const note=a==="slipReject"?(($("#slipNote")||{}).value||""):"";
      let add=r.owe;   // the whole amount still owed, unless the slip is short
      if(a==="slipOk"&&r.slip&&+r.slip.amount>0&&Math.round(+r.slip.amount)<r.owe){
        const got=Math.round(+r.slip.amount);
        if(!b.dataset.armed){b.dataset.armed="1";b.textContent=`รับ ${baht(got)} ฿ (ค้างอีก ${baht(r.owe-got)})`;toast(`สลิปโอน ${baht(got)} ฿ น้อยกว่ายอดค้าง ${baht(r.owe)} ฿ — กดอีกครั้งเพื่อรับ ${baht(got)} ฿ และยังค้างอีก ${baht(r.owe-got)} ฿`);return;}
        add=got;}
      const doc=status==="rejected"?(()=>{const x={...(r.ov||{}),status,by:DB.meName||"ผู้จัด",at:now()};delete x.note;delete x.adjReason;return x;})()
        :receiptDoc(r,add,a==="cashPaid"?"cash":"transfer",a==="slipOk"?{slip:true}:undefined);
      if(await write(`sessions/${s.id}/pay/${id}`,doc,a==="transferPaid"?"บันทึกรับโอนแล้ว":{verified:"ยืนยันรับเงินแล้ว",cash:"บันทึกรับเงินสดแล้ว",rejected:"ปฏิเสธสลิปแล้ว"}[status])){logEv(a==="transferPaid"?"รับโอน":{verified:"ยืนยันสลิป",cash:"รับเงินสด",rejected:"ปฏิเสธสลิป"}[status],`${r.name} ${status==="rejected"?r.due:add} ฿${add<r.owe&&status!=="rejected"?` (รับบางส่วน ค้างอีก ${r.owe-add})`:""}${note?" · "+note:""}`);closeDlg();}return;}
    case "debtPay":case "debtPart":{const e=debtLedger().find(x=>x.pid===id&&x.sid===b.dataset.sid);if(!e)return;
      if(a==="debtPart")return dlgDebtPay(e);
      if(!b.dataset.armed){b.dataset.armed="1";b.textContent=`ยืนยัน ${baht(e.owe)} ฿`;return;}
      await receiveDebt(e,e.owe,b.dataset.k);return;}
    case "copyDebts":{const L=debtLedger(),c=cfg();
      const txt="ยอดค้างชำระสะสม\n"+L.map((e,i)=>`${i+1}. ${e.name} ${baht(e.owe)} บาท (${fmtD(e.date)})`).join("\n")+`\nรวม ${baht(L.reduce((a,e)=>a+e.owe,0))} บาท`+(c.payInfo?`\n\nช่องทางชำระ: ${c.payInfo}`:"");
      try{await navigator.clipboard.writeText(TT(txt));toast("คัดลอกแล้ว — วางในกลุ่มไลน์ได้เลย");}
      catch(_){openDlg(`<form novalidate><h2>รายชื่อค้างจ่ายสะสม</h2><textarea readonly style="min-height:220px">${esc(txt)}</textarea><div class="dlg-a"><button type="button" class="primary" data-close>ปิด</button></div></form>`,()=>true);}
      return;}
    case "unpay":{const r=payModel().rows.find(x=>x.id===id);if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยัน";return;}if(await write(`sessions/${s.id}/pay/${id}`,{...(r.ov||{}),status:"",paidAmount:null,rec:[],at:now()},"ยกเลิกสถานะจ่ายแล้ว"))logEv("ยกเลิกสถานะจ่าย",r.name);return;}
    case "copyUnpaid":{const pm=payModel();const c=cfg();
      const txt=`ค้างชำระ ${s.title||"ก๊วนแบด"} ${fmtD(s.date)}\n`+pm.rows.filter(r=>r.owe>0).map((r,i)=>`${i+1}. ${r.name} ${baht(r.owe)} บาท`).join("\n")+(c.payInfo?`\n\nช่องทางชำระ: ${c.payInfo}`:"");
      try{await navigator.clipboard.writeText(TT(txt));toast("คัดลอกแล้ว — วางในกลุ่มไลน์ได้เลย");}
      catch(_){openDlg(`<form novalidate><h2>รายชื่อค้างจ่าย</h2><textarea readonly style="min-height:220px">${esc(txt)}</textarea><div class="dlg-a"><button type="button" class="primary" data-close>ปิด</button></div></form>`,()=>true);}
      return;}
    case "partialPay":{const r=payModel().rows.find(x=>x.id===id);return r&&dlgPartial(r);}
    case "adjustDue":{const r=payModel().rows.find(x=>x.id===id);return r&&dlgAdjust(r);}
    case "clearAdjust":{const r=payModel().rows.find(x=>x.id===id);const o={...(r.ov||{})};delete o.dueOverride;delete o.dueAdj;delete o.adjReason;await setNote(id,s.id,{adjReason:""});if(await write(`sessions/${s.id}/pay/${id}`,o,"ใช้ยอดคำนวณแล้ว"))closeDlg();return;}
    case "newPost":return dlgPost();
    case "comment":return dlgComment(id);
    case "hidePost":{const h={...((S.mod&&S.mod.hidden)||{})};if(h[id])delete h[id];else h[id]=true;await write("board/mod",{hidden:h},h[id]?"ซ่อนโพสต์แล้ว":"เลิกซ่อนแล้ว");return;}
    case "delPost":{const me=S.posts.find(p=>p.id===DB.uid);if(!me)return;if(!b.dataset.armed){b.dataset.armed="1";b.textContent="ยืนยันลบ";return;}await write(`posts/${DB.uid}`,{items:(me.items||[]).filter(p=>p.id!==id),comments:me.comments||[]},"ลบโพสต์แล้ว");return;}
    case "addItem":return dlgItem();
    case "editItem":return dlgItem(S.inv.items.find(i=>i.id===id));
    case "delItem":if(!b.dataset.armed){b.dataset.armed="1";b.textContent="กดอีกครั้งเพื่อลบ";return;}if(await write("inventory/main",{...S.inv,items:S.inv.items.filter(i=>i.id!==id)},"ลบรายการแล้ว"))closeDlg();return;
    case "stockAdd":return dlgStock(S.inv.items.find(i=>i.id===id),"add");
    case "stockUse":return dlgStock(S.inv.items.find(i=>i.id===id),"use");
    case "editCfg":return dlgCfg();
  }
});
$("#roleSwitch").addEventListener("click",()=>goPage("player"));
document.addEventListener("change",async e=>{
  if(APP.name!=="org")return;
  const el=e.target;
  if(el.id==="sessSel"){selectSession(el.value);return;}
  if(el.dataset&&el.dataset.act==="prep"){const s=curSession();const items={...((S.prep&&S.prep.items)||{})};items[el.dataset.k]=el.checked;await write(`sessions/${s.id}/meta/prep`,{items});}
});

/* ---------- live hooks from shared data ---------- */
let seenSignups=null;
/* the organizer's device stamps when it first sees each sign-up and check-in: players cannot back-date these */
const witnessing=new Set();
async function witness(){
  const s=curSession();if(!s||!DB.isOrg||!S.seenLoaded||s.status==="closed")return;
  const seen={};S.seen.forEach(x=>seen[x.id]=x);
  /* several people may appear in the same sync (the organizer's app was in the background): stamp them in the order they claim,
     not in the order the documents happen to be listed — otherwise a later signup can get the earlier place */
  const claimOf=d=>{const u=d.signups&&d.signups[s.id],w=seen[d.id];if(!u||u.cancelled)return 0;if(!w||w.claim!==u.at)return +u.at||0;return u.checkedInAt&&w.ci!==u.checkedInAt?+u.checkedInAt||0:0;};
  const batch=[...S.selfDocs].sort((a,b)=>claimOf(a)-claimOf(b)||(a.id<b.id?-1:a.id>b.id?1:0));
  let lastT=0;   // stamps in one pass must be strictly increasing: two in the same millisecond would fall back to the listing order
  for(const d of batch){const su=d.signups&&d.signups[s.id];const w=seen[d.id];const key=d.id+"|"+(su&&su.at)+"|"+(su&&su.checkedInAt)+"|"+(su&&su.cancelled);
    if(witnessing.has(key))continue;
    if(!su||su.cancelled){if(w){witnessing.add(key);await delDoc(`sessions/${s.id}/seen/${d.id}`).catch(()=>{});}continue;}
    const needAt=!w||w.claim!==su.at, needCi=su.checkedInAt&&(!w||w.ci!==su.checkedInAt);
    if(!needAt&&!needCi)continue;
    witnessing.add(key);const t=Math.max(now(),lastT+1);lastT=t;
    const rec={claim:su.at,at:needAt?t:w.at,...(su.checkedInAt?{ci:su.checkedInAt,ciAt:needCi?t:w.ciAt}:{})};
    await setDoc(`sessions/${s.id}/seen/${d.id}`,rec).catch(()=>{});
  }
}
function orgOnData(kind,prev){
  if(kind==="self"||kind==="joinreq")jrWatch();
  if(kind==="self"||kind==="seen")witness();
  if(kind==="decisions"||kind==="self")autoMutualCheck();
  if(kind==="self"){
    const s=curSession();if(!s)return;
    const key=d=>{const su=d.signups&&d.signups[s.id];return su&&!su.cancelled;};
    const now_=new Set(S.selfDocs.filter(key).map(d=>d.id));
    if(seenSignups&&seenSignups.sid===s.id){
      const added=[...now_].filter(x=>!seenSignups.ids.has(x));
      if(added.length)toast(`ผู้เล่นลงชื่อใหม่: ${added.map(id=>(selfDoc(id)||{}).name||"ผู้เล่น").join(", ")}`);
      const ci=S.selfDocs.filter(d=>{const su=d.signups&&d.signups[s.id];const p=(prev||[]).find(x=>x.id===d.id);const pu=p&&p.signups&&p.signups[s.id];return su&&su.checkedInAt&&!(pu&&pu.checkedInAt);});
      if(ci.length)toast(`เช็คอินแล้ว: ${ci.map(d=>d.name||"ผู้เล่น").join(", ")}`);
      const rq=S.selfDocs.flatMap(d=>Object.entries(d.requests||{}).filter(([rid,r])=>r.sid===s.id&&!r.cancelled&&!((prev||[]).find(x=>x.id===d.id)||{requests:{}}).requests?.[rid]).map(()=>d));
      if(rq.length)toast(`มีคำขอคู่/คู่แข่งใหม่ ${rq.length} รายการ — ดูแท็บ "คำขอคู่/คู่แข่ง"`);
    }
    seenSignups={sid:s.id,ids:now_};
  }
}
function startOrg(){
  try{const t=localStorage.getItem(uiKey("bgo-tab"));if(t&&TABS.some(x=>x.k===t))tab=t;}catch(e){}
  APP.render=doRender;
}
