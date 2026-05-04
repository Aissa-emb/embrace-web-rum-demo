import { getConfig } from './config';
import { createLogger } from './lib/logger';
import { runWorker } from './worker';

const log = createLogger('main');

async function main(): Promise<void> {
  const config = getConfig();

  log.info(
    {
      workerCount: config.WORKER_COUNT,
      storefrontUrl: config.STOREFRONT_URL,
      sessionGapMs: config.SESSION_GAP_MS,
      headless: config.HEADLESS,
      chaosRate: config.CHAOS_RATE,
      personaOverride: config.PERSONA_OVERRIDE || 'none',
      singleRun: config.SINGLE_RUN,
    },
    'Starting traffic generator'
  );

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

  // Spawn workers
  const workers: Promise<void>[] = [];
  for (let i = 0; i < config.WORKER_COUNT; i++) {
    workers.push(runWorker(i));
  }

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('Received shutdown signal, waiting for current sessions to finish...');
    // Workers will finish their current session and exit because
    // we'd need a shared flag; for now, exit after a delay
    setTimeout(() => {
      log.info('Force exiting');
      process.exit(0);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await Promise.all(workers);
  log.info('All workers finished');
}

main().catch((err) => {
  log.fatal({ err }, 'Fatal error in traffic generator');
  process.exit(1);
});
