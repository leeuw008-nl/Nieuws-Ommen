const PROXY = 'https://api.allorigins.win/raw?url=';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
    { name: 'RTV Oost', url: 'http://rss.rtvoost.nl/' }
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        const text = await res.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");
        return Array.from(xml.querySelectorAll("item")).slice(0, 8).map(item => ({
            title: item.querySelector("title")?.textContent?.trim() || "Geen titel",
            link: item.querySelector("link")?.textContent?.trim() || "#",
            description: (item.querySelector("description")?.textContent || "").replace(/<[^>]+>/g, "").trim(),
            pubDate: item.querySelector("pubDate")?.textContent || ""
        }));
    } catch(e) { return []; }
}

async function loadNews() {
    document.getElementById("news-container").innerHTML = "<p>Laden van nieuws uit Ommen...</p>";
    allArticles = [];
    for (let feed of feeds) {
        const arts = await fetchRSS(feed.url);
        allArticles = allArticles.concat(arts.map(a => ({...a, source: feed.name})));
    }
    renderArticles(allArticles);
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");
    container.innerHTML = articles.map(article => `
        <div class="article">
            <h2><a href="${article.link}" target="_blank">${article.title}</a></h2>
            <small>${article.source} — ${article.pubDate ? new Date(article.pubDate).toLocaleDateString('nl-NL') : ''}</small>
            <p>${article.description.substring(0, 180)}...</p>
        </div>
    `).join('');
}

function searchNews(query) {
    if (!query) return renderArticles(allArticles);
    const q = query.toLowerCase();
    const filtered = allArticles.filter(a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    renderArticles(filtered);
}

function refreshNews() { loadNews(); }

window.onload = loadNews;