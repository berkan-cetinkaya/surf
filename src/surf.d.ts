/**
 * SURF - HTML-first, server-driven UI framework
 */
declare namespace Surf {
  /**
   * Framework version
   */
  const version: string;

  /**
   * Navigate to a URL
   * @param url - The URL to navigate to
   * @param options - Optional settings
   */
  function go(
    url: string,
    options?: {
      /** Target surface selector (default: body) */
      target?: string;
      /** Swap mode: 'inner', 'append', 'prepend' (default: inner) */
      swap?: 'inner' | 'append' | 'prepend';
    }
  ): Promise<void>;

  /**
   * Refresh a surface's content from the server
   * @param selector - The surface selector to refresh
   */
  function refresh(selector: string): Promise<void>;

  /**
   * Subscribe to framework events
   * @param event - Event name: 'before:pulse', 'after:patch', 'error:network'
   * @param callback - Event handler
   */
  function on(event: string, callback: (...args: any[]) => void): void;

  /**
   * Unsubscribe from framework events
   * @param event - Event name
   * @param callback - Event handler to remove
   */
  function off(event: string, callback: (...args: any[]) => void): void;

  /**
   * Get cell state for an element
   * @param cellOrSelector - Cell element or selector
   * @returns The cell's current state
   */
  function getState(cellOrSelector: Element | string): any;

  /**
   * Set cell state for an element
   * @param cellOrSelector - Cell element or selector
   * @param state - State to merge
   */
  function setState(cellOrSelector: Element | string, state: any): void;

  /**
   * Manually apply a patch response
   * @param patchHtml - The patch HTML string
   */
  function applyPatch(patchHtml: string): void;

  /**
   * Register a plugin
   * @param plugin - Plugin object with init method
   */
  function use(plugin: { init: () => void }): void;

  /**
   * Register a module for signal expressions
   * @param name - Module namespace
   * @param module - Object with methods
   */
  function register(name: string, module: Record<string, Function>): void;
}

export = Surf;
export as namespace Surf;
