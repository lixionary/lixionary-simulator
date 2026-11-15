import { expect, test, type Page } from '@playwright/test';

const open = (page: Page, preset?: string) => page.goto(preset ? `/lens/?preset=${preset}` : '/lens/');
/** Reads a length readout such as "4.3 µm" or "1.84 mm" in micrometres. */
async function microns(page: Page, id: string) {
  const [value, unit] = (await page.getByTestId(id).innerText()).split(' ');
  return Number(value) * (unit === 'mm' ? 1000 : 1);
}

test('collection opens Lens Lab and returns', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('11 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/lens/"]').click();
  await expect(page).toHaveTitle('Lens Lab · Lixionary Simulators');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A stack makes it sharp.');
  await expect(page.getByTestId('lens-focal')).toHaveText('97.7 mm');
  await expect(page.getByTestId('lens-image-type')).toHaveText('Real · upside down');
  await expect(page.locator('.lens-bench [data-ray="green"]')).toHaveCount(9);
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a concave lens spreads light into a virtual upright image', async ({ page }) => {
  await open(page);
  await page.getByLabel('Start with an experiment').selectOption('concave');
  await expect(page).toHaveURL(/\?preset=concave$/);
  await expect(page.getByTestId('lens-focal')).toHaveText('-96.3 mm');
  await expect(page.getByTestId('lens-image-type')).toHaveText('Virtual · upright');
  await expect(page.getByTestId('lens-magnification')).toHaveText('0.32×');
  await expect(page.locator('.lens-bench [data-image="virtual"]')).toBeVisible();
  await expect(page.getByTestId('lens-no-sensor')).toBeVisible();
  await expect(page.getByTestId('lens-selected-shape')).toHaveText('Biconcave');
});

test('an object inside the focal length of a convex lens gives a magnified virtual image', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('lens-magnification')).toHaveText('-0.94×');
  await page.getByLabel('Object distance').fill('50');
  await expect(page.getByTestId('lens-image-type')).toHaveText('Virtual · upright');
  expect(Number((await page.getByTestId('lens-magnification').innerText()).replace('×', ''))).toBeGreaterThan(1.5);
  await page.getByRole('button', { name: 'Distant light' }).click();
  await expect(page.getByTestId('lens-image-type')).toHaveText('Real · upside down');
  await expect(page.locator('.lens-bench [data-object]')).toHaveCount(0);
});

test('stacked presets report a sharper image than one lens', async ({ page }) => {
  await open(page, 'flaws');
  const single = await microns(page, 'lens-blur');
  await page.getByLabel('Start with an experiment').selectOption('stopped');
  expect(await microns(page, 'lens-blur')).toBeLessThan(single / 20);
  await expect(page.getByTestId('lens-fnumber')).toHaveText('f/4.2');
  await page.getByLabel('Start with an experiment').selectOption('camera');
  await expect(page.getByTestId('lens-focal')).toHaveText('50.0 mm');
  await expect(page.getByTestId('lens-fnumber')).toHaveText('f/4.7');
  await expect(page.getByRole('group', { name: 'Lenses on the bench' }).getByRole('button')).toHaveCount(3);
  expect(await microns(page, 'lens-blur')).toBeLessThan(10);
  expect(await microns(page, 'lens-single-blur')).toBeGreaterThan(4 * await microns(page, 'lens-blur'));
  await expect(page.getByTestId('lens-compare-curve')).toBeVisible();
});

test('white light adds blue and red rays', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lens-bench [data-ray="blue"]')).toHaveCount(0);
  await page.getByLabel('White light (blue, green, and red)').check();
  await expect(page.locator('.lens-bench [data-ray="blue"]')).toHaveCount(9);
  await expect(page.locator('.lens-bench [data-ray="red"]')).toHaveCount(9);
  await page.getByLabel('Rays drawn').fill('5');
  await expect(page.locator('.lens-bench [data-ray="red"]')).toHaveCount(5);
});

test('lenses can be added, reshaped, and removed', async ({ page }) => {
  await open(page);
  const lenses = page.getByRole('group', { name: 'Lenses on the bench' }).getByRole('button');
  await expect(page.getByRole('button', { name: 'Remove this lens' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add concave lens' }).click();
  await expect(lenses).toHaveCount(2);
  await expect(page.getByTestId('lens-selected-shape')).toHaveText('Biconcave');
  await expect(page.getByTestId('lens-focal')).not.toHaveText('97.7 mm');
  await page.getByLabel('Back surface').fill('0');
  await expect(page.getByTestId('lens-selected-shape')).toHaveText('Plano-concave');
  await page.getByRole('button', { name: 'Remove this lens' }).click();
  await expect(lenses).toHaveCount(1);
  await expect(page.getByTestId('lens-focal')).toHaveText('97.7 mm');
  await page.getByLabel('Diameter').fill('80');
  await expect(page.getByRole('alert')).toContainText('edges would meet');
  await expect(page.getByTestId('lens-fnumber')).toHaveText('f/3.3');
});

test('moving the sensor blurs the image and autofocus restores it', async ({ page }) => {
  await open(page, 'camera');
  const sharp = await microns(page, 'lens-blur');
  await expect(page.getByLabel('Keep the sensor in focus as I change things')).toBeChecked();
  await page.getByLabel('Sensor position').fill('63');
  await expect(page.getByLabel('Keep the sensor in focus as I change things')).not.toBeChecked();
  expect(await microns(page, 'lens-blur')).toBeGreaterThan(20 * sharp);
  await page.getByRole('button', { name: 'Autofocus' }).click();
  expect(await microns(page, 'lens-blur')).toBeCloseTo(sharp, 0);
});

test('bench items can be dragged', async ({ page }) => {
  await open(page, 'camera');
  await page.locator('.lens-bench').scrollIntoViewIfNeeded();
  const sharp = await microns(page, 'lens-blur'), box = (await page.locator('.lens-bench [data-sensor]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 4 }); await page.mouse.up();
  expect(await microns(page, 'lens-blur')).toBeGreaterThan(20 * sharp);
  await expect(page.getByLabel('Keep the sensor in focus as I change things')).not.toBeChecked();
  await open(page);
  await page.locator('.lens-bench').scrollIntoViewIfNeeded();
  const tip = (await page.locator('.lens-bench [data-object] circle').last().boundingBox())!;
  await page.mouse.move(tip.x + tip.width / 2, tip.y + tip.height / 2);
  await page.mouse.down(); await page.mouse.move(tip.x + tip.width / 2 + 60, tip.y + tip.height / 2 + 30, { steps: 4 }); await page.mouse.up();
  await expect(page.getByTestId('lens-magnification')).not.toHaveText('-0.94×');
});

test('tilted light is set from the keyboard and the triplet stays sharp', async ({ page }) => {
  await open(page, 'camera');
  await expect(page.getByTestId('lens-magnification')).toHaveText('0 mm');
  await page.getByLabel('Tilt of the incoming light').focus();
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator('output', { hasText: '10.0°' })).toBeVisible();
  await expect(page.getByTestId('lens-magnification')).toHaveText('8.82 mm');
  expect(await microns(page, 'lens-blur')).toBeLessThan(15);
});

test('preset links open the microscope and reject unknown names', async ({ page }) => {
  await open(page, 'microscope');
  await expect(page.getByTestId('lens-image-type')).toHaveText('At infinity');
  await expect(page.getByTestId('lens-magnification')).toHaveText('80×');
  await expect(page.locator('.lens-bench')).toContainText('image in the tube');
  await open(page, 'telescope');
  await expect(page.getByTestId('lens-focal')).toHaveText('∞');
  await expect(page.getByTestId('lens-image-type')).toHaveText('At infinity');
  await expect(page.getByTestId('lens-magnification')).toHaveText('8.0×');
  await expect(page.locator('.lens-bench')).toContainText('image in the tube');
  await expect(page.getByRole('group', { name: 'Lenses on the bench' }).getByRole('button')).toHaveCount(4);
  await open(page, 'periscope');
  await expect(page.getByText('That link names an experiment')).toBeVisible();
  await expect(page.getByTestId('lens-focal')).toHaveText('97.7 mm');
});

for (const width of [390, 1280]) test(`fits a ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await open(page, 'microscope');
  await expect(page.locator('.lens-bench')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
