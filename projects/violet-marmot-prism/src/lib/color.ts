// Color science helpers for Violet Marmot Prism.
// All pure functions — no DOM, no side effects.

export interface Stop {
  id: string;
  color: string; // #rrggbb
  pos: number; // 0..100
}

export type Vision = 'true' | 'protan' | 'deutan' | 'tritan' | 'achroma';
export type GradType = 'linear' | 'radial' | 'conic';
export type Harmony = 'analogous' | 'complement' | 'triadic' | 'mono' | 'wild';

export const VISION_LABELS: Record<Vision, string> = {
  true: 'True Sight',
  protan: 'Protanopia',
  deutan: 'Deuteranopia',
  tritan: 'Tritanopia',
  achroma: 'Achroma',
};

export const HARMONY_LABELS: Record<Harmony, string> = {
  analogous: 'Analogous',
  complement: 'Complement',
  triadic: 'Triadic',
  mono: 'Monochrome',
  wild: 'Wild',
};

export function normalizeHex(v: string): string | null {
  let h = v.trim().toLowerCase();
  if (!h.startsWith('#')) h = '#' + h;
  const m = h.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!m) return null;
  if (m[1].length === 3) {
    return '#' + m[1].split('').map((c) => c + c).join('');
  }
  return h;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? '#000000';
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// --- WCAG contrast ----------------------------------------------------------

function channel(c: number): number {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

export type Grade = 'AAA' | 'AA' | 'AA-large' | 'fail';
export function grade(ratio: number): Grade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

// --- Color-blind simulation (Machado et al. 2009 matrices) -------------------

const MATRICES: Record<Exclude<Vision, 'true'>, number[][]> = {
  protan: [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
  deutan: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
  tritan: [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
  achroma: [[0.299, 0.587, 0.114], [0.299, 0.587, 0.114], [0.299, 0.587, 0.114]],
};

export function simulate(hex: string, vision: Vision): string {
  if (vision === 'true') return normalizeHex(hex) ?? hex;
  const [r, g, b] = hexToRgb(hex);
  const m = MATRICES[vision];
  return rgbToHex(
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  );
}

// --- Gradient CSS ------------------------------------------------------------

export function sortedStops(stops: Stop[]): Stop[] {
  return [...stops].sort((a, b) => a.pos - b.pos);
}

export function gradientCss(stops: Stop[], type: GradType, angle: number): string {
  const s = sortedStops(stops)
    .map((t) => `${t.color} ${Math.round(t.pos)}%`)
    .join(', ');
  if (type === 'radial') return `radial-gradient(circle at 50% ${Math.round(angle / 3.6)}%, ${s})`;
  if (type === 'conic') return `conic-gradient(from ${Math.round(angle)}deg, ${s})`;
  return `linear-gradient(${Math.round(angle)}deg, ${s})`;
}

// --- Harmony dice ------------------------------------------------------------

const rnd = (min: number, max: number) => min + Math.random() * (max - min);

export function rollHarmony(mode: Harmony): string[] {
  const base = rnd(0, 360);
  switch (mode) {
    case 'analogous': {
      const step = rnd(22, 38);
      return [
        hslToHex(base - step, rnd(55, 80), rnd(42, 58)),
        hslToHex(base, rnd(60, 85), rnd(48, 62)),
        hslToHex(base + step, rnd(55, 80), rnd(42, 58)),
      ];
    }
    case 'complement': {
      const comp = base + 180 + rnd(-14, 14);
      return [
        hslToHex(base, rnd(60, 85), rnd(45, 55)),
        hslToHex((base + comp) / 2 + rnd(-20, 20), rnd(40, 60), rnd(35, 50)),
        hslToHex(comp, rnd(60, 85), rnd(48, 60)),
      ];
    }
    case 'triadic': {
      return [0, 120, 240].map((off, i) =>
        hslToHex(base + off + rnd(-10, 10), rnd(55, 80), i === 1 ? rnd(50, 62) : rnd(42, 56)),
      );
    }
    case 'mono': {
      const sat = rnd(45, 75);
      return [rnd(28, 38), rnd(48, 56), rnd(64, 74)].map((l) =>
        hslToHex(base + rnd(-8, 8), sat, l),
      );
    }
    case 'wild':
    default: {
      const sat = rnd(55, 90);
      return [0, 1, 2].map(() => hslToHex(rnd(0, 360), sat, rnd(40, 62)));
    }
  }
}

// --- Export formats ----------------------------------------------------------

export type ExportFormat = 'css' | 'tailwind' | 'svg' | 'json';

export function buildExport(format: ExportFormat, stops: Stop[], type: GradType, angle: number): string {
  const s = sortedStops(stops);
  if (format === 'css') {
    const vars = s.map((t, i) => `  --prism-${i + 1}: ${t.color};`).join('\n');
    return `:root {\n${vars}\n}\n\n.prism-gradient {\n  background: ${gradientCss(s, type, angle)};\n}`;
  }
  if (format === 'tailwind') {
    const colors = s.map((t, i) => `        'prism-${i + 1}': '${t.color}',`).join('\n');
    return `// tailwind.config.js — theme.extend\ncolors: {\n${colors}\n}\n\n// usage:\n// <div className="bg-[${gradientCss(s, type, angle)}]" />`;
  }
  if (format === 'svg') {
    const gradStops = s.map((t) => `    <stop offset="${Math.round(t.pos)}%" stop-color="${t.color}" />`).join('\n');
    if (type === 'radial') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">\n  <defs>\n    <radialGradient id="prism" cx="50%" cy="50%" r="50%">\n${gradStops}\n    </radialGradient>\n  </defs>\n  <rect width="800" height="450" fill="url(#prism)" />\n</svg>`;
    }
    // SVG has no conic gradients — approximate with an angled linear gradient.
    const note = type === 'conic' ? '\n  <!-- conic approximated as linear: SVG has no conic-gradient -->' : '';
    const rad = ((angle - 90) * Math.PI) / 180;
    const x = (50 + 50 * Math.cos(rad)).toFixed(1);
    const y = (50 + 50 * Math.sin(rad)).toFixed(1);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450">${note}\n  <defs>\n    <linearGradient id="prism" x1="${(100 - Number(x)).toFixed(1)}%" y1="${(100 - Number(y)).toFixed(1)}%" x2="${x}%" y2="${y}%">\n${gradStops}\n    </linearGradient>\n  </defs>\n  <rect width="800" height="450" fill="url(#prism)" />\n</svg>`;
  }
  return JSON.stringify(
    { name: 'violet-marmot-prism', type, angle: Math.round(angle), stops: s.map((t) => ({ color: t.color, pos: Math.round(t.pos) })) },
    null,
    2,
  );
}

// --- Share URL ----------------------------------------------------------------

export function encodeHash(stops: Stop[], type: GradType, angle: number): string {
  const p = new URLSearchParams();
  p.set('stops', sortedStops(stops).map((t) => `${t.color.replace('#', '')}@${Math.round(t.pos)}`).join(','));
  p.set('type', type);
  p.set('angle', String(Math.round(angle)));
  return '#' + p.toString();
}

export function decodeHash(hash: string): { stops: Stop[]; type: GradType; angle: number } | null {
  try {
    const h = hash.startsWith('#') ? hash.slice(1) : hash;
    const p = new URLSearchParams(h);
    const raw = p.get('stops');
    if (!raw) return null;
    const stops: Stop[] = [];
    for (const part of raw.split(',')) {
      const [c, pos] = part.split('@');
      const hex = normalizeHex('#' + c);
      if (!hex) continue;
      stops.push({ id: Math.random().toString(36).slice(2), color: hex, pos: Math.max(0, Math.min(100, Number(pos) || 0)) });
    }
    if (stops.length < 2 || stops.length > 5) return null;
    const type = p.get('type');
    const t: GradType = type === 'radial' || type === 'conic' ? type : 'linear';
    return { stops, type: t, angle: Math.max(0, Math.min(360, Number(p.get('angle')) || 135)) };
  } catch {
    return null;
  }
}
