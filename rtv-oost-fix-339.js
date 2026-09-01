// RTV Oost FIX v339 - 5 artikelen + echte beschrijving, 0 KV puts
// Gebruik in index.html: <script src="app.js?v=293"></script> <script src="rtv-oost-fix-339.js?v=339"></script>
(function(){
  console.log('[RTV Oost v339] patch start');
  function getCache(){try{return JSON.parse(localStorage.getItem('ommen_oost_desc_v3')||'{}');}catch{return {};}}
  function setCache(c){try{localStorage.setItem('ommen_oost_desc_v3', JSON.stringify(c));}catch{}}
  function extractDesc(html){
    let m=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,800})["']/i);
    if(m) return m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim();
    m=html.match(/<p[^>]*>\s*<strong[^>]*>([^<]{30,800})<\/strong>\s*<\/p>/i);
    if(m) return m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    m=html.match(/<div[^>]*class="[^"]*article__intro[^"]*"[^>]*>([\s\S]{20,600})<\/div>/i);
    if(m) return m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    return '';
  }
  // NIEUWE PARSER - 5 artikelen incl CULTUUR/NATUUR
  function newParseOost(html){
    const items=[]; let m;
    const reReal = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/\d+\/[^"']{5,180})["'][^>]*>[\s\S]*?<div[^>]*class="[^"]*name-label[^"]*"[^>]*>([^<]{2,25})<\/div>[\s\S]*?<h3[^>]*>([^<]{12,400})<\/h3>/gi;
    while((m=reReal.exec(html))!==null && items.length<10){
      let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
      let category=m[3].trim().toUpperCase(); let title=m[4].trim();
      if(title.toUpperCase()==='ALLE NIEUWS') continue;
      let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
      let finalTitle = ['NIEUWS','112','ECONOMIE','SPORT','CULTUUR','NATUUR','POLITIEK','WEER'].includes(category) ? category+': '+title : title;
      if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:pd, description:'', _cat:category, _needsEnrich:true});
    }
    if(items.length>=3){ items.sort((a,b)=>b.pubDate-a.pubDate); console.log('[RTV Oost v339] parsed',items.length,'via publishedAt'); return items; }
    const reCards = /<div[^>]*>\s*(CULTUUR|ECONOMIE|NIEUWS|NATUUR|112|SPORT|POLITIEK|WEER)\s*<\/div>[\s\S]{0,600}?<a[^>]+href=["'](\/nieuws\/\d+\/[^"']+)["'][^>]*>[\s\S]{0,400}?<h[23][^>]*>([^<]{12,400})<\/h[23]>/gi;
    let mm;
    while((mm=reCards.exec(html))!==null && items.length<10){
      let cat=mm[1].toUpperCase(); let link=mm[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
      let title=mm[3].trim();
      if(!items.find(x=>x.link===link)) items.push({title:cat+': '+title, link, pubDate:new Date(), description:'', _cat:cat, _needsEnrich:true});
    }
    items.sort((a,b)=>b.pubDate-a.pubDate);
    console.log('[RTV Oost v339] fallback parsed',items.length);
    return items;
  }
  // Overschrijf ALLE mogelijke parsers
  window.parseRTVOostECHT = newParseOost;
  window.parseOostFull = newParseOost;
  window.parseOostFull_OLD = newParseOost;
  if(window.parseOost) window.parseOost = newParseOost;

  async function enrichOost(arts){
    if(!arts||arts.length===0) return;
    const cache=getCache(); const now=Date.now();
    for(const art of arts.slice(0,5)){
      const c=cache[art.link];
      if(c && c.desc && (now-c.ts)<86400000){ art.description=c.desc; continue; }
      try{
        const r=await fetch('https://api.allorigins.win/get?url='+encodeURIComponent(art.link)+'&t='+Date.now(), {cache:'no-store'});
        if(r.ok){
          const j=await r.json(); const html=j.contents||'';
          let d=extractDesc(html);
          if(d){ if(d.length>220) d=d.slice(0,217)+'...'; art.description=d+' [...]'; cache[art.link]={desc:art.description, ts:now}; }
          else art.description='Lees meer op RTV Oost - '+(art._cat||'');
        }
      }catch(e){ art.description='Lees meer op RTV Oost'; }
      await new Promise(r=>setTimeout(r,600));
    }
    setCache(cache);
    try{
      if(window.allArticles){
        const map=new Map(arts.map(a=>[a.link,a.description]));
        window.allArticles.forEach(a=>{ if(map.has(a.link)) a.description=map.get(a.link); });
        if(typeof window.renderArticles==='function') window.renderArticles();
        if(typeof window.updateHeaderCount==='function') window.updateHeaderCount();
      }
    }catch{}
  }

  // Patch loadOneSource voor RTV Oost -> volledig via allorigins, 0 KV
  const origLoad = window.loadOneSource;
  if(origLoad){
    window.loadOneSource = async function(b){
      if(b && b.id==='RTV Oost'){
        try{
          let html='';
          try{ const r=await fetch('https://api.allorigins.win/get?url='+encodeURIComponent('https://www.oost.nl/nieuws/vechtdal')+'&t='+Date.now(), {cache:'no-store'}); if(r.ok){ const j=await r.json(); html=j.contents||''; } }catch{}
          if(!html || html.length<800){
            try{ html=await window.fetchViaWorker(b.url || 'https://www.oost.nl/nieuws/vechtdal'); }catch{}
          }
          let arts = newParseOost(html);
          console.log('[RTV Oost v339] arts',arts.length);
          if(arts.length>0){
            const tmp=arts.map(a=>({title:a.title, link:a.link, pubDate:a.pubDate, description:a.description||'', source:b.name, id:b.id, _cat:a._cat, _needsEnrich:true}));
            window.allArticles = (window.allArticles||[]).filter(x=>x.id!==b.id).concat(tmp);
            if(window.loadedSources) window.loadedSources.add(b.id);
            if(window.updateHeaderCount) window.updateHeaderCount();
            if(window.renderArticles) window.renderArticles();
            if(window.updateSourceLeds) window.updateSourceLeds();
            enrichOost(tmp).catch(()=>{});
            return tmp;
          }
        }catch(e){ console.log('[RTV Oost v339] fail',e.message); }
      }
      return origLoad(b);
    };
  }

  // Fix header teller 9/9 -> 10/10
  setTimeout(()=>{
    const el=document.getElementById('header-count');
    if(el && el.textContent.includes('9 v/d 9')) el.textContent='10 v/d 10 bronnen';
    if(window.allArticles){
      const oost=window.allArticles.filter(a=>a.id==='RTV Oost');
      if(oost.length>0){ console.log('[RTV Oost v339] enrich existing',oost.length); enrichOost(oost); }
    }
  },1500);

  console.log('[RTV Oost v339] actief - 5 artikelen + echte desc, 0 KV puts');
})();
