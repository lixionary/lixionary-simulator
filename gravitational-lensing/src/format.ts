import { ARCSEC, AU, LIGHT_YEAR } from './model';

const trim = (value: number, digits = 2) => value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(digits);
const big = (value: number) => {
  for (const [scale, word] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']] as const) if (value >= scale * 0.9995) return `${trim(value / scale, 1)} ${word}`;
  return value >= 9999.5 ? Math.round(Number(value.toPrecision(3))).toLocaleString('en-US') : value >= 100 ? Math.round(value).toLocaleString('en-US') : trim(value);
};

/** An angle on the sky: arcminutes, arcseconds (″), thousandths (mas), or millionths (µas) of one. */
export function angle(radians: number) {
  const seconds = radians / ARCSEC;
  if (seconds >= 60) return `${trim(seconds / 60, 1)}′`;
  if (seconds >= 0.0995) return `${trim(seconds)}″`;
  if (seconds >= 0.0000995) return `${trim(seconds * 1000)} mas`;
  return `${trim(seconds * 1e6)} µas`;
}

/** A mass in everyday comparisons: Jupiters for planets, Suns for everything else. */
export function suns(mass: number) {
  if (mass < 0.00995) return `${trim(mass * 1047.57, 1)} Jupiters`;
  return `${big(mass)} Suns`;
}

export const lightYears = (value: number) => `${big(value)} light-years`;

/** A length at the lens: kilometres, Earth–Sun distances (AU), or light-years. */
export function span(metres: number) {
  if (metres < 0.01 * AU) return `${big(metres / 1000)} km`;
  if (metres < 0.05 * LIGHT_YEAR) return `${big(metres / AU)} AU`;
  return lightYears(metres / LIGHT_YEAR);
}

export function timespan(seconds: number) {
  const days = seconds / 86_400;
  if (days < 1) return `${trim(days * 24, 1)} hours`;
  if (days < 730) return `${trim(days, 1)} days`;
  return `${big(days / 365.25)} years`;
}

export const times = (gain: number) => `${gain >= 99.5 ? gain.toFixed(0) : gain >= 9.95 ? gain.toFixed(1) : gain.toFixed(2)}×`;
