import type { Complex } from './types';
export const c = (re = 0, im = 0): Complex => ({ re, im });
export const add = (a: Complex, b: Complex) => c(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex) => c(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a: Complex, s: number) => c(a.re * s, a.im * s);
export const conj = (a: Complex) => c(a.re, -a.im);
export const power = (a: Complex) => a.re * a.re + a.im * a.im;
export const polar = (r: number, phase: number) => c(r * Math.cos(phase), r * Math.sin(phase));
export const lerp = (a: Complex, b: Complex, t: number) => add(scale(a, 1 - t), scale(b, t));

/** Radix-2 FFT, unitary in both directions. */
export function fft(input: Complex[], inverse = false): Complex[] {
  const n = input.length;
  if (!n || (n & (n - 1))) throw new Error('FFT size must be a power of two.');
  const out = input.map(v => ({ ...v }));
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [out[i], out[j]] = [out[j], out[i]];
  }
  for (let size = 2; size <= n; size *= 2) {
    for (let start = 0; start < n; start += size) {
      for (let j = 0; j < size / 2; j++) {
        const w = polar(1, (inverse ? 1 : -1) * 2 * Math.PI * j / size);
        const even = out[start + j], odd = mul(out[start + j + size / 2], w);
        out[start + j] = add(even, odd);
        out[start + j + size / 2] = sub(even, odd);
      }
    }
  }
  return out.map(v => scale(v, 1 / Math.sqrt(n)));
}

export function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gaussian(random: () => number) {
  const r = Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12)));
  const theta = 2 * Math.PI * random();
  return c(r * Math.cos(theta), r * Math.sin(theta));
}
export const meanPower = (values: Complex[]) => values.reduce((sum, v) => sum + power(v), 0) / Math.max(1, values.length);
