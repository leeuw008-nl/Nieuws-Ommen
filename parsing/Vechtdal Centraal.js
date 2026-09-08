// ✅ WERKEND uit app.js 1 sept - Vechtdal Centraal - LOCKED
function parseVechtdalCentraalECHT(html){
  const items=[]; const seen=new Set();
  // Originele parser - behouden
  let re=/<h[2-3] class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m;
  while((m=re.exec(html))!==null && items.length<25){
    let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link;
    if(seen.has(link)) continue; seen.add(link);
    const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();
    if(title.length>4) items.push({title, link, pubDate:new Date(), description:title+' [...]'});
  }
  if(items.length>0) return items;
  // FIX 25-08-2026: nieuwe thema varianten - vechtdalcentraal gebruikt nu ook <h2><a> en article
  const patterns=[
    /<h2[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]{8,200})<\/a>\s*<\/h2>/gi,
    /<article[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>[\s\S]*?<h[23]/gi,
    /<a[^>]+href="(https:\/\/www\.vechtdalcentraal\.nl\/[^"']{5,150})"[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)</gi,
    /<a href="(\/[^"']{5,150})"[^>]*>[^<]*<h[2-3][^>]*>([^<]{8,200})<\/h3>/gi
  ];
  for(const pat of patterns){
    let mm;
    while((mm=pat.exec(html))!==null && items.length<25){
      let link=mm[1]; let title=mm[2].replace(/<[^>]*>/g,'').replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();
      if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link;
      if(!link.includes('vechtdalcentraal.nl')) continue;
      if(seen.has(link)) continue; seen.add(link);
      if(title.length>8) items.push({title, link, pubDate:new Date(), description:title+' [...]'});
    }
    if(items.length>5) break;
  }
  return items;
}

function parseVechtdalCentraalFallback_OLD(html){
  const max = MAX_PER_BRON['Vechtdal Centraal'];
  const re = /<a[^>]+href=["']([^"']*\/[^"']+)["'][^>]*>\s*<h[23][^>]*>([^<]{8,120})<\/h[23]>/gi;
  const map=new Map();
  let m;
  while((m=re.exec(html))!==null && map.size<max){
    let href=m[1], title=m[2].trim();
    if(href.startsWith('/')) href='https://www.vechtdalcentraal.nl'+href;
    if(!href.includes('vechtdalcentraal.nl')) continue;
    if(href.includes('/category/') || href.includes('/tag/') || href.includes('#')) continue;
    if(!map.has(href)) map.set(href, title);
  }
  return Array.from(map.entries()).slice(0,max).map(([link,title])=>({title, link, pubDate:new Date(), description:'[...]'}));
}


export function parseVechtdalCentraal(data, bronId){
  let arts = [];
  try{ arts = parseVechtdalCentraalECHT(data); }catch(e){}
  if(arts.length===0){
    try{ arts = parseVechtdalCentraalFallback_OLD(data); }catch(e){}
  }
  return arts;
}
