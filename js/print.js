/* Netwerkplanner – afdrukken en PDF: verdelen over pagina's met zichtbare overlap */
(function () {
  'use strict';
  const NP = (window.NP = window.NP || {});

  const PAPIER = { A4: [210, 297], A3: [297, 420], A2: [420, 594] };
  const MARGE = 10, KOP_MM = 11, VOET_MM = 8;
  const PT = 0.3528; // mm per punt
  const NAAM_PX = 13;
  const K_LEESBAAR = (9 * PT) / NAAM_PX; // mm per wereld-px zodat namen 9 pt zijn

  NP.papierMaat = function (opts) {
    const [a, b] = PAPIER[opts.papier] || PAPIER.A3;
    return opts.richting === 'staand' ? { w: a, h: b } : { w: b, h: a };
  };

  /* Zoek een naad (paginarand) tussen min en max die geen blok doorsnijdt. */
  function zoekNaad(ideaal, min, overlap, intervallen, slim) {
    if (!slim) return ideaal;
    const raakt = x => intervallen.some(([a, b]) => x > a + 0.5 && x < b - 0.5);
    for (let e = ideaal; e >= min; e -= 4) {
      if (!raakt(e) && !raakt(e - overlap)) return e;
    }
    for (let e = ideaal; e >= min; e -= 4) if (!raakt(e)) return e;
    return ideaal;
  }

  function verdeel(start, lengte, pagina, overlap, intervallen, slim) {
    const einde = start + lengte;
    if (lengte <= pagina) {
      const s = start - (pagina - lengte) / 2;
      return [[s, s + pagina]];
    }
    const delen = [];
    let s = start;
    let veilig = 0;
    while (veilig++ < 500) {
      if (s + pagina >= einde) { delen.push([s, einde]); break; }
      const min = s + Math.max(overlap + 20, pagina * 0.55);
      const e = zoekNaad(s + pagina, min, overlap, intervallen, slim);
      delen.push([s, e]);
      s = e - overlap;
    }
    return delen;
  }

  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const kolomLetter = i => (i >= 26 ? LETTERS[Math.floor(i / 26) - 1] : '') + LETTERS[i % 26];

  /* Berekent schaal en pagina-indeling. */
  NP.printIndeling = function (p, opts) {
    const bb = NP.omhullende(p);
    if (!bb) return null;
    const pap = NP.papierMaat(opts);
    const aw = pap.w - 2 * MARGE;
    const ah = pap.h - 2 * MARGE - KOP_MM - (opts.legenda ? VOET_MM : 0);
    let k;
    if (opts.schaal === 'een') k = Math.min(aw / bb.w, ah / bb.h);
    else if (opts.schaal === 'vast') k = K_LEESBAAR * (Math.max(5, Number(opts.pct) || 100) / 100);
    else k = K_LEESBAAR;
    const naamPt = (NAAM_PX * k) / PT;
    const pw = aw / k, ph = ah / k;
    const ov = Math.max(0, Number(opts.overlap) || 0) / k;
    const vl = p.activiteiten.map(NP.vlak);
    const xi = vl.map(v => [v.x, v.x + v.w]);
    const yi = vl.map(v => [v.y, v.y + v.h]);
    const kol = verdeel(bb.x, bb.w, pw, ov, xi, opts.naden);
    const rij = verdeel(bb.y, bb.h, ph, ov, yi, opts.naden);
    const paginas = [];
    rij.forEach((r, ri) => kol.forEach((c, ci) => {
      paginas.push({ ci, ri, code: kolomLetter(ci) + (ri + 1), x: c[0], x2: c[1], y: r[0], y2: r[1] });
    }));
    return { k, naamPt, pap, aw, ah, pw, ph, ov, kolommen: kol.length, rijen: rij.length, paginas, bb };
  };

  NP.printSamenvatting = function (ind, opts) {
    if (!ind) return { tekst: 'Er staat nog niets op het canvas.', waarschuwing: true };
    const n = ind.paginas.length;
    const extra = n > 1 && opts.overzicht ? ' + overzichtspagina' : '';
    let tekst = `Resultaat: <strong>${n} pagina${n > 1 ? '’s' : ''} ${opts.papier} ${opts.richting}</strong>` +
      (n > 1 ? ` (${ind.rijen} rij${ind.rijen > 1 ? 'en' : ''} × ${ind.kolommen} kolom${ind.kolommen > 1 ? 'men' : ''})` : '') + extra +
      ` · namen ${NP.fmt(ind.naamPt)} pt`;
    let waarschuwing = false;
    if (ind.naamPt < 7) { tekst += '<br>Let op: de tekst wordt erg klein en is waarschijnlijk slecht leesbaar. Kies <em>Leesbaar</em> of een groter papierformaat.'; waarschuwing = true; }
    return { tekst, waarschuwing };
  };

  function legenda() {
    return '<span>VS = vroegste start · DL = doorlooptijd · VE = vroegste einde · LS = laatste start · TS = totale speling · LE = laatste einde</span>' +
      '<span><svg width="9mm" height="2mm" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#B42318" stroke-width="2.5"/></svg> kritiek</span>' +
      '<span><svg width="9mm" height="2mm" viewBox="0 0 36 8"><line x1="0" y1="4" x2="36" y2="4" stroke="#7C3AED" stroke-width="2" stroke-dasharray="6 4"/></svg> lus (niet gerekend)</span>' +
      '<span><svg width="3mm" height="3mm" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#E1F5EE" stroke="#0F6E56"/></svg> gebeurtenis / trigger</span>';
  }

  function paginakaart(ind, hier) {
    let s = `<span class="pkaart" style="grid-template-columns: repeat(${ind.kolommen}, 4mm)">`;
    for (const pg of ind.paginas) s += `<i class="${pg === hier ? 'hier' : ''}"></i>`;
    return s + '</span>';
  }

  /* Bouwt de afdrukpagina's in #afdruk en opent het afdrukvenster. */
  NP.afdrukken = function (p, reken, opts) {
    const ind = NP.printIndeling(p, opts);
    if (!ind) return;
    const doel = document.getElementById('afdruk');
    const { pap, k } = ind;
    const datum = new Date().toLocaleDateString('nl-NL');
    const naam = NP.esc(p.naam || 'Netwerkplanning');
    const tekenOpts = { reken, zw: opts.zw, scherm: false };
    const inhoud = NP.defs(NP.kleuren(opts.zw)) + '<g>' + NP.tekenRelaties(p, tekenOpts) + NP.tekenKnopen(p, tekenOpts) + '</g>';
    const svgH = ind.ah;
    let html = `<style>@page { size: ${pap.w}mm ${pap.h}mm; margin: 0; }</style>`;
    const paginaOpen = () => `<div class="pagina" style="width:${pap.w}mm;height:${pap.h}mm;padding:${MARGE}mm">`;
    const voet = opts.legenda ? `<div class="pvoet" style="height:${VOET_MM}mm">${legenda()}</div>` : '';
    const totaal = ind.paginas.length + (ind.paginas.length > 1 && opts.overzicht ? 1 : 0);
    let nr = 0;

    if (ind.paginas.length > 1 && opts.overzicht) {
      nr++;
      const bb = ind.bb;
      const ko = Math.min(ind.aw / bb.w, svgH / bb.h);
      const lab = 5 / ko; // 5 mm hoge letters
      let raster = '';
      for (const pg of ind.paginas) {
        raster += `<rect x="${pg.x}" y="${pg.y}" width="${pg.x2 - pg.x}" height="${pg.y2 - pg.y}" fill="rgba(29,78,216,.04)" stroke="#1D4ED8" stroke-width="${0.5 / ko}" stroke-dasharray="${2 / ko} ${1.5 / ko}"/>`;
        raster += `<text x="${pg.x + 2 / ko}" y="${pg.y + lab + 1 / ko}" font-size="${lab}" font-weight="700" fill="#1D4ED8" font-family='${NP.FONT}'>${pg.code}</text>`;
      }
      html += paginaOpen() +
        `<div class="pkop" style="height:${KOP_MM}mm"><span><strong>${naam}</strong> · overzicht · afgedrukt ${datum}</span><span>pagina ${nr} van ${totaal}</span></div>` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${ind.aw}mm" height="${svgH}mm" viewBox="${bb.x} ${bb.y} ${bb.w} ${bb.h}" preserveAspectRatio="xMidYMid meet">${inhoud}${raster}</svg>` +
        voet + '</div>';
    }

    for (const pg of ind.paginas) {
      nr++;
      const w = pg.x2 - pg.x, h = pg.y2 - pg.y;
      const clipId = 'clip' + pg.code;
      const sw = 0.35 / k, dash = `${2.2 / k} ${1.6 / k}`;
      const fs = 2.6 / k;
      let marks = '';
      const band = (x, y, bw, bh) => `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="rgba(29,78,216,.07)"/>`;
      const lijn = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1D4ED8" stroke-width="${sw}" stroke-dasharray="${dash}"/>`;
      const buur = (dc, dr) => ind.paginas.find(q => q.ci === pg.ci + dc && q.ri === pg.ri + dr);
      const L = buur(-1, 0), R = buur(1, 0), B = buur(0, -1), O = buur(0, 1);
      const tekst = (x, y, t, rot) => `<text x="${x}" y="${y}" font-size="${fs}" fill="#1D4ED8" font-family='${NP.FONT}'${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${t}</text>`;
      if (L) { marks += band(pg.x, pg.y, ind.ov, h) + lijn(pg.x + ind.ov, pg.y, pg.x + ind.ov, pg.y2) + tekst(pg.x + ind.ov + 1.5 / k, pg.y + h / 2, `◀ overlap met ${L.code}`, -90); }
      if (R) { marks += band(pg.x2 - ind.ov, pg.y, ind.ov, h) + lijn(pg.x2 - ind.ov, pg.y, pg.x2 - ind.ov, pg.y2) + tekst(pg.x2 - ind.ov - 1.5 / k, pg.y + h / 2 - 30 / k, `overlap met ${R.code} ▶`, 90); }
      if (B) { marks += band(pg.x, pg.y, w, ind.ov) + lijn(pg.x, pg.y + ind.ov, pg.x2, pg.y + ind.ov) + tekst(pg.x + 4 / k, pg.y + ind.ov + fs + 1 / k, `▲ overlap met ${B.code}`); }
      if (O) { marks += band(pg.x, pg.y2 - ind.ov, w, ind.ov) + lijn(pg.x, pg.y2 - ind.ov, pg.x2, pg.y2 - ind.ov) + tekst(pg.x + 4 / k, pg.y2 - ind.ov - 1.5 / k, `▼ overlap met ${O.code}`); }
      if (L) marks += lijn(pg.x, pg.y, pg.x, pg.y2);
      if (R) marks += lijn(pg.x2, pg.y, pg.x2, pg.y2);
      if (B) marks += lijn(pg.x, pg.y, pg.x2, pg.y);
      if (O) marks += lijn(pg.x, pg.y2, pg.x2, pg.y2);
      const enkel = ind.paginas.length === 1;
      html += paginaOpen() +
        `<div class="pkop" style="height:${KOP_MM}mm"><span><strong>${naam}</strong> · afgedrukt ${datum}</span><span>${enkel ? '' : `<span class="pcode">${pg.code}</span> · `}pagina ${nr} van ${totaal}${enkel ? '' : paginakaart(ind, pg)}</span></div>` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w * k}mm" height="${h * k}mm" viewBox="${pg.x} ${pg.y} ${w} ${h}">` +
        `<defs><clipPath id="${clipId}"><rect x="${pg.x}" y="${pg.y}" width="${w}" height="${h}"/></clipPath></defs>` +
        `<g clip-path="url(#${clipId})">${marks}${inhoud}</g></svg>` +
        `<div style="flex:1"></div>` + voet + '</div>';
    }
    doel.innerHTML = html;
    document.body.classList.add('afdrukken');
    const klaar = () => { document.body.classList.remove('afdrukken'); doel.innerHTML = ''; window.removeEventListener('afterprint', klaar); };
    window.addEventListener('afterprint', klaar);
    setTimeout(() => window.print(), 60);
  };
})();
