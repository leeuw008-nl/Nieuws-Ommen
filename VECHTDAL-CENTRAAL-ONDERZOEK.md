# Ommen Nieuws app - onderzoekslog

## Algemene afspraken

- Geen browserconsole beschikbaar.
- Testresultaten altijd zichtbaar maken via de app zelf.
- Geen tijdelijke testcode in productiecode laten staan.
- Eerst bestaande testen controleren voordat nieuwe routes worden geprobeerd.


# Vechtdal Centraal - testlog

Doel:
Vechtdal Centraal toevoegen als nieuwsbron aan de Ommen Nieuws app.

---

## Test 1 - RSS feed

Getest:
https://www.vechtdalcentraal.nl/feed/

Resultaat:
Geen bruikbare nieuwsartikelen gevonden.

Status:
Mislukt.

---

## Test 2 - WordPress API

Getest:
https://www.vechtdalcentraal.nl/wp-json/wp/v2/posts

Resultaat:
Geen bruikbare resultaten verkregen via de gebruikte proxy/testmethode.

Status:
Mislukt.

---

## Test 3 - Website ophalen via proxy

Getest:
https://www.vechtdalcentraal.nl/

Methode:
Pagina opgehaald via:

https://corsproxy.io/
Resultaat:

- HTTP status: 202
- HTML lengte: 1112 tekens
- Geen paginatitel
- Geen bruikbare links gevonden

Status:
Mislukt.

---

## Test 4 - Website links uitlezen

Getest:
Alle links op:
https://www.vechtdalcentraal.nl/

Resultaat:
Aantal gevonden bruikbare links:
0

Status:
Mislukt.

---

## Nog niet getest

- sitemap.xml
- alternatieve JSON endpoints
- andere openbare feeds
- andere scrapingmethode zonder huidige proxy

Status:
NIET GESCHIKT

---

## Test 4 - RTV Vechtdal

URL:
https://rtvvechtdal.nl/

Resultaat:
Werkt via scraping van detailpagina's.

Status:
WERKENDE OPLOSSING

---

---

## Test 5 - Website ophalen via proxy (hercontrole)

Getest:

https://www.vechtdalcentraal.nl/

Methode:

Pagina opgehaald via:

https://corsproxy.io/

Resultaat:

- HTTP status: 202
- HTML lengte: 1123 tekens
- Geen echte website-inhoud ontvangen
- Proxy ontvangt een Cloudflare/SgCaptcha beveiligingspagina

Kenmerk:

De ontvangen HTML bevat:

<meta http-equiv="refresh" content="0;/.well-known/sgcaptcha/...">

Conclusie:

De huidige proxy-methode krijgt geen toegang tot de website.
Hierdoor kunnen links, artikelen of pagina-inhoud niet worden uitgelezen.

Status:

Mislukt door websitebeveiliging (niet door app-code).

---

## Test 5 - XML sitemap

Getest:
https://www.vechtdalcentraal.nl/post-sitemap.xml

Resultaat:
Sitemap bereikbaar.
Bevat 61 sitemapbestanden.
Meest recente artikelen lijken aanwezig in:
post-sitemap.xml

Conclusie:
Website scraping via homepage mislukt door Cloudflare.
Sitemap lijkt bruikbare alternatieve ingang.
Status:
Geslaagd.

## Test 6 - post-sitemap.xml via JavaScript

Getest:
https://www.vechtdalcentraal.nl/post-sitemap.xml

Methode:
Ophalen via corsproxy.io en XML parser.

Resultaat:
0 URL's gevonden.

Conclusie:
Response bevat waarschijnlijk geen direct uitleesbare XML via deze methode.
Volgende stap:
Werkelijke response-inhoud controleren.

# Besluiten

- RTV Vechtdal blijft huidige bron.
- Vechtdal Centraal wordt niet opnieuw getest via dezelfde methodes.
