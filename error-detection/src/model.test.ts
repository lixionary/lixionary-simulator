import { describe, expect, it } from 'vitest';
import { crcRemainder } from '../../4g-lte/src/sim/codec';
import { binary, byteBits, checksum, crc, evenParity, onesComplementSum } from './algorithms';
import { ALGORITHMS, DEFAULT_MESSAGE, exampleFlips, parseMessage, simulate, type Algorithm } from './model';

const algorithms = Object.keys(ALGORITHMS) as Algorithm[];
const bits = (input: string) => [...input].map(Number);

describe('independent algorithm examples', () => {
  it('computes parity, a four-bit checksum, and textbook CRC division', () => {
    expect(evenParity(bits('10110010'))).toMatchObject({ ones: 4, bit: 0 });
    expect(evenParity(bits('10110011'))).toMatchObject({ ones: 5, bit: 1 });
    expect(checksum(bits('10110010'), 4).value).toBe(0b0010);
    expect(crc(bits('11010011101100'), 3, 0b1011).remainder).toEqual(bits('100'));
    expect(crc(bits('11010011101100100'), 3, 0b1011, false).value).toBe(0);
  });

  it('wraps end-around carry and preserves the two zero representations', () => {
    expect(onesComplementSum([15, 1], 4).sum).toBe(1);
    expect(onesComplementSum([15, 15], 4).sum).toBe(15);
    expect(onesComplementSum([15, 15, 1], 4).sum).toBe(1);
    expect(checksum(bits('11110001'), 4).value).toBe(14);
    expect(checksum(bits('00000000'), 4).value).toBe(15);
    expect(checksum(bits('11110000'), 4).value).toBe(0);
    expect(checksum(bits('11110001'), 4).steps.some(step => step.title === 'Wrap the carry around')).toBe(true);
  });

  it('matches real-width reference values and pads odd bytes on the right', () => {
    const message = byteBits(new TextEncoder().encode('123456789'));
    expect(checksum(message, 16).value).toBe(0xF62A);
    expect(crc(message, 8, 0x107).value).toBe(0xF4);
    expect(checksum(byteBits(new TextEncoder().encode('A')), 16).value).toBe(0xBEFF);
    expect(checksum(byteBits(new TextEncoder().encode('ABC')), 16).value).toBe(0x7BBD);
    // RFC 1071's example octets have a folded sum of 0xDDF2.
    expect(checksum(byteBits(new Uint8Array([0, 1, 0xF2, 3, 0xF4, 0xF5, 0xF6, 0xF7])), 16).value).toBe(0x220D);
  });

  it('agrees with the independently implemented LTE CRC for all single-byte messages', () => {
    for (let value = 0; value < 256; value++) {
      const payload = bits(binary(value, 8));
      expect(crc(payload, 8, 0x107).remainder).toEqual(crcRemainder(payload, 8, true));
    }
  });
});

describe('complete teaching frames', () => {
  it('accepts every clean payload and detects every single-bit error in each complete frame', () => {
    for (const algorithm of algorithms) for (let value = 0; value < 256; value++) {
      const payload = bits(binary(value, 8));
      const clean = simulate(payload, algorithm);
      expect(clean.passed).toBe(true);
      expect(clean.changed).toBe(false);
      expect(clean.sent).toHaveLength(8 + ALGORITHMS[algorithm].width);
      for (let position = 0; position < clean.sent.length; position++) {
        const corrupted = simulate(payload, algorithm, new Set([position]));
        expect(corrupted.passed, `${algorithm}, payload ${value}, position ${position}`).toBe(false);
        expect(corrupted.changedCount).toBe(1);
      }
    }
  });

  it('demonstrates genuine undetected corruption for each guided preset', () => {
    const payload = parseMessage(DEFAULT_MESSAGE);
    for (const algorithm of algorithms) {
      const miss = simulate(payload, algorithm, exampleFlips(algorithm, 'miss', payload));
      expect(miss.missed).toBe(true);
      expect(miss.received.slice(0, 8)).not.toEqual(payload);
      expect(miss.received.slice(8)).toEqual(miss.check);
      expect(simulate(payload, algorithm, exampleFlips(algorithm, 'single', payload)).passed).toBe(false);
      expect(simulate(payload, algorithm, exampleFlips(algorithm, 'clean', payload)).changed).toBe(false);
    }
  });

  it('retains blind spots for every payload where the error pattern changes data', () => {
    for (const algorithm of algorithms) for (let value = 0; value < 256; value++) {
      const payload = bits(binary(value, 8));
      const flips = exampleFlips(algorithm, 'miss', payload);
      const result = simulate(payload, algorithm, flips);
      expect(result.passed).toBe(true);
      expect(result.missed).toBe(flips.size > 0);
    }
  });

  it('provides sender and receiver traces without mutating payloads or flip sets', () => {
    const payload = parseMessage(DEFAULT_MESSAGE), original = [...payload], flips = new Set([0, 8]);
    for (const algorithm of algorithms) {
      const result = simulate(payload, algorithm, flips);
      expect(result.steps[0].phase).toBe('Sender');
      expect(result.steps.at(-1)?.phase).toBe('Receiver');
      expect(result.steps.every(step => step.title && step.detail && step.calculation)).toBe(true);
    }
    expect(payload).toEqual(original);
    expect([...flips]).toEqual([0, 8]);
  });
});

describe('input contracts', () => {
  it('accepts exactly eight bits with optional whitespace and rejects invalid input', () => {
    expect(parseMessage('1011 0010\n')).toEqual(bits(DEFAULT_MESSAGE));
    for (const input of ['', '1011001', '101100100', '1011001x', 'abcdefgh', '１０１１００１０']) expect(() => parseMessage(input)).toThrow('exactly 8');
    expect(() => simulate([1], 'parity')).toThrow('exactly 8');
  });

  it('rejects malformed low-level inputs', () => {
    expect(() => evenParity([2])).toThrow('binary');
    expect(() => checksum([], 4)).toThrow('nonempty');
    expect(() => onesComplementSum([16], 4)).toThrow('fit');
    expect(() => crc([1], 3, 0b1010)).toThrow('polynomial');
    expect(() => crc([1], 3, 0b11)).toThrow('polynomial');
  });
});
