import { deflect, VIEW, type LensKind, type Source } from './model';

/** A small repeatable random generator, so the background field is the same every time. */
function seeded(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TINTS = [[255, 226, 178], [176, 206, 255], [255, 196, 168], [210, 226, 255], [255, 240, 214]];
/** Background galaxies around the chosen one: offset, size, flattening, tilt, and colour. */
const FIELD = (() => {
  const random = seeded(7), items = [{ x: 0, y: 0, size: 1, squash: 0.7, cos: 1, sin: 0, tint: TINTS[0] }];
  for (let i = 0; i < 44; i++) { const tilt = random() * Math.PI; items.push({ x: random() * 6.4 - 3.2, y: random() * 6.4 - 3.2, size: 0.45 + random() * 0.8, squash: 0.45 + random() * 0.5, cos: Math.cos(tilt), sin: Math.sin(tilt), tint: TINTS[Math.floor(random() * TINTS.length)] }); }
  return items;
})();

/** Adds the light the background sends from one true position into a red, green, blue triple. */
function shine(source: Source, x: number, y: number, out: number[]) {
  const dx = x - source.x, dy = y - source.y, s = source.size;
  if (source.kind === 'star') {
    const d2 = dx * dx + dy * dy;
    if (d2 < 30 * s * s) { const core = Math.exp(-d2 / (2 * s * s)), glow = 0.25 * Math.exp(-d2 / (10 * s * s)); out[0] += 255 * core + 190 * glow; out[1] += 240 * core + 200 * glow; out[2] += 205 * core + 255 * glow; }
  } else if (source.kind === 'galaxy') {
    const d = Math.hypot(dx, dy) / s;
    if (d < 5) {
      const core = Math.exp(-d * d * 3), arms = Math.exp(-d * 1.1) * (0.35 + 0.65 * Math.cos(Math.atan2(dy, dx) - 2.6 * Math.log(d + 0.25)) ** 2);
      out[0] += 255 * core + 120 * arms; out[1] += 214 * core + 165 * arms; out[2] += 150 * core + 255 * arms;
    }
  } else for (const g of FIELD) {
    const gx = dx - g.x, gy = dy - g.y, size = g.size * s;
    if (Math.abs(gx) > 3.2 * size || Math.abs(gy) > 3.2 * size) continue;
    const u = (gx * g.cos + gy * g.sin) / size, v = (gy * g.cos - gx * g.sin) / (size * g.squash), glow = Math.exp(-(u * u + v * v) / 2);
    out[0] += g.tint[0] * glow; out[1] += g.tint[1] * glow; out[2] += g.tint[2] * glow;
  }
}

/** Paints the sky as RGBA pixels, north up: either the true background or the same background seen through the lens. */
export function paint(kind: LensKind, shear: number, source: Source, lensed: boolean, showLens: boolean, n: number) {
  const pixels = new Uint8ClampedArray(n * n * 4), step = 2 * VIEW / n, rgb = [0, 0, 0];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -VIEW + (i + 0.5) * step, y = VIEW - (j + 0.5) * step, r2 = x * x + y * y;
    rgb[0] = 11; rgb[1] = 14; rgb[2] = 28;
    if (lensed) { const [ax, ay] = deflect(kind, shear, x, y); shine(source, x - ax, y - ay, rgb); } else shine(source, x, y, rgb);
    if (showLens) {
      const glow = kind === 'galaxy' ? 0.85 * Math.exp(-r2 / 0.09) + 0.2 * Math.exp(-r2 / 0.6) : Math.exp(-r2 / 0.004);
      rgb[0] += 255 * glow; rgb[1] += (kind === 'galaxy' ? 206 : 150) * glow; rgb[2] += (kind === 'galaxy' ? 128 : 110) * glow;
    }
    const at = (j * n + i) * 4;
    pixels[at] = rgb[0]; pixels[at + 1] = rgb[1]; pixels[at + 2] = rgb[2]; pixels[at + 3] = 255;
  }
  return pixels;
}
