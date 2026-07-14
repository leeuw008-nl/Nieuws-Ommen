const PROXY = 'https://corsproxy.io/?';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        const text = await res.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");

        if (xml.querySelector("parsererror")) return [];

        return Array.from(xml.querySelectorAll("item, entry"))
            .slice(0, 8)
            .map(item => {
                let link = "#";
                const linkEl = item.querySelector("link");
                if (linkEl) {
                    link = (linkEl.getAttribute("href") || linkEl.textContent || "").trim();
                }
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

// Verbeterde filter voor Stentor
function isRelevantToOmmen(article) {
    const text = (article.title + " " + article.description).toLowerCase();
    
    // Basis + extra Ommen-gerelateerde termen
    return text.includes("ommen") || 
           text.includes("laarbos") ||
           text.includes("markt ommen") ||
           text.includes(" in ommen") ||
           text.includes("ommen,") ||
           text.includes("ommon");
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden van nieuws uit Ommen...</p>";

    const promises = feeds.map(feed => 
        fetchRSS(feed.url).then(arts => arts.map(a => ({...a, source: feed.name})))
    );

    const results = await Promise
