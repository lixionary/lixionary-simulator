// Pure geometry for the 3D scene. Right-handed, Y up; the ecliptic is the XZ plane
// and the Sun sits at the origin. Angles in degrees, vectors as [x, y, z].
import { RAD } from './model';

export type Vec3 = [number, number, number];
export const ORBIT_RADIUS = 10;

// Unit vector from Earth toward the Sun for a geocentric solar longitude.
export function sunDirection(solarLongitude: number): Vec3 {
  const lambda = solarLongitude * RAD;
  return [Math.cos(lambda), 0, -Math.sin(lambda)];
}
// Earth sits opposite the Sun's apparent direction and revolves counterclockwise seen from the north.
export function earthPosition(solarLongitude: number, radius = ORBIT_RADIUS): Vec3 {
  const [x, , z] = sunDirection(solarLongitude);
  return [-x * radius, 0, -z * radius];
}
// The north pole keeps this direction all year; it leans sunward at the June solstice.
export function axisDirection(tilt: number): Vec3 { return [0, Math.cos(tilt * RAD), -Math.sin(tilt * RAD)]; }
export function rightAscension(solarLongitude: number, tilt: number) {
  const lambda = solarLongitude * RAD;
  return Math.atan2(Math.cos(tilt * RAD) * Math.sin(lambda), Math.cos(lambda)) / RAD;
}
// Rotation about Earth's axis that puts the observer's meridian at the given local solar hour.
export function spinAngle(solarLongitude: number, tilt: number, solarHour: number, observerLongitude: number) {
  return rightAscension(solarLongitude, tilt) + (solarHour - 12) * 15 - observerLongitude;
}
// A surface point in the globe's own frame, matching three.js SphereGeometry with an equirectangular map.
export function surfacePoint(latitude: number, longitude: number): Vec3 {
  const phi = latitude * RAD, lon = longitude * RAD;
  return [Math.cos(phi) * Math.cos(lon), Math.sin(phi), -Math.cos(phi) * Math.sin(lon)];
}
// World-space surface normal after the spin (about Y) and then the tilt (about X by −tilt).
export function observerNormal(latitude: number, longitude: number, spin: number, tilt: number): Vec3 {
  const [x, y, z] = surfacePoint(latitude, longitude), s = spin * RAD, t = -tilt * RAD;
  const sx = x * Math.cos(s) + z * Math.sin(s), sz = -x * Math.sin(s) + z * Math.cos(s);
  return [sx, y * Math.cos(t) - sz * Math.sin(t), y * Math.sin(t) + sz * Math.cos(t)];
}
