import { drainCurrent, mosRegion, pinchOff, type Mos, type MosDesign } from './model';
import { si, volts } from './format';

const N_TINT = '#4d7fc0', COPPER = '#a5622f';

/** A slice through the transistor: source and drain islands, the gate on its oxide, and the channel the gate creates. */
export function CrossSection({ mos, d }: { mos: Mos; d: MosDesign }) {
  const region = mosRegion(d, mos.vgs, mos.vds), pinch = pinchOff(d, mos.vgs), on = region !== 'cutoff';
  const reach = region === 'saturation' ? Math.max(0.78, 1 - 0.07 * (mos.vds - pinch)) : 1, start = 170, length = 180, depth = Math.min(11, 3 + pinch * 5);
  const end = start + length * reach, tail = on ? depth * Math.max(0, 1 - mos.vds / Math.max(pinch, 1e-6)) : 0, oxide = 5 + Math.min(14, mos.toxNm * 0.45);
  const deep = (bias: number) => 16 + 9 * Math.sqrt(1 + bias);
  return <svg className="si-device" viewBox="0 0 520 282" role="img" aria-label={`Cross-section of the transistor. It is in ${region}${on ? ' and a channel joins source and drain' : ' and there is no channel'}.`}>
    <rect x="30" y="120" width="460" height="150" rx="4" fill="#c65a48" fillOpacity=".16" stroke="#cdb9ae" />
    <path d={`M48 120V${170 + deep(0)}H${start + deep(0) * 0.5}V${120 + deep(0)}H${350 - deep(mos.vds) * 0.5}V${170 + deep(mos.vds)}H472V120Z`} fill="#fbfaf7" fillOpacity=".75" />
    <rect x="60" y="120" width="110" height="50" fill={N_TINT} fillOpacity=".45" /><rect x="350" y="120" width="110" height="50" fill={N_TINT} fillOpacity=".45" />
    <text x="115" y="150" textAnchor="middle" className="si-strong">n+ source</text><text x="405" y="150" textAnchor="middle" className="si-strong">n+ drain</text><text x="260" y="250" textAnchor="middle">p-type silicon</text><text x="260" y="205" textAnchor="middle">no free carriers</text>
    {on && <path data-channel d={`M${start} 120H${end}L${end} ${120 + tail}L${start} ${120 + depth}Z`} fill={N_TINT} />}
    {on && <path className="si-flow" d={`M${start + 4} ${120 + Math.min(depth, 4) / 2 + 1}H${350}`} stroke="#fbfaf7" strokeWidth="1.4" strokeDasharray="2 9" />}
    <rect x={start} y={120 - oxide} width={length} height={oxide} fill="#e9e2cf" stroke="#cbbf9f" /><rect x={start} y={120 - oxide - 30} width={length} height="30" rx="2" fill={mos.vgs >= d.threshold ? COPPER : '#b4b0a6'} fillOpacity=".8" />
    <text x="260" y={120 - oxide - 11} textAnchor="middle" className="si-on-gate">gate</text>
    <path d={`M80 120V60M440 120V60M260 ${90 - oxide}V60`} stroke="#33444b" strokeWidth="1.5" />
    <text x="80" y="50" textAnchor="middle" className="si-strong">source · 0 V</text><text x="260" y="50" textAnchor="middle" className="si-strong">gate · {volts(mos.vgs)}</text><text x="440" y="50" textAnchor="middle" className="si-strong">drain · {volts(mos.vds)}</text>
  </svg>;
}

/** Drain current against drain voltage for a ladder of gate voltages, with the present one drawn bold. */
export function OutputCurves({ mos, d }: { mos: Mos; d: MosDesign }) {
  const W = 440, H = 230, left = 60, right = W - 12, top = 16, bottom = 196, max = 3, peak = drainCurrent(d, mos.ratio, max, max);
  const px = (v: number) => left + v / max * (right - left), py = (i: number) => bottom - i / peak * (bottom - top);
  const curve = (vgs: number) => Array.from({ length: 91 }, (_, i) => `${px(i * max / 90).toFixed(1)},${py(drainCurrent(d, mos.ratio, vgs, i * max / 90)).toFixed(1)}`).join(' ');
  const now = drainCurrent(d, mos.ratio, mos.vgs, mos.vds);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Drain current against drain voltage. Now ${si(now, 'A')}.`}>
    <path d={`M${left} ${bottom}H${right}M${left} ${top}V${bottom}`} stroke="#bdbcae" /><text x={left - 5} y={top + 8} textAnchor="end">{si(peak, 'A')}</text><text x={left - 5} y={bottom + 3} textAnchor="end">0</text>
    <text x={left} y={bottom + 16}>0</text><text x={right} y={bottom + 16} textAnchor="end">drain voltage, 3 V</text>
    {[1, 1.5, 2, 2.5, 3].map(vgs => <g key={vgs}><polyline points={curve(vgs)} fill="none" stroke="#cdb9a3" strokeWidth="1.2" /><text x={right - 2} y={py(drainCurrent(d, mos.ratio, vgs, max)) - 4} textAnchor="end">gate {vgs} V</text></g>)}
    <polyline data-testid="si-output-curve" points={curve(mos.vgs)} fill="none" stroke={COPPER} strokeWidth="2.2" />
    <circle cx={px(mos.vds)} cy={py(now)} r="4.5" fill={COPPER} stroke="#fbfaf7" strokeWidth="1.5" />
  </svg>;
}

/** Drain current against gate voltage on a logarithmic axis: the straight line below threshold is the leak. */
export function TransferCurve({ mos, d }: { mos: Mos; d: MosDesign }) {
  const W = 440, H = 230, left = 60, right = W - 12, top = 16, bottom = 196, max = 3;
  const px = (v: number) => left + v / max * (right - left), py = (i: number) => bottom - (Math.max(-13, Math.min(-2, Math.log10(i + 1e-30))) + 13) / 11 * (bottom - top);
  const now = drainCurrent(d, mos.ratio, mos.vgs, mos.vds), threshold = Math.max(0, Math.min(max, d.threshold));
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Drain current against gate voltage on a logarithmic scale. Threshold is ${volts(d.threshold)}.`}>
    {[-12, -9, -6, -3].map(p => <g key={p}><path d={`M${left} ${py(10 ** p)}H${right}`} stroke="#ecebe2" /><text x={left - 5} y={py(10 ** p) + 3} textAnchor="end">{si(10 ** p, 'A').replace('.00', '')}</text></g>)}
    <path d={`M${px(threshold)} ${top}V${bottom}`} stroke="#8a8478" strokeDasharray="3 4" /><text x={px(threshold) + 5} y={top + 8}>threshold</text>
    <text x={left} y={bottom + 16}>0</text><text x={right} y={bottom + 16} textAnchor="end">gate voltage, 3 V</text>
    <polyline data-testid="si-transfer-curve" points={Array.from({ length: 121 }, (_, i) => `${px(i * max / 120).toFixed(1)},${py(drainCurrent(d, mos.ratio, i * max / 120, mos.vds)).toFixed(1)}`).join(' ')} fill="none" stroke={COPPER} strokeWidth="2.2" />
    <circle cx={px(mos.vgs)} cy={py(now)} r="4.5" fill={COPPER} stroke="#fbfaf7" strokeWidth="1.5" />
  </svg>;
}
