/* Netwerkplanner – opslaan en openen als Excel (.xlsx) via SheetJS */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});

  const KOLOM_ACT = ['ID', 'Soort', 'Naam', 'Rol', 'Doorlooptijd', 'Niet vóór', 'Notitie', 'Vroegste start', 'Vroegste einde', 'Laatste start', 'Laatste einde', 'Totale speling', 'Kritiek'];
  const KOLOM_REL = ['Van', 'Naar', 'Type', 'Tijdsverschil', 'Aangrijpingspunt', 'Na', 'Na-eenheid', 'Lus'];
  const SOORT_UIT = { activiteit: 'activiteit', start: 'start', tussen: 'tussentijds', eind: 'eind' };
  function soortIn(v) {
    const t = String(v == null ? '' : v).trim().toLowerCase();
    if (!t || t.startsWith('activ')) return 'activiteit';
    if (t.startsWith('start')) return 'start';
    if (t.startsWith('tussen')) return 'tussen';
    if (t.startsWith('eind')) return 'eind';
    return null;
  }

  NP.xlsxBeschikbaar = () => typeof window.XLSX !== 'undefined';

  function maakWerkmap(p, metData) {
    const X = window.XLSX;
    const reken = NP.bereken(p);
    const act = [KOLOM_ACT];
    if (metData) for (const a of p.activiteiten) {
      const c = reken.kringFout ? null : reken.per[a.id];
      act.push([a.id, SOORT_UIT[a.soort] || 'activiteit', a.naam || '', a.rol || '', NP.isGebeurtenis(a) ? 0 : (Number(a.duur) || 0), a.nietVoor === null || a.nietVoor === undefined ? '' : Number(a.nietVoor), a.notitie || '',
        c ? c.vs : '', c ? c.ve : '', c ? c.ls : '', c ? c.le : '', c ? c.ts : '', c ? (c.kritiek ? 'ja' : 'nee') : '']);
    }
    const rel = [KOLOM_REL];
    if (metData) for (const r of p.relaties) {
      const trig = NP.isTriggerRelatie(p, r);
      rel.push([r.van, r.naar, trig ? '' : r.type, Number(r.verschil) || 0, trig ? r.aangrijp : '', trig && r.aangrijp === 'tijdens' ? Number(r.na) || 0 : '', trig && r.aangrijp === 'tijdens' ? r.naEenheid : '', r.lus ? 'ja' : 'nee']);
    }
    const proj = [['Eigenschap', 'Waarde'], ['Naam', metData ? p.naam : ''], ['Tijdseenheid', p.eenheid || 'werkdagen'], ['Documentdatum', metData ? (p.docDatum || '') : ''], ['Versie', metData ? (p.docVersie || '') : ''], ['Status', metData ? (p.status || '') : ''], ['Bestandsversie', 1], ['Gemaakt met', 'Netwerkplanner v' + NP.VERSIE]];
    if (metData && p.afdruk) for (const [k, v] of Object.entries(p.afdruk)) proj.push(['Afdruk ' + k, v === true ? 'ja' : v === false ? 'nee' : v]);
    const ind = [['ID', 'X', 'Y']];
    if (metData) for (const a of p.activiteiten) ind.push([a.id, Math.round(a.x), Math.round(a.y)]);

    const wb = X.utils.book_new();
    const wsA = X.utils.aoa_to_sheet(act);
    wsA['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 42 }, { wch: 24 }, { wch: 12 }, { wch: 9 }, { wch: 30 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 8 }];
    const wsR = X.utils.aoa_to_sheet(rel);
    wsR['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 7 }, { wch: 13 }, { wch: 16 }, { wch: 6 }, { wch: 10 }, { wch: 6 }];
    const wsP = X.utils.aoa_to_sheet(proj);
    wsP['!cols'] = [{ wch: 16 }, { wch: 40 }];
    const wsI = X.utils.aoa_to_sheet(ind);
    X.utils.book_append_sheet(wb, wsA, 'Activiteiten');
    X.utils.book_append_sheet(wb, wsR, 'Relaties');
    X.utils.book_append_sheet(wb, wsP, 'Project');
    X.utils.book_append_sheet(wb, wsI, '_indeling');
    wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 0 }, { Hidden: 0 }, { Hidden: 1 }] };
    return wb;
  }

  NP.naarXlsx = function (p, metData) {
    const wb = maakWerkmap(p, metData !== false);
    return window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  };

  const norm = s => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  const isJa = v => ['ja', 'j', 'yes', 'y', 'true', 'waar', '1', 'x'].includes(norm(v)) || v === true || v === 1;
  function getal(v) {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  function rijen(ws) {
    const X = window.XLSX;
    const ruw = X.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!ruw.length) return [];
    const kop = ruw[0].map(norm);
    return ruw.slice(1).map((r, i) => {
      const o = { _rij: i + 2 };
      kop.forEach((k, j) => { o[k] = r[j]; });
      return o;
    }).filter(o => Object.keys(o).some(k => k !== '_rij' && String(o[k]).trim() !== ''));
  }
  function blad(wb, naam) {
    const n = wb.SheetNames.find(s => norm(s) === norm(naam));
    return n ? wb.Sheets[n] : null;
  }

  /* Leest een .xlsx (ArrayBuffer) en geeft { project, meldingen, zonderPlek } */
  NP.vanXlsx = function (buf) {
    const X = window.XLSX;
    const wb = X.read(buf, { type: 'array' });
    const meldingen = [];
    const p = NP.nieuwProject();
    const wsA = blad(wb, 'Activiteiten');
    if (!wsA) throw new Error('Tabblad "Activiteiten" ontbreekt.');
    const ids = new Set();
    for (const r of rijen(wsA)) {
      let id = String(r['id'] || '').trim();
      if (!id) { meldingen.push(`Activiteiten rij ${r._rij}: geen ID, rij overgeslagen.`); continue; }
      if (ids.has(id)) { meldingen.push(`Activiteiten rij ${r._rij}: ID ${id} komt dubbel voor, rij overgeslagen.`); continue; }
      ids.add(id);
      let duur = getal(r['doorlooptijd']);
      if (duur === null || duur < 0) { if (String(r['doorlooptijd']).trim() !== '') meldingen.push(`Activiteit ${id}: doorlooptijd ongeldig, 0 gebruikt.`); duur = 0; }
      let soort = soortIn(r['soort']);
      if (!soort) { meldingen.push(`Activiteit ${id}: soort "${r['soort']}" onbekend, activiteit gebruikt.`); soort = 'activiteit'; }
      const nv = getal(r['niet vóór'] !== undefined ? r['niet vóór'] : r['niet voor']);
      p.activiteiten.push({ id, soort, naam: String(r['naam'] || ''), rol: String(r['rol'] || ''), duur: soort === 'activiteit' ? duur : 0, nietVoor: soort !== 'activiteit' && soort !== 'eind' && nv !== null ? nv : null, notitie: String(r['notitie'] || ''), x: null, y: null });
    }
    const wsR = blad(wb, 'Relaties');
    let rn = 0;
    if (wsR) for (const r of rijen(wsR)) {
      const van = String(r['van'] || '').trim(), naar = String(r['naar'] || '').trim();
      if (!ids.has(van) || !ids.has(naar)) { meldingen.push(`Relaties rij ${r._rij}: verwijst naar onbekend ID ${!ids.has(van) ? van || '(leeg)' : naar || '(leeg)'}, rij overgeslagen.`); continue; }
      if (van === naar) { meldingen.push(`Relaties rij ${r._rij}: relatie naar zichzelf, overgeslagen.`); continue; }
      let type = String(r['type'] || 'FS').trim().toUpperCase() || 'FS';
      if (!NP.TYPES.includes(type)) { meldingen.push(`Relaties rij ${r._rij}: type "${r['type']}" onbekend, FS gebruikt.`); type = 'FS'; }
      if (p.relaties.some(x => x.van === van && x.naar === naar)) { meldingen.push(`Relaties rij ${r._rij}: dubbele relatie ${van} → ${naar}, overgeslagen.`); continue; }
      const v = getal(r['tijdsverschil']);
      let lus = isJa(r['lus']);
      if (!lus && NP.maaktKring(p, van, naar)) { lus = true; meldingen.push(`Relatie ${van} → ${naar} sluit een kring en is als lus gemarkeerd (niet meegerekend).`); }
      let aangrijp = String(r['aangrijpingspunt'] || '').trim().toLowerCase() || 'begin';
      if (!NP.AANGRIJP.includes(aangrijp)) { meldingen.push(`Relaties rij ${r._rij}: aangrijpingspunt "${r['aangrijpingspunt']}" onbekend, begin gebruikt.`); aangrijp = 'begin'; }
      const naEenheid = String(r['na-eenheid'] || '').includes('%') ? '%' : 'dagen';
      p.relaties.push({ id: 'R' + (++rn), van, naar, type, verschil: v || 0, lus, aangrijp, na: getal(r['na']) || 0, naEenheid });
    }
    const wsP = blad(wb, 'Project');
    if (wsP) {
      const ruw = X.utils.sheet_to_json(wsP, { header: 1, defval: '' });
      for (const [k, v] of ruw) {
        if (norm(k) === 'naam' && String(v).trim()) p.naam = String(v).trim();
        if (norm(k) === 'tijdseenheid' && String(v).trim()) p.eenheid = String(v).trim();
        if (norm(k) === 'gemaakt met') p._bron = String(v || '');
        if (norm(k) === 'documentdatum') p.docDatum = v instanceof Date ? v.toISOString().slice(0, 10) : (typeof v === 'number' ? new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10) : String(v || ''));
        if (norm(k) === 'versie') p.docVersie = String(v == null ? '' : v);
        if (norm(k) === 'status') p.status = String(v || '');
        if (norm(k).startsWith('afdruk ')) { p.afdruk = p.afdruk || {}; const sl = norm(k).slice(7); let w = v; if (w === 'ja') w = true; else if (w === 'nee') w = false; p.afdruk[sl] = w; }
      }
    }
    const wsI = blad(wb, '_indeling');
    if (wsI) for (const r of rijen(wsI)) {
      const a = p.activiteiten.find(x => x.id === String(r['id']).trim());
      const x = getal(r['x']), y = getal(r['y']);
      if (a && x !== null && y !== null) { a.x = x; a.y = y; }
    }
    NP.normaliseer(p);
    if (/v0\.2\b/.test(p._bron || '')) NP.oudeGebeurtenisPlek(p);
    delete p._bron;
    const zonderPlek = p.activiteiten.filter(a => a.x === null || a.y === null).map(a => a.id);
    return { project: p, meldingen, zonderPlek };
  };
})();
