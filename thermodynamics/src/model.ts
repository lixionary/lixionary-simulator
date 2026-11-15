/** Heat Lab model. Pure functions in SI units: kelvin, joules, watts, pascals, cubic metres. */

export const R = 8.314462618;
/** Volume of the gas at its most compressed, per mole. */
export const START_VOLUME = 0.01;
export const ZERO_C = 273.15;

export type Gas = 'monatomic' | 'diatomic';
export const GAMMA: Record<Gas, number> = { monatomic: 5 / 3, diatomic: 7 / 5 };

export interface Cycle { tHot: number; tCold: number; ratio: number; gas: Gas; moles: number }
export interface GasState { p: number; v: number; t: number; s: number }
export interface CarnotCycle {
  corners: [GasState, GasState, GasState, GasState];
  qHot: number; qCold: number; work: number; efficiency: number; entropy: number; gamma: number; moles: number;
}
export const STROKES = ['Hot expansion', 'Insulated expansion', 'Cold compression', 'Insulated compression'] as const;

/** The four corners of a Carnot cycle and its energy budget. Entropy is measured from corner 1. */
export function carnotCycle({ tHot, tCold, ratio, gas, moles }: Cycle): CarnotCycle {
  const gamma = GAMMA[gas], stretch = (tHot / tCold) ** (1 / (gamma - 1)), v1 = START_VOLUME * moles, entropy = moles * R * Math.log(ratio);
  const at = (v: number, t: number, s: number): GasState => ({ p: moles * R * t / v, v, t, s });
  const qHot = tHot * entropy, qCold = tCold * entropy;
  return { corners: [at(v1, tHot, 0), at(v1 * ratio, tHot, entropy), at(v1 * ratio * stretch, tCold, entropy), at(v1 * stretch, tCold, 0)], qHot, qCold, work: qHot - qCold, efficiency: 1 - tCold / tHot, entropy, gamma, moles };
}

/** The gas at a point in the cycle. Phase runs 0 to 1; each stroke takes a quarter, and volume changes by equal ratios in equal steps. */
export function stateAt(cycle: CarnotCycle, phase: number): GasState & { stroke: number } {
  const turn = ((phase % 1) + 1) % 1, stroke = Math.min(3, Math.floor(turn * 4)), f = turn * 4 - stroke;
  const from = cycle.corners[stroke], to = cycle.corners[(stroke + 1) % 4], v = from.v * (to.v / from.v) ** f;
  const isothermal = stroke % 2 === 0, t = isothermal ? from.t : from.t * (from.v / v) ** (cycle.gamma - 1);
  const s = isothermal ? from.s + cycle.moles * R * Math.log(v / from.v) : from.s;
  return { p: cycle.moles * R * t / v, v, t, s, stroke };
}

/** Points around the whole cycle, for plotting. */
export function cyclePath(cycle: CarnotCycle, perStroke = 40): (GasState & { stroke: number })[] {
  return Array.from({ length: 4 * perStroke + 1 }, (_, i) => i === 4 * perStroke ? { ...cycle.corners[0], stroke: 3 } : stateAt(cycle, i / (4 * perStroke)));
}

export interface Engine { conductance: number; rate: number; friction: number }
export interface EngineState {
  stalled: boolean; tGasHot: number; tGasCold: number; heatIn: number; heatOut: number; power: number;
  efficiency: number; carnot: number; entropyRate: number; stallRate: number; bestRate: number; bestPower: number; bestEfficiency: number;
}

/**
 * The same cycle run at a finite rate. Heat has to cross a conductance on each side, so the gas runs cooler than the source and
 * warmer than the sink. Inside, the cycle is still reversible. A fixed share of the work is then lost to friction and joins the waste heat.
 */
export function realEngine(cycle: Cycle, { conductance, rate, friction }: Engine): EngineState {
  const { tHot, tCold } = cycle, perCycle = cycle.moles * R * Math.log(cycle.ratio), carnot = 1 - tCold / tHot, keep = 1 - friction;
  const root = Math.sqrt(tHot / tCold), stallRate = conductance * (tHot - tCold) / (tHot + tCold) / perCycle, bestRate = conductance * (root - 1) / (root + 1) / perCycle;
  const best = { stallRate, bestRate, bestPower: keep * conductance / 2 * (Math.sqrt(tHot) - Math.sqrt(tCold)) ** 2, bestEfficiency: keep * (1 - Math.sqrt(tCold / tHot)) };
  const flow = rate * perCycle;
  if (flow >= conductance * (tHot - tCold) / (tHot + tCold)) {
    // Driven so fast that the gas would be hotter on its cold stroke than on its hot one. No net work: heat just leaks through.
    const leak = conductance * (tHot - tCold) / 2;
    return { stalled: true, tGasHot: (tHot + tCold) / 2, tGasCold: (tHot + tCold) / 2, heatIn: leak, heatOut: leak, power: 0, efficiency: 0, carnot, entropyRate: leak / tCold - leak / tHot, ...best };
  }
  const tGasHot = conductance * tHot / (conductance + flow), tGasCold = conductance * tCold / (conductance - flow);
  const heatIn = flow * tGasHot, power = keep * flow * (tGasHot - tGasCold), heatOut = heatIn - power;
  return { stalled: false, tGasHot, tGasCold, heatIn, heatOut, power, efficiency: heatIn > 0 ? power / heatIn : keep * carnot, carnot, entropyRate: heatOut / tCold - heatIn / tHot, ...best };
}

export type Mode = 'fridge' | 'cooler' | 'heater';
export interface Pump { mode: Mode; tCold: number; tHot: number; gap: number; quality: number; leak: number }
export interface PumpState {
  tCoilCold: number; tCoilHot: number; copCooling: number; copHeating: number; cop: number; limit: number;
  demand: number; electricity: number; heatCold: number; heatHot: number; entropyRate: number;
}

/**
 * A Carnot cycle run backwards. The cold coil must be colder than the space it takes heat from and the hot coil warmer than the
 * space it heats, by `gap` kelvin each. The compressor needs 1/quality times the ideal work. `leak` is the heat that flows back
 * through the walls per kelvin of difference, which is the heat the machine has to keep moving.
 */
export function heatPump({ mode, tCold, tHot, gap, quality, leak }: Pump): PumpState {
  const tCoilCold = tCold - gap, tCoilHot = tHot + gap, copCooling = quality * tCoilCold / (tCoilHot - tCoilCold), copHeating = copCooling + 1;
  const heating = mode === 'heater', cop = heating ? copHeating : copCooling, limit = (heating ? tHot : tCold) / (tHot - tCold);
  const demand = leak * (tHot - tCold), electricity = demand / cop, heatCold = heating ? demand - electricity : demand, heatHot = heatCold + electricity;
  return { tCoilCold, tCoilHot, copCooling, copHeating, cop, limit, demand, electricity, heatCold, heatHot, entropyRate: heatHot / tHot - heatCold / tCold };
}

/** Which temperature is "the weather" for a machine: the one its owner does not choose. */
export const outsideOf = (pump: Pump) => pump.mode === 'heater' ? pump.tCold : pump.tHot;
export const withOutside = (pump: Pump, t: number): Pump => pump.mode === 'heater' ? { ...pump, tCold: t } : { ...pump, tHot: t };
