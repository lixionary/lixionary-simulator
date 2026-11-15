const PREFIXES: [number, string][] = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'], [1e-18, 'a']];
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** A quantity with an SI prefix and three significant figures, such as "4.03 mA" or "−56.7 fA". */
export function si(value: number, unit: string) {
  const size = Math.abs(value);
  if (size < 1e-19) return `0 ${unit}`;
  const [scale, prefix] = PREFIXES.find(([s]) => size >= s * 0.9995) ?? PREFIXES[PREFIXES.length - 1], scaled = size / scale;
  return `${value < 0 ? '−' : ''}${scaled.toFixed(scaled >= 99.95 ? 0 : scaled >= 9.995 ? 1 : 2)} ${prefix}${unit}`;
}

/** A doping level such as "1.0 × 10¹⁷ per cm³". */
export function doping(perCm3: number) {
  const power = Math.floor(Math.log10(perCm3) + 1e-9);
  return `${(perCm3 / 10 ** power).toFixed(1)} × 10${String(power).split('').map(d => SUPERSCRIPT[Number(d)]).join('')} per cm³`;
}

export const volts = (value: number, digits = 2) => `${value < -0.5 * 10 ** -digits ? '−' : ''}${Math.abs(value).toFixed(digits)} V`;
export const power10 = (value: number) => { const power = Math.round(Math.log10(value)); return `10${power < 0 ? '⁻' : ''}${String(Math.abs(power)).split('').map(d => SUPERSCRIPT[Number(d)]).join('')}`; };
