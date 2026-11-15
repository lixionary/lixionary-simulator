export type Fn = (x: number) => number;
export type Rule = 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson';

/** Each rule, and the power of the slice width its error is proportional to on a smooth curve. */
export const RULES: { key: Rule; name: string; short: string; order: number }[] = [
  { key: 'left', name: 'Left rectangles', short: 'Left', order: 1 },
  { key: 'right', name: 'Right rectangles', short: 'Right', order: 1 },
  { key: 'midpoint', name: 'Midpoint rectangles', short: 'Midpoint', order: 2 },
  { key: 'trapezoid', name: 'Trapezoids', short: 'Trapezoid', order: 2 },
  { key: 'simpson', name: 'Simpson’s parabolas', short: 'Simpson', order: 4 },
];
export const ruleOf = (rule: Rule) => RULES.find(r => r.key === rule)!;
/** A rule's name for the middle of a sentence: lower case, except for Simpson. */
export const ruleInText = (rule: Rule) => rule === 'simpson' ? ruleOf(rule).name : ruleOf(rule).name.toLowerCase();

/** Simpson's rule joins slices in pairs, so it needs an even number of them. */
export const slicesFor = (rule: Rule, n: number) => rule === 'simpson' ? Math.max(2, n + n % 2) : Math.max(1, n);
/** How many times the rule has to evaluate the function. */
export const evaluations = (rule: Rule, n: number) => rule === 'trapezoid' || rule === 'simpson' ? slicesFor(rule, n) + 1 : slicesFor(rule, n);

/** The numeric integral of f from a to b with n equal slices. Not finite if the rule lands on a point where f is not. */
export function integrate(f: Fn, a: number, b: number, n: number, rule: Rule) {
  n = slicesFor(rule, Math.round(n));
  const h = (b - a) / n;
  let sum = 0;
  if (rule === 'left') for (let i = 0; i < n; i++) sum += f(a + i * h);
  else if (rule === 'right') for (let i = 1; i <= n; i++) sum += f(a + i * h);
  else if (rule === 'midpoint') for (let i = 0; i < n; i++) sum += f(a + (i + 0.5) * h);
  else if (rule === 'trapezoid') { sum = (f(a) + f(b)) / 2; for (let i = 1; i < n; i++) sum += f(a + i * h); }
  else { sum = f(a) + f(b); for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * f(a + i * h); sum /= 3; }
  return sum * h;
}

/** The x positions where the rule evaluates the function. */
export function samplePoints(a: number, b: number, n: number, rule: Rule) {
  n = slicesFor(rule, n);
  const h = (b - a) / n, first = rule === 'right' ? 1 : rule === 'midpoint' ? 0.5 : 0, count = evaluations(rule, n);
  return Array.from({ length: count }, (_, i) => a + (first + i) * h);
}

/** What the rule pretends the curve is: its value at x inside slice i. A flat top, a straight line, or a parabola. */
export function approximant(f: Fn, a: number, b: number, n: number, rule: Rule): (i: number, x: number) => number {
  n = slicesFor(rule, n);
  const h = (b - a) / n;
  return (i, x) => {
    const x0 = a + i * h;
    if (rule === 'left') return f(x0);
    if (rule === 'right') return f(x0 + h);
    if (rule === 'midpoint') return f(x0 + h / 2);
    if (rule === 'trapezoid') return f(x0) + (f(x0 + h) - f(x0)) * (x - x0) / h;
    const xa = a + (i - i % 2) * h, t = (x - xa) / h, ya = f(xa), yb = f(xa + h), yc = f(xa + 2 * h);
    return ya * (t - 1) * (t - 2) / 2 - yb * t * (t - 2) + yc * t * (t - 1) / 2;
  };
}

/** Errors this small, relative to the answer, are the computer's own rounding and not the rule's. */
export const isExact = (error: number, scale: number) => Math.abs(error) <= 1e-14 * Math.max(1, Math.abs(scale));

export interface Row { n: number; value: number; error: number; ratio: number | null }
/** The estimate and its error as the slices double from `start`. `ratio` is how many times smaller the error became. */
export function convergence(f: Fn, a: number, b: number, rule: Rule, exact: number, start: number, count = 7): Row[] {
  const rows: Row[] = [];
  for (let k = 0, n = slicesFor(rule, start); k < count && n <= 1 << 20; k++, n *= 2) {
    const value = integrate(f, a, b, n, rule), error = value - exact, before = rows[k - 1];
    const usable = before && Number.isFinite(error) && Number.isFinite(before.error) && !isExact(error, exact) && !isExact(before.error, exact);
    rows.push({ n, value, error, ratio: usable ? before.error / error : null });
  }
  return rows;
}

/** The power p in error ∝ h^p, measured from the error before and after the slices double. */
export const observedOrder = (before: number, after: number) => Math.log2(Math.abs(before / after));

/** The largest size of g on [a, b], sampled. Infinite if g blows up at an end. */
export function maxAbs(g: Fn, a: number, b: number, samples = 400) {
  let high = 0;
  for (let i = 0; i <= samples; i++) { const y = Math.abs(g(a + (b - a) * i / samples)); if (!(y <= high)) high = y; }
  return high;
}

/** The textbook guarantee on the error, from the largest first, second, and fourth derivative on the interval. */
export function errorBound(rule: Rule, a: number, b: number, n: number, [m1, m2, m4]: [number, number, number]) {
  n = slicesFor(rule, n);
  const w = b - a;
  if (rule === 'left' || rule === 'right') return w ** 2 / (2 * n) * m1;
  if (rule === 'midpoint') return w ** 3 / (24 * n ** 2) * m2;
  if (rule === 'trapezoid') return w ** 3 / (12 * n ** 2) * m2;
  return w ** 5 / (180 * n ** 4) * m4;
}

const GAUSS: [number, number][] = [[0, 0.5688888888888889], [0.5384693101056831, 0.4786286704993665], [-0.5384693101056831, 0.4786286704993665], [0.906179845938664, 0.2369268850561891], [-0.906179845938664, 0.2369268850561891]];
/** A far more accurate integral (five-point Gauss–Legendre on many panels), used as the truth where no formula exists. */
export function reference(f: Fn, a: number, b: number, panels = 1024) {
  const h = (b - a) / panels;
  let sum = 0;
  for (let i = 0; i < panels; i++) { const mid = a + (i + 0.5) * h; for (const [x, w] of GAUSS) sum += w * f(mid + x * h / 2); }
  return sum * h / 2;
}

/** The area from a up to x, for x across the interval: the antiderivative as a curve, whether or not it has a formula. */
export function runningArea(f: Fn, a: number, b: number, steps = 120) {
  const out = [{ x: a, area: 0 }], h = (b - a) / steps;
  for (let i = 0; i < steps; i++) out.push({ x: a + (i + 1) * h, area: out[i].area + reference(f, a + i * h, a + (i + 1) * h, 8) });
  return out;
}

/** The fewest slices (doubling from 2) that bring the relative error under `relative`, or null if `cap` is not enough. */
export function slicesNeeded(f: Fn, a: number, b: number, rule: Rule, exact: number, relative: number, cap = 65536) {
  for (let n = 2; n <= cap; n *= 2) if (Math.abs(integrate(f, a, b, n, rule) - exact) <= relative * Math.abs(exact)) return n;
  return null;
}

export interface Quadrature { value: number; evaluations: number; points: number[]; estimate: number }

/** Simpson's rule that halves a piece only where the two halves disagree with the whole, starting from `pieces` equal pieces. */
export function adaptiveSimpson(f: Fn, a: number, b: number, tolerance: number, pieces = 8, maxDepth = 40): Quadrature {
  const points: number[] = [];
  let estimate = 0;
  const at = (x: number) => { points.push(x); return f(x); }, rule = (fa: number, fm: number, fb: number, width: number) => width / 6 * (fa + 4 * fm + fb);
  function refine(lo: number, flo: number, mid: number, fmid: number, hi: number, fhi: number, whole: number, tol: number, depth: number): number {
    const lm = (lo + mid) / 2, rm = (mid + hi) / 2, flm = at(lm), frm = at(rm), left = rule(flo, flm, fmid, mid - lo), right = rule(fmid, frm, fhi, hi - mid), delta = left + right - whole;
    if (depth <= 0 || Math.abs(delta) <= 15 * tol) { estimate += Math.abs(delta) / 15; return left + right + delta / 15; }
    return refine(lo, flo, lm, flm, mid, fmid, left, tol / 2, depth - 1) + refine(mid, fmid, rm, frm, hi, fhi, right, tol / 2, depth - 1);
  }
  const width = (b - a) / pieces;
  let value = 0, flo = at(a);
  for (let i = 0; i < pieces; i++) {
    const lo = a + i * width, hi = i === pieces - 1 ? b : lo + width, mid = (lo + hi) / 2, fmid = at(mid), fhi = at(hi);
    value += refine(lo, flo, mid, fmid, hi, fhi, rule(flo, fmid, fhi, hi - lo), tolerance / pieces, maxDepth);
    flo = fhi;
  }
  points.sort((p, q) => p - q);
  return { value, evaluations: points.length, points, estimate };
}

/** Simpson's rule with equal slices, doubled until two successive answers agree to the tolerance. */
export function evenSimpson(f: Fn, a: number, b: number, tolerance: number, cap = 1 << 20): Quadrature & { n: number } {
  let n = 8, before = integrate(f, a, b, n, 'simpson');
  for (;;) {
    n *= 2;
    const value = integrate(f, a, b, n, 'simpson'), estimate = Math.abs(value - before) / 15;
    if (estimate <= tolerance || n >= cap) return { value, n, evaluations: n + 1, points: samplePoints(a, b, n, 'simpson'), estimate };
    before = value;
  }
}

export const TRIP_SECONDS = 120;
/** The speed of a car in metres per second over a two-minute trip: pull away, hurry, brake hard at 70 s, stop. */
export const tripSpeed: Fn = t => Math.sin(Math.PI * t / TRIP_SECONDS) ** 2 * (16 + 4 * Math.sin(2 * Math.PI * t / 24)) * (1 - 0.85 * Math.exp(-(((t - 70) / 4) ** 2)));
export const TRIP_DISTANCE = reference(tripSpeed, 0, TRIP_SECONDS, 4096);
export const TRIP_MEAN_SPEED = TRIP_DISTANCE / TRIP_SECONDS;
/** The logging intervals on offer, in seconds. Each divides the trip exactly. */
export const INTERVALS = [0.5, 1, 2, 5, 10, 15, 20, 30];

/** A small repeatable random number generator (mulberry32), so the same seed gives the same readings. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => { s = s + 0x6d2b79f5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export interface Reading { t: number; v: number }
/** Speed readings every `interval` seconds, each off by normally distributed sensor noise of standard deviation `noise`. */
export function sampleTrip(interval: number, noise: number, seed: number): Reading[] {
  const next = random(seed), count = Math.round(TRIP_SECONDS / interval);
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i * interval, bump = Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
    return { t, v: tripSpeed(t) + noise * bump };
  });
}

/** The trapezoid rule on measured readings: all there is when no function exists. */
export function trapezoidData(readings: Reading[]) {
  let sum = 0;
  for (let i = 1; i < readings.length; i++) sum += (readings[i].v + readings[i - 1].v) / 2 * (readings[i].t - readings[i - 1].t);
  return sum;
}

/** For `repeats` different sets of noisy readings: each one's error in distance, the error with no noise at all, and how widely the noise scatters the total around that. */
export function repeatErrors(interval: number, noise: number, repeats = 60) {
  const clean = trapezoidData(sampleTrip(interval, 0, 0)) - TRIP_DISTANCE, errors = Array.from({ length: repeats }, (_, i) => trapezoidData(sampleTrip(interval, noise, 1000 + i)) - TRIP_DISTANCE);
  return { errors, clean, spread: Math.sqrt(errors.reduce((sum, e) => sum + (e - clean) ** 2, 0) / repeats) };
}

/** How many primes lie from a to b inclusive. */
export function primesBetween(a: number, b: number) {
  const top = Math.floor(b), sieve = new Uint8Array(top + 1);
  let count = 0;
  for (let i = 2; i <= top; i++) { if (sieve[i]) continue; if (i >= a) count++; for (let j = i * i; j <= top; j += i) sieve[j] = 1; }
  return count;
}

export const G = 9.80665;
