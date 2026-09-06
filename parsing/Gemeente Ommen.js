// 🔧 FIX v307 - WAS BROKEN "Bron tijdelijk offline" - NU GEFIXT
// Bron: Gemeente Ommen - https://www.ommen.nl/feed/ + fallback https://www.ommen.nl/actueel/
// Probleem: RSS feed geeft Cloudflare challenge "Just a moment" -> parser faalde
// Fix: probeer RSS, als leeg -> scrape /actueel/ pagina met 3 patterns
// Status: GEFIXT v307 - TESTED LIVE op 2026-09-03 data
// Na fix: LOCK deze file met 🔒

export function parseGemeenteOmmen(xmlOrHtml, bronId, isHtmlFallback=false){
  // Als het RSS is
  if(!isHtmlFallback && (xmlOrHtml.includes('<rss') || xmlOrHtml.includes('<item') || xmlOrHtml.includes('<feed'))){
    const max=10;
    let items=[...xmlOrHtml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
    if(items.length===0) items=[...xmlOrHtml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)];
    items=items.slice(0,max);
    const parsed=items.map(m=>{
      const it=m[0]||m[1];
      let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
      title=title.replace(/<[^>]*>/g,'').trim();
      let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
      if(!link||link.includes('<')){ const hm=it.match(/<link[^>]+href=["']([^"']+)["']/i); if(hm) link=hm[1]; }
      link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      let pub=(it.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i)||[])[2]||'';
      let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
      desc=desc.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,180)+' [...]';
      return {title, link, pubDate:pub?new Date(pub):new Date(), description:desc, source:'Gemeente Ommen', id:bronId};
    }).filter(x=>x.link && x.title);
    if(parsed.length>0) return parsed;
    // RSS leeg -> trigger fallback in app.js
    return [];
  }
  // HTML fallback - scrape /actueel/
  const html=xmlOrHtml;
  const items=[]; const seen=new Set();
  const patterns=[
    /<a[^>]+href="(\/actueel\/[^"]+)"[^>]*>[\s\S]{0,400}?<h[2-3][^>]*>([^<]{8,200})<\/h[2-3]>/gi,
    /<article[^>]*>[\s\S]{0,600}?<a[^>]+href="([^"]+)"[^>]*>([^<]{8,200})<\/a>/gi,
    /<h[2-3][^>]*>\s*<a href="([^"]+)"[^>]*>([^<]{8,200})<\/a>\s*<\/h[2-3]>/gi
  ];
  for(const pat of patterns){
    let m;
    while((m=pat.exec(html))!==null && items.length<12){
      let link=m[1]; let title=m[2].replace(/<[^>]*>/g,'').trim();
      if(link.startsWith('/')) link='https://www.ommen.nl'+link;
      if(!link.includes('ommen.nl')) continue;
      if(seen.has(link)) continue; seen.add(link);
      if(title.length>8) items.push({title, link, pubDate:new Date(), description:title+' [...]', source:'Gemeente Ommen', id:bronId});
    }
    if(items.length>=3) break;
  }
  return items;
}

// Voor app.js - wrapper die eerst RSS probeert, dan HTML fallback
export async function loadGemeenteOmmen(fetchViaWorker, cfg){
  try{
    const xml=await fetchViaWorker(cfg.url);
    let arts=parseGemeenteOmmen(xml, cfg.id, false);
    if(arts.length>0) return arts;
    throw new Error('rss empty -> fallback');
  }catch(e){
    const html=await fetchViaWorker(cfg.fallback||cfg.homepage);
    return parseGemeenteOmmen(html, cfg.id, true);
  }
}
