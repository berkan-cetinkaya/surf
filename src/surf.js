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

/**
 * Global Surf object - the public API
 */
const Surf = {
  /**
   * Framework version
   */
  version: '0.2.0',
  
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
   * @param {string} selector - The surface selector to refresh
   */
  refresh(selector) {
    return Pulse.refresh(selector);
  },
  
  /**
   * Subscribe to framework events
   * @param {string} event - Event name: 'before:pulse', 'after:patch', 'error:network'
   * @param {function} callback - Event handler
   */
  on(event, callback) {
    Pulse.on(event, callback);
  },
  
  /**
   * Unsubscribe from framework events
   * @param {string} event - Event name
   * @param {function} callback - Event handler to remove
   */
  off(event, callback) {
    Pulse.off(event, callback);
  },
  
  /**
   * Get cell state for an element
   * @param {Element|string} cellOrSelector - Cell element or selector
   * @returns {Object} The cell's current state
   */
  getState(cellOrSelector) {
    const cell = typeof cellOrSelector === 'string' 
      ? document.querySelector(cellOrSelector)
      : cellOrSelector;
    return Cell.getState(cell);
  },
  
  /**
   * Set cell state for an element
   * @param {Element|string} cellOrSelector - Cell element or selector
   * @param {Object} state - State to merge
   */
  setState(cellOrSelector, state) {
    const cell = typeof cellOrSelector === 'string'
      ? document.querySelector(cellOrSelector)
      : cellOrSelector;
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
          // Re-initialize signals and cells on the updated surface
          Cell.initAll(surface);
          Signal.initAll(surface);
        });
      }
    });
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
      plugin.install(this, options);
    }
    return this;
  },
  // Expose modules for advanced usage
  _modules: {
    Surface,
    Cell,
    Signal,
    Pulse,
    Patch,
    Echo
  }
};

/**
 * Initialize SURF when the DOM is ready
 */
function init() {
  // Initialize cells
  Cell.initAll();
  
  // Initialize signals (reactive bindings)
  Signal.initAll();
  
  // Initialize pulse (event interception)
  Pulse.init();

  // Register core modules for signals
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
