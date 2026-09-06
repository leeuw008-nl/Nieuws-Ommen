// 🔧 FIX v307 - WAS BROKEN "Bron tijdelijk offline" - NU GEFIXT
// Bron: Vechtdal Centraal - https://www.vechtdalcentraal.nl/feed/ + fallback https://www.vechtdalcentraal.nl/
// Probleem: RSS geeft CF challenge + oude parser vond alleen <h2 class="entry-title">
// Fix: probeer eerst RSS, als geen items -> HTML fallback met entry-title + generieke link parser
// Status: GEFIXT v307

export function parseVechtdalCentraal(xmlOrHtml, bronId){
  const items=[]; const seen=new Set();
  // Eerst RSS proberen
  if(xmlOrHtml.includes('<item')){
    const rssItems=[...xmlOrHtml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,10);
    for(const it of rssItems){
      const inner=it[1]||it[0];
      const t=(inner.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
      let l=(inner.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
      if(!l || l.includes('<')){ const hm=inner.match(/<link[^>]+href=["']([^"']+)["']/i); if(hm) l=hm[1]; }
      l=l.replace(/<!\[CDATA\[|\]\]>/g,'').trim();
      if(l && t && l.startsWith('http') && !seen.has(l)){
        seen.add(l);
        items.push({title:t.replace(/<[^>]*>/g,'').trim().slice(0,120), link:l, pubDate:new Date(), description:t.slice(0,120)+' [...]', source:'Vechtdal Centraal', id:bronId});
      }
    }
    if(items.length>0) return items;
  }
  // HTML fallback
  let re=/<h[2-3] class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m;
  while((m=re.exec(xmlOrHtml))!==null && items.length<25){
    let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link;
    if(seen.has(link)) continue; seen.add(link);
    const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();
    if(title.length>4) items.push({title, link, pubDate:new Date(), description:title+' [...]', source:'Vechtdal Centraal', id:bronId});
  }
  if(items.length===0){
    re=/<a[^>]+href="(https:\/\/www\.vechtdalcentraal\.nl\/[^"]+)"[^>]*>([^<]{10,150})<\/a>/gi;
    while((m=re.exec(xmlOrHtml))!==null && items.length<15){
      let link=m[1]; let title=m[2].replace(/<[^>]*>/g,'').trim();
      if(seen.has(link)) continue; seen.add(link);
      if(title.length>8 && !title.toLowerCase().includes('lees meer')) items.push({title, link, pubDate:new Date(), description:title+' [...]', source:'Vechtdal Centraal', id:bronId});
    }
  }
  return items;
}
