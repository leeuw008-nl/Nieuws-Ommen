// ✅ WERKEND uit app.js 1 sept - RTV Oost met echte publishedAt - LOCKED
export function parseRTVOost(html){
  const items=[]; let m;
  console.log('[RTV Oost vechtdal] HTML len', html.length);
  const reReal = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/(?!zwolle|twente|enschede|vechtdal|salland|kop-van-overijssel)[^"']{10,150})["'][^>]*>[\s\S]*?<div[^>]*class="[^"]*name-label[^"]*"[^>]*>([^<]{2,20})<\/div>[\s\S]*?<h[2-3][^>]*>([^<]{12,200})<\/h3>/gi;
  while((m=reReal.exec(html))!==null && items.length<25){
    let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let category=m[3].trim().toUpperCase(); let title=m[4].trim();
    if(['ALLE NIEUWS','ZWOLLE','TWENTE'].includes(title.toUpperCase())) continue;
    let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
    let finalTitle = ['NIEUWS','112','ECONOMIE','SPORT'].includes(category) ? category+': '+title : title;
    if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:pd, description:title+' [...]'});
  }
  if(items.length===0){
    const re2 = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/[^"']{10,150})["'][^>]*>[\s\S]*?<h[2-3][^>]*>([^<]{12,200})<\/h3>/gi;
    while((m=re2.exec(html))!==null && items.length<25){
      let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
      let title=m[3].trim(); if(title.toLowerCase().includes('alle nieuws')) continue;
      let pd=new Date(dateStr); if(isNaN(pd.getTime())) continue;
      if(!items.find(x=>x.link===link)) items.push({title, link, pubDate:pd, description:title+' [...]'});
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
    if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:getPoll(link), description:title+' [...]'});
  }
  if(dirty) setOostPollCache(pollCache);
  items.sort((a,b)=>b.pubDate-a.pubDate);
  console.log('[RTV Oost] gevonden', items.length, 'met fallback');
  return items;
}
