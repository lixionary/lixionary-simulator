/** Silicon device physics. SI units inside; doping is given per cm³ as on a datasheet. */

export const Q = 1.602176634e-19;
export const KB = 1.380649e-23;
export const EPS0 = 8.8541878128e-12;
export const EPS_SI = 11.7 * EPS0, EPS_OX = 3.9 * EPS0;
const PER_CM3 = 1e6;

export const thermalVoltage = (kelvin: number) => KB * kelvin / Q;
/** Band gap of silicon in eV (Varshni). */
export const bandGap = (kelvin: number) => 1.17 - 4.73e-4 * kelvin * kelvin / (kelvin + 636);
/** Intrinsic carrier density per cm³ (Misiakos and Tsamakis). */
export const intrinsic = (kelvin: number) => 5.29e19 * (kelvin / 300) ** 2.54 * Math.exp(-6726 / kelvin);
/** Carrier mobility in cm²/Vs at room temperature against total doping (Caughey–Thomas fits). */
export const mobilityN = (doping: number) => 68.5 + (1414 - 68.5) / (1 + (doping / 9.2e16) ** 0.711);
export const mobilityP = (doping: number) => 44.9 + (470.5 - 44.9) / (1 + (doping / 2.23e17) ** 0.719);

// ───────────────────────── Stage 1: the PN junction ─────────────────────────

export interface Junction { na: number; nd: number; temperature: number; voltage: number }
/** The diode's area, minority-carrier lifetime, and the resistance of its contacts and bulk. */
export const DIODE = { area: 1e-6, lifetime: 1e-6, resistance: 1 };

/** Reverse voltage at which the peak field reaches silicon's critical field (Sze's fit). */
export function breakdownVoltage(na: number, nd: number) {
  const lighter = na * nd / (na + nd), critical = 4e7 / (1 - Math.log10(lighter / 1e16) / 3);
  return EPS_SI * critical * critical / (2 * Q * lighter * PER_CM3);
}

/** Saturation current in amperes: the trickle of minority carriers that diffuse to the junction. */
export function saturationCurrent(na: number, nd: number, kelvin: number) {
  const vt = thermalVoltage(kelvin), ni = intrinsic(kelvin) * PER_CM3;
  const diffusion = (mobility: number) => mobility * 1e-4 * vt, length = (d: number) => Math.sqrt(d * DIODE.lifetime);
  const dp = diffusion(mobilityP(nd)), dn = diffusion(mobilityN(na));
  return DIODE.area * Q * ni * ni * (dp / (length(dp) * nd * PER_CM3) + dn / (length(dn) * na * PER_CM3));
}

/** Current for a voltage across the junction itself: Shockley's equation plus a steep breakdown branch. */
function junctionCurrent(vj: number, saturation: number, vt: number, breakdown: number) {
  return saturation * Math.expm1(vj / vt) - 1e-6 * Math.exp(Math.min(60, -(vj + breakdown) / (2 * vt)));
}

/** Everything about the diode at one applied voltage. Lengths in metres, field in V/m, energies in eV. */
export function solveJunction({ na, nd, temperature, voltage }: Junction) {
  const vt = thermalVoltage(temperature), ni = intrinsic(temperature), builtIn = vt * Math.log(na * nd / (ni * ni));
  const saturation = saturationCurrent(na, nd, temperature), breakdown = breakdownVoltage(na, nd);
  let low = Math.min(voltage, -breakdown - 3), high = Math.max(voltage, 0);
  for (let i = 0; i < 70; i++) { const mid = (low + high) / 2; if (voltage - mid - DIODE.resistance * junctionCurrent(mid, saturation, vt, breakdown) > 0) low = mid; else high = mid; }
  const across = (low + high) / 2, current = junctionCurrent(across, saturation, vt, breakdown);
  const barrier = Math.max(builtIn - across, 0.02), width = Math.sqrt(2 * EPS_SI / Q * (1 / (na * PER_CM3) + 1 / (nd * PER_CM3)) * barrier);
  const xn = width * na / (na + nd), xp = width * nd / (na + nd);
  return {
    vt, ni, builtIn, saturation, breakdown, across, current, barrier, width, xn, xp,
    field: Q * nd * PER_CM3 * xn / EPS_SI, capacitance: EPS_SI / width * DIODE.area,
    state: across < -breakdown + 0.05 ? 'breakdown' as const : voltage > 0.005 ? 'forward' as const : voltage < -0.005 ? 'reverse' as const : 'equilibrium' as const,
  };
}
export type JunctionState = ReturnType<typeof solveJunction>;

/** Band edges in eV at a position (metres, p side negative). Zero is the p side's Fermi level. */
export function bandsAt(j: Junction, s: JunctionState, x: number) {
  const na = j.na * PER_CM3, nd = j.nd * PER_CM3;
  const potential = x <= -s.xp ? 0 : x >= s.xn ? s.barrier : x < 0 ? Q * na / (2 * EPS_SI) * (x + s.xp) ** 2 : s.barrier - Q * nd / (2 * EPS_SI) * (s.xn - x) ** 2;
  const middle = s.vt * Math.log(j.na / s.ni) - potential, half = bandGap(j.temperature) / 2;
  return { conduction: middle + half, valence: middle - half, middle };
}

// ───────────────────────── Stage 2: the MOS transistor ─────────────────────────

export interface Mos { na: number; toxNm: number; ratio: number; vgs: number; vds: number }
const ROOM = 300, LAMBDA = 0.05;

/** What the choice of substrate doping and oxide thickness fixes, for an n-channel device with an n+ gate. */
export function designMos(na: number, toxNm: number) {
  const vt = thermalVoltage(ROOM), fermi = vt * Math.log(na / intrinsic(ROOM)), cox = EPS_OX / (toxNm * 1e-9);
  const flatBand = -(bandGap(ROOM) / 2 + fermi), body = Math.sqrt(2 * Q * EPS_SI * na * PER_CM3) / cox;
  const depletion = Math.sqrt(4 * EPS_SI * fermi / (Q * na * PER_CM3)), slope = 1 + EPS_SI / depletion / cox;
  return { vt, fermi, cox, flatBand, body, depletion, slope, threshold: flatBand + 2 * fermi + body * Math.sqrt(2 * fermi), gain: mobilityN(na) * 0.5e-4 * cox, swing: slope * vt * Math.LN10 };
}
export type MosDesign = ReturnType<typeof designMos>;

const softSquare = (v: number) => { const l = v > 40 ? v : Math.log1p(Math.exp(v)); return l * l; };
/**
 * Drain current in amperes from one continuous equation (EKV): exponential below threshold, square law above,
 * levelling off once the channel pinches off. `strength` is width over length times any mobility factor.
 */
export function drainCurrent(d: MosDesign, strength: number, vgs: number, vds: number) {
  const pinch = (vgs - d.threshold) / d.slope;
  return 2 * d.slope * d.gain * strength * d.vt * d.vt * (softSquare(pinch / (2 * d.vt)) - softSquare((pinch - vds) / (2 * d.vt))) * (1 + LAMBDA * vds);
}
/** The gate voltage's excess over threshold as seen by the channel; the drain voltage where current levels off. */
export const pinchOff = (d: MosDesign, vgs: number) => (vgs - d.threshold) / d.slope;
export function mosRegion(d: MosDesign, vgs: number, vds: number) {
  return vgs < d.threshold ? 'cutoff' as const : vds < pinchOff(d, vgs) ? 'triode' as const : 'saturation' as const;
}
export const transconductance = (d: MosDesign, strength: number, vgs: number, vds: number) => (drainCurrent(d, strength, vgs + 1e-4, vds) - drainCurrent(d, strength, vgs - 1e-4, vds)) / 2e-4;

// ───────────────────────── Stage 3: the CMOS gate ─────────────────────────

export type GateKind = 'not' | 'nand' | 'nor';
export interface Gate { kind: GateKind; vdd: number; vinA: number; bHigh: boolean; pWidth: number }
/** Holes move about 0.4 times as easily as electrons, so a p-channel device needs extra width to match. */
export const HOLE_FACTOR = 0.4;
export const LOAD = 10e-15;

/** Pull-down and pull-up currents of the gate at an output voltage. Two devices in series count as one of half the strength. */
export function gateCurrents(d: MosDesign, ratio: number, g: Gate, vinA: number, vout: number) {
  const n = (strength: number, vin: number) => drainCurrent(d, ratio * strength, vin, vout);
  const p = (strength: number, vin: number) => drainCurrent(d, ratio * g.pWidth * HOLE_FACTOR * strength, g.vdd - vin, g.vdd - vout);
  const vinB = g.bHigh ? g.vdd : 0;
  if (g.kind === 'not') return { down: n(1, vinA), up: p(1, vinA) };
  if (g.kind === 'nand') return { down: g.bHigh ? n(0.5, vinA) : 0, up: p(1, vinA) + p(1, vinB) };
  return { down: n(1, vinA) + n(1, vinB), up: g.bHigh ? 0 : p(0.5, vinA) };
}

/** Output voltage: where the pull-down current equals the pull-up current. */
export function gateOutput(d: MosDesign, ratio: number, g: Gate, vinA = g.vinA) {
  let low = 0, high = g.vdd;
  for (let i = 0; i < 50; i++) { const mid = (low + high) / 2, c = gateCurrents(d, ratio, g, vinA, mid); if (c.down > c.up) high = mid; else low = mid; }
  return (low + high) / 2;
}

/** The transfer curve for input A swept from 0 to the supply, and what it says about the gate as a switch. */
export function transferCurve(d: MosDesign, ratio: number, g: Gate, steps = 120) {
  const vin = Array.from({ length: steps + 1 }, (_, i) => g.vdd * i / steps), vout = vin.map(v => gateOutput(d, ratio, g, v));
  let low = 0, high = g.vdd;
  for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (gateOutput(d, ratio, g, mid) > mid) low = mid; else high = mid; }
  const threshold = (low + high) / 2, slopes = vin.slice(1).map((_, i) => (vout[i + 1] - vout[i]) / (vin[i + 1] - vin[i]));
  const first = slopes.findIndex(s => s < -1), last = slopes.length - 1 - [...slopes].reverse().findIndex(s => s < -1);
  const regenerates = first >= 0;
  return {
    vin, vout, threshold, gain: Math.max(...slopes.map(s => -s)), regenerates,
    marginLow: regenerates ? vin[first] - vout[vout.length - 1] : 0, marginHigh: regenerates ? vout[0] - vin[last + 1] : 0,
  };
}

/** Switching cost of driving a 10 fF load, and what leaks when nothing switches. */
export function switching(d: MosDesign, ratio: number, g: Gate) {
  const on = Math.min(drainCurrent(d, ratio, g.vdd, g.vdd / 2), drainCurrent(d, ratio * g.pWidth * HOLE_FACTOR, g.vdd, g.vdd / 2));
  return { energy: LOAD * g.vdd * g.vdd, delay: LOAD * g.vdd / (2 * on), leakage: drainCurrent(d, ratio, 0, g.vdd) * g.vdd };
}
