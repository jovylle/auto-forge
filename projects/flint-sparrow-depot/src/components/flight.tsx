import { useEffect, useRef } from 'react';

/** Canvas strip: three CSS-pixel sparrows crossing a dashed flight path. No images. */
export function FlightStrip(): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    window.addEventListener('resize', resize);

    const INK = '#17150F';
    const OCHRE = '#EFA92E';
    const SPARK = '#FF4D1C';
    const TEAL = '#0E6F5C';

    // Two wing frames for a tiny bird sprite, drawn as rects.
    const drawBird = (x: number, y: number, s: number, frame: number, body: string): void => {
      ctx.fillStyle = body;
      ctx.fillRect(x, y, s * 3, s);
      ctx.fillRect(x + s, y - s, s, s);
      ctx.fillStyle = INK;
      ctx.fillRect(x + s * 3, y, s, s);
      ctx.fillStyle = frame === 0 ? OCHRE : SPARK;
      if (frame === 0) {
        ctx.fillRect(x + s, y - s * 2, s, s * 2);
      } else {
        ctx.fillRect(x, y + s, s * 2, s);
        ctx.fillRect(x + s * 2, y - s * 2, s, s);
      }
    };

    const start = performance.now();
    const render = (t: number): void => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const el = reduced ? 0 : (t - start) / 1000;

      // dashed flight path
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(2, w / 600);
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      const midY = h * 0.55;
      ctx.moveTo(0, midY);
      for (let x = 0; x <= w; x += w / 40) {
        ctx.lineTo(x, midY + Math.sin(x / (w / 6) + 1) * h * 0.18);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      const lanes = [
        { speed: 0.11, off: 0.0, body: INK, size: 5 },
        { speed: 0.07, off: 0.45, body: TEAL, size: 4 },
        { speed: 0.09, off: 0.72, body: INK, size: 3 },
      ];
      lanes.forEach((lane, i) => {
        const p = (el * lane.speed + lane.off) % 1.2;
        const x = p * w - w * 0.1;
        const y = midY + Math.sin((p * w) / (w / 6) + 1) * h * 0.18 - h * 0.06 * (i % 2 === 0 ? 1 : -0.4);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const s = lane.size * dpr;
        const frame = Math.floor(el * 6 + i * 2) % 2;
        drawBird(x, y, s, frame, lane.body);
      });

      if (!reduced) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    if (reduced) render(start);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="block h-20 w-full sm:h-24"
      role="img"
      aria-label="Three sparrows crossing a dashed flight path"
    />
  );
}

/** Fire a flint-strike burst of rotating squares from a point inside a canvas overlay. */
export function sparkBurst(canvas: HTMLCanvasElement, x: number, y: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const colors = ['#FF4D1C', '#EFA92E', '#17150F', '#0E6F5C'];
  const parts = Array.from({ length: 26 }, (_, i) => ({
    px: x * dpr,
    py: y * dpr,
    vx: (Math.random() - 0.5) * 9 * dpr,
    vy: (-Math.random() * 7 - 1) * dpr,
    size: (3 + Math.random() * 4) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: colors[i % colors.length] ?? '#FF4D1C',
    life: 1,
  }));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  let frame = 0;
  const tick = (): void => {
    frame += 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of parts) {
      p.vy += 0.35 * dpr;
      p.px += p.vx;
      p.py += p.vy;
      p.rot += p.vr;
      p.life -= 0.028;
      if (p.life <= 0) continue;
      alive = true;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.px, p.py);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    if (alive && frame < 90) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  requestAnimationFrame(tick);
}
