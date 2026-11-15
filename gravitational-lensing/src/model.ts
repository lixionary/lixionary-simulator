/** SI units for physical quantities. On the sky, positions are in units of the Einstein ring radius. */

export const C = 299_792_458;
export const GM_SUN = 1.32712440018e20;
export const LIGHT_YEAR = 9.4607304725808e15;
export const AU = 1.495978707e11;
export const SUN_RADIUS = 6.957e8;
export const ARCSEC = Math.PI / 648_000;
/** Typical sideways speed of things in a galaxy, used to turn a ring size into a duration. */
export const DRIFT_SPEED = 200_000;
/** Half-width of the drawn sky, and how far along its path the source can be. */
export const VIEW = 2.8, TRACK = 2.2;

export type LensKind = 'point' | 'galaxy';
/** A compact mass (star, planet, black hole) or an isothermal galaxy described by how fast its stars move. */
export interface Lens { kind: LensKind; massSolar: number; sigmaKms: number; shear: number; lensLy: number; sourceLy: number }
export type SourceKind = 'star' | 'galaxy' | 'field';
export interface Source { kind: SourceKind; x: number; y: number; size: number }

/** Angle by which light passing a mass at a given distance is turned, in radians. Twice Newton's value. */
export const deflectionAngle = (massSolar: number, impact: number) => 4 * GM_SUN * massSolar / (C * C * impact);

/** Fraction of the way from lens to source, D_LS / D_S, with plain Euclidean distances. */
const leverage = (lens: Lens) => (lens.sourceLy - lens.lensLy) / lens.sourceLy;

/** Radius of the Einstein ring on the sky, in radians. */
export function einsteinRadius(lens: Lens) {
  if (lens.kind === 'galaxy') return 4 * Math.PI * (lens.sigmaKms * 1000 / C) ** 2 * leverage(lens);
  return Math.sqrt(4 * GM_SUN * lens.massSolar / (C * C) * leverage(lens) / (lens.lensLy * LIGHT_YEAR));
}
/** Radius of the ring measured at the lens, in metres. */
export const ringSize = (lens: Lens) => einsteinRadius(lens) * lens.lensLy * LIGHT_YEAR;
/** How far light passing at the ring is turned, in radians. */
export const bendingAtRing = (lens: Lens) => einsteinRadius(lens) / leverage(lens);
/** The mass that a ring of this size implies, in solar masses. For a compact lens it is the whole mass. */
export const ringMass = (lens: Lens) => bendingAtRing(lens) * ringSize(lens) * C * C / (4 * GM_SUN);
/** Seconds for the source to drift across one ring radius. */
export const crossingTime = (lens: Lens) => ringSize(lens) / DRIFT_SPEED;

/** Deflection at a sky position, in ring units. Shear stands for the pull of uneven surroundings. */
export function deflect(kind: LensKind, shear: number, x: number, y: number): [number, number] {
  const r2 = x * x + y * y;
  if (r2 < 1e-12) return [0, 0];
  const k = kind === 'point' ? 1 / r2 : 1 / Math.sqrt(r2);
  return [x * k + shear * x, y * k - shear * y];
}

/** The two images a compact lens makes of a point at distance u from it, and how bright each is. */
export function pointImages(u: number) {
  const root = Math.sqrt(u * u + 4), total = (u * u + 2) / (u * root);
  return { outer: (u + root) / 2, inner: (u - root) / 2, outerGain: total / 2 + 0.5, innerGain: total / 2 - 0.5, total };
}

/** Where a round lens puts the images along the line through lens and source. Positive is the source's side. */
export function radialImages(kind: LensKind, offset: number) {
  if (kind === 'point') { const p = pointImages(Math.max(offset, 1e-9)); return [p.outer, p.inner]; }
  return offset < 1 ? [offset + 1, offset - 1] : [offset + 1];
}

/**
 * Total brightness of a round, soft-edged source at each position along a horizontal path, against no lens.
 * Rays are shot backward from a fine grid on the sky; lensing keeps surface brightness, so the gain is the
 * ratio of areas.
 */
export function lightCurve(kind: LensKind, shear: number, size: number, y0: number, xs: number[], n = 560, half = 4) {
  const sums = new Array<number>(xs.length).fill(0), step = 2 * half / n, reach = 4 * size, k = -1 / (2 * size * size);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -half + (i + 0.5) * step, y = half - (j + 0.5) * step, [ax, ay] = deflect(kind, shear, x, y);
    const dy = y - ay - y0;
    if (Math.abs(dy) > reach) continue;
    const bx = x - ax;
    for (let s = 0; s < xs.length; s++) { const dx = bx - xs[s]; if (Math.abs(dx) < reach) sums[s] += Math.exp((dx * dx + dy * dy) * k); }
  }
  const alone = 2 * Math.PI * size * size / (step * step);
  return sums.map(sum => sum / alone);
}
export const brightness = (kind: LensKind, shear: number, source: Source) => lightCurve(kind, shear, source.size, source.y, [source.x])[0];

/** Counts the separate bright patches the source is turned into, and whether they have joined into a ring. */
export function countImages(kind: LensKind, shear: number, source: Source, n = 320) {
  const step = 2 * VIEW / n, limit = 2.41 * source.size * source.size, lit = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -VIEW + (i + 0.5) * step, y = VIEW - (j + 0.5) * step, [ax, ay] = deflect(kind, shear, x, y);
    if ((x - ax - source.x) ** 2 + (y - ay - source.y) ** 2 < limit) lit[j * n + i] = 1;
  }
  let count = 0, ring = false;
  for (let start = 0; start < n * n; start++) {
    if (lit[start] !== 1) continue;
    count++;
    const stack = [start], corners = new Set<number>();
    lit[start] = 2;
    while (stack.length) {
      const at = stack.pop()!, i = at % n, j = (at - i) / n;
      corners.add((i < n / 2 ? 0 : 1) + (j < n / 2 ? 0 : 2));
      for (const next of [i > 0 ? at - 1 : -1, i < n - 1 ? at + 1 : -1, j > 0 ? at - n : -1, j < n - 1 ? at + n : -1]) if (next >= 0 && lit[next] === 1) { lit[next] = 2; stack.push(next); }
    }
    if (corners.size === 4) ring = true;
  }
  return { count, ring: ring && count === 1 };
}
