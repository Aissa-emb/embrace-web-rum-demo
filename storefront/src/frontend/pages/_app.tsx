// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App, { AppContext, AppProps } from 'next/app';
import CurrencyProvider from '../providers/Currency.provider';
import CartProvider from '../providers/Cart.provider';
import { ThemeProvider } from 'styled-components';
import Theme from '../styles/Theme';
import FrontendTracer from '../utils/telemetry/FrontendTracer';
import SessionGateway from '../gateways/Session.gateway';
import { OpenFeatureProvider, OpenFeature } from '@openfeature/react-sdk';
import { FlagdWebProvider } from '@openfeature/flagd-web-provider';
import { initEmbrace } from '../utils/embrace';
import { injectWebVitalsChaos } from '../utils/webVitalsChaos';
import { maybeCaptureUserPreferencesError, getDemoIssueVariant } from '../utils/controlledIssues';

declare global {
  interface Window {
    ENV: {
      NEXT_PUBLIC_PLATFORM?: string;
      NEXT_PUBLIC_OTEL_SERVICE_NAME?: string;
      NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
      IS_SYNTHETIC_REQUEST?: string;
    };
  }
}

if (typeof window !== 'undefined') {
  FrontendTracer();
  initEmbrace();
  
  // Inject randomized web vitals degradations and JS exceptions 
  // so the RUM data looks like a realistic production environment.
  injectWebVitalsChaos(1.0);

  // Persist issue_variant from URL to localStorage for cross-page navigation
  const _params = new URLSearchParams(window.location.search);
  const _issueVariant = _params.get('issue_variant');
  if (_issueVariant) {
    localStorage.setItem('embrace_issue_variant', _issueVariant);
  }
  const _persona = _params.get('user_persona');
  if (_persona) {
    localStorage.setItem('embrace_persona', _persona);
  }

  // Controlled issue: user preferences parse failure on app startup
  maybeCaptureUserPreferencesError({ page: window.location.pathname });
  if (window.location) {
    const session = SessionGateway.getSession();

    // Set context prior to provider init to avoid multiple http calls
    OpenFeature.setContext({ targetingKey: session.userId, ...session }).then(() => {
      /**
       * We connect to flagd through the envoy proxy, straight from the browser,
       * for this we need to know the current hostname and port.
       */

      const useTLS = window.location.protocol === 'https:';
      let port = useTLS ? 443 : 80;
      if (window.location.port) {
          port = parseInt(window.location.port, 10);
      }

      OpenFeature.setProvider(
        new FlagdWebProvider({
          host: window.location.hostname,
          pathPrefix: 'flagservice',
          port: port,
          tls: useTLS,
          maxRetries: 3,
          maxDelay: 10000,
        })
      );
    });
  }
}

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={Theme}>
      <OpenFeatureProvider>
        <QueryClientProvider client={queryClient}>
          <CurrencyProvider>
            <CartProvider>
              <Component {...pageProps} />
            </CartProvider>
          </CurrencyProvider>
        </QueryClientProvider>
      </OpenFeatureProvider>
    </ThemeProvider>
  );
}

// ---------------------------------------------------------------------------
// Realistic TTFB simulation — server-side only
// ---------------------------------------------------------------------------
// Docker-internal networking gives ~0ms TTFB which looks fake.
// Real e-commerce SSR involves DB queries, rendering, and occasional spikes.
// This delay runs server-side only and directly increases the measured TTFB.

function getRealisticServerDelay(): number {
  // Base processing time: 120–350ms (SSR + data fetching)
  let delay = 120 + Math.random() * 230;

  // 20% chance of moderate slowdown (cache miss, slow query)
  if (Math.random() < 0.20) {
    delay += 150 + Math.random() * 350; // +150–500ms
  }

  // 5% chance of significant spike (cold start, GC, upstream timeout)
  if (Math.random() < 0.05) {
    delay += 500 + Math.random() * 1200; // +500–1700ms
  }

  return Math.round(delay);
}

MyApp.getInitialProps = async (appContext: AppContext) => {
  // Simulate realistic server processing time (server-side only)
  if (typeof window === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, getRealisticServerDelay()));
  }

  const appProps = await App.getInitialProps(appContext);

  return { ...appProps };
};

export default MyApp;
