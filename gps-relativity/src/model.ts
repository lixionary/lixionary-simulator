/** SI units throughout: metres, seconds, radians. Rates are fractions (seconds gained per second). */

export const GM = 3.986004418e14;
export const C = 299_792_458;
/** Equatorial radius, so that altitudes match the commonly quoted ones. */
export const EARTH_RADIUS = 6_378_137;
/** Potential of the sea-level surface divided by c². Every clock at sea level runs this much slower than one far from Earth. */
export const L_G = 6.969290134e-10;
export const DAY = 86_400;
/** Constant of the orbit-shape correction in the GPS interface specification, in s/√m. */
export const F = -2 * Math.sqrt(GM) / C ** 2;
export const NOMINAL_HZ = 10_230_000;

export interface Orbit { altitudeKm: number; eccentricity: number }
/** Which relativistic effects the system has been engineered to cancel. */
export interface Corrections { gravity: boolean; speed: boolean; orbitShape: boolean }
export interface Satellite { name: string; azimuth: number; elevation: number; phase: number }
export interface Settings { orbit: Orbit; corrections: Corrections; solvesClock: boolean }
export interface Fix { east: number; north: number; up: number; horizontal: number; distance: number; clock: number }

const rad = (degrees: number) => degrees * Math.PI / 180;

/** The frozen sky above the receiver. Phase is where each satellite starts on its own orbit. */
export const SATELLITES: Satellite[] = [
  { name: 'A', azimuth: 320, elevation: 72, phase: 10 },
  { name: 'B', azimuth: 80, elevation: 34, phase: 75 },
  { name: 'C', azimuth: 140, elevation: 19, phase: 140 },
  { name: 'D', azimuth: 200, elevation: 47, phase: 200 },
  { name: 'E', azimuth: 265, elevation: 27, phase: 265 },
  { name: 'F', azimuth: 330, elevation: 14, phase: 320 },
].map(s => ({ ...s, azimuth: rad(s.azimuth), elevation: rad(s.elevation), phase: rad(s.phase) }));

export const semiMajor = (orbit: Orbit) => EARTH_RADIUS + orbit.altitudeKm * 1000;
export const period = (a: number) => 2 * Math.PI * Math.sqrt(a ** 3 / GM);
export const meanSpeed = (a: number) => Math.sqrt(GM / a);

/** Average rate of an orbiting clock against a sea-level clock, split into its two causes. */
export function rates(a: number) {
  const gravity = L_G - GM / (a * C * C), speed = -GM / (2 * a * C * C);
  return { gravity, speed, net: gravity + speed };
}

/** The altitude at which weaker gravity and orbital speed cancel exactly. */
export const BALANCE_ALTITUDE_KM = (1.5 * GM / (C * C * L_G) - EARTH_RADIUS) / 1000;

/** The most oval orbit whose lowest point still clears the atmosphere. */
export function maxEccentricity(altitudeKm: number) {
  const a = EARTH_RADIUS + altitudeKm * 1000;
  return Math.max(0, Math.min(0.05, Math.floor((1 - (EARTH_RADIUS + 200_000) / a) * 1000) / 1000));
}

/** Solves Kepler's equation M = E − e sin E. */
export function eccentricAnomaly(mean: number, e: number) {
  let E = mean;
  for (let i = 0; i < 12; i++) E -= (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
  return E;
}

/** How far an orbiting clock is ahead of its own average, from dipping in and out of the gravity well. */
export function wobble(orbit: Orbit, mean: number) {
  return F * orbit.eccentricity * Math.sqrt(semiMajor(orbit)) * Math.sin(eccentricAnomaly(mean, orbit.eccentricity));
}
export const wobbleAmplitude = (orbit: Orbit) => -F * orbit.eccentricity * Math.sqrt(semiMajor(orbit));

/** Rate the clock is built to run at, as a fraction off nominal, so that it ticks correctly once in orbit. */
export function factoryOffset(orbit: Orbit, corrections: Corrections) {
  const r = rates(semiMajor(orbit));
  return 0 - (corrections.gravity ? r.gravity : 0) - (corrections.speed ? r.speed : 0);
}

/** Seconds a satellite clock is ahead of system time, after the chosen corrections. */
export function clockError({ orbit, corrections }: Settings, satellite: Satellite, t: number) {
  const a = semiMajor(orbit), r = rates(a);
  const drift = (r.net + factoryOffset(orbit, corrections)) * t;
  return drift + (corrections.orbitShape ? 0 : wobble(orbit, satellite.phase + 2 * Math.PI * t / period(a)));
}

/** Satellite positions with the receiver's true position at the origin: east, north, up. */
export function skyPositions(a: number) {
  return SATELLITES.map(s => {
    const range = -EARTH_RADIUS * Math.sin(s.elevation) + Math.sqrt(a * a - (EARTH_RADIUS * Math.cos(s.elevation)) ** 2);
    const flat = range * Math.cos(s.elevation);
    return { range, at: [flat * Math.sin(s.azimuth), flat * Math.cos(s.azimuth), range * Math.sin(s.elevation)] };
  });
}

function solveLinear(m: number[][], v: number[]) {
  const n = v.length, a = m.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let row = col + 1; row < n; row++) {
      const k = a[row][col] / a[col][col];
      for (let j = col; j <= n; j++) a[row][j] -= k * a[col][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) x[row] = (a[row][n] - a[row].slice(row + 1, n).reduce((s, value, j) => s + value * x[row + 1 + j], 0)) / a[row][row];
  return x;
}

/**
 * Where the receiver thinks it is. Each satellite stamps its signal with its own clock, so a clock that is
 * ahead makes the signal look younger and the satellite closer. Least squares over all satellites, for
 * position alone or for position and the receiver's own clock error.
 */
export function solveFix(settings: Settings, t: number): Fix {
  const sky = skyPositions(semiMajor(settings.orbit)), unknowns = settings.solvesClock ? 4 : 3;
  const measured = sky.map((s, i) => s.range - C * clockError(settings, SATELLITES[i], t));
  const p = [0, 0, 0, 0];
  for (let pass = 0; pass < 12; pass++) {
    const normal = Array.from({ length: unknowns }, () => new Array<number>(unknowns).fill(0)), rhs = new Array<number>(unknowns).fill(0);
    sky.forEach((s, i) => {
      const d = [p[0] - s.at[0], p[1] - s.at[1], p[2] - s.at[2]], length = Math.hypot(...d);
      const row = [d[0] / length, d[1] / length, d[2] / length, 1].slice(0, unknowns), miss = measured[i] - length - (settings.solvesClock ? p[3] : 0);
      for (let j = 0; j < unknowns; j++) { rhs[j] += row[j] * miss; for (let k = 0; k < unknowns; k++) normal[j][k] += row[j] * row[k]; }
    });
    const step = solveLinear(normal, rhs);
    step.forEach((value, j) => { p[j] += value; });
    if (Math.hypot(...step) < 1e-6) break;
  }
  const [east, north, up] = p;
  return { east, north, up, horizontal: Math.hypot(east, north), distance: Math.hypot(east, north, up), clock: -p[3] / C };
}

/** The fix at evenly spaced moments from launch to now, for drawing its path. */
export function fixTrail(settings: Settings, t: number, steps = 72) {
  return Array.from({ length: steps + 1 }, (_, i) => solveFix(settings, t * i / steps));
}

/** Satellite position on its ellipse with Earth's centre at the origin, in metres. */
export function orbitPoint(orbit: Orbit, t: number, phase = 0) {
  const a = semiMajor(orbit), e = orbit.eccentricity, E = eccentricAnomaly(phase + 2 * Math.PI * t / period(a), e);
  const x = a * (Math.cos(E) - e), y = a * Math.sqrt(1 - e * e) * Math.sin(E), r = Math.hypot(x, y);
  return { x, y, r, speed: Math.sqrt(GM * (2 / r - 1 / a)) };
}
