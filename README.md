# Netwerkplanner

Webtool om een **netwerkplanning** te tekenen en door te rekenen: activiteiten als blokken, relaties (FS, SS, FF, SF) met tijdsverschil, vroegste en laatste tijden, speling en kritiek pad. Opslaan en openen gaat via een **Excel-bestand**; afdrukken en PDF op A3 met overlap tussen de pagina's.

Alles draait in de browser. Er is geen server en geen account nodig; gegevens verlaten je computer niet.

## Starten

- **Lokaal:** dubbelklik op `index.html` (Chrome of Edge aanbevolen).
- **GitHub Pages:** zet de inhoud van deze map in de repository (in de hoofdmap) en zet Pages aan op de branch `main`, map `/ (root)`.

Voor Excel heeft de tool de bibliotheek SheetJS nodig. Die wordt via internet geladen. Werken zonder internet: zie `lib/LEESMIJ.txt`.

## Mappen en bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | De pagina met werkbalk, panelen en vensters |
| `css/style.css` | Opmaak, inclusief de afdrukopmaak |
| `js/model.js` | Datamodel en rekenen (heenweg, terugweg, speling, kritiek pad, lusdetectie) |
| `js/render.js` | Tekenen van blokken en pijlen (zelfde code voor scherm en afdruk) |
| `js/excel.js` | Opslaan naar en openen uit .xlsx |
| `js/print.js` | Verdelen over pagina's met overlap, afdrukken en PDF |
| `js/help.js` | Tekst van de helpfunctie |
| `js/app.js` | Bediening: canvas, slepen, relaties leggen, panelen, bestanden |
| `lib/` | Plek voor een lokale kopie van SheetJS (optioneel) |

## Excel-indeling

| Tabblad | Kolommen |
|---|---|
| Activiteiten | ID, Naam, Rol, Doorlooptijd, Notitie · *grijs (alleen om te lezen):* Vroegste start, Vroegste einde, Laatste start, Laatste einde, Totale speling, Kritiek |
| Relaties | Van, Naar, Type (FS/SS/FF/SF), Tijdsverschil, Lus (ja/nee) |
| Project | Naam, Tijdseenheid, Startdatum, Bestandsversie, Gemaakt met |
| _indeling | *verborgen:* ID, X, Y (plek op het canvas) |

Bij openen leest de tool alleen de invoerkolommen; de rekenkolommen worden opnieuw berekend.

---

## Wijzigingen per versie

### v0.1 — eerste versie (15-11-2026)

**Canvas**
- Oneindig canvas in alle richtingen; schuiven met spatie + slepen, middelste muisknop of scrollen; zoomen met Ctrl + scroll of − / +; *Passend in beeld* (F).
- Minikaart linksonder (klikken = daarheen gaan).
- Activiteit toevoegen met dubbelklik, knop of toets N; slepen met raster van 20 px (Alt = vrij); pijltjestoetsen verschuiven.
- Meerdere selecteren met Shift + klik of een kader; Ctrl + A = alles.
- Uitlijnbalk bij 2 of meer geselecteerde blokken: links, midden, rechts, boven, midden, onder, horizontaal en verticaal gelijk verdelen.
- Automatisch ordenen: kolom = plek in het netwerk, kritieke activiteiten bovenaan.
- Ongedaan maken en opnieuw (Ctrl + Z / Ctrl + Y), verwijderen met Delete.

**Activiteiten en relaties**
- Blok met zes vakken: vroegste start, doorlooptijd, vroegste einde / laatste start, totale speling, laatste einde; kritieke blokken met rode kop.
- Relatie leggen door van poort naar poort te slepen; de poorten bepalen het type (FS, SS, FF, SF). Ook via het paneel rechts.
- Relatievenster (dubbelklik op een pijl): type, tijdsverschil (negatief = overlap), lus, verwijderen, met uitleg in gewone taal.
- Lussen (rework) worden automatisch gedetecteerd: gaat een nieuwe relatie terug naar een eerdere activiteit (de relatie sluit een kring), dan wordt ze vanzelf een lus. Al tijdens het slepen kleurt de pijl paars met het label “lus: rework”. Een lus is een paarse stippellijn en telt niet mee in de berekening. Dit geldt ook bij relaties via het paneel en bij openen uit Excel.
- Rekenen volgens de kritieke-padmethode met alle vier relatietypen en tijdsverschil; telling vanaf 0; vroegste start nooit vóór 0.
- Rode pijlen voor relaties die op het kritieke pad de start van de opvolger bepalen.

**Panelen**
- Links: activiteitenlijst met zoeken; klikken = selecteren en in beeld brengen.
- Rechts: bewerken van naam, rol, doorlooptijd en notitie, met rekenwaarden, voorgangers en opvolgers.
- Onderaan: projectduur, aantallen, lussen en of er niet-opgeslagen wijzigingen zijn.

**Bestanden**
- Opslaan en openen als Excel (.xlsx) met de tabbladen hierboven; posities in een verborgen tabblad.
- In Chrome en Edge overschrijft *Opslaan* het geopende bestand; elders wordt het een download.
- Controle bij openen: onbekende ID's, dubbele relaties, ongeldige typen en kringen worden gemeld; activiteiten zonder plek worden automatisch geplaatst.
- Tussentijds bewaren in de browser, met herstel na sluiten; waarschuwing bij sluiten met niet-opgeslagen wijzigingen.

**Afdrukken en PDF**
- A3 (standaard), A4 of A2, liggend of staand.
- Schaal *Leesbaar* (namen minimaal 9 pt, aantal pagina's volgt daaruit), *Op 1 pagina* (met melding onder 7 pt) of een vaste schaal.
- Verdelen over pagina's A1, B1, … A2, B2 … met instelbare overlap (standaard 15 mm), gemarkeerd met een blauwe band en stippellijnen; naden waar mogelijk tussen de blokken.
- Overzichtspagina met paginaraster, kop met projectnaam, datum, paginacode en paginakaart, legenda, en een zwart-witoptie.
- PDF via *Opslaan als PDF* in het afdrukvenster van de browser.

**Overig**
- Helpfunctie met uitleg, sneltoetsen, rekenregels, Excel-indeling en afdrukken.
- Voorbeeldproject (knop *Voorbeeld laden* op een leeg canvas).

### Nog niet in deze versie (ideeën voor later)
- Hulplijnen tijdens slepen.
- Vrije speling.
- Datums in plaats van dagnummers (werkdagenkalender).
- Koppeling met de DSM.
