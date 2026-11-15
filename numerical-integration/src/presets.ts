import { INTERVALS } from './model';
import { setupFor, type Setup } from './functions';

export type Stage = 'formula' | 'none' | 'practice';
export type Situation = 'data' | 'adaptive' | 'trap';
/** How the trip is logged: the index of one of the model's INTERVALS, the sensor noise in m/s, and which set of random readings. */
export interface Trip { interval: number; noise: number; seed: number }
/** The spike's half-width and how many decimal places of accuracy are asked for. */
export interface Spike { width: number; digits: number }
export interface Preset { key: string; stage: Stage; group: string; name: string; notice: string; slice?: Setup; open?: Setup; situation?: Situation; trip?: Trip; spike?: Spike; trap?: Setup }

export const SLICE = setupFor('square', 'left', 8);
export const OPEN = setupFor('bell', 'simpson', 8);
export const TRIP: Trip = { interval: INTERVALS.indexOf(1), noise: 0, seed: 1 };
/** A set of noisy readings whose total is off by a typical amount, neither lucky nor unlucky. */
const SEED = 11;
export const SPIKE: Spike = { width: 0.005, digits: 6 };
export const TRAP = setupFor('missed-spike', 'midpoint', 8);
/** The slice counts on the slider. Doubling any of them lands on another. */
export const SLICES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];

const ONE = '1 · Against the formula', TWO = '2 · No formula', THREE = '3 · In practice';

export const PRESETS: Preset[] = [
  { key: 'rectangles', stage: 'formula', group: ONE, name: 'Rectangles under a parabola', slice: SLICE,
    notice: 'The formula says the area under x² from 0 to 2 is exactly 8/3. Eight rectangles, each as tall as the curve at its left edge, give 2.1875. The blue slivers are what they miss. Double the slices and the error only halves.' },
  { key: 'midpoint', stage: 'formula', group: ONE, name: 'Midpoint against trapezoid', slice: setupFor('square', 'midpoint', 8),
    notice: 'Measure each rectangle at the middle of its slice and the error drops from 0.48 to 0.01. Switch to trapezoids: the error is twice as large and has the opposite sign. That pairing is where Simpson’s rule comes from.' },
  { key: 'simpson', stage: 'formula', group: ONE, name: 'Simpson’s parabolas on a sine', slice: setupFor('sine', 'simpson', 8),
    notice: 'Simpson’s rule fits a parabola through every three points. With the same nine evaluations as the trapezoids it is a hundred times closer, and each doubling divides its error by sixteen.' },
  { key: 'cubic', stage: 'formula', group: ONE, name: 'Exact with two slices', slice: setupFor('cube', 'simpson', 2),
    notice: 'A parabola is not a cubic, and yet Simpson’s rule gets x³ exactly right with two slices. The parts it overcounts and undercounts cancel. Try any other rule on the same curve.' },
  { key: 'pi', stage: 'formula', group: ONE, name: 'Computing π', slice: setupFor('witch', 'simpson', 8),
    notice: 'The area under 1/(1+x²) from 0 to 1 is arctan 1, a quarter of π. Nine evaluations of a simple fraction give π to seven digits.' },
  { key: 'root', stage: 'formula', group: ONE, name: 'A curve that starts vertical', slice: setupFor('root', 'simpson', 8),
    notice: '√x leaves zero straight upward. No parabola can follow that, so Simpson’s error divides by 2.8 on each doubling, not 16, and the textbook bound promises nothing. The trouble is all in the first slice.' },
  { key: 'periodic', stage: 'formula', group: ONE, name: 'A full wave and plain trapezoids', slice: setupFor('sine-squared', 'trapezoid', 4),
    notice: 'Over a whole period, the simplest rules are exact almost at once: every overshoot on the way up is matched on the way down. For repeating signals nothing fancier is needed. Move an end of the interval and the magic goes.' },

  { key: 'bell', stage: 'none', group: TWO, name: 'The bell curve', open: OPEN,
    notice: 'This is the most used curve in statistics, and its integral has no formula. Nobody can write down an expression whose slope is e^(−x²). Every table of normal probabilities ever printed was made by adding up slices.' },
  { key: 'pendulum', stage: 'none', group: TWO, name: 'A pendulum swung wide', open: setupFor('pendulum', 'trapezoid', 8),
    notice: 'The school formula for a pendulum’s period only holds for tiny swings. For a real swing the period is an integral with no formula. Eight trapezoids give it to twelve digits.' },
  { key: 'ellipse', stage: 'none', group: TWO, name: 'The distance round an ellipse', open: setupFor('ellipse', 'trapezoid', 8),
    notice: 'The area of an ellipse is π times its two half-axes. Its perimeter has no formula at all, which is how “elliptic integrals” got their name. Planetary orbits are computed this way.' },
  { key: 'arc', stage: 'none', group: TWO, name: 'The length of a sine wave', open: setupFor('arc', 'simpson', 8),
    notice: 'How long is one arch of a sine wave? The length of a curve is the integral of √(1 + slope²), and the square root almost always blocks a formula.' },
  { key: 'primes', stage: 'none', group: TWO, name: 'Counting primes', open: setupFor('log', 'simpson', 16),
    notice: 'Around x, roughly one whole number in ln x is prime. So the area under 1/ln x estimates how many primes there are in a range, and this integral has no formula either.' },
  { key: 'fresnel', stage: 'none', group: TWO, name: 'A wave that speeds up', open: setupFor('fresnel', 'simpson', 16),
    notice: 'sin(x²) wiggles faster and faster. Its integral describes light bending past an edge and the easing curve of a motorway exit. Watch how many slices the fast end needs.' },
  { key: 'sinc', stage: 'none', group: TWO, name: 'sin x over x', open: setupFor('sinc', 'simpson', 8),
    notice: 'A fading wave from signal processing. The curve is as tame as any in the first link, and still no combination of ordinary functions has it as a slope.' },

  { key: 'speed-log', stage: 'practice', group: THREE, name: 'Distance from a speed log', situation: 'data', trip: TRIP,
    notice: 'A car logs its speed once a second. There is no function to integrate, only 121 numbers. Joining them with straight lines and adding the trapezoids gives the distance. This is how every trip computer and fitness watch works.' },
  { key: 'noisy', stage: 'practice', group: THREE, name: 'A noisy sensor', situation: 'data', trip: { ...TRIP, noise: 1.5, seed: SEED },
    notice: 'Each reading is now off by about 1.5 m/s, a fifth of the average speed. The total is typically off by only 2%, because errors that are high and low at random mostly cancel when summed. Integration forgives noise.' },
  { key: 'coarse', stage: 'practice', group: THREE, name: 'Logging too rarely', situation: 'data', trip: { interval: INTERVALS.indexOf(20), noise: 0, seed: 1 },
    notice: 'A perfect sensor read every 20 seconds. The hard braking at 70 s falls between readings, and the straight lines sail over it. No rule can recover what was never measured.' },
  { key: 'adaptive', stage: 'practice', group: THREE, name: 'Slices only where needed', situation: 'adaptive', spike: SPIKE,
    notice: 'Almost all of this area is in a narrow spike. Equal slices must be fine everywhere to be fine there. An adaptive rule checks each piece against its two halves and only splits the ones that disagree.' },
  { key: 'missed-spike', stage: 'practice', group: THREE, name: 'Fooled: the spike nobody sampled', situation: 'trap', trap: TRAP,
    notice: 'Eight midpoints all land on the flat part and report a tenth of the true area, with no warning. A numeric rule only knows the curve at the points it tried.' },
  { key: 'blow-up', stage: 'practice', group: THREE, name: 'Fooled: an infinite end', situation: 'trap', trap: setupFor('blow-up', 'midpoint', 16),
    notice: 'The area under 1/√x from 0 to 1 is exactly 2, but the curve is infinite at 0. Rules that use the end point return infinity. Midpoints avoid it and crawl: four times the slices only halves the error.' },
  { key: 'alias', stage: 'practice', group: THREE, name: 'Fooled: in step with the wave', situation: 'trap', trap: setupFor('alias', 'trapezoid', 16),
    notice: 'Sixteen slices across sixteen waves: every sample lands on a crest, and the answer is 2 where the truth is 1. One more or one fewer slice breaks the pattern.' },
];
