import { describe, expect, it } from 'vitest';
import { ARCSEC, AU, bendingAtRing, brightness, countImages, crossingTime, deflect, deflectionAngle, einsteinRadius, lightCurve, pointImages, radialImages, ringMass, ringSize, SUN_RADIUS, TRACK, VIEW, type Lens, type Source } from './model';
import { angle, lightYears, span, suns, times, timespan } from './format';
import { PRESETS } from './presets';
import { paint } from './render';

const star = (x: number, y = 0, size = 0.05): Source => ({ kind: 'star', x, y, size });
const point = (massSolar: number, lensLy: number, sourceLy: number): Lens => ({ kind: 'point', massSolar, sigmaKms: 250, shear: 0, lensLy, sourceLy });
const galaxy = (sigmaKms: number, lensLy: number, sourceLy: number): Lens => ({ kind: 'galaxy', massSolar: 1, sigmaKms, shear: 0, lensLy, sourceLy });

describe('how much light bends', () => {
  it('turns starlight grazing the Sun by 1.75 arcseconds', () => {
    expect(deflectionAngle(1, SUN_RADIUS) / ARCSEC).toBeCloseTo(1.75, 2);
    expect(deflectionAngle(2, SUN_RADIUS)).toBeCloseTo(2 * deflectionAngle(1, SUN_RADIUS), 15);
  });
  it('gives the known ring sizes for a star, a galaxy, and a cluster', () => {
    expect(einsteinRadius(point(0.3, 13_000, 26_000)) / ARCSEC * 1000).toBeCloseTo(0.55, 2);
    expect(ringSize(point(0.3, 13_000, 26_000)) / AU).toBeCloseTo(2.21, 2);
    expect(crossingTime(point(0.3, 13_000, 26_000)) / 86_400).toBeCloseTo(19.1, 1);
    expect(einsteinRadius(galaxy(250, 3e9, 7e9)) / ARCSEC).toBeCloseTo(1.03, 2);
    expect(einsteinRadius(galaxy(1000, 4e9, 1e10)) / ARCSEC).toBeCloseTo(17.3, 1);
  });
  it('weighs a compact lens exactly from its ring, and bends by 4GM/c²b there', () => {
    const lens = point(7, 5_000, 20_000);
    expect(ringMass(lens)).toBeCloseTo(7, 9);
    expect(bendingAtRing(lens)).toBeCloseTo(deflectionAngle(7, ringSize(lens)), 15);
    expect(einsteinRadius(point(28, 5_000, 20_000)) / einsteinRadius(lens)).toBeCloseTo(2, 9);
  });
  it('bends equally at every distance from a galaxy, and falls off from a star', () => {
    expect(Math.hypot(...deflect('galaxy', 0, 0.3, 0.4))).toBeCloseTo(1, 12); expect(Math.hypot(...deflect('galaxy', 0, 3, 4))).toBeCloseTo(1, 12);
    expect(Math.hypot(...deflect('point', 0, 0, 2))).toBeCloseTo(0.5, 12);
    expect(deflect('galaxy', 0.1, 2, 0)).toEqual([1.2, 0]); expect(deflect('point', 0, 0, 0)).toEqual([0, 0]);
  });
});

describe('images', () => {
  it('places a compact lens’s two images by the lens equation', () => {
    const p = pointImages(1);
    for (const image of [p.outer, p.inner]) expect(image - 1 / image).toBeCloseTo(1, 12);
    expect(p.total).toBeCloseTo(3 / Math.sqrt(5), 12); expect(p.outerGain - p.innerGain).toBeCloseTo(1, 12);
    expect(radialImages('point', 1)).toEqual([p.outer, p.inner]);
    expect(radialImages('galaxy', 0.4)).toEqual([1.4, -0.6]); expect(radialImages('galaxy', 1.5)).toEqual([2.5]);
  });
  it('counts two images, one image, a ring, and a cross', () => {
    expect(countImages('point', 0, star(0.6))).toEqual({ count: 2, ring: false });
    expect(countImages('galaxy', 0, star(0.5))).toEqual({ count: 2, ring: false });
    expect(countImages('galaxy', 0, star(1.6))).toEqual({ count: 1, ring: false });
    expect(countImages('galaxy', 0, star(0, 0, 0.1))).toEqual({ count: 1, ring: true });
    expect(countImages('point', 0, star(0, 0, 0.1))).toEqual({ count: 1, ring: true });
    expect(countImages('galaxy', 0.14, star(0.04, 0.03))).toEqual({ count: 4, ring: false });
  });
});

describe('brightness', () => {
  it('matches the textbook curve for a small star behind a compact lens', () => {
    for (const u of [0.5, 1, 2]) expect(brightness('point', 0, star(u, 0, 0.03)) / pointImages(u).total).toBeCloseTo(1, 1.7);
    expect(brightness('point', 0, star(1, 0, 0.03))).toBeCloseTo(1.342, 1);
  });
  it('matches 2/β inside a galaxy’s ring and 1 + 1/β outside', () => {
    expect(brightness('galaxy', 0, star(0.5, 0, 0.03))).toBeCloseTo(4, 0);
    expect(brightness('galaxy', 0, star(2, 0, 0.03))).toBeCloseTo(1.5, 1);
  });
  it('peaks at the closest pass, is symmetric, and returns to normal far away', () => {
    const xs = Array.from({ length: 23 }, (_, i) => -TRACK + i * 0.2), gains = lightCurve('point', 0, 0.05, 0.2, xs);
    expect(Math.max(...gains)).toBe(gains[11]); expect(gains[11]).toBeGreaterThan(5); expect(gains[11]).toBeLessThan(5.5);
    expect(gains[3]).toBeCloseTo(gains[19], 2); expect(gains[0]).toBeLessThan(1.1); expect(gains[0]).toBeGreaterThan(1);
  });
  it('grows as the pass gets closer', () => {
    expect(lightCurve('point', 0, 0.05, 0.1, [0])[0]).toBeGreaterThan(lightCurve('point', 0, 0.05, 0.4, [0])[0]);
  });
});

describe('the picture', () => {
  const lit = (pixels: Uint8ClampedArray, n: number, x: number, y: number) => { const i = Math.floor((x + VIEW) / (2 * VIEW) * n), j = Math.floor((VIEW - y) / (2 * VIEW) * n); return pixels[(j * n + i) * 4]; };
  it('shows the star where it is with no lens, and at the image positions through one', () => {
    const n = 200, source = star(0.6, 0, 0.06), p = pointImages(0.6);
    const plain = paint('point', 0, source, false, false, n), lensed = paint('point', 0, source, true, false, n);
    expect(lit(plain, n, 0.6, 0)).toBeGreaterThan(200); expect(lit(plain, n, p.outer, 0)).toBeLessThan(40);
    expect(lit(lensed, n, p.outer, 0)).toBeGreaterThan(200); expect(lit(lensed, n, p.inner, 0)).toBeGreaterThan(200); expect(lit(lensed, n, 0, 2)).toBeLessThan(40);
    expect(lensed).toHaveLength(n * n * 4);
  });
  it('draws a ring when everything lines up', () => {
    const n = 200, lensed = paint('galaxy', 0, star(0, 0, 0.1), true, false, n);
    for (const [x, y] of [[1, 0], [0, 1], [-0.7, -0.7]]) expect(lit(lensed, n, x, y)).toBeGreaterThan(200);
    expect(lit(lensed, n, 2, 0)).toBeLessThan(40);
  });
  it('builds every preset', () => {
    expect(new Set(PRESETS.map(p => p.key)).size).toBe(PRESETS.length);
    for (const p of PRESETS) { expect(einsteinRadius(p.lens)).toBeGreaterThan(0); expect(p.lens.sourceLy).toBeGreaterThan(p.lens.lensLy); expect(Math.abs(p.source.x)).toBeLessThanOrEqual(TRACK); }
  });
});

describe('formatting', () => {
  it('picks readable units', () => {
    expect(angle(1.03 * ARCSEC)).toBe('1.03″'); expect(angle(0.00055 * ARCSEC)).toBe('0.55 mas'); expect(angle(96 * ARCSEC)).toBe('1.6′'); expect(angle(2e-6 * ARCSEC)).toBe('2.00 µas');
    expect(suns(0.3)).toBe('0.30 Suns'); expect(suns(0.001)).toBe('1.0 Jupiters'); expect(suns(2.1e11)).toBe('210 billion Suns'); expect(suns(7)).toBe('7.00 Suns');
    expect(lightYears(13_000)).toBe('13,000 light-years'); expect(lightYears(3e9)).toBe('3.0 billion light-years');
    expect(span(2.21 * AU)).toBe('2.21 AU'); expect(span(5e8)).toBe('500,000 km');
    expect(timespan(19.1 * 86_400)).toBe('19.1 days'); expect(timespan(7200)).toBe('2.0 hours'); expect(timespan(22.5e6 * 365.25 * 86_400)).toBe('22.5 million years');
    expect(times(5.014)).toBe('5.01×'); expect(times(12.46)).toBe('12.5×');
  });
});
