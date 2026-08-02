// article-focus.js - Toon alleen artikel waar notification naar verwijst
// Plak dit BESTAND als aparte file en include na script.js en push.js
// OF plak onderaan je bestaande script.js

(function(){
  function getParam(name){
    try{ return new URLSearchParams(window.location.search).get(name); }catch{ return null; }
  }

  function showOnlyArticle(targetUrl){
    if(!targetUrl) return false;
    const decoded = decodeURIComponent(targetUrl);
    const container = document.getElementById('news-container');
    if(!container) return false;
    
    // Wacht tot artikelen er zijn
    const articles = container.querySelectorAll('.article, article, .news-item, [data-link]');
    if(!articles.length){
      // allArticles global?
      if(typeof allArticles !== 'undefined' && allArticles.length){
        const found = allArticles.find(a => {
          const l = (a.link||a.url||'').toLowerCase();
          return l && (decoded.toLowerCase().includes(l) || l.includes(decoded.toLowerCase()) || l===decoded.toLowerCase());
        });
        if(found){
          // Render alleen dit artikel
          const src = found.source || found.bron || getParam('src') || 'Nieuws';
          container.innerHTML = `
            <div style="background:#e0f2fe;border:1px solid #0ea5e9;padding:10px 14px;border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
              <span>📬 Geopend via melding • <b>${src}</b></span>
              <button id="showAllBtn" style="background:#0b5bd3;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-weight:600;cursor:pointer">Toon alles</button>
            </div>
            <article class="article" style="border:2px solid #0b5bd3;box-shadow:0 4px 16px rgba(11,91,211,.15)">
              <div style="font-size:12px;color:#6b7280;margin-bottom:6px">${src} • ${found.publishedAt ? new Date(found.publishedAt).toLocaleString('nl-NL') : ''}</div>
              <h2><a href="${found.link||found.url}" target="_blank" rel="noopener">${found.title||'Nieuw artikel'}</a></h2>
              ${found.description ? `<p>${found.description}</p>` : ''}
              <p><a href="${found.link||found.url}" target="_blank" rel="noopener" style="display:inline-block;background:#0b5bd3;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;margin-top:8px">Lees volledig artikel →</a></p>
            </article>
          `;
          document.getElementById('showAllBtn').onclick = () => {
            history.replaceState({},'', window.location.pathname);
            location.reload();
          };
          return true;
        }
      }
      return false;
    }

    // Bestaande DOM filtering
    let foundEl = null;
    articles.forEach(div => {
      const a = div.querySelector('h2 a, h3 a, a');
      if(!a) return;
      const href = a.href || a.getAttribute('href') || '';
      if(href && (href===decoded || decoded.includes(href) || href.includes(decoded) || href.toLowerCase()===decoded.toLowerCase())){
        if(!foundEl) foundEl = div;
      } else {
        div.style.display = 'none';
      }
    });

    if(foundEl){
      // Voeg banner toe
      if(!document.getElementById('singleArticleBanner')){
        const banner = document.createElement('div');
        banner.id = 'singleArticleBanner';
        banner.innerHTML = `
          <div style="background:#e0f2fe;border:1px solid #0ea5e9;padding:10px 14px;border-radius:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;z-index:5">
            <span>📬 Geopend via melding${getParam('src')? ' • <b>'+getParam('src')+'</b>':''}</span>
            <button id="showAllBtn2" style="background:#0b5bd3;color:#fff;border:none;padding:6px 12px;border-radius:8px;font-weight:600;cursor:pointer">Toon alle nieuws</button>
          </div>
        `;
        container.prepend(banner);
        document.getElementById('showAllBtn2').onclick = () => {
          history.replaceState({},'', window.location.pathname);
          // Toon alles weer
          articles.forEach(d=>d.style.display='');
          banner.remove();
        };
      }
      foundEl.scrollIntoView({behavior:'smooth', block:'start'});
      foundEl.style.outline='3px solid #0b5bd3';
      foundEl.style.outlineOffset='3px';
      return true;
    } else {
      // Geen match: toon bericht maar laat wel alle nieuws zien? Nee, toon banner dat artikel niet in feed staat maar link wel werkt
      if(!document.getElementById('singleArticleBanner')){
        const banner = document.createElement('div');
        banner.id='singleArticleBanner';
        banner.innerHTML = `
          <div style="background:#fef3c7;border:1px solid #f59e0b;padding:12px 14px;border-radius:10px;margin-bottom:12px">
            <b>🔗 Artikel uit melding</b><br>
            Dit artikel staat niet (meer) bovenaan de lijst, maar je kunt het hier openen:<br>
            <a href="${decoded}" target="_blank" rel="noopener" style="display:inline-block;background:#0b5bd3;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;margin-top:8px">Open artikel: ${getParam('src')||'bron'} →</a>
            <button id="showAllBtn3" style="margin-left:8px;background:#e5e7eb;color:#111;border:none;padding:8px 12px;border-radius:8px;cursor:pointer">Toon alle nieuws</button>
          </div>
        `;
        container.prepend(banner);
        document.getElementById('showAllBtn3').onclick = () => {
          history.replaceState({},'', window.location.pathname);
          banner.remove();
        };
      }
      return true;
    }
  }

  function tryFocus(){
    const openUrl = getParam('open');
    if(!openUrl) return;
    let tries=0;
    const interval = setInterval(()=>{
      tries++;
      const ok = showOnlyArticle(openUrl);
      if(ok || tries>20){
        clearInterval(interval);
        if(ok){
          // URL opschonen na 2 sec? Nee, laat staan zodat refresh werkt, maar history replace na back
        }
      }
    }, 500);
  }

  // Start
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', tryFocus);
  } else {
    tryFocus();
  }
  // Ook na elke refreshNews
  const origRefresh = window.refreshNews;
  if(origRefresh){
    window.refreshNews = function(){
      const hadOpen = !!getParam('open');
      const result = origRefresh.apply(this, arguments);
      if(!hadOpen) return result;
      setTimeout(tryFocus, 1500);
      return result;
    };
  }
})();
