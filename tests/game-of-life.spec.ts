import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) { await page.goto('/game-of-life/'); }
async function apply(page: Page) { await page.getByRole('button', { name: 'Apply & restart', exact: true }).click(); }
async function step(page: Page, count = 1) {
  for (let i = 0; i < count; i++) await page.getByRole('button', { name: 'Step', exact: true }).click();
}

test('collection opens Population Lab and returns', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('06 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/game-of-life/"]').click();
  await expect(page).toHaveTitle('Population Lab · Lixionary Simulators');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A delicate balance.');
  await expect(page.getByTestId('life-population')).toHaveText('60');
  await expect(page.getByTestId('life-sick')).toHaveText('3');
  await expect(page.getByTestId('life-tick')).toHaveText('0');
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('steps and plays the world, and pauses without further advancement', async ({ page }) => {
  await open(page);
  await step(page);
  await expect(page.getByTestId('life-tick')).toHaveText('1');
  await page.getByLabel('Simulation speed').selectOption('30');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Step', exact: true })).toBeDisabled();
  await expect(page.getByTestId('life-tick')).not.toHaveText('1');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const tick = await page.getByTestId('life-tick').innerText();
  await page.waitForTimeout(250);
  await expect(page.getByTestId('life-tick')).toHaveText(tick);
  await expect(page.getByRole('button', { name: 'Step', exact: true })).toBeEnabled();
});

test('draft settings, presets, and validation only change the world on apply', async ({ page }) => {
  await open(page);
  await step(page, 2);
  const population = await page.getByTestId('life-population').innerText();
  await page.getByLabel('Starting population', { exact: true }).fill('20');
  await expect(page.getByRole('status')).toContainText('Pending changes');
  await expect(page.getByTestId('life-population')).toHaveText(population);
  await expect(page.getByTestId('life-tick')).toHaveText('2');
  await apply(page);
  await expect(page.getByTestId('life-population')).toHaveText('20');
  await expect(page.getByTestId('life-tick')).toHaveText('0');
  await page.getByLabel('Starting population', { exact: true }).fill('501');
  await apply(page);
  await expect(page.getByTestId('life-population')).toHaveText('20');
  await page.getByLabel('Starting population', { exact: true }).fill('');
  await apply(page);
  await expect(page.getByTestId('life-population')).toHaveText('20');
  await page.getByLabel('Start with an experiment').selectOption('2');
  await expect(page.getByTestId('life-population')).toHaveText('20');
  await apply(page);
  await expect(page.getByTestId('life-population')).toHaveText('150');
  await expect(page.getByTestId('life-sick')).toHaveText('30');
  await page.getByLabel('Start with an experiment').selectOption('1');
  await apply(page);
  await expect(page.getByTestId('life-population')).toHaveText('100');
  await expect(page.getByTestId('life-sick')).toHaveText('0');
});

test('reset exactly repeats a run and new seed keeps pending settings as drafts', async ({ page }) => {
  await open(page);
  await step(page, 5);
  const snapshot = await page.getByTestId('life-habitat').innerHTML(), food = await page.getByTestId('life-food').innerText();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await step(page, 5);
  expect(await page.getByTestId('life-habitat').innerHTML()).toBe(snapshot);
  await expect(page.getByTestId('life-food')).toHaveText(food);
  await page.getByLabel('Starting population', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'New seed', exact: true }).click();
  await expect(page.getByTestId('life-seed')).not.toHaveText('42');
  await expect(page.getByTestId('life-tick')).toHaveText('0');
  await expect(page.getByTestId('life-population')).toHaveText('60');
  await expect(page.getByLabel('Starting population', { exact: true })).toHaveValue('123');
  await apply(page);
  await expect(page.getByTestId('life-population')).toHaveText('123');
});

test('resource overlays and keyboard individual inspection expose actual state', async ({ page }) => {
  await open(page);
  await page.getByLabel('Inspect individual', { exact: true }).selectOption('1');
  await expect(page.getByRole('button', { name: 'Inspect individual 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('life-inspector')).toContainText('Founding generation');
  await expect(page.getByTestId('life-inspector')).toContainText('Lifespan budget left');
  await step(page);
  await expect(page.getByRole('img', { name: 'Population and sickness from tick 0 to 1', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Food and water stocks from tick 0 to 1', exact: true })).toBeVisible();
  await page.getByLabel('Resource overlay').selectOption('water');
  await expect(page.getByText('Bluer cells hold more water.', { exact: false })).toBeVisible();
  await page.getByLabel('Resource overlay').selectOption('food');
  await expect(page.getByText('Greener cells hold more food.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect individual 2', exact: true }).click();
  await expect(page.getByLabel('Inspect individual', { exact: true })).toHaveValue('2');
  await page.getByText('Inside this teaching model', { exact: true }).click();
  await expect(page.getByText('Time uses abstract ticks.', { exact: false })).toBeVisible();
});

test('empty worlds continue renewing resources and seed zero is supported', async ({ page }) => {
  await open(page);
  await page.getByLabel('Starting population', { exact: true }).fill('0');
  await page.getByLabel('Initial food (%)', { exact: true }).fill('0');
  await page.getByLabel('Initial water (%)', { exact: true }).fill('0');
  await page.getByLabel('Random seed', { exact: true }).fill('0');
  await apply(page);
  await expect(page.getByTestId('life-food')).toHaveText('0');
  await expect(page.getByTestId('life-seed')).toHaveText('0');
  await step(page);
  await expect(page.getByTestId('life-food')).toHaveText('128');
  await expect(page.getByTestId('life-water')).toHaveText('192');
  await expect(page.getByText('Population extinct · habitat regenerating', { exact: true })).toBeVisible();
});

test('birth limit is visible when a full healthy population tries to reproduce', async ({ page }) => {
  await open(page);
  await page.getByLabel('Starting population', { exact: true }).fill('500');
  await page.getByText('Life & the next generation', { exact: true }).click();
  await page.getByLabel('Pair birth chance (%)', { exact: true }).fill('100');
  await page.getByText('Sickness & recovery', { exact: true }).click();
  await page.getByLabel('Initially sick (%)', { exact: true }).fill('0');
  await apply(page);
  await step(page);
  await expect(page.getByTestId('life-population')).toHaveText('500');
  await expect(page.getByText('The habitat has reached its 500-individual simulation limit.', { exact: false })).toBeVisible();
});

test('mobile, tablet, and desktop layouts support keyboard controls without overflow', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await open(page);
    await page.getByRole('button', { name: 'Step', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('life-tick')).toHaveText('1');
    await page.getByLabel('Inspect individual', { exact: true }).focus();
    await expect(page.getByLabel('Inspect individual', { exact: true })).toBeFocused();
    await page.getByLabel('Inspect individual', { exact: true }).selectOption('1');
    await expect(page.getByLabel('Inspect individual', { exact: true })).toHaveValue('1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/population-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});
