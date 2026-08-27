// article-focus.js v4 - DEFINITIEF FIX: push click -> alleen artikel omlijnd + button terug
(function(){
  const HIGHLIGHT_CLASS = 'focused-article';
  let focusedLink = null;
  let focusedSource = null;
  let focusedId = null;
  let isFocusMode = false;
  let originalCount = 0;

  function getState(){
    try { return JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); } catch { return {}; }
  }
  function saveState(s){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(s)); }

  function ensureSourceEnabled(sourceId){
    if(!sourceId) return false;
    const state = getState();
    if(!state[sourceId]) state[sourceId] = {aan:true, vandaag:false, scope:'gemeente'};
    let wasOff = !state[sourceId].aan;
    if(wasOff){
      state[sourceId].aan = true;
      saveState(state);
      if(window.BRONNEN && window.getAppState){
        const appState = window.getAppState();
        if(appState[sourceId]) appState[sourceId].aan = true;
      }
      if(typeof window.filterNews === 'function') window.filterNews();
      if(typeof window.renderFilters === 'function') setTimeout(()=>window.renderFilters(), 100);
    }
    return wasOff;
  }

  function createFocusBanner(count){
    const old = document.getElementById('focus-banner');
    if(old) old.remove();

    const container = document.getElementById('news-container');
    if(!container) return;

    const banner = document.createElement('div');
    banner.id = 'focus-banner';
    banner.style.cssText = 'background:#eff6ff;border:2px solid #0b5bd3;border-radius:12px;padding:12px 16px;margin:0 0 16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;animation:fadeIn .3s ease;';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:#1e40af;flex:1;min-width:200px;">
        <span style="background:#0b5bd3;color:white;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">📍</span>
        <span>Artikel via pushmelding – alleen dit artikel wordt getoond</span>
      </div>
      <button id="btn-show-all" style="background:#0b5bd3;color:white;border:0;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 2px 6px rgba(11,91,211,.3);">
        Toon alle ${count || ''} artikelen →
      </button>
    `;
    container.insertAdjacentElement('afterbegin', banner);

    document.getElementById('btn-show-all').onclick = () => {
      exitFocusMode();
    };
  }

  function exitFocusMode(){
    isFocusMode = false;
    const banner = document.getElementById('focus-banner');
    if(banner) banner.remove();
    
    document.querySelectorAll('.article').forEach(el=>{
      el.style.display = '';
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.boxShadow = '';
      el.classList.remove(HIGHLIGHT_CLASS);
    });
    
    if(typeof window.filterNews === 'function') window.filterNews();
    
    try{
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }catch{}

    focusedLink = null;
    focusedSource = null;
    focusedId = null;
  }

  function applyFocusMode(){
    if(!focusedLink) return false;

    const articles = document.querySelectorAll('.article');
    if(articles.length === 0) return false;

    let found = false;
    let matchedEl = null;

    // Normalize focusedLink for matching
    const normFocus = decodeURIComponent(focusedLink).toLowerCase().trim();
    const normFocusNoProto = normFocus.replace(/^https?:\/\//,'');

    articles.forEach(el=>{
      const linkEl = el.querySelector('h2 a');
      if(!linkEl) {
        el.style.display = 'none';
        return;
      }
      const href = linkEl.href;
      const normHref = href.toLowerCase().trim();
      const normHrefNoProto = normHref.replace(/^https?:\/\//,'');

      // Extensive matching: exact, includes, ID match, source match
      const isMatch = (
        href === focusedLink ||
        normHref === normFocus ||
        normHref.includes(normFocus) ||
        normFocus.includes(normHref) ||
        normHrefNoProto === normFocusNoProto ||
        normHrefNoProto.includes(normFocusNoProto) ||
        normFocusNoProto.includes(normHrefNoProto) ||
        (focusedId && (href.includes(focusedId) || focusedId.includes(href) || normHref.includes(focusedId.toLowerCase()))) ||
        (focusedSource && el.textContent && focusedSource && linkEl.href.includes(focusedSource.toLowerCase())) === false // placeholder
      );

      // Extra: check if link contains same path
      let pathMatch = false;
      try{
        const u1 = new URL(href);
        const u2 = new URL(focusedLink);
        if(u1.pathname === u2.pathname && u1.hostname === u2.hostname) pathMatch = true;
        if(u1.pathname && u2.pathname && u1.pathname.length>10 && u2.pathname.includes(u1.pathname)) pathMatch = true;
        if(u1.pathname && u2.pathname && u2.pathname.length>10 && u1.pathname.includes(u2.pathname)) pathMatch = true;
      }catch{}

      if(isMatch || pathMatch){
        el.style.display = '';
        el.classList.add(HIGHLIGHT_CLASS);
        el.style.outline = '3px solid #0b5bd3';
        el.style.outlineOffset = '4px';
        el.style.boxShadow = '0 0 0 8px rgba(11,91,211,0.12), 0 12px 32px rgba(11,91,211,0.25)';
        el.style.borderRadius = '12px';
        matchedEl = el;
        found = true;
      } else {
        el.style.display = 'none';
      }
    });

    if(found && matchedEl){
      isFocusMode = true;
      originalCount = articles.length;
      
      const total = window.allArticles ? window.allArticles.length : originalCount;
      createFocusBanner(total);

      setTimeout(()=>{
        matchedEl.scrollIntoView({behavior:'smooth', block:'center'});
      }, 300);

      return true;
    } else {
      // Niet gevonden - probeer bron aan te zetten en opnieuw
      if(focusedSource) {
        const wasOff = ensureSourceEnabled(focusedSource);
        if(wasOff){
          setTimeout(()=>applyFocusMode(), 1000);
          return false;
        }
      }
      // Als echt niet gevonden, toon toch alles maar met melding
      console.log('[focus v4] Artikel niet gevonden voor', focusedLink);
      return false;
    }
  }

  function checkFocusParam(){
    const params = new URLSearchParams(window.location.search);
    const focus = params.get('focus');
    const highlight = params.get('highlight');
    const src = params.get('src');
    const id = params.get('id');

    let targetLink = focus ? decodeURIComponent(focus) : null;
    if(!targetLink && highlight){
      targetLink = decodeURIComponent(highlight);
    }

    if(!targetLink) return;

    focusedLink = targetLink;
    focusedSource = src ? decodeURIComponent(src) : null;
    focusedId = id ? decodeURIComponent(id) : (highlight ? decodeURIComponent(highlight) : null);

    if(focusedSource) ensureSourceEnabled(focusedSource);

    let tries = 0;
    const interval = setInterval(()=>{
      tries++;
      const hasArticles = document.querySelectorAll('.article').length > 0;
      const allLoaded = typeof window.allArticles !== 'undefined' && window.allArticles && window.allArticles.length > 0;
      
      if((hasArticles && allLoaded) || tries > 80){
        clearInterval(interval);
        const success = applyFocusMode();
        if(!success && tries < 80){
          setTimeout(()=>applyFocusMode(), 800);
        }
      }
    }, 300);
  }

  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      if(event.data && event.data.type === 'NOTIFICATION_CLICK'){
        const link = event.data.link || event.data.url || event.data.focusUrl;
        const src = event.data.source;
        const id = event.data.id;
        if(link){
          focusedLink = link;
          focusedSource = src;
          focusedId = id;
          if(src) ensureSourceEnabled(src);
          try{
            const newUrl = `/?focus=${encodeURIComponent(link)}&src=${encodeURIComponent(src||'')}&id=${encodeURIComponent(id||'')}`;
            window.history.replaceState({}, '', newUrl);
          }catch{}
          setTimeout(()=>checkFocusParam(), 400);
        }
      }
    });
  }

  window.exitFocusMode = exitFocusMode;
  window.showOnlyFocusedArticle = applyFocusMode;

  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(checkFocusParam, 600);
  });

  window.addEventListener('load', ()=>{
    setTimeout(checkFocusParam, 1200);
  });
})();
