import { describe, expect, it } from 'vitest';
import { bandGap, bandsAt, breakdownVoltage, designMos, drainCurrent, gateCurrents, gateOutput, intrinsic, mobilityN, mobilityP, mosRegion, pinchOff, saturationCurrent, solveJunction, switching, thermalVoltage, transconductance, transferCurve, type Gate, type Junction } from './model';
import { doping, power10, si, volts } from './format';
import { GATE, PRESETS } from './presets';

const diode = (voltage: number, patch: Partial<Junction> = {}): Junction => ({ na: 1e17, nd: 1e16, temperature: 300, voltage, ...patch });
const d = designMos(1e17, 10);
const gate = (patch: Partial<Gate> = {}): Gate => ({ ...GATE, ...patch });

describe('silicon', () => {
  it('has the textbook room-temperature constants', () => {
    expect(thermalVoltage(300) * 1000).toBeCloseTo(25.85, 2);
    expect(bandGap(300)).toBeCloseTo(1.12, 2);
    expect(intrinsic(300) / 1e10).toBeCloseTo(0.97, 2);
    expect(mobilityN(1e14)).toBeGreaterThan(1350); expect(mobilityP(1e14)).toBeGreaterThan(450); expect(mobilityN(1e19)).toBeLessThan(120);
  });
});

describe('the junction', () => {
  it('has a built-in voltage of (kT/q) ln(NaNd/ni²) and balanced charge', () => {
    const s = solveJunction(diode(0));
    expect(s.builtIn).toBeCloseTo(0.775, 3); expect(s.current).toBeCloseTo(0, 20); expect(s.state).toBe('equilibrium');
    expect(s.xn * 1e16).toBeCloseTo(s.xp * 1e17, 12); expect(s.width * 1e9).toBeCloseTo(332, 0);
    expect(s.field * s.width / 2).toBeCloseTo(s.builtIn, 6);
  });
  it('conducts exponentially forward: ten times the current per 60 mV', () => {
    const low = solveJunction(diode(0.40)).current, high = solveJunction(diode(0.46)).current;
    expect(high / low).toBeCloseTo(10 ** (0.06 / (thermalVoltage(300) * Math.LN10)), 1);
    expect(solveJunction(diode(0.65)).current * 1000).toBeCloseTo(4.03, 1); expect(solveJunction(diode(0.65)).state).toBe('forward');
  });
  it('is held back by its series resistance at high current', () => {
    const s = solveJunction(diode(0.9));
    expect(s.across).toBeLessThan(0.76); expect(s.across + s.current * 1).toBeCloseTo(0.9, 6);
  });
  it('blocks in reverse, with a wider strip, a stronger field, and less capacitance', () => {
    const rest = solveJunction(diode(0)), back = solveJunction(diode(-5));
    expect(back.current).toBeCloseTo(-back.saturation, 18); expect(back.current * 1e15).toBeCloseTo(-56.7, 0); expect(back.state).toBe('reverse');
    expect(back.width).toBeGreaterThan(2.5 * rest.width); expect(back.field).toBeGreaterThan(rest.field); expect(back.capacitance).toBeLessThan(rest.capacitance);
    expect(back.width / rest.width).toBeCloseTo(Math.sqrt((0.775 + 5) / 0.775), 2);
  });
  it('leaks far more and turns on about 2 mV per kelvin earlier when hot', () => {
    expect(saturationCurrent(1e17, 1e16, 400) / saturationCurrent(1e17, 1e16, 300)).toBeGreaterThan(1e5);
    expect(saturationCurrent(1e17, 1e16, 304) / saturationCurrent(1e17, 1e16, 300)).toBeCloseTo(2, 0);
    const at = (temperature: number) => { let low = 0, high = 0.9; for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (solveJunction(diode(mid, { temperature })).current < 1e-3) low = mid; else high = mid; } return low; };
    expect((at(350) - at(300)) / 50 * 1000).toBeCloseTo(-2, 0);
  });
  it('breaks down near 5.5 V when heavily doped, and far beyond reach when lightly doped', () => {
    expect(breakdownVoltage(1e18, 1e18)).toBeCloseTo(5.5, 1); expect(breakdownVoltage(1e17, 1e16)).toBeGreaterThan(40);
    const zener = { na: 1e18, nd: 1e18, temperature: 300 };
    expect(solveJunction({ ...zener, voltage: -5.8 }).state).toBe('breakdown'); expect(solveJunction({ ...zener, voltage: -5.8 }).current).toBeLessThan(-1e-4);
    expect(solveJunction({ ...zener, voltage: -3 }).state).toBe('reverse'); expect(Math.abs(solveJunction({ ...zener, voltage: -3 }).current)).toBeLessThan(1e-12);
  });
  it('draws bands that step down by the barrier and keep the gap', () => {
    const j = diode(0.3), s = solveJunction(j), left = bandsAt(j, s, -1e-6), right = bandsAt(j, s, 1e-6), middle = bandsAt(j, s, 0);
    expect(left.conduction - right.conduction).toBeCloseTo(s.barrier, 9); expect(s.barrier).toBeCloseTo(s.builtIn - s.across, 9);
    expect(left.conduction - left.valence).toBeCloseTo(bandGap(300), 9); expect(middle.conduction).toBeLessThan(left.conduction); expect(middle.conduction).toBeGreaterThan(right.conduction);
    expect(s.across - right.middle).toBeCloseTo(s.vt * Math.log(j.nd / s.ni), 6);
  });
});

describe('the transistor', () => {
  it('has a threshold set by doping and oxide', () => {
    expect(d.threshold).toBeCloseTo(0.337, 3); expect(d.swing * 1000).toBeCloseTo(76.7, 1);
    expect(designMos(5e17, 10).threshold).toBeGreaterThan(d.threshold); expect(designMos(1e17, 4).threshold).toBeLessThan(d.threshold);
    expect(designMos(1e17, 4).swing).toBeLessThan(d.swing); expect(designMos(1e17, 4).swing * 1000).toBeGreaterThan(59.5);
  });
  it('leaks exponentially below threshold at the stated slope', () => {
    expect(Math.log10(drainCurrent(d, 10, 0.1, 1.8) / drainCurrent(d, 10, 0, 1.8))).toBeCloseTo(0.1 / d.swing, 1);
    expect(mosRegion(d, 0.2, 1.8)).toBe('cutoff');
  });
  it('follows the square law above threshold and levels off after pinch-off', () => {
    const ideal = d.gain * 10 * (2 - d.threshold) ** 2 / (2 * d.slope) * (1 + 0.05 * 2.5);
    expect(drainCurrent(d, 10, 2, 2.5) / ideal).toBeCloseTo(1, 1);
    expect(mosRegion(d, 1.5, 2.5)).toBe('saturation'); expect(mosRegion(d, 2, 0.1)).toBe('triode'); expect(pinchOff(d, 1.5)).toBeCloseTo(0.90, 2);
    expect(drainCurrent(d, 10, 1.5, 2.5) / drainCurrent(d, 10, 1.5, 1.5)).toBeLessThan(1.06);
    expect(drainCurrent(d, 10, 2, 0.2) / drainCurrent(d, 10, 2, 0.1)).toBeGreaterThan(1.8);
  });
  it('carries no current without drain voltage, scales with width, and has positive gain', () => {
    expect(drainCurrent(d, 10, 2, 0)).toBe(0); expect(drainCurrent(d, 20, 2, 1) / drainCurrent(d, 10, 2, 1)).toBeCloseTo(2, 12);
    expect(transconductance(d, 10, 1.5, 2.5) * 1000).toBeCloseTo(1.26, 1);
    expect(drainCurrent(d, 10, 1.8, 1.8) / drainCurrent(d, 10, 0, 1.8)).toBeGreaterThan(1e6);
  });
});

describe('the gate', () => {
  it('inverts rail to rail with almost no current', () => {
    expect(gateOutput(d, 10, gate({ vinA: 0 }))).toBeCloseTo(1.8, 4); expect(gateOutput(d, 10, gate({ vinA: 1.8 }))).toBeCloseTo(0, 4);
    const idle = gateCurrents(d, 10, gate(), 0, gateOutput(d, 10, gate({ vinA: 0 })));
    expect(Math.min(idle.up, idle.down)).toBeLessThan(1e-9);
    const fight = gateCurrents(d, 10, gate(), 0.9, 0.9); expect(fight.up).toBeCloseTo(fight.down, 8); expect(fight.down).toBeGreaterThan(1e-4);
  });
  it('switches at half the supply when the p-channel is 2.5 times wider, with gain and noise margins', () => {
    const curve = transferCurve(d, 10, gate());
    expect(curve.threshold).toBeCloseTo(0.9, 3); expect(curve.gain).toBeGreaterThan(20); expect(curve.regenerates).toBe(true);
    expect(curve.marginLow).toBeCloseTo(curve.marginHigh, 2); expect(curve.marginLow).toBeGreaterThan(0.6);
    expect(transferCurve(d, 10, gate({ pWidth: 1 })).threshold).toBeLessThan(0.85); expect(transferCurve(d, 10, gate({ pWidth: 5 })).threshold).toBeGreaterThan(0.95);
  });
  it('gives the NAND and NOR truth tables from the transistors alone', () => {
    const table = (kind: 'nand' | 'nor') => [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => gateOutput(d, 10, gate({ kind, bHigh: b === 1 }), a * 1.8) > 0.9 ? 1 : 0);
    expect(table('nand')).toEqual([1, 1, 1, 0]); expect(table('nor')).toEqual([1, 0, 0, 0]);
    expect(transferCurve(d, 10, gate({ kind: 'nand', bHigh: true })).threshold).toBeGreaterThan(0.9); expect(transferCurve(d, 10, gate({ kind: 'nor', bHigh: false })).threshold).toBeLessThan(0.9);
  });
  it('still works at 0.4 V, on a twentieth of the energy and far more slowly', () => {
    const low = gate({ vdd: 0.4 }), curve = transferCurve(d, 10, low), slow = switching(d, 10, low), fast = switching(d, 10, gate());
    expect(curve.regenerates).toBe(true); expect(gateOutput(d, 10, low, 0)).toBeCloseTo(0.4, 3);
    expect(fast.energy / slow.energy).toBeCloseTo(20.25, 6); expect(fast.energy * 1e15).toBeCloseTo(32.4, 6);
    expect(slow.delay / fast.delay).toBeGreaterThan(40); expect(slow.delay / fast.delay).toBeLessThan(90); expect(fast.delay * 1e12).toBeCloseTo(8.7, 0);
  });
  it('builds every preset', () => {
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(Boolean(p.junction) || Boolean(p.mos) || Boolean(p.gate)).toBe(true);
  });
});

describe('formatting', () => {
  it('uses SI prefixes, powers of ten, and a real minus sign', () => {
    expect(si(4.029e-3, 'A')).toBe('4.03 mA'); expect(si(-5.67e-14, 'A')).toBe('−56.7 fA'); expect(si(1.36e-7, 'm')).toBe('136 nm'); expect(si(0, 'A')).toBe('0 A'); expect(si(3.24e-14, 'J')).toBe('32.4 fJ');
    expect(doping(1e17)).toBe('1.0 × 10¹⁷ per cm³'); expect(doping(5e15)).toBe('5.0 × 10¹⁵ per cm³');
    expect(volts(-5)).toBe('−5.00 V'); expect(volts(0.337, 3)).toBe('0.337 V'); expect(volts(-0.001)).toBe('0.00 V');
    expect(power10(1.6e7)).toBe('10⁷'); expect(power10(1e-12)).toBe('10⁻¹²');
  });
});
