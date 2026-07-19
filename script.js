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
    },
    {
        name: 'Ommer Nieuws',
        url: 'https://www.vechtdalcentraal.nl/feed/'
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


        const items =
            Array.from(
                xml.querySelectorAll("item")
            );


        console.log(
            "RSS gevonden:",
            url,
            items.length
        );


        return items
            .slice(0,25)
            .map(item => {


                const title =
                    item.querySelector("title")
                    ?.textContent
                    ?.trim()
                    ||
                    "Geen titel";


                const link =
                    item.querySelector("link")
                    ?.textContent
                    ?.trim()
                    ||
                    "";


                const description =
                    (
                        item.querySelector(
                            "description"
                        )
                        ?.textContent
                        ||
                        ""
                    )
                    .replace(/<[^>]+>/g,"")
                    .trim();


                const date =
                    item.querySelector("pubDate")
                    ?.textContent
                    ?.trim()
                    ||
                    "";


                return {

                    title,

                    link,

                    description,

                    timestamp:
                        Date.parse(date)
                        ||
                        0

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

        const response = await fetch(
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


        const artikelen = [];


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


                if (
                    !artikelen.some(
                        a => a.link === href
                    )
                ) {

                    artikelen.push({

                        title: titel,

                        link: href,

                        description: "",

                        timestamp:
                            Date.now()

                    });

                }

            }


        });


        console.log(
            "Gemeente gevonden:",
            artikelen.length
        );


        return artikelen
            .slice(0,10);


    }
    catch(error) {

        console.error(
            "Gemeente fout:",
            error
        );


        return [];

    }

}




async function fetchRTVVechtdalNieuws() {


    const url =
        "https://rtvvechtdal.nl/vechtdalnl/nieuws";


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
        .forEach(a => {


            const href =
                new URL(
                    a.getAttribute("href"),
                    "https://rtvvechtdal.nl"
                ).href;


            const titel =
                a.textContent
                .trim();



            if (

                titel.length > 10 &&
                href.includes("type=detail")

            ) {


                if (
                    !links.some(
                        item =>
                        item.link === href
                    )
                ) {


                    links.push({

                        title: titel,

                        link: href

                    });


                }

            }


        });



        console.log(
            "RTV Vechtdal links:",
            links.length
        );



        return links
            .slice(0,10)
            .map(item => {


                return {

                    title:
                        item.title,

                    link:
                        item.link,

                    description:
                        "RTV Vechtdal nieuws",

                    timestamp:
                        Date.now()

                };


            });



    }
    catch(error) {


        console.error(
            "RTV Vechtdal fout:",
            error
        );


        return [];

    }

}





function isOmmenNieuws(article) {


    const tekst =

        (
            article.title +
            " " +
            article.description

        )
        .toLowerCase();



    return ommenKeywords.some(
        woord =>
        tekst.includes(woord)
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



    const [
        rssResult,
        gemeenteArtikelen,
        rtvArtikelen

    ] = await Promise.all([


        Promise.all(

            feeds.map(
                async feed => {

                    const artikelen =
                        await fetchRSS(
                            feed.url
                        );


                    return {

                        source:
                            feed.name,

                        artikelen

                    };

                }

            )

        ),


        fetchGemeenteNieuws(),


        fetchRTVVechtdalNieuws()

    ]);



    // RSS toevoegen

    rssResult.forEach(bron => {


        bron.artikelen.forEach(article => {


            allArticles.push({

                ...article,

                source:
                    bron.source

            });


        });


    });



    // Gemeente toevoegen

    gemeenteArtikelen.forEach(article => {


        allArticles.push({

            ...article,

            source:
                "Gemeente Ommen"

        });


    });



    // RTV toevoegen

    rtvArtikelen.forEach(article => {


        allArticles.push({

            ...article,

            source:
                "RTV Vechtdal"

        });


    });



    // dubbele links verwijderen

    const gezien =
        new Set();


    allArticles =
        allArticles.filter(article => {


            if (
                gezien.has(
                    article.link
                )
            ) {

                return false;

            }


            gezien.add(
                article.link
            );


            return true;


        });



    // nieuwste eerst

    allArticles.sort(
        (a,b) =>
        b.timestamp - a.timestamp
    );



    console.log(
        "Totaal artikelen:",
        allArticles.length
    );


    console.log(
        "Ommer Nieuws:",
        allArticles.filter(
            a =>
            a.source === "Ommer Nieuws"
        ).length
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



    if (
        articles.length === 0
    ) {


        html +=
            "<p>Geen artikelen gevonden.</p>";

    }

    else {


        html +=
        articles.map(article => `


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
                    new Date(
                        article.timestamp
                    )
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






function searchNews() {


    const zoekveld =
        document.getElementById(
            "search-input"
        );


    const alleenOmmen =
        document.getElementById(
            "only-ommen"
        )
        .checked;



    const zoekterm =
        zoekveld.value
        .toLowerCase()
        .trim();



    let artikelen =
        [...allArticles];



    if (alleenOmmen) {


        artikelen =
        artikelen.filter(
            article =>
            isOmmenNieuws(article)
        );

    }



    if (zoekterm !== "") {


        artikelen =
        artikelen.filter(article => {


            const tekst =

                (
                    article.title +
                    " " +
                    article.description

                )
                .toLowerCase();



            return tekst.includes(
                zoekterm
            );


        });

    }



    const gekozenBronnen =

        Array.from(

            document.querySelectorAll(
                ".source-filter:checked"
            )

        )
        .map(
            box =>
            box.value
        );



    artikelen =
    artikelen.filter(article =>

        gekozenBronnen.includes(
            article.source
        )

    );



    artikelen.sort(
        (a,b) =>
        b.timestamp - a.timestamp
    );



    renderArticles(
        artikelen
    );

}






function setupSearch() {


    const input =
        document.getElementById(
            "search-input"
        );


    const switchKnop =
        document.getElementById(
            "only-ommen"
        );



    input.addEventListener(
        "input",
        searchNews
    );



    switchKnop.addEventListener(
        "change",
        () => {

            input.value = "";

            searchNews();

        }

    );


}






function setupSources() {


    const button =
        document.getElementById(
            "source-button"
        );


    const menu =
        document.getElementById(
            "source-menu"
        );



    if (!button || !menu)
        return;



    menu.style.display =
        "none";



    button.onclick =
    function() {


        if (
            menu.style.display ===
            "none"
        ) {


            menu.style.display =
                "block";


            button.innerHTML =
                "Bronnen ▲";


        }

        else {


            menu.style.display =
                "none";


            button.innerHTML =
                "Bronnen ▼";


        }


    };



    document
    .querySelectorAll(
        ".source-filter"
    )
    .forEach(box => {


        box.addEventListener(
            "change",
            searchNews
        );


    });


}






function refreshNews() {

    loadNews();

}






window.addEventListener(
    "DOMContentLoaded",
    () => {


        setupSearch();


        setupSources();


        loadNews();


    }

);
