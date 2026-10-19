/* ghstore.js — เก็บข้อมูลของแอปไว้ใน GitHub repo (โหมด "gh")
   - ข้อมูลหนึ่งเอกสาร = ไฟล์ JSON หนึ่งไฟล์: data/<path>.json  (เช่น data/sessions/s1/roster/abc.json)
   - อ่าน: ถามรายการไฟล์ทั้ง repo ด้วย Trees API (ETag → 304 ไม่นับโควตา) แล้วดึงเฉพาะไฟล์ที่เปลี่ยนและที่หน้าจอใช้อยู่
   - เขียน: Contents API ทีละไฟล์ผ่านคิว (แสดงผลทันทีในเครื่อง ส่งขึ้น GitHub ตามหลัง ถ้าออฟไลน์จะเก็บคิวไว้และส่งต่อเมื่อกลับมา)
   - สมาชิก/บันทึกผู้จัด (members/, private/) เข้ารหัส AES-GCM ด้วยรหัสผ่านผู้จัด · สลิป (slips/) เข้ารหัส RSA-OAEP+AES-GCM ให้ผู้จัดอ่านคนเดียว
   ไฟล์นี้ไม่พึ่ง DOM ของแอป ใช้ได้ทั้งหน้าผู้จัดและหน้าผู้เล่น */
"use strict";
const GH=(()=>{
const LS_CFG="bgo-gh-cfg",INV="BGO1.";
const enc=new TextEncoder(),dec=new TextDecoder();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const b64=bytes=>{const u=new Uint8Array(bytes);let s="";for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s);};
const unb64=s=>{const bin=atob(String(s).replace(/\s/g,""));const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;};
const b64u=bytes=>b64(bytes).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64u=s=>unb64(String(s).replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-String(s).length%4)%4));
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
class GErr extends Error{constructor(kind,msg,extra){super(msg||kind);this.kind=kind;Object.assign(this,extra||{});}}

/* ================= config (kept on this device only) ================= */
let memCfg=null;
function loadCfg(){try{const c=JSON.parse(localStorage.getItem(LS_CFG)||"null");if(c&&c.repo&&c.token)return c;}catch(e){}return memCfg;}
function saveCfg(c){memCfg=c;try{localStorage.setItem(LS_CFG,JSON.stringify(c));}catch(e){}}
function clearCfg(){memCfg=null;try{localStorage.removeItem(LS_CFG);}catch(e){}}
const newUid=()=>"u"+hex(crypto.getRandomValues(new Uint8Array(6)));
function makeInvite(c,fp){return INV+b64u(enc.encode(JSON.stringify({r:c.repo,b:c.branch||"main",t:c.token,f:fp||c.fp||"",a:c.api||undefined,x:c.tokenExp||undefined})));}
function parseInvite(s){
  s=String(s||"");const j=s.indexOf(INV);if(j<0)throw new Error("รหัสเชิญไม่ถูกต้อง — ต้องขึ้นต้นด้วย BGO1.");
  s=s.slice(j+INV.length).match(/^[A-Za-z0-9_-]+/);s=s?s[0]:"";
  let o;try{o=JSON.parse(dec.decode(unb64u(s)));}catch(e){throw new Error("รหัสเชิญถูกตัดขาดหรือไม่ครบ — คัดลอกมาใหม่ทั้งหมด");}
  if(!o||!/^[\w.-]+\/[\w.-]+$/.test(o.r||"")||!o.t)throw new Error("รหัสเชิญไม่ครบ (ไม่มี repo หรือโทเคน)");
  const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);   // a custom API address is only honoured when testing on localhost (never from a link on the internet)
  return {repo:o.r,branch:o.b||"main",token:o.t,fp:o.f||"",api:local&&o.a||"",tokenExp:/^\d{4}-\d{2}-\d{2}$/.test(o.x||"")?o.x:""};
}

/* ================= state ================= */
const st={cfg:null,alive:false,ready:false,net:"init",err:"",rate:null,gql:null,gqlFail:0,treeEtag:null,lastSync:0,truncated:false,warn:"",
  keys:{kek:null,priv:null},meta:null,pubKey:null,lastWrite:0,lastLocalWrite:0,errN:0,syncs:0};
const statusSubs=new Set();
const status=()=>({state:st.net!=="ok"&&st.net!=="init"?st.net:(!st.ready?"init":(queue.length?"sync":"ok")),pending:queue.length,lastSync:st.lastSync,
  err:st.err,rate:st.rate,warn:st.warn,repo:st.cfg&&st.cfg.repo,branch:st.cfg&&st.cfg.branch,role:st.cfg&&st.cfg.role,truncated:st.truncated,gql:st.gql,unlocked:!!st.keys.kek});
function notifyStatus(){const s=status();statusSubs.forEach(f=>{try{f(s);}catch(e){}});}
function net(state,err){st.net=state;st.err=err||"";notifyStatus();}

/* ================= HTTP ================= */
const apiOf=c=>((c&&c.api)||"https://api.github.com").replace(/\/$/,"");
async function req(method,path,o={},cfg){
  const c=cfg||st.cfg,url=path.startsWith("http")?path:apiOf(c)+path;
  const h={"Accept":o.accept||"application/vnd.github+json","Authorization":"Bearer "+c.token};
  if(o.etag)h["If-None-Match"]=o.etag;
  let body;if(o.body!==undefined){h["Content-Type"]="application/json";body=JSON.stringify(o.body);}
  let res;
  try{res=await fetch(url,{method,headers:h,body,cache:"no-store"});}
  catch(e){throw new GErr("offline","ติดต่อ GitHub ไม่ได้ (ไม่มีอินเทอร์เน็ตหรือถูกบล็อก)");}
  const rem=res.headers.get("x-ratelimit-remaining");
  if(rem!==null&&rem!==""){st.rate={remaining:+rem,limit:+res.headers.get("x-ratelimit-limit")||0,reset:(+res.headers.get("x-ratelimit-reset")||0)*1000,at:Date.now()};}
  if(res.status===304)return {status:304,etag:o.etag};
  if(o.raw&&res.ok)return {status:res.status,text:await res.text(),etag:res.headers.get("etag")};
  let data=null;try{const t=await res.text();data=t?JSON.parse(t):null;}catch(e){data=null;}
  if(res.ok)return {status:res.status,data,etag:res.headers.get("etag")};
  const msg=(data&&data.message)||res.statusText||("HTTP "+res.status);
  const ra=+res.headers.get("retry-after")||0,zero=res.headers.get("x-ratelimit-remaining")==="0";
  if(res.status===401)throw new GErr("auth",msg,{status:401});
  if(res.status===429||(res.status===403&&(ra||zero||/rate limit|abuse|secondary/i.test(msg)))){
    const reset=(+res.headers.get("x-ratelimit-reset")||0)*1000;
    throw new GErr("rate",msg,{status:res.status,wait:ra?ra*1000:(zero&&reset?Math.max(2000,reset-Date.now()+1500):60000)});}
  if(res.status===403)throw new GErr("forbidden",msg,{status:403});
  if(res.status===404)throw new GErr("notfound",msg,{status:404});
  if(res.status===409)throw new GErr("conflict",msg,{status:409});
  if(res.status===422)throw new GErr("invalid",msg,{status:422});
  throw new GErr("server",msg,{status:res.status});
}
/* plain-Thai explanation + what to do, for error kinds */
function explain(e){
  const k=e&&e.kind,m=(e&&e.message)||"";
  if(k==="auth")return {t:"โทเคนใช้ไม่ได้ (ผิดหรือหมดอายุ)",fix:"ผู้จัดสร้างโทเคนใหม่ที่ GitHub แล้วส่งลิงก์เชิญใหม่ให้ทุกคน"};
  if(k==="forbidden")return {t:"โทเคนไม่มีสิทธิ์ตามที่ต้องการ",fix:"ที่ GitHub ตั้ง Repository permissions → Contents เป็น Read and write (และเลือก repo ข้อมูลนี้)"};
  if(k==="notfound")return {t:"ไม่พบ repo / branch หรือโทเคนไม่ได้รับสิทธิ์ใน repo นี้",fix:"ตรวจชื่อ repo และ branch และให้โทเคนเลือก repo นี้ใน Repository access"};
  if(k==="rate")return {t:"ใช้โควตา GitHub เกินชั่วคราว",fix:"รอสักครู่ ระบบจะลองใหม่เอง (ข้อมูลที่แก้ไว้ไม่หาย)"};
  if(k==="offline")return {t:"ติดต่อ GitHub ไม่ได้",fix:"ตรวจอินเทอร์เน็ต — ข้อมูลที่แก้ไว้จะถูกส่งอัตโนมัติเมื่อกลับมาออนไลน์"};
  if(k==="conflict"||k==="invalid")return {t:"GitHub ปฏิเสธการบันทึก ("+m+")",fix:"ลองอีกครั้ง ถ้ายังไม่ได้ให้ผู้จัดตรวจ branch ว่าไม่ได้ถูกป้องกัน (branch protection)"};
  if(k==="locked")return {t:m,fix:""};
  return {t:m||"เกิดข้อผิดพลาด",fix:""};
}

/* ================= paths ↔ files ================= */
const encSeg=s=>(s==="."||s===".."?s.replace(/\./g,"~2e~"):s).replace(/[^\w.\-]/g,c=>"~"+c.codePointAt(0).toString(16)+"~");
const decSeg=s=>s.replace(/~([0-9a-f]+)~/g,(m,h)=>String.fromCodePoint(parseInt(h,16)));
const fileOf=p=>"data/"+p.split("/").map(encSeg).join("/")+".json";
const pathOf=f=>f.slice(5,-5).split("/").map(decSeg).join("/");
const contentsUrl=p=>`/repos/${st.cfg.repo}/contents/${fileOf(p).split("/").map(encodeURIComponent).join("/")}`;
const parentOf=p=>p.slice(0,p.lastIndexOf("/"));
const idOf=p=>p.slice(p.lastIndexOf("/")+1);

/* ================= local persistence (IndexedDB; falls back to memory) ================= */
let idb=null;const memKV=new Map(),memBlob=new Map();
function idbOpen(name){return new Promise(res=>{try{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore("blobs");d.createObjectStore("kv");};r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);r.onblocked=()=>res(null);}catch(e){res(null);}});}
function idbDo(store,mode,fn){return new Promise(res=>{if(!idb)return res(undefined);try{const tx=idb.transaction(store,mode),r=fn(tx.objectStore(store));tx.oncomplete=()=>res(r&&("result" in r)?r.result:undefined);tx.onerror=tx.onabort=()=>res(undefined);}catch(e){res(undefined);}});}
const kvGet=async k=>{const v=await idbDo("kv","readonly",s=>s.get(k));return v!==undefined?v:memKV.get(k);};
const kvSet=async(k,v)=>{memKV.set(k,v);await idbDo("kv","readwrite",s=>s.put(v,k));};
const kvDel=async k=>{memKV.delete(k);await idbDo("kv","readwrite",s=>s.delete(k));};
const blobGet=sha=>idbDo("blobs","readonly",s=>s.get(sha));
const blobPut=(sha,t)=>idbDo("blobs","readwrite",s=>s.put(t,sha));
async function blobGC(keep){const keys=await idbDo("blobs","readonly",s=>s.getAllKeys());if(!keys)return;const del=keys.filter(k=>!keep.has(k));if(del.length)await idbDo("blobs","readwrite",s=>{del.forEach(k=>s.delete(k));});}
async function openStore(cfg){if(idb){try{idb.close();}catch(e){}}idb=await idbOpen(`bgo-gh|${cfg.repo}|${cfg.branch}|${cfg.api||""}`);}

/* ================= crypto ================= */
const subtle=(typeof crypto!=="undefined"&&crypto.subtle)||null;
const need=()=>{if(!subtle)throw new GErr("locked","เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส (ต้องเปิดผ่าน https)");};
const ORG_TIER=p=>/^(members|private)\//.test(p),SLIP_TIER=p=>/^slips\//.test(p);
const LOCKED=Symbol("locked");
async function deriveKek(pass,salt,iter){need();const base=await subtle.importKey("raw",enc.encode(String(pass).normalize("NFKC")),"PBKDF2",false,["deriveKey"]);
  return subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt,iterations:iter},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt","wrapKey","unwrapKey"]);}
async function aesEnc(key,bytes,aad){const iv=crypto.getRandomValues(new Uint8Array(12));const p={name:"AES-GCM",iv};if(aad)p.additionalData=enc.encode(aad);return {iv:b64(iv),ct:b64(await subtle.encrypt(p,key,bytes))};}
async function aesDec(key,o,aad){const p={name:"AES-GCM",iv:unb64(o.iv)};if(aad)p.additionalData=enc.encode(aad);return new Uint8Array(await subtle.decrypt(p,key,unb64(o.ct)));}
async function fingerprintOf(jwk){const h=await subtle.digest("SHA-256",enc.encode(jwk.n));return hex(h).slice(0,20).toUpperCase().match(/.{4}/g).join("-");}
async function publicKey(){
  if(st.pubKey)return st.pubKey;
  const m=st.meta;if(!m||!m.pub)throw new GErr("locked","ยังไม่พบกุญแจของผู้จัดใน repo — ให้ผู้จัดตั้งระบบก่อน");
  const fp=await fingerprintOf(m.pub);
  if(st.cfg.fp&&st.cfg.fp!==fp){st.warn="fp";notifyStatus();throw new GErr("locked","กุญแจผู้จัดไม่ตรงกับที่ได้รับเชิญ — ห้ามส่งสลิป (อาจมีการแก้ไขไฟล์ตั้งค่าใน repo) แจ้งผู้จัด");}
  if(!st.cfg.fp&&st.cfg.role!=="org"){st.cfg.fp=fp;saveCfg(st.cfg);}
  st.pubKey=await subtle.importKey("jwk",m.pub,{name:"RSA-OAEP",hash:"SHA-256"},false,["encrypt"]);
  return st.pubKey;
}
const ownCache=new Map();   // path -> {ct,data}: what this device sent as a player (a player cannot decrypt slips, only remember his own)
async function seal(path,data,ownRemember){
  const json=JSON.stringify(data);
  if(ORG_TIER(path)){need();if(!st.keys.kek)throw new GErr("locked","ต้องปลดล็อกด้วยรหัสผ่านผู้จัดก่อนจึงบันทึกข้อมูลส่วนนี้ได้");
    return JSON.stringify({_e:"k1",...await aesEnc(st.keys.kek,enc.encode(json),path)});}
  if(SLIP_TIER(path)){need();const pub=await publicKey();
    const k=await subtle.generateKey({name:"AES-GCM",length:256},true,["encrypt","decrypt"]);
    const x=await aesEnc(k,enc.encode(json),path),wrapped=await subtle.encrypt({name:"RSA-OAEP"},pub,await subtle.exportKey("raw",k));
    const out=JSON.stringify({_e:"r1",k:b64(wrapped),...x});
    if(ownRemember){ownCache.set(path,{ct:x.ct,data:clone(data)});kvSet("own:"+path,{ct:x.ct,data:clone(data)});}
    return out;}
  return json;
}
async function openText(path,text){
  const o=JSON.parse(text);
  if(!o||typeof o!=="object"||!o._e)return o;
  if(o._e==="k1"){if(!st.keys.kek)return LOCKED;try{return JSON.parse(dec.decode(await aesDec(st.keys.kek,o,path)));}catch(e){return LOCKED;}}
  if(o._e==="r1"){
    if(st.keys.priv){try{const raw=await subtle.decrypt({name:"RSA-OAEP"},st.keys.priv,unb64(o.k));
      const k=await subtle.importKey("raw",raw,{name:"AES-GCM"},false,["decrypt"]);return JSON.parse(dec.decode(await aesDec(k,o,path)));}catch(e){return LOCKED;}}
    const own=ownCache.get(path);return own&&own.ct===o.ct?clone(own.data):LOCKED;}
  return LOCKED;
}

/* ================= documents: cache, overlay, subscriptions ================= */
let files=new Map(),docs=new Map(),docSha=new Map(),overlay=new Map(),recent=new Map(),blobMem=new Map(),shaSize=new Map();
const subs=new Set();let dirty=new Set(),flushT=0,queue=[],wseq=0;
function touch(p){dirty.add(p);if(!flushT)flushT=setTimeout(flush,0);}
function flush(){flushT=0;const d=dirty;dirty=new Set();
  for(const s of subs){if(!s.live||!s.first)continue;let hit=false;for(const p of d){if(s.kind==="doc"?p===s.path:parentOf(p)===s.path){hit=true;break;}}if(hit)emit(s);}}
function valueOf(p){if(overlay.has(p)){const o=overlay.get(p);return o.data==null?null:clone(o.data);}const d=docs.get(p);return d===undefined?null:clone(d);}
function listOf(col){
  const n=col.split("/").length+1,ids=new Set();
  for(const p of files.keys())if(p.startsWith(col+"/")&&p.split("/").length===n)ids.add(p);
  for(const p of overlay.keys())if(p.startsWith(col+"/")&&p.split("/").length===n)ids.add(p);
  const out=[];
  for(const p of ids){const v=overlay.has(p)?overlay.get(p).data:docs.get(p);if(v==null)continue;out.push({id:idOf(p),...clone(v)});}
  return out.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
}
function emit(s){let v;try{v=s.kind==="doc"?valueOf(s.path):listOf(s.path);}catch(e){return;}try{s.cb(v);}catch(e){console.error(e);}}
const interested=p=>{for(const s of subs){if(!s.live)continue;if(s.kind==="doc"?s.path===p:parentOf(p)===s.path)return true;}return false;};
let readyRes,readyP;
function resetReady(){readyP=new Promise(r=>readyRes=r);}resetReady();
function markReady(){if(!st.ready){st.ready=true;readyRes();notifyStatus();}}
function sub(kind,path,cb){
  const s={kind,path,cb,live:true,first:false};subs.add(s);
  (async()=>{await readyP;await Promise.race([ensureFor(s),sleep(5000)]);if(!s.live)return;s.first=true;emit(s);})();
  return ()=>{s.live=false;subs.delete(s);};
}
const watchDoc=(p,cb)=>sub("doc",p,cb),watchCol=(p,cb)=>sub("col",p,cb);
function missingFor(s){
  const out=[];
  for(const [p,f] of files){if(overlay.has(p))continue;if(s.kind==="doc"?p!==s.path:parentOf(p)!==s.path)continue;if(docSha.get(p)!==f.sha)out.push(p);}
  return out;
}
const ensureFor=s=>fetchPaths(missingFor(s)).catch(()=>{});
async function ensureAll(){const need=new Set();for(const s of subs)if(s.live)missingFor(s).forEach(p=>need.add(p));if(need.size)await fetchPaths([...need]);}

/* ---- blobs: cache → GraphQL batch (1 request for many files) → REST one by one ---- */
const inflight=new Map();let bq=[],bt=0;
function getBlob(sha){
  if(blobMem.has(sha))return Promise.resolve(blobMem.get(sha));
  if(inflight.has(sha))return inflight.get(sha);
  const p=(async()=>{let t=await blobGet(sha),net=false;
    if(t==null){net=true;t=await new Promise((res,rej)=>{bq.push({sha,res,rej});if(!bt)bt=setTimeout(runBatch,20);});}
    if(t!=null){blobMem.set(sha,t);if(net)blobPut(sha,t);}return t;})().finally(()=>inflight.delete(sha));
  inflight.set(sha,p);return p;
}
async function restBlob(sha){const r=await req("GET",`/repos/${st.cfg.repo}/git/blobs/${sha}`);return dec.decode(unb64(r.data.content));}
async function gqlGroup(items){
  const [o,n]=st.cfg.repo.split("/");
  const q=`query{repository(owner:${JSON.stringify(o)},name:${JSON.stringify(n)}){${items.map((it,i)=>`b${i}:object(oid:"${it.sha}"){...on Blob{text isTruncated isBinary}}`).join(" ")}}}`;
  const r=await req("POST","/graphql",{body:{query:q}});
  const repo=r.data&&r.data.data&&r.data.data.repository;
  if(!repo)throw new GErr("nogql","GraphQL ไม่พร้อมใช้");
  st.gqlFail=0;st.gql=true;
  items.forEach((it,i)=>{const b=repo["b"+i];if(b&&typeof b.text==="string"&&!b.isTruncated&&!b.isBinary)it.res(b.text);else restBlob(it.sha).then(it.res,it.rej);});
}
async function runBatch(){
  bt=0;const items=bq;bq=[];if(!items.length)return;
  const groups=[],single=[];let cur=[],size=0;
  for(const it of items){const sz=shaSize.get(it.sha)||0;
    if(st.gql===false||sz>150000){single.push(it);continue;}
    if(cur.length>=40||size+sz>500000){groups.push(cur);cur=[];size=0;}cur.push(it);size+=sz;}
  if(cur.length)groups.push(cur);
  const one=async it=>{try{it.res(await restBlob(it.sha));}catch(e){it.rej(e);}};
  const tasks=[];
  for(const g of groups)tasks.push(async()=>{
    if(g.length===1)return one(g[0]);                                      // a lone file: plain REST costs the same
    try{await gqlGroup(g);}
    catch(e){
      if(e.kind==="nogql"||e.kind==="forbidden"||e.kind==="invalid"||e.kind==="notfound"||e.kind==="server"){if(++st.gqlFail>=2)st.gql=false;await pool(4,g.map(it=>()=>one(it)));}
      else g.forEach(it=>it.rej(e));}});
  for(const it of single)tasks.push(()=>one(it));
  await pool(3,tasks);
}
async function pool(n,fns){const q=fns.slice();await Promise.all(Array.from({length:Math.min(n,q.length)},async()=>{while(q.length)await q.shift()();}));}
async function fetchPaths(list){
  let firstErr=null;
  await Promise.all(list.map(async p=>{
    const f=files.get(p);if(!f)return;const sha=f.sha;
    try{
      const t=await getBlob(sha);if(t==null)return;
      const cur=files.get(p);if(!cur||cur.sha!==sha)return;
      let v;try{v=await openText(p,t);}catch(e){v=LOCKED;}
      if(v===LOCKED)docs.delete(p);else docs.set(p,v);
      docSha.set(p,sha);touch(p);
    }catch(e){if(!firstErr)firstErr=e;}
  }));
  if(firstErr)throw firstErr;
}

/* ================= reading the repository tree ================= */
function applyTree(nf,t0){
  for(const [p,rw] of recent){
    if(rw.at<=t0)continue;                                   // we wrote this after the listing was requested → the listing may be older than our write
    if(rw.del)nf.delete(p);else if(rw.sha){const f=files.get(p);if(f)nf.set(p,f);}
  }
  for(const [p,rw] of recent)if(Date.now()-rw.at>120000)recent.delete(p);
  const gone=[];for(const p of files.keys())if(!nf.has(p))gone.push(p);
  for(const [p,f] of nf)shaSize.set(f.sha,f.size);
  files=nf;
  {const keep=new Set();for(const f of nf.values())keep.add(f.sha);for(const k of blobMem.keys())if(!keep.has(k))blobMem.delete(k);}
  for(const p of gone){docs.delete(p);docSha.delete(p);if(!overlay.has(p))touch(p);}
}
async function syncTree(){
  const c=st.cfg,t0=Date.now();
  let r;
  try{r=await req("GET",`/repos/${c.repo}/git/trees/${encodeURIComponent(c.branch)}?recursive=1`,{etag:st.treeEtag});}
  catch(e){if(e.kind==="conflict"&&/empty/i.test(e.message))r={status:200,data:{tree:[]},etag:null};else throw e;}
  st.lastSync=Date.now();
  if(r.status===304){st.dupFull=0;return false;}
  if(r.data&&r.data.sha&&r.data.sha===st.rootSha)st.dupFull=(st.dupFull||0)+1;else st.dupFull=0;   // 200 with an unchanged tree = ETag not honoured → poll less often
  st.rootSha=r.data&&r.data.sha||null;
  const nf=new Map();
  for(const e of r.data.tree||[]){if(e.type!=="blob"||!e.path.startsWith("data/")||!e.path.endsWith(".json"))continue;nf.set(pathOf(e.path),{sha:e.sha,size:e.size||0});}
  st.truncated=!!r.data.truncated;
  applyTree(nf,t0);st.treeEtag=r.etag||null;st.syncs++;
  saveTreeCache();
  return true;
}
let treeSaveT=0;
function saveTreeCache(){clearTimeout(treeSaveT);treeSaveT=setTimeout(()=>{kvSet("tree",{etag:st.treeEtag,files:[...files].map(([p,f])=>[p,f.sha,f.size])});
  if(st.syncs%20===1){const keep=new Set([...files.values()].map(f=>f.sha));blobGC(keep);}},300);}
async function loadMeta(){
  if(!files.has("_meta/config"))return;
  const f=files.get("_meta/config");if(docSha.get("_meta/config")!==f.sha){await fetchPaths(["_meta/config"]).catch(()=>{});}
  const m=docs.get("_meta/config");if(m&&m!==st.meta){st.meta=m;st.pubKey=null;}
}

/* ================= polling loop ================= */
let wakeFns=[];
const wake=()=>{const w=wakeFns;wakeFns=[];w.forEach(f=>f());};
const sleepWake=ms=>new Promise(res=>{const t=setTimeout(()=>{wakeFns=wakeFns.filter(x=>x!==done);res();},ms);const done=()=>{clearTimeout(t);res();};wakeFns.push(done);});
function netFail(e){
  st.errN++;
  if(e.kind==="rate"){net("rate",e.message);return e.wait||60000;}
  if(e.kind==="auth"||e.kind==="forbidden"||e.kind==="notfound"){net("auth",explain(e).t);return 60000;}
  if(e.kind==="conflict"||e.kind==="invalid"){net("err",explain(e).t);return 15000;}
  net("offline",explain(e).t);return Math.min(60000,3000*2**Math.min(st.errN,5));
}
function nextDelay(){
  const rem=st.rate&&st.rate.remaining;
  let d=Date.now()-st.lastLocalWrite<60000?3000:5000;
  if((st.dupFull||0)>=3)d=Math.max(d,15000);
  if(rem!=null&&rem<1500)d=Math.max(d,15000);if(rem!=null&&rem<400)d=60000;
  return d*(0.85+Math.random()*0.3);
}
async function cycle(){
  try{await syncTree();await loadMeta();await ensureAll();st.errN=0;if(st.net!=="ok"||st.err)net("ok");else notifyStatus();return 0;}
  catch(e){return netFail(e);}
  finally{markReady();}
}
async function loop(){
  while(st.alive){
    if(document.hidden){await sleepWake(60000);if(!st.alive)break;if(document.hidden)continue;}
    const back=await cycle();
    await sleepWake(back||nextDelay());
  }
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)wake();});
window.addEventListener("online",wake);window.addEventListener("focus",wake);

/* ================= writes: queue ================= */
const persistQueue=()=>kvSet("queue",queue.map(({path,del,seq,text,own})=>({path,del,seq,text,own})));
async function writeOp(path,del,data){
  const plain=del?null:clone(data);
  const text=del?null:await seal(path,plain,st.cfg.role!=="org");
  const seq=++wseq;
  overlay.set(path,{data:plain,seq});st.lastLocalWrite=Date.now();touch(path);
  const op={path,del,seq,text};
  const i=queue.findIndex(q=>q.path===path&&!q.busy);
  if(i>=0)queue[i]=op;else queue.push(op);
  await persistQueue();notifyStatus();pump();
}
function setDoc(path,data){return writeOp(path,false,data);}
function delDoc(path){return writeOp(path,true);}
async function getSha(path){
  try{const r=await req("GET",contentsUrl(path)+`?ref=${encodeURIComponent(st.cfg.branch)}`);return r.data&&r.data.sha||null;}
  catch(e){if(e.kind==="notfound")return null;throw e;}
}
async function doOp(op){
  const c=st.cfg,path=op.path,body={message:`${op.del?"delete":"set"} ${path} · ${c.uid.slice(0,8)}`,branch:c.branch};
  const f=files.get(path);if(f)body.sha=f.sha;
  if(!op.del)body.content=b64(enc.encode(op.text));
  if(op.del&&!f){const cur=await getSha(path);if(!cur)return {gone:true};body.sha=cur;}
  for(let attempt=0;;attempt++){
    try{return await req(op.del?"DELETE":"PUT",contentsUrl(path),{body});}
    catch(e){
      if(e.kind==="notfound"&&op.del)return {gone:true};
      if((e.kind==="conflict"||e.kind==="invalid")&&attempt<6){
        await sleep(250+Math.random()*700*(attempt+1));
        const cur=await getSha(path);                              // the file changed under us (or a parallel commit moved the branch): re-read its sha and retry (last writer wins)
        if(cur==null){if(op.del)return {gone:true};delete body.sha;}else body.sha=cur;
        continue;}
      throw e;}
  }
}
function ack(op,r){
  const p=op.path;
  if(op.del||r.gone){files.delete(p);docs.delete(p);docSha.delete(p);recent.set(p,{at:Date.now(),del:true});}
  else{const sha=r.data&&r.data.content&&r.data.content.sha;
    if(sha){files.set(p,{sha,size:op.text.length});shaSize.set(sha,op.text.length);blobMem.set(sha,op.text);blobPut(sha,op.text);recent.set(p,{at:Date.now(),sha});
      const o=overlay.get(p);if(o&&o.seq===op.seq){docs.set(p,o.data);docSha.set(p,sha);}}}
  const o=overlay.get(p);if(o&&o.seq===op.seq)overlay.delete(p);
  saveTreeCache();
}
let pumping=false;
async function pump(){
  if(pumping||!st.alive||!st.cfg)return;pumping=true;
  try{
    while(queue.length&&st.alive){
      const op=queue[0];op.busy=true;notifyStatus();
      try{
        const gap=900-(Date.now()-st.lastWrite);if(gap>0)await sleep(gap);
        const r=await doOp(op);st.lastWrite=Date.now();
        queue.shift();ack(op,r);await persistQueue();st.errN=0;if(st.net!=="ok")net("ok");else notifyStatus();
      }catch(e){
        op.busy=false;op.fails=(op.fails||0)+1;
        const w=netFail(e);await sleepWake(w);
      }
    }
  }finally{pumping=false;notifyStatus();}
}
function flushQueue(timeout){return new Promise((res,rej)=>{const t0=Date.now();const iv=setInterval(()=>{if(!queue.length){clearInterval(iv);res(true);}else if(timeout&&Date.now()-t0>timeout){clearInterval(iv);res(false);}},50);});}

/* ================= direct reads ================= */
async function readDoc(path){
  await readyP;
  if(overlay.has(path))return valueOf(path);
  try{const r=await req("GET",contentsUrl(path)+`?ref=${encodeURIComponent(st.cfg.branch)}`,{accept:"application/vnd.github.raw+json",raw:true});
    const v=await openText(path,r.text);return v===LOCKED?null:v;}
  catch(e){if(e.kind==="notfound")return null;return valueOf(path);}
}
async function readCol(col){
  await readyP;
  const list=[...files.keys()].filter(p=>parentOf(p)===col&&!overlay.has(p)&&docSha.get(p)!==files.get(p).sha);
  if(list.length)await fetchPaths(list).catch(()=>{});
  return listOf(col);
}

/* ================= start / stop ================= */
async function init(cfg){
  stop();
  st.cfg=cfg;st.alive=true;st.ready=false;st.net="init";st.err="";st.treeEtag=null;st.meta=null;st.pubKey=null;st.warn="";st.errN=0;st.gql=null;st.gqlFail=0;st.syncs=0;
  files=new Map();docs=new Map();docSha=new Map();overlay=new Map();recent=new Map();blobMem=new Map();shaSize=new Map();queue=[];ownCache.clear();
  await openStore(cfg);
  resetReady();
  const tc=await kvGet("tree");
  if(tc&&tc.files){files=new Map(tc.files.map(([p,sha,size])=>[p,{sha,size}]));tc.files.forEach(([p,sha,size])=>shaSize.set(sha,size));st.treeEtag=tc.etag||null;}
  const keys=await kvGet("keys");if(keys&&cfg.role==="org"){st.keys.kek=keys.kek||null;st.keys.priv=keys.priv||null;}
  for(const k of (await idbDo("kv","readonly",s=>s.getAllKeys()))||[])if(String(k).startsWith("own:")){const v=await kvGet(k);if(v)ownCache.set(String(k).slice(4),v);}
  const q=await kvGet("queue");
  if(Array.isArray(q))for(const op of q){queue.push({path:op.path,del:op.del,seq:op.seq,text:op.text});wseq=Math.max(wseq,op.seq||0);
    try{overlay.set(op.path,{data:op.del?null:await openText(op.path,op.text),seq:op.seq});if(overlay.get(op.path).data===LOCKED)overlay.delete(op.path);}catch(e){}}
  if(tc){await loadMetaFromCache();markReady();}
  loop();pump();
  return readyP;
}
async function loadMetaFromCache(){
  const f=files.get("_meta/config");if(!f)return;
  const t=blobMem.get(f.sha)||await blobGet(f.sha);if(!t)return;
  try{st.meta=JSON.parse(t);docs.set("_meta/config",st.meta);docSha.set("_meta/config",f.sha);}catch(e){}
}
function stop(){st.alive=false;wake();for(const s of subs)s.live=false;subs.clear();}

/* ================= organizer: first-time setup, unlock ================= */
async function repoInfo(cfg){
  const r=await req("GET",`/repos/${cfg.repo}`,{},cfg);return r.data;
}
async function fetchMeta(cfg){
  try{const r=await req("GET",`/repos/${cfg.repo}/contents/data/_meta/config.json?ref=${encodeURIComponent(cfg.branch)}`,{accept:"application/vnd.github.raw+json",raw:true},cfg);return JSON.parse(r.text);}
  catch(e){if(e.kind==="notfound"||e.kind==="conflict")return null;throw e;}
}
async function setupOrg({repo,branch,token,api,pass,group,tokenExp}){
  need();
  const cfg={repo:repo.trim(),branch:(branch||"main").trim(),token:token.trim(),api:api||"",tokenExp:tokenExp||""};
  if(!/^[\w.-]+\/[\w.-]+$/.test(cfg.repo))throw new Error("ชื่อ repo ต้องอยู่ในรูป เจ้าของ/ชื่อ เช่น somchai/badminton-data");
  if(!cfg.token)throw new Error("ยังไม่ได้ใส่โทเคน");
  if(String(pass||"").length<8)throw new Error("รหัสผ่านผู้จัดต้องยาวอย่างน้อย 8 ตัวอักษร");
  const info=await repoInfo(cfg);
  if(info&&info.private===false)throw new GErr("public","repo นี้เป็นสาธารณะ (Public) — ทุกคนบนอินเทอร์เน็ตจะอ่านข้อมูลก๊วนได้ ให้เปลี่ยนเป็น Private ก่อน");
  if(info&&info.permissions&&info.permissions.push===false)throw new GErr("forbidden","โทเคนนี้เขียนข้อมูลไม่ได้ (ต้องตั้ง Contents → Read and write)");
  const old=await fetchMeta(cfg);
  if(old)return {exists:true,cfg,meta:old};
  const salt=crypto.getRandomValues(new Uint8Array(16)),iter=310000,kek=await deriveKek(pass,salt,iter);
  const pair=await subtle.generateKey({name:"RSA-OAEP",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["encrypt","decrypt"]);
  const pub=await subtle.exportKey("jwk",pair.publicKey);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const priv=b64(await subtle.wrapKey("pkcs8",pair.privateKey,kek,{name:"AES-GCM",iv}));
  const meta={v:1,createdAt:Date.now(),group:group||"",kdf:{alg:"PBKDF2-SHA256",iter,salt:b64(salt)},verifier:await aesEnc(kek,enc.encode("bgo-ok")),pub:{kty:pub.kty,n:pub.n,e:pub.e,alg:"RSA-OAEP-256",ext:true,key_ops:["encrypt"]},priv:{iv:b64(iv),wrapped:priv}};
  const body={message:"setup · สร้างระบบก๊วน",branch:cfg.branch,content:b64(enc.encode(JSON.stringify(meta)))};
  await req("PUT",`/repos/${cfg.repo}/contents/data/_meta/config.json`,{body},cfg);
  const full={...cfg,uid:newUid(),role:"org",fp:await fingerprintOf(meta.pub),name:""};
  await openStore(full);
  const keys=await unwrapKeys(meta,kek);
  await kvSet("keys",keys);
  return {exists:false,cfg:full,meta};
}
async function unwrapKeys(meta,kek){
  const priv=await subtle.unwrapKey("pkcs8",unb64(meta.priv.wrapped),kek,{name:"AES-GCM",iv:unb64(meta.priv.iv)},{name:"RSA-OAEP",hash:"SHA-256"},false,["decrypt"]);
  return {kek,priv};
}
/* open an existing system as organizer (new phone / after clearing data) */
async function unlockOrg(cfg,pass,remember){
  need();
  const meta=await fetchMeta(cfg);
  if(!meta)throw new Error("ยังไม่พบระบบก๊วนใน repo นี้ — ผู้จัดต้องตั้งค่าครั้งแรกก่อน");
  const kek=await deriveKek(pass,unb64(meta.kdf.salt),meta.kdf.iter);
  let ok=false;try{ok=dec.decode(await aesDec(kek,meta.verifier))==="bgo-ok";}catch(e){}
  if(!ok)throw new Error("รหัสผ่านผู้จัดไม่ถูกต้อง");
  const keys=await unwrapKeys(meta,kek);
  await openStore(cfg);
  if(remember!==false)await kvSet("keys",keys);
  st.keys=keys;
  return {fp:await fingerprintOf(meta.pub),meta};
}
async function hasSavedKeys(cfg){await openStore(cfg);const k=await kvGet("keys");return !!(k&&k.kek&&k.priv);}
async function forgetKeys(){await kvDel("keys");st.keys={kek:null,priv:null};}
async function fingerprint(){await readyP;return st.meta&&st.meta.pub?fingerprintOf(st.meta.pub):"";}

/* ================= self-test (what a person sees when something does not work) ================= */
async function selfTest(cfg){
  cfg=cfg||st.cfg;const out=[];
  const T=async(title,fn,optional)=>{try{const d=await fn();out.push({ok:true,title,detail:d||""});return true;}catch(e){const x=explain(e);out.push({ok:false,optional:!!optional,title,detail:x.t,fix:x.fix});return false;}};
  let info=null;
  if(!await T("โทเคนใช้งานได้ และเห็น repo",async()=>{info=await repoInfo(cfg);return info.full_name;}))return out;
  await T("repo เป็น Private (ไม่มีคนนอกอ่านได้)",async()=>{if(info.private!==true)throw new GErr("x","repo เป็น Public — ใครก็อ่านข้อมูลก๊วนได้");return "Private";});
  await T("สิทธิ์เขียนข้อมูล",async()=>{if(info.permissions&&info.permissions.push===false)throw new GErr("forbidden","โทเคนอ่านได้อย่างเดียว");return "Contents: Read and write";});
  if(!await T(`branch "${cfg.branch}" มีอยู่`,async()=>{await req("GET",`/repos/${cfg.repo}/branches/${encodeURIComponent(cfg.branch)}`,{},cfg);return "พบ";}))return out;
  await T("อ่านรายการข้อมูลทั้งหมด",async()=>{try{const r=await req("GET",`/repos/${cfg.repo}/git/trees/${encodeURIComponent(cfg.branch)}?recursive=1`,{},cfg);return `${(r.data.tree||[]).filter(e=>e.type==="blob").length} ไฟล์`+(r.data.truncated?" (ถูกตัด — ข้อมูลใหญ่เกินไป)":"");}catch(e){if(e.kind==="conflict")return "repo ว่าง";throw e;}});
  const tp=`data/_selftest/${(cfg.uid||"x").slice(0,10)}.json`,url=`/repos/${cfg.repo}/contents/${tp}`;let sha=null;
  const stamp=String(Date.now());
  if(await T("เขียนไฟล์ทดสอบ",async()=>{try{const g=await req("GET",url+`?ref=${encodeURIComponent(cfg.branch)}`,{},cfg);sha=g.data.sha;}catch(e){if(e.kind!=="notfound")throw e;}
      const r=await req("PUT",url,{body:{message:"selftest",branch:cfg.branch,content:b64(enc.encode(JSON.stringify({t:stamp}))),...(sha?{sha}:{})}},cfg);sha=r.data.content.sha;return "เขียนสำเร็จ";})){
    await T("อ่านไฟล์ทดสอบกลับมาตรงกัน",async()=>{const r=await req("GET",url+`?ref=${encodeURIComponent(cfg.branch)}`,{accept:"application/vnd.github.raw+json",raw:true},cfg);if(JSON.parse(r.text).t!==stamp)throw new GErr("x","อ่านได้ค่าที่ไม่ตรงกับที่เขียน");return "ตรงกัน";});
    await T("ลบไฟล์ทดสอบ",async()=>{await req("DELETE",url,{body:{message:"selftest cleanup",branch:cfg.branch,sha}},cfg);return "ลบแล้ว";});
  }
  await T("ดึงข้อมูลหลายไฟล์ในคำขอเดียว (GraphQL)",async()=>{const r=await req("POST","/graphql",{body:{query:"query{viewer{login}}"}},cfg);if(!r.data||!r.data.data)throw new GErr("x","ใช้ไม่ได้");return "ใช้ได้";},true);
  await T("โควตา GitHub ที่เหลือ",async()=>{const r=await req("GET","/rate_limit",{},cfg);const c=r.data.resources.core;return `${c.remaining}/${c.limit} คำขอต่อชั่วโมง`;},true);
  await T("การเข้ารหัสในเครื่องนี้",async()=>{need();return "พร้อม";});
  return out;
}

/* quick access check used by the connect screens (no writes) */
async function check(cfg){
  const info=await repoInfo(cfg);
  try{await req("GET",`/repos/${cfg.repo}/branches/${encodeURIComponent(cfg.branch)}`,{},cfg);}
  catch(e){if(e.kind==="notfound")throw new GErr("notfound",`ไม่พบ branch "${cfg.branch}" ใน repo นี้`);throw e;}
  return {private:info.private,push:!(info.permissions&&info.permissions.push===false)};
}
/* forget everything stored on this device for the current connection */
async function wipeLocal(cfg){
  stop();const name=`bgo-gh|${cfg.repo}|${cfg.branch}|${cfg.api||""}`;
  if(idb){try{idb.close();}catch(e){}idb=null;}
  await new Promise(res=>{try{const r=indexedDB.deleteDatabase(name);r.onsuccess=r.onerror=r.onblocked=()=>res();}catch(e){res();}});
  memKV.clear();clearCfg();
}

/* token replaced (after rotation) */
function updateToken(token,fp,exp){const c=st.cfg;if(!c)return;c.token=token;if(fp)c.fp=fp;if(exp!==undefined)c.tokenExp=exp||"";saveCfg(c);st.errN=0;net("init");wake();pump();}

return {loadCfg,saveCfg,clearCfg,newUid,makeInvite,parseInvite,explain,
  init,stop,status,onStatus:f=>{statusSubs.add(f);return ()=>statusSubs.delete(f);},wake,
  watchDoc,watchCol,readDoc,readCol,setDoc,delDoc,flush:flushQueue,
  setupOrg,unlockOrg,hasSavedKeys,forgetKeys,fingerprint,selfTest,updateToken,check,wipeLocal,
  get cfg(){return st.cfg;},get ready(){return readyP;},get meta(){return st.meta;},
  retry(){st.errN=0;wake();},
  discardQueue(){queue=[];overlay.clear();persistQueue();notifyStatus();},
  _dbg:{st,get files(){return files;},get docs(){return docs;},get queue(){return queue;},get overlay(){return overlay;},get inflight(){return inflight;},get bq(){return bq;},get subs(){return subs;},get docSha(){return docSha;}}};
})();
