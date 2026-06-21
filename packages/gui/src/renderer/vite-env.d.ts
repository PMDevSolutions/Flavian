/// <reference types="vite/client" />
import type { FlavianBridge } from '../shared/types/ipc';

declare global {
  interface Window {
    flavian: FlavianBridge;
  }
}

export {};
