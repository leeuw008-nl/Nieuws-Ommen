export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // Helper om VAPID keys te vinden (ondersteunt beide namen)
    const VAPID_PRIVATE = env.VAPID_PRIVATE_KEY || env.VAPID_PRIVATE;
    const VAPID_PUBLIC = env.VAPID_PUBLIC_KEY || env.VAPID_PUBLIC || env.VAPID_PUBLIC_KET;
    const VAPID_SUBJECT = env.VAPID_SUBJECT || "mailto:Leeuw008@gmail.com";

    const getSubs = async () => {
      const list = await env.PUSH_SUBS.list();
      let subs = [];
      for (const key of list.keys) {
        const v = await env.PUSH_SUBS.get(key.name, "json");
        if (v) subs.push({ id: key.name, ...v });
      }
      return subs;
    };

    if (url.pathname === "/send") {
      const title = url.searchParams.get("title") || "Nieuw Ommen nieuws!";
      const body = url.searchParams.get("body") || "Er is een nieuw artikel geplaatst";
      const link = url.searchParams.get("url") || "https://leeuw008-nl.github.io/Nieuws-Ommen/";
      const sourceFilter = url.searchParams.get("source");
      let subs = await getSubs();
      if (sourceFilter) {
        subs = subs.filter(s => !s.sources || s.sources.length===0 || s.sources.includes(sourceFilter));
      }
      const payload = JSON.stringify({ title, body, url: link });
      let sent=0, failed=0, errors=[];
      for (const sub of subs) {
        try { if (await sendPush(sub, payload, { VAPID_PRIVATE, VAPID_PUBLIC, VAPID_SUBJECT })) sent++; else failed++; }
        catch(e){ failed++; errors.push(String(e).slice(0,400)); }
      }
      return new Response(JSON.stringify({ ok:true, sent, failed, total:subs.length, filter: sourceFilter||"alle", keys_found: !!VAPID_PRIVATE && !!VAPID_PUBLIC, errors }), { headers:{...cors, "Content-Type":"application/json"} });
    }

    if (url.pathname === "/push-article" || url.pathname === "/send-link") {
      const articleUrl = url.searchParams.get("url");
      if (!articleUrl) return new Response("geef ?url= mee", { status:400, headers:cors });
      let title="Nieuw artikel", body="Tik om te lezen";
      try {
        const r = await fetch(articleUrl, { headers:{ "User-Agent":"Mozilla/5.0 OmmenNieuws" }});
        const html = await r.text();
        const og = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
        const tt = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (og) title=og[1]; else if (tt) title=tt[1].trim().slice(0,120);
        const ogd = html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i) || html.match(/name=["']description["']\s+content=["']([^"']+)["']/i);
        if (ogd) body=ogd[1].slice(0,150);
      } catch {}
      const newUrl = new URL(url.origin + "/send");
      newUrl.searchParams.set("title", title); newUrl.searchParams.set("body", body); newUrl.searchParams.set("url", articleUrl);
      const src=url.searchParams.get("source"); if (src) newUrl.searchParams.set("source", src);
      return this.fetch(new Request(newUrl, request), env, ctx);
    }

    if (url.pathname === "/test") {
      const subs = await getSubs();
      const payload = JSON.stringify({ title:"Test Ommen Nieuws ✅", body:"Als je dit ziet werkt push! " + new Date().toLocaleTimeString("nl-NL"), url:"https://leeuw008-nl.github.io/Nieuws-Ommen/" });
      let sent=0, failed=0, errors=[];
      for (const sub of subs) {
        try { if (await sendPush(sub, payload, { VAPID_PRIVATE, VAPID_PUBLIC, VAPID_SUBJECT })) sent++; else failed++; }
        catch(e){ failed++; errors.push(String(e).slice(0,500)); }
      }
      return new Response(JSON.stringify({ sent, failed, total:subs.length, keys_found: !!VAPID_PRIVATE && !!VAPID_PUBLIC, VAPID_PUBLIC_len: VAPID_PUBLIC?.length, errors }), { headers:{...cors, "Content-Type":"application/json"} });
    }

    if (url.pathname === "/debug") {
      const subs = await getSubs();
      return new Response(JSON.stringify({ count:subs.length, keys_found: !!VAPID_PRIVATE && !!VAPID_PUBLIC, subject: VAPID_SUBJECT, subs: subs.map(s=>({ id:s.id.slice(0,8), endpoint:s.endpoint?.slice(0,50), sources:s.sources||"alle"})) }, null,2), { headers:{...cors, "Content-Type":"application/json"} });
    }

    if (url.pathname === "/subscribe" && request.method==="POST") {
      const data = await request.json(); const id=crypto.randomUUID();
      await env.PUSH_SUBS.put(id, JSON.stringify(data));
      return new Response(JSON.stringify({ ok:true, id }), { headers:{...cors, "Content-Type":"application/json"} });
    }
    if (url.pathname === "/unsubscribe" && request.method==="POST") {
      const { endpoint } = await request.json(); const subs = await getSubs();
      for (const s of subs) if (s.endpoint===endpoint) await env.PUSH_SUBS.delete(s.id);
      return new Response(JSON.stringify({ ok:true }), { headers:{...cors, "Content-Type":"application/json"} });
    }
    return new Response("OK - gebruik /test /debug /send", { headers:cors });
  }
};

function b64urlToU8(s){ s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="="; return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); }
function u8ToB64url(u){ return btoa(String.fromCharCode(...u)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function concat(...arrs){ const l=arrs.reduce((n,a)=>n+a.length,0); const r=new Uint8Array(l); let o=0; for(const a of arrs){ r.set(a,o); o+=a.length; } return r; }
async function hkdfExtract(salt, ikm){ const k=await crypto.subtle.importKey("raw", salt, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]); return new Uint8Array(await crypto.subtle.sign("HMAC", k, ikm)); }
async function hkdfExpand(prk, info, len){
  const k=await crypto.subtle.importKey("raw", prk, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const out=new Uint8Array(len); let t=new Uint8Array(0), pos=0, ctr=1;
  while(pos<len){ const data=concat(t, info, new Uint8Array([ctr])); const sig=new Uint8Array(await crypto.subtle.sign("HMAC", k, data)); t=sig; const take=Math.min(t.length, len-pos); out.set(t.slice(0,take), pos); pos+=take; ctr++; }
  return out;
}
async function sendPush(sub, payload, keys){
  const { VAPID_PRIVATE, VAPID_PUBLIC, VAPID_SUBJECT } = keys;
  if (!VAPID_PRIVATE || !VAPID_PUBLIC) throw new Error("VAPID keys niet gevonden - check Cloudflare Variables");
  const endpoint=sub.endpoint, p256dh=sub.keys.p256dh, auth=sub.keys.auth;
  if (!endpoint || !p256dh || !auth) throw new Error("Sub mist keys");

  const aud=new URL(endpoint).origin;
  const exp=Math.floor(Date.now()/1000)+12*3600;
  const enc=(o)=>u8ToB64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned=`${enc({typ:"JWT", alg:"ES256"})}.${enc({aud, exp, sub:VAPID_SUBJECT})}`;
  const privU8=b64urlToU8(VAPID_PRIVATE);
  const pubU8=b64urlToU8(VAPID_PUBLIC);
  const x=pubU8.slice(1,33), y=pubU8.slice(33,65);
  const jwk={kty:"EC", crv:"P-256", d:u8ToB64url(privU8), x:u8ToB64url(x), y:u8ToB64url(y), ext:true};
  const vapidKey=await crypto.subtle.importKey("jwk", jwk, {name:"ECDSA", namedCurve:"P-256"}, false, ["sign"]);
  const sigBuf=await crypto.subtle.sign({name:"ECDSA", hash:{name:"SHA-256"}}, vapidKey, new TextEncoder().encode(unsigned));
  const derToJose=(der)=>{
    const u=new Uint8Array(der); let off=2; if (u[3]>127) off=3;
    off++; let rLen=u[off++]; let r=u.slice(off, off+rLen); off+=rLen; off++; let sLen=u[off++]; let s=u.slice(off, off+sLen);
    if (r[0]==0) r=r.slice(1); if (s[0]==0) s=s.slice(1);
    const rp=new Uint8Array(32); rp.set(r, 32-r.length); const sp=new Uint8Array(32); sp.set(s, 32-s.length);
    return concat(rp, sp);
  };
  const jwt=`${unsigned}.${u8ToB64url(derToJose(sigBuf))}`;

  const salt=crypto.getRandomValues(new Uint8Array(16));
  const localKP=await crypto.subtle.generateKey({name:"ECDH", namedCurve:"P-256"}, true, ["deriveBits"]);
  const localPubRaw=new Uint8Array(await crypto.subtle.exportKey("raw", localKP.publicKey));
  const remotePubU8=b64urlToU8(p256dh);
  const remoteJwk={kty:"EC", crv:"P-256", x:u8ToB64url(remotePubU8.slice(1,33)), y:u8ToB64url(remotePubU8.slice(33,65)), ext:true};
  const remotePubKey=await crypto.subtle.importKey("jwk", remoteJwk, {name:"ECDH", namedCurve:"P-256"}, true, []);
  const ecdhSecret=new Uint8Array(await crypto.subtle.deriveBits({name:"ECDH", public:remotePubKey}, localKP.privateKey, 256));
  const authU8=b64urlToU8(auth);
  const keyInfo=concat(new TextEncoder().encode("WebPush: info\0"), remotePubU8, localPubRaw);
  const prk=await hkdfExtract(authU8, ecdhSecret);
  const ikm=await hkdfExpand(prk, keyInfo, 32);
  const prk2=await hkdfExtract(salt, ikm);
  const cek=await hkdfExpand(prk2, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce=await hkdfExpand(prk2, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);
  const plain=concat(new TextEncoder().encode(payload), new Uint8Array([2]));
  const aesKey=await crypto.subtle.importKey("raw", cek, {name:"AES-GCM"}, false, ["encrypt"]);
  const encData=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM", iv:nonce}, aesKey, plain));
  const rs=new Uint8Array(4); new DataView(rs.buffer).setUint32(0,4096);
  const headerAes=concat(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw);
  const bodyFinal=concat(headerAes, encData);

  const res=await fetch(endpoint, { method:"POST", headers:{ "Content-Encoding":"aes128gcm", "Content-Type":"application/octet-stream", "TTL":"86400", "Authorization":`vapid t=${jwt}, k=${VAPID_PUBLIC}` }, body:bodyFinal });
  if (!res.ok) throw new Error(`Push failed ${res.status} ${await res.text().catch(()=>"")}`);
  return true;
}
