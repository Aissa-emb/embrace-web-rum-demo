/**
 * Centralized selectors for the Astronomy Shop storefront.
 * Uses data-cy attributes from the OTel demo's CypressFields enum,
 * with role-based fallbacks where needed.
 */
export const S = {
  // Navigation & Layout
  homePage: '[data-cy="home-page"]',
  cartIcon: '[data-cy="cart-icon"]',
  cartItemCount: '[data-cy="cart-item-count"]',
  currencySwitcher: '[data-cy="currency-switcher"]',

  // Product List (home page)
  productList: '[data-cy="product-list"]',
  productCard: '[data-cy="product-card"]',
  hotProducts: '[data-cy="hot-products"]',

  // Product Detail
  productDetail: '[data-cy="product-detail"]',
  productName: '[data-cy="product-name"]',
  productDescription: '[data-cy="product-description"]',
  productPrice: '[data-cy="product-price"]',
  productPicture: '[data-cy="product-picture"]',
  productQuantity: '[data-cy="product-quantity"]',
  productAddToCart: '[data-cy="product-add-to-cart"]',

  // Cart Dropdown
  cartDropdown: '[data-cy="cart-dropdown"]',
  cartDropdownItem: '[data-cy="cart-dropdown-item"]',
  cartGoToShopping: '[data-cy="cart-go-to-shopping"]',

  // Cart Page / Checkout
  checkoutItem: '[data-cy="checkout-item"]',
  checkoutPlaceOrder: '[data-cy="checkout-place-order"]',

  // Checkout Form Fields (by id)
  checkoutEmail: '#email',
  checkoutStreetAddress: '#street_address',
  checkoutZipCode: '#zip_code',
  checkoutCity: '#city',
  checkoutState: '#state',
  checkoutCountry: '#country',
  checkoutCreditCardNumber: '#credit_card_number',
  checkoutCreditCardExpMonth: '#credit_card_expiration_month',
  checkoutCreditCardExpYear: '#credit_card_expiration_year',
  checkoutCreditCardCvv: '#credit_card_cvv',

  // Recommendations
  recommendationList: '[data-cy="recommendation-list"]',

  // Ad
  ad: '[data-cy="ad"]',
} as const;
