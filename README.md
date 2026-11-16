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
| Activiteiten | ID, Soort (activiteit/start/tussentijds/eind), Naam, Rol, Doorlooptijd, Niet vóór, Notitie · *grijs (alleen om te lezen):* Vroegste start, Vroegste einde, Laatste start, Laatste einde, Totale speling, Kritiek |
| Relaties | Van, Naar, Type (FS/SS/FF/SF), Tijdsverschil, Aangrijpingspunt (begin/tijdens/einde), Na, Na-eenheid (dagen/%), Lus (ja/nee) |
| Project | Naam, Tijdseenheid, Documentdatum, Versie, Status, Bestandsversie, Gemaakt met, Afdruk … (afdrukinstellingen) |
| _indeling | *verborgen:* ID, X, Y (plek op het canvas) |

Bij openen leest de tool alleen de invoerkolommen; de rekenkolommen worden opnieuw berekend.

---

## Wijzigingen per versie

### v0.4 (16-11-2026)

**Projectgegevens**
- Bij het project (paneel rechts als niets is geselecteerd) staan nu *Documentdatum*, *Versie* en *Status* (met keuzelijst: Concept, Ter review, Ter vaststelling, Vastgesteld, Vervallen; vrije tekst mag ook). De startdatum is vervallen.
- Versie en status staan naast de projectnaam in de werkbalk en in de kop van elke afgedrukte pagina, samen met de documentdatum.
- Opgeslagen in het Excel-tabblad *Project*.

**Afdrukken**
- Het afdrukvenster toont live een voorbeeld van het hele netwerk met het paginaraster, de paginacodes en de overlapbanden.
- Nieuwe schaalkeuze *Zo groot mogelijk op n × m pagina’s*, en bij *Zelf kiezen* een schuif (20–300%; 100% = leesbaar, namen 9 pt). De samenvatting toont schaal en lettergrootte, en zegt hoe groot de tekst op 1 pagina zou worden.
- Optie *Paginaraster ook op het canvas tonen* (ook in het projectpaneel): de paginagrenzen staan dan tijdens het werken op het canvas.
- Opgelost: bij een netwerk dat net niet op één vel past, werd de tweede pagina grotendeels leeg. Het netwerk wordt nu gelijkmatig over de pagina’s verdeeld (naden nog steeds zo veel mogelijk tussen de blokken) en de tekening staat midden op het vel.
- De afdrukinstellingen worden met het project bewaard (in de browser en in Excel).


### v0.3 (16-11-2026)
- Het label *wacht n* op relaties is weg (ook het vinkje *Wachttijd*, de Excel-kolom en de regel in de legenda). Hoe lang iets kan wachten, lees je af aan vroegste/laatste tijden en de speling in het blok.
- Gebeurtenissen liggen nu met hun midden op dezelfde hoogte als de poorten van activiteiten: op dezelfde rij loopt een pijl van of naar een gebeurtenis kaarsrecht.
- Een trigger *aan het begin* loopt naar de startpoort van de activiteit en een trigger *aan het einde* naar de eindpoort; alleen *tijdens* komt van boven op het blok binnen. De pijl loopt niet meer door het naamlabel van de gebeurtenis.
- Een start- of eindgebeurtenis springt bij de eerste relatie vanzelf op één lijn met de activiteit.
- Bij een startgebeurtenis staat niet meer *bepalend*; alleen *niet vóór* en (als er speling is) *uiterlijk*.
- Bestanden en tussentijds bewaard werk uit v0.2 worden automatisch omgezet naar de nieuwe plek van gebeurtenissen.


### v0.2 (16-11-2026)

**Gebeurtenissen en triggers**
- Nieuw knooptype *gebeurtenis* (knop *+ Gebeurtenis* of toets G): startgebeurtenis (cirkel), tussentijdse gebeurtenis (dubbele cirkel) en eindgebeurtenis (dikke cirkel). In de cirkel staat de dag; eronder de naam.
- Tussentijdse en startgebeurtenissen hebben een *niet vóór*-dag; de gebeurtenis ligt nooit eerder.
- Een gebeurtenis triggert een activiteit via een groene pijl naar de bovenkant van het blok. Het aangrijpingspunt kan aan het begin, tijdens (na p dagen of p % van de doorlooptijd) of aan het einde zijn. Bij het slepen bepaalt de plek waar je loslaat het aangrijpingspunt, met voorbeeldlabel; een streepje over het blok toont het punt.
- Rekenen: VS(activiteit) ≥ moment(gebeurtenis) + tijdsverschil − p. De gebeurtenis krijgt een *uiterlijk*-moment en speling; is die 0, dan staat er *bepalend* en is ze kritiek.
- Een activiteit kan van soort wisselen (activiteit ↔ gebeurtenis) via het paneel rechts.

**Wachttijd**
- Op pijlen staat *wacht n* als de opvolger die input eerder krijgt dan nodig (vrije speling op de relatie). Aan/uit met het vinkje *Wachttijd*. Ook in het paneel rechts, in Excel (rekenkolom) en in de legenda van de afdruk.

**Relaties**
- Pijlpunten zijn groter en altijd zichtbaar; op langere pijlen staat halverwege een extra pijltje dat de richting aangeeft.
- De poorten (witte rondjes) zijn alleen zichtbaar als je over een blok beweegt of een relatie aan het leggen bent.
- Tijdens het slepen van een relatie staat bij de muis welk type relatie of trigger er ontstaat.
- Opgelost: tijdens het slepen werd de doelpoort niet altijd herkend omdat de voorbeeldlijn in de weg zat.

**Excel**
- Activiteiten: nieuwe kolommen *Soort* en *Niet vóór*. Relaties: *Aangrijpingspunt*, *Na*, *Na-eenheid* en rekenkolom *Wachttijd*. Bestanden van v0.1 blijven openen.

**Bewerken (aanvulling op v0.2)**
- Dubbelklik op een activiteit of gebeurtenis opent een venster om naam, soort, rol, doorlooptijd, niet vóór en notitie aan te passen. Dubbelklik op een pijl opent het relatievenster. (Dubbelklikken werkte eerder niet altijd, omdat het scherm tussen de twee klikken opnieuw werd getekend.)
- Een nieuwe activiteit of gebeurtenis opent meteen dat venster met de naam geselecteerd: direct typen, Enter = opslaan, Esc = de nieuwe activiteit vervalt.
- Eén klik op een pijl toont de relatie in het paneel rechts, met de cursor al in het veld *Vertraging / tijdsverschil*; ook type, aangrijpingspunt en lus zijn daar aan te passen.

**Weergave (aanvulling op v0.2)**
- Activiteiten met doorlooptijd 0 (mijlpalen) krijgen een dikke stippellijn als rand; gewone activiteiten een doorgetrokken rand van dezelfde, iets dikkere lijn.
- Het versienummer staat achter de script- en CSS-bestanden (`?v=0.2`), zodat de browser na een update de nieuwe bestanden ophaalt.

**Voorbeeld**
- Het voorbeeldproject heeft nu ook een tussentijdse gebeurtenis (*Besluit CvB over faciliteiten*, niet vóór dag 8, tijdens na 2 dagen).

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

### Nog niet gebouwd (ideeën voor later)
- Hulplijnen tijdens slepen.
- Vrije speling.
- Datums in plaats van dagnummers (werkdagenkalender).
- Koppeling met de DSM.
