const PROXY = 'https://corsproxy.io/?';

const feeds = [
    {
        name: 'Ommen City',
        url: 'https://ommencity.nl/feed/'
    },
    {
        name: 'OudOmmen',
        url: 'https://weblog.oudommen.nl/feed/'
    },
    {
        name: 'De Stentor',
        url: 'https://www.destentor.nl/ommen/rss.xml'
    }
];


const ommenKeywords = [
    "ommen",
    "arriën",
    "arrien",
    "beerze",
    "beerzerveld",
    "besthmen",
    "diffelen",
    "giethmen",
    "junne",
    "lemele",
    "stegeren",
    "vilsteren",
    "witharen",
    "varsen",
    "ommermars"
];


let allArticles = [];



async function fetchRSS(url) {

    try {

        const response = await fetch(
            PROXY + encodeURIComponent(url)
        );


        if (!response.ok) {
            throw new Error("RSS fout");
        }


        const text = await response.text();


        const xml =
            new DOMParser()
                .parseFromString(
                    text,
                    "text/xml"
                );


        if (xml.querySelector("parsererror")) {
            return [];
        }



        return Array.from(
            xml.querySelectorAll("item, entry")
        )
        .slice(0, 25)
        .map(item => {


            let link = "";


            const linkElement =
                item.querySelector("link");


            if (linkElement) {

                link =
                    linkElement.getAttribute("href")
                    ||
                    linkElement.textContent
                    ||
                    "";

            }


            const date =
                item.querySelector("pubDate")
                    ?.textContent
                    ?.trim()

                ||

                item.querySelector("published")
                    ?.textContent
                    ?.trim()

                ||

                item.querySelector("updated")
                    ?.textContent
                    ?.trim()

                ||

                "";



            const timestamp =
                Date.parse(date);



            return {

                title:
                    item.querySelector("title")
                        ?.textContent
                        ?.trim()
                    ||
                    "Geen titel",


                description:
                    (
                        item.querySelector(
                            "description, summary, content"
                        )
                        ?.textContent
                        ||
                        ""
                    )
                    .replace(/<[^>]+>/g, "")
                    .trim(),


                link:
                    link.trim(),


                timestamp:
                    isNaN(timestamp)
                    ? 0
                    : timestamp

            };


        });


    }
    catch(error) {

        console.error(
            "RSS ophalen mislukt:",
            url,
            error
        );

        return [];

    }

}

async function fetchGemeenteNieuws() {

    const url =
        "https://www.ommen.nl/actueel/";

    try {

        const res =
            await fetch(
                PROXY + encodeURIComponent(url)
            );


        if (!res.ok) {
            throw new Error("Gemeente pagina niet bereikbaar");
        }


        const text =
            await res.text();


        const html =
            new DOMParser()
                .parseFromString(
                    text,
                    "text/html"
                );


        const articles = [];


        for (const link of html.querySelectorAll("a")) {


                const title =
                    link.querySelector("h3, h2")
                    ?.textContent
                    ?.trim()
                    ||
                    link.textContent.trim();


                const href =
                    link.href;


                if (

                    title &&

                    href.includes("/actueel/") &&

                    title.length > 10

                ) {


                    

const datum =
    await fetchGemeenteDatum(href);


const timestamp =
    datum
    ? Date.parse(datum)
    : Date.now();


articles.push({

    title: title,

    link: href,

    description: await fetchGemeenteTekst(href),

    pubDate: datum,

    timestamp: timestamp

});

                }


            }


        console.log(
            "Gemeente Ommen gevonden:",
            articles.length
        );


        return articles.slice(0,25);


    }
    catch(error) {


        console.error(
            "Fout gemeente Ommen:",
            error
        );


        return [];

    }

}

async function fetchGemeenteDatum(url) {

    try {

        const res =
            await fetch(
                PROXY + encodeURIComponent(url)
            );


        const text =
            await res.text();


        const html =
            new DOMParser()
                .parseFromString(
                    text,
                    "text/html"
                );


        const bodyText =
            html.body.innerText;


        const match =
            bodyText.match(
                /\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4},\s+\d{2}:\d{2}/i
            );


        if (match) {

            return match[0];

        }


        return "";


    }
    catch(error) {

        console.error(
            "Datum ophalen mislukt:",
            url,
            error
        );

        return "";

    }

}
 async function fetchGemeenteTekst(url) {

    try {

        const res =
            await fetch(
                PROXY + encodeURIComponent(url)
            );


        const text =
            await res.text();


        const html =
            new DOMParser()
                .parseFromString(
                    text,
                    "text/html"
                );


        const bodyText =
            html.body.innerText;


        // verwijder overbodige witruimte

        const regels =
            bodyText
            .split("\n")
            .map(regel => regel.trim())
            .filter(regel =>
                regel.length > 40
            );


        if (regels.length > 0) {

            return regels[0]
                .substring(0,250)
                + "...";

        }


        return "";


    }
    catch(error) {

        console.error(
            "Tekst ophalen mislukt:",
            url,
            error
        );

        return "";

    }

}       

function isOmmenNieuws(article) {


    const text =

        (
            article.title
            +
            " "
            +
            article.description
        )
        .toLowerCase();



    return ommenKeywords.some(keyword =>
        text.includes(keyword)
    );

}




async function loadNews() {


    const container =
        document.getElementById(
            "news-container"
        );


    container.innerHTML =
        "<p>Nieuws laden...</p>";



    allArticles = [];



    // Alle feeds tegelijk ophalen

    const results =
        await Promise.all(

            feeds.map(feed =>
                fetchRSS(feed.url)
                    .then(articles => ({

                        source:
                            feed.name,

                        articles:
                            articles

                    }))
            )

        );



    results.forEach(result => {


        result.articles.forEach(article => {


            allArticles.push({

                ...article,

                source:
                    result.source

            });


        });


    });
const gemeenteArtikelen =
    await fetchGemeenteNieuws();


gemeenteArtikelen.forEach(article => {

    allArticles.push({

        ...article,

        source:
            "Gemeente Ommen"

    });

});


    // dubbele artikelen verwijderen

    const seen = new Set();


    allArticles =
        allArticles.filter(article => {


            if (seen.has(article.link)) {

                return false;

            }


            seen.add(article.link);


            return true;


        });



    // nieuwste eerst

    allArticles.sort(
        (a,b) =>
            b.timestamp - a.timestamp
    );



    console.log(
        "Aantal artikelen:",
        allArticles.length
    );



    searchNews();

}
function renderArticles(articles) {

    const container =
        document.getElementById(
            "news-container"
        );


    let html =

        `<p><strong>${articles.length} artikelen gevonden</strong></p>`;


    if (articles.length === 0) {

        html +=
            "<p>Geen artikelen gevonden.</p>";

    }

    else {


        html += articles.map(article => `

            <div class="article">

                <h2>
                    <a href="${article.link}"
                       target="_blank"
                       rel="noopener">

                        ${article.title}

                    </a>
                </h2>


                <small>

                    ${article.source}

                    —

                    ${
                        article.timestamp
                        ? new Date(article.timestamp)
                            .toLocaleDateString('nl-NL')
                        : ""
                    }

                </small>


                <p>

                    ${article.description}

                </p>


            </div>


        `).join("");

    }


    container.innerHTML = html;

}




function searchNews() {


    const searchInput =
        document.getElementById(
            "search-input"
        );


    const alleenOmmen =
        document.getElementById(
            "only-ommen"
        ).checked;



    const zoekterm =
        searchInput.value
            .toLowerCase()
            .trim();



    let articles =
        [...allArticles];



    // Eerst eventueel filter op Ommen

    if (alleenOmmen) {


        articles =
            articles.filter(article =>
                isOmmenNieuws(article)
            );

    }



    // Daarna zoeken op eigen zoekwoord

    if (zoekterm !== "") {


        articles =
            articles.filter(article => {


                const text =

                    (
                        article.title
                        +
                        " "
                        +
                        article.description
                    )
                    .toLowerCase();



                return text.includes(zoekterm);


            });


    }



    articles.sort(
        (a,b) =>
            b.timestamp - a.timestamp
    );



    renderArticles(articles);

}





function setupSearch() {

    const searchInput =
        document.getElementById(
            "search-input"
        );

    const switchOmmen =
        document.getElementById(
            "only-ommen"
        );


    searchInput.addEventListener(
        "input",
        searchNews
    );


    if (switchOmmen) {

        switchOmmen.addEventListener(
            "change",
            function() {

                searchInput.value = "";

                searchNews();

            }
        );

    }

}




function refreshNews() {

    loadNews();

}




window.addEventListener(
    "DOMContentLoaded",
    async function() {

        setupSearch();

        loadNews();


    }
);
