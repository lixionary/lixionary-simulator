import { describe, expect, it } from 'vitest';
import { bestFocus, blurAt, colorShift, describe as shape, elementFocal, equivalentSinglet, fan, GREEN, imageOf, indexAt, NEAR_POINT, paraxial, samples, sphericalShift, surfacesOf, traceRay, validate, type Element, type Source, type System } from './model';
import { ALL_COLORS, colorsFor, PRESETS } from './presets';

const lens = (patch: Partial<Element> = {}): Element => ({ id: 1, x: 0, c1: 0.01, c2: -0.01, thickness: 4, semi: 12, glass: 'ideal', ...patch });
const bench = (...elements: Element[]): System => ({ elements, stop: null, sensorX: null });
const preset = (key: string) => PRESETS.find(p => p.key === key)!.build();
const far: Source = { kind: 'parallel', angle: 0 };
const sharpestBlur = (system: System, source: Source, colors = ALL_COLORS) => { const rays = samples(system, source, colors); return blurAt(rays, bestFocus(rays, paraxial(system).lastX)!); };

describe('glass and refraction', () => {
  it('bends blue more than red, except in ideal glass', () => {
    expect(indexAt('crown', GREEN)).toBeCloseTo(1.5168, 6);
    expect(indexAt('flint', 486.1)).toBeGreaterThan(indexAt('flint', 656.3));
    expect((indexAt('crown', GREEN) - 1) / (indexAt('crown', 486.1) - indexAt('crown', 656.3))).toBeCloseTo(64.17, 6);
    expect(indexAt('ideal', 486.1)).toBe(indexAt('ideal', 656.3));
  });
  it('obeys Snell’s law at a flat surface', () => {
    const angle = 30 * Math.PI / 180;
    const { end, status } = traceRay([{ x: 0, c: 0, semi: 50, n1: 1, n2: 1.5, kind: 'lens' }], { x: -10, y: 0, dx: Math.cos(angle), dy: Math.sin(angle) });
    expect(status).toBe('through');
    expect(1.5 * end.dy).toBeCloseTo(Math.sin(angle), 12);
  });
  it('reflects totally when leaving glass too steeply', () => {
    const angle = 45 * Math.PI / 180;
    expect(traceRay([{ x: 0, c: 0, semi: 50, n1: 1.5, n2: 1, kind: 'lens' }], { x: -10, y: 0, dx: Math.cos(angle), dy: Math.sin(angle) }).status).toBe('reflected');
  });
  it('stops rays at a lens rim and at the aperture', () => {
    const system: System = { ...bench(lens()), stop: { x: -5, radius: 3 } }, surfaces = surfacesOf(system);
    expect(traceRay(surfaces, { x: -50, y: 5, dx: 1, dy: 0 }).status).toBe('stopped');
    expect(traceRay(surfaces, { x: -50, y: 2, dx: 1, dy: 0 }).status).toBe('through');
    expect(traceRay(surfacesOf(bench(lens())), { x: -50, y: 13, dx: 1, dy: 0 }).status).toBe('blocked');
  });
  it('finds the near face of a concave surface from any distance', () => {
    const system = bench(lens({ c1: -0.01, c2: 0.01 }));
    for (const x of [-50, -200, -900]) expect(fan(system, { kind: 'point', x, height: 0 }, GREEN, 5).rays).toHaveLength(5);
  });
});

describe('one lens', () => {
  it('names shapes', () => {
    expect(shape(lens())).toBe('Biconvex');
    expect(shape(lens({ c2: 0 }))).toBe('Plano-convex');
    expect(shape(lens({ c1: -0.01, c2: 0.01 }))).toBe('Biconcave');
    expect(shape(lens({ c1: 0.02, c2: 0.01 }))).toBe('Convex meniscus');
  });
  it('focuses near-axis rays at the lensmaker’s focal length', () => {
    for (const element of [lens(), lens({ c1: -0.01, c2: 0.01 }), lens({ c1: 0.02, c2: 0.005, glass: 'flint' })]) {
      const system = bench(element), p = paraxial(system), ray = traceRay(surfacesOf(system), { x: -50, y: 0.01, dx: 1, dy: 0 }).end;
      expect(p.focal).toBeCloseTo(elementFocal(element), 9);
      expect(ray.x - ray.y * ray.dx / ray.dy).toBeCloseTo(p.rearFocal, 3);
    }
    expect(paraxial(bench(lens())).focal).toBeGreaterThan(0);
    expect(paraxial(bench(lens({ c1: -0.01, c2: 0.01 }))).focal).toBeLessThan(0);
  });
  it('follows 1/s + 1/s′ = 1/f for real and virtual images', () => {
    const system = bench(lens()), p = paraxial(system);
    for (const x of [-250, -150, -60]) {
      const image = imageOf(system, { kind: 'point', x, height: 5 }), s = p.frontPrincipal - x, s2 = image.x - p.rearPrincipal;
      expect(1 / s + 1 / s2).toBeCloseTo(1 / p.focal, 10);
      expect(image.magnification).toBeCloseTo(-s2 / s, 10);
      expect(image.kind).toBe(s > p.focal ? 'real' : 'virtual');
    }
    const concave = imageOf(bench(lens({ c1: -0.01, c2: 0.01 })), { kind: 'point', x: -200, height: 5 });
    expect(concave.kind).toBe('virtual');
    expect(concave.magnification).toBeGreaterThan(0);
    expect(concave.magnification).toBeLessThan(1);
  });
  it('sends light from the focal point out parallel', () => {
    const system = bench(lens()), image = imageOf(system, { kind: 'point', x: paraxial(system).frontFocal, height: 1 });
    expect(image.kind).toBe('infinity');
    expect(Math.abs(image.angular)).toBeCloseTo(NEAR_POINT / paraxial(system).focal, 6);
  });
  it('scales the image of distant light with focal length', () => {
    const system = bench(lens());
    expect(imageOf(system, { kind: 'parallel', angle: 5 }).height).toBeCloseTo(paraxial(system).focal * Math.tan(5 * Math.PI / 180), 9);
  });
  it('shows spherical and chromatic aberration', () => {
    const { system, source } = preset('flaws');
    expect(sphericalShift(system, source)).toBeLessThan(-5);
    expect(colorShift(system, source)).toBeLessThan(-0.5);
    expect(colorShift(bench(lens()), far)).toBe(0);
    expect(sharpestBlur(preset('stopped').system, far)).toBeLessThan(sharpestBlur(system, far) / 20);
    expect(paraxial(preset('stopped').system).fNumber).toBeGreaterThan(3 * paraxial(system).fNumber);
  });
});

describe('stacks', () => {
  it('combines two lenses as 1/f = 1/f1 + 1/f2 − d/(f1·f2)', () => {
    const thin = { thickness: 0.5, c1: 0.004, c2: -0.004 }, a = lens(thin), b = lens({ ...thin, id: 2, x: 40, c1: -0.002, c2: 0.003 });
    const pa = paraxial(bench(a)), pb = paraxial(bench(b)), d = pb.frontPrincipal - pa.rearPrincipal;
    expect(1 / paraxial(bench(a, b)).focal).toBeCloseTo(1 / pa.focal + 1 / pb.focal - d / (pa.focal * pb.focal), 10);
  });
  it('cements touching faces into one surface', () => {
    expect(surfacesOf(preset('doublet').system)).toHaveLength(3);
    expect(surfacesOf(preset('camera').system)).toHaveLength(7);
  });
  it('rejects systems that cannot be built', () => {
    expect(validate(bench(lens()))).toBeNull();
    expect(validate(bench())).toMatch(/at least one/);
    expect(validate(bench(lens({ thickness: 1, semi: 20 })))).toMatch(/edges/);
    expect(validate(bench(lens({ c1: 0.1, semi: 12 })))).toMatch(/too wide/);
    expect(validate(bench(lens(), lens({ id: 2, x: 2 })))).toMatch(/overlap/);
    expect(validate({ ...bench(lens()), stop: { x: 2, radius: 3 } })).toMatch(/inside/);
    expect(validate({ ...bench(lens()), sensorX: 1 })).toMatch(/sensor/);
    expect(validate(bench(lens()), { kind: 'point', x: 3, height: 0 })).toMatch(/object/);
  });
  it('builds every preset, and each one passes light', () => {
    for (const p of PRESETS) {
      const { system, source, white } = p.build();
      expect(validate(system, source), p.key).toBeNull();
      expect(samples(system, source, colorsFor(white)).length, p.key).toBeGreaterThan(30);
    }
  });
  it('corrects colour and edge rays with a doublet', () => {
    const { system } = preset('doublet'), p = paraxial(system), single = equivalentSinglet(p.focal, p.pupilRadius)!;
    expect(paraxial(single).focal).toBeCloseTo(p.focal, 6);
    expect(Math.abs(colorShift(system, far))).toBeLessThan(Math.abs(colorShift(single, far)) / 5);
    expect(Math.abs(sphericalShift(system, far))).toBeLessThan(Math.abs(sphericalShift(single, far)) / 10);
    expect(sharpestBlur(system, far)).toBeLessThan(sharpestBlur(single, far) / 10);
  });
  it('keeps the camera triplet sharp on and off axis', () => {
    const { system } = preset('camera'), p = paraxial(system), single = equivalentSinglet(p.focal, p.pupilRadius)!;
    expect(p.focal).toBeCloseTo(50, 0);
    expect(p.fNumber).toBeGreaterThan(4);
    expect(p.fNumber).toBeLessThan(5.5);
    for (const angle of [0, 10, 18]) expect(sharpestBlur(system, { kind: 'parallel', angle }), `${angle}°`).toBeLessThan(sharpestBlur(single, { kind: 'parallel', angle }) / 4);
    expect(sharpestBlur(system, far)).toBeLessThan(0.01);
  });
  it('makes an afocal telescope that magnifies by the ratio of focal lengths', () => {
    const { system, source } = preset('telescope'), image = imageOf(system, source);
    const objective: System = { ...system, elements: system.elements.slice(0, 2) }, eyepiece: System = { ...system, elements: system.elements.slice(2) };
    expect(image.kind).toBe('infinity');
    expect(paraxial(system).focal).toBe(Infinity);
    expect(image.angular).toBeCloseTo(-paraxial(objective).focal / paraxial(eyepiece).focal, 6);
    expect(Math.abs(image.angular)).toBeCloseTo(8, 0);
    expect(imageOf(objective, source).kind).toBe('real');
    const slopes = samples(system, source, ['green']).map(r => r.b), mean = slopes.reduce((s, b) => s + b, 0) / slopes.length;
    expect(Math.max(...slopes) - Math.min(...slopes)).toBeLessThan(0.01);
    expect(mean).toBeCloseTo(image.angular * Math.tan(0.5 * Math.PI / 180), 2);
  });
  it('makes a microscope from two stages', () => {
    const { system, source } = preset('microscope'), image = imageOf(system, source);
    const objective: System = { ...system, elements: system.elements.slice(0, 2) }, eyepiece: System = { ...system, elements: system.elements.slice(2) };
    const stage = imageOf(objective, source);
    expect(stage.kind).toBe('real');
    expect(image.kind).toBe('infinity');
    expect(Math.abs(image.angular)).toBeCloseTo(Math.abs(stage.magnification) * NEAR_POINT / paraxial(eyepiece).focal, 3);
    expect(Math.abs(image.angular)).toBeGreaterThan(50);
    const slopes = samples(system, source, ['green']).map(r => r.b);
    expect(Math.max(...slopes) - Math.min(...slopes)).toBeLessThan(0.02);
  });
});
