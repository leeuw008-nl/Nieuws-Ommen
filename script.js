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

        if (xml.querySelector("parsererror")) {
            console.error("XML parse error voor", url);
            return [];
        }

        return Array.from(xml.querySelectorAll("item, entry"))
            .slice(0, 8)
            .map(item => ({
                title: item.querySelector("title")?.textContent.trim() || "Geen titel",
                link: item.querySelector("link")?.textContent?.trim() || 
                      item.querySelector("link")?.getAttribute("href") || "#",
                description: (item.querySelector("description, summary, content")?.textContent || "")
                    .replace(/<[^>]+>/g,"")
                    .trim(),
                pubDate: item.querySelector("pubDate")?.textContent ||
                         item.querySelector("dc\\:date")?.textContent ||
                         item.querySelector("updated")?.textContent || ""
            }));

    } catch(e) {
        console.error("RSS fout:", url, e);
        return [];
    }
}

// Mildere filter voor Ommen
function isRelevantToOmmen(article) {
    const text = (article.title + " " + article.description).toLowerCase();
    
    return text.includes("ommen") || 
           text.includes("ommon") ||
           text.includes("laarbos") ||
           text.includes("markt ommen") ||
           text.includes("ommen ") ||        // extra ruimte om false positives te verminderen
           text.includes(" in ommen");
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
    let rawArticles = results.flat();

    console.log("Totaal opgehaald:", rawArticles.length);

    allArticles = rawArticles.filter(article => {
        const relevant = isRelevantToOmmen(article);
        if (!relevant) console.log("Gefilterd:", article.title);
        return relevant;
    });

    console.log("Artikelen na filter:", allArticles.length);

    allArticles.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    renderArticles(allArticles);
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");

    if (articles.length === 0) {
        container.innerHTML = "<p>Geen nieuws gevonden. Probeer opnieuw te laden.</p>";
        return;
    }

    container.innerHTML = articles.map(article => `
        <div class="article">
            <h2>
                <a href="${article.link}" target="_blank">
                    ${article.title}
                </a>
            </h2>
            <small>
                ${article.source}
                ${article.pubDate ? " — " + new Date(article.pubDate).toLocaleDateString('nl-NL') : ""}
            </small>
            <p>${article.description}</p>
        </div>
    `).join('');
}

function searchNews(query) {
    if (!query) {
        renderArticles(allArticles);
        return;
    }
    const q = query.toLowerCase();
    const filtered = allArticles.filter(a =>
        a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );
    renderArticles(filtered);
}

function refreshNews() {
    loadNews();
}

window.addEventListener("DOMContentLoaded", loadNews);
