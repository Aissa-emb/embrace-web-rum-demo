// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

/**
 * Controlled issue triggers for Embrace workshop demos.
 *
 * Issues are activated via URL query params:
 *   ?issue=slow_checkout
 *   ?issue=checkout_500
 *   ?issue=js_error
 *   ?issue=abandoned_cart
 *   ?issue=recommendation_failure
 *   ?issue=none  (default / healthy)
 *
 * The value is persisted to localStorage so it survives page navigation.
 */

export type IssueType =
  | 'none'
  | 'slow_checkout'
  | 'checkout_500'
  | 'js_error'
  | 'abandoned_cart'
  | 'recommendation_failure';

const STORAGE_KEY = 'embrace_issue';

export function getActiveIssue(): IssueType {
  if (typeof window === 'undefined') return 'none';

  // URL param takes precedence
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('issue');
  if (fromUrl) {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl as IssueType;
  }

  // Fall back to localStorage
  return (localStorage.getItem(STORAGE_KEY) as IssueType) || 'none';
}

export function shouldTrigger(issueType: IssueType): boolean {
  return getActiveIssue() === issueType;
}

/**
 * Helper: artificial delay (ms). Used by slow_checkout trigger.
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
