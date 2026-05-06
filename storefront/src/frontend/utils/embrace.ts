// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import { initSDK, session, log } from '@embrace-io/web-sdk';
import { trace, SpanStatusCode, Span } from '@opentelemetry/api';
import { getActiveIssue } from './issueTriggers';

const EMBRACE_APP_ID = process.env.NEXT_PUBLIC_EMBRACE_APP_ID || '';
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'otel-demo-local-0.1';
const ENVIRONMENT = process.env.NEXT_PUBLIC_ENVIRONMENT || 'local';

let initialized = false;
const activeSpans: Map<string, Span> = new Map();

/**
 * Initialize the Embrace SDK. Safe to call multiple times — only runs once.
 * Must be called in a browser context (typeof window !== 'undefined').
 */
export function initEmbrace() {
  if (initialized || typeof window === 'undefined') return;

  if (!EMBRACE_APP_ID) {
    console.warn('[embrace] NEXT_PUBLIC_EMBRACE_APP_ID not set; skipping init');
    return;
  }

  initSDK({
    appID: EMBRACE_APP_ID,
  });

  // Set baseline session properties
  session.addProperty('environment', ENVIRONMENT);
  session.addProperty('app_version', APP_VERSION);

  // Read persona from URL query params (support both 'persona' and 'user_persona')
  const params = new URLSearchParams(window.location.search);
  const persona = params.get('user_persona') || params.get('persona') || 'new_visitor';
  const issue = params.get('issue') || 'none';
  const issueVariant = params.get('issue_variant') || 'none';

  // Read run_source from URL (set by traffic-gen) or localStorage (persisted across nav)
  const runSource =
    params.get('run_source') ||
    localStorage.getItem('embrace_run_source') ||
    'organic';

  session.addProperty('user_persona', persona);
  session.addProperty('active_issue', issue);
  session.addProperty('issue_variant', issueVariant);
  session.addProperty('run_source', runSource);

  // Persist to localStorage so values survive page navigation
  if (params.has('run_source')) {
    localStorage.setItem('embrace_run_source', runSource);
  }
  if (params.has('issue')) {
    localStorage.setItem('embrace_issue', issue);
  }
  if (params.has('persona') || params.has('user_persona')) {
    localStorage.setItem('embrace_persona', persona);
  }
  if (params.has('issue_variant')) {
    localStorage.setItem('embrace_issue_variant', issueVariant);
  }

  initialized = true;
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

export function addBreadcrumb(message: string) {
  if (typeof window === 'undefined') return;
  try {
    session.addBreadcrumb(message);
  } catch {
    // SDK not yet ready — swallow silently
  }
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export function logError(message: string, attributes?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  try {
    log.message(message, 'error', attributes ? { attributes } : undefined);
  } catch {
    // SDK not yet ready
  }
}

export function logWarning(message: string, attributes?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  try {
    log.message(message, 'warning', attributes ? { attributes } : undefined);
  } catch {
    // SDK not yet ready
  }
}

// ---------------------------------------------------------------------------
// Custom Spans (via OpenTelemetry API so they flow through both pipelines)
// ---------------------------------------------------------------------------

const tracerName = 'embrace-custom-spans';

export function startEmbraceSpan(name: string): void {
  const tracer = trace.getTracer(tracerName);
  const span = tracer.startSpan(name);
  activeSpans.set(name, span);
}

export function endEmbraceSpan(name: string, success: boolean = true): void {
  const span = activeSpans.get(name);
  if (!span) return;
  span.setStatus({
    code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
    message: success ? undefined : `${name} failed`,
  });
  span.end();
  activeSpans.delete(name);
}
