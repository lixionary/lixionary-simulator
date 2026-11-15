import { describe, expect, it } from 'vitest';
import { carnotCycle, cyclePath, heatPump, outsideOf, R, realEngine, stateAt, withOutside, ZERO_C, type Cycle, type Engine, type Pump } from './model';
import { celsius, cop, kelvin, litres, percent, si } from './format';
import { CYCLE, ENGINE, MACHINES, PRESETS } from './presets';

const cycle = (patch: Partial<Cycle> = {}): Cycle => ({ ...CYCLE, ...patch });
const engine = (patch: Partial<Engine> = {}): Engine => ({ ...ENGINE, ...patch });
const pump = (patch: Partial<Pump> = {}): Pump => ({ ...MACHINES.heater, ...patch });

describe('the Carnot cycle', () => {
  it('turns 40% of the heat into work between 500 K and 300 K', () => {
    const c = carnotCycle(cycle());
    expect(c.efficiency).toBeCloseTo(0.4, 12); expect(c.qHot).toBeCloseTo(288.157, 2); expect(c.qCold).toBeCloseTo(172.894, 2);
    expect(c.work).toBeCloseTo(c.qHot - c.qCold, 12); expect(c.work / c.qHot).toBeCloseTo(c.efficiency, 12);
    expect(c.entropy).toBeCloseTo(0.1 * R * Math.LN2, 12); expect(c.qHot / 500).toBeCloseTo(c.qCold / 300, 12);
  });

  it('has an efficiency that depends only on the two temperatures', () => {
    for (const patch of [{ gas: 'diatomic' as const }, { ratio: 4.5 }, { moles: 0.5 }, { gas: 'diatomic' as const, ratio: 1.2, moles: 0.05 }]) expect(carnotCycle(cycle(patch)).efficiency).toBeCloseTo(0.4, 12);
    expect(carnotCycle(cycle({ tHot: 840 })).efficiency).toBeCloseTo(1 - 300 / 840, 12);
    expect(carnotCycle(cycle({ tHot: 320 })).efficiency).toBeCloseTo(0.0625, 12);
  });

  it('obeys the gas law and the adiabatic law at every corner', () => {
    for (const gas of ['monatomic', 'diatomic'] as const) {
      const c = carnotCycle(cycle({ gas })), [a, b, d, e] = c.corners;
      for (const g of c.corners) expect(g.p * g.v).toBeCloseTo(0.1 * R * g.t, 9);
      expect(b.v / a.v).toBeCloseTo(2, 12); expect(d.v / e.v).toBeCloseTo(2, 12);
      expect(b.t * b.v ** (c.gamma - 1)).toBeCloseTo(d.t * d.v ** (c.gamma - 1), 9);
      expect(b.p * b.v ** c.gamma).toBeCloseTo(d.p * d.v ** c.gamma, 9); expect(e.p * e.v ** c.gamma).toBeCloseTo(a.p * a.v ** c.gamma, 9);
    }
    expect(carnotCycle(cycle()).corners[2].v * 1000).toBeCloseTo(4.303, 3); expect(carnotCycle(cycle({ gas: 'diatomic' })).corners[2].v * 1000).toBeCloseTo(7.172, 3);
  });

  it('encloses an area equal to the work on both charts', () => {
    for (const patch of [{}, { gas: 'diatomic' as const, ratio: 3 }, { tHot: 900, tCold: 250 }]) {
      const c = carnotCycle(cycle(patch)), path = cyclePath(c, 400);
      let pv = 0, ts = 0;
      for (let i = 1; i < path.length; i++) { pv += (path[i].p + path[i - 1].p) / 2 * (path[i].v - path[i - 1].v); ts += (path[i].t + path[i - 1].t) / 2 * (path[i].s - path[i - 1].s); }
      expect(pv / c.work).toBeCloseTo(1, 4); expect(ts / c.work).toBeCloseTo(1, 9);
    }
  });

  it('moves through four strokes and returns to its start', () => {
    const c = carnotCycle(cycle());
    expect([0, 0.25, 0.5, 0.75].map(phase => stateAt(c, phase).stroke)).toEqual([0, 1, 2, 3]);
    expect(stateAt(c, 0.125)).toMatchObject({ t: 500, stroke: 0 }); expect(stateAt(c, 0.125).v * 1000).toBeCloseTo(Math.SQRT2, 9);
    expect(stateAt(c, 0.375).t).toBeLessThan(500); expect(stateAt(c, 0.375).t).toBeGreaterThan(300); expect(stateAt(c, 0.375).s).toBeCloseTo(c.entropy, 12);
    expect(stateAt(c, 0.625).t).toBeCloseTo(300, 9); expect(stateAt(c, 0.875).s).toBeCloseTo(0, 12);
    expect(stateAt(c, 1).p).toBeCloseTo(c.corners[0].p, 6); expect(stateAt(c, -0.25).stroke).toBe(3);
    const path = cyclePath(c); expect(path).toHaveLength(161); expect(path[160].v).toBeCloseTo(path[0].v, 12);
  });
});

describe('a real engine', () => {
  it('approaches Carnot efficiency only as its power goes to zero', () => {
    const still = realEngine(cycle(), engine({ rate: 0 })), slow = realEngine(cycle(), engine({ rate: 0.2 }));
    expect(still.power).toBe(0); expect(still.efficiency).toBeCloseTo(0.4, 12); expect(still.entropyRate).toBeCloseTo(0, 12);
    expect(slow.efficiency).toBeCloseTo(0.393, 3); expect(slow.power).toBeCloseTo(22.52, 2);
  });

  it('gives the most power at the Curzon–Ahlborn efficiency', () => {
    const best = realEngine(cycle(), engine()), at = realEngine(cycle(), engine({ rate: best.bestRate }));
    expect(best.bestRate).toBeCloseTo(4.408, 3); expect(best.bestEfficiency).toBeCloseTo(1 - Math.sqrt(0.6), 12);
    expect(at.power).toBeCloseTo(best.bestPower, 9); expect(at.power).toBeCloseTo(254.03, 2); expect(at.efficiency).toBeCloseTo(best.bestEfficiency, 9);
    for (const rate of [best.bestRate * 0.9, best.bestRate * 1.1]) expect(realEngine(cycle(), engine({ rate })).power).toBeLessThan(at.power);
    expect(realEngine(cycle(), engine({ conductance: 50 })).bestEfficiency).toBeCloseTo(best.bestEfficiency, 12);
  });

  it('runs its gas inside the two reservoir temperatures and conserves energy', () => {
    const e = realEngine(cycle(), engine({ rate: 4.41 }));
    expect(e.tGasHot).toBeCloseTo(443.6, 1); expect(e.tGasCold).toBeCloseTo(343.7, 1);
    expect(e.heatIn).toBeCloseTo(20 * (500 - e.tGasHot), 9); expect(e.heatOut).toBeCloseTo(20 * (e.tGasCold - 300), 9);
    expect(e.heatIn - e.heatOut).toBeCloseTo(e.power, 9); expect(e.heatIn / e.tGasHot).toBeCloseTo(e.heatOut / e.tGasCold, 9);
    expect(e.entropyRate).toBeGreaterThan(0);
  });

  it('loses a fixed share of its work to friction', () => {
    const smooth = realEngine(cycle(), engine({ rate: 4.41 })), rough = realEngine(cycle(), engine({ rate: 4.41, friction: 0.2 }));
    expect(rough.power).toBeCloseTo(0.8 * smooth.power, 9); expect(rough.heatIn).toBeCloseTo(smooth.heatIn, 9);
    expect(rough.heatOut - smooth.heatOut).toBeCloseTo(smooth.power - rough.power, 9); expect(rough.entropyRate).toBeGreaterThan(smooth.entropyRate);
  });

  it('stalls when driven too fast', () => {
    const e = realEngine(cycle(), engine({ rate: 10 }));
    expect(e.stallRate).toBeCloseTo(8.676, 3); expect(e).toMatchObject({ stalled: true, power: 0, efficiency: 0, heatIn: 2000, heatOut: 2000 });
    expect(realEngine(cycle(), engine({ rate: e.stallRate * 0.999 })).power).toBeGreaterThan(0); expect(realEngine(cycle(), engine({ rate: e.stallRate * 0.999 })).power).toBeLessThan(2);
  });
});

describe('the cycle run backwards', () => {
  it('is the Carnot engine reversed when nothing is lost', () => {
    const s = heatPump(pump({ tCold: 300, tHot: 500, gap: 0, quality: 1 }));
    expect(s.copHeating).toBeCloseTo(1 / 0.4, 12); expect(s.cop).toBeCloseTo(s.limit, 12); expect(s.entropyRate).toBeCloseTo(0, 9);
    const cooling = heatPump(pump({ mode: 'fridge', tCold: 300, tHot: 500, gap: 0, quality: 1 }));
    expect(cooling.cop).toBeCloseTo(1.5, 12); expect(cooling.limit).toBeCloseTo(1.5, 12);
  });

  it('always heats with exactly one more than it cools with', () => {
    for (const p of PRESETS.filter(p => p.pump)) { const s = heatPump(p.pump!); expect(s.copHeating - s.copCooling).toBeCloseTo(1, 12); expect(s.heatHot).toBeCloseTo(s.heatCold + s.electricity, 9); expect(s.entropyRate).toBeGreaterThan(0); expect(s.cop).toBeLessThan(s.limit); }
    expect(heatPump(pump({ quality: 0.2, gap: 20, tCold: ZERO_C - 30 })).cop).toBeGreaterThan(1);
  });

  it('gives a refrigerator, a freezer, and a heat pump believable numbers', () => {
    const fridge = heatPump(MACHINES.fridge), freezer = heatPump({ ...MACHINES.fridge, tCold: ZERO_C - 18 }), mild = heatPump(MACHINES.heater), cold = heatPump(pump({ tCold: ZERO_C - 20 }));
    expect(fridge.cop).toBeCloseTo(3.515, 3); expect(fridge.electricity).toBeCloseTo(7.68, 2); expect(fridge.demand).toBeCloseTo(27, 9);
    expect(freezer.electricity / fridge.electricity).toBeCloseTo(3.82, 2);
    expect(mild.cop).toBeCloseTo(4.973, 3); expect(mild.demand).toBeCloseTo(2800, 9); expect(mild.electricity).toBeCloseTo(563.1, 1); expect(mild.heatHot).toBeCloseTo(2800, 9);
    expect(cold.cop).toBeCloseTo(2.993, 3); expect(cold.electricity).toBeCloseTo(2739.7, 1);
    expect(heatPump({ ...MACHINES.cooler, tHot: ZERO_C + 42 }).electricity / heatPump(MACHINES.cooler).electricity).toBeGreaterThan(2);
  });

  it('knows which side is the weather', () => {
    expect(outsideOf(MACHINES.heater)).toBe(MACHINES.heater.tCold); expect(outsideOf(MACHINES.fridge)).toBe(MACHINES.fridge.tHot);
    expect(withOutside(MACHINES.heater, 250).tCold).toBe(250); expect(withOutside(MACHINES.cooler, 310).tHot).toBe(310);
  });
});

describe('presets and formatting', () => {
  it('has unique keys and physically sensible settings', () => {
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(PRESETS.length); expect(PRESETS).toHaveLength(13);
    for (const p of PRESETS) {
      expect(p.notice.length).toBeGreaterThan(60);
      if (p.cycle) expect(p.cycle.tHot).toBeGreaterThan(p.cycle.tCold);
      if (p.pump) expect(p.pump.tHot).toBeGreaterThan(p.pump.tCold);
      expect(p[p.stage]).toBeDefined();
    }
  });

  it('formats quantities the way the page shows them', () => {
    expect(si(115.26, 'J')).toBe('115 J'); expect(si(0.5763, 'J/K')).toBe('576 mJ/K'); expect(si(1127.5, 'W')).toBe('1.13 kW'); expect(si(0, 'W')).toBe('0 W'); expect(si(22.52, 'W')).toBe('22.5 W');
    expect(kelvin(443.6)).toBe('444 K'); expect(celsius(ZERO_C - 20)).toBe('−20 °C'); expect(celsius(ZERO_C + 21)).toBe('21 °C'); expect(celsius(ZERO_C - 0.2)).toBe('0 °C');
    expect(percent(0.4)).toBe('40.0%'); expect(percent(0.2, 0)).toBe('20%'); expect(litres(0.001414)).toBe('1.41 L'); expect(litres(0.0123)).toBe('12.3 L'); expect(cop(4.973)).toBe('4.97'); expect(cop(21.01)).toBe('21.0');
  });
});
