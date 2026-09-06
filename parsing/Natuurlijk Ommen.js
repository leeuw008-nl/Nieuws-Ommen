// 🔒 LOCKED v304 - WERKT - NIET WIJZIGEN
// Bron: Natuurlijk Ommen - https://www.natuurlijkommen.nl/feed/
// Status: WERKT
export function parseNatuurlijkOmmen(xml, bronId){
  const max=10;
  let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  items=items.slice(0,max);
  return items.map(m=>{
    const it=m[1]||m[0];
    let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
    title=title.replace(/<[^>]*>/g,'').trim();
    let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
    if(!link||link.includes('<')){ const hm=it.match(/<link[^>]+href=["']([^"']+)["']/i); if(hm) link=hm[1]; }
    link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim();
    let pub=(it.match(/<(pubDate|published)[^>]*>([\s\S]*?)<\/(pubDate|published)>/i)||[])[2]||'';
    let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
    desc=desc.replace(/<[^>]*>/g,' ').slice(0,180)+' [...]';
    return {title, link, pubDate:pub?new Date(pub):new Date(), description:desc, source:'Natuurlijk Ommen', id:bronId};
  }).filter(x=>x.link && x.title);
}
