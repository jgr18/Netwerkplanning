/* Netwerkplanner – datamodel en rekenen (kritieke-padmethode met FS/SS/FF/SF, tijdsverschil en gebeurtenissen) */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});

  NP.VERSIE = '0.3';
  NP.TYPES = ['FS', 'SS', 'FF', 'SF'];
  NP.TYPE_NAMEN = { FS: 'Finish–Start', SS: 'Start–Start', FF: 'Finish–Finish', SF: 'Start–Finish' };
  NP.SOORTEN = ['activiteit', 'start', 'tussen', 'eind'];
  NP.SOORT_NAMEN = { activiteit: 'Activiteit', start: 'Startgebeurtenis', tussen: 'Tussentijdse gebeurtenis', eind: 'Eindgebeurtenis' };
  NP.AANGRIJP = ['begin', 'tijdens', 'einde'];

  NP.isGebeurtenis = a => !!a && a.soort && a.soort !== 'activiteit';

  NP.nieuwProject = function () {
    return { naam: 'Nieuw project', eenheid: 'werkdagen', startdatum: '', activiteiten: [], relaties: [] };
  };

  /* Oudere bestanden en losse invoer aanvullen tot het huidige model */
  NP.normaliseer = function (p) {
    for (const a of p.activiteiten) {
      if (!NP.SOORTEN.includes(a.soort)) a.soort = 'activiteit';
      if (NP.isGebeurtenis(a)) a.duur = 0;
      if (a.nietVoor === undefined || a.nietVoor === null || a.nietVoor === '') a.nietVoor = null;
    }
    for (const r of p.relaties) {
      if (!NP.TYPES.includes(r.type)) r.type = 'FS';
      if (!NP.AANGRIJP.includes(r.aangrijp)) r.aangrijp = 'begin';
      if (r.na === undefined || r.na === null || r.na === '') r.na = 0;
      if (r.naEenheid !== '%') r.naEenheid = 'dagen';
      r.lus = !!r.lus;
    }
    return p;
  };

  /* In v0.2 stond het midden van een gebeurtenis 32 px hoger; zet oude posities om */
  NP.oudeGebeurtenisPlek = function (p) {
    for (const a of p.activiteiten) if (NP.isGebeurtenis(a) && typeof a.y === 'number') a.y -= 32;
  };

  NP.volgendId = function (lijst, prefix) {
    let max = 0;
    for (const x of lijst) {
      const m = String(x.id).match(new RegExp('^' + prefix + '(\\d+)$'));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return prefix + (max + 1);
  };

  NP.getAct = function (p, id) { return p.activiteiten.find(a => a.id === id); };

  /* Is dit een relatie van een gebeurtenis naar een activiteit? Dan geldt het aangrijpingspunt. */
  NP.isTriggerRelatie = function (p, r) {
    const A = NP.getAct(p, r.van), B = NP.getAct(p, r.naar);
    return NP.isGebeurtenis(A) && B && !NP.isGebeurtenis(B);
  };

  /* Aantal dagen na de start van B waarop de trigger aangrijpt */
  NP.aangrijpDagen = function (p, r) {
    const B = NP.getAct(p, r.naar);
    const D = Math.max(0, Number(B && B.duur) || 0);
    if (r.aangrijp === 'einde') return D;
    if (r.aangrijp === 'tijdens') {
      const n = Number(r.na) || 0;
      return Math.min(D, Math.max(0, r.naEenheid === '%' ? D * n / 100 : n));
    }
    return 0;
  };

  NP.maaktKring = function (p, van, naar, negeerRelId) {
    if (van === naar) return true;
    const uit = {};
    for (const r of p.relaties) {
      if (r.lus || r.id === negeerRelId) continue;
      (uit[r.van] = uit[r.van] || []).push(r.naar);
    }
    const stapel = [naar], gezien = new Set();
    while (stapel.length) {
      const x = stapel.pop();
      if (x === van) return true;
      if (gezien.has(x)) continue;
      gezien.add(x);
      for (const y of uit[x] || []) stapel.push(y);
    }
    return false;
  };

  NP.typeUitPoorten = function (vanPoort, naarPoort) {
    return (vanPoort === 'einde' ? 'F' : 'S') + (naarPoort === 'start' ? 'S' : 'F');
  };
  NP.poortenUitType = function (type) {
    return { van: type[0] === 'F' ? 'einde' : 'start', naar: type[1] === 'S' ? 'start' : 'einde' };
  };

  /* Heenweg, terugweg, speling en wachttijd per relatie. Lus-relaties tellen niet mee. */
  NP.bereken = function (p) {
    const acts = p.activiteiten;
    const res = {};
    const EPS = 1e-9;
    for (const a of acts) res[a.id] = { vs: 0, ve: 0, ls: 0, le: 0, ts: 0, kritiek: false };
    const rels = p.relaties.filter(r => !r.lus && res[r.van] && res[r.naar]);
    const inn = {}, uit = {}, graad = {};
    for (const a of acts) { inn[a.id] = []; uit[a.id] = []; graad[a.id] = 0; }
    for (const r of rels) { inn[r.naar].push(r); uit[r.van].push(r); graad[r.naar]++; }

    const volgorde = [];
    const rij = acts.filter(a => graad[a.id] === 0).map(a => a.id);
    while (rij.length) {
      const id = rij.shift();
      volgorde.push(id);
      for (const r of uit[id]) if (--graad[r.naar] === 0) rij.push(r.naar);
    }
    if (volgorde.length !== acts.length) return { per: res, projectEinde: 0, kringFout: true, drijvend: new Set(), wacht: {} };

    const act = {};
    for (const a of acts) act[a.id] = a;
    const D = id => NP.isGebeurtenis(act[id]) ? 0 : Math.max(0, Number(act[id].duur) || 0);
    const trig = {};
    for (const r of rels) trig[r.id] = NP.isGebeurtenis(act[r.van]) && !NP.isGebeurtenis(act[r.naar]);
    const off = {};
    for (const r of rels) off[r.id] = trig[r.id] ? NP.aangrijpDagen(p, r) : 0;

    const grens = r => {
      const A = res[r.van], v = Number(r.verschil) || 0, dB = D(r.naar);
      if (trig[r.id]) return A.vs + v - off[r.id];
      switch (r.type) {
        case 'SS': return A.vs + v;
        case 'FF': return A.ve + v - dB;
        case 'SF': return A.vs + v - dB;
        default: return A.ve + v;
      }
    };
    for (const id of volgorde) {
      let vs = 0;
      const a = act[id];
      if (NP.isGebeurtenis(a) && a.nietVoor !== null && a.nietVoor !== undefined && !isNaN(Number(a.nietVoor))) vs = Math.max(vs, Number(a.nietVoor));
      for (const r of inn[id]) vs = Math.max(vs, grens(r));
      res[id].vs = vs;
      res[id].ve = vs + D(id);
    }
    let eind = 0;
    for (const a of acts) eind = Math.max(eind, res[a.id].ve);

    for (let i = volgorde.length - 1; i >= 0; i--) {
      const id = volgorde[i], dA = D(id);
      let le = eind;
      for (const r of uit[id]) {
        const B = res[r.naar], v = Number(r.verschil) || 0;
        let g;
        if (trig[r.id]) g = B.ls - v + off[r.id];
        else switch (r.type) {
          case 'SS': g = B.ls - v + dA; break;
          case 'FF': g = B.le - v; break;
          case 'SF': g = B.le - v + dA; break;
          default: g = B.ls - v;
        }
        le = Math.min(le, g);
      }
      res[id].le = le;
      res[id].ls = le - dA;
      res[id].ts = res[id].ls - res[id].vs;
      if (Math.abs(res[id].ts) < EPS) res[id].ts = 0;
      res[id].kritiek = res[id].ts <= 0;
    }
    const drijvend = new Set(), wacht = {};
    for (const r of rels) {
      const w = res[r.naar].vs - grens(r);
      wacht[r.id] = Math.abs(w) < EPS ? 0 : w;
      if (res[r.van].kritiek && res[r.naar].kritiek && wacht[r.id] === 0) drijvend.add(r.id);
    }
    return { per: res, projectEinde: eind, kringFout: false, drijvend, wacht };
  };

  NP.fmt = function (n) {
    if (n === undefined || n === null || n === '' || isNaN(n)) return '';
    const r = Math.round(n * 10) / 10;
    return String(r).replace('.', ',');
  };
})();
