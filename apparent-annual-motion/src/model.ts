// Approximate geocentric solar coordinates: US Naval Observatory, sun_approx.
// UTC noon samples; all exported angles are degrees, all times are local solar hours.
export const YEAR = 2026;
export const DAYS = 365;
export const EARTH_TILT = 23.44;
export const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const JAN_1 = Date.UTC(YEAR, 0, 1, 12);
const J2000 = Date.UTC(2000, 0, 1, 12);
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const normalize = (degrees: number) => (degrees % 360 + 360) % 360;

export function dateForDay(day: number) { return new Date(JAN_1 + clamp(Math.round(day), 0, DAYS - 1) * DAY_MS); }
export function dayForDate(value: string) {
  if (!/^2026-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  const day = Math.round((timestamp - JAN_1) / DAY_MS);
  return day >= 0 && day < DAYS && dateForDay(day).toISOString().slice(0, 10) === value ? day : null;
}
export function dateValue(day: number) { return dateForDay(day).toISOString().slice(0, 10); }
export function dateLabel(day: number) { return dateForDay(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }); }
export function coordinates(day: number, tilt = EARTH_TILT) {
  const elapsed = (dateForDay(day).getTime() - J2000) / DAY_MS;
  const anomaly = normalize(357.529 + 0.98560028 * elapsed) * RAD;
  const meanLongitude = normalize(280.459 + 0.98564736 * elapsed);
  const longitude = normalize(meanLongitude + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly));
  const declination = Math.asin(Math.sin(tilt * RAD) * Math.sin(longitude * RAD)) / RAD;
  const rightAscension = normalize(Math.atan2(Math.cos(tilt * RAD) * Math.sin(longitude * RAD), Math.cos(longitude * RAD)) / RAD);
  return { longitude, declination, rightAscension, meanLongitude };
}
export function altitude(latitude: number, declination: number, solarHour: number) {
  const phi = latitude * RAD, delta = declination * RAD, hourAngle = (solarHour - 12) * 15 * RAD;
  return Math.asin(clamp(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle), -1, 1)) / RAD;
}
export function daylight(latitude: number, declination: number) {
  const phi = latitude * RAD, delta = declination * RAD;
  const constant = Math.sin(phi) * Math.sin(delta), amplitude = Math.cos(phi) * Math.cos(delta);
  // At a geographic pole the Sun's altitude is constant throughout a solar day.
  if (Math.abs(amplitude) < 1e-12) {
    if (Math.abs(constant) < 1e-12) return { hours: 0, sunrise: null, sunset: null, state: 'horizon' as const };
    return { hours: constant > 0 ? 24 : 0, sunrise: null, sunset: null, state: constant > 0 ? 'polar-day' as const : 'polar-night' as const };
  }
  const crossing = -constant / amplitude;
  if (crossing <= -1) return { hours: 24, sunrise: null, sunset: null, state: 'polar-day' as const };
  if (crossing >= 1) return { hours: 0, sunrise: null, sunset: null, state: 'polar-night' as const };
  const halfDay = Math.acos(crossing) / RAD / 15;
  return { hours: halfDay * 2, sunrise: 12 - halfDay, sunset: 12 + halfDay, state: 'normal' as const };
}
export function duration(hours: number) {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
export function nightDuration(dayHours: number) {
  const minutes = 1440 - Math.round(dayHours * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
export function timeLabel(hours: number | null) {
  if (hours === null) return '—';
  const minutes = Math.round(hours * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function longitudeLabel(longitude: number) { return `${Math.abs(longitude).toFixed(1)}°${longitude > 0 ? ' E' : longitude < 0 ? ' W' : ''}`; }
export function latitudeLabel(latitude: number) { return `${Math.abs(latitude).toFixed(1)}°${latitude > 0 ? ' N' : latitude < 0 ? ' S' : ''}`; }
export const EVENTS = [
  { day: 78, title: 'March equinox', short: 'Mar equinox', longitude: 0 },
  { day: 171, title: 'June solstice', short: 'Jun solstice', longitude: 90 },
  { day: 265, title: 'September equinox', short: 'Sep equinox', longitude: 180 },
  { day: 354, title: 'December solstice', short: 'Dec solstice', longitude: 270 },
];

// Apparent minus mean solar time, in minutes. Always uses Earth's real tilt.
export function equationOfTime(day: number) {
  const { meanLongitude, rightAscension } = coordinates(day, EARTH_TILT);
  return (((meanLongitude - rightAscension + 540) % 360) - 180) * 4;
}
const wrapDay = (hours: number) => (hours % 24 + 24) % 24;
// Civil clock hour for a local apparent solar hour at an east-positive longitude.
export function clockHour(solarHour: number, longitude: number, day: number, utcOffsetHours: number) {
  return wrapDay(solarHour - longitude / 15 - equationOfTime(day) / 60 + utcOffsetHours);
}
export function solarHourFromUtc(utcHour: number, longitude: number, day: number) {
  return wrapDay(utcHour + longitude / 15 + equationOfTime(day) / 60);
}
// Maps a real calendar date (device-local) onto the fixed 2026 calendar.
export function todayAsDay(date: Date) {
  const month = date.getMonth(), dayOfMonth = month === 1 ? Math.min(date.getDate(), 28) : date.getDate();
  return Math.round((Date.UTC(YEAR, month, dayOfMonth, 12) - JAN_1) / DAY_MS);
}
export function utcOffsetHours(day: number) {
  const date = dateForDay(day);
  return -new Date(YEAR, date.getUTCMonth(), date.getUTCDate(), 12).getTimezoneOffset() / 60;
}
export function offsetLabel(offset: number) {
  const minutes = Math.round(Math.abs(offset) * 60);
  return `UTC${offset < 0 ? '−' : '+'}${Math.floor(minutes / 60)}${minutes % 60 ? `:${String(minutes % 60).padStart(2, '0')}` : ''}`;
}
export type Zone = 'tropical' | 'temperate' | 'polar';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
// Below this tilt the yearly swing is too small to call four seasons.
export const MIN_SEASON_TILT = 5;
export function climateZone(latitude: number, tilt = EARTH_TILT): Zone {
  const absolute = Math.abs(latitude);
  return absolute <= tilt ? 'tropical' : absolute >= 90 - tilt ? 'polar' : 'temperate';
}
// Astronomical season from the Sun's ecliptic longitude; null where four seasons do not apply.
export function season(latitude: number, solarLongitude: number, tilt = EARTH_TILT): Season | null {
  if (tilt < MIN_SEASON_TILT || climateZone(latitude, tilt) === 'tropical') return null;
  // Longitudes are UTC-noon samples; half a day of motion (~0.5°) makes the day an
  // equinox or solstice falls on count as the first day of the new season.
  const quadrant = Math.floor(normalize(solarLongitude + .5 + (latitude < 0 ? 180 : 0)) / 90) % 4;
  return (['spring', 'summer', 'autumn', 'winter'] as const)[quadrant];
}
