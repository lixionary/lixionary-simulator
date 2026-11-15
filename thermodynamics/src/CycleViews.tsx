import { cyclePath, STROKES, type CarnotCycle, type Cycle, type GasState } from './model';
import { kelvin, litres, si } from './format';

export const HOT = '#c65a48', COLD = '#4d7fc0', INK = '#33444b';
const STROKE_TINT = [HOT, '#8a8478', COLD, '#8a8478'];

/** A colour between the cold blue and the hot red for a gas at temperature t. */
function warmth(t: number, cycle: Cycle) {
  const f = Math.max(0, Math.min(1, (t - cycle.tCold) / (cycle.tHot - cycle.tCold))), mix = (a: number, b: number) => Math.round(a + (b - a) * f);
  return `rgb(${mix(77, 198)},${mix(127, 90)},${mix(192, 72)})`;
}

/** The cylinder and piston between the two reservoirs, at one moment of the cycle. */
export function Piston({ cycle, c, now }: { cycle: Cycle; c: CarnotCycle; now: GasState & { stroke: number } }) {
  const W = 700, x0 = 36, travel = 440, top = 118, height = 84, head = x0 + Math.max(10, now.v / c.corners[2].v * travel), stroke = now.stroke;
  const expanding = stroke < 2, touching = stroke === 0 ? 'hot' : stroke === 2 ? 'cold' : null, mid = (x0 + head) / 2;
  const heat = (y1: number, y2: number, tint: string) => [-1, 0, 1].map(i => <path key={i} className="th-flow" d={`M${mid + i * Math.min(26, (head - x0) / 4)} ${y1}V${y2}`} stroke={tint} strokeWidth="3" strokeDasharray="5 6" markerEnd={`url(#th-head-${tint === HOT ? 'hot' : 'cold'})`} />);
  return <svg className="th-piston" viewBox={`0 0 ${W} 320`} role="img" data-stroke={stroke} aria-label={`A gas in a cylinder. Stroke ${stroke + 1} of 4, ${STROKES[stroke].toLowerCase()}: ${litres(now.v)} at ${kelvin(now.t)}.`}>
    <defs>{[['hot', HOT], ['cold', COLD], ['work', INK]].map(([name, tint]) => <marker key={name} id={`th-head-${name}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={tint} /></marker>)}</defs>
    <rect x={x0} y="26" width={travel} height="44" rx="5" fill={HOT} fillOpacity={touching === 'hot' ? 0.34 : 0.1} stroke={HOT} strokeOpacity={touching === 'hot' ? 0.9 : 0.35} />
    <text x={x0 + 12} y="52" className="th-strong">Hot reservoir · {kelvin(cycle.tHot)}</text>
    <rect x={x0} y="250" width={travel} height="44" rx="5" fill={COLD} fillOpacity={touching === 'cold' ? 0.34 : 0.1} stroke={COLD} strokeOpacity={touching === 'cold' ? 0.9 : 0.35} />
    <text x={x0 + 12} y="276" className="th-strong">Cold reservoir · {kelvin(cycle.tCold)}</text>
    {touching === 'hot' && heat(74, top - 9, HOT)}{touching === 'cold' && heat(top + height + 5, 244, COLD)}
    {touching === null && <><text x={x0 + travel} y="98" textAnchor="end">insulated: no heat in or out</text><path d={`M${x0 - 5} ${top - 6}H${x0 + travel + 8}M${x0 - 5} ${top + height + 6}H${x0 + travel + 8}`} stroke="#b9b3a5" strokeWidth="3" strokeDasharray="2 4" /></>}
    <rect data-gas x={x0} y={top} width={head - x0} height={height} fill={warmth(now.t, cycle)} fillOpacity=".55" />
    <path d={`M${x0 + travel + 8} ${top}H${x0}V${top + height}H${x0 + travel + 8}`} fill="none" stroke={INK} strokeWidth="2.5" />
    <rect x={head} y={top + 2} width="13" height={height - 4} rx="2" fill="#5d5a52" /><path d={`M${head + 13} ${top + height / 2}H${head + 86}`} stroke="#5d5a52" strokeWidth="7" />
    <text x={mid} y={top + height / 2 + 4} textAnchor="middle" className="th-on-gas">{head - x0 > 70 ? `${kelvin(now.t)} · ${si(now.p, 'Pa')}` : kelvin(now.t)}</text>
    <path d={expanding ? `M${head + 96} ${top + height / 2}h44` : `M${head + 140} ${top + height / 2}h-44`} stroke={INK} strokeWidth="2.5" markerEnd="url(#th-head-work)" />
    <text x={Math.min(W - 6, head + 172)} y={top + height / 2 - 12} textAnchor="end" className="th-strong">{expanding ? 'gas pushes: work out' : 'piston pushes: work in'}</text>
    <text x={x0} y="314">{stroke + 1} of 4 · {STROKES[stroke]}</text><text x={x0 + travel} y="314" textAnchor="end">volume {litres(now.v)}</text>
  </svg>;
}

/** The cycle as a closed loop, on pressure–volume or temperature–entropy axes. The enclosed area is the work per cycle. */
export function CycleChart({ c, now, kind, log }: { c: CarnotCycle; now: GasState; kind: 'pv' | 'ts'; log?: boolean }) {
  const W = 440, H = 250, left = 68, right = W - 14, top = 16, bottom = 208, path = cyclePath(c), pv = kind === 'pv';
  const xOf = (g: GasState) => pv ? g.v : g.s, yOf = (g: GasState) => pv ? g.p : g.t, scale = (v: number) => log ? Math.log(v) : v;
  const xs = path.map(xOf), ys = path.map(yOf), xMax = Math.max(...xs), yMax = Math.max(...ys), xMin = Math.min(...xs), yMin = Math.min(...ys);
  const [xa, xb] = pv ? (log ? [scale(xMin) - 0.15, scale(xMax) + 0.15] : [0, xMax * 1.08]) : [-0.25 * xMax, 1.25 * xMax];
  const [ya, yb] = pv ? (log ? [scale(yMin) - 0.25, scale(yMax) + 0.25] : [0, yMax * 1.1]) : [0, yMax * 1.15];
  const px = (v: number) => left + (scale(v) - xa) / (xb - xa) * (right - left), py = (v: number) => bottom - (scale(v) - ya) / (yb - ya) * (bottom - top);
  const point = (g: GasState) => `${px(xOf(g)).toFixed(1)},${py(yOf(g)).toFixed(1)}`;
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" data-testid={`th-${kind}`} aria-label={pv ? `Pressure against volume around the cycle. The loop encloses ${si(c.work, 'J')} of work.` : `Temperature against entropy around the cycle: a rectangle whose area is ${si(c.work, 'J')} of work.`}>
    <path d={`M${left} ${top}V${bottom}H${right}`} fill="none" stroke="#bdbcae" />
    <polygon data-loop points={path.map(point).join(' ')} fill="#b5532f" fillOpacity=".13" />
    {[0, 1, 2, 3].map(stroke => <polyline key={stroke} points={path.filter((g, i) => g.stroke === stroke || path[i - 1]?.stroke === stroke).map(point).join(' ')} fill="none" stroke={STROKE_TINT[stroke]} strokeWidth="2.2" strokeLinejoin="round" />)}
    {c.corners.map((g, i) => <text key={i} x={px(xOf(g)) + (pv ? (i === 0 || i === 3 ? -9 : 8) : (i === 0 || i === 3 ? -10 : 9))} y={py(yOf(g)) + (pv ? (i === 0 || i === 1 ? -6 : 13) : (i < 2 ? -6 : 14))} textAnchor="middle" className="th-corner">{i + 1}</text>)}
    <text x={(px(xOf(c.corners[0])) + px(xOf(c.corners[2]))) / 2} y={(py(yOf(c.corners[0])) + py(yOf(c.corners[2]))) / 2 + (pv ? 10 : 3)} textAnchor="middle" className="th-strong">{pv ? '' : `work ${si(c.work, 'J')}`}</text>
    <circle data-dot cx={px(xOf(now))} cy={py(yOf(now))} r="5" fill="#b5532f" stroke="#fbfaf7" strokeWidth="1.5" />
    {pv ? <>
      <text x={left - 5} y={py(yMax) + 3} textAnchor="end">{si(yMax, 'Pa')}</text><text x={left - 5} y={py(yMin) + 3} textAnchor="end">{si(yMin, 'Pa')}</text>
      <text x={px(xMin)} y={bottom + 14} textAnchor="middle">{litres(xMin)}</text><text x={px(xMax)} y={bottom + 14} textAnchor="middle">{litres(xMax)}</text>
      <text x={(left + right) / 2} y={H - 4} textAnchor="middle">volume{log ? ' · logarithmic' : ''}</text>
    </> : <>
      <text x={left - 5} y={py(c.corners[0].t) + 3} textAnchor="end">{kelvin(c.corners[0].t)}</text><text x={left - 5} y={py(c.corners[2].t) + 3} textAnchor="end">{kelvin(c.corners[2].t)}</text><text x={left - 5} y={bottom + 3} textAnchor="end">0 K</text>
      <rect x={px(0)} y={py(c.corners[2].t)} width={px(c.entropy) - px(0)} height={bottom - py(c.corners[2].t)} fill={COLD} fillOpacity=".1" />
      <text x={(px(0) + px(c.entropy)) / 2} y={(py(c.corners[2].t) + bottom) / 2 + 3} textAnchor="middle">waste {si(c.qCold, 'J')}</text>
      <text x={(left + right) / 2} y={H - 4} textAnchor="middle">entropy carried · {si(c.entropy, 'J/K')}</text>
    </>}
  </svg>;
}
