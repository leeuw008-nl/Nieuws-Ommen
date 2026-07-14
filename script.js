const PROXY = 'https://corsproxy.io/?';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
    { name: 'RTV Oost',   url: 'http://rss.rtvoost.nl/' }
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        console.log("Ophalen:", url);
        const res = await fetch(PROXY + encodeURIComponent(url));
        const text = await res.text();

        const xml = new DOMParser().parseFromString(text, "text/xml");
        if (xml.querySelector("parsererror")) return [];

        return Array.from(xml.querySelectorAll("item, entry"))
            .slice(0, 8)
            .map(item => ({
                title: item.querySelector("title")?.textContent.trim() || "Geen titel",
                link: item.querySelector("link")?.textContent?.trim() || 
                      item.querySelector("link")?.getAttribute("href") || "#",
                description: (item.querySelector("description, summary, content")?.textContent || "")
                    .replace(/<[^>]+>/g,"").trim(),
                pubDate: item.querySelector("pubDate")?.textContent ||
                         item.querySelector("dc\\:date")?.textContent || ""
            }));
    } catch(e) {
        console.error("Fout bij", url, e);
        return [];
    }
}

// Zeer milde filter
function isRelevantToOmmen(article) {
    const text = (article.title + " " + (article.description || "")).toLowerCase();
    return text.includes("ommen") || text.includes("laarbos");
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden...</p>";

    const promises = feeds.map(feed => fetchRSS(feed.url).then(arts => 
        arts.map(a => ({...a, source: feed.name}))
    ));

    const results = await Promise.all(promises);
    let raw = results.flat();

    console.log("Totaal opgehaald:", raw.length);

    allArticles = raw.filter(article => {
        const ok = isRelevantToOmmen(article);
        if (!ok) console.log("Gefilterd:", article.title);
        return ok;
    });

    console.log("Na filter over:", allArticles.length);
    console.log("Bronnen:", [...new Set(allArticles.map(a => a.source))]);

    allArticles.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    renderArticles(allArticles);
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");
    if (articles.length === 0) {
        container.innerHTML = "<p>Geen artikelen gevonden.</p>";
        return;
    }

    container.innerHTML = articles.map(a => `
        <div class="article">
            <h2><a href="\( {a.link}" target="_blank"> \){a.title}</a></h2>
            <small>${a.source} — ${a.pubDate ? new Date(a.pubDate).toLocaleDateString('nl-NL') : ''}</small>
            <p>${a.description}</p>
        </div>
    `).join('');
}

function searchNews(query) {
    if (!query) return renderArticles(allArticles);
    const q = query.toLowerCase();
    renderArticles(allArticles.filter(a => 
        a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    ));
}

function refreshNews() { loadNews(); }

window.addEventListener("DOMContentLoaded", loadNews);
