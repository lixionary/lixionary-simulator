import { expect, test, type Page } from '@playwright/test';

const open = (page: Page, preset?: string) => page.goto(preset ? `/gravitational-lensing/?preset=${preset}` : '/gravitational-lensing/');
const gain = async (page: Page, id = 'gl-brightness') => Number((await page.getByTestId(id).innerText()).replace('×', ''));
/** Red channel of the lensed picture at a sky position given in ring radii. */
const lit = (page: Page, x: number, y: number) => page.locator('[data-sky="lensed"] canvas').evaluate((canvas: HTMLCanvasElement, [sx, sy]) => {
  const n = canvas.width, half = 2.8;
  return canvas.getContext('2d')!.getImageData(Math.floor((sx + half) / (2 * half) * n), Math.floor((half - sy) / (2 * half) * n), 1, 1).data[0];
}, [x, y]);

test('collection opens Gravity Lens Lab and returns', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('09 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/gravitational-lensing/"]').click();
  await expect(page).toHaveTitle('Gravity Lens Lab · Lixionary Simulators');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mass bends light.');
  await expect(page.getByTestId('gl-ring')).toHaveText('1.03″');
  await expect(page.getByTestId('gl-mass')).toHaveText('210 billion Suns');
  await expect(page.getByTestId('gl-images')).toHaveText('2 images');
  await expect(page.locator('[data-sky] canvas')).toHaveCount(2);
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('lining up the galaxies closes the arcs into a ring', async ({ page }) => {
  await open(page);
  expect(await lit(page, -1, 0)).toBeLessThan(120);
  await page.getByLabel('Start with an experiment').selectOption('ring');
  await expect(page).toHaveURL(/\?preset=ring$/);
  await expect(page.getByTestId('gl-images')).toHaveText('A ring');
  for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(await lit(page, x, y)).toBeGreaterThan(150);
  await page.getByLabel('Mark the Einstein ring').uncheck();
  await expect(page.locator('[data-ring]')).toHaveCount(0);
});

test('a lopsided lens makes four images, and rounding it removes two', async ({ page }) => {
  await open(page, 'cross');
  await expect(page.getByTestId('gl-images')).toHaveText('4 images');
  await expect(page.getByTestId('gl-ring')).toHaveText('0.90″');
  await page.getByLabel('Closest pass').fill('0.5');
  await expect(page.getByTestId('gl-images')).toHaveText('2 images');
});

test('a star passing a star only brightens, for about three weeks', async ({ page }) => {
  await open(page, 'microlens');
  await expect(page.getByTestId('gl-ring')).toHaveText('0.55 mas');
  await expect(page.getByTestId('gl-ring-size')).toHaveText('2.21 AU');
  await expect(page.getByTestId('gl-crossing')).toHaveText('19.1 days');
  await expect(page.getByTestId('gl-mass')).toHaveText('0.30 Suns');
  expect(await gain(page)).toBeLessThan(1.1);
  expect(await gain(page, 'gl-peak')).toBeGreaterThan(5);
  await page.getByLabel('Position along its path').fill('0');
  expect(await gain(page)).toBeGreaterThan(5);
  await expect(page.getByTestId('gl-curve')).toBeVisible();
  await page.getByLabel('Mass', { exact: true }).fill('1');
  await expect(page.getByTestId('gl-mass')).toHaveText('10.0 Suns');
  await expect(page.getByTestId('gl-crossing')).toHaveText('110 days');
});

test('the background drifts past and stops at the end of its path', async ({ page }) => {
  await open(page, 'microlens');
  await page.getByLabel('Position along its path').fill('1.6');
  await page.getByRole('button', { name: 'Let it drift past' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.getByLabel('Position along its path')).toHaveValue('2.2');
  await expect(page.getByRole('button', { name: 'Let it drift past' })).toBeVisible();
});

test('the background can be dragged in the true sky', async ({ page }) => {
  await open(page, 'ring');
  await page.locator('[data-sky="true"]').scrollIntoViewIfNeeded();
  const box = (await page.locator('[data-sky="true"]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.2, { steps: 4 }); await page.mouse.up();
  await expect(page.getByTestId('gl-images')).toHaveText('1 image');
  await expect(page.getByLabel('Position along its path')).toHaveValue('2.2');
});

test('lens kind, distances, and background respond to the controls', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Star or black hole' }).click();
  await expect(page.getByLabel('Lopsidedness')).toHaveCount(0);
  await expect(page.getByTestId('gl-mass')).toHaveText('1.00 Suns');
  await page.getByRole('button', { name: 'Galaxy or cluster' }).click();
  await page.getByLabel('How fast its stars move').fill('500');
  await expect(page.getByTestId('gl-ring')).toHaveText('4.12″');
  await page.getByLabel('Distance to the lens').focus();
  await page.keyboard.press('End');
  await expect(page.locator('output', { hasText: '8.7 billion light-years' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Many galaxies' }).click();
  await expect(page.getByRole('button', { name: 'Many galaxies' })).toHaveAttribute('aria-pressed', 'true');
});

test('preset links open an experiment and reject unknown names', async ({ page }) => {
  await open(page, 'blackhole');
  await expect(page.getByTestId('gl-mass')).toHaveText('7.00 Suns');
  await open(page, 'wormhole');
  await expect(page.getByText('That link names an experiment')).toBeVisible();
  await expect(page.getByTestId('gl-ring')).toHaveText('1.03″');
  await page.getByText('Inside the model').click();
  await expect(page.getByText(/traced backward with the lens equation/)).toBeVisible();
});

for (const width of [390, 1280]) test(`fits a ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await open(page, 'cluster');
  await expect(page.locator('[data-sky="lensed"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
