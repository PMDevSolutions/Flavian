export type Listener<T> = (value: T) => void;

/**
 * Tiny typed event emitter — the observable abstraction for task output, with no
 * dependency on Electron IPC or RxJS. The Electron edge (task-bridge) is the only
 * thing that forwards these emissions onto webContents.send.
 */
export class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();

  on(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  emit(value: T): void {
    // Snapshot so a listener unsubscribing during emit doesn't disturb iteration.
    for (const fn of [...this.listeners]) fn(value);
  }

  clear(): void {
    this.listeners.clear();
  }

  get size(): number {
    return this.listeners.size;
  }
}
