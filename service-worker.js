// Ommen Push v16.3 - FULL ENCRYPTION (aes128gcm) - FIX voor bron weergave
// Nu met echte Web Push encryptie zodat titel/body/bron wel aankomen

const VERSION = 'v16.3-full-encryption';
const VAPID_PUBLIC_KEY = 'BBnCDkkzIXwUYFrF8ct-OXtRQ6-HaqF74grNVDLe4pw1SwG8_JyMYIHItRY6smyqPpdt81U1EZF33loTsepqnYo';

const BRONNEN = [
  {id:'De Stentor', url:'https://www.destentor.nl/ommen/rss.xml', type:'rss'},
  {id:'Gemeente Ommen', url:'https://www.ommen.nl/actueel/', type:'gemeente'},
  {id:'Natuurlijk Ommen', url:'https://www.natuurlijkommen.nl/feed/', type:'rss'},
  {id:'Ommen City', url:'https://ommencity.nl/feed/', type:'rss'},
  {id:'OudOmmen', url:'https://weblog.oudommen.nl/feed/', type:'rss'},
  {id:'RondOmmen', url:'https://www.rondommen.nl/feed/', type:'rss'},
  {id:'RTV Oost', url:'https://www.rtvoost.nl/nieuws/ommen', type:'oost'},
  {id:'RTV Vechtdal', url:'https://rtvvechtdal.nl/feed/', type:'rss'},
  {id:'Vechtdal Centraal', url:'https://www.vechtdalcentraal.nl/feed/', type:'rss'},
];

function corsHeaders(){
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
function jsonResponse(data, status=200){
  return new Response(JSON.stringify(data), { status, headers: {'Content-Type':'application/json', ...corsHeaders()} });
}
async function hashPassword(pw){ const enc = new TextEncoder().encode(pw); const buf = await crypto.subtle.digest('SHA-256', enc); return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
function generateToken(){ const arr = new Uint8Array(32); crypto.getRandomValues(arr); return [...arr].map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function getUserFromToken(token, env){
  if(!token) return null;
  const session = await env.PUSH_KV.get('session:'+token, {type:'json'});
  if(!session) return null;
  if(session.expires < Date.now()){ await env.PUSH_KV.delete('session:'+token); return null; }
  const user = await env.PUSH_KV.get('user:'+session.userId, {type:'json'});
  return user;
}
function uint8ArrayToBase64Url(arr){ return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function base64UrlToUint8Array(base64Url){
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}

// VAPID
async function createVapidAuthHeader(audience, subject, publicKey, privateKeyInput){
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now()/1000);
  const payload = { aud: audience, exp: now + 43200, sub: subject };
  const encHeader = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encHeader}.${encPayload}`;
  let jwk;
  try{
    if(privateKeyInput.trim().startsWith('{')){
      jwk = JSON.parse(privateKeyInput);
    }else{
      const pubBytes = base64UrlToUint8Array(publicKey);
      let xBytes, yBytes;
      if(pubBytes.length === 65 && pubBytes[0] === 4){ xBytes = pubBytes.slice(1,33); yBytes = pubBytes.slice(33,65); }
      else if(pubBytes.length === 64){ xBytes = pubBytes.slice(0,32); yBytes = pubBytes.slice(32,64); }
      else throw new Error('Public key length invalid: '+pubBytes.length);
      jwk = { kty: 'EC', crv: 'P-256', x: uint8ArrayToBase64Url(xBytes), y: uint8ArrayToBase64Url(yBytes), d: privateKeyInput.trim() };
    }
  }catch(e){ throw new Error('VAPID private key parse fail: '+e.message); }
  const cryptoKey = await crypto.subtle.importKey('jwk', jwk, {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
  const sigBuf = await crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, cryptoKey, new TextEncoder().encode(unsignedToken));
  let rawSig; const sigArr = new Uint8Array(sigBuf);
  if(sigArr.length > 64 && sigArr[0] === 0x30){
    let offset = 2; const rLen = sigArr[offset+1]; let r = sigArr.slice(offset+2, offset+2+rLen); offset = offset+2+rLen; const sLen = sigArr[offset+1]; let s = sigArr.slice(offset+2, offset+2+sLen);
    if(r.length > 32) r = r.slice(r.length-32); if(s.length > 32) s = s.slice(s.length-32);
    const rPad = new Uint8Array(32); rPad.set(r, 32-r.length); const sPad = new Uint8Array(32); sPad.set(s, 32-s.length);
    rawSig = new Uint8Array(64); rawSig.set(rPad,0); rawSig.set(sPad,32);
  }else{ rawSig = sigArr; }
  const encSig = uint8ArrayToBase64Url(rawSig);
  return `vapid t=${unsignedToken}.${encSig}, k=${publicKey}`;
}

// ===== Web Push Encryption aes128gcm =====
async function importEcdhPublicKey(raw65){
  if(raw65.length !== 65 || raw65[0] !== 4) throw new Error('Invalid raw ECDH public key');
  const x = raw65.slice(1,33); const y = raw65.slice(33,65);
  const jwk = { kty:'EC', crv:'P-256', x: uint8ArrayToBase64Url(x), y: uint8ArrayToBase64Url(y), ext:true };
  return await crypto.subtle.importKey('jwk', jwk, {name:'ECDH', namedCurve:'P-256'}, false, []);
}

async function hkdfExtract(salt, ikm){
  const key = await crypto.subtle.importKey('raw', salt, {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const prk = await crypto.subtle.sign('HMAC', key, ikm);
  return new Uint8Array(prk);
}

async function hkdfExpand(prk, info, length){
  const key = await crypto.subtle.importKey('raw', prk, {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const input = new Uint8Array(info.length + 1);
  input.set(info, 0);
  input[info.length] = 1;
  const out = await crypto.subtle.sign('HMAC', key, input);
  return new Uint8Array(out).slice(0, length);
}

async function encryptPayloadAes128gcm(subscription, payloadStr){
  const p256dhRaw = base64UrlToUint8Array(subscription.keys.p256dh);
  const authRaw = base64UrlToUint8Array(subscription.keys.auth);
  if(p256dhRaw.length !== 65) throw new Error('p256dh length invalid: '+p256dhRaw.length);
  if(authRaw.length !== 16) throw new Error('auth length invalid: '+authRaw.length);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
  const ephemeralPublicJwk = await crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey);
  const ephemeralX = base64UrlToUint8Array(ephemeralPublicJwk.x);
  const ephemeralY = base64UrlToUint8Array(ephemeralPublicJwk.y);
  const ephemeralPublicRaw = new Uint8Array(65);
  ephemeralPublicRaw[0] = 4;
  ephemeralPublicRaw.set(ephemeralX, 1);
  ephemeralPublicRaw.set(ephemeralY, 33);

  const clientPublicKey = await importEcdhPublicKey(p256dhRaw);
  const sharedSecretBuffer = await crypto.subtle.deriveBits({name:'ECDH', public: clientPublicKey}, ephemeralKeyPair.privateKey, 256);
  const sharedSecret = new Uint8Array(sharedSecretBuffer);

  // PRK = HKDF-Extract(auth, sharedSecret)
  const prk = await hkdfExtract(authRaw, sharedSecret);

  // Info for key and nonce
  const textEncoder = new TextEncoder();
  const keyInfoPrefix = textEncoder.encode('WebPush: info');
  const nonceInfoPrefix = textEncoder.encode('Content-Encoding: nonce');

  const keyInfo = new Uint8Array(keyInfoPrefix.length + 1 + p256dhRaw.length + ephemeralPublicRaw.length);
  keyInfo.set(keyInfoPrefix, 0);
  keyInfo[keyInfoPrefix.length] = 0;
  keyInfo.set(p256dhRaw, keyInfoPrefix.length + 1);
  keyInfo.set(ephemeralPublicRaw, keyInfoPrefix.length + 1 + p256dhRaw.length);

  const nonceInfo = new Uint8Array(nonceInfoPrefix.length + 1 + p256dhRaw.length + ephemeralPublicRaw.length);
  nonceInfo.set(nonceInfoPrefix, 0);
  nonceInfo[nonceInfoPrefix.length] = 0;
  nonceInfo.set(p256dhRaw, nonceInfoPrefix.length + 1);
  nonceInfo.set(ephemeralPublicRaw, nonceInfoPrefix.length + 1 + p256dhRaw.length);

  const cek = await hkdfExpand(prk, keyInfo, 16);
  const nonce = await hkdfExpand(prk, nonceInfo, 12);

  // Plaintext = payload + 0x02 delimiter
  const payloadBytes = textEncoder.encode(payloadStr);
  const plaintext = new Uint8Array(payloadBytes.length + 1);
  plaintext.set(payloadBytes, 0);
  plaintext[payloadBytes.length] = 2; // delimiter for final record

  const cekKey = await crypto.subtle.importKey('raw', cek, {name:'AES-GCM'}, false, ['encrypt']);
  const encryptedBuffer = await crypto.subtle.encrypt({name:'AES-GCM', iv: nonce, tagLength: 128}, cekKey, plaintext);
  const encrypted = new Uint8Array(encryptedBuffer);

  // Header for aes128gcm: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  header[16] = (rs >> 24) & 0xFF;
  header[17] = (rs >> 16) & 0xFF;
  header[18] = (rs >> 8) & 0xFF;
  header[19] = rs & 0xFF;
  header[20] = 65; // idlen
  header.set(ephemeralPublicRaw, 21);

  const finalPayload = new Uint8Array(header.length + encrypted.length);
  finalPayload.set(header, 0);
  finalPayload.set(encrypted, header.length);

  return finalPayload;
}

async function sendPushToSubscription(subscription, payloadObj, env){
  try{
    const endpoint = subscription.endpoint;
    const audience = new URL(endpoint).origin;
    const publicKey = env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY;
    const privateKeyInput = env.VAPID_PRIVATE_KEY_JWK || env.VAPID_PRIVATE_KEY || env.VAPID_PRIVATE;
    const subject = env.VAPID_SUBJECT || 'mailto:leeuw008@gmail.com';

    if(!privateKeyInput){
      return {ok:false, error:'MISSING_SECRET: VAPID_PRIVATE_KEY_JWK niet gezet'};
    }

    let vapidHeader;
    try{
      vapidHeader = await createVapidAuthHeader(audience, subject, publicKey, privateKeyInput);
    }catch(e){
      return {ok:false, error:'VAPID header fail: '+e.message};
    }

    const payloadStr = JSON.stringify(payloadObj);

    let encryptedPayload;
    try{
      encryptedPayload = await encryptPayloadAes128gcm(subscription, payloadStr);
    }catch(e){
      return {ok:false, error:'Encryption fail: '+e.message+' stack:'+(e.stack||'').slice(0,200)};
    }

    const headers = {
      'TTL': '86400',
      'Authorization': vapidHeader,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm'
    };

    const resp = await fetch(endpoint, { method:'POST', headers, body: encryptedPayload });
    const txt = await resp.text().catch(()=>'');

    if(resp.status === 201 || resp.status === 200 || resp.status === 204){
      return {ok:true, status: resp.status, mode:'encrypted-aes128gcm'};
    }
    if(resp.status === 404 || resp.status === 410){
      return {ok:false, status: resp.status, error:'Expired (404/410)', shouldDelete:true, text: txt.slice(0,300)};
    }
    return {ok:false, status: resp.status, error: txt.slice(0,500)};
  }catch(e){
    return {ok:false, error:'Exception: '+e.message+' '+(e.stack||'').slice(0,300)};
  }
}

async function getAllPushSubs(env){
  const list = await env.PUSH_KV.list({prefix:'pushsub:'});
  const subs = [];
  for(const key of list.keys){
    const v = await env.PUSH_KV.get(key.name, {type:'json'});
    if(v) subs.push({id:key.name, ...v});
  }
  return subs;
}

function parseRSS(text){
  const items=[]; const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi; let m;
  while((m=itemRe.exec(text))!==null && items.length<20){
    const block = m[1];
    const titleMatch = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = block.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || block.match(/<link[^>]*href="([^"]+)"/i);
    const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    let title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g,'').trim() : '';
    let link = linkMatch ? linkMatch[1].trim() : (guidMatch ? guidMatch[1].trim() : '');
    title = title.replace(/&#8217;/g,"'").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
    if(title && link) items.push({title, link});
  }
  return items;
}
function parseVechtdalCentraal(html){
  const items=[]; const seen=new Set(); let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m;
  while((m=re.exec(html))!==null && items.length<10){
    let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link;
    if(seen.has(link)) continue; seen.add(link);
    const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();
    if(title.length>4) items.push({title, link});
  }
  return items;
}
function parseRTVOost(html){
  const items=[]; let m; const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;
  while((m=re.exec(html))!==null && items.length<10){
    const link='https://www.rtvoost.nl'+m[2]; const title=m[3].trim();
    if(!items.find(x=>x.link===link)) items.push({title, link});
  }
  return items;
}
function parseGemeente(html){
  const items=[]; const re=/<a[^>]+href="(\/actueel\/[^"]+)"[^>]*>([^<]{10,120})<\/a>/gi; let m; const seen=new Set();
  while((m=re.exec(html))!==null && items.length<10){
    let link='https://www.ommen.nl'+m[1]; let title=m[2].trim();
    if(title.length>10 && !seen.has(link)){ seen.add(link); items.push({title, link}); }
  }
  return items;
}
async function fetchFeed(bron){
  try{
    const r = await fetch(bron.url, {headers:{'User-Agent':'NieuwsOmmenBot/1.0', 'Accept':'text/html,application/rss+xml,application/xml'}});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const text = await r.text();
    let items=[];
    if(bron.type==='rss' || text.includes('<rss') || text.includes('<feed') || text.includes('<item')) items = parseRSS(text);
    else if(bron.id==='Vechtdal Centraal') items = parseVechtdalCentraal(text);
    else if(bron.id==='RTV Oost') items = parseRTVOost(text);
    else if(bron.id==='Gemeente Ommen') items = parseGemeente(text);
    else items = parseRSS(text);
    return items.slice(0,10);
  }catch(e){ return []; }
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    const path = url.pathname;
    if(request.method === 'OPTIONS'){ return new Response(null, {headers: corsHeaders()}); }
    if(path === '/' || path === '/health'){
      const hasPrivate = !!(env.VAPID_PRIVATE_KEY_JWK || env.VAPID_PRIVATE_KEY || env.VAPID_PRIVATE);
      return jsonResponse({version: VERSION, status:'online', hasPrivateKey: hasPrivate, publicKey: env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY, encryption: 'aes128gcm'});
    }
    if(path === '/vapidPublicKey' || path === '/vapid'){
      return jsonResponse({vapidPublicKey: env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY, publicKey: env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY, version: VERSION});
    }
    if(path === '/proxy'){
      const target = url.searchParams.get('url');
      if(!target) return jsonResponse({error:'missing url'},400);
      try{
        const r = await fetch(target, {headers:{'User-Agent':'NieuwsOmmen/1.0'}});
        const text = await r.text();
        return new Response(text, {headers:{'Content-Type': r.headers.get('content-type')||'text/xml', ...corsHeaders()}});
      }catch(e){ return jsonResponse({error:e.message},500); }
    }
    if((path === '/subscribe' || path === '/sub' || path === '/register') && request.method === 'POST'){
      try{
        const body = await request.json();
        const sub = body.subscription || body;
        const endpoint = sub.endpoint;
        if(!endpoint) return jsonResponse({error:'no endpoint'},400);
        const id = btoa(endpoint).replace(/[^a-zA-Z0-9]/g,'').slice(0,32);
        const toStore = {
          endpoint,
          keys: sub.keys || {p256dh: sub.p256dh || body.p256dh || '', auth: sub.auth || body.auth || ''},
          sources: body.sources || sub.sources || [],
          created: Date.now()
        };
        await env.PUSH_KV.put('pushsub:'+id, JSON.stringify(toStore));
        return jsonResponse({ok:true, id, version: VERSION});
      }catch(e){ return jsonResponse({error:e.message},500); }
    }
    if((path === '/unsubscribe' || path === '/unsub') && request.method === 'POST'){
      try{
        const b = await request.json();
        const endpoint = b.endpoint;
        let id = b.id;
        if(!id && endpoint) id = btoa(endpoint).replace(/[^a-zA-Z0-9]/g,'').slice(0,32);
        if(endpoint){
          const list = await env.PUSH_KV.list({prefix:'pushsub:'});
          for(const k of list.keys){
            const v = await env.PUSH_KV.get(k.name, {type:'json'});
            if(v && (v.endpoint === endpoint || k.name === 'pushsub:'+id)) await env.PUSH_KV.delete(k.name);
          }
        }else if(id){ await env.PUSH_KV.delete('pushsub:'+id); }
        return jsonResponse({ok:true, version: VERSION});
      }catch(e){ return jsonResponse({error:e.message},500); }
    }
    if(path === '/subs' || path === '/subscriptions' || path === '/stats' || path === '/list' || path === '/admin/stats'){
      const subs = await getAllPushSubs(env);
      return jsonResponse({count: subs.length, total: subs.length, version: VERSION, hasPrivateKey: !!(env.VAPID_PRIVATE_KEY_JWK || env.VAPID_PRIVATE_KEY), subscriptions: subs.map(s=>({id:s.id.replace('pushsub:','').slice(-8), endpoint:s.endpoint.slice(0,80)+'...', sources:s.sources, created:new Date(s.created).toISOString()})), raw: subs.slice(0,2)});
    }
    if((path === '/broadcast' || path === '/send' || path === '/push') && (request.method === 'POST' || request.method === 'GET')){
      try{
        let title, body, source, urlParam;
        if(request.method === 'GET'){
          title = url.searchParams.get('title') || 'Nieuws Ommen';
          body = url.searchParams.get('body') || 'Nieuw artikel beschikbaar';
          source = url.searchParams.get('source') || 'Algemeen';
          urlParam = url.searchParams.get('url') || './';
        }else{
          const j = await request.json();
          title = j.title || 'Nieuws Ommen';
          body = j.body || j.message || 'Nieuw artikel beschikbaar';
          source = j.source || 'Algemeen';
          urlParam = j.url || j.link || './';
        }
        // FIX: Zorg dat bron in titel staat voor echte weergave
        let finalTitle = title;
        if(source && source !== 'Algemeen' && !title.toLowerCase().includes(source.toLowerCase())){
          finalTitle = `${source}: ${title}`;
        }
        const payload = {title: finalTitle, body, source, url: urlParam, tag: 'ommen-'+Date.now()};
        const allSubs = await getAllPushSubs(env);
        let targetSubs = allSubs;
        if(source && source !== 'Algemeen' && !source.startsWith('Test')){
          targetSubs = allSubs.filter(s=>{ if(!s.sources || s.sources.length===0) return true; return s.sources.includes(source); });
        }
        let sent=0, failed=0, expired=0;
        const results=[];
        for(const sub of targetSubs){
          const r = await sendPushToSubscription(sub, payload, env);
          if(r.ok) sent++; else { failed++; if(r.shouldDelete) expired++; }
          if(r.shouldDelete) await env.PUSH_KV.delete(sub.id);
          results.push({id:sub.id.slice(-8), ok:r.ok, status:r.status, error:r.error, mode:r.mode});
          await new Promise(res=>setTimeout(res,80));
        }
        return jsonResponse({ok:true, sent, failed, expired, total: allSubs.length, targeted: targetSubs.length, payload, version: VERSION, hasPrivateKey: !!(env.VAPID_PRIVATE_KEY_JWK || env.VAPID_PRIVATE_KEY), results});
      }catch(e){ return jsonResponse({error:e.message, stack:e.stack, version: VERSION},500); }
    }
    if(path === '/trigger-cron' || path === '/trigger' || path === '/run-cron' || path === '/check' || path === '/cron/trigger'){
      try{
        const result = await this.handleCron(env);
        return jsonResponse({ok:true, triggered:true, result, version: VERSION, time: new Date().toISOString()});
      }catch(e){ return jsonResponse({error:e.message, stack:e.stack, version: VERSION},500); }
    }
    if(path === '/cron-status' || path === '/status' || path === '/last-run' || path === '/health/cron'){
      const last = await env.PUSH_KV.get('cron:lastRun', {type:'json'});
      return jsonResponse({version: VERSION, lastRun: last, now: new Date().toISOString(), hasPrivateKey: !!(env.VAPID_PRIVATE_KEY_JWK || env.VAPID_PRIVATE_KEY), cronPattern: '*/15 * * * *'});
    }
    if(path === '/auth/register' && request.method === 'POST'){
      try{
        const {email, password} = await request.json();
        if(!email || !password) return jsonResponse({error:'Email en wachtwoord verplicht'},400);
        if(password.length < 6) return jsonResponse({error:'Wachtwoord min 6 tekens'},400);
        const emailLower = email.toLowerCase().trim();
        const existing = await env.PUSH_KV.get('useremail:'+emailLower);
        if(existing) return jsonResponse({error:'Email bestaat al'},400);
        const userId = generateToken().slice(0,16);
        const pwHash = await hashPassword(password);
        const user = {id:userId, email:emailLower, pwHash, created:Date.now()};
        await env.PUSH_KV.put('user:'+userId, JSON.stringify(user));
        await env.PUSH_KV.put('useremail:'+emailLower, userId);
        const token = generateToken();
        await env.PUSH_KV.put('session:'+token, JSON.stringify({userId, expires:Date.now()+1000*60*60*24*30}), {expirationTtl:60*60*24*30});
        let allUsers = await env.PUSH_KV.get('all_users_list', {type:'json'}) || [];
        if(!allUsers.includes(emailLower)){ allUsers.push(emailLower); await env.PUSH_KV.put('all_users_list', JSON.stringify(allUsers)); }
        return jsonResponse({token, id:userId, email:emailLower});
      }catch(e){ return jsonResponse({error:e.message},500); }
    }
    if(path === '/auth/login' && request.method === 'POST'){
      try{
        const {email, password} = await request.json();
        const emailLower = email.toLowerCase().trim();
        const userId = await env.PUSH_KV.get('useremail:'+emailLower);
        if(!userId) return jsonResponse({error:'Onbekend email'},401);
        const user = await env.PUSH_KV.get('user:'+userId, {type:'json'});
        if(!user) return jsonResponse({error:'User niet gevonden'},401);
        const pwHash = await hashPassword(password);
        if(pwHash !== user.pwHash) return jsonResponse({error:'Wachtwoord onjuist'},401);
        const token = generateToken();
        await env.PUSH_KV.put('session:'+token, JSON.stringify({userId, expires:Date.now()+1000*60*60*24*30}), {expirationTtl:60*60*24*30});
        let allUsers = await env.PUSH_KV.get('all_users_list', {type:'json'}) || [];
        if(!allUsers.includes(emailLower)){ allUsers.push(emailLower); await env.PUSH_KV.put('all_users_list', JSON.stringify(allUsers)); }
        return jsonResponse({token, id:userId, email:emailLower});
      }catch(e){ return jsonResponse({error:e.message},500); }
    }
    if(path === '/auth/me'){
      const auth = request.headers.get('Authorization')||'';
      const token = auth.replace('Bearer ','').trim();
      if(!token) return jsonResponse({error:'no token'},401);
      const user = await getUserFromToken(token, env);
      if(!user) return jsonResponse({error:'invalid token'},401);
      return jsonResponse({id:user.id, email:user.email});
    }
    if(path === '/auth/logout' && request.method === 'POST'){
      try{
        const auth = request.headers.get('Authorization')||'';
        let token = auth.replace('Bearer ','').trim();
        if(!token){ const b = await request.json().catch(()=>({})); token = b.token; }
        if(token) await env.PUSH_KV.delete('session:'+token);
        return jsonResponse({ok:true});
      }catch(e){ return jsonResponse({error:e.message},500); }
    }
    if(path === '/sync/save' && request.method === 'POST'){
      const auth = request.headers.get('Authorization')||'';
      const token = auth.replace('Bearer ','').trim();
      const user = await getUserFromToken(token, env);
      if(!user) return jsonResponse({error:'unauthorized'},401);
      const body = await request.json();
      const now = Date.now();
      await env.PUSH_KV.put('sync:'+user.id, JSON.stringify({state: body.state, updated: now}));
      return jsonResponse({ok:true, updated: now});
    }
    if(path === '/sync/load'){
      const auth = request.headers.get('Authorization')||'';
      const token = auth.replace('Bearer ','').trim();
      const user = await getUserFromToken(token, env);
      if(!user) return jsonResponse({error:'unauthorized'},401);
      const data = await env.PUSH_KV.get('sync:'+user.id, {type:'json'});
      if(!data) return jsonResponse({state:null});
      return jsonResponse(data);
    }
    if(path === '/admin/users'){
      const key = url.searchParams.get('key');
      if(key !== 'ommen-admin-2026-leeuw008') return jsonResponse({error:'Unauthorized'},403);
      const allUsers = await env.PUSH_KV.get('all_users_list', {type:'json'}) || [];
      return jsonResponse({count: allUsers.length, users: allUsers});
    }
    return new Response(`Ommen Worker ${VERSION} - 404 for ${path}`, {status:404, headers: corsHeaders()});
  },

  async handleCron(env){
    const start = Date.now();
    const seenAll = await env.PUSH_KV.get('cron:seen', {type:'json'}) || {};
    let newArticlesTotal = [];
    const fetchResults = {};
    for(const bron of BRONNEN){
      const items = await fetchFeed(bron);
      fetchResults[bron.id] = items.length;
      const seen = new Set(seenAll[bron.id] || []);
      const newItems = [];
      for(const it of items){
        if(!seen.has(it.link)){
          newItems.push(it);
          seen.add(it.link);
          if(seen.size > 100){
            const arr = Array.from(seen);
            seenAll[bron.id] = arr.slice(-100);
          }else{
            seenAll[bron.id] = Array.from(seen);
          }
        }
        if(newItems.length >= 3) break;
      }
      if(newItems.length>0){
        for(const ni of newItems){
          newArticlesTotal.push({source: bron.id, title: ni.title, link: ni.link});
        }
      }
    }
    await env.PUSH_KV.put('cron:seen', JSON.stringify(seenAll));
    await env.PUSH_KV.put('cron:lastRun', JSON.stringify({time: start, iso: new Date(start).toISOString(), newCount: newArticlesTotal.length, fetchResults}));
    let sentTotal=0;
    const allSubs = await getAllPushSubs(env);
    for(const article of newArticlesTotal){
      const payload = {
        title: `${article.source}: ${article.title.slice(0,80)}`,
        body: article.title,
        source: article.source,
        url: article.link,
        tag: 'ommen-'+btoa(article.link).slice(0,20)
      };
      let targets = allSubs.filter(s=>{ if(!s.sources || s.sources.length===0) return true; return s.sources.includes(article.source); });
      for(const sub of targets){
        const r = await sendPushToSubscription(sub, payload, env);
        if(r.ok) sentTotal++;
        if(r.shouldDelete) await env.PUSH_KV.delete(sub.id);
        await new Promise(res=>setTimeout(res,50));
      }
    }
    return {newArticles: newArticlesTotal, sentTotal, fetchResults, subsCount: allSubs.length};
  },

  async scheduled(event, env, ctx){
    ctx.waitUntil(this.handleCron(env));
  }
};
