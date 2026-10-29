import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

/**
 * Graphiques SVG légers, rendus côté serveur (aucune bibliothèque, aucun moteur vidéo).
 * Chaque graphique est doublé d'un tableau accessible aux lecteurs d'écran.
 */

export interface Series {
  label: string;
  values: number[];
  /** "accent" : rouge ATIE ; "ink" : encre. */
  color?: "accent" | "ink";
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const colorVar = (c: Series["color"]) => (c === "ink" ? "var(--chart-2)" : "var(--chart-1)");

function SrTable({ labels, series, unit }: { labels: string[]; series: Series[]; unit?: string }) {
  return (
    <table className="sr-only">
      <thead>
        <tr>
          <th>Période</th>
          {series.map((s) => (
            <th key={s.label}>{s.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((l, i) => (
          <tr key={l + i}>
            <td>{l}</td>
            {series.map((s) => (
              <td key={s.label}>
                {formatNumber(s.values[i] ?? 0)} {unit}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-4 font-ui text-[12px] text-muted">
      {series.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-3 rounded-sm" style={{ background: colorVar(s.color) }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function AreaChart({ labels, series, height = 220, width = 640, unit, title }: { labels: string[]; series: Series[]; height?: number; width?: number; unit?: string; title: string }) {
  const W = width;
  const H = height;
  const pad = { t: 12, r: 8, b: 26, l: 36 };
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = Math.max(1, labels.length - 1);
  const x = (i: number) => pad.l + (i / n) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const every = Math.max(1, Math.ceil(labels.length / 7));
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--faint)] font-ui text-[10px] tabular">
              {formatNumber(Math.round(t))}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % every === 0 || i === labels.length - 1 ? (
            <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-[var(--faint)] font-ui text-[10px]">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
          const c = colorVar(s.color);
          return (
            <g key={s.label}>
              {si === 0 ? (
                <>
                  <defs>
                    <linearGradient id={`g-${si}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={c} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`${x(0)},${y(0)} ${pts} ${x(s.values.length - 1)},${y(0)}`} fill={`url(#g-${si})`} />
                </>
              ) : null}
              <polyline points={pts} fill="none" stroke={c} strokeWidth={si === 0 ? 2 : 1.5} strokeDasharray={si === 0 ? undefined : "4 3"} strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={y(v)} r={6} fill="transparent">
                  <title>{`${labels[i]} — ${s.label} : ${formatNumber(v)} ${unit ?? ""}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <SrTable labels={labels} series={series} unit={unit} />
    </figure>
  );
}

export function BarChart({ labels, series, height = 200, width = 640, unit, title }: { labels: string[]; series: Series[]; height?: number; width?: number; unit?: string; title: string }) {
  const W = width;
  const H = height;
  const pad = { t: 12, r: 8, b: 26, l: 36 };
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const band = (W - pad.l - pad.r) / Math.max(1, labels.length);
  const gap = Math.min(10, band * 0.25);
  const bw = Math.max(2, (band - gap) / series.length);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const every = Math.max(1, Math.ceil(labels.length / 10));
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t * max)} y2={y(t * max)} stroke="var(--chart-grid)" />
            <text x={pad.l - 8} y={y(t * max) + 4} textAnchor="end" className="fill-[var(--faint)] font-ui text-[10px] tabular">
              {formatNumber(Math.round(t * max))}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <g key={l + i}>
            {series.map((s, si) => {
              const v = s.values[i] ?? 0;
              const h = H - pad.b - y(v);
              return (
                <rect
                  key={s.label}
                  x={pad.l + i * band + gap / 2 + si * bw}
                  y={y(v)}
                  width={bw - 1}
                  height={Math.max(0, h)}
                  rx={Math.min(3, bw / 3)}
                  fill={colorVar(s.color)}
                  opacity={si === 0 ? 0.9 : 0.55}
                >
                  <title>{`${l} — ${s.label} : ${formatNumber(v)} ${unit ?? ""}`}</title>
                </rect>
              );
            })}
            {i % every === 0 ? (
              <text x={pad.l + i * band + band / 2} y={H - 6} textAnchor="middle" className="fill-[var(--faint)] font-ui text-[10px]">
                {l}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <SrTable labels={labels} series={series} unit={unit} />
    </figure>
  );
}

/** Jauge de consommation (barre). */
export function Meter({ value, max, label, className, size = "md" }: { value: number; max: number; label: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  const tone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-red";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={`${Math.round(pct)} %`}
      className={cn("w-full overflow-hidden rounded-full bg-surface-3", size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Jauge circulaire pour l'espace client. */
export function RingGauge({ value, max, label, sublabel }: { value: number; max: number; label: string; sublabel?: string }) {
  const pct = max ? Math.min(1, value / max) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = pct >= 1 ? "var(--danger)" : pct >= 0.8 ? "var(--warning)" : "var(--red)";
  return (
    <div className="relative mx-auto size-40" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-valuetext={`${Math.round(pct * 100)} %`}>
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="tabular font-head text-[28px] font-semibold leading-none">{Math.round(pct * 100)}&nbsp;%</span>
        {sublabel ? <span className="mt-1 font-ui text-[11.5px] text-muted">{sublabel}</span> : null}
      </div>
    </div>
  );
}
