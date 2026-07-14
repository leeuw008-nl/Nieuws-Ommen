const PROXY = 'https://corsproxy.io/?';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
    { name: 'RTV Oost',   url: 'http://rss.rtvoost.nl/' }
];

let allArticles = [];
let showAllMode = false;

async function fetchRSS(url) {
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        const text = await res.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");

        if (xml.querySelector("parsererror")) return [];

        return Array.from(xml.querySelectorAll("item, entry"))
            .slice(0, 8)
            .map(item => {
                // Betere link extractie
                let link = "#";
                const linkEl = item.querySelector("link");
                if (linkEl) {
                    link = (linkEl.getAttribute("href") || linkEl.textContent || "").trim();
                }
                // Verwijder eventuele backslashes
                link = link.replace(/\\/g, '');

                return {
                    title: item.querySelector("title")?.textContent.trim() || "Geen titel",
                    link: link,
                    description: (item.querySelector("description, summary, content")?.textContent || "")
                        .replace(/<[^>]+>/g, "").trim(),
                    pubDate: item.querySelector("pubDate")?.textContent || ""
                };
            });
    } catch(e) {
        console.error("Fout bij", url);
        return [];
    }
}

function isRelevantToOmmen(article) {
    if (showAllMode) return true;
    const text = (article.title + " " + article.description).toLowerCase();
    return text.includes("ommen") || text.includes("laarbos");
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden...</p>";

    const promises = feeds.map(feed => 
        fetchRSS(feed.url).then(arts => arts.map(a => ({...a, source: feed.name})))
    );

    const results = await Promise.all(promises);
    let raw = results.flat();

    console.log("Totaal opgehaald:", raw.length);

    allArticles = raw.filter(isRelevantToOmmen);

    console.log("Na filter:", allArticles.length);
    console.log("Bronnen:", [...new Set(allArticles.map(a => a.source))]);

    allArticles.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    renderArticles(allArticles);
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");
    container.innerHTML = articles.length ? articles.map(article => `
        <div class="article">
            <h2>
                <a href="${article.link}" target="_blank" rel="noopener">
                    ${article.title}
                </a>
            </h2>
            <small>${article.source} — ${article.pubDate ? new Date(article.pubDate).toLocaleDateString('nl-NL') : ""}</small>
            <p>${article.description}</p>
        </div>
    `).join('') : "<p>Geen artikelen gevonden.</p>";
}

// Debug knop
function addDebugButton() {
    const btn = document.createElement("button");
    btn.textContent = "Toon ALLE artikelen (debug)";
    btn.style.margin = "10px 0";
    btn.onclick = () => {
        showAllMode = !showAllMode;
        btn.textContent = showAllMode ? "Terug naar Ommen-filter" : "Toon ALLE artikelen (debug)";
        loadNews();
    };
    document.body.insertBefore(btn, document.getElementById("news-container"));
}

window.addEventListener("DOMContentLoaded", () => {
    addDebugButton();
    loadNews();
});
