import { useEffect, useMemo, useRef, useState } from "react";

type Signal = {
  id: string;
  text: string;
  frequency: number;
  time: string;
};

const CHANNELS = [
  { label: "Hollow", start: 32 },
  { label: "Veil", start: 64 },
  { label: "Thorn", start: 88 },
  { label: "Ember", start: 104 },
] as const;

const INITIAL_SIGNALS: Signal[] = [
  { id: "old-1", text: "The tower is listening. Do not say your name twice.", frequency: 37.4, time: "02:13" },
  { id: "old-2", text: "Someone left moonlight in the receiver.", frequency: 68.8, time: "03:41" },
  { id: "old-3", text: "If this reaches you, the forest found a voice.", frequency: 91.2, time: "04:07" },
];

function SignalCanvas({ frequency }: { frequency: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(245,240,232,.12)";
      ctx.lineWidth = 1;

      for (let x = 0; x < width; x += 42) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      const mid = height * 0.58;
      const amplitude = 18 + (frequency / 108) * 70;
      const speed = frequency * 0.006;

      for (let lane = 0; lane < 5; lane += 1) {
        ctx.beginPath();
        const yBase = mid + (lane - 2) * 18;
        for (let x = 0; x <= width; x += 2) {
          const wave =
            Math.sin(x * 0.018 + frame * speed + lane) * amplitude * (0.24 + lane * 0.08) +
            Math.sin(x * 0.041 - frame * speed * 1.7) * 9;
          const y = yBase + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = lane === 2 ? "rgba(124,242,178,.9)" : "rgba(124,242,178,.16)";
        ctx.lineWidth = lane === 2 ? 2 : 1;
        ctx.stroke();
      }

      for (let i = 0; i < 28; i += 1) {
        const x = (Math.sin(i * 12.9898 + frame * 0.006) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 78.233 + frame * 0.004) * 0.5 + 0.5) * height * 0.62;
        ctx.fillStyle = i % 5 === 0 ? "rgba(245,240,232,.8)" : "rgba(124,242,178,.45)";
        ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }

      frame += 1;
      window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const animation = window.requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animation);
    };
  }, [frequency]);

  return <canvas ref={canvasRef} className="signal-canvas" aria-hidden="true" />;
}

export default function App() {
  const [frequency, setFrequency] = useState(64);
  const [message, setMessage] = useState("");
  const [signals, setSignals] = useState<Signal[]>(() => {
    try {
      const saved = window.localStorage.getItem("ghost-antenna-signals");
      return saved ? JSON.parse(saved) : INITIAL_SIGNALS;
    } catch {
      return INITIAL_SIGNALS;
    }
  });
  const channel = CHANNELS.reduce((closest, item) =>
    Math.abs(item.start - frequency) < Math.abs(closest.start - frequency) ? item : closest,
  );
  const strength = Math.max(8, 100 - Math.abs(channel.start - frequency) * 2);

  useEffect(() => {
    window.localStorage.setItem("ghost-antenna-signals", JSON.stringify(signals));
  }, [signals]);

  const visibleSignals = useMemo(
    () =>
      signals
        .map((signal) => ({
          ...signal,
          distance: Math.abs(signal.frequency - frequency),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 4),
    [frequency, signals],
  );

  const broadcast = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    const next: Signal = {
      id: crypto.randomUUID(),
      text,
      frequency: Number(frequency.toFixed(1)),
      time: new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()),
    };
    setSignals((current) => [next, ...current].slice(0, 12));
    setMessage("");
  };

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="title">
        <div className="hero-copy">
          <p className="eyebrow">A radio for messages meant for no one</p>
          <h1 id="title">Ghost<br />Antenna</h1>
          <p className="lede">Tune the static. Leave a message. The next stranger may hear it in the dark.</p>
        </div>
        <div className="signal-frame">
          <div className="signal-head">
            <span>LIVE SPECTRUM</span>
            <strong>{frequency.toFixed(1)} MHz</strong>
          </div>
          <SignalCanvas frequency={frequency} />
          <div className="signal-foot">
            <span>{channel.label} channel</span>
            <span>signal {Math.round(strength)}%</span>
          </div>
        </div>
      </section>

      <section className="console" aria-label="Message tuner">
        <div className="tuner">
          <label htmlFor="frequency">Message tuner</label>
          <input
            id="frequency"
            type="range"
            min="20"
            max="108"
            step="0.1"
            value={frequency}
            onChange={(event) => setFrequency(Number(event.target.value))}
          />
          <div className="scale" aria-hidden="true">
            <span>20</span><span>40</span><span>60</span><span>80</span><span>108</span>
          </div>
        </div>
        <form className="broadcast" onSubmit={broadcast}>
          <label htmlFor="message">Leave a transmission</label>
          <div className="broadcast-row">
            <input
              id="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={140}
              placeholder="Speak into the static..."
              required
            />
            <button type="submit">Broadcast</button>
          </div>
          <small>{message.length}/140 · stored only in this browser</small>
        </form>
      </section>

      <section className="board" aria-labelledby="board-title">
        <div className="board-heading">
          <div>
            <p className="eyebrow">Recovered nearby</p>
            <h2 id="board-title">Signal board</h2>
          </div>
          <span>{visibleSignals.length} transmissions in range</span>
        </div>
        <div className="signal-grid">
          {visibleSignals.map((signal) => (
            <article className="signal-card" key={signal.id}>
              <div className="signal-meta">
                <span>{signal.frequency.toFixed(1)} MHz</span>
                <span>{signal.time}</span>
              </div>
              <p>{signal.text}</p>
              <small>{Math.round(100 - signal.distance)}% tuned</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
