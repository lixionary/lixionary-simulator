import { describe, expect, it } from 'vitest';
import { BALANCE_ALTITUDE_KM, C, clockError, DAY, EARTH_RADIUS, eccentricAnomaly, F, factoryOffset, fixTrail, GM, maxEccentricity, meanSpeed, NOMINAL_HZ, orbitPoint, period, rates, SATELLITES, semiMajor, skyPositions, solveFix, wobble, wobbleAmplitude, type Corrections, type Settings } from './model';
import { clockReading, distance, duration, elapsed, perDay } from './format';
import { PRESETS } from './presets';

const ALL: Corrections = { gravity: true, speed: true, orbitShape: true }, NONE: Corrections = { gravity: false, speed: false, orbitShape: false };
const gps = (corrections: Corrections, solvesClock: boolean, eccentricity = 0): Settings => ({ orbit: { altitudeKm: 20_184, eccentricity }, corrections, solvesClock });
const microsPerDay = (fraction: number) => fraction * DAY * 1e6;
const GPS_A = EARTH_RADIUS + 20_184_000;

describe('clock rates', () => {
  it('reproduces the published GPS figures', () => {
    const r = rates(GPS_A);
    expect(microsPerDay(r.gravity)).toBeCloseTo(45.8, 1);
    expect(microsPerDay(r.speed)).toBeCloseTo(-7.2, 1);
    expect(r.net).toBeCloseTo(4.4647e-10, 13);
    expect(C * r.net * DAY).toBeCloseTo(11_565, -1);
    expect(F).toBeCloseTo(-4.442807633e-10, 16);
  });
  it('gives the factory frequency in the interface specification', () => {
    expect((NOMINAL_HZ * (1 + factoryOffset(gps(ALL, true).orbit, ALL))).toFixed(5)).toBe('10229999.99543');
    expect(factoryOffset(gps(NONE, true).orbit, NONE)).toBe(0);
  });
  it('matches Kepler for period and speed', () => {
    expect(period(GPS_A) / 3600).toBeCloseTo(11.967, 2);
    expect(period(EARTH_RADIUS + 35_786_000) / 3600).toBeCloseTo(23.934, 2);
    expect(meanSpeed(GPS_A)).toBeCloseTo(3873.8, 0);
  });
  it('runs slow in low orbit, fast in high orbit, and cancels in between', () => {
    expect(microsPerDay(rates(EARTH_RADIUS + 420_000).net)).toBeCloseTo(-24.3, 1);
    expect(microsPerDay(rates(EARTH_RADIUS + 35_786_000).net)).toBeCloseTo(46.6, 1);
    expect(BALANCE_ALTITUDE_KM).toBeCloseTo(3167.4, 0);
    expect(Math.abs(rates(EARTH_RADIUS + BALANCE_ALTITUDE_KM * 1000).net)).toBeLessThan(1e-20);
  });
});

describe('oval orbits', () => {
  it('solves Kepler’s equation', () => {
    for (const mean of [0.3, 2, 4.5]) { const E = eccentricAnomaly(mean, 0.05); expect(E - 0.05 * Math.sin(E)).toBeCloseTo(mean, 12); }
  });
  it('swings by the specification’s amplitude and averages to nothing', () => {
    const orbit = { altitudeKm: 20_184, eccentricity: 0.01 };
    expect(wobbleAmplitude(orbit) * 1e9).toBeCloseTo(22.9, 1);
    const mean = Array.from({ length: 360 }, (_, i) => wobble(orbit, i * Math.PI / 180)).reduce((s, v) => s + v, 0) / 360;
    expect(Math.abs(mean)).toBeLessThan(wobbleAmplitude(orbit) * 0.01);
    expect(wobble({ ...orbit, eccentricity: 0 }, 1)).toBeCloseTo(0, 20);
  });
  it('agrees with integrating the exact rate along the ellipse', () => {
    const orbit = { altitudeKm: 20_184, eccentricity: 0.02 }, a = semiMajor(orbit), T = period(a), steps = 20_000, quarter = T / 4;
    let swing = 0;
    for (let i = 0; i < steps; i++) {
      const p = orbitPoint(orbit, (i + 0.5) * quarter / steps);
      swing += (-GM / (p.r * C * C) - p.speed ** 2 / (2 * C * C) + 1.5 * GM / (a * C * C)) * quarter / steps;
    }
    expect(swing * 1e9).toBeCloseTo((wobble(orbit, Math.PI / 2) - wobble(orbit, 0)) * 1e9, 2);
  });
  it('keeps the lowest point above the atmosphere', () => {
    expect(maxEccentricity(20_184)).toBe(0.05);
    const e = maxEccentricity(420), a = EARTH_RADIUS + 420_000;
    expect(e).toBeGreaterThan(0.02); expect(a * (1 - e)).toBeGreaterThanOrEqual(EARTH_RADIUS + 200_000);
  });
  it('moves fastest at the lowest point', () => {
    const orbit = { altitudeKm: 20_184, eccentricity: 0.05 }, low = orbitPoint(orbit, 0), high = orbitPoint(orbit, period(semiMajor(orbit)) / 2);
    expect(low.r).toBeCloseTo(semiMajor(orbit) * 0.95, 0); expect(high.r).toBeCloseTo(semiMajor(orbit) * 1.05, 0);
    expect(low.speed).toBeGreaterThan(high.speed);
  });
});

describe('clock error and the position fix', () => {
  it('puts every satellite on the chosen orbit, above the horizon', () => {
    for (const s of skyPositions(GPS_A)) {
      expect(Math.hypot(s.at[0], s.at[1], s.at[2] + EARTH_RADIUS)).toBeCloseTo(GPS_A, 3);
      expect(s.at[2]).toBeGreaterThan(0);
    }
  });
  it('is exact when every correction is applied', () => {
    for (const solvesClock of [false, true]) {
      const settings = gps(ALL, solvesClock, 0.02), fix = solveFix(settings, 3 * DAY);
      expect(clockError(settings, SATELLITES[2], 3 * DAY)).toBe(0);
      expect(fix.distance).toBeLessThan(1e-6); expect(Math.abs(fix.clock)).toBeLessThan(1e-15);
    }
  });
  it('drifts 38.6 µs and kilometres a day with no correction and a trusted receiver clock', () => {
    const settings = gps({ ...NONE, orbitShape: true }, false), fix = solveFix(settings, DAY);
    expect(clockError(settings, SATELLITES[0], DAY) * 1e6).toBeCloseTo(38.58, 2);
    expect(fix.distance).toBeGreaterThan(10_000); expect(fix.up).toBeGreaterThan(0); expect(fix.clock).toBeCloseTo(0, 20);
    expect(solveFix(settings, 2 * DAY).distance / fix.distance).toBeCloseTo(2, 2);
  });
  it('is worse with only the special-relativity correction than with none', () => {
    const none = gps({ ...NONE, orbitShape: true }, false), speedOnly = gps({ gravity: false, speed: true, orbitShape: true }, false);
    expect(clockError(speedOnly, SATELLITES[0], DAY) * 1e6).toBeCloseTo(45.79, 2);
    expect(solveFix(speedOnly, DAY).distance).toBeGreaterThan(solveFix(none, DAY).distance);
    expect(clockError(gps({ gravity: true, speed: false, orbitShape: true }, false), SATELLITES[0], DAY) * 1e6).toBeCloseTo(-7.21, 2);
  });
  it('absorbs a shared clock error into the receiver clock when it solves for one', () => {
    const fix = solveFix(gps({ ...NONE, orbitShape: true }, true), DAY);
    expect(fix.distance).toBeLessThan(1e-3);
    expect(fix.clock * 1e6).toBeCloseTo(38.58, 2);
  });
  it('cannot absorb the oval-orbit swing, which differs per satellite', () => {
    const settings = gps({ ...ALL, orbitShape: false }, true, 0.02), fix = solveFix(settings, DAY);
    const errors = SATELLITES.map(s => clockError(settings, s, DAY));
    expect(Math.max(...errors) - Math.min(...errors)).toBeGreaterThan(40e-9);
    expect(fix.distance).toBeGreaterThan(3); expect(fix.distance).toBeLessThan(100);
  });
  it('draws a trail from launch to now', () => {
    const settings = gps({ ...NONE, orbitShape: true }, false), trail = fixTrail(settings, DAY, 10);
    expect(trail).toHaveLength(11); expect(trail[0].distance).toBeLessThan(1e-6);
    expect(trail[10].distance).toBeCloseTo(solveFix(settings, DAY).distance, 6);
  });
  it('builds every preset inside its orbit’s limits', () => {
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(p.settings.orbit.eccentricity).toBeLessThanOrEqual(maxEccentricity(p.settings.orbit.altitudeKm));
      expect(Number.isFinite(solveFix(p.settings, p.elapsed).distance)).toBe(true);
    }
  });
});

describe('formatting', () => {
  it('picks readable units', () => {
    expect(duration(38.576e-6, true)).toBe('+38.58 µs'); expect(duration(-22.9e-9, true)).toBe('−22.9 ns'); expect(duration(2.7e-4)).toBe('270.0 µs');
    expect(duration(1e-18, true)).toBe('0 ns'); expect(duration(1.5e-3)).toBe('1.50 ms');
    expect(distance(11_565)).toBe('11.56 km'); expect(distance(-8.04)).toBe('8.0 m'); expect(distance(659.9)).toBe('660 m'); expect(distance(1e-7)).toBe('0 m'); expect(distance(125_656)).toBe('125.7 km');
    expect(perDay(4.4647e-10)).toBe('+38.6 µs/day'); expect(perDay(-8.35e-11)).toBe('−7.2 µs/day'); expect(perDay(1e-25)).toBe('0.0 µs/day');
    expect(elapsed(DAY + 3 * 3600 + 120)).toBe('1 d 03 h 02 min');
  });
  it('reads a clock to the nanosecond on both sides of the tick', () => {
    expect(clockReading(DAY)).toEqual({ time: 'Day 1 · 00:00:00', fraction: '.000 000 000' });
    expect(clockReading(DAY, 38.576e-6)).toEqual({ time: 'Day 1 · 00:00:00', fraction: '.000 038 576' });
    expect(clockReading(DAY, -24.335e-6)).toEqual({ time: 'Day 0 · 23:59:59', fraction: '.999 975 665' });
    expect(clockReading(0, -4e-9).time).toBe('−Day 0 · 00:00:00');
  });
});
