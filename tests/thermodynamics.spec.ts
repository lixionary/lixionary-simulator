import { expect, test, type Page } from '@playwright/test';

const open = (page: Page, preset?: string) => page.goto(preset ? `/thermodynamics/?preset=${preset}` : '/thermodynamics/');
const stage = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Stages' }).getByRole('button', { name });

test('collection opens Heat Lab and returns', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('12 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/thermodynamics/"]').click();
  await expect(page).toHaveTitle('Heat Lab · Lixionary Simulators');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Heat flows downhill.');
  await expect(page.getByTestId('th-efficiency')).toHaveText('40.0%');
  await expect(page.getByTestId('th-work')).toHaveText('115 J');
  await expect(page.getByTestId('th-heat-hot')).toHaveText('288 J');
  await expect(page.getByTestId('th-heat-cold')).toHaveText('173 J');
  await expect(page.getByTestId('th-entropy')).toHaveText('576 mJ/K');
  await expect(page.getByTestId('th-pv')).toBeVisible();
  await expect(page.getByTestId('th-ts')).toBeVisible();
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the gas goes round four strokes', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('th-stroke')).toHaveText('Hot expansion');
  await expect(page.getByTestId('th-pressure')).toHaveText('294 kPa');
  await expect(page.getByTestId('th-volume')).toHaveText('1.41 L');
  await page.getByRole('button', { name: 'Stroke 2: Insulated expansion' }).click();
  await expect(page.getByTestId('th-stroke')).toHaveText('Insulated expansion');
  await expect(page.locator('.th-piston')).toHaveAttribute('data-stroke', '1');
  await expect(page.getByText('insulated: no heat in or out')).toBeVisible();
  await page.getByLabel('Position in the cycle').fill('0.625');
  await expect(page.getByTestId('th-stroke')).toHaveText('Cold compression');
  await expect(page.getByText('piston pushes: work in')).toBeVisible();
  await page.getByRole('button', { name: 'Stroke 4: Insulated compression' }).click();
  await expect(page.getByTestId('th-stroke')).toHaveText('Insulated compression');
});

test('running the cycle moves the piston and pausing stops it', async ({ page }) => {
  await open(page);
  const gas = page.locator('[data-gas]'), before = await gas.getAttribute('width');
  await page.getByRole('button', { name: 'Run the cycle' }).click();
  await expect(gas).not.toHaveAttribute('width', before!);
  await page.getByRole('button', { name: 'Pause' }).click();
  const paused = await gas.getAttribute('width');
  await page.waitForTimeout(250);
  await expect(gas).toHaveAttribute('width', paused!);
});

test('efficiency depends on the temperatures and on nothing else', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Air' }).click();
  await expect(page.getByTestId('th-efficiency')).toHaveText('40.0%');
  await expect(page.getByTestId('th-volume')).toContainText('1.41 L');
  await expect(page.getByText('Largest volume 7.17 L')).toBeVisible();
  await page.getByLabel('Expansion while hot').fill('4');
  await expect(page.getByTestId('th-efficiency')).toHaveText('40.0%');
  await expect(page.getByTestId('th-work')).toHaveText('231 J');
  await page.getByLabel('Hot reservoir').fill('600');
  await expect(page.getByTestId('th-efficiency')).toHaveText('50.0%');
  await page.getByLabel('Cold reservoir').fill('400');
  await page.getByLabel('Hot reservoir').fill('320');
  await expect(page.locator('output', { hasText: '310 K · 37 °C' })).toBeVisible();
  await expect(page.getByTestId('th-efficiency')).toHaveText('3.1%');
  await page.getByRole('button', { name: 'Logarithmic axes' }).click();
  await expect(page.getByTestId('th-pv')).toContainText('volume · logarithmic');
  await page.getByLabel('Start with an experiment').selectOption('steam');
  await expect(page).toHaveURL(/\?preset=steam$/);
  await expect(page.getByTestId('th-efficiency')).toHaveText('64.3%');
});

test('a real engine trades efficiency for power and stalls when rushed', async ({ page }) => {
  await open(page, 'slow');
  await expect(page.getByTestId('th-engine-state')).toHaveText('running');
  await expect(page.getByTestId('th-real-efficiency')).toHaveText('39.3%');
  await expect(page.getByTestId('th-power')).toHaveText('22.5 W');
  await expect(page.getByTestId('th-carnot')).toHaveText('40.0%');
  await page.getByRole('button', { name: 'Most power' }).click();
  await expect(page.getByTestId('th-power')).toHaveText('254 W');
  await expect(page.getByTestId('th-real-efficiency')).toHaveText('22.5%');
  await expect(page.getByTestId('th-gas')).toHaveText('444 K to 344 K');
  await expect(page.getByTestId('th-heat-in')).toHaveText('1.13 kW');
  await expect(page.getByTestId('th-heat-out')).toHaveText('873 W');
  await page.getByLabel('Friction').fill('0.2');
  await expect(page.getByTestId('th-power')).toHaveText('203 W');
  await expect(page.getByTestId('th-real-efficiency')).toHaveText('18.0%');
  await page.getByRole('button', { name: 'Too fast' }).click();
  await expect(page.getByTestId('th-engine-state')).toHaveText('stalled');
  await expect(page.getByTestId('th-power')).toHaveText('0 W');
  await expect(page.locator('[data-band="work"]')).toHaveCount(0);
  await expect(page.getByTestId('th-power-curve')).toBeVisible();
  await expect(page.getByTestId('th-efficiency-curve')).toBeVisible();
});

test('better heat exchangers raise the power but not the efficiency at its peak', async ({ page }) => {
  await open(page, 'max-power');
  await expect(page.getByTestId('th-best')).toHaveText('254 W');
  await page.getByLabel('Heat exchangers').fill('40');
  await expect(page.getByTestId('th-best')).toHaveText('508 W');
  await expect(page.getByText('At 8.82 cycles per second, where efficiency is 22.5%.')).toBeVisible();
});

test('a refrigerator and a freezer move heat uphill', async ({ page }) => {
  await open(page, 'fridge');
  await expect(page.getByTestId('th-cop')).toHaveText('3.52');
  await expect(page.getByTestId('th-cop-limit')).toHaveText('15.4');
  await expect(page.getByTestId('th-demand')).toHaveText('27.0 W');
  await expect(page.getByTestId('th-electricity')).toHaveText('7.68 W');
  await expect(page.getByTestId('th-compare')).toHaveText('34.7 W');
  await expect(page.getByTestId('th-coils')).toHaveText('−6 °C and 32 °C');
  await page.getByLabel('Temperature inside').fill('-18');
  await expect(page.getByTestId('th-cop')).toHaveText('2.04');
  await expect(page.getByTestId('th-electricity')).toHaveText('29.4 W');
  await page.getByRole('button', { name: 'A perfect machine' }).click();
  await expect(page.getByTestId('th-cop')).toHaveText('6.38');
  await expect(page.getByTestId('th-cop-limit')).toHaveText('6.38');
  await expect(page.getByTestId('th-pump-entropy')).toHaveText('0 W/K');
});

test('a heat pump beats an electric heater, less so in the cold', async ({ page }) => {
  await open(page, 'heat-pump');
  await expect(page.getByTestId('th-cop')).toHaveText('4.97');
  await expect(page.getByTestId('th-electricity')).toHaveText('563 W');
  await expect(page.getByTestId('th-compare')).toHaveText('2.80 kW');
  await page.getByRole('slider', { name: 'Outdoor temperature' }).fill('-20');
  await expect(page.getByTestId('th-cop')).toHaveText('2.99');
  await expect(page.getByTestId('th-demand')).toHaveText('8.20 kW');
  await expect(page.getByTestId('th-electricity')).toHaveText('2.74 kW');
  await expect(page.getByTestId('th-lift')).toHaveText('61 K');
  await page.getByRole('button', { name: 'Air conditioner' }).click();
  await expect(page.getByTestId('th-cop')).toHaveText('4.63');
  await expect(page.getByTestId('th-electricity')).toHaveText('475 W');
  await page.getByRole('slider', { name: 'Outdoor temperature' }).fill('42');
  await expect(page.getByTestId('th-electricity')).toHaveText('953 W');
  await expect(page.getByTestId('th-cop-curve')).toBeVisible();
});

test('the chain buttons move between stages and the engine uses the cycle you built', async ({ page }) => {
  await open(page);
  await page.getByLabel('Hot reservoir').fill('800');
  await stage(page, /A real engine/).click();
  await expect(page.getByTestId('th-carnot')).toHaveText('62.5%');
  await expect(page.getByTestId('th-notice')).toContainText('another link of the chain');
  await expect(page.getByText('This is the engine from link 1: 800 K to 300 K')).toBeVisible();
  await stage(page, /Run it backwards/).click();
  await expect(page.getByTestId('th-cop')).toHaveText('3.52');
  await stage(page, /The cycle/).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('th-efficiency')).toHaveText('62.5%');
});

test('preset links open an experiment and reject unknown names', async ({ page }) => {
  await open(page, 'stalled');
  await expect(page.getByTestId('th-engine-state')).toHaveText('stalled');
  await open(page, 'perpetual-motion');
  await expect(page.getByText('That link names an experiment')).toBeVisible();
  await expect(page.getByTestId('th-efficiency')).toHaveText('40.0%');
  await page.getByText('Inside the model').click();
  await expect(page.getByText(/Curzon–Ahlborn model/)).toBeVisible();
});

for (const width of [390, 1280]) test(`fits a ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  for (const preset of ['carnot', 'max-power', 'heat-pump-cold']) {
    await open(page, preset);
    await expect(page.locator('.th-picture')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});
