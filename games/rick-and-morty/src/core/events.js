/**
 * Tiny synchronous pub/sub bus.
 *
 * Every system talks through this instead of importing each other, which is
 * what keeps Phase 2+ content from needing surgery on Phase 1 code. A new
 * system can subscribe to `item:collected` or `research:complete` without a
 * single existing file knowing it exists.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  /** Subscribe for exactly one emission. */
  once(type, fn) {
    const off = this.on(type, (payload) => { off(); fn(payload); });
    return off;
  }

  off(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copy so handlers may unsubscribe (or subscribe) during dispatch.
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] handler for "${type}" threw:`, err);
      }
    }
  }
}
