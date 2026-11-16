/* Netwerkplanner – tekenen van knopen en pijlen als SVG (zelfde code voor scherm en afdruk) */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});

  const W = 240, H = 128, KOP = 56, CEL = 36;
  NP.KNOOP = { W, H, KOP, CEL, POORT_Y: 64 };
  NP.FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  NP.esc = esc;

  let ctx = null;
  function breedte(tekst, font) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font;
    return ctx.measureText(tekst).width;
  }
  /* Tekst afbreken over maximaal n regels binnen maxW; laatste regel krijgt … als het niet past */
  function inkorten(r, maxW, font) {
    if (breedte(r, font) <= maxW) return r;
    while (r.length && breedte(r + '…', font) > maxW) r = r.slice(0, -1);
    return r + '…';
  }
  /* Tekst afbreken over maximaal n regels binnen maxW; wat niet past krijgt … */
  function afbreken(tekst, maxW, font, n) {
    const woorden = String(tekst || '').split(/\s+/).filter(Boolean);
    let regels = [], cur = '';
    for (const w of woorden) {
      const test = cur ? cur + ' ' + w : w;
      if (breedte(test, font) <= maxW) cur = test;
      else { if (cur) regels.push(cur); cur = w; }
    }
    if (cur) regels.push(cur);
    if (!regels.length) regels = [''];
    if (regels.length > n) {
      regels = regels.slice(0, n);
      let r = regels[n - 1];
      while (r.length && breedte(r + '…', font) > maxW) r = r.slice(0, -1);
      regels[n - 1] = r + '…';
    }
    return regels.map(r => inkorten(r, maxW, font));
  }

  NP.poortPunt = function (a, poort) {
    return { x: a.x + (poort === 'start' ? 0 : W), y: a.y + NP.KNOOP.POORT_Y };
  };

  /* Orthogonale route tussen twee poorten */
  NP.route = function (A, B, type) {
    const pp = NP.poortenUitType(type);
    const s = NP.poortPunt(A, pp.van), t = NP.poortPunt(B, pp.naar);
    const sd = pp.van === 'einde' ? 1 : -1;
    const td = pp.naar === 'einde' ? 1 : -1;
    const G = 22;
    const s1x = s.x + sd * G, t1x = t.x + td * G;
    let pts;
    if (sd === 1 && td === -1 && t1x >= s1x) {
      const mx = Math.round((s.x + t.x) / 2);
      pts = [s, { x: mx, y: s.y }, { x: mx, y: t.y }, t];
    } else if (sd === td) {
      const x = sd > 0 ? Math.max(s1x, t1x) : Math.min(s1x, t1x);
      pts = [s, { x, y: s.y }, { x, y: t.y }, t];
    } else {
      let ym;
      if (A.y + H + 30 <= B.y) ym = (A.y + H + B.y) / 2;
      else if (B.y + H + 30 <= A.y) ym = (B.y + H + A.y) / 2;
      else ym = Math.max(A.y, B.y) + H + 28;
      pts = [s, { x: s1x, y: s.y }, { x: s1x, y: ym }, { x: t1x, y: ym }, { x: t1x, y: t.y }, t];
    }
    // dubbele punten weg
    const schoon = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const v = schoon[schoon.length - 1];
      if (Math.abs(v.x - pts[i].x) > 0.1 || Math.abs(v.y - pts[i].y) > 0.1) schoon.push(pts[i]);
    }
    return schoon;
  };

  function labelPunt(pts) {
    // midden van het langste segment
    let best = 0, bi = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
      if (l > best) { best = l; bi = i; }
    }
    return { x: (pts[bi].x + pts[bi + 1].x) / 2, y: (pts[bi].y + pts[bi + 1].y) / 2 };
  }

  NP.kleuren = function (zw) {
    return zw
      ? { kritiekKop: '#FFFFFF', kop: '#FFFFFF', kritiekTekst: '#000000', lijn: '#333333', kritiekLijn: '#000000', lus: '#555555', rand: '#000000', tekst: '#000000', zacht: '#333333', cel: '#999999' }
      : { kritiekKop: '#FBE9E7', kop: '#EEF1F5', kritiekTekst: '#B42318', lijn: '#5F5F5B', kritiekLijn: '#B42318', lus: '#7C3AED', rand: '#6B6B66', tekst: '#1F1F1E', zacht: '#5F5F5B', cel: '#E4E4E0' };
  };

  NP.defs = function (k) {
    const m = (id, kleur) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${kleur}"/></marker>`;
    return `<defs>${m('pijl-n', k.lijn)}${m('pijl-k', k.kritiekLijn)}${m('pijl-l', k.lus)}${m('pijl-s', '#1D4ED8')}</defs>`;
  };

  /* opts: { reken, sel:Set, selRel, zw, scherm } */
  NP.tekenRelaties = function (p, opts) {
    const k = NP.kleuren(opts.zw);
    let out = '';
    for (const r of p.relaties) {
      const A = NP.getAct(p, r.van), B = NP.getAct(p, r.naar);
      if (!A || !B) continue;
      const pts = NP.route(A, B, r.type);
      const d = 'M' + pts.map(q => q.x + ' ' + q.y).join(' L');
      const kritiek = !r.lus && opts.reken && opts.reken.drijvend.has(r.id);
      const gekozen = opts.selRel === r.id;
      let kleur = r.lus ? k.lus : kritiek ? k.kritiekLijn : k.lijn;
      let marker = r.lus ? 'pijl-l' : kritiek ? 'pijl-k' : 'pijl-n';
      if (gekozen) { kleur = '#1D4ED8'; marker = 'pijl-s'; }
      const dikte = kritiek ? (opts.zw ? 3 : 2.2) : 1.6;
      const streep = r.lus ? ' stroke-dasharray="7 5"' : '';
      out += `<g class="rel" data-rel="${esc(r.id)}">`;
      if (opts.scherm) out += `<path d="${d}" stroke="transparent" stroke-width="14" fill="none" class="rel-hit"/>`;
      out += `<path d="${d}" stroke="${kleur}" stroke-width="${dikte}" fill="none"${streep} marker-end="url(#${marker})"/>`;
      const v = Number(r.verschil) || 0;
      if (r.type !== 'FS' || v !== 0 || r.lus) {
        let tekst = r.type + (v ? (v > 0 ? ' +' : ' −') + NP.fmt(Math.abs(v)) : '');
        if (r.lus) tekst = '↺ ' + tekst + ' · lus';
        const lp = labelPunt(pts);
        const bw = breedte(tekst, '600 11px ' + NP.FONT) + 12;
        out += `<rect x="${lp.x - bw / 2}" y="${lp.y - 10}" width="${bw}" height="20" rx="4" fill="#FFFFFF" stroke="${r.lus ? k.lus : '#D4D4D0'}"${r.lus ? ' stroke-dasharray="3 2"' : ''}/>`;
        out += `<text x="${lp.x}" y="${lp.y + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="${r.lus ? k.lus : k.tekst}" font-family='${NP.FONT}'>${esc(tekst)}</text>`;
      }
      out += '</g>';
    }
    return out;
  };

  NP.tekenKnopen = function (p, opts) {
    const k = NP.kleuren(opts.zw);
    const reken = opts.reken;
    const lusLeden = new Set();
    for (const r of p.relaties) if (r.lus) { lusLeden.add(r.van); lusLeden.add(r.naar); }
    let out = '';
    for (const a of p.activiteiten) {
      const c = reken && !reken.kringFout ? reken.per[a.id] : null;
      const kritiek = c && c.kritiek;
      const sel = opts.sel && opts.sel.has(a.id);
      const x = a.x, y = a.y;
      out += `<g class="knoop" data-id="${esc(a.id)}" transform="translate(${x} ${y})">`;
      out += `<title>${esc(a.id + ' · ' + (a.naam || ''))}</title>`;
      if (sel) out += `<rect x="-5" y="-5" width="${W + 10}" height="${H + 10}" rx="9" fill="rgba(29,78,216,.15)"/>`;
      out += `<rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="#FFFFFF" stroke="${sel ? '#1D4ED8' : k.rand}" stroke-width="${sel ? 2.2 : (kritiek && opts.zw ? 2.4 : 1.4)}"/>`;
      out += `<path d="M0 6 Q0 0 6 0 H${W - 6} Q${W} 0 ${W} 6 V${KOP} H0 Z" fill="${kritiek ? k.kritiekKop : k.kop}" class="kop"/>`;
      out += `<line x1="0" y1="${KOP}" x2="${W}" y2="${KOP}" stroke="${k.cel}"/>`;
      const naamFont = '600 13px ' + NP.FONT;
      const regels = afbreken(a.naam || '(naamloos)', W - 20 - (kritiek ? 46 : 0), naamFont, 2);
      regels.forEach((rg, i) => {
        out += `<text x="10" y="${19 + i * 16}" font-size="13" font-weight="600" fill="${k.tekst}" font-family='${NP.FONT}'>${esc(rg)}</text>`;
      });
      if (a.rol) {
        const rol = afbreken('(' + a.rol + ')', W - 20, '11px ' + NP.FONT, 1)[0];
        out += `<text x="10" y="${regels.length > 1 ? 50 : 36}" font-size="11" fill="${k.zacht}" font-family='${NP.FONT}'>${esc(rol)}</text>`;
      }
      if (kritiek) out += `<text x="${W - 8}" y="17" text-anchor="end" font-size="10.5" font-weight="700" fill="${k.kritiekTekst}" font-family='${NP.FONT}'>Kritiek</text>`;
      if (lusLeden.has(a.id)) out += `<text x="${W - 8}" y="${kritiek ? 31 : 17}" text-anchor="end" font-size="10.5" font-weight="700" fill="${k.lus}" font-family='${NP.FONT}'>↺</text>`;
      // zes cellen
      const cw = W / 3;
      const vals = c
        ? [['Vroegste start', c.vs], ['Doorlooptijd', a.duur], ['Vroegste einde', c.ve], ['Laatste start', c.ls], ['Totale speling', c.ts], ['Laatste einde', c.le]]
        : [['Vroegste start', ''], ['Doorlooptijd', a.duur], ['Vroegste einde', ''], ['Laatste start', ''], ['Totale speling', ''], ['Laatste einde', '']];
      out += `<line x1="0" y1="${KOP + CEL}" x2="${W}" y2="${KOP + CEL}" stroke="${k.cel}"/>`;
      out += `<line x1="${cw}" y1="${KOP}" x2="${cw}" y2="${H}" stroke="${k.cel}"/><line x1="${2 * cw}" y1="${KOP}" x2="${2 * cw}" y2="${H}" stroke="${k.cel}"/>`;
      vals.forEach(([lab, v], i) => {
        const cx = (i % 3) * cw + cw / 2, cy = KOP + Math.floor(i / 3) * CEL;
        const isTs = i === 4, isD = i === 1;
        out += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9.5" fill="${k.zacht}" font-family='${NP.FONT}'>${lab}</text>`;
        out += `<text x="${cx}" y="${cy + 30}" text-anchor="middle" font-size="16" ${isTs || isD ? 'font-weight="700"' : ''} fill="${isTs && kritiek ? k.kritiekTekst : k.tekst}" font-family='${NP.FONT}'>${esc(NP.fmt(Number(v)))}</text>`;
      });
      if (opts.scherm) {
        out += `<circle class="poort" data-id="${esc(a.id)}" data-poort="start" cx="0" cy="${NP.KNOOP.POORT_Y}" r="7" fill="#FFFFFF" stroke="${k.rand}" stroke-width="1.5"><title>Startpoort</title></circle>`;
        out += `<circle class="poort" data-id="${esc(a.id)}" data-poort="einde" cx="${W}" cy="${NP.KNOOP.POORT_Y}" r="7" fill="#FFFFFF" stroke="${k.rand}" stroke-width="1.5"><title>Eindpoort</title></circle>`;
      }
      out += '</g>';
    }
    return out;
  };

  /* Omhullende van alle knopen en routes */
  NP.omhullende = function (p) {
    if (!p.activiteiten.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const a of p.activiteiten) {
      x1 = Math.min(x1, a.x); y1 = Math.min(y1, a.y); x2 = Math.max(x2, a.x + W); y2 = Math.max(y2, a.y + H);
    }
    for (const r of p.relaties) {
      const A = NP.getAct(p, r.van), B = NP.getAct(p, r.naar);
      if (!A || !B) continue;
      for (const q of NP.route(A, B, r.type)) { x1 = Math.min(x1, q.x); y1 = Math.min(y1, q.y); x2 = Math.max(x2, q.x); y2 = Math.max(y2, q.y); }
    }
    const m = 24;
    return { x: x1 - m, y: y1 - m, w: x2 - x1 + 2 * m, h: y2 - y1 + 2 * m };
  };
})();
