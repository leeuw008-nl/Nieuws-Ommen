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


// ==========================
// RSS ophalen
// ==========================

async function fetchRSS(url) {

    try {

        const response = await fetch(
            PROXY + encodeURIComponent(url)
        );

        if (!response.ok) {
            throw new Error("RSS fout");
        }

        const text = await response.text();

        const xml = new DOMParser()
            .parseFromString(text, "text/xml");


        if (xml.querySelector("parsererror")) {
            return [];
        }


        return Array.from(
            xml.querySelectorAll("item, entry")
        )
        .slice(0,25)
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
                    .replace(/<[^>]+>/g,"")
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
            "RSS fout:",
            url,
            error
        );

        return [];

    }

}



// ==========================
// Gemeente Ommen
// ==========================

async function fetchGemeenteNieuws() {

    const url =
        "https://www.ommen.nl/actueel/";


    try {

        const response =
            await fetch(
                PROXY + encodeURIComponent(url)
            );


        const text =
            await response.text();


        const html =
            new DOMParser()
            .parseFromString(
                text,
                "text/html"
            );


        const links = [];


        html.querySelectorAll("a")
        .forEach(link => {


            const titel =
                link.textContent
                .trim();


            const href =
                link.href;


            if (
                titel.length > 15 &&
                href.includes("/actueel/")
            ) {

                links.push({

                    title:titel,

                    link:href

                });

            }

        });



        const artikelen = [];


        for (
            const artikel of links.slice(0,10)
        ) {


            artikelen.push({

                title:
                    artikel.title,


                link:
                    artikel.link,


                description:
                    await fetchGemeenteTekst(
                        artikel.link
                    ),


                timestamp:
                    Date.now()

            });

        }


        console.log(
            "Gemeente artikelen:",
            artikelen.length
        );


        return artikelen;


    }
    catch(error) {

        console.error(
            "Gemeente fout:",
            error
        );

        return [];

    }

}

// ==========================
// Gemeente tekst ophalen
// ==========================

async function fetchGemeenteTekst(url) {

    try {

        const response =
            await fetch(
                PROXY + encodeURIComponent(url)
            );


        const text =
            await response.text();


        const html =
            new DOMParser()
            .parseFromString(
                text,
                "text/html"
            );


        const regels =
            html.body.innerText
            .split("\n")
            .map(regel => regel.trim())
            .filter(regel =>
                regel.length > 40 &&
                !regel.includes("Home") &&
                !regel.includes("Actueel") &&
                !regel.includes("Uitleg")
            );


        if (regels.length) {

            return regels
                .slice(0,3)
                .join(" ")
                .substring(0,350)
                + "...";

        }


        return "";


    }
    catch(error) {

        console.error(
            "Tekst fout:",
            error
        );

        return "";

    }

}



// ==========================
// Controle Ommen nieuws
// ==========================

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



// ==========================
// Nieuws laden
// ==========================

async function loadNews() {


    const container =
        document.getElementById(
            "news-container"
        );


    container.innerHTML =
        "<p>Nieuws laden...</p>";



    allArticles = [];



    // RSS feeds parallel ophalen

    const resultaten =
        await Promise.all(

            feeds.map(async feed => {


                const artikelen =
                    await fetchRSS(
                        feed.url
                    );


                return {

                    source:
                        feed.name,

                    artikelen:
                        artikelen

                };


            })

        );



    // RSS toevoegen

    resultaten.forEach(resultaat => {


        resultaat.artikelen.forEach(article => {


            allArticles.push({

                ...article,

                source:
                    resultaat.source

            });


        });


    });



    // Gemeente toevoegen

    const gemeente =
        await fetchGemeenteNieuws();



    gemeente.forEach(article => {


        allArticles.push({

            ...article,

            source:
                "Gemeente Ommen"

        });


    });



    // dubbele links verwijderen

    const gezien =
        new Set();



    allArticles =
        allArticles.filter(article => {


            if (gezien.has(article.link)) {

                return false;

            }


            gezien.add(article.link);


            return true;


        });



    // nieuwste bovenaan

    allArticles.sort(
        (a,b) =>
            b.timestamp - a.timestamp
    );



    console.log(
        "Totaal artikelen:",
        allArticles.length
    );



    searchNews();

}



// ==========================
// Artikelen tonen
// ==========================

function renderArticles(articles) {


    const container =
        document.getElementById(
            "news-container"
        );


    let html =
        `<p><strong>${articles.length} artikelen gevonden</strong></p>`;



    if (!articles.length) {


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

                -

                ${
                    article.timestamp
                    ?
                    new Date(article.timestamp)
                    .toLocaleDateString(
                        'nl-NL'
                    )
                    :
                    ""
                }

            </small>



            <p>

                ${article.description}

            </p>


        </div>


        `).join("");

    }


    container.innerHTML =
        html;

}

// ==========================
// Zoeken en filteren
// ==========================

function searchNews() {


    const searchInput =
        document.getElementById(
            "search-input"
        );


    const alleenOmmen =
        document.getElementById(
            "only-ommen"
        )
        ?.checked
        ||
        false;



    const zoekterm =
        searchInput.value
        .toLowerCase()
        .trim();



    let artikelen =
        [...allArticles];



    // Alleen nieuws uit regio Ommen

    if (alleenOmmen) {


        artikelen =
            artikelen.filter(article =>
                isOmmenNieuws(article)
            );

    }



    // Zoekwoord toepassen

    if (zoekterm !== "") {


        artikelen =
            artikelen.filter(article => {


                const tekst =
                    (
                        article.title
                        +
                        " "
                        +
                        article.description
                    )
                    .toLowerCase();



                return tekst.includes(
                    zoekterm
                );


            });

    }



    artikelen.sort(
        (a,b) =>
            b.timestamp - a.timestamp
    );



    renderArticles(
        artikelen
    );

}



// ==========================
// Zoekveld instellen
// ==========================

function setupSearch() {


    const searchInput =
        document.getElementById(
            "search-input"
        );


    const switchOmmen =
        document.getElementById(
            "only-ommen"
        );



    if (searchInput) {


        searchInput.addEventListener(
            "input",
            searchNews
        );

    }



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



// ==========================
// Vernieuwen knop
// ==========================

function refreshNews() {

    loadNews();

}



// ==========================
// Start app
// ==========================

window.addEventListener(
    "DOMContentLoaded",
    function() {


        setupSearch();


        loadNews();


    }
);
