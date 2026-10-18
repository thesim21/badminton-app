/* Offline shell for the installed app: open instantly from cache, refresh files in the background.
   Data is never cached here — it lives in IndexedDB (ghstore.js) and comes from the GitHub API. */
const C="bgo-shell-v2";
const FILES=["./","index.html","player.html","boot.js","ghstore.js","ghui.js","core.js","organizer.js","player.js","style.css","fonts.css","manifest-org.json","manifest-player.json",
  "icon-192.png","icon-512.png","apple-touch-icon.png","lib/qrcode.js","lib/xlsx.full.min.js",
  "fonts/kanit-thai-500-normal.woff2","fonts/kanit-latin-500-normal.woff2","fonts/kanit-thai-600-normal.woff2","fonts/kanit-latin-600-normal.woff2","fonts/kanit-thai-700-normal.woff2","fonts/kanit-latin-700-normal.woff2",
  "fonts/kanit-thai-600-italic.woff2","fonts/kanit-latin-600-italic.woff2","fonts/kanit-thai-700-italic.woff2","fonts/kanit-latin-700-italic.woff2",
  "fonts/ibm-plex-sans-thai-thai-400-normal.woff2","fonts/ibm-plex-sans-thai-latin-400-normal.woff2","fonts/ibm-plex-sans-thai-thai-500-normal.woff2","fonts/ibm-plex-sans-thai-latin-500-normal.woff2",
  "fonts/ibm-plex-sans-thai-thai-600-normal.woff2","fonts/ibm-plex-sans-thai-latin-600-normal.woff2"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(FILES.map(f=>c.add(new Request(f,{cache:"reload"})).catch(()=>{})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  const u=new URL(e.request.url);if(u.origin!==location.origin)return;     // GitHub API calls are never intercepted
  e.respondWith(caches.open(C).then(async c=>{
    const hit=await c.match(e.request,{ignoreSearch:true});
    const net=fetch(e.request,{cache:"no-cache"}).then(r=>{if(r.ok)c.put(e.request,r.clone());return r;}).catch(()=>hit);
    return hit||net;
  }));
});
