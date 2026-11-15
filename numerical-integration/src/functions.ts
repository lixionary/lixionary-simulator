import { convergence, errorBound, evaluations, G, integrate, isExact, maxAbs, primesBetween, reference, RULES, slicesFor, type Fn, type Rule } from './model';
import { bound, num, percent } from './format';

export interface Param { label: string; min: number; max: number; step: number; value: number; text: (p: number) => string }
export interface Integrand {
  key: string;
  /** The integrand as written, such as "x²". */
  label: string;
  f: (x: number, p: number) => number;
  /** The antiderivative and how it is written, where one exists. */
  antiderivative?: Fn;
  formula?: string;
  /** First, second, and fourth derivative, for the textbook error bounds. */
  derivatives?: [Fn, Fn, Fn];
  interval: [number, number];
  domain: [number, number];
  /** The interval is part of the problem and cannot be moved. */
  fixed?: boolean;
  /** Clip the picture here when the curve runs off to infinity. */
  cap?: number;
  param?: Param;
  /** The name mathematics gave the integral, since it has no formula. */
  special?: string;
  meaning?: (value: number, a: number, b: number, p: number) => string;
  about?: string;
}

const { sin, cos, exp, sqrt, log, atan, PI } = Math;

/** Curves whose integral has a formula. */
export const FORMULA: Integrand[] = [
  { key: 'square', label: 'x²', f: x => x * x, antiderivative: x => x ** 3 / 3, formula: 'x³/3', derivatives: [x => 2 * x, () => 2, () => 0], interval: [0, 2], domain: [-2, 4] },
  { key: 'cube', label: 'x³', f: x => x ** 3, antiderivative: x => x ** 4 / 4, formula: 'x⁴/4', derivatives: [x => 3 * x * x, x => 6 * x, () => 0], interval: [0, 2], domain: [-2, 3] },
  { key: 'sine', label: 'sin x', f: x => sin(x), antiderivative: x => -cos(x), formula: '−cos x', derivatives: [cos, x => -sin(x), sin], interval: [0, PI], domain: [0, 6.3] },
  { key: 'exp', label: 'eˣ', f: x => exp(x), antiderivative: exp, formula: 'eˣ', derivatives: [exp, exp, exp], interval: [0, 2], domain: [-2, 3] },
  { key: 'reciprocal', label: '1/x', f: x => 1 / x, antiderivative: log, formula: 'ln x', derivatives: [x => -1 / x ** 2, x => 2 / x ** 3, x => 24 / x ** 5], interval: [1, 4], domain: [0.2, 6] },
  { key: 'root', label: '√x', f: x => sqrt(x), antiderivative: x => 2 / 3 * x * sqrt(x), formula: '⅔·x√x', derivatives: [x => 0.5 / sqrt(x), x => -0.25 * x ** -1.5, x => -15 / 16 * x ** -3.5], interval: [0, 1], domain: [0, 4] },
  { key: 'witch', label: '1/(1+x²)', f: x => 1 / (1 + x * x), antiderivative: atan, formula: 'arctan x', derivatives: [x => -2 * x / (1 + x * x) ** 2, x => (6 * x * x - 2) / (1 + x * x) ** 3, x => 24 * (5 * x ** 4 - 10 * x * x + 1) / (1 + x * x) ** 5], interval: [0, 1], domain: [-4, 4],
    meaning: (value, a, b) => a === 0 && b === 1 ? `Four times this area is π: ${num(4 * value, 8)}.` : '' },
  { key: 'sine-squared', label: 'sin²x', f: x => sin(x) ** 2, antiderivative: x => x / 2 - sin(2 * x) / 4, formula: 'x/2 − sin(2x)/4', derivatives: [x => sin(2 * x), x => 2 * cos(2 * x), x => -8 * cos(2 * x)], interval: [0, PI], domain: [0, 6.3] },
];

const SMALL_ANGLE = 2 * PI * sqrt(1 / G);
/** Smooth, ordinary-looking curves whose integral cannot be written with powers, roots, exponentials, logarithms, or trigonometry. */
export const NO_FORMULA: Integrand[] = [
  { key: 'bell', label: 'e^(−x²/2) / √(2π)', f: x => exp(-x * x / 2) / sqrt(2 * PI), interval: [-1, 1], domain: [-4, 4], special: 'the error function, erf',
    about: 'The bell curve of chance: heights, measurement errors, exam marks.',
    meaning: (value, a, b) => `${percent(value, 2)} of a normal population lies between ${bound(a)} and ${bound(b)} standard deviations from the average.` },
  { key: 'sinc', label: 'sin x / x', f: x => x === 0 ? 1 : sin(x) / x, interval: [0, PI], domain: [0, 20], special: 'the sine integral, Si',
    about: 'The shape of a sharp pulse once its high frequencies are cut off.',
    meaning: (value, a) => a === 0 ? `As the right end goes to infinity this settles at π/2 = 1.5708. It is now ${num(value, 5)}.` : '' },
  { key: 'fresnel', label: 'sin(x²)', f: x => sin(x * x), interval: [0, 3], domain: [0, 6], special: 'the Fresnel integral, S',
    about: 'Light bending round an edge, and the curve that eases a road or railway into a bend.' },
  { key: 'log', label: '1 / ln x', f: x => 1 / log(x), interval: [2, 100], domain: [2, 200], special: 'the logarithmic integral, li',
    about: 'Near x, about one number in ln x is prime, so this area counts primes.',
    meaning: (value, a, b) => `There are really ${primesBetween(a, b)} primes from ${bound(a)} to ${bound(b)}. The area says about ${value.toFixed(1)}.` },
  { key: 'arc', label: '√(1 + cos²x)', f: x => sqrt(1 + cos(x) ** 2), interval: [0, PI], domain: [0, 6.3], special: 'an elliptic integral of the second kind',
    about: 'The length of the curve y = sin x. Almost every curve’s length is an integral like this.',
    meaning: (value, a, b) => `The sine wave from ${bound(a)} to ${bound(b)} is ${num(value, 5)} long, against ${num(b - a, 5)} straight across.` },
  { key: 'pendulum', label: '4√(L/g) / √(1 − k² sin²φ)', f: (x, p) => 4 * sqrt(1 / G) / sqrt(1 - (sin(p * PI / 360) * sin(x)) ** 2), interval: [0, PI / 2], domain: [0, PI / 2], fixed: true, special: 'an elliptic integral of the first kind',
    param: { label: 'Swing to each side', min: 5, max: 175, step: 5, value: 90, text: p => `${p}°` },
    about: 'The time a 1 m pendulum takes for one full swing, with k = sin(half the swing angle).',
    meaning: value => `One swing takes ${num(value, 5)} s. The school formula 2π√(L/g) says ${num(SMALL_ANGLE, 5)} s, which is ${percent(1 - SMALL_ANGLE / value)} too short.` },
  { key: 'ellipse', label: '4·√(1 − e² sin²φ)', f: (x, p) => 4 * sqrt(1 - (1 - p * p) * sin(x) ** 2), interval: [0, PI / 2], domain: [0, PI / 2], fixed: true, special: 'an elliptic integral of the second kind',
    param: { label: 'Short axis ÷ long axis', min: 0.1, max: 1, step: 0.05, value: 0.5, text: p => p.toFixed(2) },
    about: 'The distance round an ellipse whose long half-axis is 1. There is a formula for its area, but not for its edge.',
    meaning: (value, _a, _b, p) => p === 1 ? `A circle: the distance round is 2π = ${num(2 * PI, 6)}.` : `The distance round is ${num(value, 6)}. Its area is simply π × ${p.toFixed(2)}.` },
];

const SPIKE_AT = 0.37, NARROW = 0.004, WAVES = 16;
/** Curves that have a formula and still catch a numeric rule out. */
export const TRAPS: Integrand[] = [
  { key: 'missed-spike', label: 'a narrow spike', f: x => 1 / (1 + ((x - SPIKE_AT) / NARROW) ** 2), antiderivative: x => NARROW * atan((x - SPIKE_AT) / NARROW), formula: 'w·arctan((x − c)/w)', interval: [0, 1], domain: [0, 1], fixed: true,
    about: 'Nearly all the area sits in a spike 0.008 wide at x = 0.37. Slices that do not land on it never learn it is there.' },
  { key: 'blow-up', label: '1/√x', f: x => 1 / sqrt(x), antiderivative: x => 2 * sqrt(x), formula: '2√x', interval: [0, 1], domain: [0, 1], fixed: true, cap: 8,
    about: 'The curve is infinitely tall at 0, yet the area under it is exactly 2. A rule that evaluates the left end gets infinity.' },
  { key: 'alias', label: '1 + cos(32πx)', f: x => 1 + cos(2 * PI * WAVES * x), antiderivative: x => x + sin(2 * PI * WAVES * x) / (2 * PI * WAVES), formula: 'x + sin(32πx)/(32π)', interval: [0, 1], domain: [0, 1], fixed: true,
    about: 'Sixteen full waves. Sixteen equal slices land on sixteen crests and see a flat line at 2.' },
];

/** The spike used for adaptive integration: height 1 at x = 0.37, with a half-width the lab can change. */
export const spike = (width: number) => ({ f: (x: number) => 1 / (1 + ((x - SPIKE_AT) / width) ** 2), exact: width * (atan((1 - SPIKE_AT) / width) + atan(SPIKE_AT / width)) });

export const ALL = [...FORMULA, ...NO_FORMULA, ...TRAPS];
export const integrandOf = (key: string) => ALL.find(fn => fn.key === key)!;

export interface Setup { fn: string; a: number; b: number; p: number; rule: Rule; n: number }
/** A curve on its usual interval, ready to integrate with the given rule and number of slices. */
export function setupFor(key: string, rule: Rule, n: number, patch: Partial<Setup> = {}): Setup {
  const fn = integrandOf(key);
  return { fn: key, a: fn.interval[0], b: fn.interval[1], p: fn.param?.value ?? 0, rule, n, ...patch };
}

/** Everything the lab shows about one curve, one rule, and one number of slices. */
export function solve(setup: Setup) {
  const fn = integrandOf(setup.fn), { a, b, rule } = setup, f: Fn = x => fn.f(x, setup.p), n = slicesFor(rule, setup.n), formula = fn.antiderivative !== undefined;
  const exact = fn.antiderivative ? fn.antiderivative(b) - fn.antiderivative(a) : reference(f, a, b);
  const value = integrate(f, a, b, n, rule), error = value - exact, zero = isExact(error, exact), doubled = integrate(f, a, b, 2 * n, rule), doubledError = doubled - exact;
  const relative = zero ? 0 : Math.abs(error / exact), ratio = zero || isExact(doubledError, exact) || !Number.isFinite(error) ? null : error / doubledError;
  const limit = fn.derivatives ? errorBound(rule, a, b, n, fn.derivatives.map(d => maxAbs(d, a, b)) as [number, number, number]) : null;
  const curves = RULES.map(r => ({ rule: r.key, points: convergence(f, a, b, r.key, exact, 2, 12).map(row => [row.n, Math.abs(row.error)] as [number, number]) }));
  const sweep = convergence(f, a, b, rule, exact, 2, 13);
  return { fn, f, a, b, rule, n, formula, exact, value, error, zero, relative, ratio, limit, curves,
    evaluations: evaluations(rule, n), width: (b - a) / n, estimate: Math.abs(doubled - value), rows: convergence(f, a, b, rule, exact, n),
    /** The error a user can estimate without knowing the answer, next to the error really made, as the slices double. */
    selfCheck: sweep.slice(0, -1).map((row, i) => ({ n: row.n, estimate: Math.abs(sweep[i + 1].value - row.value), actual: Math.abs(row.error) })) };
}
export type Solved = ReturnType<typeof solve>;
