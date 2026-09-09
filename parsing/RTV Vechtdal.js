// v401 FIX - feed + homepage beide
export function parseRTVVechtdal(html){
  const items=[];
  // eerst proberen als RSS feed
  if(html.includes('<rss') || html.includes('<item')){
    const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let m;
    while((m=re.exec(html))!==null && items.length<10){
      const it=m[1];
      let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
      title=title.replace(/<[^>]*>/g,'').trim();
      let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
      link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim();
      let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
      desc=desc.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      if(desc.length>180) desc=desc.slice(0,177)+' [...]'; else if(desc) desc=desc+' [...]'; else desc=title+' [...]';
      let pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||'';
      if(title && link) items.push({title, link, pubDate: pub?new Date(pub): new Date(), description:desc});
    }
    if(items.length>0) return items.sort((a,b)=>b.pubDate-a.pubDate);
  }
  // fallback: oude allmode homepage
  const reFull=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h[2-3] class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>[\s\S]{0,800}?<div class="allmode_(?:intro|text|introtext)[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while((m=reFull.exec(html))!==null && items.length<10){
    let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
    let intro=m[4].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(intro.length>180) intro=intro.slice(0,177)+' [...]'; else intro=intro+' [...]';
    items.push({title:m[3].trim(), link, pubDate:new Date(), description:intro});
  }
  return items;
}
