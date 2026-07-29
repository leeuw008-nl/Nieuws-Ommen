const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
    { name: 'Vechtdal Centraal', url: 'https://www.vechtdalcentraal.nl/feed/' },
    { name: 'RTV Oost', url: 'https://www.oost.nl/rss.xml' }
];

const ommenKeywords = ["ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"];
let allArticles = [];

async function fetchRSS(url) {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    try {
        const controller = new AbortController();
        const t = setTimeout(()=>controller.abort(), 10000);
        const res = await fetch(apiUrl, {signal: controller.signal});
        clearTimeout(t);
        const data = await res.json();
        if(data.status !== 'ok') return [];
        return data.items.slice(0,10).map(i=>({
            title: i.title || "Geen titel",
            description: (i.description||"").replace(/<[^>]+>/g,"").substring(0,300),
            link: i.link,
            timestamp: Date.parse(i.pubDate) || Date.now()
        }));
    } catch { return []; }
}

async function fetchGemeenteNieuws(){ return []; }
async function fetchRTVVechtdalNieuws(){ return []; }
async function fetchVechtdalCentraalNieuws(){ return []; }
async function fetchOostNieuws(){ return []; }

function isOmmenNieuws(a){ return ommenKeywords.some(k=>(a.title+" "+a.description).toLowerCase().includes(k)); }
function addArticles(arts,bron){ arts.forEach(a=>allArticles.push({...a,source:bron})); }
function finalizeArticles(){
    const seen=new Set();
    allArticles=allArticles.filter(a=>{ if(seen.has(a.link)) return false; seen.add(a.link); return true; });
    allArticles.sort((a,b)=>b.timestamp-a.timestamp);
}

async function loadNews() {
    const container = document.getElementById("news-container");
    if(!container) return;
    allArticles = [];
    container.innerHTML = "<p>Nieuws laden... <small id='load-status'>bezig</small></p>";

    for(const feed of feeds) {
        const el = document.getElementById("load-status");
        if(el) el.innerText = feed.name + " laden...";
        const arts = await fetchRSS(feed.url);
        addArticles(arts, feed.name);
        finalizeArticles();
        // direct renderen na elke bron
        renderArticles(allArticles);
    }
    const el = document.getElementById("load-status");
    if(el) el.innerText = `Klaar! ${allArticles.length} artikelen (Gemeente & RTV Vechtdal tijdelijk uit)`;
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");
    if(!container) return;
    const status = document.getElementById("load-status")?.innerText || "";
    let html = `<p><strong>${articles.length} artikelen</strong> <small id="load-status">${status}</small></p>`;
    if(articles.length===0) html+="<p>Even geduld, laden...</p>";
    else html+=articles.map(a=>`<div class="article"><h2><a href="${a.link}" target="_blank">${a.title}</a></h2><small>${a.source}</small><p>${a.description}</p></div>`).join("");
    container.innerHTML=html;
}
function searchNews(){
    const si=document.getElementById("search-input");
    if(!si) return;
    let arts=[...allArticles];
    const alleenOmmen=document.getElementById("only-ommen")?.checked;
    if(alleenOmmen) arts=arts.filter(a=>isOmmenNieuws(a));
    const zoekterm=si.value.toLowerCase().trim();
    if(zoekterm) arts=arts.filter(a=>(a.title+" "+a.description).toLowerCase().includes(zoekterm));
    const gekozen=Array.from(document.querySelectorAll(".source-filter:checked")).map(b=>b.value);
    if(gekozen.length>0) arts=arts.filter(a=>gekozen.includes(a.source));
    renderArticles(arts);
}
function setupSearch(){
    const si=document.getElementById("search-input");
    const so=document.getElementById("only-ommen");
    if(si) si.addEventListener("input",searchNews);
    if(so) so.addEventListener("change",()=>{ si.value=""; searchNews(); });
}
function setupSources(){
    const b=document.getElementById("source-button");
    const m=document.getElementById("source-menu");
    if(m) m.style.display="none";
    if(!b||!m) return;
    b.addEventListener("click",()=>{
        if(m.style.display==="none"){ m.style.display="block"; b.innerHTML="Bronnen ▲"; }
        else{ m.style.display="none"; b.innerHTML="Bronnen ▼"; }
    });
    document.querySelectorAll(".source-filter").forEach(el=>el.addEventListener("change",searchNews));
}
window.addEventListener("DOMContentLoaded",()=>{ setupSearch(); setupSources(); loadNews(); });
function refreshNews(){ loadNews(); }
