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
    S.p = NP.normaliseer(JSON.parse(S.undo.pop()));
    opschonenSelectie();
    gewijzigd();
  }
  function opnieuw() {
    if (!S.redo.length) return;
    S.undo.push(momentopname());
    S.p = NP.normaliseer(JSON.parse(S.redo.pop()));
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
      try { localStorage.setItem(OPSLAG_SLEUTEL, JSON.stringify({ p: S.p, versie: NP.VERSIE, bestandsnaam: S.bestandsnaam, vuil: S.vuil, tijd: Date.now() })); } catch (e) { /* opslag niet beschikbaar */ }
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
    const m = NP.maat(a);
    S.view.x = r.width / 2 - (a.x + m.w / 2) * S.view.z;
    S.view.y = r.height / 2 - (a.y + m.h / 2) * S.view.z;
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
    tekenPaginaLaag();
    $('leeg').hidden = S.p.activiteiten.length > 0;
    $('uitlijnbalk').hidden = S.sel.size < 2;
    if (document.activeElement !== $('projectNaam')) $('projectNaam').value = S.p.naam || '';
    $('docInfo').textContent = [S.p.docVersie ? 'versie ' + S.p.docVersie : '', S.p.status || ''].filter(Boolean).join(' · ');
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
      rij.push(`<button class="lijstrij${S.sel.has(a.id) ? ' sel' : ''}" data-id="${NP.esc(a.id)}"><span class="id">${NP.esc(a.id)}</span><span title="${NP.esc(a.naam)}">${NP.isGebeurtenis(a) ? '◯ ' : ''}${NP.esc(a.naam || '(naamloos)')}</span><span>${NP.isGebeurtenis(a) ? '–' : NP.fmt(Number(a.duur))}</span><span class="${c && c.kritiek ? 'krit' : ''}">${c ? NP.fmt(c.ts) : ''}</span></button>`);
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
      `<span><strong>Activiteiten:</strong> ${S.p.activiteiten.filter(a => !NP.isGebeurtenis(a)).length}</span>` +
      `<span><strong>Gebeurtenissen:</strong> ${S.p.activiteiten.filter(a => NP.isGebeurtenis(a)).length}</span>` +
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
      const m = NP.maat(a);
      if (NP.isGebeurtenis(a)) s += `<circle cx="${a.x + m.w / 2}" cy="${a.y + m.h / 2}" r="${m.w / 2}" fill="${c && c.kritiek ? '#F4B8B0' : '#9FE1CB'}" stroke="#0F6E56" stroke-width="${lw}"/>`;
      else s += `<rect x="${a.x}" y="${a.y}" width="${m.w}" height="${m.h}" fill="${c && c.kritiek ? '#F4B8B0' : '#C9D3E3'}" stroke="#6B6B66" stroke-width="${lw}"/>`;
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
      if (vak && S.sel.size === 1) { const id = [...S.sel][0]; vak.outerHTML = NP.isGebeurtenis(NP.getAct(S.p, id)) ? rekenvakGeb(id) : rekenvak(id); }
      return;
    }
    if (S.selRel && S.p.relaties.find(r => r.id === S.selRel)) { el.innerHTML = paneelRelatie(S.selRel); return; }
    if (S.sel.size === 1) { const id = [...S.sel][0]; el.innerHTML = NP.isGebeurtenis(NP.getAct(S.p, id)) ? paneelGebeurtenis(id) : paneelActiviteit(id); }
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
    let lab = `${r.type}${v ? (v > 0 ? ' +' : ' −') + NP.fmt(Math.abs(v)) : ' +0'}`;
    if (NP.isTriggerRelatie(S.p, r)) lab = (r.aangrijp === 'einde' ? 'trigger einde' : r.aangrijp === 'tijdens' ? 'trigger na ' + NP.fmt(Number(r.na) || 0) + (r.naEenheid === '%' ? '%' : ' d') : 'trigger begin') + (v ? (v > 0 ? ' +' : ' −') + NP.fmt(Math.abs(v)) : '');
    if (r.lus) lab += ' ↺';
    return `<button class="relrij${r.lus ? ' lus' : ''}" data-relopen="${NP.esc(r.id)}" title="${richting}: klik om te bewerken"><span>${NP.esc(b ? b.naam || b.id : andereId)}</span><b>${lab}</b></button>`;
  }
  function paneelActiviteit(id) {
    const a = NP.getAct(S.p, id);
    const voor = S.p.relaties.filter(r => r.naar === id);
    const na = S.p.relaties.filter(r => r.van === id);
    const opties = S.p.activiteiten.filter(x => x.id !== id).map(x => `<option value="${NP.esc(x.id)}">${NP.esc(x.id + ' · ' + (x.naam || ''))}</option>`).join('');
    return `<div class="paneelkop">Activiteit ${NP.esc(a.id)}</div>
      <label class="veld">Soort<select data-veld="soort">${NP.SOORTEN.map(x => `<option value="${x}"${a.soort === x ? ' selected' : ''}>${NP.SOORT_NAMEN[x]}</option>`).join('')}</select></label>
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
  function rekenvakGeb(id) {
    const c = S.reken.kringFout ? null : S.reken.per[id];
    const a = NP.getAct(S.p, id);
    const v = x => c ? NP.fmt(x) : '–';
    if (a.soort === 'eind') return `<div class="rekenvak"><div>Moment<b>${v(c && c.vs)}</b></div></div>`;
    return `<div class="rekenvak">
      <div>Vroegst<b>${v(c && c.vs)}</b></div><div title="Laatste moment zonder dat het project uitloopt">Uiterlijk<b>${v(c && c.ls)}</b></div><div class="${c && c.kritiek ? 'krit' : ''}">Speling<b>${v(c && c.ts)}</b></div></div>`;
  }
  function paneelGebeurtenis(id) {
    const a = NP.getAct(S.p, id);
    const voor = S.p.relaties.filter(r => r.naar === id);
    const na = S.p.relaties.filter(r => r.van === id);
    const opties = S.p.activiteiten.filter(x => x.id !== id).map(x => `<option value="${NP.esc(x.id)}">${NP.esc(x.id + ' · ' + (x.naam || ''))}</option>`).join('');
    const c = S.reken.kringFout ? null : S.reken.per[id];
    let uitleg = '';
    if (c && a.soort !== 'eind') uitleg = c.kritiek
      ? 'Deze gebeurtenis is <strong>bepalend</strong>: komt ze later, dan loopt het project uit.'
      : `Deze gebeurtenis mag tot uiterlijk dag <strong>${NP.fmt(c.ls)}</strong> plaatsvinden zonder dat het project uitloopt.`;
    return `<div class="paneelkop">Gebeurtenis ${NP.esc(a.id)}</div>
      ${soortSelect(a)}
      <label class="veld">Naam<input data-veld="naam" type="text" value="${NP.esc(a.naam)}"></label>
      ${a.soort !== 'eind' ? `<label class="veld">Niet vóór (dag, leeg = geen)<input data-veld="nietVoor" type="number" min="0" step="0.5" value="${a.nietVoor === null || a.nietVoor === undefined ? '' : NP.esc(a.nietVoor)}"></label>` : ''}
      ${rekenvakGeb(id)}
      ${uitleg ? `<p class="klein">${uitleg}</p>` : ''}
      ${a.soort !== 'start' ? `<h3>Komt na</h3>${voor.map(r => relRij(r, r.van, 'Voorganger')).join('') || '<p class="klein">Niets.</p>'}` : ''}
      ${a.soort !== 'eind' ? `<h3>Triggert</h3>${na.map(r => relRij(r, r.naar, 'Trigger')).join('') || '<p class="klein">Nog niets. Sleep van het rechter rondje naar een activiteit: links op het blok = begin, in het midden = tijdens, rechts = einde.</p>'}` : ''}
      ${opties && a.soort !== 'eind' ? `<div class="relform">
        <select class="heel" id="trAndere" aria-label="Activiteit">${opties}</select>
        <select id="trAangrijp" aria-label="Aangrijpingspunt"><option value="begin">aan het begin</option><option value="tijdens">tijdens</option><option value="einde">aan het einde</option></select>
        <input id="trNa" type="number" min="0" step="0.5" value="0" aria-label="Na (dagen)" title="Bij 'tijdens': na hoeveel dagen">
        <button id="trToevoegen" class="heel">Trigger toevoegen</button>
      </div>` : ''}
      <label class="veld">Notitie<textarea data-veld="notitie" rows="3">${NP.esc(a.notitie)}</textarea></label>
      <button id="btnVerwijderAct" class="gevaar">Gebeurtenis verwijderen</button>`;
  }
  function soortSelect(a) {
    return `<label class="veld">Soort<select data-veld="soort">${NP.SOORTEN.map(x => `<option value="${x}"${a.soort === x ? ' selected' : ''}>${NP.SOORT_NAMEN[x]}</option>`).join('')}</select></label>`;
  }
  function paneelRelatie(id) {
    const r = S.p.relaties.find(x => x.id === id);
    const A = NP.getAct(S.p, r.van), B = NP.getAct(S.p, r.naar);
    const trig = NP.isTriggerRelatie(S.p, r);
    const eh = NP.esc(S.p.eenheid || 'werkdagen');
    const opt = (v, t, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`;
    return `<div class="paneelkop">Relatie ${NP.esc(r.id)}</div>
      <p class="klein">Van (A)<br><strong>${NP.esc(A.id + ' · ' + (A.naam || ''))}</strong></p>
      <p class="klein">Naar (B)<br><strong>${NP.esc(B.id + ' · ' + (B.naam || ''))}</strong></p>
      ${trig ? `<label class="veld">Aangrijpingspunt<select data-relveld="aangrijp">${opt('begin', 'aan het begin', r.aangrijp)}${opt('tijdens', 'tijdens', r.aangrijp)}${opt('einde', 'aan het einde', r.aangrijp)}</select></label>
        ${r.aangrijp === 'tijdens' ? `<div class="twee"><label class="veld">Na<input data-relveld="na" type="number" min="0" step="0.5" value="${NP.esc(r.na)}"></label><label class="veld">Eenheid<select data-relveld="naEenheid">${opt('dagen', 'dagen', r.naEenheid)}${opt('%', '%', r.naEenheid)}</select></label></div>` : ''}`
        : NP.isGebeurtenis(B) ? '' : `<label class="veld">Type<select data-relveld="type">${NP.TYPES.map(t => opt(t, t + ' · ' + NP.TYPE_NAMEN[t], r.type)).join('')}</select></label>`}
      <label class="veld"><span>Vertraging / tijdsverschil (${eh})</span><input data-relveld="verschil" type="number" step="0.5" value="${NP.esc(Number(r.verschil) || 0)}"></label>
      <p class="klein">Positief = vertraging (wachttijd) · negatief = overlap.</p>
      <label class="check lus"><input type="checkbox" data-relveld="lus"${r.lus ? ' checked' : ''}> <span><strong>Lus</strong>: stippellijn, telt niet mee</span></label>
      ${r.lus ? '<p class="klein">Deze relatie telt niet mee in de berekening.</p>' : ''}
      <div class="knoppenrij"><button data-relopen="${NP.esc(r.id)}">Venster openen</button><button id="btnVerwijderRel" class="gevaar">Relatie verwijderen</button></div>`;
  }
  function paneelMeer() {
    return `<div class="paneelkop">${S.sel.size} activiteiten geselecteerd</div>
      <p class="klein">Gebruik de uitlijnbalk boven het canvas, of sleep ze samen.</p>
      <button id="btnVerwijderSel" class="gevaar">Selectie verwijderen</button>`;
  }
  const STATUSSEN = ['Concept', 'Ter review', 'Voorlopig', 'Definitief', 'Gewijzigd'];
  function statusOpties(huidig) {
    const lijst = STATUSSEN.slice();
    if (huidig && !lijst.includes(huidig)) lijst.push(huidig); // eigen status uit een ouder bestand blijft kiesbaar
    return (huidig ? '' : '<option value="" selected>(geen)</option>') + lijst.map(s => `<option value="${NP.esc(s)}"${s === huidig ? ' selected' : ''}>${NP.esc(s)}</option>`).join('');
  }
  function paneelProject() {
    const r = S.reken;
    return `<div class="paneelkop">Project</div>
      <label class="veld">Projectnaam<input data-project="naam" type="text" value="${NP.esc(S.p.naam)}"></label>
      <label class="veld">Tijdseenheid<input data-project="eenheid" type="text" value="${NP.esc(S.p.eenheid)}"></label>
      <label class="veld">Documentdatum<input data-project="docDatum" type="date" value="${NP.esc(S.p.docDatum)}"></label>
      <div class="twee">
        <label class="veld">Versie<input data-project="docVersie" type="text" value="${NP.esc(S.p.docVersie)}" placeholder="bijv. 1.0"></label>
        <label class="veld">Status<select data-project="status">${statusOpties(S.p.status)}</select></label>
      </div>
      <label class="check"><input type="checkbox" id="chkPaginaRaster"${printInstellingen().raster ? ' checked' : ''}> Paginaraster op het canvas tonen</label>
      <p class="klein">${r.kringFout ? 'Rekenen gestopt: er zit een kring in het netwerk.' : `Projectduur: <strong>${NP.fmt(r.projectEinde)}</strong> ${NP.esc(S.p.eenheid || '')}`}</p>
      <p class="klein">Klik op een activiteit om haar te bewerken. Dubbelklik op een pijl om een relatie te bewerken.</p>`;
  }

  /* ---------- acties ---------- */
  function nieuweKnoop(soort, x, y) {
    bewaarStap();
    const geb = soort !== 'activiteit';
    const id = NP.volgendId(S.p.activiteiten, geb ? 'G' : 'A');
    const m = geb ? NP.GEBEURTENIS : { W, H };
    if (x === undefined) {
      const r = svg.getBoundingClientRect();
      const c = schermNaarWereld(r.left + r.width / 2, r.top + r.height / 2);
      x = c.x - m.W / 2; y = c.y - m.H / 2;
      while (S.p.activiteiten.some(a => Math.abs(a.x - x) < 30 && Math.abs(a.y - y) < 30)) { x += 40; y += 40; }
    }
    const a = geb
      ? { id, soort, naam: 'Nieuwe gebeurtenis', rol: '', duur: 0, nietVoor: null, notitie: '', x: snap(x), y: snap(y) }
      : { id, soort: 'activiteit', naam: 'Nieuwe activiteit', rol: '', duur: 1, nietVoor: null, notitie: '', x: snap(x), y: snap(y) };
    S.p.activiteiten.push(a);
    S.sel = new Set([id]); S.selRel = null;
    gewijzigd();
    openAct(id, true);
  }
  const nieuweActiviteit = (x, y) => nieuweKnoop('activiteit', x, y);
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

  function maakRelatie(van, naar, type, verschil, extra) {
    if (van === naar) return;
    const bestaand = S.p.relaties.find(r => r.van === van && r.naar === naar);
    if (bestaand) { toast('Er bestaat al een relatie tussen deze twee activiteiten. Dubbelklik op de pijl om hem aan te passen.'); S.selRel = bestaand.id; S.sel.clear(); teken(); return; }
    bewaarStap();
    const lus = NP.maaktKring(S.p, van, naar);
    const r = Object.assign({ id: NP.volgendId(S.p.relaties, 'R'), van, naar, type, verschil: verschil || 0, lus, aangrijp: 'begin', na: 0, naEenheid: 'dagen' }, extra || {});
    // gebeurtenis netjes op één lijn zetten met de activiteit als het de eerste relatie is
    const A = NP.getAct(S.p, van), B = NP.getAct(S.p, naar);
    if (B && B.soort === 'eind' && !S.p.relaties.some(x => x.naar === naar)) B.y = A.y;
    if (A && A.soort === 'start' && !S.p.relaties.some(x => x.van === van) && r.aangrijp !== 'tijdens') A.y = B.y;
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
        a.x = basisX + k * (W + 80) + (NP.isGebeurtenis(a) ? (W - NP.GEBEURTENIS.W) / 2 : 0);
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
    S.p = NP.normaliseer(p);
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
    const A = (id, naam, rol, duur, x, y) => ({ id, soort: 'activiteit', naam, rol, duur, nietVoor: null, notitie: '', x, y });
    const R = (id, van, naar, type, verschil, lus) => ({ id, van, naar, type, verschil, lus: !!lus, aangrijp: 'begin', na: 0, naEenheid: 'dagen' });
    bewaarStap();
    S.p = {
      naam: 'Voorbeeld onderwijsprogramma', eenheid: 'werkdagen', docDatum: new Date().toISOString().slice(0, 10), docVersie: '0.1', status: 'Concept',
      activiteiten: [
        A('A1', 'Aanleveren onderwijsgegevens door academie', 'Teamleider onderwijs', 0, 0, 0),
        A('A2', "Verwerken export in onderwijsprogramma's", 'Planner', 10, 320, 0),
        A('A3', 'Onderwijsprogramma controleren', 'Moduleverantwoordelijke', 5, 640, 0),
        A('A4', 'Verwerken van opmerkingen', 'Planner', 5, 960, 0),
        A('A5', 'Definitief opleveren', 'Teamleider', 0, 1280, 0),
        A('A6', 'Analyseren van onderwijs en faciliteiten', 'Planner', 5, 800, 360),
        { id: 'G1', soort: 'tussen', naam: 'Besluit CvB over faciliteiten', rol: '', duur: 0, nietVoor: 8, notitie: '', x: 760, y: 150 }
      ],
      relaties: [R('R1', 'A1', 'A2', 'FS', 0), R('R2', 'A2', 'A3', 'FS', 0), R('R3', 'A2', 'A6', 'FS', 0), R('R4', 'A3', 'A4', 'FS', 0), R('R5', 'A6', 'A4', 'FF', 2), R('R6', 'A4', 'A5', 'FS', 0), Object.assign(R('R7', 'G1', 'A6', 'FS', 0), { aangrijp: 'tijdens', na: 2 })]
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
    const trig = NP.isTriggerRelatie(S.p, r);
    $('relVan').textContent = `${A.id} · ${A.naam}`;
    $('relNaar').textContent = `${B.id} · ${B.naam}`;
    $('relTypeBlok').hidden = trig || NP.isGebeurtenis(B);
    $('relTriggerBlok').hidden = !trig;
    document.querySelectorAll('#relTypes input').forEach(i => { i.checked = i.value === r.type; });
    document.querySelectorAll('#relAangrijp input').forEach(i => { i.checked = i.value === (r.aangrijp || 'begin'); });
    $('relNa').value = Number(r.na) || 0;
    $('relNaEenheid').value = r.naEenheid === '%' ? '%' : 'dagen';
    $('relVerschil').value = Number(r.verschil) || 0;
    $('relLus').checked = !!r.lus;
    $('relFout').hidden = true;
    document.querySelectorAll('#dlgRel .eenheid').forEach(e => e.textContent = S.p.eenheid || 'werkdagen');
    relUitleg();
    $('dlgRel').showModal();
    setTimeout(() => { if ($('dlgRel').open) { $('relVerschil').focus(); $('relVerschil').select(); } }, 30);
  }
  function relUitleg() {
    const r = S.p.relaties.find(x => x.id === dlgRelId);
    const eh = S.p.eenheid || 'werkdagen';
    const v = parseFloat($('relVerschil').value) || 0;
    if (r && NP.isTriggerRelatie(S.p, r)) {
      const ag = (document.querySelector('#relAangrijp input:checked') || {}).value || 'begin';
      $('relNaBlok').hidden = ag !== 'tijdens';
      const B = NP.getAct(S.p, r.naar);
      const n = parseFloat($('relNa').value) || 0;
      const naam = B.naam || B.id;
      const tijd = v === 0 ? 'op het moment van de gebeurtenis' : v > 0 ? `${NP.fmt(v)} ${eh} na de gebeurtenis` : `${NP.fmt(-v)} ${eh} vóór de gebeurtenis`;
      const pnt = $('relNaEenheid').value === '%' ? `${NP.fmt(n)}% van de doorlooptijd` : `${NP.fmt(n)} ${eh}`;
      $('relUitleg').textContent = ag === 'begin' ? `${naam} mag op zijn vroegst starten ${tijd}.`
        : ag === 'einde' ? `${naam} mag op zijn vroegst eindigen ${tijd}.`
        : `${naam} heeft de gebeurtenis nodig na ${pnt} werk. De activiteit mag dus eerder starten, maar dat punt ligt op zijn vroegst ${tijd}.`;
      return;
    }
    const B = r ? NP.getAct(S.p, r.naar) : null;
    if (B && NP.isGebeurtenis(B)) { $('relUitleg').textContent = 'De gebeurtenis vindt op zijn vroegst plaats als A klaar is' + (v ? ` (${v > 0 ? '+' : '−'}${NP.fmt(Math.abs(v))} ${eh})` : '') + '.'; return; }
    const t = (document.querySelector('#relTypes input:checked') || {}).value || 'FS';
    const zin = { FS: ['starten', 'het einde'], SS: ['starten', 'de start'], FF: ['eindigen', 'het einde'], SF: ['eindigen', 'de start'] }[t];
    const tijd = v === 0 ? 'direct na' : v > 0 ? `${NP.fmt(v)} ${eh} na` : `${NP.fmt(-v)} ${eh} vóór`;
    $('relUitleg').textContent = `B mag op zijn vroegst ${zin[0]} ${tijd} ${zin[1]} van A.`;
  }
  function relOpslaan() {
    const r = S.p.relaties.find(x => x.id === dlgRelId);
    if (!r) return;
    const type = (document.querySelector('#relTypes input:checked') || {}).value || 'FS';
    const aangrijp = (document.querySelector('#relAangrijp input:checked') || {}).value || 'begin';
    const verschil = parseFloat($('relVerschil').value) || 0;
    const na = Math.max(0, parseFloat($('relNa').value) || 0);
    const naEenheid = $('relNaEenheid').value === '%' ? '%' : 'dagen';
    const lus = $('relLus').checked;
    if (!lus && NP.maaktKring(S.p, r.van, r.naar, r.id)) {
      $('relFout').textContent = 'Zonder lus-markering sluit deze relatie een kring. Laat “Terugkoppeling (lus)” aan, of maak eerst een andere relatie in de kring een lus.';
      $('relFout').hidden = false;
      return;
    }
    bewaarStap();
    Object.assign(r, { type, verschil, lus, aangrijp, na, naEenheid });
    $('dlgRel').close();
    gewijzigd();
  }

  /* ---------- afdrukvenster ---------- */
  const PRINT_STANDAARD = { papier: 'A3', richting: 'liggend', schaal: 'leesbaar', pct: 100, nx: 1, ny: 1, overlap: 15, naden: true, overzicht: true, legenda: true, zw: false, raster: false };
  function printInstellingen() { return Object.assign({}, PRINT_STANDAARD, S.p.afdruk || {}); }
  function printOpts() {
    return {
      papier: $('prPapier').value, richting: $('prRichting').value,
      schaal: (document.querySelector('input[name=prSchaal]:checked') || {}).value || 'leesbaar',
      pct: Number($('prPct').value) || 100, nx: Number($('prNx').value) || 1, ny: Number($('prNy').value) || 1, overlap: Number($('prOverlap').value) || 0,
      naden: $('prNaden').checked, overzicht: $('prOverzicht').checked, legenda: $('prLegenda').checked, zw: $('prZw').checked, raster: $('prRaster').checked
    };
  }
  function vulPrintVenster() {
    const o = printInstellingen();
    $('prPapier').value = o.papier; $('prRichting').value = o.richting;
    document.querySelectorAll('input[name=prSchaal]').forEach(i => { i.checked = i.value === (o.schaal === 'een' ? 'paginas' : o.schaal); });
    $('prPct').value = o.pct; $('prSlider').value = o.pct; $('prNx').value = o.nx; $('prNy').value = o.ny; $('prOverlap').value = o.overlap;
    $('prNaden').checked = o.naden; $('prOverzicht').checked = o.overzicht; $('prLegenda').checked = o.legenda; $('prZw').checked = o.zw; $('prRaster').checked = o.raster;
  }
  function printSamenvatting() {
    const o = printOpts();
    const oud = JSON.stringify(S.p.afdruk || {});
    S.p.afdruk = o;
    if (JSON.stringify(o) !== oud) { autosave(); }
    const ind = NP.printIndeling(S.p, o);
    const s = NP.printSamenvatting(ind, o);
    $('prSamenvatting').innerHTML = s.tekst;
    $('prSamenvatting').classList.toggle('waarschuwing', s.waarschuwing);
    // voorbeeld: hele netwerk met paginaraster
    const vb = $('prVoorbeeld');
    if (!ind) { vb.innerHTML = ''; return; }
    let x1 = ind.bb.x, y1 = ind.bb.y, x2 = ind.bb.x + ind.bb.w, y2 = ind.bb.y + ind.bb.h;
    for (const pg of ind.paginas) { x1 = Math.min(x1, pg.x); y1 = Math.min(y1, pg.y); x2 = Math.max(x2, pg.x2); y2 = Math.max(y2, pg.y2); }
    const m = Math.max(x2 - x1, y2 - y1) * 0.03;
    vb.setAttribute('viewBox', `${x1 - m} ${y1 - m} ${x2 - x1 + 2 * m} ${y2 - y1 + 2 * m}`);
    const f = Math.max(x2 - x1, y2 - y1) / 560;
    const tk = { reken: S.reken, zw: o.zw, scherm: false };
    vb.innerHTML = NP.defs(NP.kleuren(o.zw)) + NP.tekenRelaties(S.p, tk) + NP.tekenKnopen(S.p, tk) + NP.tekenPaginaRaster(ind, f);
    tekenPaginaLaag();
  }
  function tekenPaginaLaag() {
    const o = printInstellingen();
    const laag = $('laagPagina');
    if (!o.raster || !S.p.activiteiten.length) { laag.innerHTML = ''; return; }
    laag.innerHTML = NP.tekenPaginaRaster(NP.printIndeling(S.p, o), 1);
  }

  /* ---------- muis en toetsen op het canvas ---------- */
  function knoopVan(el) { const g = el.closest && el.closest('.knoop'); return g ? g.dataset.id : null; }

  function dubbelklik(sleutel, w) {
    if (sleutel.startsWith('k:')) {
      const id = sleutel.slice(2);
      S.sel = new Set([id]); S.selRel = null; teken();
      openAct(id, false);
    } else if (sleutel.startsWith('r:')) {
      openRelatie(sleutel.slice(2));
    } else {
      nieuweActiviteit(w.x - W / 2, w.y - H / 2);
    }
  }

  /* ---------- venster activiteit / gebeurtenis ---------- */
  let dlgAct = null; // { id, nieuw, snap }
  function openAct(id, nieuw) {
    const a = NP.getAct(S.p, id);
    if (!a) return;
    dlgAct = { id, nieuw, snap: momentopname() };
    $('actTitel').textContent = (nieuw ? 'Nieuwe ' : '') + (NP.isGebeurtenis(a) ? 'gebeurtenis' : 'activiteit') + (nieuw ? '' : ' bewerken') + ' · ' + a.id;
    $('actNaam').value = a.naam || '';
    $('actSoort').value = a.soort || 'activiteit';
    $('actRol').value = a.rol || '';
    $('actDuur').value = Number(a.duur) || 0;
    $('actNv').value = a.nietVoor === null || a.nietVoor === undefined ? '' : a.nietVoor;
    $('actNotitie').value = a.notitie || '';
    document.querySelectorAll('#dlgAct .eenheid').forEach(e => e.textContent = S.p.eenheid || 'werkdagen');
    actVelden();
    $('dlgAct').showModal();
    const focusNaam = () => { if ($('dlgAct').open) { $('actNaam').focus(); $('actNaam').select(); } };
    focusNaam();
    setTimeout(focusNaam, 30);
  }
  function actVelden() {
    const soort = $('actSoort').value;
    const geb = soort !== 'activiteit';
    $('actRolBlok').hidden = geb;
    $('actDuurBlok').hidden = geb;
    $('actNvBlok').hidden = !geb || soort === 'eind';
  }
  function actOpslaan() {
    if (!dlgAct) return;
    const a = NP.getAct(S.p, dlgAct.id);
    if (!a) { dlgAct = null; $('dlgAct').close(); return; }
    a.naam = $('actNaam').value;
    a.notitie = $('actNotitie').value;
    const soort = $('actSoort').value;
    if (soort !== a.soort) wisselSoort(a, soort);
    if (!NP.isGebeurtenis(a)) {
      a.rol = $('actRol').value;
      const d = parseFloat($('actDuur').value);
      a.duur = isNaN(d) || d < 0 ? 0 : d;
    } else if (a.soort !== 'eind') {
      const v = parseFloat($('actNv').value);
      a.nietVoor = isNaN(v) ? null : Math.max(0, v);
    }
    if (!dlgAct.nieuw && dlgAct.snap !== momentopname()) bewaarStap(dlgAct.snap);
    dlgAct = null;
    $('dlgAct').close();
    gewijzigd();
  }
  function actAnnuleer() {
    const d = dlgAct;
    dlgAct = null;
    $('dlgAct').close();
    if (d && d.nieuw) { ongedaan(); S.redo = []; teken(); }
  }
  function wisselSoort(a, nieuw) {
    const wasGeb = NP.isGebeurtenis(a);
    a.soort = nieuw;
    if (NP.isGebeurtenis(a)) {
      a.duur = 0;
      if (!wasGeb) { a.x += (W - NP.GEBEURTENIS.W) / 2; a.y += (H - NP.GEBEURTENIS.H) / 2; }
      if (nieuw === 'start') S.p.relaties = S.p.relaties.filter(r => r.naar !== a.id);
      if (nieuw === 'eind') S.p.relaties = S.p.relaties.filter(r => r.van !== a.id);
    } else if (wasGeb) {
      a.duur = 1; a.nietVoor = null;
      a.x -= (W - NP.GEBEURTENIS.W) / 2; a.y -= (H - NP.GEBEURTENIS.H) / 2;
    }
  }

  function doelOnder(e) {
    const onder = document.elementFromPoint(e.clientX, e.clientY);
    const poort = onder && onder.closest && onder.closest('.poort');
    if (poort) return { id: poort.dataset.id, poort, poortNaam: poort.dataset.poort };
    return { id: onder ? knoopVan(onder) : null, poort: null, poortNaam: null };
  }
  /* Bepaalt wat voor relatie er ontstaat als je loslaat */
  function planRelatie(m, d, w) {
    const A = NP.getAct(S.p, m.van), B = NP.getAct(S.p, d.id);
    if (NP.isGebeurtenis(A) && m.poort === 'start') {
      // vanaf de ingang van een gebeurtenis slepen = relatie náár de gebeurtenis
      return { van: B.id, naar: A.id, type: NP.isGebeurtenis(B) ? 'FS' : (d.poortNaam === 'start' ? 'SS' : 'FS'), extra: {} };
    }
    if (NP.isGebeurtenis(A) && !NP.isGebeurtenis(B)) {
      let aangrijp = 'begin', na = 0;
      const D = Math.max(0, Number(B.duur) || 0);
      if (d.poortNaam === 'start') aangrijp = 'begin';
      else if (d.poortNaam === 'einde') aangrijp = 'einde';
      else {
        const f = (w.x - B.x) / W;
        if (f > 0.82) aangrijp = 'einde';
        else if (f > 0.18 && D > 0) { aangrijp = 'tijdens'; na = Math.min(D, Math.max(0.5, Math.round(f * D * 2) / 2)); }
      }
      return { van: A.id, naar: B.id, type: 'FS', trigger: true, extra: { aangrijp, na, naEenheid: 'dagen' } };
    }
    const naarPoort = NP.isGebeurtenis(B) ? 'start' : (d.poortNaam || 'start');
    return { van: A.id, naar: B.id, type: NP.typeUitPoorten(NP.isGebeurtenis(A) ? 'einde' : m.poort, naarPoort), extra: {} };
  }

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
    const poortEl = e.target.closest('.poort');
    const kId = knoopVan(e.target), relEl = e.target.closest('.rel');
    const sleutel = poortEl ? null : kId ? 'k:' + kId : relEl ? 'r:' + relEl.dataset.rel : 'leeg';
    const nu = performance.now(), vorige = S.klik;
    if (sleutel && vorige && vorige.sleutel === sleutel && nu - vorige.t < 450 && Math.hypot(e.clientX - vorige.x, e.clientY - vorige.y) < 8) {
      S.klik = null;
      e.preventDefault();
      dubbelklik(sleutel, w);
      return;
    }
    S.klik = sleutel ? { sleutel, t: nu, x: e.clientX, y: e.clientY } : null;
    const poort = poortEl;
    if (poort) {
      S.modus = 'verbinden';
      S.m = { van: poort.dataset.id, poort: poort.dataset.poort };
      doek.classList.add('verbinden');
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
      setTimeout(() => { const i = $('inspecteur').querySelector('[data-relveld=verschil]'); if (i) { i.focus(); i.select(); } }, 0);
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
      const d = doelOnder(e);
      const geldig = d.id && d.id !== S.m.van;
      if (d.poort && geldig) d.poort.classList.add('doel');
      const plan = geldig ? planRelatie(S.m, d, w) : null;
      const lus = plan && NP.maaktKring(S.p, plan.van, plan.naar);
      const kleur = lus ? '#7C3AED' : plan && plan.trigger ? '#0F6E56' : '#1D4ED8';
      const z = S.view.z;
      let t = `<path d="M${s.x} ${s.y} L${w.x} ${w.y}" stroke="${kleur}" stroke-width="${2 / z}" stroke-dasharray="${6 / z} ${4 / z}" fill="none" marker-end="url(#${lus ? 'pijl-l' : plan && plan.trigger ? 'pijl-t' : 'pijl-s'})"/>`;
      let tekst = '';
      if (lus) tekst = '↺ lus: rework, telt niet mee';
      else if (plan && plan.trigger) tekst = plan.extra.aangrijp === 'begin' ? 'trigger aan het begin' : plan.extra.aangrijp === 'einde' ? 'trigger aan het einde' : 'trigger na ' + NP.fmt(plan.extra.na) + ' dagen';
      else if (plan) tekst = plan.type + ' · ' + NP.TYPE_NAMEN[plan.type];
      if (tekst) {
        const bw = tekst.length * 6.6 + 18;
        const bg = lus ? '#F3EEFF' : plan.trigger ? '#E1F5EE' : '#E8EEFC';
        t += `<g transform="translate(${w.x + 14 / z} ${w.y - 14 / z}) scale(${1 / z})"><rect x="0" y="-15" width="${bw}" height="22" rx="5" fill="${bg}" stroke="${kleur}"/><text x="8" y="0" font-size="12" font-weight="600" fill="${kleur}" font-family='${NP.FONT}'>${NP.esc(tekst)}</text></g>`;
      }
      if (plan && plan.trigger) {
        const B = NP.getAct(S.p, plan.naar);
        const x = NP.aangrijpX(S.p, Object.assign({ naar: plan.naar }, plan.extra), B);
        t += `<line x1="${x}" y1="${B.y - 6}" x2="${x}" y2="${B.y + NP.KNOOP.H}" stroke="#0F6E56" stroke-width="${2 / z}"/>`;
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
      for (const act of S.p.activiteiten) { const v = NP.vlak(act); if (v.x < b.x && v.x + v.w > a.x && v.y < b.y && v.y + v.h > a.y) nieuw.add(act.id); }
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
      doek.classList.remove('verbinden');
      document.querySelectorAll('.poort.doel').forEach(x => x.classList.remove('doel'));
      if (e && e.type === 'pointerup') {
        const d = doelOnder(e);
        if (d.id && d.id !== m.van) {
          const plan = planRelatie(m, d, schermNaarWereld(e.clientX, e.clientY));
          maakRelatie(plan.van, plan.naar, plan.type, 0, plan.extra);
        }
      }
    } else if (modus === 'lasso') {
      $('lasso').hidden = true;
      teken();
    }
  }
  svg.addEventListener('pointerup', eindeMuis);
  svg.addEventListener('pointercancel', eindeMuis);

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
    if (k === 'g' && !ctrl) { nieuweKnoop('tussen'); return; }
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
  insp.addEventListener('focusin', e => { if (e.target.matches('[data-veld],[data-project],[data-relveld]')) focusSnap = momentopname(); });
  insp.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'chkPaginaRaster') { S.p.afdruk = Object.assign(printInstellingen(), { raster: t.checked }); autosave(); tekenPaginaLaag(); return; }
    if (t.dataset.relveld) {
      const r = S.p.relaties.find(x => x.id === S.selRel);
      if (!r) return;
      const f = t.dataset.relveld;
      if (f === 'verschil' || f === 'na') { const v = parseFloat(t.value); r[f] = isNaN(v) ? 0 : (f === 'na' ? Math.max(0, v) : v); }
      else if (f === 'lus') {
        if (!t.checked && NP.maaktKring(S.p, r.van, r.naar, r.id)) { t.checked = true; toast('Zonder lus sluit deze relatie een kring. Maak eerst een andere relatie in de kring een lus.'); return; }
        r.lus = t.checked;
      } else r[f] = t.value;
      S.vuil = true; autosave();
      if (f === 'aangrijp' || f === 'lus' || f === 'type' || f === 'naEenheid') { if (focusSnap && focusSnap !== momentopname()) bewaarStap(focusSnap); focusSnap = null; t.blur(); }
      teken();
      return;
    }
    if (t.dataset.veld && S.sel.size === 1) {
      const a = NP.getAct(S.p, [...S.sel][0]);
      if (t.dataset.veld === 'soort') return;
      if (t.dataset.veld === 'duur') { const v = parseFloat(t.value); a.duur = isNaN(v) || v < 0 ? 0 : v; }
      else if (t.dataset.veld === 'nietVoor') { const v = parseFloat(t.value); a.nietVoor = isNaN(v) ? null : Math.max(0, v); }
      else a[t.dataset.veld] = t.value;
      S.vuil = true; autosave(); teken();
    } else if (t.dataset.project) {
      S.p[t.dataset.project] = t.value;
      S.vuil = true; autosave(); teken();
    }
  });
  insp.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.veld !== 'soort' || S.sel.size !== 1) return;
    const a = NP.getAct(S.p, [...S.sel][0]);
    const oud = a.soort, nieuw = t.value;
    if (oud === nieuw) return;
    bewaarStap(focusSnap || momentopname());
    focusSnap = null;
    wisselSoort(a, nieuw);
    t.blur();
    gewijzigd();
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
    if (t.id === 'btnVerwijderRel') { verwijderSelectie(); return; }
    if (t.id === 'nrToevoegen') {
      const id = [...S.sel][0], ander = $('nrAndere').value;
      const voor = $('nrRichting').value === 'voor';
      maakRelatie(voor ? ander : id, voor ? id : ander, $('nrType').value, parseFloat($('nrVerschil').value) || 0);
    }
    if (t.id === 'trToevoegen') {
      const id = [...S.sel][0], ander = $('trAndere').value;
      const B = NP.getAct(S.p, ander);
      if (NP.isGebeurtenis(B)) { maakRelatie(id, ander, 'FS', 0); return; }
      const aangrijp = $('trAangrijp').value;
      maakRelatie(id, ander, 'FS', 0, { aangrijp, na: aangrijp === 'tijdens' ? (parseFloat($('trNa').value) || 0) : 0, naEenheid: 'dagen' });
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
  $('btnNieuweGeb').onclick = () => nieuweKnoop('tussen');
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

  document.querySelectorAll('#relTypes input, #relAangrijp input').forEach(i => i.addEventListener('change', relUitleg));
  $('relNa').addEventListener('input', relUitleg);
  $('relNaEenheid').addEventListener('change', relUitleg);
  $('relVerschil').addEventListener('input', relUitleg);
  $('relOk').onclick = relOpslaan;
  $('actSoort').addEventListener('change', actVelden);
  $('formAct').addEventListener('submit', e => { e.preventDefault(); actOpslaan(); });
  $('actAnnuleer').onclick = actAnnuleer;
  $('dlgAct').addEventListener('cancel', e => { e.preventDefault(); actAnnuleer(); });
  $('actWeg').onclick = () => { const d = dlgAct; dlgAct = null; $('dlgAct').close(); if (!d) return; if (!d.nieuw) bewaarStap(d.snap); S.p.activiteiten = S.p.activiteiten.filter(a => a.id !== d.id); S.p.relaties = S.p.relaties.filter(r => r.van !== d.id && r.naar !== d.id); S.sel.delete(d.id); gewijzigd(); };
  $('relWeg').onclick = () => { bewaarStap(); S.p.relaties = S.p.relaties.filter(r => r.id !== dlgRelId); S.selRel = null; $('dlgRel').close(); gewijzigd(); };
  $('formRel').addEventListener('submit', e => { if (e.submitter && e.submitter.value === 'annuleren') return; e.preventDefault(); relOpslaan(); });

  function openPrint() {
    if (!S.p.activiteiten.length) { toast('Er staat nog niets op het canvas om af te drukken.'); return; }
    vulPrintVenster();
    printSamenvatting();
    $('dlgPrint').showModal();
  }
  $('prSlider').addEventListener('input', () => { $('prPct').value = $('prSlider').value; document.querySelector('input[name=prSchaal][value=vast]').checked = true; });
  $('prPct').addEventListener('input', () => { $('prSlider').value = $('prPct').value; document.querySelector('input[name=prSchaal][value=vast]').checked = true; });
  ['prNx', 'prNy'].forEach(id => $(id).addEventListener('input', () => { document.querySelector('input[name=prSchaal][value=paginas]').checked = true; }));
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
      S.p = NP.normaliseer(opgeslagen.p);
      if (!opgeslagen.versie || opgeslagen.versie === '0.2') NP.oudeGebeurtenisPlek(S.p);
      S.bestandsnaam = opgeslagen.bestandsnaam || null;
      S.vuil = !!opgeslagen.vuil;
      if (S.p.activiteiten.length) setTimeout(() => toast('Je laatste werk is hersteld (tussentijds bewaard in deze browser).'), 300);
    }
  } catch (e) { /* niets */ }
  teken();
  zetView();
  if (S.p.activiteiten.length) requestAnimationFrame(passend);
})();
