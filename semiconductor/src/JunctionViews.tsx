import { bandsAt, solveJunction, type Junction, type JunctionState } from './model';
import { si, volts } from './format';

const P_TINT = '#c65a48', N_TINT = '#4d7fc0';

/** The diode drawn three ways on one position axis: the silicon itself, its energy bands, and its electric field. */
export function BandDiagram({ j, s }: { j: Junction; s: JunctionState }) {
  const W = 720, left = 24, right = 696, scale = solveJunction({ ...j, voltage: Math.min(-3, j.voltage) }), half = 1.35 * Math.max(scale.xn, scale.xp);
  const px = (x: number) => left + (Math.max(-half, Math.min(half, x)) + half) / (2 * half) * (right - left);
  const xs = Array.from({ length: 181 }, (_, i) => -half + i * 2 * half / 180), bands = xs.map(x => bandsAt(j, s, x));
  const top = bands[0].conduction + 0.18, bottom = bands[180].valence - 0.18, py = (e: number) => 108 + (top - e) / (top - bottom) * 196;
  const line = (key: 'conduction' | 'valence' | 'middle') => xs.map((x, i) => `${px(x).toFixed(1)},${py(bands[i][key]).toFixed(1)}`).join(' ');
  const edgeP = px(-s.xp), edgeN = px(s.xn), mid = px(0), peak = Math.min(1, s.field / (scale.field * 1.25)) * 44;
  const marks = (from: number, to: number) => Array.from({ length: Math.max(0, Math.floor((to - from) / 15)) }, (_, i) => from + 9 + i * 15);
  return <svg className="si-bands" viewBox={`0 0 ${W} 404`} role="img" aria-label={`Band diagram of the junction. The barrier is ${s.barrier.toFixed(2)} electron-volts and the depleted strip is ${si(s.width, 'm')} wide.`}>
    <rect x={left} y="26" width={edgeP - left} height="50" fill={P_TINT} fillOpacity=".3" /><rect x={edgeP} y="26" width={mid - edgeP} height="50" fill={P_TINT} fillOpacity=".09" />
    <rect x={mid} y="26" width={edgeN - mid} height="50" fill={N_TINT} fillOpacity=".09" /><rect x={edgeN} y="26" width={right - edgeN} height="50" fill={N_TINT} fillOpacity=".3" />
    <rect x={left} y="26" width={right - left} height="50" fill="none" stroke="#b9b3a5" /><path d={`M${mid} 26V76`} stroke="#8a8478" />
    {marks(edgeP, mid).map(x => <text key={x} x={x} y="55" textAnchor="middle" className="si-ion" fill={P_TINT}>−</text>)}{marks(mid, edgeN).map(x => <text key={x} x={x} y="55" textAnchor="middle" className="si-ion" fill={N_TINT}>+</text>)}
    <text x={left} y="18" className="si-strong">p-type · holes</text><text x={right} y="18" textAnchor="end" className="si-strong">n-type · electrons</text>
    <text x={W / 2} y="18" textAnchor="middle">empty strip {si(s.width, 'm')} wide</text>
    <path d={`M${edgeP} 80V370M${edgeN} 80V370`} stroke="#cfc9bb" strokeDasharray="3 5" />
    <polyline data-band="conduction" points={line('conduction')} fill="none" stroke="#33444b" strokeWidth="2" /><polyline data-band="valence" points={line('valence')} fill="none" stroke="#33444b" strokeWidth="2" />
    <polyline points={line('middle')} fill="none" stroke="#b9b3a5" strokeDasharray="2 5" />
    <path data-fermi="p" d={`M${left} ${py(0)}H${edgeP}`} stroke={P_TINT} strokeWidth="1.5" /><path d={`M${edgeP} ${py(0)}H${edgeN}`} stroke={P_TINT} strokeDasharray="4 4" opacity=".6" />
    <path data-fermi="n" d={`M${edgeN} ${py(s.across)}H${right}`} stroke={N_TINT} strokeWidth="1.5" /><path d={`M${edgeP} ${py(s.across)}H${edgeN}`} stroke={N_TINT} strokeDasharray="4 4" opacity=".6" />
    <text x={left + 4} y={py(bands[0].conduction) - 7}>conduction band</text><text x={left + 4} y={py(bands[0].valence) + 15}>valence band</text>
    {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={right - 130 - i * 34} cy={py(bands[180].conduction) - 7} r="4" fill={N_TINT} />)}
    {[0, 1, 2, 3, 4, 5].map(i => <circle key={i} cx={left + 150 + i * 34} cy={py(bands[0].valence) + 11} r="4" fill="#fbfaf7" stroke={P_TINT} strokeWidth="1.6" />)}
    <path d={`M${right - 12} ${py(bands[0].conduction)}V${py(bands[180].conduction)}`} stroke="#a5622f" strokeWidth="1.4" /><text x={right - 18} y={(py(bands[0].conduction) + py(bands[180].conduction)) / 2 + 3} textAnchor="end" className="si-strong">hill {s.barrier.toFixed(2)} eV</text>
    <path d={`M${left} 384H${right}`} stroke="#d8d3c6" /><path data-field d={`M${edgeP} 384L${mid} ${384 - peak}L${edgeN} 384Z`} fill="#a5622f" fillOpacity=".25" stroke="#a5622f" />
    <text x={left + 4} y="398">electric field · peak {(s.field / 1e5).toFixed(s.field < 1e7 ? 1 : 0)} kV/cm</text>
  </svg>;
}

/** Current against voltage, on a linear or a logarithmic current axis. */
export function DiodeCurve({ j, s, log }: { j: Junction; s: JunctionState; log: boolean }) {
  const W = 440, H = 230, left = 60, right = W - 12, top = 16, bottom = 196, low = j.voltage >= -1 ? -1 : Math.floor(j.voltage) - 1, high = 1;
  const vs = Array.from({ length: 241 }, (_, i) => low + i * (high - low) / 240), currents = vs.map(voltage => solveJunction({ ...j, voltage }).current);
  const limit = Math.max(1e-3, 1.5 * Math.abs(s.current)), px = (v: number) => left + (v - low) / (high - low) * (right - left);
  const py = log ? (i: number) => bottom - (Math.max(-15, Math.min(0, Math.log10(Math.abs(i) + 1e-30))) + 15) / 15 * (bottom - top) : (i: number) => bottom - (Math.max(-0.5, Math.min(1.2, i / limit)) + 0.3) / 1.3 * (bottom - top);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Diode current against voltage on a ${log ? 'logarithmic' : 'linear'} scale. At ${volts(j.voltage)} the current is ${si(s.current, 'A')}.`}>
    {log ? [-15, -12, -9, -6, -3, 0].map(p => <g key={p}><path d={`M${left} ${py(10 ** p)}H${right}`} stroke="#ecebe2" /><text x={left - 5} y={py(10 ** p) + 3} textAnchor="end">{si(10 ** p, 'A').replace('.00', '')}</text></g>)
      : <><path d={`M${left} ${py(0)}H${right}`} stroke="#bdbcae" /><text x={left - 5} y={py(0) + 3} textAnchor="end">0</text><text x={left - 5} y={py(limit) + 8} textAnchor="end">{si(limit, 'A')}</text></>}
    <path d={`M${px(0)} ${top}V${bottom}`} stroke="#bdbcae" />
    <text x={left} y={bottom + 16}>{volts(low, 0)}</text><text x={px(0)} y={bottom + 16} textAnchor="middle">0</text><text x={right} y={bottom + 16} textAnchor="end">+1 V</text>
    <text x={(left + px(0)) / 2} y={H - 3} textAnchor="middle">reverse</text><text x={(px(0) + right) / 2} y={H - 3} textAnchor="middle">forward</text>
    <clipPath id={log ? 'si-clip-log' : 'si-clip'}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
    <polyline clipPath={`url(#${log ? 'si-clip-log' : 'si-clip'})`} data-testid={log ? 'si-iv-log' : 'si-iv'} points={vs.map((v, i) => `${px(v).toFixed(1)},${py(currents[i]).toFixed(1)}`).join(' ')} fill="none" stroke="#a5622f" strokeWidth="2" />
    <circle cx={px(j.voltage)} cy={py(s.current)} r="4.5" fill="#a5622f" stroke="#fbfaf7" strokeWidth="1.5" />
  </svg>;
}
