import { S } from '../lib/selectors';
import type { Persona } from './index';

/**
 * Buyer persona — full happy-path: browse → add to cart → checkout → complete.
 * Weight: 20
 */
export const buyer: Persona = {
  name: 'buyer',
  weight: 20,
  run: async ({ page, log, rand, sleep, jitter }) => {
    log.info('Starting buyer persona');

    // Land on home
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(2000));
    await page.waitForSelector(S.productCard, { timeout: 15000 });

    // Click a random product
    const cards = await page.$$(S.productCard);
    if (cards.length === 0) throw new Error('No products found');
    const card = rand(cards);
    await card.click();

    // View product detail
    await page.waitForSelector(S.productDetail, { timeout: 30000 });
    await sleep(jitter(5000));

    // Add to cart
    const addBtn = await page.waitForSelector(S.productAddToCart, { timeout: 15000 });
    await addBtn.click();
    log.info('Added product to cart');
    await sleep(jitter(1500));

    // Navigate to cart page directly (dropdown button is unreliable on mobile viewports)
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(2000));

    // Fill checkout form
    await fillCheckoutForm(page, sleep, jitter);

    // Place order
    const placeOrder = await page.waitForSelector(S.checkoutPlaceOrder, { timeout: 15000 });
    await placeOrder.click();
    log.info('Placed order');

    // Wait for order confirmation (may timeout under throttling — order still placed)
    try {
      await page.waitForURL('**/cart/checkout/**', { timeout: 30000, waitUntil: 'domcontentloaded' });
      await sleep(jitter(3000));
    } catch {
      log.warn('Checkout confirmation page timed out (order was still placed)');
    }

    log.info('Buyer persona complete — order placed');
  },
};

async function fillCheckoutForm(
  page: import('playwright').Page,
  sleep: (ms: number) => Promise<void>,
  jitter: (ms: number) => number
): Promise<void> {
  const fields = [
    { selector: S.checkoutEmail, value: `user${Date.now()}@example.com` },
    { selector: S.checkoutStreetAddress, value: '1600 Amphitheatre Parkway' },
    { selector: S.checkoutZipCode, value: '94043' },
    { selector: S.checkoutCity, value: 'Mountain View' },
    { selector: S.checkoutState, value: 'CA' },
    { selector: S.checkoutCreditCardNumber, value: '4432-8015-6152-0454' },
    { selector: S.checkoutCreditCardCvv, value: '672' },
  ];

  for (const field of fields) {
    const el = await page.waitForSelector(field.selector, { timeout: 15000 });
    await el.fill('');
    await el.type(field.value, { delay: jitter(50) });
    await sleep(jitter(400));
  }

  // Country is a text input, not a select
  const countryEl = await page.waitForSelector(S.checkoutCountry);
  await countryEl.fill('');
  await countryEl.type('United States', { delay: jitter(50) });
  await sleep(jitter(300));

  // Select expiration month and year (use option values, not display text)
  await page.selectOption(S.checkoutCreditCardExpMonth, '1');
  await sleep(jitter(200));
  await page.selectOption(S.checkoutCreditCardExpYear, '2030');
  await sleep(jitter(200));
}
