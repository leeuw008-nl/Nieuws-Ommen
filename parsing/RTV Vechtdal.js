// 🔒 LOCKED v304 - WERKT - NIET WIJZIGEN
// Bron: RTV Vechtdal - https://rtvvechtdal.nl/feed/ + homepage fallback
// Status: WERKT
export function parseRTVVechtdal(html, bronId, pollCache){
  const items=[]; const now=new Date(); const today=new Date(); today.setHours(0,0,0,0);
  const reFull=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h[2-3] class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>[\s\S]{0,800}?<div class="allmode_(?:intro|text|introtext)[^>]*>([\s\S]*?)<\/div>/gi;
  let m; let dirty=false;
  while((m=reFull.exec(html))!==null && items.length<20){
    const dparts=m[1].split('-'); let pd=null;
    if(dparts.length===3){
      const d=new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0);
      const dMidnight=new Date(d); dMidnight.setHours(0,0,0,0);
      const isToday=dMidnight.getTime()===today.getTime();
      pd=isToday?new Date(now):new Date(d.getFullYear(), d.getMonth(), d.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
    }else pd=new Date(now);
    let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
    let intro=m[4].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    intro=intro.length>200?intro.slice(0,200)+' [...]':intro+' [...]';
    if(pollCache && pollCache[link]==null){ pollCache[link]=pd.toISOString(); dirty=true; } else if(pollCache){ pd=new Date(pollCache[link]); }
    items.push({title:m[3].trim(), link, pubDate:pd, description:intro, source:'RTV Vechtdal', id:bronId});
  }
  return {items, dirty};
}
