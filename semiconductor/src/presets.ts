import type { Gate, Junction, Mos } from './model';

export type Stage = 'junction' | 'transistor' | 'gate';
export interface Preset { key: string; stage: Stage; group: string; name: string; notice: string; junction?: Junction; mos?: Mos; gate?: Gate }

export const JUNCTION: Junction = { na: 1e17, nd: 1e16, temperature: 300, voltage: 0.65 };
export const MOS: Mos = { na: 1e17, toxNm: 10, ratio: 10, vgs: 1.5, vds: 2.5 };
export const GATE: Gate = { kind: 'not', vdd: 1.8, vinA: 0, bHigh: true, pWidth: 2.5 };

export const PRESETS: Preset[] = [
  { key: 'rest', stage: 'junction', group: '1 · The junction', name: 'A junction at rest', junction: { ...JUNCTION, voltage: 0 },
    notice: 'Where p-type meets n-type, carriers cross and cancel, leaving a strip with no carriers and a built-in field. That field is a hill that stops the rest from following. No current flows.' },
  { key: 'diode', stage: 'junction', group: '1 · The junction', name: 'Forward: a diode conducts', junction: JUNCTION,
    notice: 'A forward voltage lowers the hill. Every 60 mV lets ten times more carriers over it, which is why a silicon diode “turns on” near 0.6 to 0.7 V.' },
  { key: 'reverse', stage: 'junction', group: '1 · The junction', name: 'Reverse: a diode blocks', junction: { ...JUNCTION, voltage: -5 },
    notice: 'A reverse voltage raises the hill and widens the empty strip. Only a few stray carriers cross: femtoamperes. This one-way behaviour is rectification.' },
  { key: 'hot', stage: 'junction', group: '1 · The junction', name: 'A hot diode', junction: { ...JUNCTION, temperature: 400, voltage: 0.5 },
    notice: 'Heat frees more carriers. At 400 K the leakage is hundreds of thousands of times larger and the turn-on voltage is about 0.2 V lower: roughly −2 mV per kelvin, the basis of silicon temperature sensors.' },
  { key: 'zener', stage: 'junction', group: '1 · The junction', name: 'Breakdown: a Zener diode', junction: { na: 1e18, nd: 1e18, temperature: 300, voltage: -5.8 },
    notice: 'Heavy doping makes the strip thin and the field enormous. Past about 5.5 V in reverse it conducts suddenly and holds that voltage: a voltage reference.' },
  { key: 'off', stage: 'transistor', group: '2 · The transistor', name: 'Gate low: switched off', mos: { ...MOS, vgs: 0.2, vds: 1.8 },
    notice: 'Two junctions back to back block current between source and drain. With the gate below threshold only a leak gets through, falling tenfold for every 77 mV less on the gate.' },
  { key: 'saturation', stage: 'transistor', group: '2 · The transistor', name: 'Gate high: a current source', mos: MOS,
    notice: 'The gate’s field pulls electrons to the surface and joins source to drain. With a high drain voltage the channel pinches off near the drain and the current stops rising: saturation, the amplifier’s region.' },
  { key: 'triode', stage: 'transistor', group: '2 · The transistor', name: 'A closed switch', mos: { ...MOS, vgs: 2, vds: 0.1 },
    notice: 'With little voltage across it, the channel is a plain resistor whose value the gate sets. This is a closed switch, the state a logic gate uses.' },
  { key: 'inverter', stage: 'gate', group: '3 · The logic gate', name: 'An inverter', gate: GATE,
    notice: 'One n-channel and one p-channel transistor share an input. Whatever the input, exactly one conducts, so the output is pulled firmly to the opposite rail and almost no current flows.' },
  { key: 'threshold', stage: 'gate', group: '3 · The logic gate', name: 'Halfway: both conduct', gate: { ...GATE, vinA: 0.9 },
    notice: 'At the midpoint both transistors are on and fight. The output is balanced on a knife edge with a gain of over thirty, and current flows straight from supply to ground.' },
  { key: 'nand', stage: 'gate', group: '3 · The logic gate', name: 'NAND', gate: { ...GATE, kind: 'nand', vinA: 1.8, bHigh: true },
    notice: 'Two n-channel transistors in series pull the output low only when both inputs are high. Every other logic function can be built from NAND gates alone.' },
  { key: 'low-voltage', stage: 'gate', group: '3 · The logic gate', name: 'Running on 0.4 V', gate: { ...GATE, vdd: 0.4 },
    notice: 'Energy per switch falls with the square of the supply voltage, so chips run as low as they can. At 0.4 V the gate still works on a twentieth of the energy, but it is about sixty times slower.' },
];
