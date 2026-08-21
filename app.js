/* app.js v231.1 - filter-only sync fix (PROXY FIX)
 * GARANTIE: feeds en scrapers 100% ongewijzigd - alleen proxy URL gefixt!
 * FIX:
 * - WORKER constant toegevoegd
 * - fetchViaWorker gebruikt nu ${WORKER}/proxy?url= i.p.v. /proxy/rss/feed
 * - getCloudData -> ${WORKER}/check?filters=1 (was /check?filters=1 -> 404)
 * - saveToCloud -> ${WORKER}/check POST (was /check -> 404)
 * - enrichGemeente parallel via Promise.all (was al in v231)
 * - loadFromCloud alleen filters, artikelen via background refresh
 * - btn-sync-now alleen saveToCloud
 * ONGEWIJZIGD: RSS_SOURCES, parseRSS, enrichGemeente scraper logica (og:image), renderArticles
 */
const APP_VERSION = 'v231.1-proxy-fix';
const WORKER = 'https://ommen-push-v2.leeuw008.workers.dev';
const RSS_SOURCES = {
  gemeente: 'https://www.ommen.nl/rss',
  destentor: 'https://www.destentor.nl/ommen/rss.xml',
  vechtdal: 'https://www.vechtdalcentraal.nl/rss'
};

let selectedSources = JSON.parse(localStorage.getItem('ommen_sources') || '["gemeente","destentor","vechtdal"]');
let articlesCache = [];

// FIXED: fetchViaWorker met WORKER + timeout 4s
async function fetchViaWorker(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 4000);
  try {
    const proxyUrl = `${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`;
    const res = await fetch(proxyUrl, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('proxy ' + res.status);
    return res;
  } catch (e) {
    console.warn('[v231.1] fetchViaWorker fail', url, e.message);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Parallel verrijken - veel sneller
async function enrichGemeente(articles) {
  const gemeenteItems = articles.filter(a => 
    a.source && a.source.toLowerCase().includes('gemeente')
  );
  
  await Promise.all(gemeenteItems.map(async (item) => {
    try {
      const res = await fetchViaWorker(item.link);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const ogImg = doc.querySelector('meta[property="og:image"]')?.content;
      if (ogImg) item.image = ogImg;
      item.enriched = true;
    } catch {}
  }));
  
  return articles;
}

async function loadArticlesLocal() {
  const urls = selectedSources.map(s => RSS_SOURCES[s]).filter(Boolean);
  const results = await Promise.allSettled(urls.map(u => fetchViaWorker(u).then(r => r.text())));
  const allArticles = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const items = parseRSS(r.value);
      allArticles.push(...items);
    }
  }
  const enriched = await enrichGemeente(allArticles);
  articlesCache = enriched.sort((a,b) => b.date - a.date);
  renderArticles(articlesCache);
}

// Filter-only sync: alleen filters uit cloud, daarna lokale refresh
async function loadFromCloud() {
  try {
    const cloud = await getCloudData();
    if (cloud && cloud.selectedSources && cloud.selectedSources.length) {
      setSelectedSources(cloud.selectedSources);
      applyFilters(cloud.selectedSources);
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SET_FILTERS',
          sources: cloud.selectedSources
        });
      }
    }
    setTimeout(() => {
      loadArticlesLocal();
    }, 0);
  } catch (e) {
    console.warn('[v231.1] loadFromCloud fallback lokaal', e);
    loadArticlesLocal();
  }
}

// Sync knop = alleen uploaden
document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-sync-now');
  const old = btn.textContent;
  btn.textContent = 'Opslaan...';
  try {
    await saveToCloud({
      selectedSources: getCurrentFilters()
    });
    showToast('Filters opgeslagen in cloud');
  } finally {
    btn.textContent = old;
  }
});

function getCurrentFilters() { return selectedSources; }
function setSelectedSources(s) { selectedSources = s; localStorage.setItem('ommen_sources', JSON.stringify(s)); }
function applyFilters(sources) { selectedSources = sources; renderFilterUI(); }
function renderFilterUI() { /* update checkboxes */ }
function parseRSS(xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('item')].map(item => ({
    title: item.querySelector('title')?.textContent || '',
    link: item.querySelector('link')?.textContent || '',
    date: new Date(item.querySelector('pubDate')?.textContent || Date.now()),
    source: 'rss',
    id: item.querySelector('guid')?.textContent || Math.random().toString(36)
  }));
}
function renderArticles(list) {
  const c = document.getElementById('articles');
  if (!c) return;
  c.innerHTML = list.map(a => `<article><h3>${a.title}</h3><a href="${a.link}" target="_blank">Lees</a></article>`).join('');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2500);
}

// FIXED: absolute WORKER URLs
async function getCloudData() {
  const r = await fetch(`${WORKER}/check?filters=1`, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}
async function saveToCloud(payload) {
  await fetch(`${WORKER}/check`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
}

// init
document.addEventListener('DOMContentLoaded', () => {
  loadFromCloud();
});
