const PROXY = 'https://api.allorigins.win/raw?url=';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        console.log("Ophalen:", url);

        const res = await fetch(PROXY + encodeURIComponent(url));
        const text = await res.text();

        console.log(text.substring(0,200));

        const xml = new DOMParser().parseFromString(text, "text/xml");

        return Array.from(xml.querySelectorAll("item"))
            .slice(0,5)
            .map(item => ({
                title: item.querySelector("title")?.textContent.trim() || "Geen titel",
                link: item.querySelector("link")?.textContent.trim() || "#",
                description: (item.querySelector("description")?.textContent || "")
                    .replace(/<[^>]+>/g,"")
                    .trim(),
                pubDate:
    item.querySelector("pubDate")?.textContent ||
    item.querySelector("dc\\:date")?.textContent ||
    item.querySelector("updated")?.textContent ||
    ""
            }));

    } catch(e) {
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

        try {
            const arts = await fetchRSS(feed.url);

            return arts.map(a => ({
                ...a,
                source: feed.name
            }));

        } catch (e) {
            console.error(feed.name, e);
            return [];
        }

    });

    const results = await Promise.all(promises);

    allArticles = results.flat();

    console.log("Aantal artikelen:", allArticles.length);

    allArticles.sort((a, b) => {
        return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
    });

    renderArticles(allArticles);
}

function renderArticles(articles) {

    const container = document.getElementById("news-container");

    if (articles.length === 0) {
        container.innerHTML = "<p>Geen nieuws gevonden.</p>";
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
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );

    renderArticles(filtered);
}


function refreshNews() {
    loadNews();
}


window.addEventListener("DOMContentLoaded", loadNews);
