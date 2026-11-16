/* Netwerkplanner – datamodel en rekenen (kritieke-padmethode met FS/SS/FF/SF en tijdsverschil) */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});

  NP.VERSIE = '0.1';
  NP.TYPES = ['FS', 'SS', 'FF', 'SF'];
  NP.TYPE_NAMEN = { FS: 'Finish–Start', SS: 'Start–Start', FF: 'Finish–Finish', SF: 'Start–Finish' };

  NP.nieuwProject = function () {
    return { naam: 'Nieuw project', eenheid: 'werkdagen', startdatum: '', activiteiten: [], relaties: [] };
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

  /* Sluit een (niet-lus) relatie van -> naar een kring? Dan bestaat er al een pad naar -> van. */
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

  /* Relatietype uit de gebruikte poorten: 'start' = linkerpoort, 'einde' = rechterpoort */
  NP.typeUitPoorten = function (vanPoort, naarPoort) {
    return (vanPoort === 'einde' ? 'F' : 'S') + (naarPoort === 'start' ? 'S' : 'F');
  };
  NP.poortenUitType = function (type) {
    return { van: type[0] === 'F' ? 'einde' : 'start', naar: type[1] === 'S' ? 'start' : 'einde' };
  };

  /* Heenweg, terugweg en speling. Lus-relaties tellen niet mee. */
  NP.bereken = function (p) {
    const acts = p.activiteiten;
    const res = {};
    const EPS = 1e-9;
    for (const a of acts) res[a.id] = { vs: 0, ve: 0, ls: 0, le: 0, ts: 0, kritiek: false };
    const rels = p.relaties.filter(r => !r.lus && res[r.van] && res[r.naar]);
    const inn = {}, uit = {}, graad = {};
    for (const a of acts) { inn[a.id] = []; uit[a.id] = []; graad[a.id] = 0; }
    for (const r of rels) { inn[r.naar].push(r); uit[r.van].push(r); graad[r.naar]++; }

    // topologische volgorde (Kahn)
    const volgorde = [];
    const rij = acts.filter(a => graad[a.id] === 0).map(a => a.id);
    while (rij.length) {
      const id = rij.shift();
      volgorde.push(id);
      for (const r of uit[id]) if (--graad[r.naar] === 0) rij.push(r.naar);
    }
    const kringFout = volgorde.length !== acts.length;
    if (kringFout) return { per: res, projectEinde: 0, kringFout: true, drijvend: new Set() };

    const D = id => Math.max(0, Number(NP.getAct(p, id).duur) || 0);
    const grens = r => {
      const A = res[r.van], v = Number(r.verschil) || 0, dB = D(r.naar);
      switch (r.type) {
        case 'SS': return A.vs + v;
        case 'FF': return A.ve + v - dB;
        case 'SF': return A.vs + v - dB;
        default: return A.ve + v; // FS
      }
    };
    for (const id of volgorde) {
      let vs = 0;
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
        switch (r.type) {
          case 'SS': g = B.ls - v + dA; break;
          case 'FF': g = B.le - v; break;
          case 'SF': g = B.le - v + dA; break;
          default: g = B.ls - v; // FS
        }
        le = Math.min(le, g);
      }
      res[id].le = le;
      res[id].ls = le - dA;
      res[id].ts = res[id].ls - res[id].vs;
      if (Math.abs(res[id].ts) < EPS) res[id].ts = 0;
      res[id].kritiek = res[id].ts === 0;
    }
    // drijvende relaties: bepalen de vroegste start van de opvolger en liggen tussen twee kritieke activiteiten
    const drijvend = new Set();
    for (const r of rels) {
      if (res[r.van].kritiek && res[r.naar].kritiek && Math.abs(grens(r) - res[r.naar].vs) < EPS) drijvend.add(r.id);
    }
    return { per: res, projectEinde: eind, kringFout: false, drijvend };
  };

  NP.fmt = function (n) {
    if (n === undefined || n === null || isNaN(n)) return '';
    const r = Math.round(n * 10) / 10;
    return String(r).replace('.', ',');
  };
})();
