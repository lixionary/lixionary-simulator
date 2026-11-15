import { ZERO_C } from './model';

const PREFIXES: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ']];

/** A quantity with an SI prefix and three significant figures, such as "115 J" or "2.54 kW". */
export function si(value: number, unit: string) {
  const size = Math.abs(value);
  if (size < 1e-9) return `0 ${unit}`;
  const [scale, prefix] = PREFIXES.find(([s]) => size >= s * 0.9995) ?? PREFIXES[PREFIXES.length - 1], scaled = size / scale;
  return `${value < 0 ? '−' : ''}${scaled.toFixed(scaled >= 99.95 ? 0 : scaled >= 9.995 ? 1 : 2)} ${prefix}${unit}`;
}

export const kelvin = (t: number) => `${t.toFixed(0)} K`;
/** A temperature in kelvin shown in whole degrees Celsius, such as "−20 °C". */
export function celsius(t: number, digits = 0) {
  const value = t - ZERO_C, text = Math.abs(value).toFixed(digits);
  return `${value < 0 && Number(text) !== 0 ? '−' : ''}${text} °C`;
}
export const percent = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`;
export const litres = (v: number) => `${(v * 1000).toFixed(v < 0.00995 ? 2 : v < 0.0995 ? 1 : 0)} L`;
export const cop = (value: number) => value.toFixed(value >= 9.995 ? 1 : 2);
