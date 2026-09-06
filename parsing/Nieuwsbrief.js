// 🔒 LOCKED v271 - WERKT - NIET WIJZIGEN (behalve ECHT fix #8)
// Bron: Nieuwsbrief - worker feed https://ommen-push-v2.leeuw008.workers.dev/newsletter/feed
// ECHT berichten hebben isEcht:true en echtId
export function parseNieuwsbrief(json, bronId){
  try{
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const items = data.items || data.articles || data || [];
    return items.map(it=>{
      const isEcht = it.isEcht || it.type==='echt' || it.id?.startsWith('echt-');
      const title = it.title || it.subject || (isEcht?'Belangrijk bericht':'Nieuwsbrief');
      const link = it.link || it.url || (isEcht?`/?echt=${encodeURIComponent(it.id||Date.now())}`:'https://nieuwommen.leeuw008.nl/');
      let pubDate=new Date(); if(it.pubDate||it.date||it.updated){ const d=new Date(it.pubDate||it.date||it.updated); if(!isNaN(d.getTime())) pubDate=d; }
      const desc = it.description || it.body || it.excerpt || title;
      return {title:title.slice(0,150), link, pubDate, description:desc.slice(0,300)+' [...]', source:isEcht?'NieuwOmmen ECHT':'Nieuwsbrief', id:bronId, isEcht:isEcht, echtId:it.id||it.echtId||null};
    }).slice(0,20);
  }catch(e){ return []; }
}
