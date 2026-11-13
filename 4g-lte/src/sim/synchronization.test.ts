import { describe, expect, it } from 'vitest';
import { add, c, mul, polar, rng } from './math';
import { correlatePrefix } from './synchronization';
import { simulate } from './simulate';
import { DEFAULT_CONFIG, type Complex } from './types';

function independentCapture(cp: number, arrival: number, cfo: number) {
  const random = rng(531), samples: Complex[] = Array.from({ length: arrival }, () => c());
  for (let symbol = 0; symbol < 6; symbol++) {
    const useful = Array.from({ length: 64 }, () => c(random() * 2 - 1, random() * 2 - 1));
    samples.push(...useful.slice(-cp), ...useful);
  }
  samples.push(...Array.from({ length: 256 }, () => c()));
  return samples.map((v, n) => mul(v, polar(1, 2 * Math.PI * cfo * n / 64)));
}

describe('blind CP correlation', () => {
  it('finds unknown arrivals for both prefixes using only repeated received samples', () => {
    for (const cp of [16, 32]) for (const arrival of [0, 1, 24, 63]) {
      const detected = correlatePrefix(independentCapture(cp, arrival, 0), cp, 6);
      expect(detected.detectedOffset).toBe(arrival);
      expect(detected.peakMetric).toBeCloseTo(1, 12);
      expect(detected.averagedSymbols).toBe(6);
    }
  });
  it('finds timing despite CFO and estimates signed fractional CFO from correlation phase', () => {
    for (const cp of [16, 32]) for (const cfo of [-0.4, -0.2, 0, 0.2, 0.4]) {
      const result = correlatePrefix(independentCapture(cp, 31, cfo), cp, 6);
      expect(result.detectedOffset).toBe(31);
      expect(result.peakMetric).toBeCloseTo(1, 12);
      expect(result.estimatedCfo).toBeCloseTo(cfo, 12);
    }
  });
  it('is insensitive to constant gain and phase but shows weaker matches with noise', () => {
    const raw = independentCapture(16, 24, 0), random = rng(27);
    const gain = polar(0.35, 1.2);
    const scaled = raw.map(v => mul(v, gain));
    expect(correlatePrefix(scaled, 16, 6).detectedOffset).toBe(24);
    const noisy = raw.map(v => add(v, c(random() * 2 - 1, random() * 2 - 1)));
    expect(correlatePrefix(noisy, 16, 6).peakMetric).toBeLessThan(0.8);
  });
  it('does not invent a match for a silent capture', () => {
    const result = correlatePrefix(Array.from({ length: 700 }, () => c()), 16, 6);
    expect(result.peakMetric).toBe(0);
    expect(result.estimatedCfo).toBe(0);
    expect(result.candidates.every(v => Number.isFinite(v.metric))).toBe(true);
  });
});

describe('timing drives the real receiver', () => {
  it('restores decoding when a wrongly placed FFT window is replaced by CP timing', () => {
    const configuration = { ...DEFAULT_CONFIG, noise: false, coding: 'none' as const, arrivalOffset: 24, manualOffset: 0 };
    const wrong = simulate({ ...configuration, timingMode: 'manual' });
    const acquired = simulate({ ...configuration, timingMode: 'cp' });
    expect(wrong.synchronization.timingError).toBe(-24);
    expect(wrong.rawErrors).toBeGreaterThan(0);
    expect(wrong.crcPass).toBe(false);
    expect(acquired.synchronization.detectedOffset).toBe(24);
    expect(acquired.decoded).toBe('HELLO 4G');
    expect(acquired.rawErrors).toBe(0);
    expect(acquired.crcPass).toBe(true);
  });
  it('recovers shifted multislots, resource reservations, and both prefix lengths', () => {
    for (const cp of [16, 32] as const) for (const arrivalOffset of [0, 24, 63]) {
      const result = simulate({ ...DEFAULT_CONFIG, source: 'More than one slot of synchronized data.',
        modulation: 'BPSK', coding: 'convolutional', cfi: 2, sync: '10', cp, arrivalOffset, timingMode: 'cp', noise: false });
      expect(result.synchronization.usedOffset).toBe(arrivalOffset);
      expect(result.decoded).toBe(result.config.source);
      expect(result.crcPass).toBe(true);
    }
  });
  it('uses CP-derived CFO to undo rotation without the configured CFO entering the correction', () => {
    for (const cfo of [-0.35, 0.25]) {
      const result = simulate({ ...DEFAULT_CONFIG, noise: false, timingMode: 'cp', arrivalOffset: 37,
        modulation: '64-QAM', cfo, compensateCfo: true, cfoSource: 'cp' });
      expect(result.synchronization.estimatedCfo).toBeCloseTo(cfo, 12);
      expect(result.synchronization.appliedCfo).toBeCloseTo(cfo, 12);
      expect(result.evm).toBeLessThan(1e-10);
      expect(result.decoded).toBe('HELLO 4G');
    }
  });
  it('keeps the final delayed echo so acquired timing can decode the last symbol', () => {
    for (const cp of [16, 32] as const) {
      const result = simulate({ ...DEFAULT_CONFIG, noise: false, cp, timingMode: 'cp', profile: 'custom',
        taps: [{ delay: 22, gain: 0.8, phase: 0.9 }] });
      expect(result.synchronization.detectedOffset).toBe(46);
      expect(result.synchronization.usedOffset).toBe(46);
      expect(result.decoded).toBe('HELLO 4G');
      expect(result.crcPass).toBe(true);
    }
  });
  it('reports the safe FFT region and impossible prefix protection independently of detection', () => {
    const taps = [{ delay: 0, gain: 1, phase: 0 }, { delay: 22, gain: 0.8, phase: 1.2 }];
    const short = simulate({ ...DEFAULT_CONFIG, profile: 'custom', taps, cp: 16 });
    const long = simulate({ ...DEFAULT_CONFIG, profile: 'custom', taps, cp: 32 });
    expect(short.synchronization.safeOffsetStart).toBeGreaterThan(short.synchronization.safeOffsetEnd);
    expect(long.synchronization.safeOffsetStart).toBeLessThan(long.synchronization.safeOffsetEnd);
  });
  it('leaves estimates and results finite when noise swamps the signal', () => {
    const result = simulate({ ...DEFAULT_CONFIG, timingMode: 'cp', snr: -10 });
    expect(result.synchronization.peakMetric).toBeGreaterThanOrEqual(0);
    expect(result.synchronization.peakMetric).toBeLessThanOrEqual(1);
    expect(Number.isFinite(result.evm)).toBe(true);
    expect(Number.isFinite(result.synchronization.estimatedCfo)).toBe(true);
  });
});
