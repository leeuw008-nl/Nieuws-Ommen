const PROXY = 'https://corsproxy.io/?';  // Betrouwbaarder alternatief voor AllOrigins

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        console.log("Ophalen:", url);
        
        const proxyUrl = PROXY + encodeURIComponent(url);
        const res = await fetch(proxyUrl, {
            headers: { 'Accept': 'application/xml, text/xml' }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        console.log("Response start:", text.substring(0, 300));

        // Check of het echt XML is (geen HTML-foutpagina)
        if (!text.includes('<rss') && !text.includes('<feed')) {
            console.warn("Geen geldige RSS:", text.substring(0, 200));
            return [];
        }

        const xml = new DOMParser().parseFromString(text, "text/xml");
        
        // Error check van parser
        const parserError = xml.querySelector("parsererror");
        if (parserError) {
            console.error("XML parse error:", parserError.textContent);
            return [];
        }

        return Array.from(xml.querySelectorAll("item, entry"))
            .slice(0, 6)  // iets meer per feed
            .map(item => {
                const titleEl = item.querySelector("title");
                const linkEl = item.querySelector("link");
                const descEl = item.querySelector("description, summary, content");
                const pubDateEl = item.querySelector("pubDate, dc\\:date, updated, published");

                let link = linkEl ? (linkEl.getAttribute("href") || linkEl.textContent.trim()) : "#";
                let description = descEl ? descEl.textContent.replace(/<[^>]+>/g, "").trim() : "";

                // Truncate lange descriptions
                if (description.length > 300) {
                    description = description.substring(0, 297) + "...";
                }

                return {
                    title: titleEl?.textContent.trim() || "Geen titel",
                    link: link,
                    description: description,
                    pubDate: pubDateEl?.textContent.trim() || "",
                    source: "" // later toegevoegd
                };
            });

    } catch (e) {
        console.error("RSS fout:", url, e);
        return [];
    }
}

async function loadNews() {
    console.log("loadNews gestart");
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden van nieuws uit Ommen...</p>";

    allArticles = [];

    const promises = feeds.map(async feed => {
        const arts = await fetchRSS(feed.url);
        return arts.map(a => ({ ...a, source: feed.name }));
    });

    const results = await Promise.all(promises);
    allArticles = results.flat().filter(a => a.title && a.link !== "#");

    console.log("Aantal artikelen:", allArticles.length);

    // Sorteer op datum (nieuwste eerst)
    allArticles.sort((a, b) => {
        const dateA = new Date(a.pubDate || 0);
        const dateB = new Date(b.pubDate || 0);
        return dateB - dateA;
    });

    renderArticles(allArticles);
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");

    if (articles.length === 0) {
        container.innerHTML = "<p>Geen nieuws gevonden. Probeer later opnieuw.</p>";
        return;
    }

    container.innerHTML = articles.map(article => `
        <div class="article">
            <h2>
                <a href="${article.link}" target="_blank" rel="noopener">
                    ${article.title}
                </a>
            </h2>
            <small>
                ${article.source}
                ${article.pubDate ? " — " + new Date(article.pubDate).toLocaleDateString('nl-NL', { year: 'numeric', month: 'long', day: 'numeric' }) : ""}
            </small>
            <p>${article.description}</p>
        </div>
    `).join('');
}

// Zoekfunctie en refresh blijven hetzelfde
function searchNews(query) {
    if (!query) {
        renderArticles(allArticles);
        return;
    }
    const q = query.toLowerCase();
    const filtered = allArticles.filter(a =>
        a.title.toLowerCase().includes(q) || 
        (a.description && a.description.toLowerCase().includes(q))
    );
    renderArticles(filtered);
}

function refreshNews() {
    loadNews();
}

window.addEventListener("DOMContentLoaded", loadNews);
