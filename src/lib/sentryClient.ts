// The lazy chunk behind src/lib/monitoring.ts. Named re-exports let webpack
// tree-shake @sentry/react; importing the package namespace dynamically would
// also bundle Replay, Feedback and tracing (~150 kB gzip instead of ~30 kB).
export { init, captureException } from '@sentry/react';
