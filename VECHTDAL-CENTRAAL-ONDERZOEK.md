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

---

## Test 5 - post sitemap uitlezen via proxy

Getest:

https://www.vechtdalcentraal.nl/post-sitemap.xml

Methode:

Ophalen via:

https://corsproxy.io/

Resultaat:

- HTTP status: 202
- Geen XML ontvangen
- Cloudflare challenge pagina ontvangen
- Sitemap kan daardoor niet automatisch uitgelezen worden

Status:

Mislukt via huidige proxy.

Conclusie:

Vechtdal Centraal gebruikt Cloudflare bescherming die de huidige proxy blokkeert.
Andere methode nodig.

---

## Test 6 - Alternatieve RSS feeds

Getest:

1. https://www.vechtdalcentraal.nl/?feed=rss2
2. https://www.vechtdalcentraal.nl/feed/rss/
3. https://www.vechtdalcentraal.nl/rss/

Methode:

Ophalen via:

https://corsproxy.io/

Resultaat:

Alle drie de URL's geven:

- HTTP status: 202
- Geen RSS/XML ontvangen
- Cloudflare challenge pagina ontvangen
- 0 artikelen gevonden

Status:

Mislukt.

Conclusie:

De standaard WordPress RSS-feeds zijn via de huidige proxy niet toegankelijk.

---

## Test 5 - Sitemap ophalen via browser/proxy

Getest:

https://www.vechtdalcentraal.nl/post-sitemap.xml

Resultaat:

- HTTP status: 202
- Inhoud bevat geen sitemap maar Cloudflare challenge pagina
- Geen URLs kunnen uitlezen

Status:

Mislukt (geblokkeerd door Cloudflare).

---

## Test 6 - Alternatieve RSS URLs

Getest:

https://www.vechtdalcentraal.nl/?feed=rss2

https://www.vechtdalcentraal.nl/feed/rss/

https://www.vechtdalcentraal.nl/rss/

Resultaat:

- HTTP status: 202
- Geen RSS XML ontvangen
- Geen artikelen gevonden

Status:

Mislukt (geblokkeerd door Cloudflare).

---

---

## Test 7 - WordPress REST API

Getest:

https://www.vechtdalcentraal.nl/wp-json/wp/v2/posts?per_page=5

Resultaat:

- HTTP status: 202
- Inhoud bevat geen JSON maar Cloudflare challenge pagina
- Geen WordPress artikelen ontvangen

Status:

Mislukt (geblokkeerd door Cloudflare).

---

# Besluiten

- RTV Vechtdal blijft huidige bron.
- Vechtdal Centraal wordt niet opnieuw getest via dezelfde methodes.
