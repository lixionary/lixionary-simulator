import { DAY } from './model';

const sign = (value: number, signed: boolean) => value < 0 ? '−' : signed ? '+' : '';
export const thousands = (value: number) => Math.round(value).toLocaleString('en-US');

/** A time interval such as "+38.58 µs" or "22.9 ns". Anything under a picosecond is zero. */
export function duration(seconds: number, signed = false) {
  const size = Math.abs(seconds);
  if (size < 1e-12) return '0 ns';
  const [scale, unit] = size < 0.99995e-6 ? [1e9, 'ns'] : size < 0.99995e-3 ? [1e6, 'µs'] : [1e3, 'ms'];
  const scaled = size * scale;
  return `${sign(seconds, signed)}${scaled.toFixed(scaled < 99.995 ? (unit === 'ns' ? 1 : 2) : 1)} ${unit}`;
}

/** A length such as "8.0 m" or "11.56 km". Anything under a millimetre is zero. */
export function distance(metres: number) {
  const size = Math.abs(metres);
  if (size < 1e-3) return '0 m';
  if (size < 0.995) return `${size.toFixed(2)} m`;
  if (size < 99.95) return `${size.toFixed(1)} m`;
  if (size < 999.5) return `${size.toFixed(0)} m`;
  return `${(size / 1000).toFixed(size < 99_995 ? 2 : 1)} km`;
}

/** A clock rate as microseconds gained per day. */
export function perDay(fraction: number) {
  const value = fraction * DAY * 1e6;
  return Math.abs(value) < 0.05 ? '0.0 µs/day' : `${sign(value, true)}${Math.abs(value).toFixed(1)} µs/day`;
}

export function elapsed(seconds: number) {
  const days = Math.floor(seconds / DAY), hours = Math.floor(seconds % DAY / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return `${days} d ${String(hours).padStart(2, '0')} h ${String(minutes).padStart(2, '0')} min`;
}

export function hoursMinutes(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** A clock face reading to the nanosecond: whole seconds since the clocks were set, plus an offset in seconds. */
export function clockReading(whole: number, offset = 0) {
  let total = BigInt(Math.round(whole)) * 1_000_000_000n + BigInt(Math.round(offset * 1e9));
  const negative = total < 0n;
  if (negative) total = -total;
  const seconds = Number(total / 1_000_000_000n), nanos = String(total % 1_000_000_000n).padStart(9, '0');
  const two = (value: number) => String(value).padStart(2, '0');
  return {
    time: `${negative ? '−' : ''}Day ${Math.floor(seconds / DAY)} · ${two(Math.floor(seconds % DAY / 3600))}:${two(Math.floor(seconds % 3600 / 60))}:${two(seconds % 60)}`,
    fraction: `.${nanos.slice(0, 3)} ${nanos.slice(3, 6)} ${nanos.slice(6)}`,
  };
}
