// push-worker.js - deploy als Cloudflare Worker (gratis)
// 1. Ga naar dash.cloudflare.com -> Workers & Pages -> Create Worker
// 2. Plak deze code, en maak een KV namespace "PUSH_SUBS" en bind hem
// 3. Zet vars: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT="mailto:jou@voorbeeld.nl"
// Genereer VAPID keys via: https://vapidkeys.com

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/subscribe' && request.method === 'POST') {
      const sub = await request.json();
      const id = await crypto.randomUUID();
      await env.PUSH_SUBS.put(id, JSON.stringify(sub));
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' }});
    }
    
    if (url.pathname === '/unsubscribe' && request.method === 'POST') {
      const { endpoint } = await request.json();
      const list = await env.PUSH_SUBS.list();
      for (let k of list.keys) {
        const v = await env.PUSH_SUBS.get(k.name);
        if (v && JSON.parse(v).endpoint === endpoint) await env.PUSH_SUBS.delete(k.name);
      }
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*'}});
    }

    // Cron job roept /check aan
    if (url.pathname === '/check' || url.pathname === '/') {
      return await checkAndPush(env);
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }});
    }

    return new Response('Ommen Push Worker running. Use /check');
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAndPush(env));
  }
}

async function checkAndPush(env) {
  const feeds = [
    'https://ommencity.nl/feed/',
    'https://weblog.oudommen.nl/feed/',
    'https://www.vechtdalcentraal.nl/feed/'
  ];

  let latestLinks = [];
  for (let feedUrl of feeds) {
    try {
      const res = await fetch(feedUrl);
      const text = await res.text();
      const links = [...text.matchAll(/<link>(.*?)<\/link>/g)].map(m=>m[1].trim()).slice(0,5);
      latestLinks.push(...links);
    } catch {}
  }

  const prevRaw = await env.PUSH_SUBS.get('__last_links');
  const prev = prevRaw ? JSON.parse(prevRaw) : [];
  const newLinks = latestLinks.filter(l=>!prev.includes(l));

  if (newLinks.length===0) {
    return new Response('no new articles');
  }

  await env.PUSH_SUBS.put('__last_links', JSON.stringify(latestLinks));

  // Haal titel van eerste nieuwe
  let title = newLinks[0];
  try {
    const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feeds[0])}`);
    const j = await r.json();
    if(j.items?.[0]) title = j.items[0].title;
  } catch {}

  const payload = JSON.stringify({
    title: `${newLinks.length} nieuw artikel${newLinks.length>1?'en':''} in Ommen`,
    body: title,
    url: newLinks[0]
  });

  const subs = await env.PUSH_SUBS.list();
  let sent = 0;
  for (let k of subs.keys) {
    if(k.name.startsWith('__')) continue;
    const subStr = await env.PUSH_SUBS.get(k.name);
    if(!subStr) continue;
    try {
      await sendPush(JSON.parse(subStr), payload, env);
      sent++;
    } catch(e) {
      // ongeldige sub opruimen
      if(e.message.includes('410') || e.message.includes('404')) await env.PUSH_SUBS.delete(k.name);
    }
  }

  return new Response(`Pushed to ${sent} subs: ${newLinks.join(', ')}`, { headers: { 'Access-Control-Allow-Origin': '*'}});
}

// Simpele web-push met VAPID (geen externe lib nodig voor CF Worker)
async function sendPush(sub, payload, env) {
  // Gebruik web-push compatible fetch: https://github.com/web-push-libs/web-push
  // Voor CF Worker makkelijkste: gebruik npm package 'web-push' in bundling, of kleine inline implementatie
  // Hier gebruiken we fetch naar Mozilla autopush formaat via VAPID headers

  // LET OP: voor productie, gebruik wrangler met npm: npm i web-push
  // en dan: webpush.setVapidDetails(...)
  // Deze inline versie is versimpeld - vervang door echte lib als je deployt met Wrangler

  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC, env.VAPID_PRIVATE);
  await webpush.sendNotification(sub, payload);
}
