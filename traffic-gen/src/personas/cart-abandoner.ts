import { S } from '../lib/selectors';
import type { Persona } from './index';

/**
 * Cart abandoner — adds to cart, views cart, then leaves without buying.
 * Weight: 20
 */
export const cartAbandoner: Persona = {
  name: 'cart-abandoner',
  weight: 20,
  run: async ({ page, log, rand, sleep, jitter }) => {
    log.info('Starting cart-abandoner persona');

    // Land on home
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await sleep(jitter(2500));
    await page.waitForSelector(S.productCard, { timeout: 15000 });

    // Browse a product
    const cards = await page.$$(S.productCard);
    if (cards.length === 0) throw new Error('No products found');
    const card = rand(cards);
    await card.click();

    await page.waitForSelector(S.productDetail, { timeout: 10000 });
    await sleep(jitter(4000));

    // Add to cart
    const addBtn = await page.waitForSelector(S.productAddToCart, { timeout: 5000 });
    await addBtn.click();
    log.info('Added product to cart');
    await sleep(jitter(1500));

    // Open cart dropdown
    await page.click(S.cartIcon);
    await page.waitForSelector(S.cartDropdown, { timeout: 5000 });
    await sleep(jitter(1000));

    // Go to cart page
    const goToCart = await page.waitForSelector(S.cartGoToShopping, { timeout: 5000 });
    await goToCart.click();
    await page.waitForURL('**/cart', { timeout: 10000 });

    // Stare at the cart for a while... then abandon
    await sleep(jitter(6000));

    // Maybe scroll up and down as if reconsidering
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(jitter(2000));
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(jitter(1500));

    // Leave the site (close context handles this)
    log.info('Cart-abandoner persona complete — abandoned cart');
  },
};
