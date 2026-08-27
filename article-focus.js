// article-focus.js v5 - DEFINITIEF: push click -> alleen artikel omlijnd + button terug - FIX test link
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
    document.getElementById('btn-show-all').onclick = () => { exitFocusMode(); };
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
    try{ const cleanUrl = window.location.pathname; window.history.replaceState({}, '', cleanUrl); }catch{}
    focusedLink = null; focusedSource = null; focusedId = null;
  }

  function applyFocusMode(){
    if(!focusedLink) return false;
    const articles = document.querySelectorAll('.article');
    if(articles.length === 0) return false;

    const normFocus = decodeURIComponent(focusedLink).toLowerCase().trim();
    const normFocusNoProto = normFocus.replace(/^https?:\/\//,'');

    let focusPath = ''; let focusHost = '';
    try{ const u = new URL(focusedLink); focusPath = u.pathname.toLowerCase(); focusHost = u.hostname.toLowerCase(); }catch{}

    let found = false; let matchedEl = null;

    articles.forEach(el=>{
      const linkEl = el.querySelector('h2 a');
      if(!linkEl){ el.style.display='none'; return; }
      const href = linkEl.href;
      const normHref = href.toLowerCase().trim();
      let hrefPath=''; let hrefHost='';
      try{ const uh=new URL(href); hrefPath=uh.pathname.toLowerCase(); hrefHost=uh.hostname.toLowerCase(); }catch{}

      let isMatch = false;
      if(href === focusedLink || normHref === normFocus) isMatch = true;
      if(!isMatch && focusedId){
        const normId = decodeURIComponent(focusedId).toLowerCase();
        if(normId.length>10 && (normHref.includes(normId) || normId.includes(normHref))) isMatch = true;
      }
      if(!isMatch && focusPath && hrefPath && focusHost===hrefHost && focusPath===hrefPath) isMatch = true;
      if(!isMatch && focusPath && hrefPath && focusHost===hrefHost && focusPath.length>15 && hrefPath.length>10){
        if(hrefPath.includes(focusPath) || focusPath.includes(hrefPath)) isMatch = true;
      }

      if(isMatch){
        el.style.display=''; el.classList.add(HIGHLIGHT_CLASS);
        el.style.outline='3px solid #0b5bd3'; el.style.outlineOffset='4px';
        el.style.boxShadow='0 0 0 8px rgba(11,91,211,0.12), 0 12px 32px rgba(11,91,211,0.25)';
        el.style.borderRadius='12px';
        if(!matchedEl) matchedEl=el;
        found=true;
      }else{
        el.style.display='none';
      }
    });

    // Fallback: match by source if no exact link match
    if(!found && focusedSource){
      let sourceMatches=[];
      articles.forEach(el=>{
        const small = el.querySelector('small');
        if(small && small.textContent.toLowerCase().includes(focusedSource.toLowerCase())){
          sourceMatches.push(el);
        }
      });
      if(sourceMatches.length>0){
        sourceMatches.forEach((el,idx)=>{
          if(idx===0){
            el.style.display=''; el.classList.add(HIGHLIGHT_CLASS);
            el.style.outline='3px solid #0b5bd3'; el.style.outlineOffset='4px';
            el.style.boxShadow='0 0 0 8px rgba(11,91,211,0.12), 0 12px 32px rgba(11,91,211,0.25)';
            el.style.borderRadius='12px';
            matchedEl=el;
          }else el.style.display='none';
        });
        found=true;
        console.log('[focus v5] Fallback bron match', focusedSource);
      }
    }

    // Ultimate fallback: overview link -> show first article + banner met externe link
    if(!found){
      articles.forEach(el=>{ el.style.display=''; el.classList.remove(HIGHLIGHT_CLASS); el.style.outline=''; el.style.boxShadow=''; });
      const container=document.getElementById('news-container');
      if(container){
        const old=document.getElementById('focus-banner'); if(old) old.remove();
        const banner=document.createElement('div');
        banner.id='focus-banner';
        banner.style.cssText='background:#fef3c7;border:2px solid #f59e0b;border-radius:12px;padding:12px 16px;margin:0 0 16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
        banner.innerHTML=`
          <div style="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:#92400e;flex:1;min-width:200px;">
            <span style="background:#f59e0b;color:white;border-radius:50%;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;">⚠️</span>
            <span>Push link niet in lijst – <a href="${focusedLink}" target="_blank" style="color:#0b5bd3;text-decoration:underline;">open externe link</a></span>
          </div>
          <button id="btn-show-all" style="background:#0b5bd3;color:white;border:0;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;">Toon alle artikelen →</button>
        `;
        container.insertAdjacentElement('afterbegin', banner);
        document.getElementById('btn-show-all').onclick=()=>{ banner.remove(); };
      }
      console.log('[focus v5] Geen match voor', focusedLink);
      return false;
    }

    if(found && matchedEl){
      isFocusMode=true;
      originalCount=articles.length;
      const total=window.allArticles?window.allArticles.length:originalCount;
      createFocusBanner(total);
      setTimeout(()=>{ matchedEl.scrollIntoView({behavior:'smooth', block:'center'}); }, 300);
      return true;
    }
    return false;
  }

  function checkFocusParam(){
    const params=new URLSearchParams(window.location.search);
    const focus=params.get('focus');
    const highlight=params.get('highlight');
    const src=params.get('src');
    const id=params.get('id');
    let targetLink=focus?decodeURIComponent(focus):null;
    if(!targetLink && highlight) targetLink=decodeURIComponent(highlight);
    if(!targetLink) return;
    focusedLink=targetLink;
    focusedSource=src?decodeURIComponent(src):null;
    focusedId=id?decodeURIComponent(id):(highlight?decodeURIComponent(highlight):null);
    if(focusedSource) ensureSourceEnabled(focusedSource);
    let tries=0;
    const interval=setInterval(()=>{
      tries++;
      const hasArticles=document.querySelectorAll('.article').length>0;
      const allLoaded=typeof window.allArticles!=='undefined' && window.allArticles && window.allArticles.length>0;
      if((hasArticles && allLoaded) || tries>80){
        clearInterval(interval);
        const success=applyFocusMode();
        if(!success && tries<80) setTimeout(()=>applyFocusMode(), 800);
      }
    }, 300);
  }

  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      if(event.data && event.data.type==='NOTIFICATION_CLICK'){
        const link=event.data.link || event.data.url || event.data.focusUrl;
        const src=event.data.source;
        const id=event.data.id;
        if(link){
          focusedLink=link; focusedSource=src; focusedId=id;
          if(src) ensureSourceEnabled(src);
          try{ const newUrl=`/?focus=${encodeURIComponent(link)}&src=${encodeURIComponent(src||'')}&id=${encodeURIComponent(id||'')}`; window.history.replaceState({}, '', newUrl); }catch{}
          setTimeout(()=>checkFocusParam(), 400);
        }
      }
    });
  }

  window.exitFocusMode=exitFocusMode;
  window.showOnlyFocusedArticle=applyFocusMode;
  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(checkFocusParam, 600); });
  window.addEventListener('load', ()=>{ setTimeout(checkFocusParam, 1200); });
})();
