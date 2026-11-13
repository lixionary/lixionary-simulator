import { expect, test } from '@playwright/test';

test('collection links to both independent simulators and back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  await page.locator('a[href="/apparent-annual-motion/"]').click();
  await expect(page.getByTestId('declination')).toContainText('+23.44');
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await page.locator('a[href="/4g-lte/"]').click();
  await expect(page.getByTestId('recovered-message')).toHaveAttribute('aria-label', 'Recovered message: HELLO 4G');
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
});

test('Sun controls link the date, declination, daylight, and observer latitude', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/apparent-annual-motion/');
  await expect(page.getByTestId('selected-date')).toHaveText('21 June 2026');
  await expect(page.getByTestId('noon-altitude')).toHaveText('73.4°');
  await expect(page.getByTestId('daylight')).toHaveText('14h 51m');
  await page.getByRole('button', { name: /^December solstice/ }).click();
  await expect(page.getByTestId('selected-date')).toHaveText('21 December 2026');
  await expect(page.getByTestId('declination')).toContainText('−23.44');
  await expect(page.getByTestId('noon-altitude')).toHaveText('26.6°');
  await expect(page.getByTestId('daylight')).toHaveText('9h 09m');
  await page.getByLabel('Start somewhere familiar').selectOption('-6.2');
  await expect(page.getByTestId('latitude-value')).toHaveText('6.2° S');
  await expect(page.getByTestId('noon-altitude')).toHaveText('72.8°');
  await page.getByLabel('Simulation date', { exact: true }).fill('2026-03-20');
  await expect(page.getByTestId('selected-date')).toHaveText('20 March 2026');
  await expect(page.getByRole('button', { name: /^March equinox/, exact: false }).first()).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('zero tilt, polar day, polar night, and reset produce usable outputs', async ({ page }) => {
  await page.goto('/apparent-annual-motion/');
  await page.getByRole('button', { name: 'Try zero tilt' }).click();
  await expect(page.getByTestId('declination')).toHaveText('+0.00°');
  await expect(page.getByTestId('daylight')).toHaveText('12h 00m');
  await expect(page.getByTestId('sunrise')).toHaveText('06:00');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(page.getByTestId('daylight')).toHaveText('12h 00m');
  await page.getByRole('button', { name: 'Chase the midnight Sun' }).click();
  await expect(page.getByTestId('daylight')).toHaveText('24h 00m');
  await expect(page.getByTestId('sunset')).toHaveText('—');
  await expect(page.getByText('Midnight Sun · no sunset')).toBeVisible();
  await page.getByRole('button', { name: /^December solstice/ }).click();
  await expect(page.getByTestId('daylight')).toHaveText('0h 00m');
  await expect(page.getByText('Polar night · no sunrise')).toBeVisible();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByTestId('latitude-value')).toHaveText('40.0° N');
  await expect(page.getByTestId('selected-date')).toHaveText('21 June 2026');
  await expect(page.getByTestId('declination')).toHaveText('+23.44°');
});

test('year playback pauses on date selection and wraps calendar boundaries', async ({ page }) => {
  await page.goto('/apparent-annual-motion/');
  await page.getByLabel('Simulation date', { exact: true }).fill('2026-12-31');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(page.getByTestId('selected-date')).toHaveText('1 January 2026');
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(page.getByTestId('selected-date')).toHaveText('31 December 2026');
  await page.getByLabel('Animation speed', { exact: true }).selectOption('30');
  await page.getByRole('button', { name: 'Play year animation' }).click();
  await expect(page.getByTestId('selected-date')).not.toHaveText('31 December 2026');
  await page.getByRole('button', { name: /^March equinox/ }).click();
  await expect(page.getByRole('button', { name: 'Play year animation' })).toBeVisible();
  await expect(page.getByTestId('selected-date')).toHaveText('20 March 2026');
});

test('celestial view, direct orbit selection, and keyboard controls work', async ({ page }) => {
  await page.goto('/apparent-annual-motion/');
  await page.getByRole('button', { name: 'Celestial view', exact: true }).click();
  await expect(page.getByRole('img', { name: /right ascension/ })).toBeVisible();
  await page.getByRole('button', { name: 'Earth’s orbit', exact: true }).click();
  await page.getByRole('button', { name: 'Jump to September equinox', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('selected-date')).toHaveText('23 September 2026');
  await page.getByLabel('Observer latitude', { exact: true }).focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('latitude-value')).toHaveText('90.0° S');
  await page.getByRole('checkbox', { name: /Compare northern/ }).uncheck();
  await expect(page.getByRole('checkbox', { name: /Compare northern/ })).not.toBeChecked();
  await page.getByText('Inside this teaching model', { exact: false }).click();
  await expect(page.getByText(/they are not civil clock times/)).toBeVisible();
});

test('collection and Sun layouts fit mobile, tablet, and desktop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', '/apparent-annual-motion/']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      if (width !== 768) await page.screenshot({ path: `test-results/${path === '/' ? 'collection' : 'sun'}-${width}.png`, fullPage: true });
    }
  }
});
