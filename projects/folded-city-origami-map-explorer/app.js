"use strict";
/* ============================================================
   FOLDED CITY — origami map explorer
   A seeded paper city. Pan the sheet, unfold districts, drop
   pins, share the exact view. Everything works from the keyboard.
   ============================================================ */
(() => {
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  const nf = (n) => (Math.round(n * 10) / 10).toString();

  const W = 3400, H = 2350;              // sheet size (world units)
  const SP = 72;                         // city lattice pitch
  const FOLD = 118;                      // crease spacing step (x-axis)

  /* ---------------- rng ---------------- */
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  /* ---------------- geometry ---------------- */
  function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
    t = clamp(t, 0, 1);
    const qx = a.x + t * dx, qy = a.y + t * dy;
    return Math.hypot(p.x - qx, p.y - qy);
  }
  function polyDist(p, poly) {
    let m = 1e9;
    for (let i = 0; i < poly.length; i++) {
      const d = segDist(p, poly[i], poly[(i + 1) % poly.length]);
      if (d < m) m = d;
    }
    return m;
  }
  function polyCentroid(poly) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length];
      const cr = p0.x * p1.y - p1.x * p0.y;
      a += cr; cx += (p0.x + p1.x) * cr; cy += (p0.y + p1.y) * cr;
    }
    a *= 0.5;
    return { x: cx / (6 * a), y: cy / (6 * a) };
  }
  function polyScale(poly, k, cx, cy) {
    return poly.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }));
  }
  // half-plane clip: keep region closer to seed `a` than seed `b`
  function clipHalf(poly, a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const nx = b.x - a.x, ny = b.y - a.y;
    const f = (p) => (p.x - mx) * nx + (p.y - my) * ny;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length];
      const d0 = f(p0), d1 = f(p1);
      if (d0 <= 0) out.push(p0);
      if ((d0 < 0 && d1 > 0) || (d1 < 0 && d0 > 0)) {
        const t = d0 / (d0 - d1);
        out.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
      }
    }
    return out;
  }
  function inTri(p, a, b, c) {
    const d1 = cross(a, b, p), d2 = cross(b, c, p), d3 = cross(c, a, p);
    const neg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const pos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(neg && pos);
  }

  /* ---------------- data pools ---------------- */
  const PRE = ["Pleat", "Valley", "Blintz", "Squash", "Kite", "Crimp",
    "Twist", "Rabbit", "Box", "Petal", "Masu", "Swivel"];
  const SUF = ["Quarter", "Yard", "Crossing", "Foundry", "Junction", "Terraces",
    "Works", "Common", "Station", "Market", "Cut", "Basin"];
  const EPIT = [
    "where the paper never lies flat", "a district folded in half, then forgiven",
    "home of the long crease", "the mapmaker's oldest quarter",
    "built on a mountain fold", "its streets meet at waterbomb angles",
    "the print stayed wet for a century", "gulls nest in the big pleat",
    "do not unfold the red quarter", "the ink here runs uphill",
    "every roof is a valley waiting", "the quietest fold on the sheet",
    "a crimp of stubborn houses", "the blintz that swallowed a foundry",
    "measured twice, printed once", "where misprints go to retire"
  ];
  const NOTE = [
    "Field note — the creases run deeper than the deeds. Keep your thumb on the seam.",
    "Field note — buildings here were folded from the same sheet, so they lean on each other like stacked letters.",
    "Field note — at dusk the valley folds catch the lamp-light and the whole quarter goes salmon.",
    "Field note — the registry lists forty streets; the paper only shows thirty-nine.",
    "Field note — the printmaster swears the avenue was straight when he ran it.",
    "Field note — heavy rain once flattened the district; it was refolded from memory.",
    "Field note — every fold line in this quarter still smells faintly of the mill.",
    "Field note — compasses refuse to settle; the iron in the ink pulls them true."
  ];
  const LMARK = ["Crane Bastion", "Blintz Beacon", "The Quiet Fold", "Misprint Obelisk",
    "Crimp Lighthouse", "Paper Crown", "Foxfold Spire", "The Waterbomb Well",
    "Dart Silos", "Petal Cistern", "Rookery Pleat", "The Silver Crease"];
  const AVE = ["Crane Diagonal", "The Long Crease", "Misprint Avenue", "Valley Way", "Cut Street", "Dart Promenade"];
  const SCRIB = ["mind the crease", "here the paper is thinnest", "watch for misprints",
    "the tram was misprinted twice", "ask the printmaker", "wind under the flap",
    "dry ink only", "sink the corner gently"];
  const TONES = [
    { sh: "#c4a87a", top: "#f0e5c6" },
    { sh: "#bfa274", top: "#ecdcc0" },
    { sh: "#b0b2a0", top: "#e7e7d3" },
    { sh: "#a4ae94", top: "#e4e6cd" },
    { sh: "#c09a82", top: "#edddc8" },
    { sh: "#b9a47e", top: "#e9ddbd" },
    { sh: "#a9a8a0", top: "#e4e2d3" },
    { sh: "#bfa25d", top: "#edddab" }
  ];
  const TONENAMES = ["cream", "bisque", "cold press", "sage", "rose", "ochre", "ash", "gilt"];
  const DENS = [
    { k: "lo", b: 0.08, t: 0.5 }, { k: "mid", b: 0.24, t: 0.22 }, { k: "hi", b: 0.4, t: 0.12 }
  ];

  /* glyph templates — small polyline bundles (coords in ±50) */
  const GLYPHS = {
    crown:  { name: "envelope fold",
      l: ["-44,-32 44,-32 44,32 -44,32 -44,-32",
          "-44,-32 0,8 44,-32", "-44,32 0,-8 44,32"] },
    star:   { name: "twin diamond",
      l: ["-46,0 0,-46 46,0 0,46 -46,0", "-24,0 0,-24 24,0 0,24 -24,0",
          "0,-46 0,46", "-46,0 46,0"] },
    fan:    { name: "crease fan",
      l: ["0,44 -46,-22 46,-22 0,44", "-10,-22 0,44", "10,-22 0,44",
          "-22,-22 0,44", "22,-22 0,44", "-34,-22 0,44", "34,-22 0,44"] },
    blintz: { name: "open blintz",
      l: ["-46,-46 46,-46 46,46 -46,46 -46,-46",
          "-46,-46 0,0", "46,-46 0,0", "-46,46 0,0", "46,46 0,0"] }
  };
  const GKEY = ["crown", "star", "fan", "blintz"];
  const glyphLines = (kind, gid) => {
    const s = [`<g id="${gid}" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linejoin="round">`];
    for (const p of GLYPHS[kind].l) s.push(`<polyline points="${p}"/>`);
    s.push("</g>");
    return s.join("");
  };

  /* ---------------- state ---------------- */
  const state = {
    seed: 0, districts: [], avenues: [], scribs: [],
    pins: [],        // array of district indices
    sel: null,       // selected district object
    showPins: true, labels: true, focusFold: false, hint: true,
    cam: { x: W / 2, y: H / 2, z: 0.3 },
    drag: null, zooming: false, toastTimer: 0, first: true
  };
  let dirty = true, anim = null;

  const mapSvg = $("map");
  let camG, bgG, worldG, fxG, pinsG, ringG, flapG;

  /* ============================================================
     WORLD GENERATION
     ============================================================ */
  const WORLD_CSS =
    ".mfont{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:600;letter-spacing:.18em}" +
    ".hfont{font-family:'Caveat','Marker Felt','Bradley Hand','Comic Sans MS',cursive;font-weight:600}" +
    ".tfont{font-family:'Special Elite','Courier New',Courier,monospace}" +
    "text{pointer-events:none}" +
    ".dpath{cursor:pointer}";

  function setWorld(seed) {
    const r = mulberry(seed >>> 0);
    state.districts = []; state.avenues = []; state.scribs = [];
    if (state.pins.length) state.pins = [];

    /* ---- build districts via voronoi (4 rows x 3 cols, relaxed once) ---- */
    const rows = 4, cols = 3, seeds = [];
    for (let i = 0; i < rows * cols; i++) {
      const rr = Math.floor(i / cols), cc = i % cols;
      seeds.push({
        x: ((cc + 0.5) * W) / cols + (r() - 0.5) * 300,
        y: ((rr + 0.5) * H) / rows + (r() - 0.5) * 230
      });
    }
    const rect = [{ x: -4, y: -4 }, { x: W + 4, y: -4 }, { x: W + 4, y: H + 4 }, { x: -4, y: H + 4 }];
    const cellOf = (i) => {
      let p = rect;
      for (let j = 0; j < seeds.length; j++) if (j !== i) {
        p = clipHalf(p, seeds[i], seeds[j]);
        if (!p.length) break;
      }
      return p;
    };
    let cells = seeds.map((_, i) => cellOf(i));
    seeds.forEach((s, i) => { const c = polyCentroid(cells[i]); s.x = c.x; s.y = c.y; });
    cells = seeds.map((_, i) => cellOf(i));

    const toneOrder = [0, 1, 2, 3, 4, 5, 6, 7, 1, 3, 5, 7]; // shuffle
    for (let i = toneOrder.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = toneOrder[i]; toneOrder[i] = toneOrder[j]; toneOrder[j] = t; }
    const densIdx = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];
    for (let i = densIdx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = densIdx[i]; densIdx[i] = densIdx[j]; densIdx[j] = t; }

    state.districts = seeds.map((s, i) => {
      const cr = mulberry((hashStr(PRE[i]) ^ seed) >>> 0);
      const c = polyCentroid(cells[i]);
      const name = PRE[i] + " " + SUF[((i * 7 + 3) % 12 + Math.floor(i / 4) * 3) % 12];
      return {
        i, name, poly: cells[i], cx: c.x, cy: c.y, seed: s,
        tone: TONES[toneOrder[i]], toneName: TONENAMES[toneOrder[i]],
        dens: DENS[densIdx[i]].k, db: DENS[densIdx[i]].b, dt: DENS[densIdx[i]].t,
        year: 1790 + Math.floor(cr() * 130),
        creases: 12 + Math.floor(cr() * 60),
        epithet: EPIT[Math.floor(cr() * EPIT.length)],
        note: NOTE[Math.floor(cr() * NOTE.length)],
        folio: String.fromCharCode(65 + i) + "-" + (1 + Math.floor(cr() * 8)),
        glyph: GKEY[i % 4], lmark: LMARK[i],
        reg: cr
      };
    });

    /* ---- avenue corridors (choose 3 crease lines) ---- */
    const linesA = [], linesB = [];
    for (let c = -H; c <= W; c += FOLD) linesA.push(c);
    for (let c = 0; c <= W + H; c += FOLD) linesB.push(c);
    const segA = (c) => {
      const p = [];
      const t = (x, y) => { if (x >= -1 && x <= W + 1 && y >= -1 && y <= H + 1) p.push({ x, y }); };
      t(0, c); t(W, c + W); t(-c, 0); t(H - c, H);
      return p.length === 2 ? p : null;
    };
    const segB = (c) => {
      const p = [];
      const t = (x, y) => { if (x >= -1 && x <= W + 1 && y >= -1 && y <= H + 1) p.push({ x, y }); };
      t(0, c); t(W, c - W); t(c, 0); t(c - H, H);
      return p.length === 2 ? p : null;
    };
    const used = new Set();
    const avPool = [];
    for (let k = 0; k < 2 && avPool.length < 3; k++) {
      const fam = k === 0 ? linesA : linesB;
      for (let n = 0; n < 40 && avPool.length < 3; n++) {
        const c = fam[2 + Math.floor(r() * (fam.length - 4))];
        if (used.has(c)) continue;
        used.add(c);
        avPool.push({ c, fam });
      }
    }
    const nameShuf = AVE.slice(); for (let i = nameShuf.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = nameShuf[i]; nameShuf[i] = nameShuf[j]; nameShuf[j] = t; }
    avPool.forEach((av, k) => {
      const seg = av.fam === 0 ? segA(av.c) : segB(av.c);
      if (!seg) return;
      const [p1, p2] = seg;
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const off = 22;
      const nx = -Math.sin(ang) * off, ny = Math.cos(ang) * off;
      state.avenues.push({
        name: nameShuf[k], p1, p2, ang,
        poly: [p1, p2].map((p) => ({ x: p.x + nx, y: p.y + ny })).concat(
          [p2, p1].map((p) => ({ x: p.x - nx, y: p.y - ny })))
      });
    });

    /* ---- marginal scribbles ---- */
    const scrIdx = [];
    for (let n = 0; n < 9; n++) scrIdx.push(Math.floor(r() * 12));
    scrIdx.forEach((di, k) => {
      const d = state.districts[di];
      for (let tries = 0; tries < 90; tries++) {
        const px = d.seed.x + (r() - 0.5) * 560;
        const py = d.seed.y + (r() - 0.5) * 420;
        if (px < 90 || px > W - 90 || py < 90 || py > H - 90) continue;
        if (!pointInPoly({ x: px, y: py }, d.poly)) continue;
        if (polyDist({ x: px, y: py }, d.poly) < 110) continue;
        if (Math.hypot(px - d.cx, py - d.cy) < 150) continue;
        state.scribs.push({ x: px, y: py, t: SCRIB[(k + di) % SCRIB.length], a: (r() - 0.5) * 14 });
        break;
      }
    });

    /* ---- assemble svg ---- */
    const defs = [];
    defs.push('<linearGradient id="pg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#f3ebd2"/><stop offset="0.55" stop-color="#e8dcbc"/>' +
      '<stop offset="1" stop-color="#d3c094"/></linearGradient>');

    // ---- bg: sheet + crease field + pleat shading ----
    const bg = [];
    bg.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#pg)" stroke="rgba(60,46,24,.55)" stroke-width="3"/>`);
    // paper stains (age the sheet)
    [["st0", "#6b4a22", 0.16, 0.16, 0.2, 0.72, 1.9], ["st1", "#45584f", 0.13, 0.74, 0.6, 0.34, 1.4],
     ["st2", "#7a5a2a", 0.1, 0.2, 0.88, 0.2, 1.1]].forEach(([id, col, a, cx, cy, rr, s]) => {
      defs.push(`<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="${a}"/>` +
        `<stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>`);
      bg.push(`<ellipse cx="${(cx * W).toFixed(0)}" cy="${(cy * H).toFixed(0)}" rx="${(s * 620).toFixed(0)}" ry="${(s * 430).toFixed(0)}" fill="url(#${id})"/>`);
    });
    bg.push('<ellipse cx="1840" cy="620" rx="560" ry="380" fill="none" stroke="#7a5a2a" stroke-width="10" opacity=".12"/>');
    bg.push('<ellipse cx="1855" cy="635" rx="560" ry="380" fill="none" stroke="#7a5a2a" stroke-width="3" opacity=".10"/>');

    // pleat shading along family A (soft diagonal bands)
    const bandDark = [], bandLight = [];
    let bi = 0;
    for (let c = -H; c <= W; c += FOLD) {
      const s = segA(c); if (!s) continue;
      const d = `M${s[0].x.toFixed(0)} ${s[0].y.toFixed(0)}L${s[1].x.toFixed(0)} ${s[1].y.toFixed(0)}`;
      if (bi % 6 === 0 || bi % 6 === 1) bandDark.push(d);
      else if (bi % 6 === 3) bandLight.push(d);
      bi++;
    }
    if (bandDark.length) bg.push(`<path d="${bandDark.join("")}" fill="none" stroke="#6b5a34" stroke-width="${FOLD}" stroke-linecap="square" opacity=".075"/>`);
    if (bandLight.length) bg.push(`<path d="${bandLight.join("")}" fill="none" stroke="#fff8e6" stroke-width="${FOLD}" stroke-linecap="square" opacity=".06"/>`);
    // hairline crease grid both families
    const thinA = [], thinB = [];
    for (let c = -H; c <= W; c += FOLD) { const s = segA(c); if (s) thinA.push(`M${nf(s[0].x)} ${nf(s[0].y)}L${nf(s[1].x)} ${nf(s[1].y)}`); }
    for (let c = 0; c <= W + H; c += FOLD) { const s = segB(c); if (s) thinB.push(`M${nf(s[0].x)} ${nf(s[0].y)}L${nf(s[1].x)} ${nf(s[1].y)}`); }
    bg.push(`<path d="${thinA.join("")}" fill="none" stroke="#8d7a50" stroke-width="1.1" opacity=".5"/>`);
    bg.push(`<path d="${thinB.join("")}" fill="none" stroke="#8d7a50" stroke-width="1.1" opacity=".5"/>`);

    // avenue corridor fills + edges
    const avFill = [], avEdge = [];
    state.avenues.forEach((av) => {
      avFill.push(`<path d="M${nf(av.poly[0].x)} ${nf(av.poly[0].y)}L${nf(av.poly[1].x)} ${nf(av.poly[1].y)}L${nf(av.poly[2].x)} ${nf(av.poly[2].y)}L${nf(av.poly[3].x)} ${nf(av.poly[3].y)}Z" fill="#e6dbb8" stroke="rgba(43,38,32,.35)" stroke-width="1.4"/>`);
      avEdge.push(`<path d="M${nf(av.p1.x)} ${nf(av.p1.y)}L${nf(av.p2.x)} ${nf(av.p2.y)}" fill="none" stroke="#b9a877" stroke-width="1"/>`);
    });
    bg.push(avFill.join(""));

    // district content
    const world = [];
    const flapRects = []; // dog-ear triangles skip test uses stored polys
    const dogears = [
      [{ x: W - 30, y: 30 }, { x: W - 190, y: 30 }, { x: W - 30, y: 190 }],
      [{ x: 30, y: H - 30 }, { x: 190, y: H - 30 }, { x: 30, y: H - 190 }]
    ];

    // candidate occupancy uses a coordinate hash (stable across districts)
    const coordRnd = (ix, iy) => mulberry((hashStr("c" + ix + "/" + iy)) >>> 0);

    for (let di = 0; di < state.districts.length; di++) {
      const d = state.districts[di];
      const rowsHtml = [];
      const cxs = Math.round(d.cx), cys = Math.round(d.cy);

      const inFlap = (px, py) => dogears.some(([a, b, c]) => inTri({ x: px, y: py }, a, b, c));

      const ncols = Math.floor(W / SP), nrows = Math.floor(H / SP);
      for (let ix = 0; ix < ncols; ix++) {
        for (let iy = 0; iy < nrows; iy++) {
          const jr = coordRnd(ix, iy);
          const px = ix * SP + (jr() - 0.5) * 14 + SP / 2;
          const py = iy * SP + (jr() - 0.5) * 14 + SP / 2;
          if (px < 60 || px > W - 60 || py < 60 || py > H - 60) continue;
          if (inFlap(px, py)) continue;
          if (!pointInPoly({ x: px, y: py }, d.poly)) continue;
          if (polyDist({ x: px, y: py }, d.poly) < 22) continue;
          if (Math.hypot(px - cxs, py - cys) < 96) continue;
          let inAv = false;
          for (const av of state.avenues)
            if (segDist({ x: px, y: py }, av.p1, av.p2) < 25) { inAv = true; break; }
          if (inAv) continue;

          const r1 = jr();
          if (r1 < d.db) {
            // ---- building: folded paper block (shadow + top) ----
            const r2 = jr();
            const w = 26 + jr() * (d.dens.k === "hi" ? 40 : 26);
            const h = 15 + jr() * (d.dens.k === "hi" ? 20 : 15);
            let fill = d.tone.top, sh = d.tone.sh;
            const r3 = jr();
            if (r3 < 0.05) { fill = "#a84023"; sh = "#7c2f18"; }
            else if (r3 < 0.12) { fill = "#49423a"; sh = "#2a251f"; }
            const x = px - w / 2, y = py - h / 2;
            rowsHtml.push(`<g>`,
              `<rect x="${nf(x + 2.4)}" y="${nf(y + 2.6)}" width="${nf(w)}" height="${nf(h)}" fill="${sh}"/>`,
              `<rect x="${nf(x)}" y="${nf(y)}" width="${nf(w)}" height="${nf(h)}" fill="${fill}" stroke="#2b2620" stroke-width=".9"/>`,
              (w > 46 && r2 < 0.6) ? `<path d="M${nf(x + 1)} ${nf(y + h / 2)}L${nf(x + w - 1)} ${nf(y + h / 2)}" stroke="rgba(43,38,32,.4)" stroke-width="1" fill="none"/>` : "",
              "</g>");
          } else if (r1 < d.db + d.dt) {
            // ---- paperwood ----
            const col = pick(jr, ["#75825f", "#84906a", "#66754f", "#8b9670"]);
            rowsHtml.push(`<path d="M${nf(px)} ${nf(py - 6)}L${nf(px + 6)} ${nf(py)}L${nf(px)} ${nf(py + 6)}L${nf(px - 6)} ${nf(py)}Z" fill="${col}" stroke="#2b2620" stroke-width=".7"/>`);
          }
        }
      }

      // ---- landmark plaza + glyph ----
      const gx = Math.round(d.cx), gy = Math.round(d.cy + 10);
      world.push(`<g id="dist-${di}" class="district">`);
      rowsHtml.forEach((s) => world.push(s));
      world.push(`<circle cx="${gx}" cy="${gy}" r="88" fill="rgba(240,233,205,.85)" stroke="#2b2620" stroke-width="1.4" stroke-dasharray="2 6" opacity=".9"/>`);
      world.push(`<g transform="translate(${gx},${gy}) scale(1.15)" stroke="#2b2620" stroke-width="2.4" fill="none" opacity=".92">`);
      for (const p of GLYPHS[d.glyph].l) world.push(`<polyline points="${p}"/>`);
      world.push("</g>");
      // name print
      world.push(`<text x="${cxs}" y="${cys - 46}" text-anchor="middle" class="mfont printlabel" font-size="30" letter-spacing="5" paint-order="stroke" stroke="#f0e6ca" stroke-width="6" stroke-linejoin="round">${d.name.toUpperCase()}</text>`);
      world.push(`<text x="${cxs}" y="${cys - 26}" text-anchor="middle" class="hfont lab" font-size="19" fill="#8a4a2c" opacity=".85">est. ${d.year}</text>`);
      // district seam + misprint echo
      const bnd = polyScale(d.poly, 0.992, d.cx, d.cy);
      const bp = bnd.map((p) => `${nf(p.x)},${nf(p.y)}`).join(" ");
      world.push(`<polygon points="${bp}" fill="none" stroke="#33556b" stroke-width="2.6" stroke-dasharray="10 7" opacity=".4" transform="translate(-3 1.6)"/>`);
      world.push(`<polygon points="${bp}" fill="none" stroke="#a84023" stroke-width="2.6" stroke-dasharray="10 7" opacity=".9"/>`);
      // interaction target (tabbable)
      world.push(`<path d="M${polyScale(d.poly, 1.0, d.cx, d.cy).map((p) => `${(p.x).toFixed(1)} ${(p.y).toFixed(1)}`).join("L")}Z" class="dpath" pointer-events="all" fill="none" tabindex="0" role="button" aria-label="Unfold ${d.name} district" data-di="${di}"><title>${d.name} — ${d.epithet}. Press Enter to unfold.</title></path>`);
      world.push("</g>");
    }

    // avenue centerlines + labels above district content (kept in one dimmable group)
    state.avenues.forEach((av) => {
      const m = { x: (av.p1.x + av.p2.x) / 2, y: (av.p1.y + av.p2.y) / 2 };
      let deg = (av.ang * 180) / Math.PI;
      if (deg > 90 || deg < -90) deg += 180;
      const avParts = [];
      avParts.push(`<path d="M${nf(av.p1.x)} ${nf(av.p1.y)}L${nf(av.p2.x)} ${nf(av.p2.y)}" fill="none" stroke="#2b2620" stroke-width="1.7" stroke-dasharray="2 14" opacity=".6"/>`);
      avParts.push(`<text x="${nf(m.x)}" y="${nf(m.y - 34)}" text-anchor="middle" class="mfont lab" font-size="19" letter-spacing="3" fill="#2b2620" transform="rotate(${nf(deg)} ${nf(m.x)} ${nf(m.y)})" paint-order="stroke" stroke="#e9dfc4" stroke-width="5" opacity=".92">${av.name.toUpperCase()}</text>`);
      world.push(`<g class="glab">${avParts.join("")}</g>`);
    });

    // marginal scribbles
    state.scribs.forEach((sc) => {
      world.push(`<text x="${nf(sc.x)}" y="${nf(sc.y)}" text-anchor="middle" class="hfont lab" font-size="23" fill="#a84023" transform="rotate(${nf(sc.a)} ${nf(sc.x)} ${nf(sc.y)})" opacity=".85" paint-order="stroke" stroke="#efe6cb" stroke-width="3">${sc.t}</text>`);
    });

    // dog-ear folded corners
    const flap = [];
    const tri1 = dogears[0], tri2 = dogears[1];
    flap.push(`<path d="M${tri1[1].x} ${tri1[1].y}L${tri1[0].x} ${tri1[0].y}L${tri1[2].x} ${tri1[2].y}L${tri1[1].x + 3} ${tri1[1].y - 1}L${tri1[2].x + 3} ${tri1[2].y - 4}L${tri1[1].x} ${tri1[1].y}Z" fill="rgba(40,30,14,.20)"/>`);
    flap.push(`<path d="M${tri1[1].x} ${tri1[1].y}L${tri1[0].x} ${tri1[0].y}L${tri1[2].x} ${tri1[2].y}Z" fill="#cfc2a0"/>`);
    flap.push(`<path d="M${tri1[1].x} ${tri1[1].y}L${tri1[0].x} ${tri1[0].y}L${tri1[2].x} ${tri1[2].y}Z" fill="none" stroke="#8d7a50" stroke-width="2"/>`);
    flap.push(`<path d="M${tri1[1].x} ${tri1[1].y}L${tri1[2].x} ${tri1[2].y}" fill="none" stroke="#2b2620" stroke-width="2.4"/>`);
    // second corner
    flap.push(`<path d="M${tri2[1].x} ${tri2[1].y}L${tri2[0].x} ${tri2[0].y}L${tri2[2].x} ${tri2[2].y}L${tri2[1].x + 4} ${tri2[1].y - 1}L${tri2[2].x + 2} ${tri2[2].y - 3}L${tri2[1].x} ${tri2[1].y}Z" fill="rgba(40,30,14,.20)"/>`);
    flap.push(`<path d="M${tri2[1].x} ${tri2[1].y}L${tri2[0].x} ${tri2[0].y}L${tri2[2].x} ${tri2[2].y}Z" fill="#c9bda0"/>`);
    flap.push(`<path d="M${tri2[1].x} ${tri2[1].y}L${tri2[0].x} ${tri2[0].y}L${tri2[2].x} ${tri2[2].y}Z" fill="none" stroke="#8d7a50" stroke-width="2"/>`);
    flap.push(`<path d="M${tri2[1].x} ${tri2[1].y}L${tri2[2].x} ${tri2[2].y}" fill="none" stroke="#2b2620" stroke-width="2.4"/>`);

    mapSvg.innerHTML =
      `<style>${WORLD_CSS}</style>` +
      `<defs>${defs.join("")}</defs>` +
      `<g id="camera"><g id="bg">${bg.join("")}</g>` +
      `<g id="world">${world.join("")}</g>` +
      `<g id="flaps">${flap.join("")}</g>` +
      `<g id="fx" pointer-events="none"></g></g>`;

    camG = $("camera"); bgG = $("bg"); worldG = $("world"); fxG = $("fx");
    pinsG = null; ringG = null; flapG = $("flaps");
    // fx children need pointer events for pins; handled on root anyway
    fxG.setAttribute("pointer-events", "none");
  }

  /* ============================================================
     CAMERA / PAN / ZOOM
     ============================================================ */
  let cw = 1, ch = 1, fitZ = 0.3;
  const vw = () => cw, vh = () => ch;

  function sizeSvg() {
    cw = mapSvg.clientWidth || window.innerWidth;
    ch = mapSvg.clientHeight || window.innerHeight;
    mapSvg.setAttribute("width", cw);
    mapSvg.setAttribute("height", ch);
    mapSvg.setAttribute("viewBox", `0 0 ${cw} ${ch}`);
    fitZ = Math.max(0.03, Math.min((cw - 56) / W, (ch - 56) / H));
  }
  window.addEventListener("resize", () => { sizeSvg(); clampCam(); dirty = true; });

  function clampCam() {
    state.cam.x = clamp(state.cam.x, 0, W);
    state.cam.y = clamp(state.cam.y, 0, H);
  }
  function applyTransform() {
    if (!camG) return;
    const c = state.cam;
    const t = `translate(${(cw / 2).toFixed(2)} ${(ch / 2).toFixed(2)}) scale(${c.z}) translate(${(-c.x).toFixed(2)} ${(-c.y).toFixed(2)})`;
    camG.setAttribute("transform", t);
    updateCoord();
  }
  function updateCoord() {
    const c = state.cam;
    const pct = Math.round((c.z / fitZ) * 100);
    const col = String.fromCharCode(65 + Math.floor(c.x / (W / 12)));
    const row = 1 + Math.floor(c.y / (H / 9));
    $("coord").textContent = `folio ${col}-${row} · ${Math.round(c.x)},${Math.round(c.y)} · zoom ${pct}%`;
  }
  function animateTo(tx, ty, tz, dur) {
    const c = state.cam, t0 = performance.now();
    const sx = c.x, sy = c.y, sz = c.z;
    anim = {
      t0, dur: dur || 720,
      step(now) {
        const k = clamp((now - t0) / (dur || 720), 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        c.x = sx + (tx - sx) * e; c.y = sy + (ty - sy) * e; c.z = sz + (tz - sz) * e;
        clampCam();
        return k >= 1;
      }
    };
  }
  function flyTo(cx, cy, z, dur) { animateTo(clamp(cx, 0, W), clamp(cy, 0, H), z, dur); }
  function zoomScreen(factor, ax, ay) {
    const c = state.cam;
    const z2 = clamp(c.z * factor, fitZ * 0.18, fitZ * 7.5);
    const k = z2 / c.z;
    if (ax !== undefined) {
      c.x = ax - (ax - c.x) * k;
      c.y = ay - (ay - c.y) * k;
    }
    c.z = z2;
    clampCam();
  }

  /* ---- key states & rAF loop ---- */
  const keys = {};
  let lastT = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!camG) return;
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    let moved = false;
    const c = state.cam;
    const spd = (760 / c.z) * dt;
    if (keys.l) { c.x -= spd; moved = true; }
    if (keys.r) { c.x += spd; moved = true; }
    if (keys.u) { c.y -= spd; moved = true; }
    if (keys.d) { c.y += spd; moved = true; }
    if (moved) clampCam();
    if (anim) { if (anim.step(now)) anim = null; moved = true; }
    if (moved || dirty) { applyTransform(); dirty = false; }
  }
  requestAnimationFrame(frame);

  /* ============================================================
     POINTER: drag to pan, wheel & pinch to zoom, click selects
     ============================================================ */
  const PTR = {};
  function worldAt(ev) {
    const r = mapSvg.getBoundingClientRect();
    return {
      x: state.cam.x + (ev.clientX - r.left - cw / 2) / state.cam.z,
      y: state.cam.y + (ev.clientY - r.top - ch / 2) / state.cam.z
    };
  }
  function pinchBaseline() {
    const ids = Object.keys(PTR).filter((k) => k !== "_pinch").map(Number);
    if (ids.length !== 2) { delete PTR._pinch; return; }
    const a = PTR[ids[0]], b = PTR[ids[1]];
    PTR._pinch = {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2
    };
  }
  mapSvg.addEventListener("pointerdown", (ev) => {
    mapSvg.setPointerCapture(ev.pointerId);
    const el = ev.target.closest ? ev.target.closest(".dpath, .pinflag") : null;
    PTR[ev.pointerId] = { x: ev.clientX, y: ev.clientY, moved: 0, el };
    pinchBaseline();
  });
  mapSvg.addEventListener("pointermove", (ev) => {
    const p = PTR[ev.pointerId];
    if (!p) return;
    const ids = Object.keys(PTR).filter((k) => k !== "_pinch").map(Number);
    if (ids.length === 2) {
      const oid = ids[0] === ev.pointerId ? ids[1] : ids[0];
      const o = PTR[oid];
      const pb = PTR._pinch;
      const nd = Math.hypot(ev.clientX - o.x, ev.clientY - o.y);
      if (pb && pb.dist > 0) {
        const mx = (ev.clientX + o.x) / 2, my = (ev.clientY + o.y) / 2;
        const r = mapSvg.getBoundingClientRect();
        const ax = state.cam.x + (mx - r.left - cw / 2) / state.cam.z;
        const ay = state.cam.y + (my - r.top - ch / 2) / state.cam.z;
        zoomScreen(nd / pb.dist, ax, ay);
        dirty = true;
      }
      PTR._pinch = { dist: nd, mx: (ev.clientX + o.x) / 2, my: (ev.clientY + o.y) / 2 };
      return;
    }
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    p.moved += Math.abs(dx) + Math.abs(dy);
    if (p.moved > 6) {
      state.cam.x -= dx / state.cam.z;
      state.cam.y -= dy / state.cam.z;
      clampCam();
      dirty = true;
    }
    p.x = ev.clientX; p.y = ev.clientY;
  });
  function endPtr(ev) {
    const p = PTR[ev.pointerId];
    delete PTR[ev.pointerId];
    delete PTR._pinch;
    if (!p) return;
    if (p.moved <= 6 && p.el) {
      if (p.el.classList.contains("dpath")) selectDistrict(+p.el.dataset.di, true);
      else if (p.el.classList.contains("pinflag")) jumpPin(+p.el.dataset.pin);
    } else if (p.moved <= 6 && state.sel) {
      closePanel();
    }
  }
  mapSvg.addEventListener("pointerup", endPtr);
  mapSvg.addEventListener("pointercancel", (ev) => { delete PTR[ev.pointerId]; delete PTR._pinch; });
  mapSvg.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const w = worldAt(ev);
    zoomScreen(Math.pow(1.0016, -ev.deltaY), w.x, w.y);
    dirty = true;
  }, { passive: false });
  // district focus styling
  mapSvg.addEventListener("focusin", (ev) => {
    const p = ev.target;
    if (p.classList && p.classList.contains("dpath")) p.style.outline = "3px dashed #a84023";
  });
  mapSvg.addEventListener("focusout", (ev) => {
    if (ev.target.style) ev.target.style.outline = "";
  });

  /* ============================================================
     DISTRICT SELECTION + UNFOLD PANEL
     ============================================================ */
  const panel = $("panel");
  function selectDistrict(di, focusFly) {
    const d = state.districts[di];
    if (!d) return;
    state.sel = d;
    document.body.classList.add("selmode");
    if (state.focusFold) document.body.classList.add("focusmode");
    fillPanel(d);
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("open"));
    drawRing(d);
    if (focusFly) {
      const w = panel.clientWidth || 340;
      const z = clamp(Math.min((cw - w - 120) / 520, (ch - 220) / 380), 0.5, 2.6);
      flyTo(d.cx - (w * 0.36) / z, d.cy, Math.max(state.cam.z, z), 700);
    }
  }
  function closePanel() {
    state.sel = null;
    panel.classList.remove("open");
    panel.hidden = true;
    document.body.classList.remove("selmode", "focusmode");
    clearRing();
    const ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains("dpath")) ae.blur();
    dirty = true;
  }
  function drawRing(d) {
    clearRing();
    ringG = document.createElementNS(NS, "g");
    const pts = (poly) => poly.map((p) => `${nf(p.x)},${nf(p.y)}`).join(" ");
    const ring1 = polyScale(d.poly, 1.035, d.cx, d.cy);
    const ring2 = polyScale(d.poly, 1.07, d.cx, d.cy);
    const mk = (poly, cls, dash, sw, color, op) => {
      const el = document.createElementNS(NS, "polygon");
      el.setAttribute("points", pts(poly));
      el.setAttribute("fill", "none");
      el.setAttribute("stroke", color);
      el.setAttribute("stroke-width", sw);
      el.setAttribute("stroke-dasharray", dash);
      el.setAttribute("opacity", op);
      el.classList.add(cls);
      ringG.appendChild(el);
    };
    mk(ring2, "ring", "3 9", 6, "#f0e6ca", 0.9);
    mk(ring1, "ring", "3 9", 4, "#a84023", 1);
    fxG.appendChild(ringG);
  }
  function clearRing() { if (ringG) ringG.remove(); ringG = null; }

  function fillPanel(d) {
    $("pname").textContent = d.name;
    $("pep").textContent = d.epithet + ".";
    $("pnote").textContent = d.note;
    $("pfounded").textContent = d.year;
    $("pcreases").textContent = d.creases;
    $("pdensity").textContent = d.dens.k === "lo" ? "loose" : d.dens.k === "mid" ? "settled" : "packed";
    $("ptone").textContent = d.toneName;
    $("pfolio").textContent = d.folio;
    $("plm").textContent = d.lmark;
    const g = $("pglyph");
    g.innerHTML = glyphLines(d.glyph, "gpanel");
    const pinBtn = panel.querySelector('[data-act="pin"]');
    pinBtn.textContent = state.pins.indexOf(d.i) >= 0 ? "unpin flag" : "pin flag";
  }

  /* ============================================================
     PINS
     ============================================================ */
  function drawPins() {
    if (pinsG) pinsG.remove();
    pinsG = document.createElementNS(NS, "g");
    const show = state.showPins;
    state.pins.forEach((di, n) => {
      const d = state.districts[di];
      const g = document.createElementNS(NS, "g");
      g.classList.add("pinflag");
      g.setAttribute("data-pin", n);
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", "Jump to pin " + (n + 1) + ", " + d.name);
      g.style.cursor = "pointer";
      const gx = d.cx, gy = d.cy - 40;
      const mk = document.createElementNS(NS, "g");
      mk.innerHTML = `<g transform="translate(${nf(gx)},${nf(gy)})">
        <path d="M0 0 L0 52" stroke="#2b2620" stroke-width="4" stroke-linecap="round"/>
        <path d="M0 2 L34 16 L0 28 Z" fill="#a84023" stroke="#2b2620" stroke-width="2.6" stroke-linejoin="round"/>
        <circle cx="0" cy="54" r="5" fill="#a84023" stroke="#2b2620" stroke-width="2"/>
        <circle cx="15" cy="15" r="8" fill="#f0e6ca" stroke="#2b2620" stroke-width="2"/>
        <text x="15" y="19" text-anchor="middle" class="mfont" font-size="11" fill="#2b2620">${n + 1}</text></g>`;
      while (mk.firstChild) g.appendChild(mk.firstChild);
      pinsG.appendChild(g);
    });
    fxG.appendChild(pinsG);
    pinsG.setAttribute("opacity", show ? 1 : 0.12);
    renderPinTray();
  }
  function renderPinTray() {
    const tray = $("pintray");
    tray.innerHTML = "";
    if (!state.showPins) return;
    state.pins.forEach((di, n) => {
      const d = state.districts[di];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pinchip";
      b.innerHTML = `<i>${n + 1}</i><span>${d.name}</span>`;
      b.addEventListener("click", () => jumpPin(n));
      tray.appendChild(b);
    });
  }
  function togglePin(di) {
    const at = state.pins.indexOf(di);
    if (at >= 0) state.pins.splice(at, 1);
    else { if (state.pins.length >= 6) state.pins.shift(); state.pins.push(di); }
    drawPins();
  }
  function jumpPin(n) {
    const d = state.districts[state.pins[n]];
    if (!d) return;
    closePanel();
    flyTo(d.cx, d.cy, Math.max(state.cam.z, fitZ * 2.2), 640);
  }

  /* ============================================================
     TOAST + TOOLBAR
     ============================================================ */
  const toastEl = $("toast");
  function toast(html, ms) {
    toastEl.innerHTML = html;
    toastEl.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toastEl.classList.remove("show"), ms || 2600);
  }

  document.getElementById("tools").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "new") newSheet();
    else if (act === "fit") fitSheet();
    else if (act === "fold") toggleFocus();
    else if (act === "pins") {
      state.showPins = !state.showPins;
      b.classList.toggle("on", state.showPins);
      drawPins();
    } else if (act === "labels") {
      state.labels = !state.labels;
      document.body.classList.toggle("nolabels", !state.labels);
      b.classList.toggle("on", state.labels);
    }
  });
  panel.addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "locate") selectDistrict(state.sel.i, true);
    else if (act === "pin") { togglePin(state.sel.i); fillPanel(state.sel); }
    else if (act === "close") closePanel();
  });
  const exportMenu = $("exportMenu");
  exportMenu.querySelector(".exp-body").addEventListener("click", (ev) => {
    const b = ev.target.closest("button[data-exp]");
    if (!b) return;
    const act = b.dataset.exp;
    if (act === "png") exportPNG();
    else if (act === "svg") exportSVG();
    else if (act === "link") copyLink();
    else if (act === "print") printSheet();
  });

  function fitSheet() {
    closePanel();
    flyTo(W / 2, H / 2, fitZ * 0.98, 700);
    dirty = true;
  }
  function syncFocusBtn() {
    const b = document.querySelector('[data-act="fold"]');
    if (!b) return;
    b.classList.toggle("on", state.focusFold);
    const t = b.querySelector("b");
    if (t) t.textContent = state.focusFold ? "unfold" : "focus";
  }
  function toggleFocus() {
    state.focusFold = !state.focusFold;
    if (state.focusFold && !state.sel) { toast("pick a district first — <kbd>tab</kbd> + <kbd>enter</kbd>"); state.focusFold = false; return; }
    document.body.classList.toggle("focusmode", state.focusFold && !!state.sel);
    syncFocusBtn();
    dirty = true;
  }

  function newSheet() {
    state.seed = Math.floor(Math.random() * 1e9);
    closePanel();
    state.focusFold = false; syncFocusBtn();
    setWorld(state.seed);
    localStorage.setItem("foldedcity", String(state.seed));
    writeHash(true);
    fitSheet();
    $("sheetno").textContent = pad(String(state.seed).slice(-4));
    drawPins();
    toast("crumpled a fresh sheet — nº " + String(state.seed).slice(-4));
  }

  /* ============================================================
     SHARE / EXPORT
     ============================================================ */
  const rootStyle = () => { // returns cloned <style> content w/ optional font import
    const clone = mapSvg.querySelector("style").cloneNode(true);
    return clone.textContent;
  };
  function exportMarkup(rect, opt) {
    const xml = [];
    xml.push('<svg xmlns="http://www.w3.org/2000/svg"');
    if (rect) {
      xml.push(` viewBox="${rect.x} ${rect.y} ${rect.w} ${rect.h}" width="${rect.w}px" height="${rect.h}px"`);
    } else {
      xml.push(` viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"`);
    }
    xml.push('>');
    const style = rootStyle();
    const extra = opt && opt.importFonts
      ? "@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Oswald:wght@400;500;600;700&family=Special+Elite&display=swap');\n"
      : "";
    xml.push(`<style>${extra}${style}</style>`);
    const defs = mapSvg.querySelector("defs").cloneNode(true);
    xml.push(new XMLSerializer().serializeToString(defs).replace(/^<defs[^>]*>/, "<defs>").replace(/<\/defs>$/, ""));
    xml.push(bgG.innerHTML);
    xml.push(worldG.innerHTML);
    xml.push(flapG.innerHTML);
    xml.push("</svg>");
    return xml.join("");
  }
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function exportSVG() {
    const xml = exportMarkup(null, { importFonts: true });
    download("folded-city-poster-" + state.seed + ".svg", xml, "image/svg+xml");
    toast("full poster saved · .svg");
  }
  function exportPNG() {
    const c = state.cam;
    const scale = 2;
    const rw = cw / c.z, rh = ch / c.z;
    const rect = { x: c.x - rw / 2, y: c.y - rh / 2, w: rw, h: rh };
    const xml = exportMarkup(rect, { importFonts: false });
    const svgBlob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = Math.round(rw * scale); cv.height = Math.round(rh * scale);
      const g = cv.getContext("2d");
      g.fillStyle = "#e7dcc0";
      g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "folded-city-snapshot-" + state.seed + ".png";
        a.click();
        toast("snapshot saved · .png");
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.onerror = () => toast("snapshot failed — try the .svg poster instead");
    img.src = url;
  }
  function printSheet() {
    const holder = document.createElement("div");
    holder.id = "printSheet";
    holder.innerHTML = exportMarkup(null, { importFonts: false });
    document.body.appendChild(holder);
    document.body.classList.add("printing");
    const close = () => { document.body.classList.remove("printing"); holder.remove(); };
    window.onafterprint = close;
    window.print();
    setTimeout(close, 2000);
  }
  function shareParams() {
    const c = state.cam;
    const p = { s: state.seed, x: Math.round(c.x), y: Math.round(c.y), z: +c.z.toFixed(4) };
    if (state.pins.length) p.pi = state.pins.join(",");
    if (state.sel) p.d = state.sel.i;
    return Object.keys(p).map((k) => k + "=" + p[k]).join("&");
  }
  function writeHash(move) {
    const q = shareParams();
    try { history.replaceState(null, "", "#" + q); } catch (e) { location.hash = q; }
    if (move) {}
  }
  function copyLink() {
    writeHash();
    const link = location.href;
    const done = () => toast(`share-link copied<br><span class="link">${link}</span>`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(done).catch(() => fallbackCopy(link, done));
    } else fallbackCopy(link, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    ta.remove(); done();
  }
  function readHash() {
    const h = location.hash.replace(/^#/, "");
    if (!h) return null;
    const p = {};
    h.split("&").forEach((kv) => { const [k, v] = kv.split("="); p[k] = decodeURIComponent(v || ""); });
    return p;
  }

  /* ============================================================
     KEYBOARD
     ============================================================ */
  const toDirKey = { KeyA: "l", KeyD: "r", KeyW: "u", KeyS: "d",
    ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d" };
  const dirByKey = { arrowleft: "l", arrowright: "r", arrowup: "u", arrowdown: "d", a: "l", d: "r", w: "u", s: "d" };
  window.addEventListener("keydown", (ev) => {
    const dir = toDirKey[ev.code] || dirByKey[String(ev.key).toLowerCase()];
    if (dir) { keys[dir] = true; ev.preventDefault(); return; }
    if (ev.key === "Shift") return;
    if (ev.repeat) return;
    const et = ev.target;
    if (et && (et.tagName === "INPUT" || et.tagName === "TEXTAREA")) return;
    const isDpath = et && et.classList && et.classList.contains("dpath");
    switch (ev.key) {
      case "Enter": case " ":
        if (isDpath) { ev.preventDefault(); selectDistrict(+et.dataset.di, true); }
        break;
      case "Escape":
        if (exportMenu.open) { exportMenu.open = false; }
        else if (state.sel) { closePanel(); }
        else if (isDpath) { et.blur(); }
        break;
      case "+": case "=": zoomScreen(1.3); dirty = true; break;
      case "-": case "_": zoomScreen(1 / 1.3); dirty = true; break;
      case "r": case "R": fitSheet(); break;
      case "n": case "N": newSheet(); break;
      case "f": case "F": toggleFocus(); break;
      case "p": case "P": document.querySelector('[data-act="pins"]').click(); break;
      case "l": case "L": document.querySelector('[data-act="labels"]').click(); break;
      case "h": case "H":
        state.hint = !state.hint;
        $("hint").style.display = state.hint ? "" : "none";
        break;
      default:
        if (ev.key >= "1" && ev.key <= "6") {
          const n = +ev.key - 1;
          if (n < state.pins.length) { jumpPin(n); ev.preventDefault(); }
        }
    }
  });
  window.addEventListener("keyup", (ev) => {
    const dir = toDirKey[ev.code] || dirByKey[String(ev.key).toLowerCase()];
    if (dir) keys[dir] = false;
  });
  window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    sizeSvg();
    const h = readHash();
    let seed;
    if (h && h.s) seed = +h.s;
    else {
      const saved = localStorage.getItem("foldedcity");
      seed = saved ? +saved : Math.floor(Math.random() * 1e9);
    }
    state.seed = seed >>> 0;
    setWorld(state.seed);
    $("sheetno").textContent = pad(String(state.seed).slice(-4));
    localStorage.setItem("foldedcity", String(state.seed));
    drawPins();

    if (h) {
      if (h.pi) state.pins = h.pi.split(",").map(Number).filter((n) => n >= 0 && n < 12);
      if (state.pins.length) { drawPins(); }
      if (h.d) { const di = +h.d; if (di >= 0 && di < 12) selectDistrict(di, false); }
      if (h.x && h.y && h.z) {
        state.cam.x = clamp(+h.x, 0, W);
        state.cam.y = clamp(+h.y, 0, H);
        state.cam.z = clamp(+h.z, fitZ * 0.18, fitZ * 7.5);
      } else fitSheet();
    } else {
      // gentle opening move
      state.cam.x = W / 2; state.cam.y = H / 2;
      state.cam.z = fitZ * 1.6;
      flyTo(W / 2, H / 2, fitZ * 0.98, 1200);
    }
    dirty = true;
    document.body.classList.remove("boot");
    syncFocusBtn();
    document.querySelector('[data-act="labels"]').classList.toggle("on", state.labels);
    // welcome only once per session, dismissible
    if (!sessionStorage.getItem("foldedcity-visited")) {
      sessionStorage.setItem("foldedcity-visited", "1");
      setTimeout(() => toast("FOLDED CITY · pan with <kbd>←↑↓→</kbd>, <kbd>tab</kbd> a district, <kbd>enter</kbd> to unfold", 4200), 600);
    }
    // share updates push hash after settle
    setTimeout(() => { try { if (!location.hash) writeHash(); } catch (e) {} }, 1500);
  }
  function pad(s) { while (s.length < 4) s = "0" + s; return s; }

  boot();
})();
