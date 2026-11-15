import { gateOutput, transferCurve, type Gate, type MosDesign } from './model';
import { volts } from './format';

const COPPER = '#a5622f', IDLE = '#b4b0a6';
export const logic = (voltage: number, vdd: number) => voltage > vdd / 2 ? 1 : 0;
/** A voltage near the middle is neither a 0 nor a 1. */
export const level = (voltage: number, vdd: number) => Math.abs(voltage - vdd / 2) < 0.2 * vdd ? 'neither' : String(logic(voltage, vdd));

function Fet({ x, y, p, on, label }: { x: number; y: number; p?: boolean; on: boolean; label: string }) {
  const tone = on ? COPPER : IDLE;
  return <g data-fet={`${p ? 'p' : 'n'}${label}`} data-on={on}>
    <path d={`M${x} ${y - 26}V${y - 12}H${x - 9}V${y + 12}H${x}V${y + 26}`} fill="none" stroke={tone} strokeWidth={on ? 2.6 : 1.5} strokeDasharray={on ? undefined : '4 3'} />
    <path d={`M${x - 15} ${y - 12}V${y + 12}`} stroke="#33444b" strokeWidth="2" />{p && <circle cx={x - 20} cy={y} r="4" fill="#fbfaf7" stroke="#33444b" />}
    <path d={`M${x - (p ? 24 : 15)} ${y}H${x - 38}`} stroke="#33444b" /><text x={x - 42} y={y + 4} textAnchor="end" className="si-strong">{label}</text>
    <text x={x + 8} y={y + 4}>{on ? 'on' : 'off'}</text>
  </g>;
}

/** The gate as transistors: p-channel devices pull the output up to the supply, n-channel devices pull it down to ground. */
export function Schematic({ gate, d, ratio }: { gate: Gate; d: MosDesign; ratio: number }) {
  const vb = gate.bHigh ? gate.vdd : 0, out = gateOutput(d, ratio, gate), nA = gate.vinA > d.threshold, pA = gate.vdd - gate.vinA > d.threshold, nB = vb > d.threshold, pB = gate.vdd - vb > d.threshold;
  const wires = { not: 'M240 40V64M240 116V174M240 145H350M240 226V262', nand: 'M190 40V64M290 40V64M190 116V135H290V116M240 135V149M240 135H350M240 253V262', nor: 'M240 40V46M240 150V165M190 174V165H290V174M290 165H350M190 226V262M290 226V262' }[gate.kind];
  return <svg className="si-schematic" viewBox="0 0 440 276" role="img" aria-label={`${gate.kind.toUpperCase()} gate built from transistors. The output is ${volts(out)}, logic ${level(out, gate.vdd)}.`}>
    <path d="M130 40H350M130 262H350" stroke="#33444b" strokeWidth="1.5" /><text x="126" y="44" textAnchor="end" className="si-strong">supply {volts(gate.vdd, 1)}</text><text x="126" y="266" textAnchor="end" className="si-strong">ground</text>
    <path d={wires} fill="none" stroke="#33444b" strokeWidth="1.5" />
    {gate.kind === 'not' && <><Fet x={240} y={90} p on={pA} label="A" /><Fet x={240} y={200} on={nA} label="A" /></>}
    {gate.kind === 'nand' && <><Fet x={190} y={90} p on={pA} label="A" /><Fet x={290} y={90} p on={pB} label="B" /><Fet x={240} y={175} on={nA} label="A" /><Fet x={240} y={227} on={nB} label="B" /></>}
    {gate.kind === 'nor' && <><Fet x={240} y={72} p on={pA} label="A" /><Fet x={240} y={124} p on={pB} label="B" /><Fet x={190} y={200} on={nA} label="A" /><Fet x={290} y={200} on={nB} label="B" /></>}
    <circle cx="350" cy={gate.kind === 'not' ? 145 : gate.kind === 'nand' ? 135 : 165} r="5" fill={logic(out, gate.vdd) ? COPPER : '#fbfaf7'} stroke={COPPER} strokeWidth="2" />
    <text x="362" y={(gate.kind === 'not' ? 145 : gate.kind === 'nand' ? 135 : 165) - 4} className="si-strong">out</text><text x="362" y={(gate.kind === 'not' ? 145 : gate.kind === 'nand' ? 135 : 165) + 10}>{volts(out)}</text>
  </svg>;
}

/** Output voltage against input A, with the present input marked. A steep middle is what makes signals clean. */
export function TransferPlot({ gate, d, ratio }: { gate: Gate; d: MosDesign; ratio: number }) {
  const W = 440, H = 230, left = 50, right = W - 12, top = 16, bottom = 196, curve = transferCurve(d, ratio, gate), out = gateOutput(d, ratio, gate);
  const px = (v: number) => left + v / gate.vdd * (right - left), py = (v: number) => bottom - v / gate.vdd * (bottom - top);
  return <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Output voltage against input A. The gate switches at ${volts(curve.threshold)} with a gain of ${curve.gain.toFixed(0)}.`}>
    <path d={`M${left} ${bottom}H${right}M${left} ${top}V${bottom}`} stroke="#bdbcae" /><path d={`M${left} ${bottom}L${right} ${top}`} stroke="#d8d3c6" strokeDasharray="3 5" />
    <text x={left - 5} y={top + 8} textAnchor="end">{volts(gate.vdd, 1)}</text><text x={left - 5} y={bottom + 3} textAnchor="end">0</text><text x={left} y={bottom + 16}>0</text><text x={right} y={bottom + 16} textAnchor="end">input A, {volts(gate.vdd, 1)}</text>
    {curve.regenerates && <text x={px(curve.threshold) + 8} y={py(gate.vdd / 2) + 3}>switches at {volts(curve.threshold)}</text>}
    <polyline data-testid="si-transfer-plot" points={curve.vin.map((v, i) => `${px(v).toFixed(1)},${py(curve.vout[i]).toFixed(1)}`).join(' ')} fill="none" stroke={COPPER} strokeWidth="2.2" />
    <circle cx={px(gate.vinA)} cy={py(out)} r="4.5" fill={COPPER} stroke="#fbfaf7" strokeWidth="1.5" />
  </svg>;
}

/** Every input combination with the output voltage the transistors actually settle at. */
export function TruthTable({ gate, d, ratio }: { gate: Gate; d: MosDesign; ratio: number }) {
  const rows = (gate.kind === 'not' ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]]).map(([a, b]) => ({ a, b, out: gateOutput(d, ratio, { ...gate, bHigh: b === 1 }, a * gate.vdd) }));
  const current = (row: { a: number; b?: number }) => logic(gate.vinA, gate.vdd) === row.a && (gate.kind === 'not' || (gate.bHigh ? 1 : 0) === row.b);
  return <table className="si-truth"><thead><tr><th>A</th>{gate.kind !== 'not' && <th>B</th>}<th>out</th><th>settles at</th></tr></thead>
    <tbody>{rows.map(row => <tr key={`${row.a}${row.b}`} aria-current={current(row) ? 'true' : undefined}><td>{row.a}</td>{gate.kind !== 'not' && <td>{row.b}</td>}<td><b>{logic(row.out, gate.vdd)}</b></td><td>{volts(row.out, 3)}</td></tr>)}</tbody></table>;
}
