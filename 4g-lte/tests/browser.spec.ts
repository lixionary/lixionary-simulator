import { test, expect } from '@playwright/test';

test('a message travels through every inspectable stage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/4g-lte/');
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: HELLO 4G');
  await expect(page.getByText('CRC PASS', { exact: true })).toBeVisible();
  await page.getByLabel('Message to transmit').fill('WAVES ARE COOL');
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: WAVES ARE COOL');
  for (const label of ['Your bits', 'Modulation', 'Resource grid', 'OFDM', 'Wireless channel', 'Receiver', 'Recovered data']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: WAVES ARE COOL');
  }
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Message to transmit')).toHaveValue('HELLO 4G');
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: HELLO 4G');
  expect(errors).toEqual([]);
});

test('grid selection links to inspected symbols, with both prefix layouts', async ({ page }) => {
  await page.goto('/4g-lte/');
  await expect(page.getByTestId('recovered-message')).toBeVisible();
  await page.getByRole('button', { name: 'Resource grid', exact: true }).click();
  await page.getByRole('button', { name: 'data, subcarrier 5, symbol 2', exact: true }).click();
  await expect(page.getByText('l=2 / k=5', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Modulation', exact: true }).click();
  await expect(page.getByRole('img', { name: /^Symbol bits/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next data symbol', exact: true }).click();
  await page.getByRole('button', { name: 'Extended · 32', exact: true }).click();
  await page.getByRole('button', { name: 'Resource grid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'data, subcarrier 5, symbol 5', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'data, subcarrier 5, symbol 6', exact: true })).toHaveCount(0);
  await expect(page.getByText('CRC PASS', { exact: true })).toBeVisible();
});

test('all experiments load and their controls work', async ({ page }) => {
  await page.goto('/4g-lte/');
  const names = ['Turn up the noise', 'More bits, less room', 'Echoes in the air', 'Give echoes some space', 'A slightly wrong frequency', 'Help your bits get home', 'Find the symbol boundary'];
  for (const title of names) {
    await page.getByRole('navigation').getByRole('button', { name: /^Experiments/ }).click();
    await page.getByRole('button', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await expect(page.getByRole('region', { name: 'Active guided experiment' }).getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByTestId('recovered-message')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Close experiment guidance' }).click();
  await expect(page.getByRole('region', { name: 'Active guided experiment' })).toHaveCount(0);
});

test('CP timing finds the delayed signal and repairs an actual wrongly aligned decode', async ({ page }) => {
  await page.goto('/4g-lte/');
  await page.getByRole('navigation').getByRole('button', { name: /^Experiments/ }).click();
  await page.getByRole('button', { name: /Find the symbol boundary/ }).click();
  await expect(page.getByText('CRC FAIL', { exact: true })).toBeVisible();
  await expect(page.getByTestId('detected-timing')).toHaveText('24samples');
  await expect(page.getByTestId('used-timing')).toHaveText('0samples');
  await page.getByRole('button', { name: 'Play correlation scan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause correlation scan', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause correlation scan', exact: true }).click();
  await page.getByRole('button', { name: 'Jump to correlation peak', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Correlation probe', exact: true })).toHaveValue('24');
  await page.getByRole('button', { name: 'Apply CP synchronization', exact: true }).click();
  await expect(page.getByTestId('used-timing')).toHaveText('24samples');
  await expect(page.getByText('CRC PASS', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: HELLO 4G');
  await page.getByRole('slider', { name: 'Signal arrival delay', exact: true }).focus();
  await page.keyboard.press('End');
  await expect(page.getByTestId('detected-timing')).toHaveText('63samples');
  await expect(page.getByTestId('used-timing')).toHaveText('63samples');
  await expect(page.getByText('CRC PASS', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Extended · 32', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Correlation probe', exact: true })).toHaveAttribute('max', '95');
  await expect(page.getByTestId('detected-timing')).toHaveText('63samples');
  await page.getByText('Correlation math & sample values', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'CP sample pair values', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'CP correlation candidate values', exact: true }).getByRole('row')).toHaveCount(97);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/cp-synchronization-desktop.png', fullPage: true });
});

test('CP estimates can drive frequency compensation without ideal CFO correction', async ({ page }) => {
  await page.goto('/4g-lte/');
  await page.getByLabel('Add noise to the signal').uncheck();
  await page.getByRole('button', { name: 'Receiver', exact: true }).click();
  await page.getByRole('slider', { name: 'Frequency offset', exact: true }).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.getByLabel('Compensate frequency offset').check();
  await page.getByLabel('Frequency correction source', { exact: true }).selectOption('cp');
  await page.getByRole('button', { name: 'Apply CP synchronization', exact: true }).click();
  await expect(page.getByText('CRC PASS', { exact: true })).toBeVisible();
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: HELLO 4G');
  await expect(page.getByText('7350.0 Hz', { exact: true }).first()).toBeVisible();
});

test('synchronization controls, curves, and tables fit a mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/4g-lte/');
  await page.getByRole('button', { name: 'Receiver', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Cyclic-prefix synchronization', exact: true })).toBeVisible();
  await page.getByText('Correlation math & sample values', { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Apply CP synchronization', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Timing synchronization', { exact: true })).toHaveValue('cp');
  await page.screenshot({ path: 'test-results/cp-synchronization-mobile.png', fullPage: true });
});

test('validates input and recovers from invalid and rapid edits', async ({ page }) => {
  await page.goto('/4g-lte/');
  await page.getByLabel('Message to transmit').fill('你好');
  await expect(page.getByRole('alert')).toContainText('ASCII');
  await page.getByLabel('Message to transmit').fill('');
  await expect(page.getByRole('alert')).toContainText('Enter a message');
  await page.getByRole('button', { name: 'Binary', exact: true }).click();
  await page.getByLabel('Message to transmit').fill('10101');
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered bits: 10101');
  await page.getByLabel('Message to transmit').fill('102');
  await expect(page.getByRole('alert')).toContainText('binary digits');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  for (const message of ['F', 'FI', 'FIN', 'FINAL']) await page.getByLabel('Message to transmit').fill(message);
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: FINAL');
});

test('custom tap editing, resource reservations, and noise reset remain usable', async ({ page }) => {
  await page.goto('/4g-lte/');
  await page.getByRole('button', { name: /Custom Your own taps/ }).click();
  await page.getByRole('button', { name: 'Add a path', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove path 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove path 2', exact: true }).click();
  await page.getByText('Coding & resource mapping', { exact: true }).click();
  await page.getByLabel('Control columns (CFI)').selectOption('2');
  await page.getByLabel('Synchronization', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Resource grid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'pss, subcarrier 0, symbol 6', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'control, subcarrier 1, symbol 0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New noise', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByText('CRC PASS', { exact: true })).toBeVisible();
});

test('responsive layouts avoid horizontal overflow and support reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/4g-lte/');
    await expect(page.getByTestId('recovered-message')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Resource grid', exact: true }).click();
    await expect(page.getByRole('button', { name: 'pilot, subcarrier 0, symbol 0', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 1440) {
      await page.getByRole('button', { name: 'Wireless channel', exact: true }).click();
      await page.screenshot({ path: 'test-results/signal-lab-desktop.png', fullPage: true });
    }
    if (width === 375) await page.screenshot({ path: 'test-results/signal-lab-mobile.png', fullPage: true });
  }
});

test('keyboard navigation and model explanations are available', async ({ page }) => {
  await page.goto('/4g-lte/');
  await expect(page.getByTestId('recovered-message')).toBeVisible();
  await page.getByRole('button', { name: 'Next data symbol', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Next data symbol', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Play symbol animation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause symbol animation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause symbol animation', exact: true }).click();
  await page.getByText('Inspect numerical values', { exact: false }).click();
  await expect(page.getByRole('region', { name: 'Waveform sample values', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Channel response values', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'How it works', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'What this model simplifies', exact: true })).toBeVisible();
  await expect(page.getByText(/not real LTE’s 0.5 ms slots/)).toBeVisible();
});

test('live recovered data remains reachable while changing channel controls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/4g-lte/');
  await expect(page.getByLabel('Live recovered data', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Live recovered data', { exact: true })).toContainText('HELLO 4G');
  await page.getByRole('button', { name: 'Jump to decoded data', exact: true }).click();
  await expect(page.getByLabel('Live recovered data', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Recovered message', exact: true })).toBeInViewport();
});
