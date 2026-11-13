import { simulate } from './simulate';
import type { Config } from './types';

self.onmessage = (event: MessageEvent<{ id: number; config: Config }>) => {
  const { id, config } = event.data;
  try { self.postMessage({ id, result: simulate(config) }); }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : 'Unable to simulate this configuration.' }); }
};
