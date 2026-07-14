const PROXY = 'https://corsproxy.io/?';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        console.log("Ophalen:", url);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 seconden max

        const res = await fetch(PROXY + encodeURIComponent(url), { 
            signal: controller.signal 
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        console.log(url, "response lengte:", text.length);

        const xml = new DOMParser().parseFromString(text, "text/xml");
        if (xml.querySelector("parsererror")) {
            console.error("XML parse error bij", url);
            return [];
        }

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
        console.error("Fout bij", url, e.message);
        return [];
    }
}

function isRelevantToOmmen(article) {
    const text = (article.title + " " + article.description).toLowerCase();
    return text.includes("ommen") || 
           text.includes("laarbos") ||
           text.includes(" in ommen");
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden van nieuws uit Ommen...</p>";

    try {
        const promises = feeds.map(feed => 
            fetchRSS(feed.url).then(arts => arts.map(a => ({
