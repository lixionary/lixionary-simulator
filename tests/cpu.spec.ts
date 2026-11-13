import { expect, test, type Page } from '@playwright/test';
async function finish(page: Page) {
  await page.getByLabel('Animation speed').selectOption('80');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Complete', { timeout: 10000 });
}
test('collection opens CPU Lab and returns', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('05 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/cpu/"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Small bytes.');
  await expect(page.getByTestId('cpu-cycles')).toHaveText('0');
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
});
test('default load-use example exposes bits, stalls, RAM writes and reversible history', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/cpu/');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next cycle', exact: true }).click();
  await expect(page.getByTestId('cpu-cycles')).toHaveText('4');
  await expect(page.getByTestId('cpu-data-stalls')).toHaveText('1');
  await expect(page.locator('.cpu-explanation')).toContainText('RAM read: [0x10]');
  await expect(page.locator('.cpu-timeline')).toContainText('LD r1');
  await page.getByRole('button', { name: 'Previous cycle', exact: true }).click();
  await expect(page.getByTestId('cpu-cycles')).toHaveText('3');
  await expect(page.getByTestId('cpu-data-stalls')).toHaveText('0');
  await finish(page);
  await expect(page.getByTestId('cpu-cycles')).toHaveText('9');
  await expect(page.getByTestId('cpu-retired')).toHaveText('4');
  await expect(page.getByLabel('r2 bits', { exact: false })).toHaveAttribute('aria-label', 'r2 bits: 00001100');
  await page.getByLabel('Inspect RAM address').selectOption('17');
  await expect(page.getByTestId('cpu-memory-inspector')).toContainText('12 unsigned');
  await expect(page.getByRole('button', { name: 'RAM address 0x11, value 12', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Inspect clock').fill('0');
  await expect(page.getByRole('button', { name: 'RAM address 0x11, value 0', exact: true })).toBeVisible();
  await page.getByLabel('Inspect clock').fill('9');
  await expect(page.getByTestId('cpu-register-2')).toContainText('12');
  expect(errors).toEqual([]);
});
test('forwarding and RAM experiments restart and compare actual cycles', async ({ page }) => {
  await page.goto('/cpu/');
  await page.getByLabel('Operand forwarding').uncheck();
  await finish(page);
  const noForward = Number(await page.getByTestId('cpu-cycles').innerText());
  expect(noForward).toBeGreaterThan(9);
  await expect(page.locator('.cpu-comparison')).toContainText('extra cycles');
  await page.getByLabel('Operand forwarding').check();
  await expect(page.getByTestId('cpu-cycles')).toHaveText('0');
  await page.getByLabel('RAM latency', { exact: false }).fill('5');
  await finish(page);
  await expect(page.getByTestId('cpu-ram-waits')).toHaveText('8');
  await expect(page.getByTestId('cpu-cycles')).toHaveText('17');
  await expect(page.locator('.cpu-comparison')).toContainText('8 extra cycles');
});
test('assembly validates lines and initial register and RAM edits are actual program input', async ({ page }) => {
  await page.goto('/cpu/');
  const source = page.getByLabel('Assembly editor');
  await source.fill('LI r9, 1');
  await expect(page.getByRole('button', { name: 'Next cycle', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Assemble & reset' }).click();
  await expect(page.getByRole('alert')).toContainText('Line 1: Invalid register r9');
  await source.fill('LD r1, 16(r0)\nADD r3, r1, r2\nST r3, 17(r0)\nHALT');
  await page.getByRole('button', { name: 'Assemble & reset' }).click();
  await page.getByLabel('Initial r2', { exact: true }).fill('0x03');
  await page.getByLabel('Initial r2', { exact: true }).press('Enter');
  await page.getByLabel('Initial RAM 0x10', { exact: true }).fill('0x09');
  await page.getByLabel('Initial RAM 0x10', { exact: true }).press('Enter');
  await expect(page.getByLabel('Initial r0', { exact: true })).toBeDisabled();
  await finish(page);
  await page.getByLabel('Inspect RAM address').selectOption('17');
  await expect(page.getByTestId('cpu-memory-inspector')).toContainText('12 unsigned');
  await page.getByRole('button', { name: 'Reset execution', exact: true }).click();
  await expect(page.getByTestId('cpu-cycles')).toHaveText('0');
  await expect(page.getByLabel('Initial r2', { exact: true })).toHaveValue('3');
  await page.getByLabel('Initial r2', { exact: true }).fill('999');
  await page.getByLabel('Initial r2', { exact: true }).press('Enter');
  await expect(page.getByRole('alert')).toContainText('Value must be');
});
test('all presets complete and runtime faults are explained', async ({ page }) => {
  await page.goto('/cpu/');
  for (const preset of ['1', '2', '3', '4']) {
    await page.getByLabel('Start with an experiment').selectOption(preset);
    await finish(page);
    await expect(page.getByTestId('cpu-data-stalls')).toBeVisible();
  }
  await page.getByLabel('Inspect RAM address').selectOption('16');
  await expect(page.getByTestId('cpu-memory-inspector')).toContainText('3 unsigned');
  await page.getByLabel('Assembly editor').fill('LD r1, -1(r0)\nHALT');
  await page.getByRole('button', { name: 'Assemble & reset' }).click();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Fault');
  await expect(page.locator('.cpu-explanation')).toContainText('address -1 is outside RAM');
  await expect(page.getByRole('button', { name: 'Next cycle', exact: true })).toBeDisabled();
});
test('pause, keyboard stepping, and responsive layouts remain usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/cpu/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Next cycle', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('cpu-cycles')).toHaveText('1');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const paused = await page.getByTestId('cpu-cycles').innerText();
    await page.waitForTimeout(600);
    await expect(page.getByTestId('cpu-cycles')).toHaveText(paused);
    await page.screenshot({ path: `test-results/cpu-${width}.png`, fullPage: true });
  }
});
