// RTV Oost fix v338 - 5 artikelen ipv 3 + echte beschrijving
// Plaats NA app.js in index.html: <script src="rtv-oost-fix-338.js?v=338"></script>
(function(){
  console.log('[RTV Oost fix v338] patching...');
  // Overschrijf parser om CULTUUR/NATUUR mee te nemen
  const oldParse = window.parseRTVOostECHT || window.parseOostFull;
  // Nieuwe parser die alle 5 pakt
  window.parseRTVOostECHT = function(html){
    const items=[]; let m;
    console.log('[RTV Oost v338] HTML len', html.length);
    // 1: originele publishedAt maar nu met alle categorieen
    const reReal = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/\d+\/[^"']{5,180})["'][^>]*>[\s\S]*?<div[^>]*class="[^"]*name-label[^"]*"[^>]*>([^<]{2,25})<\/div>[\s\S]*?<h3[^>]*>([^<]{12,300})<\/h3>/gi;
    while((m=reReal.exec(html))!==null && items.length<10){
      let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
      let category=m[3].trim().toUpperCase(); let title=m[4].trim();
      if(['ALLE NIEUWS'].includes(title.toUpperCase())) continue;
      let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
      // Nu ook CULTUUR, NATUUR, etc toestaan
      let finalTitle = ['NIEUWS','112','ECONOMIE','SPORT','CULTUUR','NATUUR','POLITIEK','WEER'].includes(category) ? category+': '+title : title;
      if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:pd, description:'', _cat:category, _needsEnrich:true});
    }
    if(items.length>=3) { items.sort((a,b)=>b.pubDate-a.pubDate); console.log('[RTV Oost v338] via publishedAt', items.length); return items; }
    // 2: fallback op cards zoals screenshot
    const reCards = /<div[^>]*>\s*(CULTUUR|ECONOMIE|NIEUWS|NATUUR|112|SPORT)\s*<\/div>[\s\S]{0,600}?<a[^>]+href=["'](\/nieuws\/\d+\/[^"']+)["'][^>]*>[\s\S]{0,400}?<h[23][^>]*>([^<]{12,300})<\/h[23]>/gi;
    let mm;
    while((mm=reCards.exec(html))!==null && items.length<10){
      let cat=mm[1].toUpperCase(); let link=mm[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
      let title=mm[3].trim();
      if(!items.find(x=>x.link===link)) items.push({title:cat+': '+title, link, pubDate:new Date(), description:'', _cat:cat, _needsEnrich:true});
    }
    items.sort((a,b)=>b.pubDate-a.pubDate);
    console.log('[RTV Oost v338] fallback', items.length);
    return items;
  };
  if(window.parseOostFull){
    const origFull = window.parseOostFull;
    window.parseOostFull = function(html){
      const echt = window.parseRTVOostECHT(html);
      if(echt.length>0) return echt;
      return origFull(html);
    };
  }
  // Enrich met echte beschrijving uit artikel (via allorigins, geen KV puts)
  function getCache(){try{return JSON.parse(localStorage.getItem('ommen_oost_desc_v2')||'{}');}catch{return {};}}
  function setCache(c){try{localStorage.setItem('ommen_oost_desc_v2', JSON.stringify(c));}catch{}}
  function extractDesc(html){
    let m=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,600})["']/i);
    if(m) return m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim();
    m=html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,600})["']/i);
    if(m) return m[1].trim();
    m=html.match(/<p[^>]*>\s*<strong[^>]*>([^<]{30,600})<\/strong>\s*<\/p>/i);
    if(m) return m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return '';
  }
  window.enrichOostWithDetail = async function(overview){
    if(!overview || overview.length===0) return overview;
    const cache=getCache(); const now=Date.now();
    const toFetch=overview.filter(a=>a._needsEnrich || !a.description).slice(0,5);
    console.log('[RTV Oost v338] enrich', toFetch.length);
    for(const art of toFetch){
      const cached=cache[art.link];
      if(cached && cached.desc && (now-cached.ts)<86400000){ art.description=cached.desc; art._needsEnrich=false; continue; }
      try{
        const r=await fetch('https://api.allorigins.win/get?url='+encodeURIComponent(art.link)+'&t='+Date.now(), {cache:'no-store'});
        if(r.ok){
          const j=await r.json(); const html=j.contents||'';
          let desc=extractDesc(html);
          if(desc){
            if(desc.length>180) desc=desc.slice(0,177)+' [...]'; else desc+=' [...]';
            art.description=desc;
            cache[art.link]={desc, ts:now};
          } else {
            art.description='Lees meer op RTV Oost - '+(art._cat||'');
          }
          art._needsEnrich=false;
        }
      }catch(e){ art.description='Lees meer op RTV Oost'; art._needsEnrich=false; }
      await new Promise(r=>setTimeout(r,400));
    }
    setCache(cache);
    try{
      const map=new Map(toFetch.map(a=>[a.link,a.description]));
      if(window.allArticles){
        window.allArticles=window.allArticles.map(a=> map.has(a.link) && map.get(a.link) ? {...a, description:map.get(a.link)} : a);
        window.renderArticles && window.renderArticles();
      }
    }catch{}
    return overview;
  };
  // Hook loadOneSource voor RTV Oost
  const origLoad = window.loadOneSource;
  if(origLoad){
    window.loadOneSource = async function(b){
      if(b.id==='RTV Oost'){
        try{
          let html='';
          try{ html=await window.fetchViaWorker(b.url || 'https://www.oost.nl/nieuws/vechtdal'); }catch{}
          if(!html || html.length<500){
            try{ const r=await fetch('https://api.allorigins.win/get?url='+encodeURIComponent('https://www.oost.nl/nieuws/vechtdal')); if(r.ok){ const j=await r.json(); html=j.contents||''; } }catch{}
          }
          let arts = window.parseOostFull(html);
          if(arts.length>0){
            arts.forEach(a=>{ if(!a.description) a.description=''; });
            const tmp=arts.map(a=>({...a, source:b.name, id:b.id}));
            window.allArticles=window.allArticles.filter(x=>x.id!==b.id).concat(tmp);
            window.loadedSources && window.loadedSources.add(b.id);
            window.updateHeaderCount && window.updateHeaderCount();
            window.renderArticles && window.renderArticles();
            window.updateSourceLeds && window.updateSourceLeds();
            window.enrichOostWithDetail(arts).catch(()=>{});
            return tmp;
          }
        }catch(e){ console.log('oost load fail', e.message); }
      }
      return origLoad(b);
    };
  }
  console.log('[RTV Oost fix v338] actief - 5 artikelen + echte beschrijving, 0 KV puts');
  // Auto run als RTV Oost al geladen
  setTimeout(()=>{ if(window.allArticles){ const oostArts=window.allArticles.filter(a=>a.id==='RTV Oost'); if(oostArts.length>0) window.enrichOostWithDetail(oostArts); } }, 2000);
})();
