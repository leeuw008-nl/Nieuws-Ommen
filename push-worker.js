
// Pure Cloudflare Worker Push - no npm needed
// VAPID keys via env.VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
// KV via env.PUSH_SUBS

function b64urlToUint8(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return arr;
}
function uint8ToB64url(arr) {
  let bin = '';
  arr.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

async function createVapidHeaders(audience, env) {
  // audience = origin of push endpoint, e.g. https://fcm.googleapis.com
  const now = Math.floor(Date.now()/1000);
  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = { aud: audience, exp: now + 43200, sub: env.VAPID_SUBJECT || 'mailto:test@example.com' };
  const encHeader = uint8ToB64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = uint8ToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const toSign = `${encHeader}.${encPayload}`;

  // private key is base64url raw 32 bytes, need to make JWK
  const pubBytes = b64urlToUint8(env.VAPID_PUBLIC);
  // pubBytes is 65 bytes uncompressed: 0x04 + x(32) + y(32)
  const x = pubBytes.slice(1,33);
  const y = pubBytes.slice(33,65);
  const d = b64urlToUint8(env.VAPID_PRIVATE);

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ToB64url(x),
    y: uint8ToB64url(y),
    d: uint8ToB64url(d)
  };
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(toSign));
  // convert DER to raw 64 bytes? Subtle returns raw? For ECDSA it returns DER? In WebCrypto it returns raw r||s 64 bytes for P-256? Actually returns ASN.1 DER, need convert.
  // Simplify: try to use raw conversion
  let rawSig = new Uint8Array(sig);
  // If DER (starts 0x30), convert
  if (rawSig[0] === 0x30) {
    // crude DER parse
    let offset = 2;
    if (rawSig[1] > 127) offset = 3;
    // r
    let rLen = rawSig[offset+1];
    let rStart = offset+2;
    let r = rawSig.slice(rStart, rStart+rLen);
    if (r.length > 32) r = r.slice(r.length-32);
    // s
    let sOffset = rStart + rLen;
    let sLen = rawSig[sOffset+1];
    let sStart = sOffset+2;
    let s = rawSig.slice(sStart, sStart+sLen);
    if (s.length > 32) s = s.slice(s.length-32);
    const out = new Uint8Array(64);
    out.set(r.length < 32 ? (()=>{const p=new Uint8Array(32); p.set(r, 32-r.length); return p;})() : r, 0);
    out.set(s.length < 32 ? (()=>{const p=new Uint8Array(32); p.set(s, 32-s.length); return p;})() : s, 32);
    rawSig = out;
  }
  const jwt = `${toSign}.${uint8ToB64url(rawSig)}`;
  return {
    Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`,
    'Crypto-Key': `p256ecdsa=${env.VAPID_PUBLIC}`
  };
}

async function sendPushNoPayload(sub, env) {
  try {
    const endpoint = sub.endpoint;
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const vapidHeaders = await createVapidHeaders(audience, env);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...vapidHeaders,
        TTL: '3600',
        Urgency: 'high'
      }
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Push failed ${res.status}: ${txt}`);
    }
  } catch(e) {
    throw e;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === '/vapid' && request.method === 'GET') {
      return new Response(JSON.stringify({ publicKey: env.VAPID_PUBLIC }), { headers: cors });
    }

    if (url.pathname === '/proxy' && request.method === 'GET') {
      const target = url.searchParams.get('url');
      if(!target) return new Response('Missing url param', {status:400, headers:cors});
      try{
        const res = await fetch(target, { headers: { 'User-Agent': 'OmmenNieuws/1.0', 'Accept': 'text/html,application/rss+xml,application/xml,*/*' } });
        const text = await res.text();
        return new Response(text, { headers: { ...cors, 'Content-Type': res.headers.get('content-type')||'text/plain', 'Cache-Control': 'max-age=300' } });
      }catch(e){
        return new Response('Proxy error: '+e.message, {status:500, headers:cors});
      }
    }

    if (url.pathname === '/subscribe' && request.method === 'POST') {
      try {
        const sub = await request.json();
        const id = crypto.randomUUID();
        await env.PUSH_SUBS.put(id, JSON.stringify(sub));
        return new Response(JSON.stringify({ ok: true, id }), { headers: cors });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
      }
    }

    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      try {
        const { endpoint } = await request.json();
        const list = await env.PUSH_SUBS.list();
        for (let k of list.keys) {
          if (k.name.startsWith('__')) continue;
          const v = await env.PUSH_SUBS.get(k.name);
          if (v && JSON.parse(v).endpoint === endpoint) await env.PUSH_SUBS.delete(k.name);
        }
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
      }
    }

    if (url.pathname === '/check' || url.pathname === '/' ) {
      return await checkAndPush(env, cors);
    }

    if (url.pathname === '/test' || url.pathname === '/send-test') {
      // Force push to all - for testing, also cleans up dead subs
      const list = await env.PUSH_SUBS.list();
      let sent = 0, failed = 0, cleaned = 0;
      let failedIds = [];
      for (let k of list.keys) {
        if (k.name.startsWith('__')) continue;
        const v = await env.PUSH_SUBS.get(k.name);
        if(!v) continue;
        try{
          await sendPushNoPayload(JSON.parse(v), env);
          sent++;
        }catch(e){
          failed++;
          failedIds.push(k.name + ':' + e.message.slice(0,80));
          // delete ANY failed on test to clean up mess from unregister tests
          await env.PUSH_SUBS.delete(k.name);
          cleaned++;
        }
      }
      return new Response(JSON.stringify({ status: 'test-push-sent', sent, failed, cleaned, total: list.keys.filter(k=>!k.name.startsWith('__')).length, failedIds }), { headers: cors });
    }

    if (url.pathname === '/cleanup') {
      // manual cleanup of all dead subs
      const list = await env.PUSH_SUBS.list();
      let deleted = 0;
      for (let k of list.keys) {
        if (k.name.startsWith('__')) continue;
        const v = await env.PUSH_SUBS.get(k.name);
        if(!v) continue;
        try{
          await sendPushNoPayload(JSON.parse(v), env);
        }catch(e){
          await env.PUSH_SUBS.delete(k.name);
          deleted++;
        }
      }
      return new Response(JSON.stringify({ cleaned: deleted }), { headers: cors });
    }

    if (url.pathname === '/debug') {
      const list = await env.PUSH_SUBS.list();
      return new Response(JSON.stringify({ count: list.keys.length, keys: list.keys.map(k=>k.name) }), { headers: cors });
    }

    return new Response(JSON.stringify({ status: 'Ommen Push Worker LIVE', kv: env.PUSH_SUBS ? 'OK' : 'MISSING', subs: (await env.PUSH_SUBS.list()).keys.length }), { headers: cors });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAndPush(env, {}));
  }
}

async function checkAndPush(env, cors) {
  const feedMap = [
    { url: 'https://ommencity.nl/feed/', source: 'Ommen City' },
    { url: 'https://weblog.oudommen.nl/feed/', source: 'OudOmmen' },
    { url: 'https://www.vechtdalcentraal.nl/feed/', source: 'Vechtdal Centraal' },
    { url: 'https://www.destentor.nl/ommen/rss.xml', source: 'De Stentor' }
  ];
  let latestLinks = [];
  let latestWithSource = []; // {link, source}
  let titles = [];
  for (let feed of feedMap) {
    try {
      const res = await fetch(feed.url, { headers: { 'User-Agent': 'OmmenPush/1.0' } });
      const text = await res.text();
      const linkMatches = [...text.matchAll(/<link>(.*?)<\/link>/g)].map(m=>m[1].trim()).filter(l=>l.startsWith('http')).slice(0,5);
      const titleMatches = [...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/g)].map(m=>m[1]||m[2]).slice(1,6);
      for(let l of linkMatches){
        if(!latestLinks.includes(l)){
          latestLinks.push(l);
          latestWithSource.push({link: l, source: feed.source});
        }
      }
      titles.push(...titleMatches);
    } catch(e) { console.log('feed error', feed.url, e.message); }
  }
  latestLinks = [...new Set(latestLinks)];
  const prevRaw = await env.PUSH_SUBS.get('__last_links');
  const prev = prevRaw ? JSON.parse(prevRaw) : [];
  const newLinks = latestLinks.filter(l=>!prev.includes(l));
  const newWithSource = latestWithSource.filter(x=> newLinks.includes(x.link));

  if (newLinks.length===0 && prev.length!==0) {
    return new Response(JSON.stringify({ status: 'no new', checked: latestLinks.length }), { headers: cors });
  }

  await env.PUSH_SUBS.put('__last_links', JSON.stringify(latestLinks));

  if (prev.length===0) {
    return new Response(JSON.stringify({ status: 'initialized', links: latestLinks }), { headers: cors });
  }

  // Determine which sources have new content
  const newSources = [...new Set(newWithSource.map(x=>x.source))];
  if(newSources.length===0){
    // fallback if parsing failed, use all
    newSources.push(...feedMap.map(f=>f.source));
  }

  const subs = await env.PUSH_SUBS.list();
  let sent = 0, failed = 0, skipped = 0;
  for (let k of subs.keys) {
    if(k.name.startsWith('__')) continue;
    const subStr = await env.PUSH_SUBS.get(k.name);
    if(!subStr) continue;
    let subObj;
    try{ subObj = JSON.parse(subStr); }catch{ continue; }
    // Check if user wants this source
    const userSources = subObj.sources;
    let shouldSend = true;
    if(Array.isArray(userSources) && userSources.length>0){
      // if user selected specific sources, only send if overlap
      shouldSend = newSources.some(s=> userSources.includes(s));
      if(!shouldSend){
        skipped++;
        continue;
      }
    }
    try {
      await sendPushNoPayload(subObj, env);
      sent++;
    } catch(e) {
      console.log('push fail', e.message);
      if(e.message.includes('410') || e.message.includes('404')) {
        await env.PUSH_SUBS.delete(k.name);
      }
      failed++;
    }
  }

  return new Response(JSON.stringify({ status: 'pushed', new: newLinks, newSources, sent, skipped, failed, title: titles[0]||'' }), { headers: cors });
}
