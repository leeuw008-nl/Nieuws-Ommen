export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // KV opslaan - zorg dat KV binding PUSH_SUBS heet in Cloudflare
    const getSubs = async () => {
      const list = await env.PUSH_SUBS.list();
      let subs = [];
      for (const key of list.keys) {
        const v = await env.PUSH_SUBS.get(key.name, "json");
        if (v) subs.push({ id: key.name, ...v });
      }
      return subs;
    };

    // === NIEUW: /send?title=&body=&url=&source= ===
    // Voorbeeld: /send?title=Nieuw bij Ommen City&body=Er is een nieuw artikel&url=https://ommencity.nl/...&source=Ommen City
    // source is optioneel. Als je hem weglaat krijgen ALLE abonnees hem.
    if (url.pathname === "/send") {
      const title = url.searchParams.get("title") || "Nieuw Ommen nieuws!";
      const body = url.searchParams.get("body") || "Er is een nieuw artikel geplaatst";
      const link = url.searchParams.get("url") || "https://leeuw008-nl.github.io/Nieuws-Ommen/";
      const sourceFilter = url.searchParams.get("source"); // bv "Ommen City", "RTV Vechtdal" etc.

      let subs = await getSubs();
      if (sourceFilter) {
        subs = subs.filter(s => {
          if (!s.sources) return true; // als iemand geen voorkeur heeft ingesteld, krijgt hij alles
          return s.sources.includes(sourceFilter);
        });
      }

      const payload = JSON.stringify({ title, body, url: link });
      let sent = 0;
      let failed = 0;

      for (const sub of subs) {
        try {
          // web push via fetch naar endpoint met VAPID - hier via je bestaande send logic
          // We gebruiken de standaard Web Push protocol zoals in je oude worker
          const res = await sendPush(sub, payload, env);
          if (res) sent++; else failed++;
        } catch (e) { failed++; }
      }
      return new Response(JSON.stringify({ ok: true, sent, failed, total: subs.length, filter: sourceFilter || "alle" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // === NIEUW: /push-article?url=LINK ===
    // Haalt zelf titel op uit de pagina
    if (url.pathname === "/push-article" || url.pathname === "/send-link") {
      const articleUrl = url.searchParams.get("url");
      if (!articleUrl) return new Response("geef ?url= mee", { status: 400, headers: cors });
      
      let title = "Nieuw artikel";
      let body = "Tik om te lezen";
      try {
        const r = await fetch(articleUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await r.text();
        const mTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const mOgTitle = html.match(/property="og:title" content="([^"]+)"/i);
        if (mOgTitle) title = mOgTitle[1];
        else if (mTitle) title = mTitle[1].trim().slice(0, 100);
        const mDesc = html.match(/name="description" content="([^"]+)"/i) || html.match(/property="og:description" content="([^"]+)"/i);
        if (mDesc) body = mDesc[1].slice(0, 120);
      } catch (e) {}

      // Hergebruik /send logica
      url.searchParams.set("title", title);
      url.searchParams.set("body", body);
      // redirect intern naar /send handler
      const newReq = new Request(url.origin + "/send?" + url.searchParams.toString(), request);
      return this.fetch(newReq, env, ctx);
    }

    // === /test - nu MET echte payload ===
    if (url.pathname === "/test") {
      const subs = await getSubs();
      const payload = JSON.stringify({ 
        title: "Test Ommen Nieuws ✅", 
        body: "Dit is een test notificatie - als je dit ziet werkt het!", 
        url: "https://leeuw008-nl.github.io/Nieuws-Ommen/" 
      });
      let sent = 0;
      for (const sub of subs) {
        try { if (await sendPush(sub, payload, env)) sent++; } catch {}
      }
      return new Response(JSON.stringify({ sent, total: subs.length, subs: subs.length }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/debug") {
      const subs = await getSubs();
      return new Response(JSON.stringify({ count: subs.length, subs: subs.map(s => ({ id: s.id.slice(0,8), endpoint: s.endpoint?.slice(0,40), sources: s.sources })) }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // subscribe / unsubscribe (zoals je al had)
    if (url.pathname === "/subscribe" && request.method === "POST") {
      const data = await request.json();
      const id = crypto.randomUUID();
      await env.PUSH_SUBS.put(id, JSON.stringify(data));
      return new Response(JSON.stringify({ ok: true, id }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/unsubscribe" && request.method === "POST") {
      const { endpoint } = await request.json();
      const subs = await getSubs();
      for (const s of subs) {
        if (s.endpoint === endpoint) await env.PUSH_SUBS.delete(s.id);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response("Ommen Push Worker - gebruik /send, /push-article, /test, /debug", { headers: cors });
  }
};

// Simpele VAPID push - gebruik je bestaande keys uit env.VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
async function sendPush(sub, payload, env) {
  // Hier komt jouw bestaande web-push implementatie
  // Als je de npm web-push variant via Cloudflare gebruikt, vervang dit door jouw werkende sendPush
  // Dit is een placeholder die via fetch naar het endpoint pusht met encryptie - 
  // Kopieer hiervoor je werkende functie uit je oude worker die wel 2x werkte.
  // Voor nu: gebruik de standaard fetch met payload (voor FCM/GCM werkt dit als payload is toegestaan)
  try {
    // Als je Cloudflare web-push lib gebruikt: 
    // import { sendNotification } from webpush, dan hier aanroepen
    
    // Fallback: probeer direct te sturen - werkt als je service-worker payload support heeft
    // De echte encryptie moet hier. Omdat ik je VAPID keys niet heb, laat ik je oude functie staan:
    // ---- VERVANG ONDERSTAAND DOOR JOUW OUDE WERKENDE CODE DIE 2x WEL WERKTE ----
    // Voorbeeld van wat hier stond en wel werkte:
    const { endpoint, keys } = sub;
    // Je had al een werkende web-push encryptie functie - plak die hier terug
    // en return true als fetch 201/200 geeft
    
    // Tijdelijk simpele POST (voor test met FCM zonder encryptie gaat falen, maar laat structuur zien):
    // In jouw geval: je had al werkende code, gebruik die!
    return false; // zet hier je oude send logic terug
  } catch (e) {
    return false;
  }
}
