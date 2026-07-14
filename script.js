const PROXY = 'https://corsproxy.io/?';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        console.log("Start ophalen:", url);
        
        const res = await fetch(PROXY + encodeURIComponent(url));
        if (!res.ok) throw new Error("Netwerk fout");

        const text = await res.text();
        console.log(url, "→ gelukt, lengte:", text.length);

        const xml = new DOMParser().parseFromString(text, "text/xml");
        if (xml.querySelector("parsererror")) throw new Error("XML fout");

        const items = Array.from(xml.querySelectorAll("item")).slice(0, 6);

        return items.map(item => ({
            title: item.querySelector("title")?.textContent.trim() || "Geen titel",
            link: (item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent || "").replace(/\\/g, ''),
            description: (item.querySelector("description")?.textContent || "").replace(/<[^>]+>/g, "").trim(),
            pubDate: item.querySelector("pubDate")?.textContent || "",
            source: ""
        }));
    } catch (e) {
        console.error("Fout bij", url, e.message);
        return [];
    }
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden van nieuws...</p>";

    try {
        const results = await Promise.all(feeds.map(feed => 
            fetchRSS(feed.url).then(arts => arts.map(a => ({...a, source: feed.name})))
        ));

        let raw = results.flat();
        console.log("Totaal opgehaald:", raw.length);

        allArticles = raw.filter(a => {
            const txt = (a.title + " " + a.description).toLowerCase();
            return txt.includes("ommen") || txt.includes("laarbos");
        });

        console.log("Na filter:", allArticles.length);

        allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        renderArticles(allArticles);
    } catch (e) {
        console.error("LoadNews error:", e);
        container.innerHTML = `<p>Kon nieuws niet laden.<br><small>Probeer refresh (F5 of swipe down).</small></p>`;
    }
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");
    if (!articles.length) {
        container.innerHTML = "<p>Geen artikelen gevonden.</p>";
        return;
    }
    container.innerHTML = articles.map(a => `
        <div class="article">
            <h2><a href="\( {a.link}" target="_blank"> \){a.title}</a></h2>
            <small>${a.source}</small>
            <p>${a.description}</p>
        </div>
    `).join('');
}

function refreshNews() { loadNews(); }

window.addEventListener("DOMContentLoaded", () => {
    console.log("Script gestart");
    loadNews();
});
