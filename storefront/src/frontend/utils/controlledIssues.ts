// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Controlled non-fatal issue injection for Embrace Web observability demos.
 *
 * These helpers create realistic JavaScript exceptions that are caught,
 * logged to Embrace, and silently recovered from — the app continues to
 * function normally. Each issue produces production-like error names,
 * messages, and stack traces so the Embrace session timeline looks
 * indistinguishable from real-world issues.
 *
 * Activation modes (highest priority first):
 *
 *   1. EXPLICIT — query param ?issue_variant=product_recommendation_error
 *      Forces a specific issue for that session (good for Playwright / manual QA).
 *
 *   2. AUTO — issues fire probabilistically on every relevant page.
 *      Enabled when NEXT_PUBLIC_AUTO_DEMO_ISSUES=true (env var) OR when the
 *      environment is local / demo / internal. Each issue has a configurable
 *      probability so hosted demos produce realistic, mixed data automatically.
 *
 *   3. OFF — no env flag set and environment is 'production'.
 *
 * Playwright usage:
 *   page.goto('/product/OLJCESPC7Z?issue_variant=product_recommendation_error&user_persona=broken_session_user')
 */

import { addBreadcrumb, logError, logWarning } from './embrace';

// ---------------------------------------------------------------------------
// Issue variant types
// ---------------------------------------------------------------------------

export type IssueVariant =
  | 'product_recommendation_error'
  | 'cart_price_mismatch'
  | 'checkout_validation_error'
  | 'profile_preferences_error';

const STORAGE_KEY = 'embrace_issue_variant';
const PERSONA_KEY = 'embrace_persona';
const FIRED_KEY_PREFIX = 'embrace_issue_fired_';

// Allowed environments — issues are suppressed in production unless explicitly enabled.
const ENABLED_ENVIRONMENTS = ['local', 'demo', 'internal'];

// ---------------------------------------------------------------------------
// Per-issue probability configuration
// Controls how often each issue fires automatically per session.
// Values are 0.0 (never) to 1.0 (always). Adjust to taste.
// ---------------------------------------------------------------------------

const AUTO_FIRE_PROBABILITY: Record<IssueVariant, number> = {
  product_recommendation_error: 0.35,  // 35% of product page views
  cart_price_mismatch: 0.30,           // 30% of cart views
  checkout_validation_error: 0.25,     // 25% of checkout attempts
  profile_preferences_error: 0.20,     // 20% of app startups
};

// ---------------------------------------------------------------------------
// Shared attributes attached to every captured issue
// ---------------------------------------------------------------------------

function getBaseAttributes(variant: IssueVariant, extras?: Record<string, string>): Record<string, string | number | boolean> {
  const persona =
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('user_persona')) ||
    (typeof window !== 'undefined' && localStorage.getItem(PERSONA_KEY)) ||
    'unknown';

  return {
    demo_name: 'otel_astronomy_shop',
    issue_variant: variant,
    issue_source: 'controlled_demo_issue',
    handled: true,
    user_persona: persona,
    ...extras,
  };
}

// ---------------------------------------------------------------------------
// Environment & variant detection
// ---------------------------------------------------------------------------

export function isDemoIssueEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  // Check explicit flags
  const envFlag = process.env.NEXT_PUBLIC_ENABLE_DEMO_ISSUES;
  if (envFlag === 'true') return true;

  const autoFlag = process.env.NEXT_PUBLIC_AUTO_DEMO_ISSUES;
  if (autoFlag === 'true') return true;

  // Fallback: enabled in local/demo/internal environments
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'local';
  return ENABLED_ENVIRONMENTS.includes(environment);
}

/**
 * Returns the explicitly requested issue variant from URL or localStorage,
 * or null if none was explicitly set.
 */
export function getDemoIssueVariant(): IssueVariant | null {
  if (typeof window === 'undefined') return null;
  if (!isDemoIssueEnabled()) return null;

  const params = new URLSearchParams(window.location.search);

  // URL param takes precedence
  const fromUrl = params.get('issue_variant');
  if (fromUrl) {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl as IssueVariant;
  }

  // Fall back to localStorage (persists across page navigations)
  return (localStorage.getItem(STORAGE_KEY) as IssueVariant) || null;
}

/**
 * Determines whether a specific issue should fire.
 *
 * Priority:
 *   1. If ?issue_variant= matches this variant → always fire
 *   2. If ?issue_variant= is set to a DIFFERENT variant → never fire
 *   3. If no explicit variant → roll the dice based on AUTO_FIRE_PROBABILITY
 *
 * Each issue fires at most once per session (tracked via sessionStorage)
 * to avoid spamming the Embrace timeline with duplicate errors.
 */
function shouldInject(variant: IssueVariant): boolean {
  if (typeof window === 'undefined') return false;
  if (!isDemoIssueEnabled()) return false;

  // Check if this specific issue already fired in this session
  const firedKey = FIRED_KEY_PREFIX + variant;
  if (sessionStorage.getItem(firedKey) === 'true') return false;

  // Explicit variant from URL or localStorage
  const explicitVariant = getDemoIssueVariant();
  if (explicitVariant) {
    // Explicit mode: only fire if it matches exactly
    return explicitVariant === variant;
  }

  // Auto mode: probabilistic firing
  const probability = AUTO_FIRE_PROBABILITY[variant];
  return Math.random() < probability;
}

/**
 * Mark an issue as "already fired" for this session so it doesn't repeat.
 */
function markAsFired(variant: IssueVariant): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FIRED_KEY_PREFIX + variant, 'true');
  } catch {
    // sessionStorage may be unavailable in some contexts
  }
}

// ---------------------------------------------------------------------------
// 1. Product recommendation error
//    Trigger: product detail page load
//    Effect:  recommendations silently fail, fallback content shown
// ---------------------------------------------------------------------------

interface RecommendationContext {
  productId?: string;
  page?: string;
}

/**
 * Simulates a TypeError in the recommendation loading pipeline.
 * Returns `true` if the issue was injected (caller should show fallback).
 */
export function maybeCaptureProductRecommendationError(context: RecommendationContext = {}): boolean {
  if (!shouldInject('product_recommendation_error')) return false;

  markAsFired('product_recommendation_error');
  addBreadcrumb('recommendations_load_started');

  try {
    const error = new TypeError(
      "Cannot read properties of undefined (reading 'recommendedProducts')"
    );
    error.name = 'TypeError';

    logError(error.message, {
      ...getBaseAttributes('product_recommendation_error', {
        page: context.page || '/product/[productId]',
        product_id: context.productId || 'unknown',
        component: 'Recommendations',
        function: 'loadRecommendations',
      }),
    });
  } catch {
    // Safety net — never let issue injection itself crash the app
  }

  addBreadcrumb('recommendations_fallback_used');
  return true;
}

// ---------------------------------------------------------------------------
// 2. Cart price mismatch error
//    Trigger: cart page load or after adding a product
//    Effect:  cart renders normally, but a price normalization error is logged
// ---------------------------------------------------------------------------

interface CartPriceContext {
  cartId?: string;
  itemCount?: number;
  currency?: string;
  page?: string;
}

/**
 * Simulates a RangeError in the cart subtotal normalization routine.
 * The cart still displays correctly — the error is logged as a
 * non-fatal issue that would normally indicate a currency conversion bug.
 */
export function maybeCaptureCartPriceMismatchError(context: CartPriceContext = {}): void {
  if (!shouldInject('cart_price_mismatch')) return;

  markAsFired('cart_price_mismatch');
  addBreadcrumb('cart_subtotal_calculation_started');

  try {
    const currency = context.currency || 'USD';
    const error = new RangeError(
      `Failed to normalize cart subtotal for currency ${currency}`
    );
    error.name = 'RangeError';

    logError(error.message, {
      ...getBaseAttributes('cart_price_mismatch', {
        page: context.page || '/cart',
        cart_id: context.cartId || 'unknown',
        item_count: String(context.itemCount ?? 0),
        currency,
        component: 'CartDetail',
        function: 'normalizeCartSubtotal',
      }),
    });
  } catch {
    // Safety net
  }

  addBreadcrumb('cart_subtotal_fallback_used');
}

// ---------------------------------------------------------------------------
// 3. Checkout validation error
//    Trigger: during checkout form submission
//    Effect:  checkout still proceeds with native HTML validation as fallback
// ---------------------------------------------------------------------------

interface CheckoutValidationContext {
  page?: string;
  formFields?: Record<string, string>;
}

/**
 * Simulates a shipping address validation failure from an internal
 * validation service. The checkout form falls back to native browser
 * validation and still allows the user to complete their order.
 */
export function maybeCaptureCheckoutValidationError(context: CheckoutValidationContext = {}): void {
  if (!shouldInject('checkout_validation_error')) return;

  markAsFired('checkout_validation_error');
  addBreadcrumb('checkout_validation_started');

  try {
    const error = new Error(
      'Shipping address validation returned an invalid schema'
    );
    error.name = 'Error';

    logError(error.message, {
      ...getBaseAttributes('checkout_validation_error', {
        page: context.page || '/cart',
        component: 'CheckoutForm',
        function: 'validateShippingAddress',
      }),
    });
  } catch {
    // Safety net
  }

  addBreadcrumb('checkout_validation_fallback_used');
}

// ---------------------------------------------------------------------------
// 4. User preferences error
//    Trigger: app startup / home page load
//    Effect:  app continues with default preferences
// ---------------------------------------------------------------------------

interface PreferencesContext {
  page?: string;
}

/**
 * Simulates a SyntaxError when parsing user preferences from localStorage.
 * The app falls back to default settings seamlessly.
 */
export function maybeCaptureUserPreferencesError(context: PreferencesContext = {}): void {
  if (!shouldInject('profile_preferences_error')) return;

  markAsFired('profile_preferences_error');
  addBreadcrumb('user_preferences_load_started');

  try {
    const error = new SyntaxError(
      'Failed to parse stored user preferences'
    );
    error.name = 'SyntaxError';

    logWarning(error.message, {
      ...getBaseAttributes('profile_preferences_error', {
        page: context.page || '/',
        component: 'App',
        function: 'loadUserPreferences',
      }),
    });
  } catch {
    // Safety net
  }

  addBreadcrumb('user_preferences_fallback_used');
}
