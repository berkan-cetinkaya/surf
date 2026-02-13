/**
 * Clipboard Plugin
 *
 * Adds clipboard copy capabilities to Surf signals.
 * Usage:
 *   Surf.use(Clipboard, { timeout: 2000 });
 *   d-signal="click: Clipboard.copy(this)"
 */

const FEEDBACK_DURATION = 2000;

const Clipboard = {
  name: 'SurfClipboard',

  install(Surf, options = {}) {
    let duration = options.timeout;

    // Default to constant if undefined
    if (duration === undefined) {
      duration = FEEDBACK_DURATION;
    }
    // Validate custom duration
    else if (typeof duration !== 'number' || duration <= 0) {
      console.warn(
        `[Surf Clipboard] Invalid timeout: ${duration}. Using default: ${FEEDBACK_DURATION}ms`
      );
      duration = FEEDBACK_DURATION;
    }

    Surf.register('Clipboard', {
      copy: (targetOrEvent) => {
        let target = targetOrEvent;

        // If argument is an Event, stop propagation and use currentTarget
        if (targetOrEvent && targetOrEvent instanceof Event) {
          targetOrEvent.stopPropagation();
          target = targetOrEvent.currentTarget;
        }

        // Prevent copying if already in 'copied' state
        if (target instanceof Element) {
          const cell = target.closest('[d-cell]');
          if (cell) {
            const state = Surf.getState(cell);
            if (state && state.copied) {
              return {};
            }
          }
        }

        const text = resolveText(target);
        if (!text) return {};

        navigator.clipboard
          .writeText(text)
          .then(() => flashState(target, Surf, duration))
          .catch((err) => console.error('[Surf Clipboard] Copy failed:', err));

        return {};
      },
    });
  },
};

function resolveText(target) {
  if (typeof target === 'string') return target;

  if (target instanceof Element) {
    const codeEl = target.previousElementSibling;
    if (codeEl) return codeEl.innerText;
  }

  return null;
}

function flashState(target, Surf, duration) {
  if (!(target instanceof Element)) return;

  // Find the parent cell to update its state
  const cell = target.closest('[d-cell]');
  if (!cell) return;

  // Set copied state to true
  Surf.setState(cell, { copied: true });

  // Revert state after duration
  if (duration > 0) {
    setTimeout(() => {
      // Element might be removed from DOM, but object reference is valid
      // Surf.setState handles detached elements gracefully
      Surf.setState(cell, { copied: false });
    }, duration);
  }
}

export default Clipboard;
