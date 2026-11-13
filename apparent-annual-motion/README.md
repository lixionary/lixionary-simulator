# Apparent Annual Motion of the Sun — Sun Lab

An interactive astronomy simulator at `/apparent-annual-motion/`. Run the shared commands in the [repository root](../README.md).

Follow Earth’s orbit in a 3D scene you can rotate and zoom, or switch to an unwrapped celestial map to see the Sun’s apparent eastward annual motion against the stars. Change the date, observer latitude, or axial tilt; connected views show declination, solar altitude, day and night length, sunrise, sunset, and the season at your latitude. Playback advances the date and wraps through the fixed 2026 calendar. Manual date changes pause playback.

The four event shortcuts use the 2026 calendar dates: 20 March, 21 June, 23 September, and 21 December. They select UTC-noon samples, not the exact event instant. Guided experiments explore zero tilt, opposite hemispheres, and the midnight Sun. The daily-altitude view can compare the northern and southern declination extremes.

## 3D scene

`src/Orbit3D.tsx` renders the Sun, the orbit, and a textured Earth with [three.js](https://threejs.org/), loaded as a separate chunk. The Sun is the only light, so the day/night terminator is real lighting. Earth carries its axis, the equator, your latitude circle, and a pin at your position; the lit share of the latitude circle is the day length. Two camera presets (whole orbit, Earth close-up) sit alongside drag-to-rotate and pinch or Ctrl + scroll zoom. Plain scrolling and vertical swipes still scroll the page.

`src/scene-math.ts` holds the geometry and is tested against the solar model: the angle between the axis and the Sun equals the declination, and the pin's illumination equals `sin(altitude)` for every sampled date, latitude, longitude, and hour. Sizes and distances are not to scale. The SVG schematic in `src/Diagrams.tsx` remains as the fallback while the chunk loads or when WebGL is unavailable. With reduced motion, Earth jumps between dates instead of gliding.

Earth imagery is NASA's Blue Marble (`src/assets/earth-day.jpg`, [NASA Visible Earth](https://visibleearth.nasa.gov/collection/1484/blue-marble), public domain).

## Your location

**Use my location** asks the browser for a position only when clicked. On success it sets latitude and longitude (rounded to 0.1°), jumps to today's date on the 2026 calendar and the current local solar time, and pins the spot on the globe. The position is used in the page only; it is not stored or sent anywhere. Browsers offer geolocation only on HTTPS or localhost.

With a located position, sunrise, solar noon, and sunset are also shown as clock times:

```text
clock time = solar time − longitude / 15° − equation of time + UTC offset
```

The equation of time is `4 min × (mean longitude − right ascension)` from the same USNO quantities; the UTC offset is the device's time zone on the selected date. Preset places move the pin but show no clock times, since the device's time zone would not match them.

## Seasons and day length

Night length is 24 hours minus day length. The season card names the astronomical season from the Sun's ecliptic longitude (quadrants starting at the equinoxes and solstices, opposite in the southern hemisphere; the event day counts as the first day of the new season). Latitudes within the tropics (|latitude| ≤ tilt) show no four seasons, as does any planet with under 5° of tilt. Beyond the polar circles the card adds polar day or polar night. Scenes are illustrative: blossom, a full Sun, maple leaves, and snow stand for the season, not for the local weather or climate.

## Model

`src/model.ts` implements the [US Naval Observatory’s approximate solar coordinates](https://aa.usno.navy.mil/faq/sun_approx). Days from J2000 yield mean anomaly and mean longitude, then corrected ecliptic longitude. Right ascension uses `atan2(cos(tilt) × sin(longitude), cos(longitude))`; declination uses `asin(sin(tilt) × sin(longitude))`. The default axial tilt is fixed at 23.44°; changing it simulates a hypothetical tilted planet while retaining the date-to-longitude mapping.

Daily altitude follows spherical geometry:

```text
sin(altitude) = sin(latitude) sin(declination)
              + cos(latitude) cos(declination) cos(hour angle)
hour angle = 15° × (local solar hour − 12)
```

Sunrise and sunset are the geometric center’s crossings of altitude 0°. These use the same geometry as [NOAA’s solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF), with an ideal horizon and no refraction or solar-disk correction. Displayed times are local apparent solar time, with solar noon at 12:00. They are not UTC, time-zone times, or civil clock predictions. Declination is held fixed throughout each selected day.

Polar day and polar night have no sunrise/sunset crossing. At a geographic pole with exactly zero declination, the Sun stays on the horizon: the model reports zero hours strictly above the horizon and explains the degeneracy.

The orbit views enlarge the bodies and use a constant orbital radius with a fixed north-axis direction. The celestial view plots right ascension horizontally and declination vertically; background stars are illustrative. The annual chart samples every day. This is a geometry teaching model, not an ephemeris or weather model. For the physical context, see [NASA’s Earth facts](https://science.nasa.gov/earth/facts/).

## Verification

Numerical tests check the 3D geometry against the altitude formula, the equation of time against almanac extremes, clock-time conversion, climate zones and seasons, the event dates, equinox geometry, zero tilt, complementary hemisphere daylight, sunrise/sunset altitude, polar degeneracies, every calendar date, and finite full-year results across extreme latitudes and tilts. Browser tests cover granted and declined geolocation, the season card, night length, the 3D scene, collection navigation, connected controls, experiments, keyboard access, playback, year wrapping, and mobile/tablet/desktop layouts. Run them from the repository root.
