const SUPERSCRIPT: Record<string, string> = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const power = (exponent: number) => `10${[...String(exponent)].map(c => SUPERSCRIPT[c]).join('')}`;

/** A small or large quantity as "1.2 × 10⁻⁵", with a true minus sign. */
export function sci(value: number, digits = 2) {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : '—';
  if (value === 0) return '0';
  const [mantissa, exponent] = Math.abs(value).toExponential(digits - 1).split('e');
  return `${value < 0 ? '−' : ''}${mantissa} × ${power(Number(exponent))}`;
}

/** A value to a fixed number of significant figures, such as "2.66667" or "0.746824". */
export function num(value: number, digits = 6) {
  if (!Number.isFinite(value)) return value > 0 ? '∞' : value < 0 ? '−∞' : '—';
  const size = Math.abs(value);
  if (size !== 0 && (size < 1e-4 || size >= 1e9)) return sci(value, Math.min(digits, 4));
  const text = size === 0 ? (0).toFixed(digits - 1) : size.toFixed(Math.max(0, digits - 1 - Math.floor(Math.log10(size))));
  return `${value < 0 ? '−' : ''}${text}`;
}

/** An error: zero when it is only the computer's rounding, otherwise in powers of ten. */
export const err = (error: number, exact: boolean) => exact ? '0' : Math.abs(error) >= 0.01 && Math.abs(error) < 1000 ? num(error, 3) : sci(error);

/** How many leading digits of the answer are right, from the relative error. */
export function correctDigits(relative: number) {
  if (!Number.isFinite(relative)) return 0;
  return relative <= 0 ? 16 : Math.max(0, Math.min(16, Math.floor(-Math.log10(2 * relative))));
}

export const count = (n: number) => n.toLocaleString('en-US');
export const percent = (fraction: number, digits = 1) => `${fraction < 0 ? '−' : ''}${(Math.abs(fraction) * 100).toFixed(digits)}%`;
/** How many times smaller, such as "÷ 4.00" or "÷ 16.0". */
export const shrink = (ratio: number | null) => ratio === null ? '—' : Math.abs(ratio) >= 1 ? `÷ ${num(Math.abs(ratio), 3)}` : `× ${num(1 / Math.abs(ratio), 3)}`;
/** An interval end to two decimals without trailing zeros, such as "3.14" or "2". */
export const bound = (x: number) => `${x < 0 ? '−' : ''}${Number(Math.abs(x).toFixed(2))}`;
export const metres = (d: number, digits = 0) => `${d < 0 && Number(d.toFixed(digits)) !== 0 ? '−' : ''}${Math.abs(d).toFixed(digits)} m`;
