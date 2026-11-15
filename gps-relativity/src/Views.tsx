import { BALANCE_ALTITUDE_KM, C, clockError, DAY, EARTH_RADIUS, orbitPoint, rates, SATELLITES, semiMajor, type Fix, type Orbit, type Settings } from './model';
import { distance, duration, thousands } from './format';
import { ORBITS } from './presets';

export const TINTS = ['#5b5f97', '#c08a3e', '#3f8f8a', '#b5596a', '#6f8f4e', '#8a6fa8'];
const GRAVITY = '#c08a3e', SPEED = '#3f8f8a', NET = '#5b5f97';
const W = 440, H = 300;

/** Rounds up to 1, 2, or 5 times a power of ten. */
function nice(value: number) {
  const power = 10 ** Math.floor(Math.log10(value)), lead = value / power;
  return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 5 ? 5 : 10) * power;
}

/** Earth and one satellite's orbit, drawn to scale. */
export function OrbitView({ orbit, t }: { orbit: Orbit; t: number }) {
  const a = semiMajor(orbit), e = orbit.eccentricity, sat = orbitPoint(orbit, t, SATELLITES[0].phase);
  const cx = 260, cy = 200, k = 170 / Math.max(a * (1 + e) * 1.12, EARTH_RADIUS * 1.9), earth = EARTH_RADIUS * k;
  const sx = cx + sat.x * k, sy = cy - sat.y * k, lx = Math.max(84, Math.min(436, sx)), ly = sy < cy ? sy - 27 : sy + 22;
  const bar = nice(60 / k / 1000), marks = ORBITS.filter(o => o.key !== 'balance' && Math.abs(o.altitudeKm - orbit.altitudeKm) > 0.04 * (orbit.altitudeKm + 6378) && (EARTH_RADIUS + o.altitudeKm * 1000) * k < 192);
  return <svg className="gps-orbit" viewBox="0 0 520 400" role="img" aria-label={`Earth and the orbit of satellite A, to scale. The satellite is ${thousands((sat.r - EARTH_RADIUS) / 1000)} km up, moving at ${(sat.speed / 1000).toFixed(2)} km/s.`}>
    <defs><radialGradient id="gps-well"><stop offset="0" stopColor="#5b5f97" stopOpacity=".34" /><stop offset=".45" stopColor="#5b5f97" stopOpacity=".1" /><stop offset="1" stopColor="#5b5f97" stopOpacity="0" /></radialGradient>
      <radialGradient id="gps-earth" cx=".38" cy=".34"><stop offset="0" stopColor="#a9c8d6" /><stop offset="1" stopColor="#5f8ca1" /></radialGradient></defs>
    <circle cx={cx} cy={cy} r={Math.min(earth * 4.2, 330)} fill="url(#gps-well)" />
    {marks.map(o => { const r = (EARTH_RADIUS + o.altitudeKm * 1000) * k; return <g key={o.key}><circle cx={cx} cy={cy} r={r} fill="none" stroke="#cfd0dd" strokeDasharray="2 5" /><text x={cx - r * 0.71 - 4} y={cy + r * 0.71 + 11} textAnchor="end">{o.name.toLowerCase()}</text></g>; })}
    <ellipse data-orbit cx={cx - a * e * k} cy={cy} rx={a * k} ry={a * Math.sqrt(1 - e * e) * k} fill="none" stroke="#5b5f97" strokeWidth="1.4" />
    {e > 0 && <g className="gps-apsides"><circle cx={cx + a * (1 - e) * k} cy={cy} r="2.5" /><text x={cx + a * (1 - e) * k + 7} y={cy + 4}>lowest, fastest</text><circle cx={cx - a * (1 + e) * k} cy={cy} r="2.5" /><text x={cx - a * (1 + e) * k - 7} y={cy + 4} textAnchor="end">highest, slowest</text></g>}
    <circle cx={cx} cy={cy} r={earth} fill="url(#gps-earth)" stroke="#4f7d94" />
    <path d={`M${cx} ${cy - earth}v-9`} stroke="#33444b" strokeWidth="1.6" /><circle cx={cx} cy={cy - earth - 11} r="3.2" fill="#c65a48" stroke="#fbfaf7" />
    <text x={cx} y={cy + 4} textAnchor="middle" className="gps-on-earth">ground clock</text>
    <path d={`M${cx} ${cy - earth - 11}L${sx} ${sy}`} stroke="#8a8fb8" strokeDasharray="3 4" />
    <g data-satellite transform={`translate(${sx.toFixed(1)} ${sy.toFixed(1)})`}><path d="M-13 -3h8v6h-8zM5 -3h8v6h-8z" fill="#c9cbe0" stroke="#5b5f97" /><rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#5b5f97" /></g>
    <text x={lx} y={ly} textAnchor="middle" className="gps-number">satellite A</text>
    <text x={lx} y={ly + 13} textAnchor="middle">{thousands((sat.r - EARTH_RADIUS) / 1000)} km up · {(sat.speed / 1000).toFixed(2)} km/s</text>
    <path d={`M20 380h${bar * 1000 * k}`} stroke="#6f736a" strokeWidth="1.5" /><text x="20" y="371">{thousands(bar)} km</text>
  </svg>;
}

/** A top-down map centred on where the receiver really is. */
export function FixMap({ fix, trail }: { fix: Fix; trail: Fix[] }) {
  const reach = Math.max(...trail.map(f => f.horizontal), fix.horizontal), scale = nice(Math.max(reach * 1.08, 1)), k = 120 / scale;
  const cx = W / 2, cy = H / 2, px = (f: Fix) => `${(cx + f.east * k).toFixed(1)},${(cy - f.north * k).toFixed(1)}`;
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of the position fix. It is ${distance(fix.horizontal)} from the true position. The outer ring is ${distance(scale)} out.`}>
    {[1, 0.5].map(part => <circle key={part} cx={cx} cy={cy} r={120 * part} fill="none" stroke="#dcdde8" />)}
    <path d={`M${cx - 132} ${cy}H${cx + 132}M${cx} ${cy - 132}V${cy + 132}`} stroke="#e6e6ee" />
    <text x={cx + 4} y={cy - 123}>N</text><text x={cx + 124} y={cy - 5}>E</text>
    <text x={cx + 87} y={cy + 97}>{distance(scale)}</text><text x={cx + 45} y={cy + 55}>{distance(scale / 2)}</text>
    {reach > scale * 0.004 && <polyline data-testid="gps-trail" points={trail.map(px).join(' ')} fill="none" stroke="#b5596a" strokeWidth="1.3" opacity=".55" />}
    <path d={`M${cx - 8} ${cy}h16M${cx} ${cy - 8}v16`} stroke="#33444b" strokeWidth="1.6" /><text x={cx - 12} y={cy + 22} textAnchor="end">you are here</text>
    <g data-fix transform={`translate(${px(fix).replace(',', ' ')})`}><circle r="9" fill="#b5596a" fillOpacity=".18" /><circle r="4.5" fill="#b5596a" stroke="#fbfaf7" strokeWidth="1.5" /></g>
  </svg>;
}

/** The sky as the receiver sees it: straight up in the middle, the horizon at the rim. */
export function SkyPlot() {
  const cx = W / 2, cy = H / 2;
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sky plot: where the six satellites are above the receiver.">
    {[1, 2 / 3, 1 / 3].map(part => <circle key={part} cx={cx} cy={cy} r={120 * part} fill={part === 1 ? '#f4f4f8' : 'none'} stroke="#dcdde8" />)}
    <text x={cx} y={cy - 125} textAnchor="middle">N</text><path d={`M${cx - 4} ${cy}h8M${cx} ${cy - 4}v8`} stroke="#b9bacb" /><text x={cx} y={cy + 135} textAnchor="middle">horizon</text>
    {SATELLITES.map((s, i) => {
      const r = 120 * (1 - s.elevation / (Math.PI / 2)), x = cx + r * Math.sin(s.azimuth), y = cy - r * Math.cos(s.azimuth), left = x < cx;
      return <g key={s.name}><circle cx={x} cy={y} r="5.5" fill={TINTS[i]} stroke="#fbfaf7" strokeWidth="1.5" /><text x={x + (left ? -10 : 10)} y={y + 4} textAnchor={left ? 'end' : 'start'} className="gps-number">{s.name}</text></g>;
    })}
  </svg>;
}

/** Clock rate against altitude for circular orbits: the two effects and their sum. */
export function RateChart({ altitudeKm }: { altitudeKm: number }) {
  const left = 48, right = W - 12, top = 16, bottom = 196, max = 40_000, lo = -32, hi = 56;
  const px = (km: number) => left + km / max * (right - left), py = (value: number) => bottom - (value - lo) / (hi - lo) * (bottom - top);
  const at = (km: number) => { const r = rates(EARTH_RADIUS + km * 1000); return { gravity: r.gravity * DAY * 1e6, speed: r.speed * DAY * 1e6, net: r.net * DAY * 1e6 }; };
  const xs = Array.from({ length: 161 }, (_, i) => i * max / 160), line = (key: 'gravity' | 'speed' | 'net') => xs.map(km => `${px(km).toFixed(1)},${py(at(km)[key]).toFixed(1)}`).join(' ');
  const now = at(altitudeKm);
  return <svg viewBox={`0 0 ${W} 230`} role="img" aria-label={`Clock rate against altitude. At ${thousands(altitudeKm)} km gravity adds ${now.gravity.toFixed(1)}, speed takes ${Math.abs(now.speed).toFixed(1)}, and the net is ${now.net.toFixed(1)} microseconds per day.`}>
    {[-20, 20, 40].map(v => <g key={v}><path d={`M${left} ${py(v)}H${right}`} stroke="#ececf2" /><text x={left - 5} y={py(v) + 3} textAnchor="end">{v > 0 ? '+' : '−'}{Math.abs(v)}</text></g>)}
    <path d={`M${left} ${py(0)}H${right}`} stroke="#bdbdcb" /><text x={left - 5} y={py(0) + 3} textAnchor="end">0</text><text x={left} y={top - 5}>µs per day</text>
    {ORBITS.map(o => <g key={o.key}><path d={`M${px(o.altitudeKm)} ${bottom}v5`} stroke="#8f948a" /><text x={px(o.altitudeKm)} y={bottom + 16} textAnchor={o.key === 'station' ? 'start' : 'middle'}>{o.key === 'station' ? 'station' : o.key === 'balance' ? '' : o.name === 'GPS' ? 'GPS' : 'geostationary'}</text></g>)}
    <text x={right} y="228" textAnchor="end">altitude, 0 to {thousands(max)} km</text>
    <polyline points={line('gravity')} fill="none" stroke={GRAVITY} strokeWidth="1.6" /><polyline points={line('speed')} fill="none" stroke={SPEED} strokeWidth="1.6" /><polyline points={line('net')} fill="none" stroke={NET} strokeWidth="2.2" />
    <circle cx={px(BALANCE_ALTITUDE_KM)} cy={py(0)} r="3.5" fill="#fbfaf7" stroke={NET} strokeWidth="1.5" /><text x={px(BALANCE_ALTITUDE_KM) + 7} y={py(0) + 13}>they cancel at {thousands(BALANCE_ALTITUDE_KM)} km</text>
    <path data-testid="gps-rate-cursor" d={`M${px(altitudeKm)} ${top}V${bottom}`} stroke="#33444b" strokeDasharray="3 4" />
    {(['gravity', 'speed', 'net'] as const).map((key, i) => <circle key={key} cx={px(altitudeKm)} cy={py(now[key])} r="3.6" fill={[GRAVITY, SPEED, NET][i]} stroke="#fbfaf7" strokeWidth="1.2" />)}
  </svg>;
}

/** Each satellite clock's leftover error since the clocks were set. */
export function DriftChart({ settings, t }: { settings: Settings; t: number }) {
  const left = 58, right = W - 12, top = 16, bottom = 196, span = Math.max(t, DAY), steps = 180;
  const series = SATELLITES.map(s => Array.from({ length: steps + 1 }, (_, i) => clockError(settings, s, span * i / steps)));
  const peak = Math.max(...series.flat().map(Math.abs));
  if (peak < 1e-12) return <p className="gps-empty">Every satellite clock agrees with the ground clock, to the nanosecond, the whole way. That flat line is the corrections doing their job.</p>;
  const low = Math.min(0, ...series.flat()), high = Math.max(0, ...series.flat()), pad = (high - low) * 0.06;
  const px = (i: number) => left + i / steps * (right - left), py = (v: number) => bottom - (v - low + pad) / (high - low + 2 * pad) * (bottom - top);
  return <svg viewBox={`0 0 ${W} 230`} role="img" aria-label={`Clock error of the six satellites over ${(span / DAY).toFixed(1)} days, reaching ${duration(peak)}.`}>
    <path d={`M${left} ${py(0)}H${right}`} stroke="#bdbdcb" /><text x={left - 5} y={py(0) + 3} textAnchor="end">0</text>
    {high > peak * 0.05 && <text x={left - 5} y={py(high) + 3} textAnchor="end">{duration(high, true)}</text>}{low < -peak * 0.05 && <text x={left - 5} y={py(low) + 3} textAnchor="end">{duration(low, true)}</text>}
    <text x={left} y="212">set</text><text x={right} y="212" textAnchor="end">{(span / DAY).toFixed(span % DAY ? 1 : 0)} {span === DAY ? 'day' : 'days'} later</text>
    {series.map((values, i) => <polyline key={i} data-drift={SATELLITES[i].name} points={values.map((v, j) => `${px(j).toFixed(1)},${py(v).toFixed(1)}`).join(' ')} fill="none" stroke={TINTS[i]} strokeWidth="1.5" opacity=".85" />)}
    {t < span && <path d={`M${px(t / span * steps)} ${top}V${bottom}`} stroke="#33444b" strokeDasharray="3 4" />}
  </svg>;
}

/** How wrong each satellite's measured distance is. */
export function RangeList({ settings, t }: { settings: Settings; t: number }) {
  return <div className="gps-legend gps-ranges">{SATELLITES.map((s, i) => {
    const off = -C * clockError(settings, s, t);
    return <span key={s.name} data-testid={`gps-range-${s.name}`}><i style={{ background: TINTS[i] }} />{s.name} {Math.abs(off) < 1e-3 ? 'exact' : `${distance(off)} too ${off < 0 ? 'near' : 'far'}`}</span>;
  })}</div>;
}
