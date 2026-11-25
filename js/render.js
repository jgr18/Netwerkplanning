/* Netwerkplanner – tekenen van knopen, gebeurtenissen en pijlen als SVG (zelfde code voor scherm en afdruk) */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});

  const W = 240, H = 128, KOP = 56, CEL = 36;
  const EW = 64, EH = 128, ER = 26, ECY = 64; // gebeurtenis: vak 64×128, cirkel (straal 26) op poorthoogte
  NP.KNOOP = { W, H, KOP, CEL, POORT_Y: 64 };
  NP.GEBEURTENIS = { W: EW, H: EH, R: ER };
  NP.FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  NP.esc = esc;

  NP.maat = a => NP.isGebeurtenis(a) ? { w: EW, h: EH } : { w: W, h: H };
  /* Ruimte inclusief het naamlabel onder een gebeurtenis (voor selectie, afdruk en omhullende) */
  NP.vlak = a => NP.isGebeurtenis(a) ? { x: a.x - 58, y: a.y + ECY - ER - 4, w: EW + 116, h: 2 * ER + 50 } : { x: a.x, y: a.y, w: W, h: H };

  let ctx = null;
  function breedte(tekst, font) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font;
    return ctx.measureText(tekst).width;
  }
  function inkorten(r, maxW, font) {
    if (breedte(r, font) <= maxW) return r;
    while (r.length && breedte(r + '…', font) > maxW) r = r.slice(0, -1);
    return r + '…';
  }
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
    if (NP.isGebeurtenis(a)) return { x: a.x + EW / 2 + (poort === 'start' ? -ER : ER), y: a.y + ECY };
    return { x: a.x + (poort === 'start' ? 0 : W), y: a.y + NP.KNOOP.POORT_Y };
  };

  /* x-positie (wereld) waar een trigger bovenop activiteit B aangrijpt */
  NP.aangrijpX = function (p, r, B) {
    const D = Math.max(0, Number(B.duur) || 0);
    const d = NP.aangrijpDagen(p, r);
    const f = D > 0 ? d / D : (r.aangrijp === 'einde' ? 1 : r.aangrijp === 'tijdens' ? 0.5 : 0);
    return B.x + 14 + f * (W - 28);
  };

  function schoon(pts) {
    const s = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const v = s[s.length - 1];
      if (Math.abs(v.x - pts[i].x) > 0.1 || Math.abs(v.y - pts[i].y) > 0.1) s.push(pts[i]);
    }
    return s;
  }

  /* Orthogonale route van een relatie */
  NP.routeRel = function (p, r) {
    const A = NP.getAct(p, r.van), B = NP.getAct(p, r.naar);
    if (NP.isGebeurtenis(A) && !NP.isGebeurtenis(B)) {
      // trigger aan het begin = naar de startpoort, aan het einde = naar de eindpoort
      if (r.aangrijp !== 'tijdens') return NP.route(A, B, r.aangrijp === 'einde' ? 'FF' : 'FS');
      // tijdens: via de rechterkant van de gebeurtenis naar de bovenkant van het blok, op het aangrijpingspunt
      const cx = A.x + EW / 2, cy = A.y + ECY;
      const tx = NP.aangrijpX(p, r, B);
      const zx = cx + ER + 16;
      if (B.y - 26 > cy + 6) {
        const ym = B.y - 26;
        return schoon([{ x: cx + ER, y: cy }, { x: zx, y: cy }, { x: zx, y: ym }, { x: tx, y: ym }, { x: tx, y: B.y }]);
      }
      const ym = Math.min(cy - ER, B.y) - 30;
      return schoon([{ x: cx, y: cy - ER }, { x: cx, y: ym }, { x: tx, y: ym }, { x: tx, y: B.y }]);
    }
    if (!NP.isGebeurtenis(A) && !NP.isGebeurtenis(B) && r.type !== 'FS') return NP.routeHoek(A, B, r).pts;
    return NP.route(A, B, r.type);
  };

  /* SS, FF en SF: vertrek aan de boven- of onderrand van A (start = linkerhoek, einde = rechterhoek),
     verschoven met het tijdsverschil; aankomst in de hoek van B (start = links, einde = rechts). */
  const HOEK = 10;
  NP.routeHoek = function (A, B, r) {
    const D = Math.max(0, Number(A.duur) || 0);
    const v = Number(r.verschil) || 0;
    const bruikbaar = W - 2 * HOEK;
    const vanStart = r.type[0] === 'S';
    let frac;
    if (vanStart) frac = D > 0 ? Math.min(1, Math.max(0, v / D)) : 0;
    else frac = D > 0 ? 1 - Math.min(1, Math.max(0, -v / D)) : 1;
    const ax = A.x + HOEK + frac * bruikbaar;
    const bx = r.type[1] === 'S' ? B.x + HOEK : B.x + W - HOEK;
    let rand, pts;
    if (B.y >= A.y + H + 30) {
      rand = 'onder';
      const ym = (A.y + H + B.y) / 2;
      pts = [{ x: ax, y: A.y + H }, { x: ax, y: ym }, { x: bx, y: ym }, { x: bx, y: B.y }];
    } else if (B.y + H + 30 <= A.y) {
      rand = 'boven';
      const ym = (B.y + H + A.y) / 2;
      pts = [{ x: ax, y: A.y }, { x: ax, y: ym }, { x: bx, y: ym }, { x: bx, y: B.y + H }];
    } else {
      rand = 'boven';
      const ym = Math.min(A.y, B.y) - 28;
      pts = [{ x: ax, y: A.y }, { x: ax, y: ym }, { x: bx, y: ym }, { x: bx, y: B.y }];
    }
    return { pts: schoon(pts), rand, ax, frac, D };
  };

  NP.route = function (A, B, type) {
    const pp = NP.poortenUitType(type);
    const evA = NP.isGebeurtenis(A), evB = NP.isGebeurtenis(B);
    const vanPoort = evA ? 'einde' : pp.van, naarPoort = evB ? 'start' : pp.naar;
    const s = NP.poortPunt(A, vanPoort), t = NP.poortPunt(B, naarPoort);
    const sd = vanPoort === 'einde' ? 1 : -1;
    const td = naarPoort === 'einde' ? 1 : -1;
    const mA = NP.maat(A), mB = NP.maat(B);
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
      if (A.y + mA.h + 30 <= B.y) ym = (A.y + mA.h + B.y) / 2;
      else if (B.y + mB.h + 30 <= A.y) ym = (B.y + mB.h + A.y) / 2;
      else ym = Math.max(A.y + mA.h, B.y + mB.h) + 28;
      pts = [s, { x: s1x, y: s.y }, { x: s1x, y: ym }, { x: t1x, y: ym }, { x: t1x, y: t.y }, t];
    }
    return schoon(pts);
  };

  function langsteSegment(pts) {
    let best = -1, bi = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
      if (l > best) { best = l; bi = i; }
    }
    return { a: pts[bi], b: pts[bi + 1], l: best };
  }

  NP.kleuren = function (zw) {
    return zw
      ? { kritiekKop: '#FFFFFF', kop: '#FFFFFF', kritiekTekst: '#000000', lijn: '#333333', kritiekLijn: '#000000', lus: '#555555', rand: '#000000', tekst: '#000000', zacht: '#333333', cel: '#999999', gebFill: '#FFFFFF', gebRand: '#000000', gebKritiekFill: '#FFFFFF', trigger: '#000000', wacht: '#333333' }
      : { kritiekKop: '#FBE9E7', kop: '#EEF1F5', kritiekTekst: '#B42318', lijn: '#5F5F5B', kritiekLijn: '#B42318', lus: '#7C3AED', rand: '#6B6B66', tekst: '#1F1F1E', zacht: '#5F5F5B', cel: '#E4E4E0', gebFill: '#E1F5EE', gebRand: '#0F6E56', gebKritiekFill: '#FBE9E7', trigger: '#0F6E56', wacht: '#5F5F5B' };
  };

  NP.defs = function (k) {
    const m = (id, kleur) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="${kleur}"/></marker>`;
    return `<defs>${m('pijl-n', k.lijn)}${m('pijl-k', k.kritiekLijn)}${m('pijl-l', k.lus)}${m('pijl-s', '#1D4ED8')}${m('pijl-t', k.trigger)}</defs>`;
  };

  /* opts: { reken, sel:Set, selRel, zw, scherm } */
  NP.tekenRelaties = function (p, opts) {
    const k = NP.kleuren(opts.zw);
    let out = '';
    for (const r of p.relaties) {
      const A = NP.getAct(p, r.van), B = NP.getAct(p, r.naar);
      if (!A || !B) continue;
      const pts = NP.routeRel(p, r);
      const d = 'M' + pts.map(q => q.x + ' ' + q.y).join(' L');
      const trigger = NP.isGebeurtenis(A) && !NP.isGebeurtenis(B);
      const kritiek = !r.lus && opts.reken && opts.reken.drijvend && opts.reken.drijvend.has(r.id);
      const gekozen = opts.selRel === r.id;
      let kleur = r.lus ? k.lus : kritiek ? k.kritiekLijn : trigger ? k.trigger : k.lijn;
      let marker = r.lus ? 'pijl-l' : kritiek ? 'pijl-k' : trigger ? 'pijl-t' : 'pijl-n';
      if (gekozen) { kleur = '#1D4ED8'; marker = 'pijl-s'; }
      const dikte = kritiek ? (opts.zw ? 3 : 2.2) : 1.6;
      const streep = r.lus ? ' stroke-dasharray="7 5"' : '';
      out += `<g class="rel" data-rel="${esc(r.id)}">`;
      if (opts.scherm) out += `<path d="${d}" stroke="transparent" stroke-width="14" fill="none" class="rel-hit"/>`;
      out += `<path d="${d}" stroke="${kleur}" stroke-width="${dikte}" fill="none"${streep} stroke-linejoin="round" marker-end="url(#${marker})"/>`;
      if (!trigger && r.type !== 'FS' && !NP.isGebeurtenis(A) && !NP.isGebeurtenis(B)) out += `<circle cx="${pts[0].x}" cy="${pts[0].y}" r="3" fill="${kleur}"/>`;
      if (gekozen && !trigger && r.type !== 'FS' && !NP.isGebeurtenis(A) && !NP.isGebeurtenis(B)) {
        // dagstreepjes op de rand van A waar de pijl vertrekt
        const h = NP.routeHoek(A, B, r);
        const yr = h.rand === 'onder' ? A.y + H : A.y;
        const dir = h.rand === 'onder' ? -1 : 1;
        if (h.D > 0 && h.D <= 60) {
          const stap = h.D > 30 ? 5 : 1;
          for (let i = stap; i < h.D; i += stap) {
            const x = A.x + HOEK + (i / h.D) * (W - 2 * HOEK);
            out += `<line x1="${x}" y1="${yr}" x2="${x}" y2="${yr + dir * 7}" stroke="#1D4ED8" stroke-width="1.2"/>`;
          }
        }
        out += `<circle cx="${h.ax}" cy="${yr}" r="3.5" fill="#1D4ED8"/>`;
      }
      // pijltje halverwege het langste stuk, zodat de richting overal zichtbaar is
      const seg = langsteSegment(pts);
      if (seg.l > 70) {
        const mx = (seg.a.x + seg.b.x) / 2, my = (seg.a.y + seg.b.y) / 2;
        const hoek = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) * 180 / Math.PI;
        out += `<path d="M-5 -4.5 L5 0 L-5 4.5 z" fill="${kleur}" transform="translate(${mx} ${my}) rotate(${hoek})"/>`;
      }
      // label
      const v = Number(r.verschil) || 0;
      const delen = [];
      if (trigger) {
        if (r.aangrijp === 'einde') delen.push('einde');
        else if (r.aangrijp === 'tijdens') delen.push('na ' + NP.fmt(Number(r.na) || 0) + (r.naEenheid === '%' ? '%' : ' d'));
        if (v) delen.push((v > 0 ? '+' : '−') + NP.fmt(Math.abs(v)));
      } else if (r.type !== 'FS' || v !== 0) {
        delen.push(r.type + (v ? (v > 0 ? ' +' : ' −') + NP.fmt(Math.abs(v)) : ''));
      }
      if (r.lus) delen.unshift('↺ lus');
      const tekst = delen.join(' · ');
      if (tekst) {
        const opTop = trigger && r.aangrijp === 'tijdens';
        const hoekRel = !trigger && r.type !== 'FS' && !NP.isGebeurtenis(A) && !NP.isGebeurtenis(B);
        const bw = breedte(tekst, '600 11px ' + NP.FONT) + 12;
        let lp = opTop ? { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y - 13 } : { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 };
        let ly = opTop ? lp.y : (seg.l > 70 && Math.abs(seg.a.y - seg.b.y) < 1 ? lp.y - 15 : lp.y);
        if (hoekRel) {
          // label naast het eerste (verticale) stukje, vlak bij het vertrekpunt
          const p0 = pts[0], p1 = pts[1] || pts[0];
          lp = { x: p0.x + bw / 2 + 6, y: (p0.y + p1.y) / 2 };
          ly = lp.y;
        }
        out += `<rect x="${lp.x - bw / 2}" y="${ly - 10}" width="${bw}" height="20" rx="4" fill="#FFFFFF" stroke="${r.lus ? k.lus : '#D4D4D0'}"${r.lus ? ' stroke-dasharray="3 2"' : ''}/>`;
        out += `<text x="${lp.x}" y="${ly + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="${r.lus ? k.lus : trigger ? k.trigger : k.tekst}" font-family='${NP.FONT}'>${esc(tekst)}</text>`;
      }
      out += '</g>';
    }
    return out;
  };

  function tekenGebeurtenis(a, c, opts, k) {
    const sel = opts.sel && opts.sel.has(a.id);
    const kritiek = c && c.kritiek;
    const cx = EW / 2, cy = ECY;
    let out = `<g class="knoop gebeurtenis" data-id="${esc(a.id)}" transform="translate(${a.x} ${a.y})">`;
    out += `<title>${esc(a.id + ' · ' + NP.SOORT_NAMEN[a.soort] + ' · ' + (a.naam || ''))}</title>`;
    if (sel) out += `<circle cx="${cx}" cy="${cy}" r="${ER + 7}" fill="rgba(29,78,216,.15)"/>`;
    const rand = sel ? '#1D4ED8' : kritiek ? k.kritiekLijn : k.gebRand;
    const fill = kritiek ? k.gebKritiekFill : k.gebFill;
    const dikte = a.soort === 'eind' ? 4 : 1.6;
    out += `<circle cx="${cx}" cy="${cy}" r="${ER}" fill="${fill}" stroke="${rand}" stroke-width="${sel ? 2.4 : dikte}"/>`;
    if (a.soort === 'tussen') out += `<circle cx="${cx}" cy="${cy}" r="${ER - 5}" fill="none" stroke="${rand}" stroke-width="1.3"/>`;
    const moment = c ? NP.fmt(c.vs) : '';
    out += `<text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="9" fill="${k.zacht}" font-family='${NP.FONT}'>dag</text>`;
    out += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="15" font-weight="700" fill="${kritiek ? k.kritiekTekst : k.tekst}" font-family='${NP.FONT}'>${esc(moment)}</text>`;
    const regels = afbreken(a.naam || '(naamloos)', EW + 110, '600 12px ' + NP.FONT, 2);
    regels.forEach((rg, i) => {
      out += `<text x="${cx}" y="${cy + ER + 16 + i * 14}" text-anchor="middle" font-size="12" font-weight="600" fill="${k.tekst}" font-family='${NP.FONT}'>${esc(rg)}</text>`;
    });
    const info = [];
    if (a.soort !== 'eind' && a.nietVoor !== null && a.nietVoor !== undefined && a.nietVoor !== '') info.push('niet vóór ' + NP.fmt(Number(a.nietVoor)));
    if (c && a.soort === 'tussen') info.push(kritiek ? 'bepalend' : 'uiterlijk ' + NP.fmt(c.ls));
    if (c && a.soort === 'start' && !kritiek) info.push('uiterlijk ' + NP.fmt(c.ls));
    if (info.length) out += `<text x="${cx}" y="${cy + ER + 18 + regels.length * 14}" text-anchor="middle" font-size="10.5" fill="${kritiek ? k.kritiekTekst : k.zacht}" font-family='${NP.FONT}'>${esc(info.join(' · '))}</text>`;
    if (opts.scherm) {
      if (a.soort !== 'start') out += `<circle class="poort" data-id="${esc(a.id)}" data-poort="start" cx="${cx - ER}" cy="${cy}" r="7" fill="#FFFFFF" stroke="${k.rand}" stroke-width="1.5"><title>Ingang</title></circle>`;
      if (a.soort !== 'eind') out += `<circle class="poort" data-id="${esc(a.id)}" data-poort="einde" cx="${cx + ER}" cy="${cy}" r="7" fill="#FFFFFF" stroke="${k.rand}" stroke-width="1.5"><title>Trigger: sleep naar een activiteit</title></circle>`;
    }
    return out + '</g>';
  }

  NP.tekenKnopen = function (p, opts) {
    const k = NP.kleuren(opts.zw);
    const reken = opts.reken;
    const lusLeden = new Set();
    for (const r of p.relaties) if (r.lus) { lusLeden.add(r.van); lusLeden.add(r.naar); }
    let out = '';
    for (const a of p.activiteiten) {
      const c = reken && !reken.kringFout ? reken.per[a.id] : null;
      if (NP.isGebeurtenis(a)) { out += tekenGebeurtenis(a, c, opts, k); continue; }
      const kritiek = c && c.kritiek;
      const sel = opts.sel && opts.sel.has(a.id);
      out += `<g class="knoop" data-id="${esc(a.id)}" transform="translate(${a.x} ${a.y})">`;
      out += `<title>${esc(a.id + ' · ' + (a.naam || ''))}</title>`;
      if (sel) out += `<rect x="-5" y="-5" width="${W + 10}" height="${H + 10}" rx="9" fill="rgba(29,78,216,.15)"/>`;
      const mijlpaal = !(Number(a.duur) > 0);
      out += `<rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="#FFFFFF"/>`;
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
      // aangrijpingspunten van triggers als streepje over het blok
      for (const r of p.relaties) {
        if (r.naar !== a.id || r.aangrijp !== 'tijdens' || !NP.isTriggerRelatie(p, r)) continue;
        const x = NP.aangrijpX(p, r, a) - a.x;
        out += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${k.trigger}" stroke-width="1" stroke-dasharray="3 3" opacity=".8"/>`;
      }
      out += `<rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="none" stroke="${sel ? '#1D4ED8' : k.rand}" stroke-width="${sel ? 2.6 : (kritiek && opts.zw ? 3 : 2.2)}"${mijlpaal ? ' stroke-dasharray="9 5"' : ''}/>`;
      if (opts.scherm) {
        out += `<circle class="poort" data-id="${esc(a.id)}" data-poort="start" cx="0" cy="${NP.KNOOP.POORT_Y}" r="7" fill="#FFFFFF" stroke="${k.rand}" stroke-width="1.5"><title>Startpoort</title></circle>`;
        out += `<circle class="poort" data-id="${esc(a.id)}" data-poort="einde" cx="${W}" cy="${NP.KNOOP.POORT_Y}" r="7" fill="#FFFFFF" stroke="${k.rand}" stroke-width="1.5"><title>Eindpoort</title></circle>`;
      }
      out += '</g>';
    }
    return out;
  };

  NP.omhullende = function (p) {
    if (!p.activiteiten.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const a of p.activiteiten) {
      const v = NP.vlak(a);
      x1 = Math.min(x1, v.x); y1 = Math.min(y1, v.y); x2 = Math.max(x2, v.x + v.w); y2 = Math.max(y2, v.y + v.h);
    }
    for (const r of p.relaties) {
      if (!NP.getAct(p, r.van) || !NP.getAct(p, r.naar)) continue;
      for (const q of NP.routeRel(p, r)) { x1 = Math.min(x1, q.x); y1 = Math.min(y1, q.y - 46); x2 = Math.max(x2, q.x); y2 = Math.max(y2, q.y); }
    }
    const m = 24;
    return { x: x1 - m, y: y1 - m, w: x2 - x1 + 2 * m, h: y2 - y1 + 2 * m };
  };
})();
