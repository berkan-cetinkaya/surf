/**
 * Surf Event Bus
 *
 * Centralized lifecycle events for plugins and internal coordination.
 */

const listeners = new Map();

export function emit(event, detail) {
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
