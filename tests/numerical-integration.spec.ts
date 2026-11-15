import { expect, test, type Page } from '@playwright/test';

const open = (page: Page, preset?: string) => page.goto(preset ? `/numerical-integration/?preset=${preset}` : '/numerical-integration/');
const stage = (page: Page, name: RegExp) => page.getByRole('navigation', { name: 'Stages' }).getByRole('button', { name });
const rule = (page: Page, name: string) => page.getByRole('group', { name: 'Rule' }).getByRole('button', { name });
const table = (page: Page, row: number) => page.getByTestId('ni-table').locator('tbody tr').nth(row).locator('td');

test('collection opens Integral Lab and returns', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('12 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/numerical-integration/"]').click();
  await expect(page).toHaveTitle('Integral Lab · Lixionary Simulators');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Some areas have a formula.');
  await expect(page.getByTestId('ni-exact')).toHaveText('2.6666667');
  await expect(page.getByTestId('ni-value')).toHaveText('2.1875000');
  await expect(page.getByTestId('ni-error')).toHaveText('−0.479');
  await expect(page.getByTestId('ni-relative')).toHaveText('17.97%');
  await expect(page.getByTestId('ni-evaluations')).toHaveText('8');
  await expect(page.getByTestId('ni-curve')).toHaveAttribute('data-slices', '8');
  await expect(page.getByTestId('ni-errors')).toBeVisible();
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('each rule has its own error and its own rate of improvement', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('ni-ratio')).toHaveText('÷ 1.96');
  await expect(page.getByTestId('ni-bound')).toHaveText('1.0 × 10⁰');
  await expect(page.getByTestId('ni-verdict')).toContainText('too small');
  await rule(page, 'Right rectangles').click();
  await expect(page.getByTestId('ni-value')).toHaveText('3.1875000');
  await expect(page.getByTestId('ni-verdict')).toContainText('too large');
  await rule(page, 'Midpoint rectangles').click();
  await expect(page.getByTestId('ni-error')).toHaveText('−0.0104');
  await expect(page.getByTestId('ni-ratio')).toHaveText('÷ 4.00');
  await rule(page, 'Trapezoids').click();
  await expect(page.getByTestId('ni-error')).toHaveText('0.0208');
  await expect(page.getByTestId('ni-evaluations')).toHaveText('9');
  await rule(page, 'Simpson’s parabolas').click();
  await expect(page.getByTestId('ni-error')).toHaveText('0');
  await expect(page.getByTestId('ni-ratio')).toHaveText('—');
  await expect(page.getByTestId('ni-verdict')).toContainText('exactly the same area');
});

test('doubling the slices follows the table', async ({ page }) => {
  await open(page, 'simpson');
  await expect(page.getByTestId('ni-exact')).toHaveText('2.0000000');
  await expect(page.getByTestId('ni-error')).toHaveText('2.7 × 10⁻⁴');
  await expect(table(page, 0)).toHaveText(['8', '2.000269170', '2.7 × 10⁻⁴', '']);
  await expect(table(page, 1)).toHaveText(['16', '2.000016591', '1.7 × 10⁻⁵', '÷ 16.2']);
  await page.getByRole('button', { name: 'Double the slices' }).click();
  await expect(page.getByTestId('ni-curve')).toHaveAttribute('data-slices', '16');
  await expect(page.getByTestId('ni-value')).toHaveText('2.0000166');
  await expect(page.getByTestId('ni-evaluations')).toHaveText('17');
  await page.getByRole('button', { name: 'Halve' }).click();
  await page.getByRole('button', { name: 'Halve' }).click();
  await expect(page.getByTestId('ni-curve')).toHaveAttribute('data-slices', '4');
  await page.getByRole('slider', { name: 'Slices' }).fill('17');
  await expect(page.getByTestId('ni-evaluations')).toHaveText('513');
  await expect(page.getByRole('button', { name: 'Double the slices' })).toBeDisabled();
  await page.getByRole('slider', { name: 'Slices' }).fill('0');
  await expect(page.getByTestId('ni-curve')).toHaveAttribute('data-slices', '2');
  await expect(page.getByRole('button', { name: 'Halve' })).toBeDisabled();
});

test('the curve and its interval can be changed', async ({ page }) => {
  await open(page);
  await page.getByRole('combobox', { name: 'Area under' }).selectOption('exp');
  await expect(page.getByTestId('ni-exact')).toHaveText('6.3890561');
  await page.getByLabel('To', { exact: true }).fill('1');
  await expect(page.getByTestId('ni-exact')).toHaveText('1.7182818');
  await page.getByLabel('From', { exact: true }).fill('2');
  await expect(page.locator('output', { hasText: 'x = 2.1' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Area under' }).selectOption('root');
  await rule(page, 'Simpson’s parabolas').click();
  await expect(page.getByTestId('ni-ratio')).toHaveText('÷ 2.83');
  await expect(page.getByTestId('ni-bound')).toHaveText('None');
  await open(page, 'periodic');
  await expect(page.getByTestId('ni-error')).toHaveText('0');
  await open(page, 'pi');
  await expect(page.getByTestId('ni-value')).toHaveText('0.78539813');
});

test('curves with no formula still get an answer and an error estimate', async ({ page }) => {
  await open(page, 'bell');
  await expect(page.getByTestId('ni-formula')).toHaveText('None');
  await expect(page.getByText('the error function, erf')).toBeVisible();
  await expect(page.getByTestId('ni-value')).toHaveText('0.68271098');
  await expect(page.getByTestId('ni-reference')).toHaveText('0.682689492137');
  await expect(page.getByTestId('ni-estimate')).toHaveText('2.0 × 10⁻⁵');
  await expect(page.getByTestId('ni-error')).toHaveText('2.1 × 10⁻⁵');
  await expect(page.getByTestId('ni-six')).toHaveText('32');
  await expect(page.getByTestId('ni-twelve')).toHaveText('1,024');
  await expect(page.getByTestId('ni-meaning')).toContainText('68.27% of a normal population');
  await expect(page.getByTestId('ni-area')).toBeVisible();
  await expect(page.getByTestId('ni-selfcheck')).toBeVisible();
  await rule(page, 'Left rectangles').click();
  await expect(page.getByTestId('ni-twelve')).toHaveText('Over 65,536');
  await page.getByLabel('To', { exact: true }).fill('2');
  await page.getByLabel('From', { exact: true }).fill('-2');
  await expect(page.getByTestId('ni-reference')).toHaveText('0.954499736104');
});

test('the pendulum, the ellipse, and the primes', async ({ page }) => {
  await open(page, 'pendulum');
  await expect(page.getByTestId('ni-value')).toHaveText('2.3682463');
  await expect(page.getByTestId('ni-twelve')).toHaveText('8');
  await expect(page.getByTestId('ni-meaning')).toContainText('15.3% too short');
  await expect(page.getByLabel('From', { exact: true })).toHaveCount(0);
  await page.getByLabel('Swing to each side').fill('10');
  await expect(page.getByTestId('ni-meaning')).toContainText('0.2% too short');
  await page.getByRole('combobox', { name: 'Area under' }).selectOption('ellipse');
  await page.getByLabel('Short axis ÷ long axis').fill('1');
  await expect(page.getByTestId('ni-reference')).toHaveText('6.28318530718');
  await expect(page.getByTestId('ni-meaning')).toContainText('A circle');
  await open(page, 'primes');
  await expect(page.getByTestId('ni-meaning')).toContainText('really 25 primes from 2 to 100');
  await expect(page.getByText('the logarithmic integral, li')).toBeVisible();
});

test('a speed log becomes a distance, and noise mostly cancels', async ({ page }) => {
  await open(page, 'speed-log');
  await expect(page.getByTestId('ni-readings')).toHaveText('121');
  await expect(page.getByTestId('ni-distance')).toHaveText('879.5 m');
  await expect(page.getByTestId('ni-trip-error')).toHaveText('0.0 m');
  await expect(page.getByTestId('ni-data-formula')).toHaveText('None');
  await expect(page.getByRole('button', { name: 'Drive it again' })).toBeDisabled();
  await page.getByLabel('Time between readings').fill('6');
  await expect(page.getByTestId('ni-trip')).toHaveAttribute('data-readings', '7');
  await expect(page.getByTestId('ni-distance')).toHaveText('959.0 m');
  await expect(page.getByTestId('ni-coarse')).toHaveText('79.5 m');
  await open(page, 'noisy');
  await expect(page.getByTestId('ni-reading-noise')).toHaveText('20%');
  await expect(page.getByTestId('ni-total-noise')).toHaveText('1.96%');
  await expect(page.getByTestId('ni-trip-error')).toHaveText('−15.6 m');
  await page.getByRole('button', { name: 'Drive it again' }).click();
  await expect(page.getByTestId('ni-trip-error')).not.toHaveText('−15.6 m');
  await expect(page.getByTestId('ni-total-noise')).toHaveText('1.96%');
  await expect(page.getByTestId('ni-repeats').locator('circle')).toHaveCount(60);
});

test('an adaptive rule reaches the accuracy with less work', async ({ page }) => {
  await open(page, 'adaptive');
  await expect(page.getByTestId('ni-spike-exact')).toHaveText('0.015600718');
  await expect(page.getByTestId('ni-tolerance')).toHaveText('1 × 10⁻⁶');
  await expect(page.getByTestId('ni-adaptive-evals')).toHaveText('161');
  await expect(page.getByTestId('ni-even-evals')).toHaveText('1,025');
  await expect(page.getByTestId('ni-saving')).toHaveText('× 6.37');
  await expect(page.getByTestId('ni-curve').locator('[data-rug]')).toHaveAttribute('data-count', '161');
  await expect(page.getByText('Within what was asked.')).toHaveCount(2);
  await page.getByLabel('Accuracy asked for').fill('8');
  await expect(page.getByTestId('ni-adaptive-evals')).toHaveText('501');
  await expect(page.getByTestId('ni-even-evals')).toHaveText('2,049');
  await expect(page.getByTestId('ni-prices').locator('tbody tr')).toHaveCount(5);
  await page.getByLabel('Spike half-width').fill('0.02');
  await expect(page.getByTestId('ni-adaptive-evals')).toHaveText('441');
});

test('three ways a numeric rule is fooled', async ({ page }) => {
  await open(page, 'missed-spike');
  await expect(page.getByTestId('ni-exact')).toHaveText('0.012497733');
  await expect(page.getByTestId('ni-relative')).toHaveText('90.31%');
  await open(page, 'blow-up');
  await expect(page.getByTestId('ni-value')).toHaveText('1.8488567');
  await expect(page.getByTestId('ni-ratio')).toHaveText('÷ 1.41');
  await rule(page, 'Trapezoids').click();
  await expect(page.getByTestId('ni-value')).toHaveText('∞');
  await expect(page.getByTestId('ni-verdict')).toContainText('where it is infinite');
  await page.getByRole('group', { name: 'Situation' }).getByRole('button', { name: 'Where it is fooled' }).focus();
  await page.getByRole('combobox', { name: 'Area under' }).selectOption('alias');
  await expect(page.getByTestId('ni-value')).toHaveText('2.0000000');
  await expect(page.getByTestId('ni-relative')).toHaveText('100.00%');
  await page.getByRole('slider', { name: 'Slices' }).fill('8');
  await expect(page.getByTestId('ni-error')).toHaveText('0');
});

test('the chain and the situations keep what was built', async ({ page }) => {
  await open(page);
  await rule(page, 'Trapezoids').click();
  await stage(page, /No formula/).click();
  await expect(page.getByTestId('ni-formula')).toHaveText('None');
  await expect(page.getByTestId('ni-notice')).toContainText('another part of the lab');
  await stage(page, /In practice/).click();
  await expect(page.getByTestId('ni-readings')).toHaveText('121');
  await page.getByRole('button', { name: 'Accuracy on demand' }).click();
  await expect(page.getByTestId('ni-adaptive-evals')).toHaveText('161');
  await page.getByRole('button', { name: 'Where it is fooled' }).click();
  await expect(page.getByTestId('ni-exact')).toHaveText('0.012497733');
  await stage(page, /Against the formula/).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('ni-value')).toHaveText('2.6875000');
});

test('preset links open an experiment and reject unknown names', async ({ page }) => {
  await open(page, 'alias');
  await expect(page.getByTestId('ni-value')).toHaveText('2.0000000');
  await expect(page.getByLabel('Start with an experiment')).toHaveValue('alias');
  await open(page, 'antiderivative-of-everything');
  await expect(page.getByText('That link names an experiment')).toBeVisible();
  await expect(page.getByTestId('ni-value')).toHaveText('2.1875000');
  await page.getByLabel('Start with an experiment').selectOption('ellipse');
  await expect(page).toHaveURL(/preset=ellipse/);
  await expect(page.getByText('That link names an experiment')).toHaveCount(0);
  await page.getByText('Inside the model').click();
  await expect(page.getByText(/five-point Gauss–Legendre quadrature/)).toBeVisible();
});

for (const width of [390, 1280]) test(`fits a ${width}px viewport`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  for (const preset of ['rectangles', 'primes', 'noisy', 'adaptive', 'blow-up']) {
    await open(page, preset);
    await expect(page.locator('.ni-picture')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
});
