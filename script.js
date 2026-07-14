const PROXY = 'https://corsproxy.io/?';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        if (!res.ok) throw new Error("Netwerkfout");

        const text = await res.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");

        if (xml.querySelector("parsererror")) return [];

        return Array.from(xml.querySelectorAll("item, entry"))
            .slice(0, 25)
            .map(item => {

                let link = "#";
                const linkEl = item.querySelector("link");
                if (linkEl) {
                    link = (linkEl.getAttribute("href") || linkEl.textContent || "").trim();
                }
                link = link.replace(/\\/g, '');

                const dateString =
                    item.querySelector("pubDate")?.textContent?.trim() ||
                    item.querySelector("published")?.textContent?.trim() ||
                    item.querySelector("updated")?.textContent?.trim() ||
                    "";

                const timestamp = Date.parse(dateString);

                return {
                    title: item.querySelector("title")?.textContent.trim() || "Geen titel",
                    link: link,
                    description: (
                        item.querySelector("description, summary, content")?.textContent || ""
                    ).replace(/<[^>]+>/g, "").trim(),
                    pubDate: dateString,
                    timestamp: isNaN(timestamp) ? 0 : timestamp
                };
            });

    } catch (e) {
        console.error("Fout bij ophalen:", url, e);
        return [];
    }
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden van nieuws uit Ommen...</p>";

    try {
        const promises = feeds.map(feed =>
            fetchRSS(feed.url).then(arts =>
                arts.map(a => ({ ...a, source: feed.name }))
            )
        );

        const results = await Promise.all(promises);

        allArticles = results.flat();

        // Dubbele links verwijderen
        const seen = new Set();
        allArticles = allArticles.filter(article => {
            if (seen.has(article.link)) return false;
            seen.add(article.link);
            return true;
        });

        // Nieuwste eerst
        allArticles.sort((a, b) => b.timestamp - a.timestamp);

        console.log("Totaal opgehaald:", allArticles.length);

        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "Ommen";

        searchNews("Ommen");

    } catch (e) {
        console.error("Load error:", e);
        container.innerHTML = "<p>Kon nieuws niet laden. Probeer te vernieuwen.</p>";
    }
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");

    let html = `<p><strong>${articles.length} artikelen gevonden</strong></p>`;

    if (articles.length === 0) {
        html += "<p>Geen artikelen gevonden.</p>";
    } else {
        html += articles.map(article => `
            <div class="article">
                <h2>
                    <a href="${article.link}" target="_blank" rel="noopener">
                        ${article.title}
                    </a>
                </h2>
                <small>
                    ${article.source} — ${
                        article.timestamp
                            ? new Date(article.timestamp).toLocaleDateString('nl-NL')
                            : ""
                    }
                </small>
                <p>${article.description}</p>
            </div>
        `).join('');
    }

    container.innerHTML = html;
}

function searchNews(query) {

    if (!query || query.trim() === "") {
        renderArticles(allArticles);
        return;
    }

    const q = query.toLowerCase().trim();

    const filtered = allArticles
        .filter(a =>
            a.title.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q)
        )
        .sort((a, b) => b.timestamp - a.timestamp);

    renderArticles(filtered);
}

function refreshNews() {
    loadNews();
}

window.addEventListener("DOMContentLoaded", loadNews);
