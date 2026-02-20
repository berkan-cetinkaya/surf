/**
 * SURF - HTML-first, server-driven UI framework
 *
 * Mental model: "Surface changes, Cell lives."
 *
 * The server is the source of truth.
 * The client handles only temporary, local interactions.
 * HTML is the primary data format.
 * UI changes happen through HTML patches, not JSON APIs.
 */

import * as Surface from './surface.js';
import * as Cell from './cell.js';
import * as Signal from './signal.js';
import * as Pulse from './pulse.js';
import * as Patch from './patch.js';
import * as Echo from './echo.js';
import Events from './events.js';

/**
 * Global Surf object - the public API
 * Using a singleton pattern to handle state across full-page navigations
 */
let Surf =
  typeof window !== 'undefined' && window.Surf
    ? window.Surf
    : {
        version: '0.3.1',
        plugins: [],
        _pulseBound: false,
      };

// Update/Attach core methods to the instance (allows hot-updates of framework code)
Object.assign(Surf, {
  /**
   * Navigate to a URL
   * @param {string} url - The URL to navigate to
   * @param {Object} options - Optional settings (target, swap, etc)
   */
  go(url, options = {}) {
    return Pulse.go(url, options);
  },

  /**
   * Refresh a surface's content from the server
   */
  refresh(selector) {
    return Pulse.refresh(selector);
  },

  /**
   * Submit a form (Pulse-aware)
   */
  submit(element) {
    return Pulse.submit(element);
  },

  /**
   * Commit form data (silent update)
   */
  commit(form, target) {
    return Pulse.commit(form, target);
  },

  /**
   * Subscribe to framework events
   * @param {string} event - Event name: 'pulse:start', 'pulse:end', 'pulse:error', 'cell:change', 'signal:update', 'echo:before', 'echo:after'
   * @param {function} callback - Event handler
   */
  on(event, callback) {
    Events.on(event, callback);
  },

  /**
   * Emit a framework event
   */
  emit(event, detail) {
    Events.emit(event, detail);
  },

  /**
   * Unsubscribe from framework events
   * @param {string} event - Event name
   * @param {function} callback - Event handler to remove
   */
  off(event, callback) {
    Events.off(event, callback);
  },

  /**
   * Get cell state for an element
   * @param {Element|string} cellOrSelector - Cell element or selector
   * @returns {Object} The cell's current state
   */
  getState(cellOrSelector) {
    const cell =
      typeof cellOrSelector === 'string' ? document.querySelector(cellOrSelector) : cellOrSelector;
    return Cell.getState(cell);
  },

  /**
   * Set cell state for an element
   * @param {Element|string} cellOrSelector - Cell element or selector
   * @param {Object} state - State to merge
   */
  setState(cellOrSelector, state) {
    const cell =
      typeof cellOrSelector === 'string' ? document.querySelector(cellOrSelector) : cellOrSelector;
    Cell.setState(cell, state);
    Signal.updateBindings(cell);
  },

  /**
   * Manually apply a patch response
   * @param {string} patchHtml - The patch HTML string
   */
  applyPatch(patchHtml) {
    const patches = Patch.parse(patchHtml);
    patches.forEach(({ target, content }) => {
      const surface = document.querySelector(target);
      if (surface) {
        Echo.withPreservation(surface, () => {
          Surface.replace(target, content);
          Cell.initAll(surface);
          Signal.initAll(surface);
        });
      }
    });

    Events.emit('pulse:end', { body: patchHtml });
  },

  /**
   * Register a module for signal expressions
   * @param {string} name - Module namespace
   * @param {Object} module - Object with methods
   */
  register(name, module) {
    Signal.register(name, module);
  },

  /**
   * Install a plugin
   * @param {Object} plugin - Plugin object with install method
   * @param {Object} options - Plugin options
   */
  use(plugin, options = {}) {
    if (plugin && typeof plugin.install === 'function') {
      const name = plugin.name || 'Anonymous';
      // Prevent duplicate installation
      if (this.plugins.some((p) => p.name === name)) {
        return this;
      }

      plugin.install(this, options);
      this.plugins.push({ name, plugin, options });
    }
    return this;
  },

  /**
   * Core modules (exposed for plugins)
   */
  Surface,
  Cell,
  Signal,
  Pulse,
  Patch,
  Echo,

  /**
   * @deprecated Use Surf.Pulse, Surf.Surface, etc. directly
   */
  _modules: {
    Surface,
    Cell,
    Signal,
    Pulse,
    Patch,
    Echo,
  },
});

/**
 * Initialize SURF when the DOM is ready
 */
function init() {
  // Global listeners only added once
  if (!Surf._pulseBound) {
    Pulse.init();
    Surf._pulseBound = true;
  }

  // DOM-specific init always runs
  Cell.initAll();
  Signal.initAll();
  Signal.register('Pulse', Pulse);

  console.log(`[Surf] Initialized v${Surf.version}`);
}

// Auto-initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for module usage
export { Surface, Cell, Signal, Pulse, Patch, Echo };
export default Surf;

// Attach to window for script tag usage
if (typeof window !== 'undefined') {
  window.Surf = Surf;
}
