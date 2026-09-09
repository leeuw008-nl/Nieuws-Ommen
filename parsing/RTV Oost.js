// v401 FIX - pakt nu echte beschrijving uit zelfde blok
export function parseRTVOost(html){
  const items=[]; let m;
  console.log('[RTV Oost] HTML len', html.length);
  // NIEUW: probeert nu ook <p> teaser direct na h3 te pakken
  const reReal = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/(?!zwolle|twente|enschede|vechtdal|salland|kop-van-overijssel)[^"']{10,150})["'][^>]*>[\s\S]*?<div[^>]*class="[^"]*name-label[^"]*"[^>]*>([^<]{2,20})<\/div>[\s\S]*?<h[2-3][^>]*>([^<]{12,200})<\/h3>[\s\S]{0,400}?(?:<p[^>]*>([^<]{20,300})<\/p>)?/gi;

  while((m=reReal.exec(html))!==null && items.length<25){
    let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let category=m[3].trim().toUpperCase(); let title=m[4].trim();
    let teaser=m[5]? m[5].trim() : '';
    if(['ALLE NIEUWS','ZWOLLE','TWENTE'].includes(title.toUpperCase())) continue;
    let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
    let finalTitle = ['NIEUWS','112','ECONOMIE','SPORT'].includes(category)? category+': '+title : title;
    // ECHTE beschrijving als die er is, anders lange fallback
    let desc = teaser? teaser+' [...]' : finalTitle+' - Lees het volledige verhaal op RTV Oost [...]';
    if(desc.length>200) desc=desc.slice(0,197)+' [...]';
    if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:pd, description:desc});
  }
  if(items.length>0){ items.sort((a,b)=>b.pubDate-a.pubDate); return items; }

  // fallback zonder name-label
  const re2 = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/[^"']{10,150})["'][^>]*>[\s\S]*?<h[2-3][^>]*>([^<]{12,200})<\/h3>[\s\S]{0,400}?(?:<p[^>]*>([^<]{20,300})<\/p>)?/gi;
  while((m=re2.exec(html))!==null && items.length<20){
    let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let title=m[3].trim(); let teaser=m[4]?m[4].trim():'';
    if(title.toLowerCase().includes('alle nieuws')) continue;
    let pd=new Date(dateStr); if(isNaN(pd.getTime())) continue;
    let desc = teaser? teaser+' [...]' : title+' [...]';
    if(!items.find(x=>x.link===link)) items.push({title, link, pubDate:pd, description:desc});
  }
  return items.sort((a,b)=>b.pubDate-a.pubDate);
}
