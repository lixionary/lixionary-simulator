import { expect, test, type Page } from '@playwright/test';
const current = (page: Page) => page.locator('.pl-current');
async function end(page: Page) { await page.getByRole('slider', { name: 'Journey step' }).focus(); await page.keyboard.press('End'); }
async function inspector(page: Page) { await page.locator('.pl-inspector > summary').click(); }
async function timeline(page: Page) { await page.locator('.pl-timeline > summary').click(); }

test('collection opens Packet Lab; all seven layers are interactive and return link works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('09 SIMULATORS · ENDLESS WHAT-IFS')).toBeVisible();
  await page.locator('a[href="/osi/"]').click();
  await expect(page).toHaveTitle('Packet Lab — OSI Seven Layers');
  await expect(current(page)).toContainText('SYN · open a connection');
  for (const n of [7, 6, 5, 4, 3, 2, 1]) {
    await page.getByRole('button', { name: new RegExp(`^client layer ${n}:`) }).click();
    await expect(page.locator('.pl-layer-number')).toHaveText('0' + n);
  }
  await page.getByRole('button', { name: 'client layer 6: Presentation', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected layer' })).toContainText('no extra layer-6 header or TLS');
  await page.getByRole('link', { name: 'All simulators', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your little lab' })).toBeVisible();
});

test('TCP fields, editable request, backward/forward navigation, complete clean exchange', async ({ page }) => {
  await page.goto('/osi/');
  await page.getByLabel('HTTP request path').fill('/learn?topic=osi');
  await page.getByLabel('Jump to a packet').selectOption('request');
  await expect(current(page)).toContainText('HTTP GET /learn?topic=osi');
  await inspector(page);
  await expect(page.locator('.pl-field-grid')).toContainText('GET /learn?topic=osi HTTP/1.1');
  await expect(page.locator('.pl-field-grid')).toContainText('49152 → 80');
  await expect(page.locator('.pl-check-result')).toContainText('Received FCS matches');
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(current(page)).toContainText('Presentation');
  await page.getByRole('button', { name: 'Previous step', exact: true }).click();
  await expect(current(page)).toContainText('Client · Application');
  await end(page);
  await expect(current(page)).toContainText('Journey complete');
  await expect(page.getByRole('button', { name: 'client layer 7: Application', exact: true })).toHaveClass(/active/);
  await expect(page.locator('.pl-field-grid')).toContainText('HTTP/1.1 200 OK');
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeDisabled();
});

test('bad FCS stops at layer two, then TCP retransmits identical bytes and completes', async ({ page }) => {
  await page.goto('/osi/');
  await page.getByRole('button', { name: 'Corrupt first request frame', exact: true }).click();
  await timeline(page);
  await page.getByRole('button', { name: /Bad FCS · discard frame/ }).click();
  await expect(current(page)).toContainText('no IPv4 packet, transport data, or application message is delivered');
  await inspector(page);
  await expect(page.locator('.pl-check-result')).toContainText('Received FCS fails');
  await page.getByRole('button', { name: 'Hex bytes', exact: true }).click();
  await expect(page.getByLabel('Show decoded receive bytes')).toBeChecked();
  await expect(page.locator('.pl-hex button.changed')).toHaveCount(1);
  await page.getByRole('button', { name: /No ACK · retransmission timeout/ }).click();
  await expect(current(page)).toContainText('same sequence number');
  await page.getByLabel('Jump to a packet').selectOption('retry');
  await page.getByRole('button', { name: 'Packet fields', exact: true }).click();
  await expect(page.locator('.pl-check-result')).toContainText('Received FCS matches');
  await end(page);
  await expect(current(page)).toContainText('Journey complete');
});

test('UDP switches to DNS port 53; corruption/drop time out without retry and clean delivery returns an answer', async ({ page }) => {
  await page.goto('/osi/');
  await page.getByRole('button', { name: /UDP DNS/ }).click();
  await expect(page.getByLabel('DNS query name')).toHaveValue('lab.test');
  await expect(page.getByLabel('HTTP request path')).toHaveCount(0);
  await page.getByLabel('DNS query name').fill('learn.test');
  await inspector(page);
  await expect(page.locator('.pl-field-grid')).toContainText('49152 → 53');
  await page.getByLabel('Jump to a packet').selectOption('response');
  await expect(page.locator('.pl-field-grid')).toContainText('192.0.2.42');
  await end(page);
  await expect(current(page)).toContainText('Journey complete');
  for (const fault of ['Corrupt first request frame', 'Drop first request frame']) {
    await page.getByRole('button', { name: fault, exact: true }).click();
    await end(page);
    await expect(current(page)).toContainText('DNS application timeout');
    await expect(current(page)).toContainText('application-level retries are disabled');
    await expect(page.getByLabel('Jump to a packet').locator('option')).toHaveCount(1);
  }
});

test('selecting hex bytes locates Manchester and MLT-3 signals; PHY switch resets the journey', async ({ page }) => {
  await page.goto('/osi/');
  await timeline(page);
  await page.locator('.pl-timeline button').filter({ hasText: 'Client · Data link' }).first().click();
  await inspector(page);
  await page.getByRole('button', { name: 'Hex bytes', exact: true }).click();
  await page.getByRole('button', { name: 'Byte 12: 08, link', exact: true }).click();
  await expect(page.getByLabel('Signal frame byte', { exact: true })).toHaveValue('12');
  await expect(page.getByRole('img', { name: 'Manchester waveform for frame byte 12', exact: true })).toBeVisible();
  await expect(page.locator('.pl-signal-values')).toContainText('00010000');
  await page.getByLabel('Ethernet physical layer', { exact: true }).selectOption('100base-tx');
  await expect(current(page)).toContainText('SYN · open a connection');
  await expect(page.getByRole('img', { name: 'MLT-3 waveform for frame byte 0', exact: true })).toBeVisible();
  await expect(page.locator('.pl-inspector-body')).toContainText('125 million code bits/s');
  await page.getByLabel('Signal frame byte', { exact: true }).fill('12');
  await expect(page.locator('.pl-signal-values')).toContainText('1000 → 10010');
});

test('input validation stops playback; changing configuration and Reset clear progress', async ({ page }) => {
  await page.goto('/osi/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect(current(page)).toContainText('SYN + ACK');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByLabel('HTTP request path').fill('invalid path');
  await expect(page.getByRole('alert')).toContainText('Use a path beginning with /');
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /UDP DNS/ }).click();
  await page.getByLabel('DNS query name').fill('bad..test');
  await expect(page.getByRole('alert')).toContainText('Use a domain');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('HTTP request path')).toHaveValue('/');
  await expect(page.getByLabel('Ethernet physical layer')).toHaveValue('10base-t');
  await expect(current(page)).toContainText('SYN · open a connection');
});

test('TCP drop waits then retries; keyboard controls work with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/osi/');
  await page.getByRole('button', { name: 'Drop first request frame', exact: true }).click();
  await timeline(page);
  await page.getByRole('button', { name: /Frame lost in transit/ }).click();
  await expect(current(page)).toContainText('never arrives');
  await page.getByRole('button', { name: 'Next step', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(current(page)).toContainText('No ACK · retransmission timeout');
  await page.getByRole('button', { name: 'client layer 2: Data link', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pl-layer-number')).toHaveText('02');
  await end(page);
  await expect(current(page)).toContainText('Journey complete');
});

for (const width of [390, 768, 1440]) test(`responsive layout and inspector at ${width}px`, async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/osi/');
  await expect(page.getByRole('heading', { name: 'One message. Seven little layers.' })).toBeVisible();
  await inspector(page);
  await page.getByRole('button', { name: 'Copper signal', exact: true }).click();
  await expect(page.getByRole('img', { name: /Manchester waveform/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`packet-lab-${width}.png`), fullPage: true });
});


for (const protocol of ['tcp', 'udp'] as const) for (const packet of ['request', 'response'] as const) {
  test(`${protocol} ${packet}: hex bytes follow encapsulation down and decapsulation up`, async ({ page }) => {
    await page.goto('/osi/');
    if (protocol === 'udp') await page.getByRole('button', { name: /UDP DNS/ }).click();
    await page.getByLabel('Jump to a packet').selectOption(packet);
    await inspector(page);
    await page.getByRole('button', { name: 'Hex bytes', exact: true }).click();
    const hexView = page.locator('.pl-hex');
    const payloadSize = await hexView.locator('button').count();
    expect(payloadSize).toBeGreaterThan(0);
    const transportSize = protocol === 'tcp' ? 20 : 8;
    async function expectLayer(layer: number) {
      const expectedSize = layer >= 5 ? payloadSize : layer === 4 ? payloadSize + transportSize : layer === 3 ? payloadSize + transportSize + 20 : Math.max(64, payloadSize + transportSize + 38);
      const name = layer <= 2 ? 'Ethernet frame' : layer === 3 ? 'IPv4 packet' : layer === 4 ? protocol === 'tcp' ? 'TCP segment' : 'UDP datagram' : protocol === 'tcp' ? 'HTTP message' : 'DNS message';
      await expect(hexView).toHaveAttribute('aria-label', name + ' bytes');
      await expect(hexView.locator('button')).toHaveCount(expectedSize);
      await expect(hexView.locator('button.link')).toHaveCount(layer <= 2 ? 14 : 0);
      await expect(hexView.locator('button.fcs')).toHaveCount(layer <= 2 ? 4 : 0);
      await expect(hexView.locator('button.network')).toHaveCount(layer <= 3 ? 20 : 0);
      await expect(hexView.locator('button.transport')).toHaveCount(layer <= 4 ? transportSize : 0);
      await expect(hexView.locator('button.application')).toHaveCount(payloadSize);
      await expect(hexView.locator('button').first()).toHaveAccessibleName(/^Byte 0:/);
      await expect(page.locator('.pl-check-math')).toHaveCount(layer <= 2 ? 1 : 0);
    }
    // Sender: add only the current layer's header.
    for (const layer of [7, 6, 5, 4, 3, 2, 1]) {
      await expectLayer(layer);
      if (layer === 4) {
        await page.getByRole('button', { name: 'client layer 2: Data link', exact: true }).click();
        await expectLayer(4); // Exploring a layer does not advance the actual packet.
      }
      await page.getByRole('button', { name: 'Next step', exact: true }).click();
    }
    await expectLayer(1); // On the cable.
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    // Receiver: discard each enclosing header before moving upward.
    for (const layer of [1, 2, 3, 4, 5, 6, 7]) {
      await expectLayer(layer);
      await expect(page.getByLabel('Show decoded receive bytes')).toBeChecked();
      if (layer < 7) await page.getByRole('button', { name: 'Next step', exact: true }).click();
    }
    // Backward navigation restores the transport and IP envelopes.
    for (let n = 0; n < 4; n++) await page.getByRole('button', { name: 'Previous step', exact: true }).click();
    await expectLayer(3);
  });
}

test('transport hex byte zero maps to the correct frame offset in the transmitted signal', async ({ page }) => {
  await page.goto('/osi/');
  await inspector(page);
  await page.getByRole('button', { name: 'Hex bytes', exact: true }).click();
  await expect(page.locator('.pl-hex button')).toHaveCount(20); // SYN: only the TCP header.
  await expect(page.locator('.pl-hex button.link')).toHaveCount(0);
  await page.getByRole('button', { name: 'Byte 0: C0, transport', exact: true }).click();
  await expect(page.getByLabel('Signal frame byte', { exact: true })).toHaveValue('34');
  await expect(page.getByRole('img', { name: 'Manchester waveform for frame byte 34', exact: true })).toBeVisible();
});
