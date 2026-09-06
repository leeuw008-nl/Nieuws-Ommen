// 🔧 FIX v307 - WAS BROKEN "Bron tijdelijk offline" - NU GEFIXT
// Bron: RTV Oost - https://www.oost.nl/nieuws/vechtdal
// Probleem: oost.nl nieuwe layout, oude regex vond geen <a href="/nieuws/..."><h3> meer
// Fix: 2 nieuwe patterns + behoud echte publishedAt datum ipv refresh datum (was bug #3)
// Status: GEFIXT v307 - Na fix LOCKEN met 🔒

export function parseRTVOost(html, bronId){
  const items=[]; let m;
  const patterns=[
    /<a[^>]+href=["'](\/nieuws\/[^"']+)["'][^>]*>[\s\S]{0,400}?<h[2-3][^>]*>([^<]{10,200})<\/h[2-3]>/gi,
    /publishedAt=["']([^"']+)["'][^>]*>[\s\S]{0,1200}?<a[^>]+href=["'](\/nieuws\/[^"']+)["'][^>]*>[\s\S]{0,300}?<h[2-3][^>]*>([^<]{10,200})<\/h[2-3]>/gi
  ];
  for(const pat of patterns){
    while((m=pat.exec(html))!==null && items.length<15){
      let link, title, dateStr;
      if(pat.source.includes('publishedAt')){ dateStr=m[1]; link=m[2]; title=m[3]; }
      else{ link=m[1]; title=m[2]; dateStr=new Date().toISOString(); }
      if(link.startsWith('/')) link='https://www.oost.nl'+link;
      if(title) title=title.trim();
      if(title && title.length>10 && !items.find(x=>x.link===link)){
        let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
        items.push({title, link, pubDate:pd, description:'', _publishedAt:pd, source:'RTV Oost', id:bronId});
      }
    }
    if(items.length>=5) break;
  }
  if(items.length===0){
    const reAll=/<a[^>]+href=["'](\/nieuws\/[^"']+)["'][^>]*>([^<]{15,120})</gi;
    while((m=reAll.exec(html))!==null && items.length<10){
      let link='https://www.oost.nl'+m[1]; let title=m[2].trim();
      if(title.length>10 && !items.find(x=>x.link===link)) items.push({title, link, pubDate:new Date(), description:'', _publishedAt:new Date(), source:'RTV Oost', id:bronId});
    }
  }
  return items;
}

export function extractOostDate(html){
  let m=html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; }
  m=html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
  if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; }
  return null;
}
export function extractOostDescription(html){
  let m=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if(!m) m=html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if(m) return m[1].trim();
  return '';
}

// Voor app.js - enrich met echte datum + beschrijving uit detail pagina (met cache 3u)
export async function enrichOostWithDetail(arts, fetchViaWorker, getCache, setCache){
  let cache=getCache(); const now=Date.now(); const TTL=1000*60*60*3;
  arts.forEach(a=>{
    const cached=cache[a.link];
    if(cached && (now-cached.ts)<TTL && cached.desc){
      a.description=cached.desc;
      if(cached.iso){ const cd=new Date(cached.iso); if(!isNaN(cd.getTime())) a.pubDate=cd; }
      a._needsEnrich=false;
    }else{
      if(a._publishedAt) a.pubDate=a._publishedAt;
      a._needsEnrich=true;
    }
  });
  const need=arts.filter(a=>a._needsEnrich).slice(0,10);
  if(need.length===0) return arts;
  for(let i=0;i<need.length;i+=3){
    const batch=need.slice(i,i+3);
    await Promise.allSettled(batch.map(async a=>{
      const orig=a.pubDate;
      try{
        const html=await fetchViaWorker(a.link);
        let desc=extractOostDescription(html); let realDate=extractOostDate(html);
        if(realDate) a.pubDate=realDate; else if(orig) a.pubDate=orig;
        if(desc){ desc=desc.length>217?desc.slice(0,217)+' [...]':desc+' [...]'; a.description=desc; cache[a.link]={desc, iso:a.pubDate?a.pubDate.toISOString():null, ts:now}; }
      }catch(e){ if(orig) a.pubDate=orig; } finally{ a._needsEnrich=false; }
    }));
    if(i+3<need.length) await new Promise(r=>setTimeout(r,300));
  }
  setCache(cache);
  return arts;
}
