import { expect, test, type Page } from '@playwright/test';

const open = (page: Page, preset?: string) => page.goto(preset ? `/semiconductor/?preset=${preset}` : '/semiconductor/');
const stage = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Stages' }).getByRole('button', { name });

test('collection opens Silicon Lab and returns', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('11 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/semiconductor/"]').click();
  await expect(page).toHaveTitle('Silicon Lab · Lixionary Simulators');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sand that conducts one way.');
  await expect(page.getByTestId('si-state')).toHaveText('Conducting');
  await expect(page.getByTestId('si-current')).toHaveText('4.03 mA');
  await expect(page.getByTestId('si-builtin')).toHaveText('0.775 V');
  await expect(page.locator('[data-band]')).toHaveCount(2);
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a diode conducts forward, blocks in reverse, and rests at zero', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('si-width')).toHaveText('136 nm');
  await page.getByRole('button', { name: 'Reverse 5 V' }).click();
  await expect(page.getByTestId('si-state')).toHaveText('Blocking');
  await expect(page.getByTestId('si-current')).toHaveText('−56.7 fA');
  await expect(page.getByTestId('si-width')).toHaveText('906 nm');
  await expect(page.getByTestId('si-field')).toHaveText('127 kV/cm');
  await page.getByRole('button', { name: 'None' }).click();
  await expect(page.getByTestId('si-state')).toHaveText('At rest');
  await expect(page.getByTestId('si-current')).toHaveText('0 A');
  await expect(page.getByTestId('si-iv')).toBeVisible();
  await expect(page.getByTestId('si-iv-log')).toBeVisible();
});

test('heat raises the leakage and heavy doping brings breakdown within reach', async ({ page }) => {
  await open(page, 'hot');
  await expect(page.getByTestId('si-saturation')).toHaveText('20.8 nA');
  await expect(page.getByTestId('si-builtin')).toHaveText('0.597 V');
  await page.getByLabel('Start with an experiment').selectOption('zener');
  await expect(page).toHaveURL(/\?preset=zener$/);
  await expect(page.getByTestId('si-state')).toHaveText('Breakdown');
  await expect(page.getByTestId('si-breakdown')).toHaveText('5.5 V reverse');
  await page.getByLabel('Applied voltage').fill('-3');
  await expect(page.getByTestId('si-state')).toHaveText('Blocking');
  await page.getByLabel('Donor atoms, n side').fill('16');
  await expect(page.locator('output', { hasText: '1.0 × 10¹⁶ per cm³' })).toBeVisible();
  await expect(page.getByTestId('si-breakdown')).toHaveText('52.1 V reverse');
});

test('the gate voltage turns the transistor from off to a current source to a closed switch', async ({ page }) => {
  await open(page, 'off');
  await expect(page.getByTestId('si-region')).toHaveText('Off');
  await expect(page.getByTestId('si-threshold')).toHaveText('0.337 V');
  await expect(page.locator('[data-channel]')).toHaveCount(0);
  await page.getByLabel('Gate voltage', { exact: true }).fill('1.5');
  await page.getByLabel('Drain voltage', { exact: true }).fill('2.5');
  await expect(page.getByTestId('si-region')).toHaveText('Current source');
  await expect(page.getByTestId('si-drain')).toHaveText('735 µA');
  await expect(page.getByTestId('si-pinch')).toHaveText('0.90 V');
  await expect(page.locator('[data-channel]')).toBeVisible();
  await page.getByLabel('Drain voltage', { exact: true }).fill('0.1');
  await expect(page.getByTestId('si-region')).toHaveText('Closed switch');
  await page.getByLabel('Oxide thickness').fill('4');
  await expect(page.getByTestId('si-threshold')).toHaveText('0.048 V');
  await expect(page.getByTestId('si-swing')).toHaveText('66.4 mV/decade');
});

test('an inverter flips its output and burns current only halfway', async ({ page }) => {
  await open(page, 'inverter');
  await expect(page.getByTestId('si-output')).toHaveText('1.80 V · 1');
  await expect(page.getByTestId('si-vm')).toHaveText('0.900 V');
  await expect(page.locator('[data-fet="pA"]')).toHaveAttribute('data-on', 'true');
  await expect(page.locator('[data-fet="nA"]')).toHaveAttribute('data-on', 'false');
  await page.getByRole('button', { name: 'A = 1' }).click();
  await expect(page.getByTestId('si-output')).toHaveText('0.00 V · 0');
  await expect(page.locator('.si-truth tr[aria-current]')).toHaveText(/^1\s*0\s*0\.000 V$/);
  await page.getByLabel('Input A', { exact: true }).fill('0.9');
  await expect(page.getByTestId('si-output')).toHaveText('0.90 V · neither');
  await expect(page.getByTestId('si-supply')).toHaveText('160 µA');
});

test('NAND and NOR follow their truth tables, and a low supply saves energy', async ({ page }) => {
  await open(page, 'nand');
  await expect(page.getByTestId('si-output')).toHaveText('0.00 V · 0');
  await expect(page.locator('.si-truth tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'B = 0' }).click();
  await expect(page.getByTestId('si-output')).toHaveText('1.80 V · 1');
  await page.getByRole('button', { name: 'NOR' }).click();
  await expect(page.getByTestId('si-output')).toHaveText('0.00 V · 0');
  await page.getByRole('button', { name: 'A = 0' }).click();
  await expect(page.getByTestId('si-output')).toHaveText('1.80 V · 1');
  await expect(page.getByTestId('si-energy')).toHaveText('32.4 fJ');
  await page.getByLabel('Supply voltage').fill('0.4');
  await expect(page.getByTestId('si-energy')).toHaveText('1.60 fJ');
  await expect(page.getByTestId('si-delay')).toHaveText('573 ps');
});

test('the chain buttons move between stages and the gate uses the transistor you built', async ({ page }) => {
  await open(page);
  await stage(page, /Transistor/).click();
  await expect(page.getByTestId('si-region')).toBeVisible();
  await expect(page.getByTestId('si-notice')).toContainText('another link of the chain');
  await page.getByLabel('Oxide thickness').fill('20');
  await expect(page.getByTestId('si-threshold')).toHaveText('0.819 V');
  await stage(page, /Logic gate/).click();
  await expect(page.getByText('threshold 0.82 V, 20 nm oxide')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue in CPU Lab' })).toHaveAttribute('href', '/cpu/');
  await stage(page, /Junction/).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('si-state')).toHaveText('Conducting');
});

test('preset links open an experiment and reject unknown names', async ({ page }) => {
  await open(page, 'triode');
  await expect(page.getByTestId('si-region')).toHaveText('Closed switch');
  await open(page, 'vacuum-tube');
  await expect(page.getByText('That link names an experiment')).toBeVisible();
  await expect(page.getByTestId('si-current')).toHaveText('4.03 mA');
  await page.getByText('Inside the model').click();
  await expect(page.getByText(/EKV equation/)).toBeVisible();
});

for (const width of [390, 1280]) test(`fits a ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  for (const preset of ['diode', 'saturation', 'nand']) {
    await open(page, preset);
    await expect(page.locator('.si-picture')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});
