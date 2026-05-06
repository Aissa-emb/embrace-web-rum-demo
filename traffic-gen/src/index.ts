import { getConfig } from './config';
import { createLogger } from './lib/logger';
import { runWorker, requestShutdown } from './worker';

const log = createLogger('main');

async function main(): Promise<void> {
  const config = getConfig();

  // Parse CLI args for --persona=X --once --headed
  const args = process.argv.slice(2);
  for (const arg of args) {
    if (arg.startsWith('--persona=')) {
      (config as any).PERSONA_OVERRIDE = arg.split('=')[1];
      log.info({ persona: config.PERSONA_OVERRIDE }, 'Persona override from CLI');
    }
    if (arg === '--once') {
      (config as any).SINGLE_RUN = true;
      (config as any).MAX_SESSIONS_PER_WORKER = 1;
      (config as any).WORKER_COUNT = 1;
      log.info('Single-run mode from CLI');
    }
    if (arg === '--headed') {
      (config as any).HEADLESS = false;
      log.info('Headed mode from CLI');
    }
  }

  log.info(
    {
      workerCount: config.WORKER_COUNT,
      storefrontUrl: config.STOREFRONT_URL,
      sessionGapMs: config.SESSION_GAP_MS,
      headless: config.HEADLESS,
      chaosRate: config.CHAOS_RATE,
      personaOverride: config.PERSONA_OVERRIDE || 'none',
      singleRun: config.SINGLE_RUN,
      maxSessions: config.MAX_SESSIONS || 'unlimited',
      maxDurationS: config.MAX_DURATION_S || 'unlimited',
      runSource: config.RUN_SOURCE,
      deviceOverride: config.DEVICE_OVERRIDE || 'none',
    },
    'Starting traffic generator'
  );

  // ---------------------------------------------------------------------------
  // MAX_DURATION_S wall-clock timeout
  // ---------------------------------------------------------------------------
  if (config.MAX_DURATION_S > 0) {
    const durationMs = config.MAX_DURATION_S * 1000;
    log.info({ seconds: config.MAX_DURATION_S }, 'Will auto-stop after duration');

    setTimeout(() => {
      log.info('MAX_DURATION_S reached — requesting graceful shutdown');
      requestShutdown();

      // Force-exit after a grace period if workers don't finish
      setTimeout(() => {
        log.info('Grace period elapsed — force exiting');
        process.exit(0);
      }, 15000);
    }, durationMs);
  }

  // ---------------------------------------------------------------------------
  // Spawn workers
  // ---------------------------------------------------------------------------
  const workers: Promise<void>[] = [];
  for (let i = 0; i < config.WORKER_COUNT; i++) {
    workers.push(runWorker(i));
  }

  // Graceful shutdown on SIGTERM/SIGINT
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('Received shutdown signal, requesting worker shutdown...');
    requestShutdown();
    setTimeout(() => {
      log.info('Force exiting');
      process.exit(0);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await Promise.all(workers);
  log.info('All workers finished');
  process.exit(0);
}

main().catch((err) => {
  log.fatal({ err }, 'Fatal error in traffic generator');
  process.exit(1);
});
