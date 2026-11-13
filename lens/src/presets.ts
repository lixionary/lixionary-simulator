import { bestFocus, COLORS, imageOf, paraxial, samples, type ColorKey, type Element, type Source, type System } from './model';

export type Bench = { system: System; source: Source; white: boolean };
export type Preset = { key: string; name: string; group: string; notice: string; build: () => Bench };

export const ALL_COLORS: ColorKey[] = COLORS.map(c => c.key);
export const colorsFor = (white: boolean): ColorKey[] => white ? ALL_COLORS : ['green'];
type Shape = Omit<Element, 'id'>;
const withIds = (shapes: Shape[]): Element[] => shapes.map((shape, i) => ({ ...shape, id: i + 1 }));

/** Crown + flint cemented pair, about 100 mm focal length at scale 1, corrected for parallel light arriving on the crown side. */
function achromat(x: number, scale: number, semi: number, reversed = false): Shape[] {
  const c = [0.0208, -0.022525, -0.002542].map(v => v / scale), crown = 6 * scale, flint = 2.5 * scale;
  return reversed
    ? [{ x, c1: -c[2], c2: -c[1], thickness: flint, semi, glass: 'flint' }, { x: x + flint, c1: -c[1], c2: -c[0], thickness: crown, semi, glass: 'crown' }]
    : [{ x, c1: c[0], c2: c[1], thickness: crown, semi, glass: 'crown' }, { x: x + crown, c1: c[1], c2: c[2], thickness: flint, semi, glass: 'flint' }];
}

/** Puts the sensor where the real rays are tightest, or removes it when they never come together. */
export function focused(bench: Bench): Bench {
  return { ...bench, system: { ...bench.system, sensorX: sharpestFocus(bench) } };
}
export function sharpestFocus({ system, source, white }: Bench): number | null {
  if (imageOf(system, source).kind === 'infinity') return null;
  return bestFocus(samples(system, source, colorsFor(white)), paraxial(system).lastX + 0.5);
}

const convex: Shape = { x: 0, c1: 0.01, c2: -0.01, thickness: 6, semi: 15, glass: 'crown' };
const fast: Shape = { x: 0, c1: 0.02, c2: -0.02, thickness: 12, semi: 22, glass: 'crown' };

function microscope(): Bench {
  const objective = achromat(0, 0.2, 2.5, true);
  const lone: System = { elements: withIds(objective), stop: null, sensorX: null };
  const p = paraxial(lone), source: Source = { kind: 'point', x: p.frontPrincipal - 1.125 * p.focal, height: 0.25 };
  const intermediate = imageOf(lone, source).x;
  const eyepiece = achromat(0, 0.25, 3.5, true);
  const shift = intermediate - paraxial({ elements: withIds(eyepiece), stop: null, sensorX: null }).frontFocal;
  return { system: { elements: withIds([...objective, ...eyepiece.map(e => ({ ...e, x: e.x + shift }))]), stop: null, sensorX: null }, source, white: true };
}

function triplet(): Bench {
  const elements = withIds([
    { x: 0, c1: 1 / 22.01359, c2: -1 / 435.76044, thickness: 3.25896, semi: 9, glass: 'denseCrown' },
    { x: 9.26651, c1: -1 / 22.21328, c2: 1 / 20.29192, thickness: 0.99997, semi: 6.5, glass: 'flint' },
    { x: 15.01689, c1: 1 / 79.6836, c2: -1 / 18.39533, thickness: 2.95208, semi: 8, glass: 'denseCrown' },
  ]);
  return focused({ system: { elements, stop: { x: 12.5, radius: 4.2 }, sensorX: null }, source: { kind: 'parallel', angle: 0 }, white: true });
}

export const PRESETS: Preset[] = [
  { key: 'convex', name: 'Convex lens', group: 'One lens', notice: 'Thicker in the middle, so it bends rays together into a real, upside-down image. Slide the object closer than the focal point F and the image turns virtual and magnified.',
    build: () => focused({ system: { elements: withIds([convex]), stop: null, sensorX: null }, source: { kind: 'point', x: -200, height: 14 }, white: false }) },
  { key: 'concave', name: 'Concave lens', group: 'One lens', notice: 'Thinner in the middle, so it spreads rays apart. Trace them backward (dashed) and they seem to come from a small, upright, virtual image.',
    build: () => ({ system: { elements: withIds([{ x: 0, c1: -0.01, c2: 0.01, thickness: 3, semi: 15, glass: 'crown' }]), stop: null, sensorX: null }, source: { kind: 'point', x: -200, height: 14 }, white: false }) },
  { key: 'flaws', name: 'A wide lens in white light', group: 'Why one lens is not enough', notice: 'Edge rays cross the axis before central rays (spherical aberration) and blue focuses before red (chromatic aberration). No sensor position gives a sharp point.',
    build: () => focused({ system: { elements: withIds([fast]), stop: null, sensorX: null }, source: { kind: 'parallel', angle: 0 }, white: true }) },
  { key: 'stopped', name: 'The same lens, stopped down', group: 'Why one lens is not enough', notice: 'A small aperture keeps only the well-behaved central rays. The spot is much sharper, but most of the light is thrown away and the colours still split.',
    build: () => focused({ system: { elements: withIds([fast]), stop: { x: -6, radius: 6 }, sensorX: null }, source: { kind: 'parallel', angle: 0 }, white: true }) },
  { key: 'doublet', name: 'Achromatic doublet', group: 'Stacking lenses', notice: 'A strong convex crown lens glued to a weak concave flint lens. The flint undoes the crown’s colour spread and edge error, but only half of its focusing power.',
    build: () => focused({ system: { elements: withIds(achromat(0, 1, 14)), stop: null, sensorX: null }, source: { kind: 'parallel', angle: 0 }, white: true }) },
  { key: 'camera', name: 'Camera lens (Cooke triplet)', group: 'Stacking lenses', notice: 'Convex, concave, convex with an aperture between. Three lenses give enough freedom to stay sharp in every colour and at an angle. Tilt the incoming light to test it.', build: triplet },
  { key: 'microscope', name: 'Compound microscope', group: 'Stacking lenses', notice: 'The objective throws a magnified real image into the tube. The eyepiece sits one focal length behind it and hands the eye parallel rays, magnifying a second time.', build: microscope },
];
