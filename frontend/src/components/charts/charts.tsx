// Graphiques SVG légers (sans dépendance) pour les tableaux de bord de l'espace interne.
// Couleurs : jetons --viz-* de .app-shell (palette validée daltonisme) ; textes en jetons de texte,
// jamais dans la couleur de la série. Traits 2 px, colonnes ≤ 24 px à extrémité arrondie,
// grille fine et discrète, infobulle au survol, tableau de données dépliable sous chaque graphique.
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';

export interface Series {
  key: string;
  label: string;
  color: string;
}

type Point = Record<string, number | string | null>;
type Format = (value: number) => string;

const defaultFormat: Format = (value) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);

// Largeur réelle du conteneur (graphiques responsives, pas de défilement horizontal).
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

// Graduations « rondes » : 0, 5, 10… selon l'amplitude.
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(Number(value.toFixed(10)));
  if ((ticks.at(-1) ?? 0) < max) ticks.push(Number(((ticks.at(-1) ?? 0) + step).toFixed(10)));
  return ticks;
}

// ─────────────────────────────────────────────────────────────
// Carte de graphique : titre, légende, graphique, tableau de données
// ─────────────────────────────────────────────────────────────
export function ChartCard({
  title,
  subtitle,
  legend,
  children,
  table,
  className = '',
}: {
  title: string;
  subtitle?: string;
  legend?: Series[];
  children: ReactNode;
  table?: { columns: string[]; rows: (string | number)[][] };
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-[14px] border border-[var(--c-border)] bg-[var(--c-elev)] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--c-faint)]">{subtitle}</p>}
        </div>
        {legend && legend.length > 1 && (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--c-muted)]">
            {legend.map((series) => (
              <li key={series.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: series.color }} />
                {series.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 min-w-0 flex-1">{children}</div>
      {table && table.rows.length > 0 && (
        <details className="mt-3 text-xs text-[var(--c-muted)]">
          <summary className="cursor-pointer select-none hover:text-[var(--c-text)]">Voir les données</summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-[var(--c-border)]">
            <table className="w-full text-left tabular-nums">
              <thead className="sticky top-0 bg-[var(--c-subtle)] text-[var(--c-faint)]">
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} className="px-3 py-1.5 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={index} className="border-t border-[var(--c-border)]">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="px-3 py-1.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

export function EmptyChart({ height = 220, message = 'Pas encore de données sur la période.' }: { height?: number; message?: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--c-border)] text-center text-xs text-[var(--c-faint)]" style={{ height }}>
      {message}
    </div>
  );
}

function Tooltip({ x, width, title, lines }: { x: number; width: number; title: string; lines: { label: string; value: string; color: string }[] }) {
  const left = Math.min(Math.max(x + 12, 0), Math.max(0, width - 170));
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute top-1 z-10 w-[160px] rounded-lg border border-[var(--c-border)] bg-[var(--c-elev)] px-3 py-2 text-xs shadow-lg"
      style={{ left }}
    >
      <p className="mb-1 font-semibold text-[var(--c-text)]">{title}</p>
      {lines.map((line) => (
        <p key={line.label} className="flex items-center gap-2 text-[var(--c-muted)]">
          <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ background: line.color }} />
          <span className="flex-1 truncate">{line.label}</span>
          <span className="font-semibold tabular-nums text-[var(--c-text)]">{line.value}</span>
        </p>
      ))}
    </div>
  );
}

const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

// ─────────────────────────────────────────────────────────────
// Courbes (une ou plusieurs séries, aire optionnelle)
// ─────────────────────────────────────────────────────────────
export function LineChart({
  data,
  series,
  xKey = 'date',
  xLabel = (value) => String(value),
  format = defaultFormat,
  height = 220,
  area = false,
  yMax,
  ariaLabel,
}: {
  data: Point[];
  series: Series[];
  xKey?: string;
  xLabel?: (value: string) => string;
  format?: Format;
  height?: number;
  area?: boolean;
  yMax?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const values = data.flatMap((point) => series.map((item) => point[item.key])).filter((value): value is number => typeof value === 'number');
  const ticks = niceTicks(yMax ?? Math.max(0, ...values));
  const top = ticks.at(-1) ?? 1;
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = height - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - (value / top) * innerHeight;

  const paths = useMemo(
    () =>
      series.map((item) => {
        let d = '';
        let started = false;
        data.forEach((point, index) => {
          const value = point[item.key];
          if (typeof value !== 'number') {
            started = false;
            return;
          }
          d += `${started ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`;
          started = true;
        });
        return { item, d };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, series, width, top, height],
  );

  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerWidth / 70))));

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - box.left - PAD.left;
    const index = data.length <= 1 ? 0 : Math.round((position / innerWidth) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, index)));
  }

  const hovered = hover === null ? null : data[hover];

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-pan-y">
          {area && series.length === 1 && (
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={series[0]?.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={series[0]?.color} stopOpacity={0} />
              </linearGradient>
            </defs>
          )}
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--c-faint)">
                {format(tick)}
              </text>
            </g>
          ))}
          {data.map((point, index) =>
            index % labelEvery === 0 || index === data.length - 1 ? (
              <text key={index} x={x(index)} y={height - 8} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'} fontSize={10} fill="var(--c-faint)">
                {xLabel(String(point[xKey]))}
              </text>
            ) : null,
          )}
          {area &&
            series.length === 1 &&
            paths[0]?.d &&
            (() => {
              const indices = data.map((point, index) => (typeof point[series[0]!.key] === 'number' ? index : -1)).filter((index) => index >= 0);
              const first = indices[0] ?? 0;
              const last = indices.at(-1) ?? 0;
              return <path d={`${paths[0].d}L${x(last)},${y(0)}L${x(first)},${y(0)}Z`} fill={`url(#${gradientId})`} />;
            })()}
          {paths.map(({ item, d }) => (
            <path key={item.key} d={d} fill="none" stroke={item.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover !== null && hovered && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerHeight} stroke="var(--c-border-strong)" strokeWidth={1} />
              {series.map((item) =>
                typeof hovered[item.key] === 'number' ? (
                  <circle key={item.key} cx={x(hover)} cy={y(hovered[item.key] as number)} r={4.5} fill={item.color} stroke="var(--c-elev)" strokeWidth={2} />
                ) : null,
              )}
            </g>
          )}
        </svg>
      )}
      {hover !== null && hovered && (
        <Tooltip
          x={x(hover)}
          width={width}
          title={xLabel(String(hovered[xKey]))}
          lines={series.map((item) => ({ label: item.label, color: item.color, value: typeof hovered[item.key] === 'number' ? format(hovered[item.key] as number) : '—' }))}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Histogramme (colonnes, une série)
// ─────────────────────────────────────────────────────────────
export function ColumnChart({
  data,
  series,
  xKey = 'date',
  xLabel = (value) => String(value),
  format = defaultFormat,
  height = 220,
  ariaLabel,
}: {
  data: Point[];
  series: Series;
  xKey?: string;
  xLabel?: (value: string) => string;
  format?: Format;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = data.map((point) => (typeof point[series.key] === 'number' ? (point[series.key] as number) : 0));
  const ticks = niceTicks(Math.max(0, ...values));
  const top = ticks.at(-1) ?? 1;
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = height - PAD.top - PAD.bottom;
  const band = data.length > 0 ? innerWidth / data.length : innerWidth;
  const barWidth = Math.max(2, Math.min(24, band - 2));
  const y = (value: number) => PAD.top + innerHeight - (value / top) * innerHeight;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerWidth / 70))));

  // Colonne à extrémité arrondie (4 px), base carrée sur l'axe.
  const column = (left: number, value: number) => {
    const bottom = PAD.top + innerHeight;
    const topY = y(value);
    const radius = Math.min(4, barWidth / 2, bottom - topY);
    if (value <= 0) return '';
    return `M${left},${bottom}V${topY + radius}Q${left},${topY} ${left + radius},${topY}H${left + barWidth - radius}Q${left + barWidth},${topY} ${left + barWidth},${topY + radius}V${bottom}Z`;
  };

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--viz-grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--c-faint)">
                {format(tick)}
              </text>
            </g>
          ))}
          {data.map((point, index) => {
            const left = PAD.left + index * band + (band - barWidth) / 2;
            return (
              <g key={index} onPointerEnter={() => setHover(index)}>
                {/* zone de survol plus large que la colonne */}
                <rect x={PAD.left + index * band} y={PAD.top} width={band} height={innerHeight} fill="transparent" />
                <path d={column(left, values[index] ?? 0)} fill={series.color} opacity={hover === null || hover === index ? 1 : 0.55} />
                {(index % labelEvery === 0 || index === data.length - 1) && (
                  <text x={left + barWidth / 2} y={height - 8} textAnchor="middle" fontSize={10} fill="var(--c-faint)">
                    {xLabel(String(point[xKey]))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip
          x={PAD.left + hover * band + band / 2}
          width={width}
          title={xLabel(String(data[hover]![xKey]))}
          lines={[{ label: series.label, color: series.color, value: format(values[hover] ?? 0) }]}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Barres horizontales (classements, entonnoir)
// ─────────────────────────────────────────────────────────────
export function BarList({
  items,
  color,
  format = defaultFormat,
  max,
}: {
  items: { label: string; value: number; hint?: string }[];
  color: string;
  format?: Format;
  max?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} title={item.hint}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-[var(--c-muted)]">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-[var(--c-text)]">
              {format(item.value)}
              {item.hint && <span className="ml-1.5 font-normal text-[var(--c-faint)]">{item.hint}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--c-subtle)]">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, (item.value / top) * 100))}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────
// Anneau (répartition d'un total)
// ─────────────────────────────────────────────────────────────
export function Donut({
  items,
  centerLabel,
  size = 164,
}: {
  items: { label: string; value: number; color: string }[];
  centerLabel: string;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && items.filter((item) => item.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  const focused = hover === null ? null : items[hover];

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel} : ${items.map((item) => `${item.label} ${item.value}`).join(', ')}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--c-subtle)" strokeWidth={16} />
        {total > 0 &&
          items.map((item, index) => {
            const length = (item.value / total) * circumference;
            const dash = Math.max(0, length - gap);
            const element = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={hover === index ? 20 : 16}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
                className="transition-[stroke-width]"
              />
            );
            offset += length;
            return item.value > 0 ? element : null;
          })}
        <text x="50%" y="47%" textAnchor="middle" fontSize={24} fontWeight={700} fill="var(--c-text)">
          {focused ? focused.value : total}
        </text>
        <text x="50%" y="60%" textAnchor="middle" fontSize={10} fill="var(--c-faint)">
          {focused ? focused.label : centerLabel}
        </text>
      </svg>
      <ul className="min-w-[8rem] flex-1 space-y-1.5 text-xs">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2" onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)}>
            <span aria-hidden="true" className="inline-block size-2.5 rounded-sm" style={{ background: item.color }} />
            <span className="flex-1 text-[var(--c-muted)]">{item.label}</span>
            <span className="font-semibold tabular-nums">{item.value}</span>
            <span className="w-9 text-right tabular-nums text-[var(--c-faint)]">{total > 0 ? `${Math.round((100 * item.value) / total)} %` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mini-courbe de tendance (tuiles d'indicateurs)
// ─────────────────────────────────────────────────────────────
export function Sparkline({ values, color, height = 32 }: { values: (number | null)[]; color: string; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const numbers = values.map((value) => value ?? 0);
  const max = Math.max(1, ...numbers);
  const x = (index: number) => (values.length <= 1 ? width / 2 : (index / (values.length - 1)) * (width - 4) + 2);
  const y = (value: number) => height - 3 - (value / max) * (height - 6);
  const d = numbers.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join('');
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {width > 0 && values.length > 1 && (
        <svg width={width} height={height}>
          <path d={`${d}L${x(numbers.length - 1)},${height}L${x(0)},${height}Z`} fill={color} opacity={0.1} />
          <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(numbers.length - 1)} cy={y(numbers.at(-1) ?? 0)} r={2.5} fill={color} />
        </svg>
      )}
    </div>
  );
}
