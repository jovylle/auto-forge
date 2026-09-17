import { useEffect, useRef } from 'react';
import type { SimEvent } from '../game/types';
import type { RelaySim } from '../game/engine';

export interface HudState {
  speed: number;
  distance: number;
  score: number;
  heat: number;
  stamina: [number, number, number];
  active: number;
  leg: number;
  boost: boolean;
  cells: number;
  gates: number;
  switches: number;
}

interface Props {
  sim: RelaySim;
  running: boolean;
  onHud: (h: HudState) => void;
  onEvent: (e: SimEvent) => void;
  onGameOver: () => void;
}

const BLAZE = '#ff2e88';
const DUNE = '#ffb300';
const TIDE = '#00e5cc';
const VOID = '#0d0221';
const PAPER = '#fff6e9';

interface Star {
  x: number;
  y: number;
  r: number;
  p: number;
}

export default function DuneCanvas({ sim, running, onHud, onEvent, onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef({ onHud, onEvent, onGameOver, running });
  cbRef.current = { onHud, onEvent, onGameOver, running };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudAcc = 1;
    let overFired = false;
    let flash = 0;
    let bannerT = 0;
    let lastLeg = 1;
    let prevLaneX = 0;

    // deterministic starfield
    let s = sim.seed || 7;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const stars: Star[] = Array.from({ length: 110 }, () => ({
      x: rand(),
      y: rand() * 0.9,
      r: 0.5 + rand() * 1.4,
      p: rand() * Math.PI * 2,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const project = (lane: number, z: number, W: number, horizon: number, H: number) => {
      const t = Math.min(1, Math.max(0, 1 - z / 240));
      const y = horizon + (H - horizon) * Math.pow(t, 2.4);
      const x = W * 0.5 + lane * W * 0.34 * t;
      const sc = 0.12 + 0.88 * Math.pow(t, 2);
      return { x, y, s: sc, t };
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cb = cbRef.current;

      if (cb.running && sim.status === 'ready') sim.start();
      if (cb.running && sim.status === 'running') sim.update(dt);

      // drain events
      while (sim.events.length > 0) {
        const e = sim.events.shift() as SimEvent;
        if (e === 'crash' || e === 'bonk') flash = 1;
        if (e === 'leg') {
          bannerT = 2.2;
          lastLeg = sim.leg;
        }
        cb.onEvent(e);
      }
      if (sim.status === 'over' && !overFired) {
        overFired = true;
        cb.onGameOver();
      }
      if (sim.status === 'ready') overFired = false;

      // throttled HUD
      hudAcc += dt;
      if (hudAcc > 0.1) {
        hudAcc = 0;
        cb.onHud({
          speed: sim.speed,
          distance: Math.floor(sim.distance),
          score: sim.score,
          heat: sim.heat,
          stamina: [sim.stamina[0] as number, sim.stamina[1] as number, sim.stamina[2] as number],
          active: sim.active,
          leg: sim.leg,
          boost: sim.boost > 0,
          cells: sim.cellsTaken,
          gates: sim.gatesClean,
          switches: sim.switches,
        });
      }

      // ---------- draw ----------
      const W = canvas.width;
      const H = canvas.height;
      const t = now / 1000;
      const horizon = H * 0.36;
      const dist = sim.distance;

      // sky
      ctx.fillStyle = VOID;
      ctx.fillRect(0, 0, W, H);

      // stars
      for (const st of stars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.4 + st.p));
        ctx.globalAlpha = tw * 0.8;
        ctx.fillStyle = PAPER;
        ctx.fillRect(st.x * W, (st.y * horizon) / 1.0, st.r, st.r);
      }
      ctx.globalAlpha = 1;

      // sun (offset left for asymmetry)
      const sunX = W * 0.34;
      const R = Math.min(W, H) * 0.21;
      const sunY = horizon - R * 0.55 + Math.sin(t * 0.5) * H * 0.004;
      const glow = ctx.createRadialGradient(sunX, sunY, R * 0.4, sunX, sunY, R * 2.4);
      glow.addColorStop(0, 'rgba(255,46,136,0.35)');
      glow.addColorStop(1, 'rgba(255,46,136,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - R * 2.4, sunY - R * 2.4, R * 4.8, R * 4.8);
      ctx.fillStyle = BLAZE;
      ctx.beginPath();
      ctx.arc(sunX, sunY, R, 0, Math.PI * 2);
      ctx.fill();
      // dune core glow at sun base
      const core = ctx.createLinearGradient(0, sunY - R, 0, sunY + R);
      core.addColorStop(0, 'rgba(255,46,136,0)');
      core.addColorStop(1, 'rgba(255,179,0,0.55)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(sunX, sunY, R, 0, Math.PI * 2);
      ctx.fill();
      // slit cuts
      ctx.fillStyle = VOID;
      let sy = sunY + R * 0.05;
      let sh = R * 0.035;
      while (sy < sunY + R) {
        ctx.fillRect(sunX - R - 2, sy, R * 2 + 4, sh);
        sy += sh + R * 0.11;
        sh *= 1.45;
      }

      // dune ridges
      ctx.fillStyle = 'rgba(255,179,0,0.22)';
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, horizon - H * 0.02 - Math.sin(x * 0.008 + 1.7) * H * 0.022 - Math.sin(x * 0.02) * H * 0.008);
      }
      ctx.lineTo(W, horizon);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,179,0,0.14)';
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (let x = 0; x <= W; x += 8) {
        ctx.lineTo(x, horizon - H * 0.008 - Math.sin(x * 0.011 + 4.2) * H * 0.016);
      }
      ctx.lineTo(W, horizon);
      ctx.closePath();
      ctx.fill();

      // floor
      ctx.fillStyle = VOID;
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.fillStyle = 'rgba(255,46,136,0.05)';
      ctx.fillRect(0, horizon, W, H - horizon);

      // perspective grid
      const vpx = W * 0.5;
      ctx.strokeStyle = 'rgba(0,229,204,0.16)';
      ctx.lineWidth = Math.max(1, W * 0.001);
      for (let k = -8; k <= 8; k++) {
        ctx.beginPath();
        ctx.moveTo(vpx, horizon);
        ctx.lineTo(vpx + k * W * 0.16, H);
        ctx.stroke();
      }
      const cycle = 26;
      const off = dist % cycle;
      for (let i = 0; i < 11; i++) {
        const z = i * cycle + (cycle - off);
        const p = project(0, z, W, horizon, H);
        ctx.globalAlpha = 0.1 + 0.3 * p.t;
        ctx.strokeStyle = TIDE;
        ctx.beginPath();
        ctx.moveTo(0, p.y);
        ctx.lineTo(W, p.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // lane guides (boundaries between the 3 lanes)
      ctx.strokeStyle = 'rgba(255,179,0,0.55)';
      ctx.lineWidth = Math.max(2, W * 0.004);
      for (const b of [-0.5, 0.5]) {
        ctx.beginPath();
        const a = project(b, 240, W, horizon, H);
        const c = project(b, 4, W, horizon, H);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }

      // relay gates
      for (const g of sim.gates) {
        const z = g.at - dist;
        if (z < -4 || z > 240) continue;
        const c = project(0, z, W, horizon, H);
        const gw = W * 0.115 * c.s;
        const gh = H * 0.09 * c.s;
        const col = g.resolved ? (g.clean ? TIDE : BLAZE) : PAPER;
        ctx.globalAlpha = 0.35 + 0.65 * c.t;
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(2, W * 0.005 * c.s);
        ctx.beginPath();
        ctx.moveTo(c.x - gw, c.y);
        ctx.lineTo(c.x - gw, c.y - gh);
        ctx.moveTo(c.x + gw, c.y);
        ctx.lineTo(c.x + gw, c.y - gh);
        ctx.stroke();
        ctx.strokeStyle = g.clean || !g.resolved ? TIDE : BLAZE;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(c.x - gw, c.y - gh);
        ctx.lineTo(c.x + gw, c.y - gh);
        ctx.stroke();
        ctx.setLineDash([]);
        // lane marker diamond on the ground
        const m = project(g.lane - 1, z, W, horizon, H);
        ctx.fillStyle = TIDE;
        const ms = 6 * m.s + 2;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y - ms);
        ctx.lineTo(m.x + ms, m.y);
        ctx.lineTo(m.x, m.y + ms);
        ctx.lineTo(m.x - ms, m.y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // sun-cells
      for (const cl of sim.cells) {
        if (cl.taken) continue;
        const z = cl.at - dist;
        if (z < -2 || z > 240) continue;
        const p = project(cl.lane - 1, z, W, horizon, H);
        const s2 = Math.max(2, W * 0.016 * p.s);
        ctx.globalAlpha = 0.4 + 0.6 * p.t;
        ctx.save();
        ctx.translate(p.x, p.y + Math.sin(t * 4 + cl.at) * 2);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = DUNE;
        ctx.fillRect(-s2 / 2, -s2 / 2, s2, s2);
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 1;
        ctx.strokeRect(-s2 / 2, -s2 / 2, s2, s2);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // obstacles (far → near)
      const obs = [...sim.obstacles].sort((a, b) => b.at - a.at);
      for (const o of obs) {
        const z = o.at - dist;
        if (z < -4 || z > 240) continue;
        const p = project(o.lane - 1, z, W, horizon, H);
        const w = W * 0.075 * p.s;
        const h = H * 0.055 * p.s;
        ctx.globalAlpha = o.hit ? 0.3 : 0.45 + 0.55 * p.t;
        ctx.fillStyle = '#05010f';
        ctx.fillRect(p.x - w / 2, p.y - h, w, h);
        ctx.strokeStyle = BLAZE;
        ctx.lineWidth = Math.max(1.5, W * 0.004 * p.s);
        ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
        // chevron
        ctx.fillStyle = DUNE;
        const ch = h * 0.28;
        ctx.beginPath();
        ctx.moveTo(p.x - w * 0.28, p.y - h * 0.4);
        ctx.lineTo(p.x, p.y - h * 0.4 - ch);
        ctx.lineTo(p.x + w * 0.28, p.y - h * 0.4);
        ctx.lineTo(p.x + w * 0.28, p.y - h * 0.4 - ch * 0.5);
        ctx.lineTo(p.x, p.y - h * 0.4 - ch * 1.5);
        ctx.lineTo(p.x - w * 0.28, p.y - h * 0.4 - ch * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // player
      const pz = 6;
      const pp = project(sim.lane, pz, W, horizon, H);
      const lean = Math.max(-1, Math.min(1, (pp.x - prevLaneX) / Math.max(1, W * 0.01)));
      prevLaneX = pp.x;
      const boosting = sim.boost > 0;
      if (!(sim.iframes > 0 && Math.floor(t * 9) % 2 === 0)) {
        // under-glow
        const gl = ctx.createRadialGradient(pp.x, pp.y, 2, pp.x, pp.y, W * 0.07 * pp.s + 8);
        gl.addColorStop(0, boosting ? 'rgba(255,179,0,0.7)' : 'rgba(0,229,204,0.55)');
        gl.addColorStop(1, 'rgba(0,229,204,0)');
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.ellipse(pp.x, pp.y, W * 0.07 * pp.s + 8, H * 0.02 * pp.s + 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // hull triangle
        const bw = W * 0.055 * pp.s + 6;
        const bh = H * 0.045 * pp.s + 8;
        const lx = lean * W * 0.012;
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.moveTo(pp.x + lx, pp.y - bh);
        ctx.lineTo(pp.x + bw / 2, pp.y);
        ctx.lineTo(pp.x - bw / 2, pp.y);
        ctx.closePath();
        ctx.fill();
        // cockpit
        ctx.fillStyle = BLAZE;
        ctx.beginPath();
        ctx.moveTo(pp.x + lx * 1.4, pp.y - bh * 0.72);
        ctx.lineTo(pp.x + bw * 0.16, pp.y - bh * 0.18);
        ctx.lineTo(pp.x - bw * 0.16, pp.y - bh * 0.18);
        ctx.closePath();
        ctx.fill();
        // runner stripe = active rider color identity (tide/dune/paper cycle)
        ctx.fillStyle = [TIDE, DUNE, PAPER][sim.active] as string;
        ctx.fillRect(pp.x - bw * 0.32, pp.y - bh * 0.12, bw * 0.64, Math.max(2, bh * 0.1));
        // exhaust flicker
        const fl = 6 + Math.random() * 10 * (boosting ? 2 : 1);
        ctx.fillStyle = boosting ? DUNE : TIDE;
        ctx.beginPath();
        ctx.moveTo(pp.x - bw * 0.2, pp.y);
        ctx.lineTo(pp.x + bw * 0.2, pp.y);
        ctx.lineTo(pp.x + lx, pp.y + fl + 6);
        ctx.closePath();
        ctx.fill();
      }

      // speed lines
      const s01 = Math.min(1, sim.speed / 42);
      if (s01 > 0.55 && sim.status === 'running') {
        ctx.strokeStyle = 'rgba(255,179,0,0.5)';
        ctx.lineWidth = 2;
        const n = Math.floor((s01 - 0.5) * 14);
        for (let i = 0; i < n; i++) {
          const ly = ((i * 197 + t * 2400) % H) / 1;
          const edge = i % 2 === 0 ? 0 : W;
          const len = 40 + s01 * 120;
          ctx.globalAlpha = 0.25 * s01;
          ctx.beginPath();
          ctx.moveTo(edge, ly);
          ctx.lineTo(edge + (edge === 0 ? len : -len), ly);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // crash flash
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,46,136,${(flash * 0.28).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
        flash = Math.max(0, flash - dt * 2.2);
      }

      // leg banner
      if (bannerT > 0) {
        bannerT -= dt;
        const a = Math.min(1, bannerT);
        ctx.globalAlpha = a;
        ctx.fillStyle = PAPER;
        ctx.font = `900 ${Math.round(H * 0.055)}px Orbitron, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`LEG ${lastLeg}`, W * 0.5, H * 0.24);
        ctx.font = `700 ${Math.round(H * 0.02)}px "Space Mono", monospace`;
        ctx.fillStyle = TIDE;
        ctx.fillText('— RELAY GATE AHEAD —', W * 0.5, H * 0.24 + H * 0.035);
        ctx.globalAlpha = 1;
      }

      // idle attract text
      if (sim.status === 'ready') {
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3);
        ctx.fillStyle = PAPER;
        ctx.font = `700 ${Math.round(H * 0.024)}px "Space Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('PRESS ENTER OR TAP START', W * 0.5, H * 0.72);
        ctx.globalAlpha = 1;
      }
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim]);

  return <canvas ref={canvasRef} className="dune-canvas" aria-label="Desert relay race view" role="img" />;
}
