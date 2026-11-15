import { describe, expect, it } from 'vitest';
import { adaptiveSimpson, approximant, convergence, errorBound, evaluations, evenSimpson, G, integrate, INTERVALS, isExact, maxAbs, observedOrder, primesBetween, reference, repeatErrors, RULES, runningArea, samplePoints, sampleTrip, slicesFor, slicesNeeded, trapezoidData, TRIP_DISTANCE, TRIP_SECONDS, tripSpeed, type Fn, type Rule } from './model';
import { ALL, FORMULA, integrandOf, NO_FORMULA, setupFor, solve, spike, TRAPS } from './functions';
import { bound, correctDigits, count, err, metres, num, percent, sci, shrink } from './format';
import { PRESETS, SLICES } from './presets';

const { PI, sin, exp } = Math, KEYS = RULES.map(r => r.key);
const errorOf = (f: Fn, a: number, b: number, n: number, rule: Rule, exact: number) => integrate(f, a, b, n, rule) - exact;

describe('the five rules', () => {
  it('give the hand-worked sums for x² from 0 to 2', () => {
    const f: Fn = x => x * x;
    expect(integrate(f, 0, 2, 8, 'left')).toBeCloseTo(2.1875, 12); expect(integrate(f, 0, 2, 8, 'right')).toBeCloseTo(3.1875, 12);
    expect(integrate(f, 0, 2, 8, 'midpoint')).toBeCloseTo(2.65625, 12); expect(integrate(f, 0, 2, 8, 'trapezoid')).toBeCloseTo(2.6875, 12);
    expect(integrate(f, 0, 2, 8, 'simpson')).toBeCloseTo(8 / 3, 12);
  });

  it('are exact where the theory says they are', () => {
    const line: Fn = x => 3 * x - 1, cubic: Fn = x => x ** 3 - 2 * x * x + 5;
    for (const rule of ['midpoint', 'trapezoid', 'simpson'] as const) expect(integrate(line, -1, 3, 3, rule)).toBeCloseTo(8, 12);
    expect(integrate(cubic, 0, 2, 2, 'simpson')).toBeCloseTo(4 - 16 / 3 + 10, 12);
    expect(Math.abs(errorOf(cubic, 0, 2, 2, 'trapezoid', 4 - 16 / 3 + 10))).toBeGreaterThan(0.1);
  });

  it('shrink their error by the right power when the slices double', () => {
    for (const rule of RULES) {
      const order = observedOrder(errorOf(exp, 0, 2, 64, rule.key, exp(2) - 1), errorOf(exp, 0, 2, 128, rule.key, exp(2) - 1));
      expect(order).toBeGreaterThan(rule.order - 0.03); expect(order).toBeLessThan(rule.order + 0.03);
    }
    const rows = convergence(sin, 0, 1, 'simpson', 1 - Math.cos(1), 4);
    expect(rows.map(r => r.n)).toEqual([4, 8, 16, 32, 64, 128, 256]); expect(rows[0].ratio).toBeNull(); expect(rows[1].ratio).toBeCloseTo(16, 0);
  });

  it('make midpoint half as wrong as trapezoid, the other way', () => {
    const exact = exp(2) - 1, mid = errorOf(exp, 0, 2, 32, 'midpoint', exact), trap = errorOf(exp, 0, 2, 32, 'trapezoid', exact);
    expect(mid / trap).toBeCloseTo(-0.5, 3);
    expect((2 * integrate(exp, 0, 2, 16, 'midpoint') + integrate(exp, 0, 2, 16, 'trapezoid')) / 3).toBeCloseTo(integrate(exp, 0, 2, 32, 'simpson'), 12);
  });

  it('count slices, evaluations, and sample points', () => {
    expect(slicesFor('simpson', 1)).toBe(2); expect(slicesFor('simpson', 3)).toBe(4); expect(slicesFor('left', 3)).toBe(3); expect(slicesFor('trapezoid', 0)).toBe(1);
    expect(KEYS.map(rule => evaluations(rule, 8))).toEqual([8, 8, 8, 9, 9]);
    expect(samplePoints(0, 2, 4, 'left')).toEqual([0, 0.5, 1, 1.5]); expect(samplePoints(0, 2, 4, 'right')).toEqual([0.5, 1, 1.5, 2]);
    expect(samplePoints(0, 2, 4, 'midpoint')).toEqual([0.25, 0.75, 1.25, 1.75]); expect(samplePoints(0, 2, 3, 'simpson')).toHaveLength(5);
    expect(integrate(sin, 0, 1, 3, 'simpson')).toBe(integrate(sin, 0, 1, 4, 'simpson'));
  });

  it('draw the shape whose area they add up', () => {
    for (const rule of KEYS) {
      const n = 6, top = approximant(exp, 0, 2, n, rule), h = 2 / n;
      let area = 0;
      for (let i = 0; i < n; i++) area += reference(x => top(i, x), i * h, (i + 1) * h, 4);
      expect(area).toBeCloseTo(integrate(exp, 0, 2, n, rule), 10);
    }
    expect(approximant(exp, 0, 2, 4, 'trapezoid')(1, 0.5)).toBeCloseTo(exp(0.5), 12); expect(approximant(exp, 0, 2, 4, 'simpson')(1, 1)).toBeCloseTo(exp(1), 12);
  });

  it('never exceed the textbook bound', () => {
    for (const fn of FORMULA) {
      const [a, b] = fn.interval, f: Fn = x => fn.f(x, 0), exact = fn.antiderivative!(b) - fn.antiderivative!(a), maxima = fn.derivatives!.map(d => maxAbs(d, a, b)) as [number, number, number];
      for (const rule of KEYS) for (const n of [2, 8, 64]) expect(Math.abs(errorOf(f, a, b, n, rule, exact))).toBeLessThanOrEqual(errorBound(rule, a, b, n, maxima) * (1 + 1e-9) + 1e-14);
    }
    expect(errorBound('trapezoid', 0, 2, 8, [4, 2, 0])).toBeCloseTo(8 / (12 * 64) * 2, 12); expect(errorBound('simpson', 0, 2, 8, [4, 2, 0])).toBe(0);
    expect(maxAbs(integrandOf('root').derivatives![0], 0, 1)).toBe(Infinity);
  });
});

describe('the curves with a formula', () => {
  it('have antiderivatives and derivatives that match the curve', () => {
    const slope = (g: Fn, x: number, h = 1e-4) => (g(x - 2 * h) - 8 * g(x - h) + 8 * g(x + h) - g(x + 2 * h)) / (12 * h);
    for (const fn of [...FORMULA, ...TRAPS]) {
      const [lo, hi] = fn.interval, f: Fn = x => fn.f(x, 0);
      for (const t of [0.31, 0.5, 0.77]) {
        const x = lo + (hi - lo) * t, scale = Math.max(1, Math.abs(f(x)));
        expect(Math.abs(slope(fn.antiderivative!, x, 1e-5) - f(x)) / scale).toBeLessThan(1e-5);
        if (!fn.derivatives) continue;
        const [d1, d2, d4] = fn.derivatives;
        expect(slope(f, x)).toBeCloseTo(d1(x), 6); expect(slope(d1, x)).toBeCloseTo(d2(x), 6); expect(slope(x1 => slope(d2, x1, 1e-3), x, 1e-3)).toBeCloseTo(d4(x), 3);
      }
    }
  });

  it('show the special cases the experiments describe', () => {
    const root = solve(setupFor('root', 'simpson', 8)), periodic = solve(setupFor('sine-squared', 'trapezoid', 4)), cubic = solve(setupFor('cube', 'simpson', 2)), pi = solve(setupFor('witch', 'simpson', 8));
    expect(root.ratio).toBeCloseTo(2 ** 1.5, 1); expect(root.limit).toBe(Infinity);
    expect(periodic.zero).toBe(true); expect(periodic.ratio).toBeNull(); expect(cubic.zero).toBe(true); expect(cubic.limit).toBe(0);
    expect(4 * pi.value).toBeCloseTo(PI, 6); expect(pi.fn.meaning!(pi.value, 0, 1, 0)).toContain('3.1415925');
    const left = solve(setupFor('square', 'left', 8)), mid = solve(setupFor('square', 'midpoint', 8)), trap = solve(setupFor('square', 'trapezoid', 8));
    expect(left.error).toBeCloseTo(-0.479167, 5); expect(left.ratio).toBeCloseTo(1.96, 2); expect(left.limit).toBeCloseTo(1, 12); expect(left.rows[1].n).toBe(16);
    expect(mid.error).toBeCloseTo(-1 / 96, 10); expect(trap.error).toBeCloseTo(1 / 48, 10); expect(mid.limit).toBeCloseTo(1 / 96, 12);
    const sine = solve(setupFor('sine', 'simpson', 8)), sineTrap = solve(setupFor('sine', 'trapezoid', 8));
    expect(sine.evaluations).toBe(sineTrap.evaluations); expect(Math.abs(sineTrap.error / sine.error)).toBeGreaterThan(90); expect(sine.ratio).toBeCloseTo(16.2, 1);
  });
});

describe('the curves with no formula', () => {
  it('has a reference that reproduces known constants', () => {
    expect(reference(x => exp(-x * x), 0, 1)).toBeCloseTo(0.7468241328124271, 13);
    expect(reference(x => x === 0 ? 1 : sin(x) / x, 0, PI)).toBeCloseTo(1.8519370519824662, 13);
    expect(reference(x => sin(x * x), 0, 1)).toBeCloseTo(0.3102683017233811, 13);
    expect(reference(exp, 0, 2)).toBeCloseTo(exp(2) - 1, 13);
  });

  it('gives each catalogue integral its known value', () => {
    const value = (key: string, patch = {}) => solve(setupFor(key, 'simpson', 8, patch)).exact;
    expect(value('bell')).toBeCloseTo(0.6826894921370859, 13); expect(value('bell', { a: -2, b: 2 })).toBeCloseTo(0.9544997361036416, 13);
    expect(value('sinc')).toBeCloseTo(1.8519370519824662, 12); expect(value('arc')).toBeCloseTo(3.8201977890277, 11); expect(value('log')).toBeCloseTo(29.0809778, 6);
    expect(value('ellipse', { p: 1 })).toBeCloseTo(2 * PI, 12); expect(value('ellipse', { p: 0.5 })).toBeCloseTo(4.84422411027, 10);
    expect(value('pendulum', { p: 5 }) / (2 * PI * Math.sqrt(1 / G))).toBeCloseTo(1 + (5 * PI / 180) ** 2 / 16, 5); expect(value('pendulum', { p: 90 })).toBeCloseTo(2.36824634629, 10);
    for (const fn of NO_FORMULA) { expect(fn.antiderivative).toBeUndefined(); expect(fn.special).toBeTruthy(); expect(reference(x => fn.f(x, fn.param?.value ?? 0), ...fn.interval, 4096)).toBeCloseTo(value(fn.key), 11); }
  });

  it('estimates its own error without the answer', () => {
    for (const key of ['bell', 'sinc', 'fresnel']) {
      const s = solve(setupFor(key, 'simpson', 16));
      expect(s.formula).toBe(false); expect(s.estimate / Math.abs(s.error)).toBeGreaterThan(0.8); expect(s.estimate / Math.abs(s.error)).toBeLessThan(1.2);
      expect(s.selfCheck[0].n).toBe(2); expect(s.selfCheck).toHaveLength(12);
    }
  });

  it('needs few slices for many digits, and fewest on a full wave', () => {
    const bell = integrandOf('bell'), f: Fn = x => bell.f(x, 0), exact = reference(f, -1, 1);
    expect(slicesNeeded(f, -1, 1, 'simpson', exact, 5e-7)).toBe(32); expect(slicesNeeded(f, -1, 1, 'simpson', exact, 5e-13)).toBe(1024); expect(slicesNeeded(f, -1, 1, 'left', exact, 5e-13)).toBeNull();
    const swing = solve(setupFor('pendulum', 'trapezoid', 8)), swingSimpson = solve(setupFor('pendulum', 'simpson', 8));
    expect(swing.relative).toBeLessThan(1e-12); expect(swingSimpson.relative).toBeGreaterThan(1e-8);
  });

  it('draws the area so far as a curve ending at the total', () => {
    const path = runningArea(x => exp(-x * x), 0, 1);
    expect(path).toHaveLength(121); expect(path[0]).toEqual({ x: 0, area: 0 }); expect(path[120].area).toBeCloseTo(0.7468241328124271, 12);
    for (let i = 1; i < path.length; i++) expect(path[i].area).toBeGreaterThan(path[i - 1].area);
  });

  it('describes what the area means', () => {
    expect(integrandOf('bell').meaning!(0.6826894921, -1, 1, 0)).toContain('68.27% of a normal population lies between −1 and 1');
    expect(integrandOf('log').meaning!(29.08, 2, 100, 0)).toContain('really 25 primes'); expect(primesBetween(2, 100)).toBe(25); expect(primesBetween(10, 20)).toBe(4);
    expect(integrandOf('pendulum').meaning!(2.3682463, 0, 1, 90)).toContain('15.3% too short'); expect(integrandOf('ellipse').meaning!(2 * PI, 0, 1, 1)).toContain('2π');
  });
});

describe('measured data', () => {
  it('recovers the distance from fine, clean readings', () => {
    expect(TRIP_DISTANCE).toBeCloseTo(879.4533, 3); expect(tripSpeed(0)).toBe(0); expect(tripSpeed(TRIP_SECONDS)).toBeCloseTo(0, 12); expect(tripSpeed(70)).toBeLessThan(2);
    expect(trapezoidData(sampleTrip(1, 0, 1))).toBeCloseTo(TRIP_DISTANCE, 3); expect(sampleTrip(1, 0, 1)).toHaveLength(121); expect(sampleTrip(30, 0, 1).map(r => r.t)).toEqual([0, 30, 60, 90, 120]);
    for (const interval of INTERVALS) expect(TRIP_SECONDS / interval % 1).toBe(0);
    expect(trapezoidData([{ t: 0, v: 2 }, { t: 3, v: 4 }, { t: 4, v: 0 }])).toBe(11);
  });

  it('misses what happens between coarse readings', () => {
    expect(trapezoidData(sampleTrip(20, 0, 1)) - TRIP_DISTANCE).toBeCloseTo(79.54, 1); expect(Math.abs(trapezoidData(sampleTrip(10, 0, 1)) - TRIP_DISTANCE)).toBeGreaterThan(20);
  });

  it('gives repeatable noise that mostly cancels in the total', () => {
    expect(sampleTrip(1, 1.5, 7)).toEqual(sampleTrip(1, 1.5, 7)); expect(sampleTrip(1, 1.5, 7)).not.toEqual(sampleTrip(1, 1.5, 8));
    const readings = sampleTrip(0.5, 1, 3), spread = Math.sqrt(readings.reduce((sum, r) => sum + (r.v - tripSpeed(r.t)) ** 2, 0) / readings.length);
    expect(spread).toBeGreaterThan(0.85); expect(spread).toBeLessThan(1.15);
    const fine = repeatErrors(1, 1.5), coarse = repeatErrors(20, 0);
    expect(fine.errors).toHaveLength(60); expect(Math.abs(fine.clean)).toBeLessThan(1e-3); expect(fine.spread / TRIP_DISTANCE).toBeGreaterThan(0.01); expect(fine.spread / TRIP_DISTANCE).toBeLessThan(0.03);
    expect(fine.spread).toBeCloseTo(1.5 * Math.sqrt(TRIP_SECONDS), -1); expect(coarse.spread).toBe(0); expect(coarse.clean).toBeCloseTo(79.54, 1);
    expect(repeatErrors(0.5, 1.5).spread).toBeLessThan(fine.spread);
  });
});

describe('accuracy on demand', () => {
  it('meets the tolerance with far fewer evaluations than equal slices', () => {
    const { f, exact } = spike(0.005);
    expect(exact).toBeCloseTo(0.015600718, 8);
    for (const digits of [6, 8]) {
      const adaptive = adaptiveSimpson(f, 0, 1, 10 ** -digits), even = evenSimpson(f, 0, 1, 10 ** -digits);
      expect(Math.abs(adaptive.value - exact)).toBeLessThan(10 ** -digits); expect(Math.abs(even.value - exact)).toBeLessThan(10 ** -digits);
      expect(even.evaluations).toBeGreaterThan(4 * adaptive.evaluations); expect(adaptive.points).toHaveLength(adaptive.evaluations); expect(even.evaluations).toBe(even.n + 1);
    }
    expect(adaptiveSimpson(f, 0, 1, 1e-6).evaluations).toBe(161); expect(evenSimpson(f, 0, 1, 1e-6).evaluations).toBe(1025);
  });

  it('puts its points where the curve bends', () => {
    const { points } = adaptiveSimpson(spike(0.005).f, 0, 1, 1e-8), near = points.filter(x => Math.abs(x - 0.37) < 0.05).length;
    expect(near / points.length).toBeGreaterThan(0.6); expect(points[0]).toBe(0); expect(points[points.length - 1]).toBe(1);
    for (let i = 1; i < points.length; i++) expect(points[i]).toBeGreaterThan(points[i - 1]);
  });

  it('is exact on a cubic and close on a smooth curve at once', () => {
    expect(adaptiveSimpson(x => x ** 3, 0, 2, 1e-6).value).toBeCloseTo(4, 12); expect(adaptiveSimpson(x => x ** 3, 0, 2, 1e-6).evaluations).toBe(33);
    expect(adaptiveSimpson(sin, 0, PI, 1e-9).value).toBeCloseTo(2, 9);
  });
});

describe('where it is fooled', () => {
  it('steps over a spike it never sampled', () => {
    const miss = solve(setupFor('missed-spike', 'midpoint', 8));
    expect(miss.exact).toBeCloseTo(0.0124977, 6); expect(miss.value / miss.exact).toBeLessThan(0.11); expect(solve(setupFor('missed-spike', 'midpoint', 512)).relative).toBeLessThan(1e-3);
  });

  it('cannot evaluate an infinite end, and crawls when it avoids it', () => {
    for (const rule of ['left', 'trapezoid', 'simpson'] as const) expect(solve(setupFor('blow-up', rule, 16)).value).toBe(Infinity);
    const mid = solve(setupFor('blow-up', 'midpoint', 16));
    expect(mid.exact).toBe(2); expect(mid.value).toBeCloseTo(1.8489, 4); expect(mid.ratio).toBeCloseTo(Math.SQRT2, 2);
    expect(solve(setupFor('blow-up', 'left', 16)).ratio).toBeNull();
  });

  it('reads a wave as a flat line when the slices keep step with it', () => {
    expect(solve(setupFor('alias', 'trapezoid', 16)).value).toBeCloseTo(2, 12); expect(solve(setupFor('alias', 'midpoint', 16)).value).toBeCloseTo(0, 12);
    expect(solve(setupFor('alias', 'trapezoid', 12)).value).toBeCloseTo(1, 12); expect(solve(setupFor('alias', 'trapezoid', 24)).value).toBeCloseTo(1, 12);
  });
});

describe('experiments and formatting', () => {
  it('has experiments that all load and give usable numbers', () => {
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(PRESETS.length); expect(new Set(ALL.map(fn => fn.key)).size).toBe(ALL.length);
    for (const preset of PRESETS) {
      const setup = preset.slice ?? preset.open ?? preset.trap;
      if (setup) { const s = solve(setup); expect(Number.isFinite(s.value)).toBe(true); expect(Number.isFinite(s.exact)).toBe(true); expect(SLICES).toContain(setup.n); expect(s.rows.length).toBeGreaterThan(3); }
      if (preset.trip) expect(INTERVALS[preset.trip.interval]).toBeGreaterThan(0);
      expect(preset.stage === 'practice').toBe(preset.situation !== undefined);
    }
    for (const size of SLICES.filter(size => size <= 256)) expect(SLICES).toContain(size * 2);
    const noisy = PRESETS.find(p => p.key === 'noisy')!.trip!, coarse = PRESETS.find(p => p.key === 'coarse')!.trip!;
    expect(trapezoidData(sampleTrip(INTERVALS[noisy.interval], noisy.noise, noisy.seed)) - TRIP_DISTANCE).toBeCloseTo(-15.6, 1); expect(INTERVALS[coarse.interval]).toBe(20);
  });

  it('formats numbers, errors, and digits', () => {
    expect(sci(-0.0000123)).toBe('−1.2 × 10⁻⁵'); expect(sci(1e-6, 1)).toBe('1 × 10⁻⁶'); expect(sci(0)).toBe('0'); expect(sci(Infinity)).toBe('∞'); expect(sci(12345, 3)).toBe('1.23 × 10⁴');
    expect(num(8 / 3, 8)).toBe('2.6666667'); expect(num(-0.479167, 3)).toBe('−0.479'); expect(num(0.0625, 4)).toBe('0.06250'); expect(num(0, 3)).toBe('0.00'); expect(num(Infinity)).toBe('∞'); expect(num(1234.5678, 6)).toBe('1234.57'); expect(num(2e-7)).toBe('2.000 × 10⁻⁷');
    expect(err(-0.4792, false)).toBe('−0.479'); expect(err(2.7e-4, false)).toBe('2.7 × 10⁻⁴'); expect(err(1e-17, true)).toBe('0'); expect(err(Infinity, false)).toBe('∞');
    expect(isExact(4e-16, 2)).toBe(true); expect(isExact(1e-9, 2)).toBe(false);
    expect(correctDigits(0.18)).toBe(0); expect(correctDigits(1.3e-4)).toBe(3); expect(correctDigits(0)).toBe(16); expect(correctDigits(Infinity)).toBe(0);
    expect(count(65536)).toBe('65,536'); expect(percent(0.6827, 2)).toBe('68.27%'); expect(percent(-0.0178, 2)).toBe('−1.78%');
    expect(shrink(16.22)).toBe('÷ 16.2'); expect(shrink(null)).toBe('—'); expect(shrink(-4)).toBe('÷ 4.00'); expect(shrink(0.5)).toBe('× 2.00');
    expect(bound(PI)).toBe('3.14'); expect(bound(-1)).toBe('−1'); expect(bound(2)).toBe('2'); expect(metres(-15.63, 1)).toBe('−15.6 m'); expect(metres(-0.0001, 1)).toBe('0.0 m'); expect(metres(879.45)).toBe('879 m');
  });
});
