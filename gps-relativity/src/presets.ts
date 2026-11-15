import { BALANCE_ALTITUDE_KM, DAY, type Settings } from './model';

export interface Preset { key: string; group: string; name: string; notice: string; settings: Settings; elapsed: number }

export const ORBITS = [
  { key: 'station', name: 'Space station', altitudeKm: 420 },
  { key: 'balance', name: 'Balance point', altitudeKm: BALANCE_ALTITUDE_KM },
  { key: 'gps', name: 'GPS', altitudeKm: 20_184 },
  { key: 'geo', name: 'Geostationary', altitudeKm: 35_786 },
];

const ALL = { gravity: true, speed: true, orbitShape: true }, NONE = { gravity: false, speed: false, orbitShape: true };
const gps = (eccentricity = 0.01) => ({ altitudeKm: 20_184, eccentricity });

export const PRESETS: Preset[] = [
  { key: 'built', group: 'The clocks', name: 'GPS as it flies', elapsed: DAY, settings: { orbit: gps(), corrections: ALL, solvesClock: true },
    notice: 'Every correction is on. A day after the clocks were set they still agree, and the fix sits on the pin. Untick a correction to see what it is for.' },
  { key: 'ignored', group: 'The clocks', name: 'Forget relativity', elapsed: DAY, settings: { orbit: gps(0), corrections: NONE, solvesClock: false },
    notice: 'The clocks tick at exactly 10.23 MHz, as Newton would build them. In orbit they gain 38.6 µs a day, and light covers 11.6 km in that time.' },
  { key: 'speed-only', group: 'The clocks', name: 'Only special relativity', elapsed: DAY, settings: { orbit: gps(0), corrections: { ...NONE, speed: true }, solvesClock: false },
    notice: 'An engineer who knew only that moving clocks run slow would speed the clock up. That makes things worse than doing nothing.' },
  { key: 'fourth', group: 'The receiver', name: 'A fourth satellite', elapsed: DAY, settings: { orbit: gps(0), corrections: NONE, solvesClock: true },
    notice: 'No corrections, but the receiver now solves for its own clock error. Every satellite is wrong by the same amount, so the position survives and the time does not.' },
  { key: 'oval', group: 'The receiver', name: 'The oval orbit', elapsed: DAY, settings: { orbit: gps(0.02), corrections: { ...ALL, orbitShape: false }, solvesClock: true },
    notice: 'On an oval orbit each clock speeds up and slows down once per lap, each at a different moment. No fourth satellite can hide that: the fix circles the pin.' },
  { key: 'station', group: 'Other orbits', name: 'Space station height', elapsed: DAY, settings: { orbit: { altitudeKm: 420, eccentricity: 0 }, corrections: NONE, solvesClock: false },
    notice: 'Close to Earth, gravity is nearly as strong as on the ground and the orbit is fast. Speed wins: this clock runs slow.' },
  { key: 'balance', group: 'Other orbits', name: 'The balance point', elapsed: DAY, settings: { orbit: { altitudeKm: BALANCE_ALTITUDE_KM, eccentricity: 0 }, corrections: NONE, solvesClock: false },
    notice: 'Half an Earth radius up, weaker gravity and orbital speed cancel. A clock here keeps ground time with no correction at all.' },
];
