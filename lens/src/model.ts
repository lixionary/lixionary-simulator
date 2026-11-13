// Lens Lab engine: exact 2D (meridional) ray tracing through spherical surfaces, plus the
// paraxial "textbook" prediction. Lengths are millimetres, light travels toward +x, and a
// positive curvature means the centre of the sphere lies to the right of the surface.

export type GlassKey = 'crown' | 'denseCrown' | 'flint' | 'ideal';
export const GLASSES: Record<GlassKey, { name: string; nd: number; abbe: number }> = {
  crown: { name: 'Crown glass', nd: 1.5168, abbe: 64.17 },
  denseCrown: { name: 'Dense crown glass', nd: 1.62041, abbe: 60.32 },
  flint: { name: 'Flint glass', nd: 1.62004, abbe: 36.37 },
  ideal: { name: 'Ideal glass (no colour spread)', nd: 1.5, abbe: Infinity },
};
export const COLORS = [
  { key: 'blue', label: 'Blue', nm: 486.1, stroke: '#4d7fc0' },
  { key: 'green', label: 'Green', nm: 587.6, stroke: '#5c8a4c' },
  { key: 'red', label: 'Red', nm: 656.3, stroke: '#c65a48' },
] as const;
export type ColorKey = typeof COLORS[number]['key'];
export const GREEN = 587.6;
const BLUE = 486.1, RED = 656.3;
export const NEAR_POINT = 250;
/** Rays that would only meet farther away than this count as parallel. */
export const BENCH_LIMIT = 1500;

export type Element = { id: number; x: number; c1: number; c2: number; thickness: number; semi: number; glass: GlassKey };
export type Stop = { x: number; radius: number };
export type System = { elements: Element[]; stop: Stop | null; sensorX: number | null };
export type Source = { kind: 'point'; x: number; height: number } | { kind: 'parallel'; angle: number };
export type Surface = { x: number; c: number; semi: number; n1: number; n2: number; kind: 'lens' | 'stop' };
export type Point = { x: number; y: number };
export type Ray = { x: number; y: number; dx: number; dy: number };
export type TraceStatus = 'through' | 'blocked' | 'stopped' | 'reflected';
export type Trace = { points: Point[]; end: Ray; status: TraceStatus };
export type FanRay = Trace & { pupil: number };
export type Sample = { color: ColorKey; pupil: number; a: number; b: number };

export const LIMITS = { curvature: 0.15, thickness: [0.5, 30], semi: [1, 40], minEdge: 0.2 } as const;

/** Refractive index from a two-term Cauchy fit through the glass's index and Abbe number. */
export function indexAt(glass: GlassKey, nm: number): number {
  const { nd, abbe } = GLASSES[glass];
  if (!Number.isFinite(abbe)) return nd;
  const spread = (nd - 1) / abbe / (1 / BLUE ** 2 - 1 / RED ** 2);
  return nd + spread * (1 / nm ** 2 - 1 / GREEN ** 2);
}

/** Depth of a spherical surface at height y, measured from its vertex. */
export function sag(c: number, y: number): number {
  const root = 1 - c * c * y * y;
  return root <= 0 ? NaN : c * y * y / (1 + Math.sqrt(root));
}

export const edgeThickness = (e: Element) => e.thickness + sag(e.c2, e.semi) - sag(e.c1, e.semi);
export const sorted = (system: System) => [...system.elements].sort((p, q) => p.x - q.x);
export const cemented = (before: Element, after: Element) => Math.abs(before.x + before.thickness - after.x) < 1e-6 && Math.abs(before.c2 - after.c1) < 1e-9;

/** Thick-lens (lensmaker's) focal length of one element in air. */
export function elementFocal(e: Element, nm = GREEN): number {
  const n = indexAt(e.glass, nm);
  const power = (n - 1) * (e.c1 - e.c2 + (n - 1) * e.thickness * e.c1 * e.c2 / n);
  return Math.abs(power) < 1e-12 ? Infinity : 1 / power;
}

export function describe(e: Element): string {
  const flat = (c: number) => Math.abs(c) < 1e-6, f = elementFocal(e);
  const front = flat(e.c1) ? 0 : Math.sign(e.c1), back = flat(e.c2) ? 0 : -Math.sign(e.c2);
  if (front >= 0 && back >= 0 && front + back > 0) return front && back ? 'Biconvex' : 'Plano-convex';
  if (front <= 0 && back <= 0 && front + back < 0) return front && back ? 'Biconcave' : 'Plano-concave';
  if (!front && !back) return 'Flat window';
  return f > 0 ? 'Convex meniscus' : 'Concave meniscus';
}

/** Returns why the system cannot be built, or null when it can. */
export function validate(system: System, source?: Source): string | null {
  const elements = sorted(system);
  if (!elements.length) return 'The bench needs at least one lens.';
  for (const e of elements) {
    if (![e.x, e.c1, e.c2, e.thickness, e.semi].every(Number.isFinite)) return 'Every lens setting must be a number.';
    if (Math.abs(e.c1) > LIMITS.curvature || Math.abs(e.c2) > LIMITS.curvature) return 'That surface is curved too tightly.';
    if (e.thickness < LIMITS.thickness[0] || e.thickness > LIMITS.thickness[1]) return 'Lens thickness is out of range.';
    if (e.semi < LIMITS.semi[0] || e.semi > LIMITS.semi[1]) return 'Lens diameter is out of range.';
    if (Math.max(Math.abs(e.c1), Math.abs(e.c2)) * e.semi > 0.95) return 'That lens is too wide for its curvature. Flatten it or make it smaller.';
    if (edgeThickness(e) < LIMITS.minEdge) return 'The lens edges would meet. Make it thicker, flatter, or smaller.';
    if (e.thickness < LIMITS.minEdge) return 'The lens is too thin at its centre.';
  }
  for (let i = 1; i < elements.length; i++) {
    const p = elements[i - 1], q = elements[i], h = Math.min(p.semi, q.semi);
    const gap = (y: number) => q.x + sag(q.c1, y) - (p.x + p.thickness + sag(p.c2, y));
    if (gap(0) < -1e-6 || gap(h) < -1e-6) return 'Two lenses would overlap. Move them apart.';
  }
  if (system.stop) {
    const { x, radius } = system.stop;
    if (!(radius >= 0.2 && radius <= 40) || !Number.isFinite(x)) return 'The aperture opening is out of range.';
    for (const e of elements) {
      const lo = e.x + Math.min(0, sag(e.c1, e.semi)), hi = e.x + e.thickness + Math.max(0, sag(e.c2, e.semi));
      if (x > lo - 0.05 && x < hi + 0.05) return 'The aperture cannot sit inside a lens.';
    }
  }
  if (source?.kind === 'point' && !(source.x < elements[0].x + Math.min(0, sag(elements[0].c1, elements[0].semi)) - 1 && Number.isFinite(source.height))) return 'The object must stay in front of the first lens.';
  if (source?.kind === 'parallel' && !(Math.abs(source.angle) <= 30)) return 'That light arrives too steeply.';
  if (system.sensorX !== null && system.sensorX < elements[elements.length - 1].x + elements[elements.length - 1].thickness + 0.5) return 'The sensor must stay behind the last lens.';
  return null;
}

/** Flattens the system into the ordered surfaces a ray meets. Touching, matching faces are cemented. */
export function surfacesOf(system: System, nm = GREEN): Surface[] {
  const surfaces: Surface[] = [], elements = sorted(system);
  elements.forEach((e, i) => {
    const n = indexAt(e.glass, nm), previous = elements[i - 1];
    if (previous && cemented(previous, e)) { const joint = surfaces[surfaces.length - 1]; joint.n2 = n; joint.semi = Math.min(joint.semi, e.semi); }
    else surfaces.push({ x: e.x, c: e.c1, semi: e.semi, n1: 1, n2: n, kind: 'lens' });
    surfaces.push({ x: e.x + e.thickness, c: e.c2, semi: e.semi, n1: n, n2: 1, kind: 'lens' });
  });
  if (system.stop) {
    const stop: Surface = { x: system.stop.x, c: 0, semi: system.stop.radius, n1: 1, n2: 1, kind: 'stop' };
    const at = surfaces.findIndex(s => s.x > stop.x);
    surfaces.splice(at < 0 ? surfaces.length : at, 0, stop);
  }
  return surfaces;
}

/** Follows one ray through every surface with Snell's law. */
export function traceRay(surfaces: Surface[], start: Ray): Trace {
  const length = Math.hypot(start.dx, start.dy);
  let ray: Ray = { x: start.x, y: start.y, dx: start.dx / length, dy: start.dy / length };
  const points: Point[] = [{ x: ray.x, y: ray.y }];
  for (const s of surfaces) {
    const px = ray.x - s.x, py = ray.y;
    const B = ray.dx - s.c * (px * ray.dx + py * ray.dy), C = s.c * (px * px + py * py) - 2 * px;
    const disc = B * B - s.c * C;
    // The root on the vertex side of the sphere, written to avoid cancellation whichever way B points.
    const t = disc < 0 ? NaN : B >= 0 ? C / (B + Math.sqrt(disc)) : (B - Math.sqrt(disc)) / s.c;
    if (!(t > -1e-9) || !Number.isFinite(t)) return { points, end: ray, status: 'blocked' };
    const x = ray.x + t * ray.dx, y = ray.y + t * ray.dy;
    points.push({ x, y });
    ray = { ...ray, x, y };
    if (Math.abs(y) > s.semi) return { points, end: ray, status: s.kind === 'stop' ? 'stopped' : 'blocked' };
    if (s.n1 === s.n2) continue;
    const nx = 1 - s.c * (x - s.x), ny = -s.c * y;
    const cosIn = ray.dx * nx + ray.dy * ny, mu = s.n1 / s.n2;
    const sinOut2 = mu * mu * (1 - cosIn * cosIn);
    if (sinOut2 > 1) return { points, end: ray, status: 'reflected' };
    const k = Math.sqrt(1 - sinOut2) - mu * cosIn;
    ray = { x, y, dx: mu * ray.dx + k * nx, dy: mu * ray.dy + k * ny };
    if (ray.dx <= 1e-9) return { points, end: ray, status: 'reflected' };
  }
  return { points, end: ray, status: 'through' };
}

function startRay(source: Source, aimX: number, aimY: number, xStart: number): Ray {
  if (source.kind === 'point') return { x: source.x, y: source.height, dx: aimX - source.x, dy: aimY - source.height };
  const slope = Math.tan(source.angle * Math.PI / 180);
  return { x: xStart, y: aimY - slope * (aimX - xStart), dx: 1, dy: slope };
}

/**
 * A fan of `count` rays filling the part of the first lens that actually reaches the far side,
 * plus the evenly spaced rays that are cut off on the way (for drawing).
 */
export function fan(system: System, source: Source, nm: number, count: number, xStart?: number): { rays: FanRay[]; cut: Trace[] } {
  const surfaces = surfacesOf(system, nm), first = surfaces[0];
  const from = xStart ?? first.x - 50, reach = first.semi * 1.25, SCAN = 240;
  const shoot = (h: number) => traceRay(surfaces, startRay(source, first.x, h, from));
  let best: [number, number] | null = null, run: [number, number] | null = null;
  for (let i = 0; i <= SCAN; i++) {
    const h = -reach + 2 * reach * i / SCAN;
    if (shoot(h).status === 'through') { run = run ? [run[0], h] : [h, h]; if (!best || run[1] - run[0] > best[1] - best[0]) best = run; }
    else run = null;
  }
  const cut: Trace[] = [];
  for (let i = 0; i < count; i++) {
    const trace = shoot(first.semi * 0.98 * (count === 1 ? 0 : 2 * i / (count - 1) - 1));
    if (trace.status !== 'through' && trace.points.length > 1) cut.push(trace);
  }
  if (!best) return { rays: [], cut };
  const mid = (best[0] + best[1]) / 2, half = (best[1] - best[0]) / 2 * 0.995;
  const rays = Array.from({ length: count }, (_, i) => {
    const pupil = count === 1 ? 0 : 2 * i / (count - 1) - 1;
    return { ...shoot(mid + half * pupil), pupil };
  }).filter(ray => ray.status === 'through');
  return { rays, cut };
}

/** Each surviving ray as the line y = a + b·x it follows after the last lens. */
export function samples(system: System, source: Source, colors: readonly ColorKey[], perColor = 41): Sample[] {
  return colors.flatMap(color => fan(system, source, COLORS.find(c => c.key === color)!.nm, perColor).rays
    .map(ray => { const b = ray.end.dy / ray.end.dx; return { color, pupil: ray.pupil, a: ray.end.y - b * ray.end.x, b }; }));
}

/** Root-mean-square spread of where the rays land on a screen at x. */
export function blurAt(rays: Sample[], x: number): number {
  if (rays.length < 2) return NaN;
  const ys = rays.map(r => r.a + r.b * x), mean = ys.reduce((s, y) => s + y, 0) / ys.length;
  return Math.sqrt(ys.reduce((s, y) => s + (y - mean) ** 2, 0) / ys.length);
}

/** Screen position with the smallest blur, or null when the rays never come together behind `after`. */
export function bestFocus(rays: Sample[], after: number): number | null {
  if (rays.length < 2) return null;
  const n = rays.length, ma = rays.reduce((s, r) => s + r.a, 0) / n, mb = rays.reduce((s, r) => s + r.b, 0) / n;
  let cov = 0, variance = 0;
  for (const r of rays) { cov += (r.a - ma) * (r.b - mb); variance += (r.b - mb) ** 2; }
  if (variance / n < 1e-14) return null;
  const x = -cov / variance;
  return x > after && x < after + BENCH_LIMIT ? x : null;
}

type Matrix = { a: number; b: number; c: number; d: number; first: number; last: number; pupil: number };
function matrix(surfaces: Surface[]): Matrix {
  const run = (y: number, u: number, heights?: number[]) => {
    surfaces.forEach((s, i) => {
      if (i) y += u * (s.x - surfaces[i - 1].x);
      heights?.push(Math.abs(y) / s.semi);
      u = (s.n1 * u - y * s.c * (s.n2 - s.n1)) / s.n2;
    });
    return [y, u];
  };
  const fill: number[] = [], [a, c] = run(1, 0, fill), [b, d] = run(0, 1);
  return { a, b, c, d, first: surfaces[0].x, last: surfaces[surfaces.length - 1].x, pupil: 1 / Math.max(...fill) };
}

export type Paraxial = { focal: number; backFocus: number; frontFocal: number; rearFocal: number; frontPrincipal: number; rearPrincipal: number; pupilRadius: number; fNumber: number; lastX: number; firstX: number };
/** Textbook (small-angle) properties: focal length, focal points, principal planes, and f-number. */
export function paraxial(system: System, nm = GREEN): Paraxial {
  const m = matrix(surfacesOf(system, nm)), afocal = Math.abs(m.c) < 1e-9;
  const focal = afocal ? Infinity : -1 / m.c, rearFocal = afocal ? Infinity : m.last - m.a / m.c, frontFocal = afocal ? -Infinity : m.first + m.d / m.c;
  return { focal, backFocus: rearFocal - m.last, frontFocal, rearFocal, frontPrincipal: frontFocal + focal, rearPrincipal: rearFocal - focal, pupilRadius: m.pupil, fNumber: Math.abs(focal) / (2 * m.pupil), firstX: m.first, lastX: m.last };
}

export type Image = { kind: 'real' | 'virtual' | 'infinity'; x: number; height: number; magnification: number; angular: number };
/** Where the textbook says the image forms. `angular` is the magnifying power of a parallel exit beam versus the naked eye at 250 mm. */
export function imageOf(system: System, source: Source, nm = GREEN): Image {
  const m = matrix(surfacesOf(system, nm));
  if (source.kind === 'parallel') {
    if (Math.abs(m.c) < 1e-9) return { kind: 'infinity', x: Infinity, height: NaN, magnification: NaN, angular: 1 / m.a };
    const z = -m.a / m.c;
    return { kind: z > 0 ? 'real' : 'virtual', x: m.last + z, height: -Math.tan(source.angle * Math.PI / 180) / m.c, magnification: NaN, angular: NaN };
  }
  const s = m.first - source.x, bend = m.c * s + m.d;
  if (Math.abs(bend) < 2e-4) return { kind: 'infinity', x: Infinity, height: NaN, magnification: NaN, angular: NEAR_POINT * m.c };
  const z = -(m.a * s + m.b) / bend, magnification = m.a + z * m.c;
  return { kind: z > 0 ? 'real' : 'virtual', x: m.last + z, height: magnification * source.height, magnification, angular: NaN };
}

/** How far the blue focus sits from the red one along the axis (negative: blue focuses first). */
export function colorShift(system: System, source: Source): number {
  const on: Source = source.kind === 'point' ? { ...source, height: 0 } : { kind: 'parallel', angle: 0 };
  const blue = imageOf(system, on, BLUE), green = imageOf(system, on), red = imageOf(system, on, RED);
  return [blue, green, red].some(image => image.kind === 'infinity' || Math.abs(image.x) > BENCH_LIMIT) ? NaN : blue.x - red.x;
}

/** How far the outermost green ray crosses the axis from the textbook focus (negative: edge rays focus first). */
export function sphericalShift(system: System, source: Source): number {
  const on: Source = source.kind === 'point' ? { ...source, height: 0 } : { kind: 'parallel', angle: 0 };
  const image = imageOf(system, on), edge = fan(system, on, GREEN, 3).rays.find(r => r.pupil === 1);
  if (image.kind === 'infinity' || Math.abs(image.x) > BENCH_LIMIT || !edge || Math.abs(edge.end.dy) < 1e-12) return NaN;
  return edge.end.x - edge.end.y * edge.end.dx / edge.end.dy - image.x;
}

/** One crown-glass biconvex lens with the same focal length and opening, for comparison with a stack. */
export function equivalentSinglet(focal: number, pupilRadius: number): System | null {
  if (!(focal > 0) || !(pupilRadius > 0)) return null;
  let c = 1 / (2 * focal * (indexAt('crown', GREEN) - 1));
  for (let i = 0; i < 6; i++) {
    if (c * pupilRadius > 0.9) return null;
    const lens: Element = { id: 0, x: 0, c1: c, c2: -c, thickness: 2 * sag(c, pupilRadius) + 0.5, semi: pupilRadius, glass: 'crown' };
    const actual = elementFocal(lens);
    if (Math.abs(actual - focal) < 1e-9) return { elements: [lens], stop: null, sensorX: null };
    c *= actual / focal;
  }
  return null;
}
