import { describe, expect, it } from 'vitest';
import { altitude, coordinates, dateLabel, dateValue, dayForDate, daylight, DAYS, EARTH_TILT } from './model';

describe('solar-coordinate reference checks', () => {
  it('places the 2026 equinoxes at the celestial equator and solstices at the tilt extremes', () => {
    // Calendar dates independently published by NASA; the model samples UTC noon.
    expect(Math.abs(coordinates(78).declination)).toBeLessThan(.5);
    expect(coordinates(171).declination).toBeCloseTo(EARTH_TILT, 1);
    expect(Math.abs(coordinates(265).declination)).toBeLessThan(.5);
    expect(coordinates(354).declination).toBeCloseTo(-EARTH_TILT, 1);
    expect(coordinates(78).longitude).toBeGreaterThan(359);
    expect(coordinates(171).rightAscension).toBeCloseTo(90, 0);
  });
  it('keeps the Sun on the celestial equator without axial tilt', () => {
    for (let day = 0; day < DAYS; day++) {
      expect(coordinates(day, 0).declination).toBeCloseTo(0, 12);
      expect(coordinates(day, 30).declination).toBeGreaterThanOrEqual(-30);
      expect(coordinates(day, 30).declination).toBeLessThanOrEqual(30);
    }
  });
});

describe('independent spherical geometry cases', () => {
  it('puts the equinox Sun overhead at equatorial noon and on the horizon at 6 and 18', () => {
    expect(altitude(0, 0, 12)).toBeCloseTo(90, 10);
    expect(altitude(0, 0, 6)).toBeCloseTo(0, 10);
    expect(altitude(0, 0, 18)).toBeCloseTo(0, 10);
    expect(altitude(0, 0, 0)).toBeCloseTo(-90, 10);
    expect(altitude(40, 0, 12)).toBeCloseTo(50, 10);
  });
  it('has 12 hours of daylight at equinox and at the equator all year', () => {
    for (const lat of [-89, -60, 0, 40, 89]) expect(daylight(lat, 0).hours).toBeCloseTo(12, 10);
    for (const dec of [-EARTH_TILT, 0, EARTH_TILT]) expect(daylight(0, dec)).toMatchObject({ hours: 12, sunrise: 6, sunset: 18 });
  });
  it('has complementary daylight in opposite hemispheres and matches horizon crossings', () => {
    for (const dec of [-EARTH_TILT, -10, 0, 10, EARTH_TILT]) {
      for (const lat of [20, 40, 65, 80]) {
        const north = daylight(lat, dec), south = daylight(-lat, dec);
        expect(north.hours + south.hours).toBeCloseTo(24, 10);
        if (north.sunrise !== null && north.sunset !== null) {
          expect(altitude(lat, dec, north.sunrise)).toBeCloseTo(0, 8);
          expect(altitude(lat, dec, north.sunset)).toBeCloseTo(0, 8);
          expect(north.sunset - north.sunrise).toBeCloseTo(north.hours, 10);
        }
      }
    }
  });
  it('distinguishes polar day, polar night, and a Sun fixed on the horizon', () => {
    expect(daylight(80, EARTH_TILT)).toMatchObject({ hours: 24, state: 'polar-day', sunrise: null, sunset: null });
    expect(daylight(80, -EARTH_TILT)).toMatchObject({ hours: 0, state: 'polar-night' });
    expect(daylight(-90, -EARTH_TILT)).toMatchObject({ hours: 24, state: 'polar-day' });
    expect(daylight(90, 0)).toMatchObject({ hours: 0, state: 'horizon' });
    expect(altitude(90, EARTH_TILT, 0)).toBeCloseTo(EARTH_TILT, 10);
    expect(altitude(90, EARTH_TILT, 12)).toBeCloseTo(EARTH_TILT, 10);
  });
  it('keeps all full-year outputs finite, bounded, and physically ordered', () => {
    for (const tilt of [0, EARTH_TILT, 30]) for (let day = 0; day < DAYS; day++) {
      const { declination } = coordinates(day, tilt);
      for (const lat of [-90, -89.9, -66.56, 0, 40, 66.56, 89.9, 90]) {
        const result = daylight(lat, declination);
        expect(result.hours).toBeGreaterThanOrEqual(0);
        expect(result.hours).toBeLessThanOrEqual(24);
        const noon = altitude(lat, declination, 12);
        expect(Number.isFinite(noon)).toBe(true);
        expect(noon).toBeCloseTo(90 - Math.abs(lat - declination), 5);
        if (result.sunrise !== null) expect(result.sunrise).toBeLessThanOrEqual(12);
        if (result.sunset !== null) expect(result.sunset).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

describe('calendar boundaries', () => {
  it('rejects invalid and out-of-year dates and round-trips every calendar day', () => {
    for (const value of ['', '2025-12-31', '2027-01-01', '2026-02-29', '2026-02-30', '2026-13-01']) expect(dayForDate(value)).toBeNull();
    for (let day = 0; day < DAYS; day++) expect(dayForDate(dateValue(day))).toBe(day);
    expect(dateLabel(0)).toBe('1 January');
    expect(dateLabel(364)).toBe('31 December');
  });
});
