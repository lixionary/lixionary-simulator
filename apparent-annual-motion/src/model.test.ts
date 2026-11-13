import { describe, expect, it } from 'vitest';
import { altitude, climateZone, clockHour, coordinates, dateLabel, dateValue, dayForDate, daylight, DAYS, EARTH_TILT, equationOfTime, offsetLabel, season, solarHourFromUtc, todayAsDay } from './model';

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

describe('clock time and the equation of time', () => {
  it('matches the published yearly extremes of the equation of time', () => {
    // Almanac values: about −14.2 min on 11 Feb and +16.4 min on 3 Nov.
    expect(equationOfTime(dayForDate('2026-02-11')!)).toBeCloseTo(-14.2, 0);
    expect(equationOfTime(dayForDate('2026-11-03')!)).toBeCloseTo(16.4, 0);
    for (let day = 0; day < DAYS; day++) expect(Math.abs(equationOfTime(day))).toBeLessThan(17);
  });
  it('converts solar noon to clock time and round-trips through UTC', () => {
    // Greenwich in early November: the Sun runs ~16 min fast, so solar noon is ~11:44 UTC.
    expect(clockHour(12, 0, dayForDate('2026-11-03')!, 0)).toBeCloseTo(12 - 16.4 / 60, 1);
    // Jakarta (106.8° E, UTC+7) on 13 Nov: solar noon near 11:37 local.
    expect(clockHour(12, 106.8, dayForDate('2026-11-13')!, 7)).toBeCloseTo(11.62, 1);
    for (const day of [0, 100, 250, 364]) for (const longitude of [-157.8, 0, 106.8, 179]) for (const utc of [0, 7.5, 23.9]) {
      expect(clockHour(solarHourFromUtc(utc, longitude, day), longitude, day, 0)).toBeCloseTo(utc, 9);
    }
  });
  it('maps real dates onto the 2026 calendar and labels offsets', () => {
    expect(todayAsDay(new Date(2026, 10, 13, 9))).toBe(dayForDate('2026-11-13'));
    expect(todayAsDay(new Date(2028, 1, 29, 23))).toBe(dayForDate('2026-02-28'));
    expect(todayAsDay(new Date(2031, 11, 31, 1))).toBe(364);
    expect([offsetLabel(7), offsetLabel(-3.5), offsetLabel(0)]).toEqual(['UTC+7', 'UTC−3:30', 'UTC+0']);
  });
});

describe('climate zones and seasons', () => {
  it('splits latitudes at the tropics and polar circles', () => {
    expect([climateZone(-6.2), climateZone(23.44), climateZone(40), climateZone(-51.5), climateZone(69.7), climateZone(-90)]).toEqual(['tropical', 'tropical', 'temperate', 'temperate', 'polar', 'polar']);
  });
  it('names opposite seasons in opposite hemispheres and none in the tropics or without tilt', () => {
    const at = (date: string) => coordinates(dayForDate(date)!).longitude;
    expect([season(40, at('2026-04-15')), season(40, at('2026-07-15')), season(40, at('2026-10-15')), season(40, at('2026-01-15'))]).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect([season(-33.9, at('2026-04-15')), season(-33.9, at('2026-07-15')), season(-33.9, at('2026-10-15')), season(-33.9, at('2026-01-15'))]).toEqual(['autumn', 'winter', 'spring', 'summer']);
    // Each event day starts its new season, even when the instant falls after the noon sample.
    expect([season(40, at('2026-03-20')), season(40, at('2026-06-21')), season(40, at('2026-09-23')), season(69.7, at('2026-12-21'))]).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect([season(40, at('2026-03-19')), season(40, at('2026-12-20'))]).toEqual(['winter', 'autumn']);
    expect(season(-6.2, at('2026-07-15'))).toBeNull();
    expect(season(40, at('2026-07-15'), 0)).toBeNull();
  });
});
