import { expect, test } from '@playwright/test';

test('collection links to Bit Lab and back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('03 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/error-detection/"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A tiny flip.');
  await expect(page.getByTestId('sent-frame')).toHaveText('Sent frame: 101100100');
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
});

test('keyboard flips distinguish receiver verdict from known corruption', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/error-detection/');
  await expect(page.getByTestId('receiver-verdict')).toHaveText('No error detected');
  await page.getByRole('button', { name: 'Flip payload bit 1, currently 1', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Flip payload bit 1, currently 0', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('receiver-verdict')).toHaveText('Error detected');
  await page.getByRole('button', { name: 'Flip payload bit 2, currently 0', exact: true }).click();
  await expect(page.getByTestId('receiver-verdict')).toHaveText('No error detected');
  await expect(page.getByTestId('observer-result')).toContainText('2 bits changed, but the check passed');
  await page.getByRole('button', { name: 'Clear flips' }).click();
  await page.getByRole('button', { name: 'Flip check bit 1, currently 0', exact: true }).click();
  await expect(page.getByTestId('receiver-verdict')).toHaveText('Error detected');
  expect(errors).toEqual([]);
});

test('all methods have repeatable clean, detected, and undetected examples', async ({ page }) => {
  await page.goto('/error-detection/');
  for (const algorithm of ['Parity', 'Checksum', 'CRC']) {
    await page.getByRole('group', { name: 'Error detection algorithm' }).getByRole('button', { name: new RegExp(algorithm) }).click();
    await page.getByRole('button', { name: 'A clean journey' }).click();
    await expect(page.getByTestId('observer-result')).toContainText('No bits changed');
    await page.getByRole('button', { name: 'Flip a single bit', exact: true }).click();
    await expect(page.getByTestId('receiver-verdict')).toHaveText('Error detected');
    await page.getByRole('button', { name: 'Sneak past the check' }).click();
    await expect(page.getByTestId('receiver-verdict')).toHaveText('No error detected');
    await expect(page.getByTestId('observer-result')).toContainText('This error slipped through');
  }
});

test('switching methods preserves payload flips, clears check flips, and restarts the trace', async ({ page }) => {
  await page.goto('/error-detection/');
  await page.getByRole('button', { name: 'Flip payload bit 1, currently 1', exact: true }).click();
  await page.getByRole('button', { name: 'Flip check bit 1, currently 0', exact: true }).click();
  await page.getByRole('button', { name: 'Next calculation step' }).click();
  await page.getByRole('group', { name: 'Error detection algorithm' }).getByRole('button', { name: /Checksum/ }).click();
  await expect(page.getByRole('button', { name: /^Flip check bit/ })).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Flip payload bit 1, currently 0', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Flip check bit.*currently/ }).first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('observer-result')).toContainText('1 bit changed');
  await expect(page.getByTestId('calculation-step')).toContainText('STEP 1 OF');
});

test('editing validates input, clears flips, and reset restores the initial lesson', async ({ page }) => {
  await page.goto('/error-detection/');
  await page.getByRole('button', { name: 'Sneak past the check' }).click();
  await page.getByLabel('Your eight payload bits').fill('0000 0000');
  await expect(page.getByTestId('sent-frame')).toHaveText('Sent frame: 000000000');
  await expect(page.getByTestId('observer-result')).toContainText('No bits changed');
  await page.getByLabel('Your eight payload bits').fill('xyz');
  await expect(page.getByRole('alert')).toContainText('Enter exactly 8 binary digits');
  await expect(page.getByTestId('receiver-verdict')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Your eight payload bits')).toHaveValue('10110010');
  await expect(page.getByTestId('sent-frame')).toHaveText('Sent frame: 101100100');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('walkthrough steps through sender and receiver calculations for each method', async ({ page }) => {
  await page.goto('/error-detection/');
  for (const algorithm of ['Parity', 'Checksum', 'CRC']) {
    await page.getByRole('group', { name: 'Error detection algorithm' }).getByRole('button', { name: new RegExp(algorithm) }).click();
    await expect(page.getByRole('button', { name: 'Previous calculation step' })).toBeDisabled();
    const first = await page.getByTestId('calculation').innerText();
    await page.getByRole('button', { name: 'Next calculation step' }).click();
    await expect(page.getByTestId('calculation')).not.toHaveText(first);
    await page.getByRole('button', { name: 'Previous calculation step' }).click();
    await expect(page.getByTestId('calculation')).toHaveText(first);
    await page.getByRole('button', { name: 'See the receiver’s check' }).click();
    await expect(page.locator('.ed-phase')).toHaveText('Receiver');
    const next = page.getByRole('button', { name: 'Next calculation step' });
    while (await next.isEnabled()) await next.click();
    await expect(page.getByTestId('calculation')).toContainText(algorithm === 'Parity' ? 'mod 2 = 0' : algorithm === 'Checksum' ? '1111 = 1111' : '000 = 000');
    await page.getByRole('button', { name: 'See the sender’s calculation' }).click();
    await expect(page.getByTestId('calculation-step')).toContainText('STEP 1 OF');
  }
});

test('code panel runs real-width calculations and displays the actual source', async ({ page }) => {
  await page.goto('/error-detection/');
  await page.getByText('See the real code', { exact: true }).click();
  await page.getByRole('button', { name: 'Run real example' }).click();
  await expect(page.getByTestId('real-results')).toContainText('0xF62A');
  await expect(page.getByTestId('real-results')).toContainText('0xF4');
  await expect(page.getByLabel('Error detection algorithm source code')).toContainText('export function crc(');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('real-results')).toHaveCount(0);
});

test('checksum explains where each number comes from before doing the addition', async ({ page }) => {
  await page.goto('/error-detection/');
  await page.getByRole('group', { name: 'Error detection algorithm' }).getByRole('button', { name: /Checksum/ }).click();
  await expect(page.getByTestId('calculation')).toHaveText('Group 1: 1011\nGroup 2: 0010');
  await page.getByRole('button', { name: 'Next calculation step' }).click();
  await expect(page.getByTestId('calculation')).toContainText('1011 = 8 + 2 + 1 = 11');
  await expect(page.getByTestId('calculation')).toContainText('0010 = 2');
  await page.getByRole('button', { name: 'Next calculation step' }).click();
  await expect(page.getByRole('heading', { name: 'Start the total at zero', exact: true })).toBeVisible();
  await expect(page.getByTestId('calculation')).toHaveText('Total: 0000 (0)');
  await page.getByRole('button', { name: 'Next calculation step' }).click();
  await expect(page.getByTestId('calculation')).toContainText('Binary:  0000 + 1011 = 1011');
  await expect(page.getByTestId('calculation')).toContainText('Decimal: 0 + 11 = 11');
  await page.getByRole('button', { name: 'See the receiver’s check' }).click();
  await expect(page.getByTestId('calculation')).toContainText('Checksum group:  0010 (2)');
});

test('CRC-3 shows the divisor separately from its initial remainder and final XOR', async ({ page }) => {
  await page.goto('/error-detection/');
  await page.getByRole('group', { name: 'Error detection algorithm' }).getByRole('button', { name: /CRC/ }).click();
  const settings = page.getByLabel('CRC-3 teaching settings');
  await expect(settings).toContainText('x³ + x + 1');
  for (const [name, value] of [['Generator / divisor', '1011'], ['Initial remainder', '000'], ['Final XOR value', '000']]) {
    await expect(settings.locator('dl > div').filter({ has: page.getByText(name, { exact: true }) }).locator('dd')).toHaveText(value);
  }
  await expect(page.getByTestId('calculation')).toHaveText('Divisor: 1011\nInitial remainder: 000\nFinal XOR: 000');
});

test('Next stays under the same pointer through all checksum and CRC steps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const algorithm of ['Checksum', 'CRC']) {
      await page.goto('/error-detection/');
      await page.getByRole('group', { name: 'Error detection algorithm' }).getByRole('button', { name: new RegExp(algorithm) }).click();
      const next = page.getByRole('button', { name: 'Next calculation step' });
      await next.scrollIntoViewIfNeeded();
      const original = (await next.boundingBox())!;
      const scrollY = await page.evaluate(() => window.scrollY);
      let step = 1;
      while (await next.isEnabled()) {
        await page.mouse.click(original.x + original.width / 2, original.y + original.height / 2);
        await expect(page.getByTestId('calculation-step')).toContainText(`STEP ${++step} OF`);
        const current = (await next.boundingBox())!;
        expect(Math.abs(current.x - original.x)).toBeLessThan(.5);
        expect(Math.abs(current.y - original.y)).toBeLessThan(.5);
        expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
      }
    }
  }
});

test('Bit Lab fits mobile, tablet, and desktop including expanded code', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/error-detection/');
    await page.getByRole('group', { name: 'Error detection algorithm' }).getByRole('button', { name: /Checksum/ }).click();
    await expect(page.getByRole('button', { name: /^Flip check bit/ })).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/bit-lab-${width}.png`, fullPage: true });
    await page.getByText('See the real code', { exact: true }).click();
    await page.getByRole('button', { name: 'Run real example' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
