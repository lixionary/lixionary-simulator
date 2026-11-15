import { type Row } from './model';
import { count, err, num, sci, shrink } from './format';
import { isExact } from './model';

export interface Series { key: string; name: string; tint: string; points: [number, number][]; strong?: boolean; dashed?: boolean }
export const RULE_TINT = { left: '#c65a48', right: '#d99e52', midpoint: '#5c8a4c', trapezoid: '#4d7fc0', simpson: '#7d5a9c' };

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const decade = (e: number) => e === 0 ? '1' : `10${e < 0 ? '⁻' : ''}${[...String(Math.abs(e))].map(c => SUPERSCRIPT[Number(c)]).join('')}`;

/** Errors against effort with both axes logarithmic, so an error proportional to a power of the slice width is a straight line. */
export function LogChart({ series, mark, limit, least = 1e-17, xLabel, xTicks, testid, label }: { series: Series[]; mark?: { x: number; y: number; tint: string }; limit?: { y: number; text: string }; least?: number; xLabel: string; xTicks?: number[]; testid: string; label: string }) {
  const W = 440, H = 250, left = 50, right = W - 14, top = 16, bottom = 204;
  const lx = Math.log10, ly = (y: number) => Math.log10(Number.isFinite(y) ? Math.max(Math.abs(y), least) : 1e300);
  const all = series.flatMap(s => s.points).concat(mark ? [[mark.x, mark.y]] : []).filter(([, y]) => Number.isFinite(y));
  const xa = Math.min(...all.map(([x]) => lx(x))), xb = Math.max(...all.map(([x]) => lx(x)), xa + 0.5);
  const ya = Math.floor(Math.min(...all.map(([, y]) => ly(y)), limit ? ly(limit.y) : Infinity)), yb = Math.max(Math.ceil(Math.max(...all.map(([, y]) => ly(y)))), ya + 2);
  const px = (x: number) => left + (lx(x) - xa) / (xb - xa) * (right - left), py = (y: number) => bottom - (Math.min(ly(y), yb) - ya) / (yb - ya) * (bottom - top);
  const step = Math.ceil((yb - ya) / 6), ticks = Array.from({ length: Math.floor((yb - ya) / step) + 1 }, (_, i) => yb - i * step);
  const marks = xTicks ?? [1, 10, 100, 1000, 10000, 100000].filter(x => lx(x) >= xa - 1e-9 && lx(x) <= xb + 1e-9);
  return <><svg viewBox={`0 0 ${W} ${H}`} role="img" data-testid={testid} aria-label={label}>
    {ticks.map(e => <g key={e}><path d={`M${left} ${py(10 ** e)}H${right}`} stroke="#e6e4da" /><text x={left - 5} y={py(10 ** e) + 3} textAnchor="end">{decade(e)}</text></g>)}
    {marks.map(x => <g key={x}><path d={`M${px(x)} ${bottom}v4`} stroke="#bdbcae" /><text x={px(x)} y={bottom + 15} textAnchor="middle">{count(x)}</text></g>)}
    <path d={`M${left} ${top}V${bottom}H${right}`} fill="none" stroke="#bdbcae" />
    {limit && <><path d={`M${left} ${py(limit.y)}H${right}`} stroke="#8a8478" strokeDasharray="3 4" /><text x={right} y={py(limit.y) - 5} textAnchor="end">{limit.text}</text></>}
    {series.map(s => { const pts = s.points.filter(([, y]) => Number.isFinite(y)); return <g key={s.key} data-series={s.key} opacity={s.strong === false ? 0.55 : 1}>
      <polyline points={pts.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`).join(' ')} fill="none" stroke={s.tint} strokeWidth={s.strong ? 2.6 : 1.5} strokeDasharray={s.dashed ? '4 4' : undefined} strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={px(x)} cy={py(y)} r={s.strong ? 2.4 : 1.6} fill={s.tint} />)}
    </g>; })}
    {mark && Number.isFinite(mark.y) && <circle data-dot cx={px(mark.x)} cy={py(mark.y)} r="5.5" fill={mark.tint} stroke="#fbfaf7" strokeWidth="1.6" />}
    <text x={(left + right) / 2} y={H - 5} textAnchor="middle">{xLabel}</text>
  </svg>
  <div className="ni-legend">{series.map(s => <span key={s.key}><i style={{ background: s.tint }} />{s.name}</span>)}</div></>;
}

/** The estimate and its error as the slices double. The last column is the rule's order of accuracy made visible. */
export function ConvergenceTable({ rows, exact }: { rows: Row[]; exact: number }) {
  return <table className="ni-table" data-testid="ni-table">
    <thead><tr><th>Slices</th><th>Estimate</th><th>Error</th><th>Error shrank</th></tr></thead>
    <tbody>{rows.map((row, i) => <tr key={row.n} aria-current={i === 0 || undefined}><td>{count(row.n)}</td><td>{num(row.value, 10)}</td><td>{err(row.error, isExact(row.error, exact))}</td><td>{i === 0 ? '' : shrink(row.ratio)}</td></tr>)}</tbody>
  </table>;
}

/** A plain table of labelled rows. */
export function Table({ head, rows, testid }: { head: string[]; rows: string[][]; testid: string }) {
  return <table className="ni-table" data-testid={testid}><thead><tr>{head.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>;
}

export const tolerance = (digits: number) => sci(10 ** -digits, 1);
