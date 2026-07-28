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

# Besluiten

- RTV Vechtdal blijft huidige bron.
- Vechtdal Centraal wordt niet opnieuw getest via dezelfde methodes.
