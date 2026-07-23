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



        const items = Array.from(
    xml.getElementsByTagName("item")
);

console.log(
    "RSS items gevonden:",
    url,
    items.length
);

console.log("Aantal RSS items:", url, items.length);

return items
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


        const links = [];


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

                links.push({

                    title: title,

                    link: href

                });

            }

        }


        const artikelen =
            await Promise.all(

                links
                .slice(0,10)
                .map(async artikel => {


                    const datum =
                        await fetchGemeenteDatum(
                            artikel.link
                        );


                    const tekst =
                        await fetchGemeenteTekst(
                            artikel.link
                        );


                    return {

                        title:
                            artikel.title,

                        link:
                            artikel.link,

                        description:
                            tekst,

                        pubDate:
                            datum,

                        timestamp:
                            datum
                            ? Date.parse(datum)
                            : Date.now()

                    };

                })

            );


        console.log(
            "Gemeente Ommen gevonden:",
            artikelen.length
        );


        return artikelen;


    }
    catch(error) {


        console.error(
            "Fout gemeente Ommen:",
            error
        );


        return [];

    }

}

async function fetchRTVVechtdalNieuws() {

    const url = "https://rtvvechtdal.nl/";

    try {

        const res = await fetch(
            PROXY + encodeURIComponent(url)
        );

        const text = await res.text();

        const html = new DOMParser()
            .parseFromString(text, "text/html");

        const links = [];

        html.querySelectorAll("a").forEach(a => {

            const href = new URL(
    a.getAttribute("href"),
    "https://rtvvechtdal.nl"
).href;

            console.log(href);
            
            const title = a.textContent.trim();

            if (
                href.includes("type=detail") &&
                title.length > 10 &&
                !links.some(l => l.link === href)
            ) {

                links.push({
                    title,
                    link: href
                });

            }

        });

        const artikelen = await Promise.all(

            links.slice(0,10).map(async artikel => {

                const res2 = await fetch(
                    PROXY + encodeURIComponent(artikel.link)
                );

                const text2 = await res2.text();

                const doc = new DOMParser()
                    .parseFromString(text2,"text/html");

                const body =
                    doc.body.innerText
                        .replace(/\s+/g," ")
                        .trim();

let schoneTekst = body;

// Alles vóór de eerste datum verwijderen
schoneTekst = schoneTekst.replace(
    /^.*?(\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i,
    "$1"
);
                
                // Datum zoeken
                const match =
                    body.match(
                        /\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i
                    );

                const datum =
                    match ? match[0] : "";

                // Eerste stuk tekst
                let beschrijving = schoneTekst
    .replace(artikel.title,"")
    .replace(
        /Home Vechtdal TV.*?Stichting RTV Vechtdal/i,
        ""
    )
    .replace(
        /\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i,
        ""
    )
    .trim()
    .substring(0,300);

                return {

                    title: artikel.title,

                    link: artikel.link,

                    description:
                        beschrijving + "...",

                    timestamp:
                        datum
                        ? Date.parse(datum)
                        : Date.now()

                };

            })

        );

        return artikelen;

    }
    catch(error) {

        console.error("RTV:", error);

        return [];

    }

}

async function fetchOmmerNieuws() {

    const url =
        "https://rtvvechtdal.nl/vechtdalnl/nieuws";


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


        const links = [];


        html.querySelectorAll("a")
        .forEach(a => {


            const href =
                new URL(
                    a.getAttribute("href"),
                    "https://rtvvechtdal.nl"
                ).href;


            const title =
                a.textContent.trim();



            if (

                href.includes("type=detail") &&
                title.length > 10 &&
                !links.some(
                    item =>
                    item.link === href
                )

            ) {


                links.push({

                    title,

                    link: href

                });


            }


        });



        console.log(
            "Ommer Nieuws links:",
            links.length
        );



        const artikelen =
            await Promise.all(

                links
                .slice(0,10)
                .map(async artikel => {


                    const res2 =
                        await fetch(
                            PROXY +
                            encodeURIComponent(
                                artikel.link
                            )
                        );


                    const text2 =
                        await res2.text();


                    const doc =
                        new DOMParser()
                        .parseFromString(
                            text2,
                            "text/html"
                        );


                    const body =
                        doc.body.innerText
                        .replace(/\s+/g," ")
                        .trim();



                    const datum =
                        body.match(
                            /\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i
                        );



                    let beschrijving = body;

// verwijder alles vóór de datum
beschrijving = beschrijving.replace(
    /^.*?\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i,
    ""
);

// titel verwijderen
beschrijving = beschrijving
    .replace(artikel.title, "")

// JavaScript en website-code verwijderen
    .replace(
        /Vorige\s+jQuery\( document \).*$/i,
        ""
    )

// eventuele scripts verwijderen
    .replace(
        /<script.*?<\/script>/gi,
        ""
    )

// overtollige witruimte
    .replace(/\s+/g," ")
    .trim()
    .substring(0,300);



                    return {

                        title:
                            artikel.title,

                        link:
                            artikel.link,

                        description:
                            beschrijving + "...",

                        timestamp:
                            datum
                            ? Date.parse(datum[0])
                            : Date.now()

                    };


                })

            );


        console.log(
            "Ommer Nieuws artikelen:",
            artikelen.length
        );


        return artikelen;


    }
    catch(error) {


        console.error(
            "Ommer Nieuws fout:",
            error
        );


        return [];

    }

}

async function fetchOostNieuws() {

    const url = "https://www.oost.nl/nieuws";

    const oostKeywords = [
        "ommen",
        "ommer",
        "ommerschans",
        "besthmenerberg",
        "lemelerberg",
        "beerze",
        "vilsteren",
        "vechtdal"
    ];

    try {

        const res = await fetch(
            PROXY + encodeURIComponent(url)
        );

        const text = await res.text();

        const titels = [];
        let aantalTitels = 0;

        const regex = /"title":"(.*?)"/g;

let match;

if ((match = regex.exec(text)) !== null) {

    const positie = match.index;

    console.log(
        "OOST ITEM GEDEELTE:",
        text.substring(
            positie - 500,
            positie + 1500
        )
    );

}

       while ((match = regex.exec(text)) !== null) {

            let titel = match[1]
                .replace(/\\u002F/g,"/")
                .replace(/\\u0027/g,"'")
                .trim();

            if (
    titel.length > 15 &&
    !titels.includes(titel)
) {
    titels.push(titel);

    if (aantalTitels < 20) {
        console.log("OOST TITEL:", titel);
        aantalTitels++;
    }
}


        const artikelen = titels
            .filter(titel => {

                const zoek =
                    titel.toLowerCase();

                return oostKeywords.some(keyword =>
                    zoek.includes(keyword)
                );

            })
            .map(titel => ({

                title: titel,

                link:
                "https://www.oost.nl/nieuws",

                description:
                "RTV Oost nieuwsbericht",

                timestamp:
                Date.now()

            }));


        console.log(
            "RTV Oost Ommen:",
            artikelen.length
        );


        return artikelen.slice(0,10);


    }
    catch(error) {

        console.error(
            "RTV Oost fout:",
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
        regel.length > 40 &&
        !regel.includes("HomeActueel") &&
        !regel.includes("Uitleg in eenvoudige taal") &&
        !regel.includes("simpele tekst")
    );


if (regels.length > 0) {

    return regels
        .slice(1,4)
        .join(" ")
        .substring(0,350)
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



 // RSS en Gemeente tegelijk ophalen

const [results, gemeenteArtikelen, rtvArtikelen, ommerArtikelen, oostArtikelen] =
    await Promise.all([

        Promise.all(

            feeds.map(feed =>
                fetchRSS(feed.url)
                .then(articles => ({

                    source:
                        feed.name,

                    articles:
                        articles

                }))
            )

        ),

        fetchGemeenteNieuws(),

        fetchRTVVechtdalNieuws(),

        fetchOmmerNieuws(),

        fetchOostNieuws()

    ]);


// RSS artikelen toevoegen

results.forEach(result => {

    result.articles.forEach(article => {

        allArticles.push({

            ...article,

            source:
                result.source

        });

    });

});


// Gemeente artikelen toevoegen

gemeenteArtikelen.forEach(article => {

    allArticles.push({

        ...article,

        source:
            "Gemeente Ommen"

    });

});

    rtvArtikelen.forEach(article => {

    allArticles.push({

        ...article,

        source:
            "RTV Vechtdal"

    });

});

    ommerArtikelen.forEach(article => {

    allArticles.push({

        ...article,

        source:
            "Ommer Nieuws"

    });

});

    oostArtikelen.forEach(article => {

    allArticles.push({

        ...article,

        source:
            "Oost"

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

const gekozenBronnen =
    Array.from(
        document.querySelectorAll(".source-filter:checked")
    )
    .map(box => box.value);


articles =
    articles.filter(article =>
        gekozenBronnen.includes(article.source)
    );

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


function setupSources() {

    const button = document.getElementById("source-button");
    const menu = document.getElementById("source-menu");
    
    menu.style.display = "none";

    if (!button || !menu) return;

    button.addEventListener("click", function() {

        if (menu.style.display === "none") {
            menu.style.display = "block";
            button.innerHTML = "Bronnen ▲";
        } 
        else {
            menu.style.display = "none";
            button.innerHTML = "Bronnen ▼";
        }

    });


    document.querySelectorAll(".source-filter")
    .forEach(box => {

        box.addEventListener("change", function() {

            searchNews();

        });

    });

}

window.addEventListener(
    "DOMContentLoaded",
    function() {

        setupSearch();

        setupSources();

        loadNews();

    }
);
