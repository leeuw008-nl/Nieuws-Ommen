export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const getSubs = async () => {
      const list = await env.PUSH_SUBS.list();
      let subs = [];
      for (const key of list.keys) {
        const v = await env.PUSH_SUBS.get(key.name, "json");
        if (v) subs.push({ id: key.name, ...v });
      }
      return subs;
    };

    // === /send?title=&body=&url=&source= ===
    if (url.pathname === "/send") {
      const title = url.searchParams.get("title") || "Nieuw Ommen nieuws!";
      const body = url.searchParams.get("body") || "Er is een nieuw artikel geplaatst";
      const link = url.searchParams.get("url") || "https://leeuw008-nl.github.io/Nieuws-Ommen/";
      const sourceFilter = url.searchParams.get("source");

      let subs = await getSubs();
      if (sourceFilter) {
        subs = subs.filter(s => {
          if (!s.sources || s.sources.length === 0) return true;
          return s.sources.includes(sourceFilter);
        });
      }

      const payload = JSON.stringify({ title, body, url: link });
      let sent = 0, failed = 0, errors = [];
      for (const sub of subs) {
        try {
          const ok = await sendPush(sub, payload, env);
          if (ok) sent++; else { failed++; errors.push("false"); }
        } catch (e) { failed++; errors.push(String(e).slice(0,200)); }
      }
      return new Response(JSON.stringify({ ok: true, sent, failed, total: subs.length, filter: sourceFilter || "alle", errors: errors.slice(0,3) }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // === /push-article?url= ===
    if (url.pathname === "/push-article" || url.pathname === "/send-link") {
      const articleUrl = url.searchParams.get("url");
      if (!articleUrl) return new Response("geef ?url= mee", { status: 400, headers: cors });
      let title = "Nieuw artikel", body = "Tik om te lezen";
      try {
        const r = await fetch(articleUrl, { headers: { "User-Agent": "Mozilla/5.0 OmmenNieuws/1.0" } });
        const html = await r.text();
        const ogTitle = html.match(/property=["']og:title["']\s+content=["']([^"']+)["']/i);
        const tTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (ogTitle) title = ogTitle[1]; else if (tTitle) title = tTitle[1].trim().slice(0,120);
        const ogDesc = html.match(/property=["']og:description["']\s+content=["']([^"']+)["']/i) || html.match(/name=["']description["']\s+content=["']([^"']+)["']/i);
        if (ogDesc) body = ogDesc[1].slice(0,150);
      } catch {}
      const newUrl = new URL(url.origin + "/send");
      newUrl.searchParams.set("title", title);
      newUrl.searchParams.set("body", body);
      newUrl.searchParams.set("url", articleUrl);
      const src = url.searchParams.get("source");
      if (src) newUrl.searchParams.set("source", src);
      return this.fetch(new Request(newUrl, request), env, ctx);
    }

    if (url.pathname === "/test") {
      const subs = await getSubs();
      const payload = JSON.stringify({ title: "Test Ommen Nieuws ✅", body: "Als je dit ziet werkt push! " + new Date().toLocaleTimeString("nl-NL"), url: "https://leeuw008-nl.github.io/Nieuws-Ommen/" });
      let sent = 0, failed = 0, errors = [];
      for (const sub of subs) {
        try { if (await sendPush(sub, payload, env)) sent++; else failed++; } catch (e) { failed++; errors.push(String(e).slice(0,300)); }
      }
      return new Response(JSON.stringify({ sent, failed, total: subs.length, errors }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/debug") {
      const subs = await getSubs();
      return new Response(JSON.stringify({ count: subs.length, subs: subs.map(s => ({ id: s.id.slice(0,8), endpoint: s.endpoint?.slice(0,50), sources: s.sources || "alle" })) }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/subscribe" && request.method === "POST") {
      const data = await request.json();
      const id = crypto.randomUUID();
      await env.PUSH_SUBS.put(id, JSON.stringify(data));
      return new Response(JSON.stringify({ ok: true, id }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/unsubscribe" && request.method === "POST") {
      const { endpoint } = await request.json();
      const subs = await getSubs();
      for (const s of subs) if (s.endpoint === endpoint) await env.PUSH_SUBS.delete(s.id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response("Ommen Push Worker OK - /send?title=&body=&url=&source= | /push-article?url= | /test | /debug", { headers: cors });
  }
};

// ---- Web Push implementatie voor Cloudflare Workers (aes128gcm) ----
function b64urlToU8(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
function u8ToB64url(u) { return btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function concat(...arrs) { const l = arrs.reduce((n,a)=>n+a.length,0); const r = new Uint8Array(l); let o=0; for (const a of arrs){ r.set(a,o); o+=a.length; } return r; }

async function hkdfExtract(salt, ikm) {
  const key = await crypto.subtle.importKey("raw", salt, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const prk = await crypto.subtle.sign("HMAC", key, ikm);
  return new Uint8Array(prk);
}
async function hkdfExpand(prk, info, len) {
  const key = await crypto.subtle.importKey("raw", prk, {name:"HMAC", hash:"SHA-256"}, false, ["sign"]);
  const out = new Uint8Array(len);
  let t = new Uint8Array(0); let pos=0; let counter=1;
  while (pos < len) {
    const data = concat(t, info, new Uint8Array([counter]));
    const sig = await crypto.subtle.sign("HMAC", key, data);
    t = new Uint8Array(sig);
    const take = Math.min(t.length, len-pos);
    out.set(t.slice(0,take), pos); pos+=take; counter++;
  }
  return out;
}

async function sendPush(sub, payload, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) throw new Error("VAPID keys ontbreken in env");
  const endpoint = sub.endpoint;
  const p256dh = sub.keys.p256dh;
  const auth = sub.keys.auth;
  if (!endpoint || !p256dh || !auth) throw new Error("Sub mist keys");

  // 1. VAPID JWT maken
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now()/1000) + 12*3600;
  const header = { typ: "JWT", alg: "ES256" };
  const body = { aud, exp, sub: env.VAPID_SUBJECT || "mailto:info@ommen-nieuws.nl" };
  const enc = (o) => u8ToB64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(body)}`;
  // private key importeren (P-256)
  const privU8 = b64urlToU8(env.VAPID_PRIVATE_KEY);
  // pub key nodig voor JWK: x,y uit public key
  const pubU8 = b64urlToU8(env.VAPID_PUBLIC_KEY);
  // pub is uncompressed 0x04 + x(32) + y(32)
  const x = pubU8.slice(1,33), y = pubU8.slice(33,65);
  const jwk = { kty:"EC", crv:"P-256", d: u8ToB64url(privU8), x: u8ToB64url(x), y: u8ToB64url(y), ext:true };
  const vapidKey = await crypto.subtle.importKey("jwk", jwk, { name:"ECDSA", namedCurve:"P-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign({ name:"ECDSA", hash:{name:"SHA-256"} }, vapidKey, new TextEncoder().encode(unsigned));
  // convert der? ECDSA sign geeft r||s als raw? WebCrypto geeft ASN.1 DER, moet naar JOSE. We doen DER->JOSE
  const derToJose = (der) => {
    const u = new Uint8Array(der);
    // simpel parser voor 2 integers
    let offset=2; // SEQ
    if (u[offset+1] & 0x80) offset+=2; // long form skip
    // r
    offset++; // 0x02
    let rLen = u[offset++]; let r = u.slice(offset, offset+rLen); offset+=rLen;
    offset++; // 0x02
    let sLen = u[offset++]; let s = u.slice(offset, offset+sLen);
    // trim leading 0
    if (r[0]==0) r=r.slice(1); if (s[0]==0) s=s.slice(1);
    const rPadded = new Uint8Array(32); rPadded.set(r, 32-r.length);
    const sPadded = new Uint8Array(32); sPadded.set(s, 32-s.length);
    return concat(rPadded, sPadded);
  };
  const joseSig = derToJose(sigBuf);
  const jwt = `${unsigned}.${u8ToB64url(joseSig)}`;

  // 2. Payload encrypten (aes128gcm)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const localKeyPair = await crypto.subtle.generateKey({ name:"ECDH", namedCurve:"P-256" }, true, ["deriveBits"]);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey)); // 65 bytes 0x04...
  
  // remote public key importeren
  const remotePubU8 = b64urlToU8(p256dh);
  const remoteX = remotePubU8.slice(1,33), remoteY = remotePubU8.slice(33,65);
  const remoteJwk = { kty:"EC", crv:"P-256", x: u8ToB64url(remoteX), y: u8ToB64url(remoteY), ext:true };
  const remotePubKey = await crypto.subtle.importKey("jwk", remoteJwk, { name:"ECDH", namedCurve:"P-256" }, true, []);
  const ecdhBits = await crypto.subtle.deriveBits({ name:"ECDH", public: remotePubKey }, localKeyPair.privateKey, 256);
  const ecdhSecret = new Uint8Array(ecdhBits);

  const authU8 = b64urlToU8(auth);
  const keyInfo = concat(new TextEncoder().encode("WebPush: info\0"), remotePubU8, localPubRaw);
  const prk = await hkdfExtract(authU8, ecdhSecret);
  const ikm = await hkdfExpand(prk, keyInfo, 32);

  const contentEncryptionKeyInfo = concat(new TextEncoder().encode("Content-Encoding: aes128gcm\0"), new Uint8Array(0));
  const cek = await hkdfExpand(salt, contentEncryptionKeyInfo, 16); // actually for aes128gcm cek is derived differently, but per spec we use hkdf with ikm? We follow simplified aes128gcm spec: PRK = hkdf(salt, ikm)
  // Correct aes128gcm: PRK = HKDF-Extract(salt, IKM), then CEK = HKDF-Expand(PRK, cek_info, 16), nonce = HKDF-Expand(PRK, nonce_info, 12)
  const prk2 = await hkdfExtract(salt, ikm);
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const cek2 = await hkdfExpand(prk2, cekInfo, 16);
  const nonce = await hkdfExpand(prk2, nonceInfo, 12);

  // padding: 0x02 0x00 + payload
  const payloadU8 = new TextEncoder().encode(payload);
  const padded = new Uint8Array(1 + payloadU8.length);
  padded[0] = 2; // record separator + pad len 0?
  // Actually aes128gcm: header + encrypted blocks. Simplest: 1 record with 0 delimiter
  // We use: plaintext = payload + 0x02 padding delimiter. Per spec payload is padded with \x02.
  // For single record: plaintext = payload || 0x02
  const plain = concat(payloadU8, new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey("raw", cek2, { name:"AES-GCM" }, false, ["encrypt"]);
  const iv = nonce; // 12 bytes
  const encrypted = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, aesKey, plain);
  const encU8 = new Uint8Array(encrypted);

  // header voor aes128gcm: salt(16) + rs(4) + idlen(1) + keyid(localPubRaw) 
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  const headerAes = concat(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw);

  const bodyFinal = concat(headerAes, encU8);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Authorization": `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`
    },
    body: bodyFinal
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>"" );
    throw new Error(`Push failed ${res.status} ${txt.slice(0,200)}`);
  }
  return true;
}
