import { TRIP_SECONDS, tripSpeed, type Reading } from './model';
import { metres } from './format';
import { ACCENT, INK } from './CurveViews';

/** The logged speed readings joined by straight lines, over the trip the car really made. */
export function TripChart({ readings, distance }: { readings: Reading[]; distance: number }) {
  const W = 700, H = 300, left = 56, right = W - 18, top = 16, bottom = 258;
  const low = Math.min(0, ...readings.map(r => r.v)), high = Math.max(21, ...readings.map(r => r.v)) * 1.04, ya = low < 0 ? low * 1.1 : 0;
  const px = (t: number) => left + t / TRIP_SECONDS * (right - left), py = (v: number) => bottom - (v - ya) / (high - ya) * (bottom - top);
  const truth = Array.from({ length: 241 }, (_, i) => i * TRIP_SECONDS / 240), line = readings.map(r => `${px(r.t).toFixed(1)},${py(r.v).toFixed(1)}`).join(' ');
  return <svg className="ni-curve" viewBox={`0 0 ${W} ${H}`} role="img" data-testid="ni-trip" data-readings={readings.length} aria-label={`Speed against time for a two-minute trip: ${readings.length} readings joined by straight lines. The area under them is ${metres(distance)}.`}>
    <polygon points={`${px(0)},${py(0)} ${line} ${px(TRIP_SECONDS)},${py(0)}`} fill={ACCENT} fillOpacity=".14" />
    {readings.length <= 61 && <path d={readings.map(r => `M${px(r.t).toFixed(1)} ${py(0).toFixed(1)}V${py(r.v).toFixed(1)}`).join('')} stroke={ACCENT} strokeOpacity=".55" />}
    <polyline points={truth.map(t => `${px(t).toFixed(1)},${py(tripSpeed(t)).toFixed(1)}`).join(' ')} fill="none" stroke="#8a8478" strokeWidth="1.6" strokeDasharray="5 4" />
    <polyline points={line} fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinejoin="round" />
    {readings.map((r, i) => <circle key={i} cx={px(r.t)} cy={py(r.v)} r={readings.length > 130 ? 1.5 : 2.8} fill="#fbfaf7" stroke={INK} strokeWidth={readings.length > 130 ? 0.8 : 1.3} />)}
    <path d={`M${left} ${top}V${bottom}M${left} ${py(0)}H${right}`} fill="none" stroke="#bdbcae" />
    <text x={left - 6} y={py(20) + 3} textAnchor="end">20 m/s</text><text x={left - 6} y={py(10) + 3} textAnchor="end">10</text><text x={left - 6} y={py(0) + 3} textAnchor="end">0</text>
    <text x={px(70)} y={top + 10} textAnchor="middle">hard braking at 70 s</text><path d={`M${px(70)} ${top + 15}V${py(tripSpeed(70)) - 8}`} stroke="#b9b3a5" strokeDasharray="2 4" />
    <text x={left} y={H - 6}>0 s</text><text x={px(60)} y={H - 6} textAnchor="middle">60 s</text><text x={right} y={H - 6} textAnchor="end">120 s</text>
  </svg>;
}

/** How far off the distance comes out for many different sets of noisy readings: one dot each, stacked. Zero is the true distance. */
export function RepeatChart({ errors, clean, spread, current }: { errors: number[]; clean: number; spread: number; current: number }) {
  const W = 440, H = 230, left = 20, right = W - 20, bottom = 176, bins = 31, reach = Math.max(1, ...errors.map(Math.abs), Math.abs(current)) * 1.08;
  const px = (e: number) => (left + right) / 2 + e / reach * (right - left) / 2, heights = new Array<number>(bins).fill(0);
  const dots = errors.map(e => { const bin = Math.max(0, Math.min(bins - 1, Math.floor((e / reach + 1) / 2 * bins))); return { bin, level: heights[bin]++ }; });
  const size = Math.min(5, 150 / (2 * Math.max(1, ...heights)));
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" data-testid="ni-repeats" aria-label={`The distance error for ${errors.length} different sets of noisy readings. They scatter ${metres(spread, 1)} either side of ${metres(clean, 1)}, the error with a perfect sensor.`}>
    <rect x={px(clean - spread)} y="14" width={Math.max(1, px(clean + spread) - px(clean - spread))} height={bottom - 14} fill={ACCENT} fillOpacity=".1" />
    <path d={`M${px(0)} 14V${bottom}`} stroke="#bdbcae" strokeDasharray="3 4" /><path d={`M${left} ${bottom}H${right}`} stroke="#bdbcae" />
    {dots.map((d, i) => <circle key={i} cx={left + (d.bin + 0.5) / bins * (right - left)} cy={bottom - size - d.level * size * 2} r={size * 0.82} fill={ACCENT} fillOpacity=".6" />)}
    <path data-current d={`M${px(current)} ${bottom + 2}l-5 9h10z`} fill={INK} />
    <text x={left} y={bottom + 24}>{metres(-reach)}</text><text x={px(0)} y={bottom + 24} textAnchor="middle">true distance</text><text x={right} y={bottom + 24} textAnchor="end">+{metres(reach)}</text>
    <text x={(left + right) / 2} y={H - 5} textAnchor="middle">error in the distance · band is the typical scatter, ±{metres(spread, 1)}</text>
  </svg>;
}
