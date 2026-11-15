import { realEngine, type Cycle, type Engine, type EngineState } from './model';
import { kelvin, percent, si } from './format';
import { COLD, HOT, INK } from './CycleViews';

export const WORK = '#5c8a4c';

/**
 * Heat flowing down through a machine as bands whose widths are the energy flows. `reversed` draws a heat pump: work joins from
 * the side and the flow runs upward.
 */
export function FlowDiagram({ top, bottom, inner, heatHot, heatCold, work, scale, unit, reversed, stalled, label }: {
  top: [string, string]; bottom: [string, string]; inner: [string, string]; heatHot: number; heatCold: number; work: number; scale: number; unit: string; reversed?: boolean; stalled?: boolean; label: string;
}) {
  const cx = 290, wide = (q: number) => Math.max(q > 0 ? 3 : 0, Math.min(150, q / scale * 130)), wh = wide(heatHot), wc = wide(heatCold), ww = wide(work), x0 = cx - wh / 2;
  return <svg className="th-flowchart" viewBox="80 0 510 330" role="img" aria-label={label}>
    <defs><marker id="th-head-flow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={INK} /></marker></defs>
    <rect x="96" y="22" width="388" height="46" rx="5" fill={HOT} fillOpacity=".25" stroke={HOT} strokeOpacity=".7" /><text x="108" y="49" className="th-strong">{top[0]}</text>
    <rect x="96" y="262" width="388" height="46" rx="5" fill={COLD} fillOpacity=".25" stroke={COLD} strokeOpacity=".7" /><text x="108" y="289" className="th-strong">{bottom[0]}</text>
    <rect data-band="hot" x={x0} y="68" width={wh} height="97" fill={HOT} fillOpacity=".55" />
    <rect data-band="cold" x={x0} y="165" width={wc} height="97" fill={COLD} fillOpacity=".55" />
    {ww > 0 && <path data-band="work" d={reversed ? `M574 ${165 - ww / 2}H${x0 + wc}v${ww}H574l-12 ${-ww / 2}z` : `M${x0 + wc} ${165 - ww / 2}H560l14 ${ww / 2}l-14 ${ww / 2}H${x0 + wc}z`} fill={WORK} fillOpacity=".6" />}
    <circle cx={cx} cy="165" r="27" fill="#fbfaf7" stroke={INK} strokeWidth="2" /><path d={reversed ? `M${cx} 178V152` : `M${cx} 152V178`} stroke={INK} strokeWidth="2" markerEnd="url(#th-head-flow)" />
    <text x={x0 + wh + 12} y="104">{top[1]}</text><text x={x0 + wh + 12} y="119">{inner[0]}</text>
    <text x={Math.max(x0 + wc, cx + 27) + 12} y="226">{bottom[1]}</text><text x={Math.max(x0 + wc, cx + 27) + 12} y="241">{inner[1]}</text>
    <text x="574" y={165 - ww / 2 - 9} textAnchor="end" className="th-strong">{stalled ? 'no work' : `${reversed ? 'work in' : 'work out'} ${si(work, unit)}`}</text>
    <text x="574" y={165 + ww / 2 + 17} textAnchor="end">{reversed ? 'from the compressor' : 'to the shaft'}</text>
  </svg>;
}

/** Power or efficiency against how fast the engine is run, from standing still to stalling. */
export function RateChart({ cycle, engine, e, kind }: { cycle: Cycle; engine: Engine; e: EngineState; kind: 'power' | 'efficiency' }) {
  const W = 440, H = 230, left = 58, right = W - 14, top = 18, bottom = 190, span = Math.max(e.stallRate * 1.08, engine.rate * 1.05), power = kind === 'power';
  const rates = Array.from({ length: 161 }, (_, i) => i * span / 160), states = rates.map(rate => realEngine(cycle, { ...engine, rate }));
  const value = (s: EngineState) => power ? s.power : s.efficiency, high = power ? Math.max(e.bestPower, 1e-9) * 1.18 : e.carnot * 1.18;
  const px = (rate: number) => left + rate / span * (right - left), py = (v: number) => bottom - v / high * (bottom - top);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" data-testid={`th-${kind}-curve`} aria-label={power ? `Power against cycles per second. It peaks at ${si(e.bestPower, 'W')} at ${e.bestRate.toFixed(2)} cycles per second.` : `Efficiency against cycles per second, falling from ${percent(e.carnot)} at rest to zero at ${e.stallRate.toFixed(2)} cycles per second.`}>
    <path d={`M${left} ${top}V${bottom}H${right}`} fill="none" stroke="#bdbcae" />
    {!power && <><path d={`M${left} ${py(e.carnot)}H${right}`} stroke={HOT} strokeDasharray="4 4" /><text x={right} y={py(e.carnot) - 5} textAnchor="end">Carnot limit {percent(e.carnot)}</text></>}
    <path d={`M${px(e.bestRate)} ${top}V${bottom}`} stroke="#cfc9bb" strokeDasharray="3 5" /><text x={px(e.bestRate)} y={bottom + 14} textAnchor="middle">{e.bestRate.toFixed(2)}</text>
    <text x={px(e.bestRate) + 6} y={power ? py(e.bestPower) - 7 : py(e.bestEfficiency) - 7}>{power ? `peak ${si(e.bestPower, 'W')}` : `${percent(e.bestEfficiency)} at peak power`}</text>
    <polyline points={rates.map((rate, i) => `${px(rate).toFixed(1)},${py(value(states[i])).toFixed(1)}`).join(' ')} fill="none" stroke={power ? WORK : '#b5532f'} strokeWidth="2.2" />
    <circle data-dot cx={px(engine.rate)} cy={py(value(e))} r="5" fill={power ? WORK : '#b5532f'} stroke="#fbfaf7" strokeWidth="1.5" />
    <text x={left - 5} y={bottom + 3} textAnchor="end">0</text><text x={left - 5} y={py(power ? e.bestPower : e.carnot) + 3} textAnchor="end">{power ? si(e.bestPower, 'W') : percent(e.carnot, 0)}</text>
    <text x={left} y={bottom + 14}>0</text><text x={px(e.stallRate)} y={bottom + 14} textAnchor="middle">{e.stallRate.toFixed(2)}</text>
    <text x={(left + right) / 2} y={H - 5} textAnchor="middle">cycles per second</text>
  </svg>;
}

export const gasRange = (e: EngineState) => `${kelvin(e.tGasHot)} to ${kelvin(e.tGasCold)}`;
