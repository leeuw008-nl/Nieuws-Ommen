// LETTERLIJK uit jouw werkende app.js 1 sept - GEEN LETTER VERANDERD
const MAX_PER_BRON = {'De Stentor':25,'RondOmmen':20,'Ommen City':10,'OudOmmen':10,'Vechtdal Centraal':10,'Natuurlijk Ommen':10,'Gemeente Ommen':10,'RTV Oost':10,'RTV Vechtdal':10,'Nieuwsbrief':10};

function getVechtdalCache(){try{return JSON.parse(localStorage.getItem('ommen_vechtdal_poll')||'{}');}catch{return {};}}

function setVechtdalCache(c){try{localStorage.setItem('ommen_vechtdal_poll',JSON.stringify(c));}catch{}}

function parseRTVVechtdalECHT(html){
  const items=[];
  const now = new Date(); const pollCache=getVechtdalCache(); let dirty=false; const pollingMoment=now;
  const today = new Date();
  today.setHours(0,0,0,0);
  const reFull=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h[2-3] class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>[\s\S]{0,800}?<div class="allmode_(?:intro|text|introtext)[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while((m=reFull.exec(html))!==null && items.length<20){
    const dparts=m[1].split('-');
    let pd=null;
    let isToday=false;
    if(dparts.length===3){
      const d = new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0);
      const dMidnight = new Date(d); dMidnight.setHours(0,0,0,0);
      isToday = dMidnight.getTime() === today.getTime();
      if(isToday){
        pd = new Date(pollingMoment);
      }else{
        pd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), pollingMoment.getHours(), pollingMoment.getMinutes(), pollingMoment.getSeconds());
      }
    }else{
      pd = new Date(pollingMoment);
    }
    let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
    let intro=m[4].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(intro.length>200) intro=intro.slice(0,200)+' [...]'; else if(intro) intro=intro+' [...]'; else intro=m[3].trim()+' [...]';
    if(pollCache[link]==null){pollCache[link]=pd.toISOString(); dirty=true;} else if(pd.getHours()!=0 || pd.getMinutes()!=0){pd=new Date(pollCache[link]);} if(dirty) setVechtdalCache(pollCache); items.push({title:m[3].trim(), link, pubDate:pd, description:intro});
  }
  if(items.length===0){
    const re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,500}?<h[2-3] class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi;
    while((m=re.exec(html))!==null && items.length<15){
      const dparts=m[1].split('-');
      let pd=null;
      let isToday=false;
      if(dparts.length===3){
        const d = new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0);
        const dMidnight = new Date(d); dMidnight.setHours(0,0,0,0);
        isToday = dMidnight.getTime() === today.getTime();
        if(isToday){
          pd = new Date(pollingMoment);
        }else{
          pd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), pollingMoment.getHours(), pollingMoment.getMinutes(), pollingMoment.getSeconds());
        }
      }else{
        pd = new Date(pollingMoment);
      }
      let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
      items.push({title:m[3].trim(), link, pubDate:pd, description:m[3].trim()+' [...]'});
    }
  }
  return items;
}

function parseRTVVechtdalFull(html){
  return parseRTVVechtdalECHT(html);
}

export function parseRTVVechtdal(html) {
  return parseRTVVechtdalFull(html);
}
