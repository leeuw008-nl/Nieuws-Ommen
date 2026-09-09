// ✅ JOUW eigen code v334 - alleen description langer gemaakt - verder onaangepast
const MAX_PER_BRON = {'De Stentor':25,'RondOmmen':20,'Ommen City':10,'OudOmmen':10,'Vechtdal Centraal':10,'Natuurlijk Ommen':10,'Gemeente Ommen':10,'RTV Oost':15,'RTV Vechtdal':10,'Nieuwsbrief':20};

function getOostPollCache(){
  try{ return JSON.parse(localStorage.getItem('oost_poll_cache')||'{}'); }catch{ return {}; }
}
function setOostPollCache(c){ localStorage.setItem('oost_poll_cache', JSON.stringify(c)); }

function extractOostDesc(html, pos){
  // Pak 1200 chars na de titel en zoek naar echte intro tekst
  const slice = html.substring(pos, pos+1200);
  // RTV Oost heeft vaak <p> of <div class="...teaser..."> of <div class="...intro...">
  let m = slice.match(/<p[^>]*>([\s\S]{30,300}?)<\/p>/i);
  if(m){
    let txt = m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(txt.length>30) return txt;
  }
  m = slice.match(/<div[^>]*class="[^"]*(?:teaser|intro|excerpt)[^"]*"[^>]*>([\s\S]{30,400}?)<\/div>/i);
  if(m){
    let txt = m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(txt.length>30) return txt;
  }
  return '';
}

export function parseRTVOost(html){
  const items=[]; let m;
  console.log('[RTV Oost vechtdal] HTML len', html.length);
  const reReal = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/(?!zwolle|twente|enschede|vechtdal|salland|kop-van-overijssel)[^"']{10,150})["'][^>]*>[\s\S]*?<div[^>]*class="[^"]*name-label[^"]*"[^>]*>([^<]{2,20})<\/div>[\s\S]*?<h[2-3][^>]*>([^<]{12,200})<\/h3>/gi;
  while((m=reReal.exec(html))!==null && items.length<25){
    let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let category=m[3].trim().toUpperCase(); let title=m[4].trim();
    if(['ALLE NIEUWS','ZWOLLE','TWENTE'].includes(title.toUpperCase())) continue;
    let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
    let finalTitle = ['NIEUWS','112','ECONOMIE','SPORT'].includes(category)? category+': '+title : title;
    if(!items.find(x=>x.link===link)){
      let desc = extractOostDesc(html, m.index);
      if(!desc) desc = title;
      if(desc.length>180) desc=desc.slice(0,177)+' [...]'; else desc=desc+' [...]';
      items.push({title:finalTitle, link, pubDate:pd, description:desc});
    }
  }
  if(items.length===0){
    const re2 = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/[^"']{10,150})["'][^>]*>[\s\S]*?<h[2-3][^>]*>([^<]{12,200})<\/h3>/gi;
    while((m=re2.exec(html))!==null && items.length<25){
      let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
      let title=m[3].trim(); if(title.toLowerCase().includes('alle nieuws')) continue;
      let pd=new Date(dateStr); if(isNaN(pd.getTime())) continue;
      if(!items.find(x=>x.link===link)){
        let desc = extractOostDesc(html, m.index);
        if(!desc) desc = title;
        if(desc.length>180) desc=desc.slice(0,177)+' [...]'; else desc=desc+' [...]';
        items.push({title, link, pubDate:pd, description:desc});
      }
    }
  }
  if(items.length>0){ items.sort((a,b)=>b.pubDate-a.pubDate); console.log('[RTV Oost] gevonden', items.length, 'met echte publishedAt'); return items; }
  const pollCache=getOostPollCache(); let dirty=false; const now=new Date();
  function getPoll(link){ if(pollCache[link]){const d=new Date(pollCache[link]); if(!isNaN(d.getTime())) return d;} const d=new Date(now); pollCache[link]=d.toISOString(); dirty=true; return d; }
  const reBlock = /<a[^>]+href=["'](\/nieuws\/(?!zwolle|twente|enschede|vechtdal|salland|kop-van-overijssel)[^"']{10,150})["'][^>]*>([\s\S]*?)<\/a>/gi;
  let blockMatch; while((blockMatch=reBlock.exec(html))!==null && items.length<20){
    let link=blockMatch[1]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let inner=blockMatch[2]; let catMatch=inner.match(/<(?:span|div)[^>]*>\s*(NIEUWS|112|ECONOMIE|SPORT)\s*<\/(?:span|div)>/i); let category=catMatch?catMatch[1].toUpperCase():''; let titleMatch=inner.match(/<h[23][^>]*>([^<]{12,180})<\/h[23]>/i); let title=titleMatch?titleMatch[1].trim():''; if(!title||title.length<12) continue;
    if(['alle nieuws','zwolle','twente','enschede','vechtdal','salland','kop van overijssel'].includes(title.toLowerCase())) continue;
    let finalTitle=category?category+': '+title:title;
    if(!items.find(x=>x.link===link)){
      let pMatch = inner.match(/<p[^>]*>([^<]{30,300})<\/p>/i);
      let desc = pMatch? pMatch[1].replace(/<[^>]*>/g,' ').trim() : title;
      if(desc.length>180) desc=desc.slice(0,177)+' [...]'; else desc=desc+' [...]';
      items.push({title:finalTitle, link, pubDate:getPoll(link), description:desc});
    }
  }
  if(dirty) setOostPollCache(pollCache);
  items.sort((a,b)=>b.pubDate-a.pubDate);
  console.log('[RTV Oost] gevonden', items.length, 'met fallback');
  return items;
}
