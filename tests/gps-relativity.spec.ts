import { expect, test, type Page } from '@playwright/test';

const open = (page: Page, preset?: string) => page.goto(preset ? `/gps-relativity/?preset=${preset}` : '/gps-relativity/');
/** Reads a length readout such as "8.0 m" or "11.56 km" in metres. */
async function metres(page: Page, id: string) {
  const [value, unit] = (await page.getByTestId(id).innerText()).split(' ');
  return Number(value) * (unit === 'km' ? 1000 : 1);
}

test('collection opens Relativity Lab and returns', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('09 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/gps-relativity/"]').click();
  await expect(page).toHaveTitle('Relativity Lab · Lixionary Simulators');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Time runs fast in orbit.');
  await expect(page.getByTestId('gps-gravity')).toHaveText('+45.8 µs/day');
  await expect(page.getByTestId('gps-speed-effect')).toHaveText('−7.2 µs/day');
  await expect(page.getByTestId('gps-net')).toHaveText('+38.6 µs/day');
  await expect(page.getByTestId('gps-factory')).toHaveText('10,229,999.99543 Hz');
  await expect(page.getByTestId('gps-fix-error')).toHaveText('0 m');
  await expect(page.getByTestId('gps-verdict')).toHaveText('The two clocks agree to the nanosecond.');
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('unticking the corrections lets the clock and the fix drift', async ({ page }) => {
  await open(page);
  await page.getByLabel('Solve for its own clock error').uncheck();
  await page.getByLabel('Weaker gravity (general relativity)').uncheck();
  await expect(page.getByTestId('gps-clock-error')).toHaveText('+45.79 µs');
  await page.getByLabel('Orbital speed (special relativity)').uncheck();
  await expect(page.getByTestId('gps-factory')).toHaveText('10,230,000.00000 Hz');
  await expect(page.getByTestId('gps-clock-error')).toHaveText('+38.58 µs');
  await expect(page.getByTestId('gps-range-error')).toHaveText('11.56 km');
  await expect(page.getByTestId('gps-satellite-clock')).toHaveText('Day 1 · 00:00:00.000 038 576');
  expect(await metres(page, 'gps-fix-error')).toBeGreaterThan(10_000);
  await expect(page.getByTestId('gps-trail')).toBeVisible();
  await page.getByLabel('Elapsed time').fill(String(2 * 86_400));
  await expect(page.getByTestId('gps-clock-error')).toHaveText('+77.15 µs');
  await page.getByRole('button', { name: 'Reset clocks' }).click();
  await expect(page.getByTestId('gps-ground-clock')).toHaveText('Day 0 · 00:00:00.000 000 000');
});

test('special relativity alone is worse than no correction', async ({ page }) => {
  await open(page, 'ignored');
  await expect(page.getByTestId('gps-clock-error')).toHaveText('+38.58 µs');
  const none = await metres(page, 'gps-fix-error');
  await page.getByLabel('Start with an experiment').selectOption('speed-only');
  await expect(page).toHaveURL(/\?preset=speed-only$/);
  await expect(page.getByTestId('gps-clock-error')).toHaveText('+45.79 µs');
  expect(await metres(page, 'gps-fix-error')).toBeGreaterThan(none);
});

test('a receiver that solves for its clock keeps its position and loses the time', async ({ page }) => {
  await open(page, 'fourth');
  await expect(page.getByTestId('gps-range-C')).toHaveText('C 11.56 km too near');
  await expect(page.getByTestId('gps-fix-error')).toHaveText('0 m');
  await expect(page.getByTestId('gps-time-error')).toHaveText('+38.58 µs');
  await page.getByLabel('Solve for its own clock error').uncheck();
  await expect(page.getByTestId('gps-time-error')).toHaveText('0 ns');
  expect(await metres(page, 'gps-fix-error')).toBeGreaterThan(10_000);
});

test('an oval orbit moves the fix by metres until the receiver corrects it', async ({ page }) => {
  await open(page, 'oval');
  const off = await metres(page, 'gps-fix-error');
  expect(off).toBeGreaterThan(3); expect(off).toBeLessThan(100);
  await expect(page.locator('[data-drift]')).toHaveCount(6);
  await expect(page.locator('.gps-apsides')).toBeVisible();
  await page.getByLabel('The oval orbit, in the receiver').check();
  await expect(page.getByTestId('gps-fix-error')).toHaveText('0 m');
  await expect(page.getByText('That flat line is the corrections doing their job.')).toBeVisible();
});

test('orbit buttons show a slow clock low down and no drift at the balance point', async ({ page }) => {
  await open(page, 'ignored');
  await page.getByRole('button', { name: /^Space station/ }).click();
  await expect(page.getByTestId('gps-net')).toHaveText('−24.3 µs/day');
  await expect(page.getByTestId('gps-verdict')).toContainText('24.33 µs behind');
  await expect(page.getByTestId('gps-range-A')).toHaveText('A 7.30 km too far');
  await page.getByRole('button', { name: /^Balance point/ }).click();
  await expect(page.getByTestId('gps-net')).toHaveText('0.0 µs/day');
  await expect(page.getByTestId('gps-clock-error')).toHaveText('0 ns');
  await page.getByRole('button', { name: /^Geostationary/ }).click();
  await expect(page.getByTestId('gps-net')).toHaveText('+46.6 µs/day');
  await expect(page.locator('.gps-stage-heading')).toContainText('23 h 56 min');
});

test('altitude and shape respond to the keyboard, and low orbits limit the oval', async ({ page }) => {
  await open(page);
  await page.getByLabel('Altitude', { exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(page.locator('output', { hasText: '300 km' })).toBeVisible();
  await expect(page.getByLabel('How oval the orbit is')).toHaveAttribute('max', '0.014');
  await expect(page.getByLabel('How oval the orbit is')).toHaveValue('0.01');
  await page.getByLabel('How oval the orbit is').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('output', { hasText: 'a circle' })).toBeVisible();
});

test('time runs, pauses, and stops at a week', async ({ page }) => {
  await open(page, 'ignored');
  await page.getByLabel('Playback speed').selectOption('21600');
  await page.getByRole('button', { name: 'Let time run' }).click();
  await expect(page.getByTestId('gps-ground-clock')).not.toContainText('Day 1 · 00:00:00');
  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = await page.getByTestId('gps-ground-clock').innerText();
  await page.waitForTimeout(200);
  await expect(page.getByTestId('gps-ground-clock')).toHaveText(paused);
  await page.getByLabel('Elapsed time').fill(String(7 * 86_400 - 600));
  await page.getByRole('button', { name: 'Let time run' }).click();
  await expect(page.getByTestId('gps-ground-clock')).toHaveText('Day 7 · 00:00:00.000 000 000');
  await expect(page.getByRole('button', { name: 'Let time run' })).toBeVisible();
});

test('preset links open an experiment and reject unknown names', async ({ page }) => {
  await open(page, 'station');
  await expect(page.getByTestId('gps-net')).toHaveText('−24.3 µs/day');
  await open(page, 'wormhole');
  await expect(page.getByText('That link names an experiment')).toBeVisible();
  await expect(page.getByTestId('gps-net')).toHaveText('+38.6 µs/day');
  await page.getByText('Inside the model').click();
  await expect(page.getByText(/NTS-2 in 1977/)).toBeVisible();
});

for (const width of [390, 1280]) test(`fits a ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await open(page, 'oval');
  await expect(page.locator('.gps-orbit')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
