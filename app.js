// app.js v400 CLEAN - Modulaire opbouw - GEEN parsing code meer hier
// Alle parsing staat in parsing/ map - elk bestand 1 bron
// Fix = alleen parsing/[Bron].js editen, nooit app.js

import { parseDeStentor } from './parsing/De Stentor.js';
import { parseGemeenteOmmen } from './parsing/Gemeente Ommen.js';
import { parseNatuurlijkOmmen } from './parsing/Natuurlijk Ommen.js';
import { parseOmmenCity } from './parsing/Ommen City.js';
import { parseOudOmmen } from './parsing/OudOmmen.js';
import { parseRondOmmen } from './parsing/RondOmmen.js';
import { parseRTVOost } from './parsing/RTV Oost.js';
import { parseRTVVechtdal } from './parsing/RTV Vechtdal.js';
import { parseVechtdalCentraal } from './parsing/Vechtdal Centraal.js';
import { parseNieuwsbrief } from './parsing/Nieuwsbrief.js';

const BRONNEN = [
  {id:'De Stentor', name:'De Stentor', sub:'regionaal (Ommen)'},
  {id:'Gemeente Ommen', name:'Gemeente Ommen', sub:'officiele berichten'},
  {id:'Natuurlijk Ommen', name:'Natuurlijk Ommen', sub:'evenementen & toerisme'},
  {id:'Ommen City', name:'Ommen City', sub:'lokaal nieuws Ommen'},
  {id:'OudOmmen', name:'OudOmmen', sub:'artikelen over historie'},
  {id:'RondOmmen', name:'RondOmmen', sub:'lokaal nieuws'},
  {id:'RTV Oost', name:'RTV Oost', sub:'regionaal Overijssel'},
  {id:'RTV Vechtdal', name:'RTV Vechtdal', sub:'lokaal Vechtdal'},
  {id:'Vechtdal Centraal', name:'Vechtdal Centraal', sub:'112 & dorpsnieuws'},
  {id:'Nieuwsbrief', name:'NieuwOmmen', sub:'Nieuwsbrief updates & releases'},
];

const BRON_URLS = {
  'De Stentor': {url:'https://www.destentor.nl/ommen/rss.xml', homepage:'https://www.destentor.nl/ommen/'},
  'Gemeente Ommen': {url:'https://www.ommen.nl/actueel/', homepage:'https://www.ommen.nl/actueel/', type:'gemeente', fallback:'https://www.ommen.nl/feed/'},
  'Natuurlijk Ommen': {url:'https://www.natuurlijkommen.nl/feed/', homepage:'https://www.natuurlijkommen.nl/'},
  'Ommen City': {url:'https://ommencity.nl/feed/', homepage:'https://ommencity.nl/'},
  'OudOmmen': {url:'https://weblog.oudommen.nl/feed/', homepage:'https://weblog.oudommen.nl/'},
  'RondOmmen': {url:'https://www.rondommen.nl/feed/', homepage:'https://www.rondommen.nl/'},
  'RTV Oost': {url:'https://www.oost.nl/nieuws/vechtdal', homepage:'https://www.oost.nl/nieuws/vechtdal', type:'oost'},
  'RTV Vechtdal': {url:'https://rtvvechtdal.nl/feed/', homepage:'https://rtvvechtdal.nl/'},
  'Vechtdal Centraal': {url:'https://www.vechtdalcentraal.nl/feed/', homepage:'https://www.vechtdalcentraal.nl/', fallback:'https://www.vechtdalcentraal.nl/'},
  'Nieuwsbrief': {url:'https://ommen-push-v2.leeuw008.workers.dev/newsletter/feed', homepage:'https://nieuwommen.leeuw008.nl/', type:'nieuwsbrief'},
};

const BRON_PARSERS = {
  'De Stentor': parseDeStentor,
  'Gemeente Ommen': parseGemeenteOmmen,
  'Natuurlijk Ommen': parseNatuurlijkOmmen,
  'Ommen City': parseOmmenCity,
  'OudOmmen': parseOudOmmen,
  'RondOmmen': parseRondOmmen,
  'RTV Oost': parseRTVOost,
  'RTV Vechtdal': parseRTVVechtdal,
  'Vechtdal Centraal': parseVechtdalCentraal,
  'Nieuwsbrief': parseNieuwsbrief,
};


(function(){ try{ const v=localStorage.getItem('ommen_app_version'); if(v!=='400'){ console.log('[v400 CLEAN]'); localStorage.setItem('ommen_app_version','400'); } }catch(e){} })();
const WORKER = 'https://ommen-push-v2.leeuw008.workers.dev';
const CACHE_KEY = 'ommen_source_cache_v1';
const CACHE_TTL = 5*60*1000;
function getCachedSource(url){ try{ const raw=localStorage.getItem(CACHE_KEY); if(!raw) return null; const cache=JSON.parse(raw); const entry=cache[url]; if(entry && Date.now()-entry.time < CACHE_TTL) return entry.data; }catch{} return null; }
function setCachedSource(url, data){ try{ const raw=localStorage.getItem(CACHE_KEY); let cache={}; if(raw) cache=JSON.parse(raw); cache[url]={time:Date.now(), data:data}; localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); }catch{} }
async function fetchViaWorker(url){
  const cached=getCachedSource(url); if(cached) return cached;
  const proxyUrl = WORKER + '/proxy?url=' + encodeURIComponent(url);
  const r = await fetch(proxyUrl, {cache:'no-store'});
  if(!r.ok) throw new Error('proxy fail '+r.status);
  const text = await r.text();
  if(text.includes('Just a moment') || text.includes('cf-challenge')) throw new Error('cloudflare-challenge');
  setCachedSource(url, text); return text;
}
function getHighlightUrl(){ try{ const params = new URLSearchParams(window.location.search); let h = params.get('highlight') || params.get('echt'); if(h){ try{ h = decodeURIComponent(h); }catch{} return h; } }catch{} return null; }
function getEchtId(){ try{ const params = new URLSearchParams(window.location.search); return params.get('echt') || null; }catch{ return null; } }
function clearHighlight(){ try{ const url = new URL(window.location.href); url.searchParams.forEach((v,k)=>{ if(['highlight','article','url','link','echt'].includes(k)) url.searchParams.delete(k); }); window.history.replaceState({}, '', url.toString()); }catch{} renderArticles(); }
let allArticles=[]; let loadedSources=new Set();
async function loadOneSource(b){
  const cfg = BRON_URLS[b.id]; const parser = BRON_PARSERS[b.id];
  if(!parser) throw new Error('geen parser voor '+b.id);
  try{
    let rawData=null;
    try{ rawData = await fetchViaWorker(cfg.url); }
    catch(e){ if(cfg.fallback){ try{ rawData = await fetchViaWorker(cfg.fallback); }catch(e2){ throw e; } }else throw e; }
    let arts=[];
    if(b.id==='Gemeente Ommen'){ const isHtml = rawData.includes('<html') || rawData.includes('<div'); arts = parser(rawData, b.id, isHtml); if(arts.length===0){ try{ const htmlActueel = await fetchViaWorker('https://www.ommen.nl/actueel/'); arts = parser(htmlActueel, b.id, true); }catch{} } }
    else{ arts = parser(rawData, b.id); }
    if(arts.length===0) throw new Error('empty');
    return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false, pubDate:a.pubDate||new Date(), description:a.description||(a.title+' [...]')}));
  }catch(e){ console.log('load fail', b.id, e.message); return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - homepage [...]', source:b.name, id:b.id, isFallback:true}]; }
}
async function refreshNews(){
  const statusEl=document.getElementById('status'); allArticles=[]; loadedSources=new Set();
  const promises = BRONNEN.map(async b=>{ try{ const arts = await loadOneSource(b); allArticles = allArticles.filter(x=>x.id!==b.id).concat(arts); if(arts.length>0 && !arts[0].isFallback) loadedSources.add(b.id); updateSourceLeds(); renderArticles(); updateHeaderCount(); }catch(e){} });
  await Promise.allSettled(promises); renderArticles(); updateSourceLeds(); updateHeaderCount();
  if(statusEl) statusEl.textContent = allArticles.length+' artikelen - '+loadedSources.size+' v/d '+BRONNEN.length+' bronnen geladen';
}
function isSameDay(d1,d2){ if(!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return false; return d1.getDate()===d2.getDate() && d1.getMonth()===d2.getMonth() && d1.getFullYear()===d2.getFullYear(); }
function isToday(d){ return isSameDay(d, new Date()); }
let state={};
function loadState(){ try{ const raw=localStorage.getItem('nieuwsommen_bronnen_v2'); if(raw){ state=JSON.parse(raw); } }catch{} BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; }); }
function saveState(){ try{ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); }catch{} updateHeaderCount(); }
function updateHeaderCount(){ const el=document.getElementById('bron-count'); if(!el) return; const aan=Object.values(state).filter(s=>s.aan).length; el.textContent=aan+' v/d '+BRONNEN.length+' bronnen'; }
function renderFilters(){ const container=document.getElementById('bron-filters'); if(!container) return; container.innerHTML=''; BRONNEN.forEach(b=>{ const s=state[b.id]||{aan:true, vandaag:false, scope:'gemeente'}; const isLoaded=loadedSources.has(b.id); const count = allArticles.filter(a=>a.id===b.id && !a.isFallback).length; const total = allArticles.filter(a=>a.id===b.id).length; const div=document.createElement('div'); div.className='bron-filter'; div.innerHTML='<div class="bron-info"><span class="bron-led '+(isLoaded?'led-green':total>0?'led-orange':'led-red')+'"></span><div><strong>'+b.name+'</strong><small>'+b.sub+'</small></div><span class="bron-count">'+count+' / '+total+'</span></div><div class="bron-toggles"><label class="toggle"><input type="checkbox" '+(s.vandaag?'checked':'')+' onchange="state[\''+b.id+'\'].vandaag=this.checked; saveState(); filterNews();"><span>MEER</span></label><label class="toggle"><input type="checkbox" '+(s.scope==='regio'?'checked':'')+' onchange="state[\''+b.id+'\'].scope=this.checked?\'regio\':\'gemeente\'; saveState(); filterNews();"><span>GEMEENTE</span></label><label class="toggle toggle-aan"><input type="checkbox" '+(s.aan?'checked':'')+' onchange="state[\''+b.id+'\'].aan=this.checked; saveState(); filterNews();"><span>AAN</span></label></div>'; container.appendChild(div); }); }
function filterNews(){ renderArticles(); }
function renderArticles(){ const container=document.getElementById('news-container'); if(!container) return; let filtered=[...allArticles]; filtered=filtered.filter(a=>{ const s=state[a.id]; return s && s.aan; }); filtered=filtered.filter(a=>{ const s=state[a.id]; if(!s) return true; if(s.vandaag) return true; return isToday(a.pubDate) || a.isFallback; }); const searchInput=document.getElementById('search-input'); const q=(searchInput?.value||'').toLowerCase(); if(q){ filtered=filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(q)); } filtered.sort((a,b)=>{ return b.pubDate - a.pubDate; }); container.innerHTML=''; if(filtered.length===0){ container.innerHTML='<div class="no-results">Geen artikelen gevonden.</div>'; return; } filtered.forEach(a=>{ const div=document.createElement('div'); div.className='article'+(a.isFallback?' fallback':''); const dateStr = a.pubDate && a.pubDate.getTime()!==0 ? a.pubDate.toLocaleDateString('nl-NL',{day:'2-digit', month:'short'}) : ''; div.innerHTML='<div class="article-header"><span class="source-badge">'+a.source+'</span><span class="date">'+dateStr+'</span></div><h3><a href="'+a.link+'" target="_blank">'+a.title+'</a></h3><p>'+(a.description||'')+'</p>'; container.appendChild(div); }); const statusEl=document.getElementById('status'); if(statusEl) statusEl.textContent = filtered.length+' artikelen - '+loadedSources.size+' v/d '+BRONNEN.length+' bronnen'; }
function updateSourceLeds(){ renderFilters(); }
function closePanel(){ const p=document.getElementById('filter-panel'); if(p) p.classList.remove('open'); }
function resetFilters(){ BRONNEN.forEach(b=>{ state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; }); saveState(); renderFilters(); filterNews(); }
document.addEventListener('DOMContentLoaded', ()=>{ loadState(); renderFilters(); saveState(); document.getElementById('search-input')?.addEventListener('input', filterNews); setTimeout(()=>refreshNews(), 200); });
window.clearHighlight=clearHighlight; window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.filterNews=filterNews; window.refreshNews=refreshNews;
