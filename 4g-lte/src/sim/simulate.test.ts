import { describe, expect, it } from 'vitest';
import { attachCrc, constellation, crcRemainder, decode, demap, encode, goldSequence, serialize } from './codec';
import { c, fft, gaussian, meanPower, mul, polar, power, rng, scale, sub } from './math';
import { applyMultipath, channelResponse, resourceRole, simulate } from './simulate';
import { ACTIVE_BINS, DEFAULT_CONFIG, type Config, type Modulation } from './types';

const run = (overrides: Partial<Config> = {}) => simulate({ ...DEFAULT_CONFIG, ...overrides });

describe('independent numerical references', () => {
  it('serializes ASCII MSB first and validates the input contract', () => {
    expect(serialize('A', 'ascii').join('')).toBe('01000001');
    expect(serialize('01 10\n1', 'binary')).toEqual([0, 1, 1, 0, 1]);
    expect(() => serialize('こんにちは', 'ascii')).toThrow('ASCII');
    expect(() => serialize('', 'ascii')).toThrow('message');
    expect(() => serialize('012', 'binary')).toThrow('binary');
    expect(() => serialize('a'.repeat(129), 'ascii')).toThrow('128');
  });
  it('matches CRC-8/SMBUS and CRC-16/XMODEM check values', () => {
    const bits = serialize('123456789', 'ascii');
    const asNumber = (bits: number[]) => parseInt(bits.join(''), 2);
    expect(asNumber(crcRemainder(bits, 8, true))).toBe(0xF4);
    expect(asNumber(crcRemainder(bits, 16, true))).toBe(0x31C3);
    for (const width of [8, 16] as const) {
      const transport = attachCrc(bits, width);
      expect(crcRemainder(transport, width).every(b => b === 0)).toBe(true);
      transport[2] ^= 1;
      expect(crcRemainder(transport, width).some(b => b === 1)).toBe(true);
    }
  });
  it('places an analytic complex sinusoid in exactly its FFT bin', () => {
    const samples = Array.from({ length: 64 }, (_, n) => polar(1 / 8, 2 * Math.PI * 5 * n / 64));
    const transformed = fft(samples);
    expect(transformed[5].re).toBeCloseTo(1, 12);
    transformed.forEach((v, i) => { if (i !== 5) expect(power(v)).toBeLessThan(1e-25); });
    const roundTrip = fft(transformed, true);
    roundTrip.forEach((v, i) => expect(power(sub(v, samples[i]))).toBeLessThan(1e-25));
    expect(meanPower(roundTrip)).toBeCloseTo(meanPower(samples), 12);
  });
  it('uses the documented BPSK and Gray-coded axis ordering', () => {
    expect(constellation('BPSK').map(v => v.point.re)).toEqual([-1, 1]);
    const qam = constellation('16-QAM');
    const pairs = ['00', '01', '11', '10'];
    expect(pairs.map(pair => qam.find(v => `${v.bits[0]}${v.bits[2]}` === pair)!.point.re * Math.sqrt(10))).toEqual([-3, -1, 1, 3]);
    for (const mode of ['BPSK', 'QPSK', '16-QAM', '64-QAM', '256-QAM'] as Modulation[]) {
      expect(meanPower(constellation(mode).map(v => v.point))).toBeCloseTo(1, 12);
      for (const point of constellation(mode)) {
        const result = demap(point.point, mode, 0.01);
        expect(result.bits).toEqual(point.bits);
        result.llrs.forEach((v, i) => expect(v > 0).toBe(point.bits[i] === 0));
      }
    }
  });
  it('uses gain-aware MMSE decision boundaries for high-order QAM', () => {
    for (const item of constellation('256-QAM')) {
      expect(demap(scale(item.point, 0.3), '256-QAM', 0.001, 0.3).bits).toEqual(item.bits);
    }
  });
  it('reproduces seeded scrambling and gives distinct seeds distinct sequences', () => {
    // Fixture from an independent bit-packed LFSR, after 1,600 clocks.
    expect(goldSequence(32, 1).join('')).toBe('00000010100000110000001101110100');
    const sequence = goldSequence(1000, 42);
    expect(goldSequence(1000, 42)).toEqual(sequence);
    expect(goldSequence(1000, 43)).not.toEqual(sequence);
    expect(sequence.filter(Boolean).length).toBeGreaterThan(400);
    expect(sequence.filter(Boolean).length).toBeLessThan(600);
    const original = serialize('SCRAMBLE', 'ascii');
    expect(original.map((b, i) => b ^ sequence[i]).map((b, i) => b ^ sequence[i])).toEqual(original);
  });
});

describe('error correction', () => {
  it('corrects every single-bit position for every Hamming codeword', () => {
    for (let word = 0; word < 16; word++) {
      const input = Array.from({ length: 4 }, (_, i) => (word >> (3 - i)) & 1);
      const encoded = encode(input, 'hamming').bits;
      for (let i = 0; i < 7; i++) {
        const damaged = [...encoded]; damaged[i] ^= 1;
        const result = decode(damaged, [], 'hamming', false, 4);
        expect(result.bits).toEqual(input); expect(result.corrected).toBe(1);
      }
    }
  });
  it('recovers terminated convolutional messages and a low-confidence error', () => {
    const input = serialize('1011010001101101', 'binary');
    const encoded = encode(input, 'convolutional').bits;
    expect(encoded.slice(-2)).toEqual([1, 1]);
    const corrupted = [...encoded]; corrupted[7] ^= 1;
    const llrs = encoded.map((b, i) => (i === 7 ? -0.01 : 10) * (b ? -1 : 1));
    expect(decode(corrupted, llrs, 'convolutional', false, input.length).bits).toEqual(input);
    expect(decode(corrupted, llrs, 'convolutional', true, input.length).bits).toEqual(input);
  });
});

describe('end-to-end transmission', () => {
  it('recovers all modulation, coding, CRC and CP combinations without noise', () => {
    for (const modulation of ['BPSK', 'QPSK', '16-QAM', '64-QAM', '256-QAM'] as const)
      for (const coding of ['none', 'hamming', 'convolutional'] as const)
        for (const crc of [0, 8, 16] as const)
          for (const cp of [16, 32] as const) {
            const result = run({ modulation, coding, crc, cp, noise: false });
            expect(result.decoded, `${modulation}/${coding}/${crc}/${cp}`).toBe('HELLO 4G');
            expect(result.rawBer).toBe(0); expect(result.decodedBer).toBe(0);
            expect(result.crcPass).toBe(crc ? true : null);
            expect(result.evm).toBeLessThan(1e-10);
          }
  });
  it('respects reserved resources and recovers long messages across slots', () => {
    for (const cp of [16, 32] as const) for (const cfi of [0, 1, 2] as const) for (const sync of ['off', '0', '10'] as const) {
      const result = run({ source: 'Long messages need many slots. '.repeat(4), modulation: 'BPSK', coding: 'convolutional', cp, cfi, sync, noise: false });
      expect(result.slots).toBeGreaterThan(10);
      expect(result.decoded).toBe(result.config.source);
      expect(result.cells[0].filter(c => c.role === 'pilot')).toHaveLength(8);
      if (sync !== 'off') expect(result.cells[0].filter(c => c.role === 'pss')).toHaveLength(12);
      expect(result.coded.length + result.resourcePadding).toBe(result.scrambled.length);
      expect(result.recoveredCoded).toHaveLength(result.coded.length);
    }
  });
  it('recovers partial-byte binary payloads with coding padding', () => {
    const result = run({ sourceMode: 'binary', source: '10101', noise: false });
    expect(result.decoded).toBe('10101'); expect(result.codingPadding).toBe(3);
    expect(result.recoveredTransport).toHaveLength(21);
  });
  it('preserves ASCII control bytes in the engine rather than replacing recovered data', () => {
    const source = 'A\tB\nC\x00\x7f';
    expect(run({ source, noise: false }).decoded).toBe(source);
  });
  it('compensates continuous CFO using the configured offset', () => {
    const uncompensated = run({ source: 'FREQUENCY OFFSET', modulation: '16-QAM', cfo: 0.3, noise: false });
    const compensated = run({ source: 'FREQUENCY OFFSET', modulation: '16-QAM', cfo: 0.3, noise: false, compensateCfo: true });
    expect(uncompensated.evm).toBeGreaterThan(20);
    expect(compensated.evm).toBeLessThan(1e-10); expect(compensated.crcPass).toBe(true);
  });
  it('keeps errors repeatable, counts transport BER correctly, and excludes resource padding', () => {
    const a = run({ source: 'x', snr: -8 }), b = run({ source: 'x', snr: -8 });
    expect(a.rxSamples).toEqual(b.rxSamples);
    expect(a.rawBer).toBe(a.rawErrors / a.coded.length);
    expect(a.decodedBer).toBe(a.decodedErrors / a.transport.length);
    expect(a.resourcePadding).toBeGreaterThan(0);
    expect(run({ source: 'x', snr: -8, seed: 123 }).rxSamples).not.toEqual(a.rxSamples);
  });
  it('shows a statistical improvement at higher SNR, without assuming single-run monotonicity', () => {
    let low = 0, high = 0;
    for (let seed = 0; seed < 20; seed++) {
      low += run({ seed, snr: -8 }).rawErrors;
      high += run({ seed, snr: 24 }).rawErrors;
    }
    expect(low).toBeGreaterThan(200); expect(high).toBeLessThan(low / 20);
  });
  it('protects the FFT window when multipath fits in the prefix', () => {
    for (const cp of [16, 32] as const) {
      const source = run({ noise: false, cp });
      const taps = [{ delay: 0, gain: 1, phase: 0 }, { delay: 22, gain: 0.8, phase: 1.2 }];
      const channel = applyMultipath(source.txSamples, taps), h = channelResponse(taps);
      // Use the true response here to isolate CP behavior from pilot interpolation error.
      let error = 0;
      for (let l = 1; l < source.symbolsPerSlot; l++) {
        const start = l * (64 + cp) + cp, received = fft(channel.slice(start, start + 64));
        for (let k = 0; k < 12; k++) {
          const expected = mul(source.cells[0][l * 12 + k].tx, h[k]);
          error += power(sub(received[ACTIVE_BINS[k]], expected));
        }
      }
      if (cp === 32) expect(error).toBeLessThan(1e-24);
      else expect(error).toBeGreaterThan(0.01);
    }
  });
  it('retains CRS priority where pilots intersect control columns', () => {
    expect(resourceRole(0, 0, 16, 2, true)).toBe('pilot');
    expect(resourceRole(1, 0, 16, 2, true)).toBe('control');
  });
  it('rejects a silent custom channel', () => {
    expect(() => run({ profile: 'custom', taps: [{ delay: 0, gain: 0, phase: 0 }] })).toThrow('gain');
  });
  it('regularizes deep fades rather than amplifying them without bound', () => {
    const options: Partial<Config> = {
      profile: 'custom', taps: [{ delay: 0, gain: 1, phase: 0 }, { delay: 8, gain: 1, phase: -3 * Math.PI / 4 }],
      snr: 0, coding: 'none', modulation: '16-QAM',
    };
    const zf = run({ ...options, equalizer: 'zf' }), mmse = run({ ...options, equalizer: 'mmse' });
    expect(power(zf.trueChannel[6])).toBeLessThan(1e-24);
    expect(meanPower(mmse.symbols.map(s => s.equalized))).toBeLessThan(meanPower(zf.symbols.map(s => s.equalized)));
    expect(mmse.symbols.every(s => Number.isFinite(s.equalized.re) && Number.isFinite(s.equalized.im))).toBe(true);
  });
});

it('generates unit-variance circular Gaussian noise before scaling', () => {
  const random = rng(77), samples = Array.from({ length: 30_000 }, () => gaussian(random));
  expect(meanPower(samples)).toBeCloseTo(2, 1);
  expect(samples.reduce((s, v) => s + v.re, 0) / samples.length).toBeCloseTo(0, 1);
  expect(samples.reduce((s, v) => s + v.re * v.im, 0) / samples.length).toBeCloseTo(0, 1);
});
