import { useMemo } from 'react';

/* Bitmap frames: '.' = transparent. Palette keys map chars to colors. */

const MOTH_A = [
  '.....cc.....',
  '....cwwc....',
  '...cwwwwc...',
  '...cwwwwc...',
  '..cwwkkwwc..',
  '.cwwkwkkwwc.',
  '.cwkwwwwkwc.',
  '..ckwwwwkc..',
  '...ckwwkc...',
  '....ckkc....',
];

const MOTH_B = [
  '............',
  '.....cc.....',
  '....cwwc....',
  '...cwwwwc...',
  '...cwwwwc...',
  '..cwwkkwwc..',
  '..cwkwwkwc..',
  '..ckwwwwkc..',
  '...ckkkkc...',
  '............',
];

const LUNA_A = [
  '......gg......',
  '.....gggg.....',
  '....gggggg....',
  '...gggggggg...',
  '..gggkggkggg..',
  '..ggwwwwwwgg..',
  '.ggwwkwkwwgg.',
  '.ggwwwwwwwwgg.',
  '..ggwwwwwwgg..',
  '...gwwkkwwg...',
  '...gwkggkwg...',
  '...g.g..g.g...',
  '......gg......',
];

const LUNA_B = [
  '..............',
  '......gg......',
  '.....gggg.....',
  '....gggggg....',
  '...gggggggg...',
  '..gggkggkggg..',
  '..ggwwwwwwgg..',
  '..ggwkwkwwgg..',
  '...gwwwwwwg...',
  '...gwwkkwwg...',
  '....gwggwg....',
  '....g....g....',
  '..............',
];

function shadowFor(frame: string[], palette: Record<string, string>, px: number): string {
  const maxLen = Math.max(...frame.map((r) => r.length));
  const parts: string[] = [];
  frame.forEach((row, y) => {
    const padded = row.padEnd(maxLen, '.');
    for (let x = 0; x < padded.length; x++) {
      const ch = padded[x];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) continue;
      parts.push(`${x * px}px ${y * px}px 0 ${px}px ${color}`);
    }
  });
  return parts.join(',');
}

interface SpriteProps {
  frameA: string[];
  frameB: string[];
  palette: Record<string, string>;
  px?: number;
  flutter?: boolean;
  label?: string;
}

export function PixelSprite({ frameA, frameB, palette, px = 4, flutter = true, label }: SpriteProps) {
  const dims = useMemo(() => {
    const rows = Math.max(frameA.length, frameB.length);
    const cols = Math.max(
      ...frameA.map((r) => r.length),
      ...frameB.map((r) => r.length),
    );
    return { w: cols * px, h: rows * px };
  }, [frameA, frameB, px]);

  const shadowA = useMemo(() => shadowFor(frameA, palette, px), [frameA, palette, px]);
  const shadowB = useMemo(() => shadowFor(frameB, palette, px), [frameB, palette, px]);

  return (
    <div
      className="flutter-wrap"
      role="img"
      aria-label={label ?? 'pixel moth'}
      style={{ width: dims.w, height: dims.h }}
    >
      <div
        aria-hidden
        style={{ width: px, height: px, boxShadow: shadowB }}
      />
      <div
        aria-hidden
        className={flutter ? 'flutter-top' : undefined}
        style={{ width: px, height: px, boxShadow: shadowA, opacity: flutter ? undefined : 1 }}
      />
    </div>
  );
}

export function MothSprite({
  wing,
  mark,
  px = 4,
  flutter = true,
}: {
  wing: string;
  mark: string;
  px?: number;
  flutter?: boolean;
}) {
  const palette = useMemo(
    () => ({ c: '#120806', w: wing, k: mark }),
    [wing, mark],
  );
  return (
    <PixelSprite
      frameA={MOTH_A}
      frameB={MOTH_B}
      palette={palette}
      px={px}
      flutter={flutter}
      label="pixel moth"
    />
  );
}

export function LunaSprite({ px = 8 }: { px?: number }) {
  const palette = useMemo(
    () => ({ g: '#8fd18c', w: '#e8f5d5', k: '#2e5b34' }),
    [],
  );
  return (
    <PixelSprite
      frameA={LUNA_A}
      frameB={LUNA_B}
      palette={palette}
      px={px}
      flutter
      label="the great luna moth"
    />
  );
}

export function CandleFlame({ size = 1 }: { size?: number }) {
  const u = 4 * size; // pixel unit
  return (
    <span className="flame" style={{ display: 'inline-block', width: 5 * u, height: 8 * u }} aria-hidden>
      <span
        style={{
          display: 'block',
          width: u,
          height: u,
          marginLeft: 2 * u,
          boxShadow: [
            `0 0 0 ${u}px #ff7b2d`,
            `${-u}px ${u}px 0 ${u}px #ff7b2d`,
            `${u}px ${u}px 0 ${u}px #ff7b2d`,
            `${-u}px ${2 * u}px 0 ${u}px #ffb13d`,
            `0 ${2 * u}px 0 ${u}px #ffe9a8`,
            `${u}px ${2 * u}px 0 ${u}px #ffb13d`,
            `${-u}px ${3 * u}px 0 ${u}px #ffb13d`,
            `0 ${3 * u}px 0 ${u}px #ffe9a8`,
            `${u}px ${3 * u}px 0 ${u}px #ffb13d`,
            `0 ${4 * u}px 0 ${u}px #ff7b2d`,
          ].join(','),
        }}
      />
    </span>
  );
}
