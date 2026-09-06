// 🔒 LOCKED v304 - WERKT - NIET WIJZIGEN
export function parseRondOmmen(xml, bronId){
  const max=20;
  let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,max);
  return items.map(m=>{
    const it=m[1]||m[0];
    let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
    title=title.replace(/<[^>]*>/g,'').trim();
    let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
    link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim();
    let pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||'';
    let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
    desc=desc.replace(/<[^>]*>/g,' ').slice(0,180)+' [...]';
    return {title, link, pubDate:pub?new Date(pub):new Date(), description:desc, source:'RondOmmen', id:bronId};
  }).filter(x=>x.link && x.title);
}
