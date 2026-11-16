/* Netwerkplanner – helptekst */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});
  NP.helpHtml = function () {
    return `
<h2>Netwerkplanner v${NP.VERSIE} – uitleg</h2>
<p>Met de Netwerkplanner teken je een netwerkplanning: activiteiten als blokken, verbonden met relaties. De tool rekent zelf de vroegste en laatste tijden, de speling en het kritieke pad uit. Alles blijft in je eigen browser; opslaan gaat naar een Excel-bestand dat je zelf bewaart.</p>

<h3>Het activiteitenblok</h3>
<table>
<tr><td>Vroegste start (VS)</td><td>Doorlooptijd (DL) – zelf invullen</td><td>Vroegste einde (VE)</td></tr>
<tr><td>Laatste start (LS)</td><td>Totale speling (TS)</td><td>Laatste einde (LE)</td></tr>
</table>
<p>Naam, rol en doorlooptijd vul je in rechts in het paneel. De andere vijf getallen rekent de tool uit. Is de totale speling 0, dan wordt de kop rood en staat er <em>Kritiek</em>. Doorlooptijd 0 = mijlpaal: zo’n blok krijgt een dikke stippellijn als rand en werkt als een soort gebeurtenis. Gewone activiteiten hebben een doorgetrokken rand.</p>

<h3>Werken op het canvas</h3>
<table>
<tr><th>Wat</th><th>Hoe</th></tr>
<tr><td>Nieuwe activiteit</td><td>Dubbelklik op een lege plek, of <em>+ Activiteit</em>. Er opent direct een venster: typ de naam en druk op <kbd>Enter</kbd> (<kbd>Esc</kbd> = toch niet)</td></tr>
<tr><td>Activiteit of gebeurtenis bewerken</td><td>Dubbelklik op het blok (of gebruik het paneel rechts)</td></tr>
<tr><td>Relatie bewerken</td><td>Klik op de pijl: rechts kun je meteen de vertraging typen. Dubbelklik op de pijl opent het venster</td></tr>
<tr><td>Verplaatsen</td><td>Blok vastpakken en slepen. Met <em>Raster</em> aan springt het op 20 px; houd <kbd>Alt</kbd> ingedrukt om vrij te slepen</td></tr>
<tr><td>Meerdere selecteren</td><td><kbd>Shift</kbd> + klik, of een kader trekken op een lege plek</td></tr>
<tr><td>Uitlijnen</td><td>Selecteer 2 of meer blokken; bovenaan verschijnt de uitlijnbalk</td></tr>
<tr><td>Schuiven</td><td><kbd>Spatie</kbd> + slepen, middelste muisknop, of scrollen (<kbd>Shift</kbd> + scroll = zijwaarts)</td></tr>
<tr><td>Zoomen</td><td><kbd>Ctrl</kbd> + scroll, of − / + rechtsonder. <kbd>F</kbd> = alles in beeld</td></tr>
<tr><td>Minikaart</td><td>Linksonder; klik om naar die plek te gaan</td></tr>
<tr><td>Verwijderen</td><td><kbd>Delete</kbd></td></tr>
<tr><td>Ongedaan maken / opnieuw</td><td><kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd></td></tr>
<tr><td>Kleine stap verschuiven</td><td>Pijltjestoetsen (1 rasterstap), met <kbd>Shift</kbd> 5 stappen</td></tr>
</table>
<p>Het canvas is oneindig in alle richtingen.</p>

<h3>Relaties</h3>
<p>Beweeg de muis over een blok: links en rechts verschijnen de poorten (○). Sleep van een poort naar een poort van een ander blok. Links zit de <strong>startpoort</strong>, rechts de <strong>eindpoort</strong>. Welke poorten je verbindt, bepaalt het type:</p>
<table>
<tr><th>Type</th><th>Slepen van → naar</th><th>Betekenis (A = voorganger, B = opvolger)</th></tr>
<tr><td>FS Finish–Start</td><td>einde A → start B</td><td>B mag pas starten als A klaar is</td></tr>
<tr><td>SS Start–Start</td><td>start A → start B</td><td>B mag pas starten als A gestart is</td></tr>
<tr><td>FF Finish–Finish</td><td>einde A → einde B</td><td>B mag pas eindigen als A klaar is</td></tr>
<tr><td>SF Start–Finish</td><td>start A → einde B</td><td>B mag pas eindigen als A gestart is</td></tr>
</table>
<p>Laat je los op het blok zelf in plaats van op een poort, dan wordt het de startpoort. Dubbelklik op een pijl om type, tijdsverschil en lus aan te passen. Een positief tijdsverschil is wachttijd, een negatief tijdsverschil is overlap. De relaties leggen een <em>vroegst</em> toegestaan moment vast: B mag ook later.</p>

<h3>Gebeurtenissen en triggers</h3>
<p>Een gebeurtenis is een moment zonder doorlooptijd, zoals een opdracht, een wetswijziging of een besluit van het CvB. Je maakt er een met <em>+ Gebeurtenis</em> (toets <kbd>G</kbd>) en kiest rechts de soort:</p>
<table>
<tr><th>Soort</th><th>Teken</th><th>Gebruik</th></tr>
<tr><td>Startgebeurtenis</td><td>cirkel</td><td>Het project begint hierdoor; geen voorgangers.</td></tr>
<tr><td>Tussentijdse gebeurtenis</td><td>dubbele cirkel</td><td>Een moment van buiten waar een activiteit op wacht, met een <em>niet vóór</em>-dag.</td></tr>
<tr><td>Eindgebeurtenis</td><td>dikke cirkel</td><td>Het resultaat is er.</td></tr>
</table>
<p>Sleep van het rechter rondje van een gebeurtenis naar een activiteit. Waar je loslaat, bepaalt het <strong>aangrijpingspunt</strong>:</p>
<table>
<tr><th>Loslaten</th><th>Aangrijpingspunt</th><th>Regel</th></tr>
<tr><td>links op het blok</td><td>Begin</td><td>de activiteit start niet vóór de gebeurtenis</td></tr>
<tr><td>in het midden</td><td>Tijdens, na p dagen</td><td>de activiteit mag eerder starten, maar dag p van de activiteit ligt niet vóór de gebeurtenis (VS ≥ moment − p)</td></tr>
<tr><td>rechts op het blok</td><td>Einde</td><td>de activiteit eindigt niet vóór de gebeurtenis (VS ≥ moment − D)</td></tr>
</table>
<p>Dubbelklik op de groene pijl om het aangrijpingspunt te wijzigen; bij <em>tijdens</em> kies je dagen of een percentage van de doorlooptijd. Een streepje over het blok laat zien waar de trigger aangrijpt.</p>
<p>Onder de gebeurtenis staat <em>uiterlijk dag n</em>: het laatste moment waarop de gebeurtenis mag plaatsvinden zonder dat het project uitloopt. Staat er <em>bepalend</em> (rood), dan bepaalt de gebeurtenis het kritieke pad.</p>

<h3>Wachttijd</h3>
<p>Krijgt een activiteit haar input van een voorganger eerder dan nodig (bijvoorbeeld omdat ze ook nog op een besluit wacht), dan staat op die pijl <em>wacht n</em>: zoveel dagen ligt die input klaar. Zet het uit met het vinkje <em>Wachttijd</em> in de werkbalk.</p>

<h3>Lussen (terugkoppelingen)</h3>
<p>De tool herkent rework zelf: verbind je een activiteit met een <em>eerdere</em> activiteit (de relatie sluit een kring), dan wordt het automatisch een <strong>lus</strong>: een paarse stippellijn. Tijdens het slepen zie je dat al aan de paarse pijl met het label <em>lus: rework</em>. Een lus is zichtbaar en wordt opgeslagen, maar telt <strong>niet</strong> mee in de berekening. In het relatievenster kun je zelf kiezen welke pijl van een kring de lus is. Een lus is ook de basis voor de latere koppeling met de DSM (terugkoppeling boven de diagonaal).</p>

<h3>Zo rekent de tool</h3>
<p>Na elke wijziging: eerst de heenweg (vroegste tijden), dan de terugweg (laatste tijden). v = tijdsverschil, D = doorlooptijd.</p>
<table>
<tr><th>Type</th><th>Heenweg: VS(B) is minimaal</th><th>Terugweg: LE(A) is maximaal</th></tr>
<tr><td>FS</td><td>VE(A) + v</td><td>LS(B) − v</td></tr>
<tr><td>SS</td><td>VS(A) + v</td><td>LS(B) − v + D(A)</td></tr>
<tr><td>FF</td><td>VE(A) + v − D(B)</td><td>LE(B) − v</td></tr>
<tr><td>SF</td><td>VS(A) + v − D(B)</td><td>LE(B) − v + D(A)</td></tr>
</table>
<p>Voor een trigger van een gebeurtenis G met aangrijpingspunt na p dagen geldt: VS(B) ≥ moment(G) + v − p (begin: p = 0, einde: p = D(B)). Een gebeurtenis zelf ligt nooit vóór haar <em>niet vóór</em>-dag.</p>
<p>VS = de grootste van alle ondergrenzen, maar nooit vóór 0 (projectstart). VE = VS + D. Het projecteinde is het grootste VE. LE = de kleinste van alle bovengrenzen (zonder opvolgers: het projecteinde). LS = LE − D. Totale speling = LS − VS. Tellen gaat vanaf 0: een activiteit van 5 dagen die op 10 start, eindigt op 15.</p>
<p>Een pijl is rood als hij tussen twee kritieke activiteiten ligt én de vroegste start van de opvolger bepaalt.</p>

<h3>Opslaan en openen (Excel)</h3>
<p>Eén project is één .xlsx-bestand met de tabbladen:</p>
<ul>
<li><strong>Activiteiten</strong>: ID, Soort (activiteit, start, tussentijds, eind), Naam, Rol, Doorlooptijd, Niet vóór, Notitie. De grijze kolommen (Vroegste start t/m Kritiek) zet de tool erbij om te lezen; bij openen worden ze genegeerd en opnieuw berekend.</li>
<li><strong>Relaties</strong>: Van (ID), Naar (ID), Type (FS/SS/FF/SF), Tijdsverschil, Aangrijpingspunt (begin/tijdens/einde, alleen voor triggers), Na, Na-eenheid (dagen of %), Lus (ja/nee). Wachttijd is een grijze rekenkolom.</li>
<li><strong>Project</strong>: naam, tijdseenheid, startdatum.</li>
<li><strong>_indeling</strong> (verborgen): waar elk blok op het canvas staat. Ontbreekt een activiteit daar, dan plaatst de tool het blok zelf.</li>
</ul>
<p>Je kunt dus ook eerst in Excel een lijst maken en die openen. In Chrome en Edge overschrijft <em>Opslaan</em> het geopende bestand; in andere browsers wordt het een download. Je werk wordt ook steeds tussentijds in deze browser bewaard, zodat je na het per ongeluk sluiten verder kunt.</p>

<h3>Afdrukken en PDF</h3>
<p>Standaard A3 liggend. Bij <em>Leesbaar</em> worden namen nooit kleiner dan 9 pt; past het netwerk niet op één vel, dan verdeelt de tool het over meer pagina’s (A1, B1, … A2, B2 …). Tussen de pagina’s zit een overlap (standaard 15 mm), gemarkeerd met een blauwe band en stippellijnen, zodat je de vellen makkelijk aan elkaar legt. De naden worden waar mogelijk tussen de blokken gelegd. Voor een PDF kies je in het afdrukvenster <em>Opslaan als PDF</em>.</p>
`;
  };
})();
