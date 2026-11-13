import { expect, test } from '@playwright/test';

test.describe('with location shared', () => {
  // Jakarta, on a fixed instant: 13 November 2026, 12:00 Western Indonesia Time.
  test.use({ geolocation: { latitude: -6.2088, longitude: 106.8456 }, permissions: ['geolocation'], timezoneId: 'Asia/Jakarta' });

  test('uses the real position, today’s date, and clock times', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-13T05:00:00Z'));
    await page.goto('/apparent-annual-motion/');
    await expect(page.getByTestId('clock-times')).toHaveCount(0);
    await page.getByRole('button', { name: 'Use my location', exact: true }).click();
    await expect(page.getByTestId('latitude-value')).toHaveText('6.2° S');
    await expect(page.getByTestId('selected-date')).toHaveText('13 November 2026');
    await expect(page.getByLabel('Start somewhere familiar')).toHaveValue('mine');
    await expect(page.getByTestId('location-status')).toContainText('where you are');
    await expect(page.getByTestId('clock-times')).toContainText('UTC+7');
    // Jakarta mid-November: sunrise ≈ 05:28, solar noon ≈ 11:37, sunset ≈ 17:46 local (geometric horizon).
    await expect(page.getByTestId('sunrise-clock')).toHaveText(/^05:2\d$/);
    await expect(page.getByTestId('noon-clock')).toHaveText(/^11:3\d$/);
    await expect(page.getByTestId('sunset-clock')).toHaveText(/^17:4\d$/);
    // 12:00 clock time is a little after local solar noon.
    await expect(page.locator('output[for="solar-hour"]')).toHaveText(/^12:(15|30)$/);
    await expect(page.getByTestId('season')).toHaveText('No four seasons here');
    // Choosing another place leaves "my location" mode and hides clock times.
    await page.getByLabel('Start somewhere familiar').selectOption('51.5');
    await expect(page.getByTestId('clock-times')).toHaveCount(0);
    await expect(page.getByTestId('season')).toHaveText('Autumn');
  });
});

test('declined location explains itself and keeps manual controls working', async ({ page }) => {
  await page.goto('/apparent-annual-motion/');
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await expect(page.getByTestId('location-status')).toContainText(/declined|isn’t available/);
  await expect(page.getByTestId('selected-date')).toHaveText('21 June 2026');
  await page.getByLabel('Start somewhere familiar').selectOption('-33.9');
  await expect(page.getByTestId('latitude-value')).toHaveText('33.9° S');
});

test('night length complements day length, including the polar extremes', async ({ page }) => {
  await page.goto('/apparent-annual-motion/');
  await expect(page.getByTestId('daylight')).toHaveText('14h 51m');
  await expect(page.getByTestId('night')).toHaveText('9h 09m');
  await page.getByRole('button', { name: 'Chase the midnight Sun' }).click();
  await expect(page.getByTestId('night')).toHaveText('0h 00m');
  await page.getByRole('button', { name: /^December solstice/ }).click();
  await expect(page.getByTestId('night')).toHaveText('24h 00m');
});

test('season card follows the date, hemisphere, climate zone, and tilt', async ({ page }) => {
  await page.goto('/apparent-annual-motion/');
  const season = page.getByTestId('season'), zone = page.getByTestId('season-zone');
  await expect(season).toHaveText('Summer');
  await expect(zone).toHaveText('Northern hemisphere · temperate zone');
  await page.getByRole('button', { name: /^December solstice/ }).click();
  await expect(season).toHaveText('Winter');
  await expect(page.locator('.season-particle.snow').first()).toBeAttached();
  await page.getByRole('button', { name: /^March equinox/ }).click();
  await expect(season).toHaveText('Spring');
  await expect(page.locator('.season-particle.petal').first()).toBeAttached();
  await page.getByRole('button', { name: /^September equinox/ }).click();
  await expect(season).toHaveText('Autumn');
  await expect(page.locator('.season-particle.leaf').first()).toBeAttached();
  await page.getByLabel('Start somewhere familiar').selectOption('-33.9');
  await expect(season).toHaveText('Spring');
  await expect(zone).toHaveText('Southern hemisphere · subtropics');
  await page.getByLabel('Start somewhere familiar').selectOption('-6.2');
  await expect(season).toHaveText('No four seasons here');
  await page.getByLabel('Start somewhere familiar').selectOption('69.7');
  await page.getByRole('button', { name: /^June solstice/ }).click();
  await expect(season).toHaveText('Summer');
  await expect(zone).toHaveText('Northern hemisphere · polar region · polar day');
  await page.getByRole('button', { name: /^December solstice/ }).click();
  await expect(zone).toContainText('polar night');
  await page.getByRole('button', { name: 'Try zero tilt' }).click();
  await expect(season).toHaveText('Hardly any seasons');
});

test('3D scene mounts, switches camera, and its event markers jump dates', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/apparent-annual-motion/');
  const canvas = page.getByTestId('orbit-3d');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', /21 June/);
  await page.getByRole('button', { name: 'Jump to December solstice', exact: true }).click();
  await expect(page.getByTestId('selected-date')).toHaveText('21 December 2026');
  await page.getByRole('button', { name: 'Earth close-up', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Earth close-up', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Whole orbit', exact: true }).click();
  await page.getByRole('button', { name: 'Play year animation' }).click();
  await expect(page.getByTestId('selected-date')).not.toHaveText('21 December 2026');
  // The scene actually drew something other than the clear colour.
  const lit = await canvas.evaluate((element: HTMLCanvasElement) => new Promise<boolean>(resolve => requestAnimationFrame(() => {
    const probe = document.createElement('canvas');
    probe.width = 64; probe.height = 36;
    const context = probe.getContext('2d')!;
    context.drawImage(element, 0, 0, 64, 36);
    const data = context.getImageData(0, 0, 64, 36).data;
    let bright = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 150) bright++;
    resolve(bright > 3);
  })));
  expect(lit).toBe(true);
  expect(errors).toEqual([]);
});
