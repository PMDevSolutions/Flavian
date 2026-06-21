import type { FlavianBridge } from '../../shared/types/ipc';

/** Access the preload-exposed bridge, failing loudly if it's missing. */
export function bridge(): FlavianBridge {
  if (!window.flavian) {
    throw new Error('Flavian bridge unavailable — the preload script did not initialize.');
  }
  return window.flavian;
}
