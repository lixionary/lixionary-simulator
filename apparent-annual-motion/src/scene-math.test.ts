import { describe, expect, it } from 'vitest';
import { altitude, coordinates, DAYS, EARTH_TILT, RAD } from './model';
import { axisDirection, earthPosition, observerNormal, ORBIT_RADIUS, spinAngle, sunDirection } from './scene-math';

const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('3D scene geometry agrees with the solar model', () => {
  it('tilts the north pole toward the Sun by exactly the declination', () => {
    for (const tilt of [0, EARTH_TILT, 30]) for (let day = 0; day < DAYS; day += 7) {
      const sun = coordinates(day, tilt);
      expect(Math.asin(dot(axisDirection(tilt), sunDirection(sun.longitude))) / RAD).toBeCloseTo(sun.declination, 9);
    }
  });
  it('lights the observer exactly as the altitude formula predicts', () => {
    for (const tilt of [0, EARTH_TILT, 30]) for (let day = 0; day < DAYS; day += 13) {
      const sun = coordinates(day, tilt);
      for (const latitude of [-90, -66.5, -6.2, 0, 40, 69.7, 90]) for (const longitude of [-120, 0, 106.8]) for (const hour of [0, 5.5, 12, 18.25]) {
        const normal = observerNormal(latitude, longitude, spinAngle(sun.longitude, tilt, hour, longitude), tilt);
        expect(dot(normal, sunDirection(sun.longitude))).toBeCloseTo(Math.sin(altitude(latitude, sun.declination, hour) * RAD), 9);
      }
    }
  });
  it('keeps Earth on the orbit, opposite the apparent Sun, moving counterclockwise from the north', () => {
    const march = earthPosition(0), june = earthPosition(90);
    expect(Math.hypot(...march)).toBeCloseTo(ORBIT_RADIUS, 12);
    expect(dot(march, sunDirection(0))).toBeCloseTo(-ORBIT_RADIUS, 12);
    // Counterclockwise about +Y: (march × june).y is positive.
    expect(march[2] * june[0] - march[0] * june[2]).toBeGreaterThan(0);
  });
});
