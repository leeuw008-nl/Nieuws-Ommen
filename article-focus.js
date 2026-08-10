// article-focus.js v2 - omlijnd artikel in app + respect voor bronvoorkeur en regio/gemeente
(function(){
  const HIGHLIGHT_CLASS = 'focused-article';
  let focusedLink = null;

  function getState(){
    try { return JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); } catch { return {}; }
  }
  function saveState(s){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(s)); }

  function ensureSourceEnabled(sourceId){
    if(!sourceId) return;
    const state = getState();
    if(!state[sourceId]) state[sourceId] = {aan:true, vandaag:false, scope:'gemeente'};
    // Respecteer bestaande voorkeur, maar als bron UIT staat, zet hem AAN voor deze focus
    // (anders zie je niks) - en onthoud dat we hem tijdelijk aanzetten
    let wasOff = !state[sourceId].aan;
    if(wasOff){
      state[sourceId].aan = true;
      saveState(state);
      // trigger UI update als app.js geladen is
      if(window.BRONNEN && window.getAppState){
        const appState = window.getAppState();
        if(appState[sourceId]) appState[sourceId].aan = true;
      }
      if(typeof window.filterNews === 'function') window.filterNews();
      if(typeof window.renderFilters === 'function') window.renderFilters();
    }
    return wasOff;
  }

  function applyFocusStyles(){
    document.querySelectorAll('.article').forEach(el=>el.classList.remove(HIGHLIGHT_CLASS));
    document.querySelectorAll('.article').forEach(el=>{
      const linkEl = el.querySelector('h2 a');
      if(!linkEl) return;
      if(linkEl.href === focusedLink || decodeURIComponent(linkEl.href) === decodeURIComponent(focusedLink) || linkEl.href.includes(focusedLink) || focusedLink.includes(linkEl.href)){
        el.classList.add(HIGHLIGHT_CLASS);
        el.scrollIntoView({behavior:'smooth', block:'center'});
        // Omlijning via inline style als CSS nog niet geladen
        el.style.outline = '3px solid #0b5bd3';
        el.style.outlineOffset = '2px';
        el.style.boxShadow = '0 0 0 4px rgba(11,91,211,0.15)';
        setTimeout(()=>{
          el.style.outline = '';
          el.style.outlineOffset = '';
          el.style.boxShadow = '';
          el.classList.remove(HIGHLIGHT_CLASS);
        }, 6000);
      }
    });
  }

  function checkFocusParam(){
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    const src = params.get('src');
    if(!focus) return;
    
    focusedLink = decodeURIComponent(focus);
    // Respecteer bronvoorkeur + regio/gemeente: als bron uit stond, zet aan
    // regio/gemeente laten we staan zoals ingesteld - filterNews houdt er al rekening mee
    if(src) ensureSourceEnabled(src);
    else {
      // Probeer source te raden uit URL
      const articles = window.getAllArticles ? window.getAllArticles() : [];
      const found = articles.find(a=>a.link===focusedLink);
      if(found) ensureSourceEnabled(found.id);
    }

    // Wacht tot artikelen geladen zijn
    let tries = 0;
    const interval = setInterval(()=>{
      tries++;
      const hasArticles = document.querySelectorAll('.article').length > 0;
      if(hasArticles || tries > 50){
        clearInterval(interval);
        applyFocusStyles();
        // Clean URL zonder reload
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }, 300);
  }

  // Draai bij laden
  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(checkFocusParam, 500);
    // Ook na refreshNews
    const origRefresh = window.refreshNews;
    if(origRefresh){
      window.refreshNews = function(){
        const r = origRefresh.apply(this, arguments);
        setTimeout(checkFocusParam, 1500);
        return r;
      };
    }
  });

  // Luister naar navigation events (als SW navigate doet)
  window.addEventListener('focus', ()=> setTimeout(checkFocusParam, 300));
})();
