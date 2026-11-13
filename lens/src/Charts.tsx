import { blurAt, COLORS, type Sample } from './model';

const W = 440, H = 230, PAD = 48;
export function length(mm: number): string {
  if (!Number.isFinite(mm)) return '—';
  const size = Math.abs(mm);
  return size < 0.0995 ? `${(mm * 1000).toFixed(size < 0.00995 ? 1 : 0)} µm` : `${mm.toFixed(size < 9.95 ? 2 : 1)} mm`;
}
const stroke = (key: string) => COLORS.find(c => c.key === key)!.stroke;
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/** Where each ray lands (or, with no sensor, which way it leaves) against where it entered the lens. */
export function RayFan({ rays, sensorX, compare }: { rays: Sample[]; sensorX: number | null; compare: { rays: Sample[]; x: number } | null }) {
  if (rays.length < 3) return <p className="lens-empty">No rays make it through the lenses.</p>;
  const value = (r: Sample, x: number | null) => x === null ? r.b * 1000 : (r.a + r.b * x) * 1000;
  const centred = (set: Sample[], x: number | null) => { const zero = mean(set.map(r => value(r, x))); return set.map(r => ({ ...r, v: value(r, x) - zero })); };
  const main = centred(rays, sensorX), other = compare && sensorX !== null ? centred(compare.rays, compare.x) : [];
  const peak = Math.max(...main.map(r => Math.abs(r.v)), ...other.map(r => Math.abs(r.v)), 1e-6);
  const px = (pupil: number) => PAD + (pupil + 1) / 2 * (W - PAD - 10), py = (v: number) => H / 2 - v / peak * (H / 2 - 24);
  const line = (set: { pupil: number; v: number }[]) => set.map(r => `${px(r.pupil).toFixed(1)},${py(r.v).toFixed(1)}`).join(' ');
  const unit = sensorX === null ? 'mrad' : 'µm', label = (v: number) => v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Ray fan plot. Rays miss the ideal ${sensorX === null ? 'direction' : 'point'} by up to ${label(peak)} ${unit}.`}>
    <path d={`M${PAD} ${H / 2}H${W - 10}M${px(0)} 18V${H - 18}`} stroke="#d8d8cc" />
    <text x={PAD - 4} y="24" textAnchor="end">+{label(peak)}</text><text x={PAD - 4} y={H - 18} textAnchor="end">−{label(peak)}</text><text x={PAD - 4} y={H / 2 + 3} textAnchor="end">0 {unit}</text>
    <text x={PAD} y={H - 3}>bottom edge</text><text x={px(0)} y={H - 3} textAnchor="middle">centre of lens</text><text x={W - 10} y={H - 3} textAnchor="end">top edge</text>
    {other.length > 0 && <polyline data-testid="lens-compare-curve" points={line(other.filter(r => r.color === 'green'))} fill="none" stroke="#a9a79a" strokeWidth="1.4" strokeDasharray="4 4" />}
    {COLORS.map(c => <polyline key={c.key} points={line(main.filter(r => r.color === c.key))} fill="none" stroke={c.stroke} strokeWidth="1.8" />)}
  </svg>;
}

/** The last stretch of every ray, magnified around the focus. */
export function FocusCloseUp({ rays, sensorX, best }: { rays: Sample[]; sensorX: number | null; best: number | null }) {
  if (sensorX === null || rays.length < 3) return <p className="lens-empty">These rays leave parallel or spreading, so there is no focus to magnify. An eye or a camera behind the last lens would do the final focusing.</p>;
  const a0 = mean(rays.map(r => r.a)), b0 = mean(rays.map(r => r.b));
  const lines = rays.map(r => ({ color: r.color, a: r.a - a0, b: r.b - b0 }));
  const spread = Math.sqrt(mean(lines.map(r => r.b * r.b))) || 1e-9, focus = best ?? sensorX;
  const half = Math.max(1.5 * Math.abs(sensorX - focus), 2.4 * blurAt(rays, focus) / spread, 1e-4), mid = (sensorX + focus) / 2;
  const tall = Math.max(...lines.flatMap(r => [Math.abs(r.a + r.b * (mid - half)), Math.abs(r.a + r.b * (mid + half))]), 1e-9);
  const px = (x: number) => 10 + (x - (mid - half)) / (2 * half) * (W - 20), py = (y: number) => H / 2 - y / tall * (H / 2 - 26);
  const every = Math.max(1, Math.round(lines.length / 54));
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Close-up of the focus, ${length(2 * half)} long and ${length(2 * tall)} tall.`}>
    <g style={{ mixBlendMode: 'multiply' }}>{lines.filter((_, i) => i % every === 0).map((r, i) => <path key={i} d={`M${px(mid - half)} ${py(r.a + r.b * (mid - half)).toFixed(1)}L${px(mid + half)} ${py(r.a + r.b * (mid + half)).toFixed(1)}`} stroke={stroke(r.color)} strokeWidth="1" opacity=".8" />)}</g>
    {best !== null && Math.abs(best - sensorX) > half * 0.02 && <g><path d={`M${px(best)} 20V${H - 22}`} stroke="#8a6fa8" strokeDasharray="3 4" /><text x={px(best)} y="14" textAnchor="middle">sharpest</text></g>}
    <path d={`M${px(sensorX)} 20V${H - 22}`} stroke="#5d5a52" strokeWidth="2" /><text x={px(sensorX)} y={H - 10} textAnchor="middle">sensor</text>
    <text x="10" y={H - 3}>← {length(2 * half)} along the axis →</text><text x={W - 10} y={H - 3} textAnchor="end">{length(2 * tall)} tall</text>
  </svg>;
}
