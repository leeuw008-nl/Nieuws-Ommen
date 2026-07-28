# Ommen Nieuws app - onderzoekslog

## Algemene afspraken

- Geen browserconsole beschikbaar.
- Testresultaten altijd zichtbaar maken via de app zelf.
- Geen tijdelijke testcode in productiecode laten staan.
- Eerst bestaande testen controleren voordat nieuwe routes worden geprobeerd.


# Vechtdal Centraal

## Doel
Vechtdal Centraal toevoegen als nieuwsbron.

---

## Test 1 - RSS feed

URL:
https://www.vechtdalcentraal.nl/feed/

Resultaat:
Geen bruikbare artikelen gevonden.

Status:
NIET GEBRUIKEN

---

## Test 2 - WordPress API

URL:
https://www.vechtdalcentraal.nl/wp-json/wp/v2/posts

Resultaat:
Geen bruikbare gegevens via huidige proxy-oplossing.

Status:
NIET VERDER ONDERZOEKEN

---

## Test 3 - Website scraping

URL:
https://www.vechtdalcentraal.nl/

Resultaat:
Proxy gaf:
- HTTP status 202
- HTML lengte 1112
- geen titel
- geen links

Conclusie:
Geen echte webpagina ontvangen.

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