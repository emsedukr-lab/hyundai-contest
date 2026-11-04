import type { Env as WorkerEnv } from '../src/index';

// Bindings seen by `env` from 'cloudflare:test' are the worker's own.
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}
export {};
