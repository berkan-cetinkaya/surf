/**
 * Events Module (1 of 7 Core Modules)
 *
 * Provides a lightweight event emitter for internal cross-module communication
 * and public lifecycle hooks.
 *
 * Architecture Note: Built independently to avoid cyclic dependencies between
 * Pulse, Echo, and Patch modules.
 */

const listeners = new Map();

export function emit(event, detail) {
  // Emit standard event
  if (listeners.has(event)) {
    listeners.get(event).forEach((cb) => {
      try {
        cb(detail);
      } catch (e) {
        console.error(`[Surf] Error in lifecycle listener [${event}]:`, e);
      }
    });
  }
}

export function on(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, []);
  }
  listeners.get(event).push(callback);
}

export function off(event, callback) {
  if (listeners.has(event)) {
    const list = listeners.get(event);
    const index = list.indexOf(callback);
    if (index > -1) {
      list.splice(index, 1);
    }
  }
}

export default {
  emit,
  on,
  off,
};
