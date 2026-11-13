import { c, power, sub } from './math';
import { BITS_PER_SYMBOL, type Coding, type Complex, type Modulation } from './types';

export function serialize(source: string, mode: 'ascii' | 'binary'): number[] {
  if (mode === 'binary') {
    const value = source.replace(/\s/g, '');
    if (!value || /[^01]/.test(value)) throw new Error('Enter binary digits (0 and 1). Spaces and newlines are allowed.');
    if (value.length > 1024) throw new Error('Keep binary input to 1,024 bits or fewer.');
    return [...value].map(Number);
  }
  if (!source.length) throw new Error('Enter a message to send through the channel.');
  if (source.length > 128) throw new Error('Keep your message to 128 characters or fewer.');
  if ([...source].some(ch => ch.charCodeAt(0) > 127)) throw new Error('This model uses ASCII. Use English letters, numbers, punctuation, or newlines.');
  return [...source].flatMap(ch => Array.from({ length: 8 }, (_, i) => (ch.charCodeAt(0) >> (7 - i)) & 1));
}

/** MSB-first polynomial division; initial remainder 0, no reflection or final XOR. */
export function crcRemainder(bits: number[], width: 8 | 16, appendZeros = false): number[] {
  const polynomial = width === 8 ? 0x107 : 0x11021;
  const work = [...bits, ...Array(appendZeros ? width : 0).fill(0)];
  for (let i = 0; i < work.length - width; i++) {
    if (work[i]) for (let j = 0; j <= width; j++) work[i + j] ^= (polynomial >> (width - j)) & 1;
  }
  return work.slice(-width);
}
export function attachCrc(payload: number[], width: 0 | 8 | 16): number[] {
  return width ? [...payload, ...crcRemainder(payload, width, true)] : [...payload];
}

export function encode(bits: number[], coding: Coding): { bits: number[]; padding: number } {
  if (coding === 'none') return { bits: [...bits], padding: 0 };
  if (coding === 'hamming') {
    const padding = (4 - bits.length % 4) % 4;
    const input = [...bits, ...Array(padding).fill(0)], out: number[] = [];
    for (let i = 0; i < input.length; i += 4) {
      const [d1, d2, d3, d4] = input.slice(i, i + 4);
      out.push(d1 ^ d2 ^ d4, d1 ^ d3 ^ d4, d1, d2 ^ d3 ^ d4, d2, d3, d4);
    }
    return { bits: out, padding };
  }
  const out: number[] = []; let state = 0;
  for (const bit of [...bits, 0, 0]) {
    out.push(bit ^ (state & 1) ^ (state >> 1), bit ^ (state >> 1));
    state = ((state << 1) | bit) & 3;
  }
  return { bits: out, padding: 2 };
}

export function decode(bits: number[], llrs: number[], coding: Coding, soft: boolean, length: number) {
  if (coding === 'none') return { bits: bits.slice(0, length), corrected: 0 };
  if (coding === 'hamming') {
    const output: number[] = []; let corrected = 0;
    for (let i = 0; i < bits.length; i += 7) {
      const r = bits.slice(i, i + 7);
      if (r.length < 7) break;
      const s1 = r[0] ^ r[2] ^ r[4] ^ r[6];
      const s2 = r[1] ^ r[2] ^ r[5] ^ r[6];
      const s3 = r[3] ^ r[4] ^ r[5] ^ r[6];
      const syndrome = s1 | (s2 << 1) | (s3 << 2);
      if (syndrome) { r[syndrome - 1] ^= 1; corrected++; }
      output.push(r[2], r[4], r[5], r[6]);
    }
    return { bits: output.slice(0, length), corrected };
  }
  let metrics = [0, Infinity, Infinity, Infinity];
  const parents: number[][] = [], decisions: number[][] = [];
  for (let t = 0; t < bits.length / 2; t++) {
    const next = Array(4).fill(Infinity), previous = Array(4).fill(0), chosen = Array(4).fill(0);
    for (let state = 0; state < 4; state++) {
      for (let bit = 0; bit < 2; bit++) {
        const dest = ((state << 1) | bit) & 3;
        const a = bit ^ (state & 1) ^ (state >> 1), b = bit ^ (state >> 1);
        const cost = soft
          ? -0.5 * ((1 - 2 * a) * llrs[2 * t] + (1 - 2 * b) * llrs[2 * t + 1])
          : Number(a !== bits[2 * t]) + Number(b !== bits[2 * t + 1]);
        const candidate = metrics[state] + cost;
        if (candidate < next[dest]) { next[dest] = candidate; previous[dest] = state; chosen[dest] = bit; }
      }
    }
    const minimum = Math.min(...next);
    metrics = next.map(v => v - minimum);
    parents.push(previous); decisions.push(chosen);
  }
  let state = 0; const output = Array(parents.length).fill(0);
  for (let t = output.length - 1; t >= 0; t--) { output[t] = decisions[t][state]; state = parents[t][state]; }
  return { bits: output.slice(0, length), corrected: 0 };
}

/** 3GPP-style length-31 Gold sequence, Nc = 1600; direct c_init seed. */
export function goldSequence(length: number, seed: number): number[] {
  const n = 1600 + length;
  const x1 = new Uint8Array(n + 31), x2 = new Uint8Array(n + 31);
  x1[0] = 1;
  for (let i = 0; i < 31; i++) x2[i] = (seed >>> i) & 1;
  for (let i = 0; i < n; i++) {
    x1[i + 31] = x1[i + 3] ^ x1[i];
    x2[i + 31] = x2[i + 3] ^ x2[i + 2] ^ x2[i + 1] ^ x2[i];
  }
  return Array.from({ length }, (_, i) => x1[1600 + i] ^ x2[1600 + i]);
}

function grayToBinary(gray: number) {
  let binary = gray;
  for (let shift = gray >> 1; shift; shift >>= 1) binary ^= shift;
  return binary;
}
export function mapSymbol(bits: number[], modulation: Modulation): Complex {
  if (modulation === 'BPSK') return c(bits[0] ? 1 : -1);
  const m = BITS_PER_SYMBOL[modulation], axisBits = m / 2;
  let i = 0, q = 0;
  for (let b = 0; b < axisBits; b++) { i = (i << 1) | bits[2 * b]; q = (q << 1) | bits[2 * b + 1]; }
  const levels = 2 ** axisBits;
  const normalization = Math.sqrt(2 * (levels * levels - 1) / 3);
  return c((2 * grayToBinary(i) - levels + 1) / normalization, (2 * grayToBinary(q) - levels + 1) / normalization);
}
const constellationCache = new Map<Modulation, { point: Complex; bits: number[] }[]>();
export function constellation(modulation: Modulation) {
  if (!constellationCache.has(modulation)) {
    const m = BITS_PER_SYMBOL[modulation];
    constellationCache.set(modulation, Array.from({ length: 2 ** m }, (_, word) => {
      const bits = Array.from({ length: m }, (_, i) => (word >> (m - 1 - i)) & 1);
      return { bits, point: mapSymbol(bits, modulation) };
    }));
  }
  return constellationCache.get(modulation)!;
}
/** Positive LLR favors bit 0; gain-aware metrics undo MMSE decision bias. */
export function demap(value: Complex, modulation: Modulation, variance: number, gain = 1) {
  const m = BITS_PER_SYMBOL[modulation], zero = Array(m).fill(Infinity), one = Array(m).fill(Infinity);
  let nearest = constellation(modulation)[0], best = Infinity;
  for (const candidate of constellation(modulation)) {
    const distance = power(sub(value, c(candidate.point.re * gain, candidate.point.im * gain)));
    if (distance < best) { best = distance; nearest = candidate; }
    for (let bit = 0; bit < m; bit++) {
      const target = candidate.bits[bit] ? one : zero;
      target[bit] = Math.min(target[bit], distance);
    }
  }
  return { bits: nearest.bits, llrs: zero.map((v, i) => Math.max(-1e6, Math.min(1e6, (one[i] - v) / Math.max(variance, 1e-12)))) };
}
