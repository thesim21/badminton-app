/* qrshare.js — QR pictures the organizer can save or send to the LINE group.
   - join QR: the invite link as a QR picture
   - pay QR: a QR the organizer saved (a screenshot from the bank app) or one built from a PromptPay number, optionally with the amount
   Pure browser code: canvas → PNG → Web Share (files) or a normal download. Nothing leaves the phone except what the user shares. */
"use strict";
const QRS=(()=>{
  /* ---- PromptPay (EMVCo / Thai QR Payment) ---- */
  function crc16(str){let c=0xFFFF;for(let i=0;i<str.length;i++){c^=str.charCodeAt(i)<<8;for(let b=0;b<8;b++)c=(c&0x8000)?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF;}return c.toString(16).toUpperCase().padStart(4,"0");}
  const tlv=(t,v)=>t+String(v.length).padStart(2,"0")+v;
  /* id: mobile number (0812345678), national / tax id (13 digits) or e-wallet id (15 digits). amount: baht, omitted = the payer types it. */
  function ppValid(id){const d=String(id||"").replace(/[^0-9]/g,"");return /^0\d{9}$/.test(d)||/^\d{13}$/.test(d)||/^\d{15}$/.test(d)?d:"";}
  function ppPayload(id,amount){
    const d=ppValid(id);if(!d)throw new Error("เลขพร้อมเพย์ไม่ถูกต้อง (เบอร์มือถือ 10 หลัก, เลขบัตรประชาชน/ภาษี 13 หลัก หรือ e-Wallet 15 หลัก)");
    const sub=d.length===10?tlv("01","0066"+d.slice(1)):d.length===13?tlv("02",d):tlv("03",d);
    const amt=+amount>0?(Math.round(+amount*100)/100).toFixed(2):"";
    const p=tlv("00","01")+tlv("01",amt?"12":"11")+tlv("29",tlv("00","A000000677010111")+sub)+tlv("53","764")+(amt?tlv("54",amt):"")+tlv("58","TH")+"6304";
    return p+crc16(p);
  }
  /* ---- QR picture ---- */
  async function ensureLib(){if(!window.qrcode)await loadScript("lib/qrcode.js");}
  async function fontsReady(){try{await Promise.all([document.fonts.load('600 40px "IBM Plex Sans Thai"'),document.fonts.load('400 28px "IBM Plex Sans Thai"')]);}catch(e){}}
  function wrap(ctx,text,maxW){const out=[];String(text||"").split("\n").forEach(par=>{let line="";for(const ch of par){const t=line+ch;if(ctx.measureText(t).width>maxW&&line){out.push(line);line=ch;}else line=t;}out.push(line);});return out;}
  /* a white card: title, the QR, then lines of text — returns a canvas */
  async function card({text,title,lines,img,size}){
    await fontsReady();title=TT(title);lines=(lines||[]).map(TT);
    const W=720,pad=48,qrSize=size||520;let qrCv=null;
    if(text){await ensureLib();const qr=qrcode(0,"M");qr.addData(text);qr.make();const n=qr.getModuleCount(),cell=Math.floor(qrSize/(n+8)),px=cell*(n+8);
      qrCv=document.createElement("canvas");qrCv.width=qrCv.height=px;const q=qrCv.getContext("2d");q.fillStyle="#fff";q.fillRect(0,0,px,px);q.fillStyle="#000";
      for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))q.fillRect((c+4)*cell,(r+4)*cell,cell,cell);}
    const probe=document.createElement("canvas").getContext("2d");
    probe.font='600 44px "IBM Plex Sans Thai",sans-serif';const tl=wrap(probe,title,W-pad*2);
    probe.font='400 30px "IBM Plex Sans Thai",sans-serif';const ls=[];(lines||[]).forEach(l=>wrap(probe,l,W-pad*2).forEach(x=>ls.push(x)));
    let pic=null,pw=0,ph=0;
    if(img){pic=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("img"));i.src=img;});const k=Math.min((W-pad*2)/pic.width,760/pic.height,1.6);pw=Math.round(pic.width*k);ph=Math.round(pic.height*k);}
    const H=pad+tl.length*58+20+(qrCv?qrCv.width:ph)+24+ls.length*42+pad;
    const cv=document.createElement("canvas");cv.width=W;cv.height=H;const x=cv.getContext("2d");
    x.fillStyle="#fff";x.fillRect(0,0,W,H);x.fillStyle="#16329A";x.fillRect(0,0,W,14);
    x.textAlign="center";x.textBaseline="alphabetic";let y=pad+30;
    x.fillStyle="#0E1B3F";x.font='600 44px "IBM Plex Sans Thai",sans-serif';tl.forEach(l=>{x.fillText(l,W/2,y);y+=58;});y+=-10;
    if(qrCv){x.drawImage(qrCv,(W-qrCv.width)/2,y);y+=qrCv.width+24;}
    else if(pic){x.drawImage(pic,(W-pw)/2,y,pw,ph);y+=ph+24;}
    x.fillStyle="#3A4670";x.font='400 30px "IBM Plex Sans Thai",sans-serif';y+=22;ls.forEach(l=>{x.fillText(l,W/2,y);y+=42;});
    return cv;
  }
  const toBlob=cv=>new Promise((ok,no)=>cv.toBlob(b=>b?ok(b):no(new Error("png")),"image/png"));
  async function cardBlob(o){return toBlob(await card(o));}
  /* send the picture to another app (LINE, camera roll…); falls back to saving the file */
  async function share(blob,filename,text){
    text=TT(text);const file=new File([blob],filename,{type:blob.type||"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],text:text||""});return "shared";}catch(e){if(e&&e.name==="AbortError")return "cancel";}}
    save(blob,filename);return "saved";
  }
  function save(blob,filename){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
  /* a picked image → small data URL that fits in one data file (the bank QR must stay sharp, so PNG first) */
  async function shrink(file){
    const url=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error("read"));r.readAsDataURL(file);});
    const im=await new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error("ไฟล์นี้ไม่ใช่รูปภาพ"));i.src=url;});
    for(const [side,type,q] of [[720,"image/png"],[720,"image/jpeg",.92],[560,"image/jpeg",.88],[420,"image/jpeg",.85]]){
      const k=Math.min(1,side/Math.max(im.width,im.height)),cv=document.createElement("canvas");cv.width=Math.round(im.width*k);cv.height=Math.round(im.height*k);
      const x=cv.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,cv.width,cv.height);x.drawImage(im,0,0,cv.width,cv.height);
      const d=cv.toDataURL(type,q);if(d.length<=230000)return d;}
    throw new Error("รูปใหญ่เกินไป — ครอบรูปให้เหลือเฉพาะ QR แล้วลองใหม่");
  }
  const dataToBlob=d=>{const [h,b]=d.split(",");const mime=(/data:([^;]+)/.exec(h)||[])[1]||"image/png";const bin=atob(b),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:mime});};
  return {crc16,ppValid,ppPayload,card,cardBlob,share,save,shrink,dataToBlob};
})();
