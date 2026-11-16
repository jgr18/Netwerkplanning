/* Netwerkplanner – bediening (canvas, panelen, bestanden) */
(function () {
  'use strict';
  const NP = window.NP;
  const $ = id => document.getElementById(id);
  const RASTER = 20;
  const { W, H } = NP.KNOOP;
  const OPSLAG_SLEUTEL = 'netwerkplanner.autosave.v1';

  const S = {
    p: NP.nieuwProject(),
    reken: null,
    sel: new Set(),
    selRel: null,
    view: { x: 80, y: 80, z: 1 },
    undo: [], redo: [],
    vuil: false,
    handle: null,          // bestandshandle (Chrome/Edge)
    bestandsnaam: null,
    spatie: false,
    modus: null,           // 'slepen' | 'pannen' | 'verbinden' | 'lasso'
    m: null,               // gegevens van de lopende muisactie
    zoek: ''
  };
  window.NP_STATE = S; // handig voor testen

  const svg = $('svg'), wereld = $('wereld'), doek = $('doek');

  /* ---------- geschiedenis ---------- */
  function momentopname() { return JSON.stringify(S.p); }
  function bewaarStap(snap) {
    S.undo.push(snap || momentopname());
    if (S.undo.length > 150) S.undo.shift();
    S.redo = [];
  }
  function gewijzigd() {
    S.vuil = true;
    autosave();
    teken();
  }
  function ongedaan() {
    if (!S.undo.length) return;
    S.redo.push(momentopname());
    S.p = JSON.parse(S.undo.pop());
    opschonenSelectie();
    gewijzigd();
  }
  function opnieuw() {
    if (!S.redo.length) return;
    S.undo.push(momentopname());
    S.p = JSON.parse(S.redo.pop());
    opschonenSelectie();
    gewijzigd();
  }
  function opschonenSelectie() {
    for (const id of [...S.sel]) if (!NP.getAct(S.p, id)) S.sel.delete(id);
    if (S.selRel && !S.p.relaties.find(r => r.id === S.selRel)) S.selRel = null;
  }

  let autosaveTimer = null;
  function autosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try { localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify({ p: S.p, bestandsnaam: S.bestandsnaam, vuil: S.vuil, tijd: Date.now() })); } catch (e) { /* opslag niet beschikbaar */ }
    }, 400);
  }

  /* ---------- weergave ---------- */
  function zetView() {
    const v = S.view;
    wereld.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.z})`);
    let g = RASTER * v.z;
    while (g < 10) g *= 5;
    doek.style.backgroundSize = `${g}px ${g}px`;
    doek.style.backgroundPosition = `${v.x}px ${v.y}px`;
    $('zoomLabel').textContent = Math.round(v.z * 100) + '%';
    tekenMinikaart();
  }
  function schermNaarWereld(cx, cy) {
    const r = svg.getBoundingClientRect();
    return { x: (cx - r.left - S.view.x) / S.view.z, y: (cy - r.top - S.view.y) / S.view.z };
  }
  function zoomOm(factor, cx, cy) {
    const r = svg.getBoundingClientRect();
    const px = cx === undefined ? r.width / 2 : cx - r.left;
    const py = cy === undefined ? r.height / 2 : cy - r.top;
    const z2 = Math.min(3, Math.max(0.15, S.view.z * factor));
    const f = z2 / S.view.z;
    S.view.x = px - (px - S.view.x) * f;
    S.view.y = py - (py - S.view.y) * f;
    S.view.z = z2;
    zetView();
  }
  function passend() {
    const bb = NP.omhullende(S.p);
    const r = svg.getBoundingClientRect();
    if (!bb) { S.view = { x: 80, y: 80, z: 1 }; zetView(); return; }
    const z = Math.min(1.25, Math.max(0.15, Math.min((r.width - 80) / bb.w, (r.height - 80) / bb.h)));
    S.view.z = z;
    S.view.x = (r.width - bb.w * z) / 2 - bb.x * z;
    S.view.y = (r.height - bb.h * z) / 2 - bb.y * z;
    zetView();
  }
  function inBeeld(id) {
    const a = NP.getAct(S.p, id);
    if (!a) return;
    const r = svg.getBoundingClientRect();
    S.view.x = r.width / 2 - (a.x + W / 2) * S.view.z;
    S.view.y = r.height / 2 - (a.y + H / 2) * S.view.z;
    zetView();
  }

  function teken() {
    S.reken = NP.bereken(S.p);
    const toonKritiek = $('chkKritiek').checked;
    const reken = toonKritiek ? S.reken : Object.assign({}, S.reken, { drijvend: new Set(), per: kopieZonderKritiek(S.reken.per) });
    const opts = { reken, sel: S.sel, selRel: S.selRel, scherm: true };
    $('defs').innerHTML = NP.defs(NP.kleuren(false));
    $('laagRel').innerHTML = NP.tekenRelaties(S.p, opts);
    $('laagKnoop').innerHTML = NP.tekenKnopen(S.p, opts);
    $('leeg').hidden = S.p.activiteiten.length > 0;
    $('uitlijnbalk').hidden = S.sel.size < 2;
    if (document.activeElement !== $('projectNaam')) $('projectNaam').value = S.p.naam || '';
    tekenLijst();
    tekenInspecteur();
    tekenStatus();
    tekenMinikaart();
    $('btnUndo').disabled = !S.undo.length;
    $('btnRedo').disabled = !S.redo.length;
    document.title = (S.vuil ? '● ' : '') + (S.p.naam || 'Netwerkplanner') + ' – Netwerkplanner';
  }
  function kopieZonderKritiek(per) {
    const o = {};
    for (const k in per) o[k] = Object.assign({}, per[k], { kritiek: false });
    return o;
  }

  function tekenLijst() {
    const z = S.zoek.trim().toLowerCase();
    const rij = [];
    for (const a of S.p.activiteiten) {
      if (z && !(`${a.id} ${a.naam} ${a.rol}`.toLowerCase().includes(z))) continue;
      const c = S.reken.kringFout ? null : S.reken.per[a.id];
      rij.push(`<button class="lijstrij${S.sel.has(a.id) ? ' sel' : ''}" data-id="${NP.esc(a.id)}"><span class="id">${NP.esc(a.id)}</span><span title="${NP.esc(a.naam)}">${NP.esc(a.naam || '(naamloos)')}</span><span>${NP.fmt(Number(a.duur))}</span><span class="${c && c.kritiek ? 'krit' : ''}">${c ? NP.fmt(c.ts) : ''}</span></button>`);
    }
    $('lijst').innerHTML = rij.join('') || '<p class="klein" style="padding:6px">Geen activiteiten.</p>';
  }

  function tekenStatus() {
    const r = S.reken;
    const krit = r.kringFout ? 0 : S.p.activiteiten.filter(a => r.per[a.id].kritiek).length;
    const lussen = S.p.relaties.filter(x => x.lus).length;
    const naam = S.bestandsnaam ? NP.esc(S.bestandsnaam) : 'nog niet opgeslagen';
    $('status').innerHTML =
      (r.kringFout ? '<span class="fout">Er zit een kring in het netwerk; rekenen is gestopt. Markeer een relatie als lus.</span>' :
        `<span><strong>Projectduur:</strong> ${NP.fmt(r.projectEinde)} ${NP.esc(S.p.eenheid || 'werkdagen')}</span>`) +
      `<span><strong>Activiteiten:</strong> ${S.p.activiteiten.length}</span>` +
      `<span><strong>Kritiek:</strong> ${krit}</span>` +
      `<span class="lus"><strong>Lussen:</strong> ${lussen}${lussen ? ' (niet meegerekend)' : ''}</span>` +
      `<span class="vul"></span>` +
      `<span>Bestand: ${naam}${S.vuil ? ' · <strong>niet opgeslagen wijzigingen ●</strong>' : ''}</span>`;
  }

  function tekenMinikaart() {
    const m = $('miniSvg');
    const bb = NP.omhullende(S.p);
    const r = svg.getBoundingClientRect();
    const zicht = { x: -S.view.x / S.view.z, y: -S.view.y / S.view.z, w: r.width / S.view.z, h: r.height / S.view.z };
    let x1 = zicht.x, y1 = zicht.y, x2 = zicht.x + zicht.w, y2 = zicht.y + zicht.h;
    if (bb) { x1 = Math.min(x1, bb.x); y1 = Math.min(y1, bb.y); x2 = Math.max(x2, bb.x + bb.w); y2 = Math.max(y2, bb.y + bb.h); }
    const pad = 40;
    const vb = { x: x1 - pad, y: y1 - pad, w: x2 - x1 + 2 * pad, h: y2 - y1 + 2 * pad };
    m.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    m.dataset.vb = JSON.stringify(vb);
    let s = '';
    const lw = vb.w / 200;
    for (const a of S.p.activiteiten) {
      const c = S.reken && !S.reken.kringFout ? S.reken.per[a.id] : null;
      s += `<rect x="${a.x}" y="${a.y}" width="${W}" height="${H}" fill="${c && c.kritiek ? '#F4B8B0' : '#C9D3E3'}" stroke="#6B6B66" stroke-width="${lw}"/>`;
    }
    s += `<rect x="${zicht.x}" y="${zicht.y}" width="${zicht.w}" height="${zicht.h}" fill="rgba(29,78,216,.07)" stroke="#1D4ED8" stroke-width="${lw * 1.6}"/>`;
    m.innerHTML = s;
  }

  /* ---------- inspecteur ---------- */
  function tekenInspecteur() {
    const el = $('inspecteur');
    if (el.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) {
      // tijdens typen niet het hele paneel vervangen; alleen rekenwaarden bijwerken
      const vak = el.querySelector('.rekenvak');
      if (vak && S.sel.size === 1) vak.outerHTML = rekenvak([...S.sel][0]);
      return;
    }
    if (S.sel.size === 1) el.innerHTML = paneelActiviteit([...S.sel][0]);
    else if (S.sel.size > 1) el.innerHTML = paneelMeer();
    else el.innerHTML = paneelProject();
  }
  function rekenvak(id) {
    const c = S.reken.kringFout ? null : S.reken.per[id];
    const a = NP.getAct(S.p, id);
    const v = x => c ? NP.fmt(x) : '–';
    return `<div class="rekenvak">
      <div>Vroegste start<b>${v(c && c.vs)}</b></div><div>Doorlooptijd<b>${NP.fmt(Number(a.duur))}</b></div><div>Vroegste einde<b>${v(c && c.ve)}</b></div>
      <div>Laatste start<b>${v(c && c.ls)}</b></div><div class="${c && c.kritiek ? 'krit' : ''}">Totale speling<b>${v(c && c.ts)}</b></div><div>Laatste einde<b>${v(c && c.le)}</b></div></div>`;
  }
  function relRij(r, andereId, richting) {
    const b = NP.getAct(S.p, andereId);
    const v = Number(r.verschil) || 0;
    const lab = `${r.type}${v ? (v > 0 ? ' +' : ' −') + NP.fmt(Math.abs(v)) : ' +0'}${r.lus ? ' ↺' : ''}`;
    return `<button class="relrij${r.lus ? ' lus' : ''}" data-relopen="${NP.esc(r.id)}" title="${richting}: klik om te bewerken"><span>${NP.esc(b ? b.naam || b.id : andereId)}</span><b>${lab}</b></button>`;
  }
  function paneelActiviteit(id) {
    const a = NP.getAct(S.p, id);
    const voor = S.p.relaties.filter(r => r.naar === id);
    const na = S.p.relaties.filter(r => r.van === id);
    const opties = S.p.activiteiten.filter(x => x.id !== id).map(x => `<option value="${NP.esc(x.id)}">${NP.esc(x.id + ' · ' + (x.naam || ''))}</option>`).join('');
    return `<div class="paneelkop">Activiteit ${NP.esc(a.id)}</div>
      <label class="veld">Naam<input data-veld="naam" type="text" value="${NP.esc(a.naam)}"></label>
      <label class="veld">Rol / verantwoordelijke<input data-veld="rol" type="text" value="${NP.esc(a.rol)}"></label>
      <label class="veld">Doorlooptijd (${NP.esc(S.p.eenheid || 'werkdagen')})<input data-veld="duur" type="number" min="0" step="0.5" value="${NP.esc(a.duur)}"></label>
      ${rekenvak(id)}
      <h3>Voorgangers</h3>${voor.map(r => relRij(r, r.van, 'Voorganger')).join('') || '<p class="klein">Geen.</p>'}
      <h3>Opvolgers</h3>${na.map(r => relRij(r, r.naar, 'Opvolger')).join('') || '<p class="klein">Geen.</p>'}
      ${opties ? `<div class="relform">
        <select class="heel" id="nrAndere" aria-label="Andere activiteit">${opties}</select>
        <select id="nrRichting" aria-label="Richting"><option value="voor">is voorganger</option><option value="na">is opvolger</option></select>
        <select id="nrType" aria-label="Type"><option>FS</option><option>SS</option><option>FF</option><option>SF</option></select>
        <input id="nrVerschil" type="number" step="0.5" value="0" aria-label="Tijdsverschil" title="Tijdsverschil">
        <button id="nrToevoegen">Relatie toevoegen</button>
      </div>` : ''}
      <label class="veld">Notitie<textarea data-veld="notitie" rows="3">${NP.esc(a.notitie)}</textarea></label>
      <button id="btnVerwijderAct" class="gevaar">Activiteit verwijderen</button>`;
  }
  function paneelMeer() {
    return `<div class="paneelkop">${S.sel.size} activiteiten geselecteerd</div>
      <p class="klein">Gebruik de uitlijnbalk boven het canvas, of sleep ze samen.</p>
      <button id="btnVerwijderSel" class="gevaar">Selectie verwijderen</button>`;
  }
  function paneelProject() {
    const r = S.reken;
    return `<div class="paneelkop">Project</div>
      <label class="veld">Projectnaam<input data-project="naam" type="text" value="${NP.esc(S.p.naam)}"></label>
      <label class="veld">Tijdseenheid<input data-project="eenheid" type="text" value="${NP.esc(S.p.eenheid)}"></label>
      <label class="veld">Startdatum (nog alleen ter info)<input data-project="startdatum" type="date" value="${NP.esc(S.p.startdatum)}"></label>
      <p class="klein">${r.kringFout ? 'Rekenen gestopt: er zit een kring in het netwerk.' : `Projectduur: <strong>${NP.fmt(r.projectEinde)}</strong> ${NP.esc(S.p.eenheid || '')}`}</p>
      <p class="klein">Klik op een activiteit om haar te bewerken. Dubbelklik op een pijl om een relatie te bewerken.</p>`;
  }

  /* ---------- acties ---------- */
  function nieuweActiviteit(x, y) {
    bewaarStap();
    const id = NP.volgendId(S.p.activiteiten, 'A');
    if (x === undefined) {
      const r = svg.getBoundingClientRect();
      const c = schermNaarWereld(r.left + r.width / 2, r.top + r.height / 2);
      x = c.x - W / 2; y = c.y - H / 2;
      // niet precies op een bestaand blok
      while (S.p.activiteiten.some(a => Math.abs(a.x - x) < 30 && Math.abs(a.y - y) < 30)) { x += 40; y += 40; }
    }
    const a = { id, naam: 'Nieuwe activiteit', rol: '', duur: 1, notitie: '', x: snap(x), y: snap(y) };
    S.p.activiteiten.push(a);
    S.sel = new Set([id]); S.selRel = null;
    gewijzigd();
    setTimeout(() => { const i = document.querySelector('#inspecteur [data-veld=naam]'); if (i) { i.focus(); i.select(); } }, 0);
  }
  function snap(v) { return $('chkRaster').checked ? Math.round(v / RASTER) * RASTER : Math.round(v); }

  function verwijderSelectie() {
    if (S.selRel) {
      bewaarStap();
      S.p.relaties = S.p.relaties.filter(r => r.id !== S.selRel);
      S.selRel = null;
      gewijzigd();
      return;
    }
    if (!S.sel.size) return;
    bewaarStap();
    S.p.activiteiten = S.p.activiteiten.filter(a => !S.sel.has(a.id));
    S.p.relaties = S.p.relaties.filter(r => !S.sel.has(r.van) && !S.sel.has(r.naar));
    S.sel.clear();
    gewijzigd();
  }

  function maakRelatie(van, naar, type, verschil) {
    if (van === naar) return;
    const bestaand = S.p.relaties.find(r => r.van === van && r.naar === naar);
    if (bestaand) { toast('Er bestaat al een relatie tussen deze twee activiteiten. Dubbelklik op de pijl om hem aan te passen.'); S.selRel = bestaand.id; S.sel.clear(); teken(); return; }
    bewaarStap();
    const lus = NP.maaktKring(S.p, van, naar);
    const r = { id: NP.volgendId(S.p.relaties, 'R'), van, naar, type, verschil: verschil || 0, lus };
    S.p.relaties.push(r);
    if (lus) toast('Rework gedetecteerd: deze relatie gaat terug naar een eerdere activiteit en is als lus (stippellijn) aangegeven. Ze telt niet mee in de berekening.');
    gewijzigd();
  }

  function uitlijnen(soort) {
    const lijst = S.p.activiteiten.filter(a => S.sel.has(a.id));
    if (lijst.length < 2) return;
    bewaarStap();
    const minX = Math.min(...lijst.map(a => a.x)), maxX = Math.max(...lijst.map(a => a.x));
    const minY = Math.min(...lijst.map(a => a.y)), maxY = Math.max(...lijst.map(a => a.y));
    const mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    if (soort === 'links') lijst.forEach(a => a.x = minX);
    if (soort === 'rechts') lijst.forEach(a => a.x = maxX);
    if (soort === 'hmidden') lijst.forEach(a => a.x = snap(mx));
    if (soort === 'boven') lijst.forEach(a => a.y = minY);
    if (soort === 'onder') lijst.forEach(a => a.y = maxY);
    if (soort === 'vmidden') lijst.forEach(a => a.y = snap(my));
    if (soort === 'hverdelen') {
      lijst.sort((a, b) => a.x - b.x);
      const stap = (maxX - minX) / (lijst.length - 1);
      lijst.forEach((a, i) => a.x = Math.round(minX + i * stap));
    }
    if (soort === 'vverdelen') {
      lijst.sort((a, b) => a.y - b.y);
      const stap = (maxY - minY) / (lijst.length - 1);
      lijst.forEach((a, i) => a.y = Math.round(minY + i * stap));
    }
    gewijzigd();
  }

  /* Automatisch ordenen: kolom = plek in het netwerk, kritieke activiteiten bovenaan */
  function ordenen(alleenIds) {
    const p = S.p;
    const doel = alleenIds ? new Set(alleenIds) : new Set(p.activiteiten.map(a => a.id));
    const rels = p.relaties.filter(r => !r.lus);
    const kol = {};
    const inn = {}, graad = {};
    for (const a of p.activiteiten) { inn[a.id] = []; graad[a.id] = 0; kol[a.id] = 0; }
    for (const r of rels) { inn[r.naar].push(r.van); graad[r.naar]++; }
    const uit = {};
    for (const r of rels) (uit[r.van] = uit[r.van] || []).push(r.naar);
    const rij = p.activiteiten.filter(a => graad[a.id] === 0).map(a => a.id);
    const volgorde = [];
    while (rij.length) {
      const id = rij.shift(); volgorde.push(id);
      for (const n of uit[id] || []) { kol[n] = Math.max(kol[n], kol[id] + 1); if (--graad[n] === 0) rij.push(n); }
    }
    const reken = NP.bereken(p);
    const perKol = {};
    for (const id of volgorde) if (doel.has(id)) (perKol[kol[id]] = perKol[kol[id]] || []).push(id);
    const regel = {};
    const kolommen = Object.keys(perKol).map(Number).sort((a, b) => a - b);
    let basisX = 0, basisY = 0;
    if (alleenIds) {
      const vast = p.activiteiten.filter(a => !doel.has(a.id) && a.x !== null);
      if (vast.length) { basisX = Math.min(...vast.map(a => a.x)); basisY = Math.max(...vast.map(a => a.y)) + H + 120; }
    }
    for (const k of kolommen) {
      const ids = perKol[k];
      ids.sort((a, b) => {
        const ka = reken.per[a] && reken.per[a].kritiek ? 0 : 1, kb = reken.per[b] && reken.per[b].kritiek ? 0 : 1;
        if (ka !== kb) return ka - kb;
        const gem = id => { const v = inn[id].filter(x => regel[x] !== undefined); return v.length ? v.reduce((s, x) => s + regel[x], 0) / v.length : 0; };
        return gem(a) - gem(b);
      });
      const bezet = new Set();
      for (const id of ids) {
        let gewenst = Math.floor((() => { const v = inn[id].filter(x => regel[x] !== undefined); return v.length ? v.reduce((s, x) => s + regel[x], 0) / v.length : 0; })());
        while (bezet.has(gewenst)) gewenst++;
        bezet.add(gewenst);
        regel[id] = gewenst;
        const a = NP.getAct(p, id);
        a.x = basisX + k * (W + 80);
        a.y = basisY + gewenst * (H + 70);
      }
    }
  }

  /* ---------- bestanden ---------- */
  const heeftFsa = () => 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
  const XLSX_TYPE = { description: 'Excel-werkmap', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } };
  function controleerXlsx() {
    if (NP.xlsxBeschikbaar()) return true;
    toast('De Excel-bibliotheek is niet geladen (geen internet?). Zet xlsx.full.min.js in de map lib/ – zie README.');
    return false;
  }
  function veiligeNaam() { return (S.p.naam || 'netwerkplanning').replace(/[\\/:*?"<>|]+/g, '-').trim() + '.xlsx'; }

  async function opslaan(als) {
    if (!controleerXlsx()) return;
    const data = NP.naarXlsx(S.p);
    try {
      if (heeftFsa()) {
        if (als || !S.handle) {
          S.handle = await window.showSaveFilePicker({ suggestedName: S.bestandsnaam || veiligeNaam(), types: [XLSX_TYPE] });
        }
        const w = await S.handle.createWritable();
        await w.write(new Blob([data]));
        await w.close();
        S.bestandsnaam = S.handle.name;
      } else {
        const naam = S.bestandsnaam || veiligeNaam();
        const url = URL.createObjectURL(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const a = document.createElement('a');
        a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        S.bestandsnaam = naam;
      }
      S.vuil = false;
      autosave();
      teken();
      toast('Opgeslagen als ' + S.bestandsnaam);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.error(e);
      toast('Opslaan is mislukt: ' + (e && e.message ? e.message : e));
    }
  }

  async function openen() {
    if (!controleerXlsx()) return;
    if (S.vuil && !confirm('Er zijn niet opgeslagen wijzigingen. Toch een ander bestand openen?')) return;
    if (heeftFsa()) {
      try {
        const [h] = await window.showOpenFilePicker({ types: [XLSX_TYPE], multiple: false });
        const f = await h.getFile();
        await leesBestand(f, h);
      } catch (e) { if (e && e.name !== 'AbortError') toast('Openen is mislukt: ' + e.message); }
    } else {
      $('bestandInvoer').value = '';
      $('bestandInvoer').click();
    }
  }
  async function leesBestand(f, handle) {
    try {
      const buf = await f.arrayBuffer();
      const res = NP.vanXlsx(buf);
      laadProject(res.project, res.zonderPlek);
      S.handle = handle || null;
      S.bestandsnaam = f.name;
      S.vuil = false;
      autosave();
      teken();
      passend();
      const delen = [`<p>${NP.esc(f.name)} · ${res.project.activiteiten.length} activiteiten · ${res.project.relaties.length} relaties</p>`];
      if (res.zonderPlek.length && res.zonderPlek.length < res.project.activiteiten.length) delen.push(`<p>${res.zonderPlek.length} activiteit(en) zonder plek op het canvas zijn automatisch geplaatst: ${res.zonderPlek.map(NP.esc).join(', ')}.</p>`);
      if (res.zonderPlek.length && res.zonderPlek.length === res.project.activiteiten.length) delen.push('<p>Er was nog geen indeling: het netwerk is automatisch geordend.</p>');
      if (res.meldingen.length) delen.push('<ul>' + res.meldingen.map(m => `<li>${NP.esc(m)}</li>`).join('') + '</ul>');
      if (res.meldingen.length || res.zonderPlek.length) {
        $('meldTitel').textContent = 'Bestand ingelezen';
        $('meldTekst').innerHTML = delen.join('');
        $('dlgMelding').showModal();
      } else toast('Geopend: ' + f.name);
    } catch (e) {
      console.error(e);
      $('meldTitel').textContent = 'Openen is mislukt';
      $('meldTekst').innerHTML = `<p>${NP.esc(e.message || String(e))}</p><p class="klein">Controleer of het bestand de tabbladen Activiteiten en Relaties heeft.</p>`;
      $('dlgMelding').showModal();
    }
  }
  function laadProject(p, zonderPlek) {
    S.undo = []; S.redo = [];
    S.p = p;
    S.sel.clear(); S.selRel = null;
    if (zonderPlek && zonderPlek.length) {
      if (zonderPlek.length === p.activiteiten.length) ordenen();
      else ordenen(zonderPlek);
    }
  }

  function nieuwProject() {
    if (S.vuil && !confirm('Er zijn niet opgeslagen wijzigingen. Toch een nieuw project beginnen?')) return;
    laadProject(NP.nieuwProject());
    S.handle = null; S.bestandsnaam = null; S.vuil = false;
    S.view = { x: 80, y: 80, z: 1 };
    autosave(); zetView(); teken();
  }

  function voorbeeld() {
    const A = (id, naam, rol, duur, x, y) => ({ id, naam, rol, duur, notitie: '', x, y });
    const R = (id, van, naar, type, verschil, lus) => ({ id, van, naar, type, verschil, lus: !!lus });
    bewaarStap();
    S.p = {
      naam: 'Voorbeeld onderwijsprogramma', eenheid: 'werkdagen', startdatum: '',
      activiteiten: [
        A('A1', 'Aanleveren onderwijsgegevens door academie', 'Teamleider onderwijs', 0, 0, 0),
        A('A2', "Verwerken export in onderwijsprogramma's", 'Planner', 10, 320, 0),
        A('A3', 'Onderwijsprogramma controleren', 'Moduleverantwoordelijke', 5, 640, 0),
        A('A4', 'Verwerken van opmerkingen', 'Planner', 5, 960, 0),
        A('A5', 'Definitief opleveren', 'Teamleider', 0, 1280, 0),
        A('A6', 'Analyseren van onderwijs en faciliteiten', 'Planner', 5, 800, 260)
      ],
      relaties: [R('R1', 'A1', 'A2', 'FS', 0), R('R2', 'A2', 'A3', 'FS', 0), R('R3', 'A2', 'A6', 'FS', 0), R('R4', 'A3', 'A4', 'FS', 0), R('R5', 'A6', 'A4', 'FF', 2), R('R6', 'A4', 'A5', 'FS', 0)]
    };
    S.sel.clear(); S.selRel = null;
    gewijzigd();
    passend();
  }

  /* ---------- relatievenster ---------- */
  let dlgRelId = null;
  function openRelatie(id) {
    const r = S.p.relaties.find(x => x.id === id);
    if (!r) return;
    dlgRelId = id;
    const A = NP.getAct(S.p, r.van), B = NP.getAct(S.p, r.naar);
    $('relVan').textContent = `${A.id} · ${A.naam}`;
    $('relNaar').textContent = `${B.id} · ${B.naam}`;
    document.querySelectorAll('#relTypes input').forEach(i => { i.checked = i.value === r.type; });
    $('relVerschil').value = Number(r.verschil) || 0;
    $('relLus').checked = !!r.lus;
    $('relFout').hidden = true;
    document.querySelectorAll('#dlgRel .eenheid').forEach(e => e.textContent = S.p.eenheid || 'werkdagen');
    relUitleg();
    $('dlgRel').showModal();
  }
  function relUitleg() {
    const t = (document.querySelector('#relTypes input:checked') || {}).value || 'FS';
    const v = parseFloat($('relVerschil').value) || 0;
    const zin = { FS: ['starten', 'het einde'], SS: ['starten', 'de start'], FF: ['eindigen', 'het einde'], SF: ['eindigen', 'de start'] }[t];
    const tijd = v === 0 ? 'direct na' : v > 0 ? `${NP.fmt(v)} ${S.p.eenheid || 'werkdagen'} na` : `${NP.fmt(-v)} ${S.p.eenheid || 'werkdagen'} vóór`;
    $('relUitleg').textContent = `B mag op zijn vroegst ${zin[0]} ${tijd} ${zin[1]} van A.`;
  }
  function relOpslaan() {
    const r = S.p.relaties.find(x => x.id === dlgRelId);
    if (!r) return;
    const type = (document.querySelector('#relTypes input:checked') || {}).value || 'FS';
    const verschil = parseFloat($('relVerschil').value) || 0;
    const lus = $('relLus').checked;
    if (!lus && NP.maaktKring(S.p, r.van, r.naar, r.id)) {
      $('relFout').textContent = 'Zonder lus-markering sluit deze relatie een kring. Laat “Terugkoppeling (lus)” aan, of maak eerst een andere relatie in de kring een lus.';
      $('relFout').hidden = false;
      return;
    }
    bewaarStap();
    Object.assign(r, { type, verschil, lus });
    $('dlgRel').close();
    gewijzigd();
  }

  /* ---------- afdrukvenster ---------- */
  function printOpts() {
    return {
      papier: $('prPapier').value, richting: $('prRichting').value,
      schaal: (document.querySelector('input[name=prSchaal]:checked') || {}).value || 'leesbaar',
      pct: $('prPct').value, overlap: $('prOverlap').value,
      naden: $('prNaden').checked, overzicht: $('prOverzicht').checked, legenda: $('prLegenda').checked, zw: $('prZw').checked
    };
  }
  function printSamenvatting() {
    const o = printOpts();
    const s = NP.printSamenvatting(NP.printIndeling(S.p, o), o);
    $('prSamenvatting').innerHTML = s.tekst;
    $('prSamenvatting').classList.toggle('waarschuwing', s.waarschuwing);
  }

  /* ---------- muis en toetsen op het canvas ---------- */
  function knoopVan(el) { const g = el.closest && el.closest('.knoop'); return g ? g.dataset.id : null; }

  svg.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    doek.focus({ preventScroll: true });
    const w = schermNaarWereld(e.clientX, e.clientY);
    if (e.button === 1 || S.spatie) {
      e.preventDefault();
      S.modus = 'pannen'; S.m = { sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y };
      doek.classList.add('pannen', 'bezig');
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const poort = e.target.closest('.poort');
    if (poort) {
      S.modus = 'verbinden';
      S.m = { van: poort.dataset.id, poort: poort.dataset.poort };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const id = knoopVan(e.target);
    if (id) {
      S.selRel = null;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        if (S.sel.has(id)) S.sel.delete(id); else S.sel.add(id);
        teken();
        if (!S.sel.has(id)) return;
      } else if (!S.sel.has(id)) {
        S.sel = new Set([id]);
        teken();
      }
      S.modus = 'slepen';
      S.m = { start: w, leider: id, pos: new Map([...S.sel].map(x => { const a = NP.getAct(S.p, x); return [x, { x: a.x, y: a.y }]; })), snap: momentopname(), bewogen: false };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    const rel = e.target.closest('.rel');
    if (rel) {
      S.selRel = rel.dataset.rel; S.sel.clear();
      teken();
      return;
    }
    // lege plek: kader trekken
    if (!e.shiftKey) { S.sel.clear(); S.selRel = null; teken(); }
    S.modus = 'lasso';
    S.m = { sx: e.clientX, sy: e.clientY, basis: new Set(S.sel) };
    svg.setPointerCapture(e.pointerId);
  });

  svg.addEventListener('pointermove', e => {
    if (!S.modus) return;
    if (S.modus === 'pannen') {
      S.view.x = S.m.vx + (e.clientX - S.m.sx);
      S.view.y = S.m.vy + (e.clientY - S.m.sy);
      zetView();
    } else if (S.modus === 'slepen') {
      const w = schermNaarWereld(e.clientX, e.clientY);
      let dx = w.x - S.m.start.x, dy = w.y - S.m.start.y;
      if (!S.m.bewogen && Math.hypot(dx * S.view.z, dy * S.view.z) < 3) return;
      S.m.bewogen = true;
      const l = S.m.pos.get(S.m.leider);
      if ($('chkRaster').checked && !e.altKey) {
        dx = Math.round((l.x + dx) / RASTER) * RASTER - l.x;
        dy = Math.round((l.y + dy) / RASTER) * RASTER - l.y;
      }
      for (const [id, p0] of S.m.pos) { const a = NP.getAct(S.p, id); a.x = p0.x + dx; a.y = p0.y + dy; }
      $('laagRel').innerHTML = NP.tekenRelaties(S.p, { reken: S.reken, sel: S.sel, selRel: S.selRel, scherm: true });
      $('laagKnoop').innerHTML = NP.tekenKnopen(S.p, { reken: S.reken, sel: S.sel, selRel: S.selRel, scherm: true });
      tekenMinikaart();
    } else if (S.modus === 'verbinden') {
      const A = NP.getAct(S.p, S.m.van);
      const s = NP.poortPunt(A, S.m.poort);
      const w = schermNaarWereld(e.clientX, e.clientY);
      document.querySelectorAll('.poort.doel').forEach(x => x.classList.remove('doel'));
      const onder = document.elementFromPoint(e.clientX, e.clientY);
      const doelPoort = onder && onder.closest && onder.closest('.poort');
      const doelId = doelPoort ? doelPoort.dataset.id : (onder ? knoopVan(onder) : null);
      const geldig = doelId && doelId !== S.m.van;
      const lus = geldig && NP.maaktKring(S.p, S.m.van, doelId);
      if (doelPoort && geldig) doelPoort.classList.add('doel');
      const kleur = lus ? '#7C3AED' : '#1D4ED8';
      const z = S.view.z;
      let t = `<path d="M${s.x} ${s.y} L${w.x} ${w.y}" stroke="${kleur}" stroke-width="${2 / z}" stroke-dasharray="${6 / z} ${4 / z}" fill="none" marker-end="url(#${lus ? 'pijl-l' : 'pijl-s'})"/>`;
      if (lus) {
        const tekst = '↺ lus: rework, telt niet mee';
        t += `<g transform="translate(${w.x + 14 / z} ${w.y - 14 / z}) scale(${1 / z})"><rect x="0" y="-15" width="176" height="22" rx="5" fill="#F3EEFF" stroke="#7C3AED"/><text x="8" y="0" font-size="12" font-weight="600" fill="#6D28D9" font-family='${NP.FONT}'>${tekst}</text></g>`;
      }
      $('laagTijdelijk').innerHTML = t;
    } else if (S.modus === 'lasso') {
      const r = doek.getBoundingClientRect();
      const x1 = Math.min(S.m.sx, e.clientX), y1 = Math.min(S.m.sy, e.clientY);
      const x2 = Math.max(S.m.sx, e.clientX), y2 = Math.max(S.m.sy, e.clientY);
      const l = $('lasso');
      l.hidden = false;
      Object.assign(l.style, { left: x1 - r.left + 'px', top: y1 - r.top + 'px', width: x2 - x1 + 'px', height: y2 - y1 + 'px' });
      const a = schermNaarWereld(x1, y1), b = schermNaarWereld(x2, y2);
      const nieuw = new Set(S.m.basis);
      for (const act of S.p.activiteiten) if (act.x < b.x && act.x + W > a.x && act.y < b.y && act.y + H > a.y) nieuw.add(act.id);
      S.sel = nieuw;
      $('laagKnoop').innerHTML = NP.tekenKnopen(S.p, { reken: S.reken, sel: S.sel, scherm: true });
    }
  });

  function eindeMuis(e) {
    if (!S.modus) return;
    const modus = S.modus, m = S.m;
    S.modus = null; S.m = null;
    doek.classList.remove('bezig');
    if (!S.spatie) doek.classList.remove('pannen');
    if (modus === 'slepen') {
      if (m.bewogen) { bewaarStap(m.snap); gewijzigd(); }
    } else if (modus === 'verbinden') {
      $('laagTijdelijk').innerHTML = '';
      document.querySelectorAll('.poort.doel').forEach(x => x.classList.remove('doel'));
      if (e && e.type === 'pointerup') {
        const onder = document.elementFromPoint(e.clientX, e.clientY);
        const doelPoort = onder && onder.closest && onder.closest('.poort');
        let naar = null, naarPoort = 'start';
        if (doelPoort) { naar = doelPoort.dataset.id; naarPoort = doelPoort.dataset.poort; }
        else if (onder) naar = knoopVan(onder);
        if (naar && naar !== m.van) maakRelatie(m.van, naar, NP.typeUitPoorten(m.poort, naarPoort), 0);
      }
    } else if (modus === 'lasso') {
      $('lasso').hidden = true;
      teken();
    }
  }
  svg.addEventListener('pointerup', eindeMuis);
  svg.addEventListener('pointercancel', eindeMuis);

  svg.addEventListener('dblclick', e => {
    const id = knoopVan(e.target);
    if (id) {
      S.sel = new Set([id]); teken();
      const i = document.querySelector('#inspecteur [data-veld=naam]');
      if (i) { i.focus(); i.select(); }
      return;
    }
    const rel = e.target.closest('.rel');
    if (rel) { openRelatie(rel.dataset.rel); return; }
    const w = schermNaarWereld(e.clientX, e.clientY);
    nieuweActiviteit(w.x - W / 2, w.y - H / 2);
  });

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomOm(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    } else {
      const f = e.deltaMode === 1 ? 16 : 1;
      if (e.shiftKey && !e.deltaX) S.view.x -= e.deltaY * f;
      else { S.view.x -= e.deltaX * f; S.view.y -= e.deltaY * f; }
      zetView();
    }
  }, { passive: false });
  svg.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

  function inInvoer(e) { const t = e.target; return t && (t.matches('input, textarea, select') || t.isContentEditable); }
  window.addEventListener('keydown', e => {
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && k === 's') { e.preventDefault(); opslaan(e.shiftKey); return; }
    if (ctrl && k === 'o') { e.preventDefault(); openen(); return; }
    if (ctrl && k === 'p') { e.preventDefault(); openPrint(); return; }
    if (document.querySelector('dialog[open]')) return;
    if (inInvoer(e)) return;
    if (ctrl && k === 'z') { e.preventDefault(); if (e.shiftKey) opnieuw(); else ongedaan(); return; }
    if (ctrl && k === 'y') { e.preventDefault(); opnieuw(); return; }
    if (ctrl && k === 'a') { e.preventDefault(); S.sel = new Set(S.p.activiteiten.map(a => a.id)); teken(); return; }
    if (e.key === ' ') { e.preventDefault(); if (!S.spatie) { S.spatie = true; doek.classList.add('pannen'); } return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); verwijderSelectie(); return; }
    if (e.key === 'Escape') { S.sel.clear(); S.selRel = null; teken(); return; }
    if (k === 'f' && !ctrl) { passend(); return; }
    if (k === 'n' && !ctrl) { nieuweActiviteit(); return; }
    if (e.key.startsWith('Arrow') && S.sel.size) {
      e.preventDefault();
      const st = RASTER * (e.shiftKey ? 5 : 1);
      const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      bewaarStap();
      for (const id of S.sel) { const a = NP.getAct(S.p, id); a.x += d[0]; a.y += d[1]; }
      gewijzigd();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.key === ' ') { S.spatie = false; if (S.modus !== 'pannen') doek.classList.remove('pannen'); }
  });
  window.addEventListener('blur', () => { S.spatie = false; doek.classList.remove('pannen'); });

  /* ---------- panelen ---------- */
  $('lijst').addEventListener('click', e => {
    const b = e.target.closest('.lijstrij');
    if (!b) return;
    S.sel = new Set([b.dataset.id]); S.selRel = null;
    inBeeld(b.dataset.id);
    teken();
  });
  $('zoek').addEventListener('input', e => { S.zoek = e.target.value; tekenLijst(); });

  const insp = $('inspecteur');
  let focusSnap = null;
  insp.addEventListener('focusin', e => { if (e.target.matches('[data-veld],[data-project]')) focusSnap = momentopname(); });
  insp.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.veld && S.sel.size === 1) {
      const a = NP.getAct(S.p, [...S.sel][0]);
      if (t.dataset.veld === 'duur') { const v = parseFloat(t.value); a.duur = isNaN(v) || v < 0 ? 0 : v; }
      else a[t.dataset.veld] = t.value;
      S.vuil = true; autosave(); teken();
    } else if (t.dataset.project) {
      S.p[t.dataset.project] = t.value;
      S.vuil = true; autosave(); teken();
    }
  });
  insp.addEventListener('focusout', e => {
    if (focusSnap && focusSnap !== momentopname()) { bewaarStap(focusSnap); }
    focusSnap = null;
    setTimeout(() => { if (!insp.contains(document.activeElement)) teken(); }, 0);
  });
  insp.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.relopen) { openRelatie(t.dataset.relopen); return; }
    if (t.id === 'btnVerwijderAct' || t.id === 'btnVerwijderSel') { S.selRel = null; verwijderSelectie(); return; }
    if (t.id === 'nrToevoegen') {
      const id = [...S.sel][0], ander = $('nrAndere').value;
      const voor = $('nrRichting').value === 'voor';
      maakRelatie(voor ? ander : id, voor ? id : ander, $('nrType').value, parseFloat($('nrVerschil').value) || 0);
    }
  });

  $('projectNaam').addEventListener('focus', () => { focusSnap = momentopname(); });
  $('projectNaam').addEventListener('input', e => { S.p.naam = e.target.value; S.vuil = true; autosave(); tekenStatus(); });
  $('projectNaam').addEventListener('change', () => { if (focusSnap) bewaarStap(focusSnap); focusSnap = null; teken(); });

  $('uitlijnbalk').addEventListener('click', e => { const b = e.target.closest('button'); if (b) uitlijnen(b.dataset.align); });
  $('minikaart').addEventListener('click', e => {
    const vb = JSON.parse($('miniSvg').dataset.vb || 'null');
    if (!vb) return;
    const r = $('minikaart').getBoundingClientRect();
    const sch = Math.max(vb.w / r.width, vb.h / r.height);
    const ox = (r.width - vb.w / sch) / 2, oy = (r.height - vb.h / sch) / 2;
    const wx = vb.x + (e.clientX - r.left - ox) * sch, wy = vb.y + (e.clientY - r.top - oy) * sch;
    const sr = svg.getBoundingClientRect();
    S.view.x = sr.width / 2 - wx * S.view.z;
    S.view.y = sr.height / 2 - wy * S.view.z;
    zetView();
  });

  /* ---------- knoppen ---------- */
  $('btnNieuw').onclick = nieuwProject;
  $('btnOpen').onclick = openen;
  $('btnOpslaan').onclick = () => opslaan(false);
  $('btnOpslaanAls').onclick = () => opslaan(true);
  $('btnPrint').onclick = () => openPrint();
  $('btnNieuweAct').onclick = () => nieuweActiviteit();
  $('btnNieuweAct2').onclick = () => nieuweActiviteit();
  $('btnOrdenen').onclick = () => { if (!S.p.activiteiten.length) return; bewaarStap(); ordenen(); gewijzigd(); passend(); };
  $('btnPassend').onclick = passend;
  $('btnUndo').onclick = ongedaan;
  $('btnRedo').onclick = opnieuw;
  $('btnIn').onclick = () => zoomOm(1.2);
  $('btnUit').onclick = () => zoomOm(1 / 1.2);
  $('btnVoorbeeld').onclick = voorbeeld;
  $('chkKritiek').onchange = teken;
  $('btnHelp').onclick = () => { $('helpInhoud').innerHTML = NP.helpHtml(); $('dlgHelp').showModal(); };
  $('bestandInvoer').onchange = e => { const f = e.target.files[0]; if (f) leesBestand(f, null); };

  document.querySelectorAll('#relTypes input').forEach(i => i.addEventListener('change', relUitleg));
  $('relVerschil').addEventListener('input', relUitleg);
  $('relOk').onclick = relOpslaan;
  $('relWeg').onclick = () => { bewaarStap(); S.p.relaties = S.p.relaties.filter(r => r.id !== dlgRelId); S.selRel = null; $('dlgRel').close(); gewijzigd(); };
  $('formRel').addEventListener('submit', e => { if (e.submitter && e.submitter.value === 'annuleren') return; e.preventDefault(); relOpslaan(); });

  function openPrint() {
    if (!S.p.activiteiten.length) { toast('Er staat nog niets op het canvas om af te drukken.'); return; }
    printSamenvatting();
    $('dlgPrint').showModal();
  }
  $('dlgPrint').addEventListener('input', printSamenvatting);
  $('dlgPrint').addEventListener('change', printSamenvatting);
  $('prGo').onclick = () => { const o = printOpts(); $('dlgPrint').close(); NP.afdrukken(S.p, NP.bereken(S.p), o); };

  let toastTimer = null;
  function toast(t) {
    const el = $('toast');
    el.textContent = t; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
  }

  window.addEventListener('beforeunload', e => { if (S.vuil) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('resize', () => tekenMinikaart());

  /* ---------- start ---------- */
  $('versieLabel').textContent = 'v' + NP.VERSIE;
  try {
    const opgeslagen = JSON.parse(localStorage.getItem(OPSLAG_SLEUTEL) || 'null');
    if (opgeslagen && opgeslagen.p && opgeslagen.p.activiteiten) {
      S.p = opgeslagen.p;
      S.bestandsnaam = opgeslagen.bestandsnaam || null;
      S.vuil = !!opgeslagen.vuil;
      if (S.p.activiteiten.length) setTimeout(() => toast('Je laatste werk is hersteld (tussentijds bewaard in deze browser).'), 300);
    }
  } catch (e) { /* niets */ }
  teken();
  zetView();
  if (S.p.activiteiten.length) requestAnimationFrame(passend);
})();
