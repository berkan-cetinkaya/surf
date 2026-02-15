/**
 * Pulse Module
 *
 * A Pulse represents user intent that triggers a server interaction.
 * Examples: navigation, form submission, refresh.
 *
 * Defined with: d-pulse, d-target
 *
 * Pulse types:
 * - navigate: GET request, replace surface
 * - commit: POST form data, apply patch
 * - refresh: GET current URL, refresh surface
 */

import * as Surface from './surface.js';
import * as Patch from './patch.js';
import * as Echo from './echo.js';
import { background } from 'go-like-ctx';
import Events from './events.js';

const PULSE_ATTR = 'd-pulse';
const TARGET_ATTR = 'd-target';
const ACTION_ATTR = 'd-action';

// Context management
const rootCtx = background();
const contexts = new Map();

// Dynamic import cache
let cellModule = null;
async function getCellModule() {
  if (!cellModule) {
    cellModule = await import('./cell.js');
  }
  return cellModule;
}

const EVENT_ALIASES = {
  'before:pulse': 'pulse:start',
  'after:patch': 'pulse:end',
  'error:network': 'pulse:error',
};

export function emit(event, detail) {
  // Emit standard event
  Events.emit(event, detail);

  // Emit alias if exists
  if (EVENT_ALIASES[event]) {
    Events.emit(EVENT_ALIASES[event], detail);
  }

  // Handle reverse: if standard is emitted, also emit legacy alias
  for (const [alias, standard] of Object.entries(EVENT_ALIASES)) {
    if (event === standard) {
      Events.emit(alias, detail);
    }
  }
}

export function on(event, callback) {
  Events.on(event, callback);
}

/**
 * Remove an event listener
 * @param {string} event
 * @param {function} callback
 */
export function off(event, callback) {
  Events.off(event, callback);
}

/**
 * Apply patches to surfaces with Echo preservation
 * @param {Array<{target: string, content: string}>} patches
 */
function applyPatches(patches) {
  const surfaceCache = new Map();

  patches.forEach(({ target, content }) => {
    let surface = surfaceCache.get(target);
    if (!surface) {
      surface = document.querySelector(target);
      if (surface) surfaceCache.set(target, surface);
    }

    if (!surface) {
      console.warn(`[Surf] Target not found for patch: ${target}`);
      return;
    }

    Echo.withPreservation(surface, () => {
      Surface.replace(surface, content);
    });
  });
}

/**
 * Send a pulse request to the server
 * @param {string} url
 * @param {Object} options
 * @param {string} targetSelector
 */
async function sendPulse(url, options, targetSelector) {
  emit('pulse:start', { url, options, target: targetSelector });

  // Cancel previous context for same target
  if (targetSelector && contexts.has(targetSelector)) {
    contexts.get(targetSelector).cancel();
  }

  const ctx = rootCtx.withCancel();
  if (targetSelector) contexts.set(targetSelector, ctx);

  try {
    const response = await fetch(url, {
      ...options,
      signal: ctx.signal(),
      headers: {
        Accept: 'text/html',
        'X-Surf-Request': 'true',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Check if response is a patch
    if (Patch.isPatch(html)) {
      const patches = Patch.parse(html);
      applyPatches(patches);
    } else if (targetSelector) {
      // Treat as single surface replacement
      const surface = document.querySelector(targetSelector);
      if (surface) {
        const swapMode = options.swap || surface.getAttribute('d-swap') || 'inner';

        Echo.withPreservation(surface, () => {
          if (swapMode === 'append') {
            Surface.append(surface, html);
          } else if (swapMode === 'prepend') {
            Surface.prepend(surface, html);
          } else {
            Surface.replace(surface, html);
          }
        });
      }
    }

    const responseHeaders = {};
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((value, name) => {
        responseHeaders[name] = value;
      });
    }

    emit('pulse:end', {
      url,
      target: targetSelector,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: html,
    });
  } catch (error) {
    if (ctx.cancelled()) return;
    console.error('[Surf] Pulse error:', error);
    emit('pulse:error', { url, target: targetSelector, error });
    throw error;
  } finally {
    if (targetSelector && contexts.get(targetSelector) === ctx) {
      contexts.delete(targetSelector);
    }
  }
}

/**
 * Handle navigate pulse (GET request)
 * @param {string} url
 * @param {string} targetSelector
 * @param {Object} options
 */
export async function navigate(url, targetSelector, options = {}) {
  const target = targetSelector || 'html';
  await sendPulse(url, { method: 'GET', ...options }, target);

  // Update browser history
  if (target) {
    const currentUrl = new URL(window.location.href);
    const nextUrl = new URL(url, window.location.origin);

    // If navigating to the same URL, replace state instead of pushing
    if (currentUrl.href === nextUrl.href) {
      history.replaceState({ surf: true, url: nextUrl.href, target }, '', nextUrl.href);
    } else {
      history.pushState({ surf: true, url: nextUrl.href, target }, '', nextUrl.href);
    }
  }
}

/**
 * Handle commit pulse (POST form data)
 * @param {HTMLFormElement} form
 * @param {string} targetSelector
 */
export async function commit(form, targetSelector) {
  const method = form.method?.toUpperCase() || 'POST';
  let url = form.action || window.location.href;
  const formData = new FormData(form);
  const swap = form.getAttribute('d-swap');
  const options = swap ? { swap } : {};
  const target = targetSelector || 'html';

  // Convert FormData to URLSearchParams for standard form encoding
  const params = new URLSearchParams();
  formData.forEach((value, key) => params.append(key, value));

  // GET requests cannot have a body - append as URL params instead
  if (method === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    url = url + separator + params.toString();

    await sendPulse(url, { method: 'GET', ...options }, target);
  } else {
    await sendPulse(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        ...options,
      },
      target
    );
  }
}

/**
 * Handle refresh pulse (GET current content)
 * @param {string} targetSelector
 */
export async function refresh(targetSelector) {
  const url = window.location.href;
  const target = targetSelector || 'html';
  const surface = document.querySelector(target);
  const swap = surface?.getAttribute('d-swap'); // Refresh usually respects surface preference
  await sendPulse(url, { method: 'GET', swap }, target);
}

/**
 * Handle action pulse (POST data to server)
 * @param {string} url - Action endpoint URL
 * @param {Object} data - Data to send
 * @param {string} targetSelector - Surface to update with response
 * @param {Object} options
 */
export async function action(url, data = {}, targetSelector, options = {}) {
  const target = targetSelector || 'html';
  await sendPulse(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      ...options,
    },
    target
  );
}

/**
 * Handle click events on pulse elements
 * @param {Event} event
 */
async function handleClick(event) {
  const target = event.target;
  if (!target.closest) return;

  // Use the cached result of closest to avoid redundant searches
  const element = target.hasAttribute?.(PULSE_ATTR) ? target : target.closest(`[${PULSE_ATTR}]`);
  if (!element) return;

  const pulseType = element.getAttribute(PULSE_ATTR);
  const targetSelector = element.getAttribute(TARGET_ATTR);
  const actionUrl = element.getAttribute(ACTION_ATTR);
  const swap = element.getAttribute('d-swap');
  const options = swap ? { swap } : {};

  // Handle anchor navigation
  if (element.tagName === 'A' && pulseType === 'navigate') {
    event.preventDefault();
    const url = element.href;
    navigate(url, targetSelector, options);
    return;
  }

  // Handle refresh
  if (pulseType === 'refresh') {
    event.preventDefault();
    refresh(targetSelector);
    return;
  }

  // Handle action - send POST to d-action URL
  if (pulseType === 'action' && actionUrl) {
    event.preventDefault();

    // Collect data from data-* attributes on the element
    const data = {};
    for (const attr of element.attributes) {
      if (attr.name.startsWith('data-') && attr.name !== 'data-surf-ready') {
        const key = attr.name.slice(5); // Remove 'data-' prefix
        data[key] = attr.value;
      }
    }

    // Also include Cell state if element is inside a d-cell
    const parentCell = element.closest('[d-cell]');
    if (parentCell) {
      const cell = await getCellModule();
      const cellState = cell.default
        ? cell.default.getState(parentCell)
        : cell.getState(parentCell);
      if (cellState) {
        Object.assign(data, cellState);
      }
    }

    action(actionUrl, data, targetSelector, options);
    return;
  }
}

/**
 * Handle form submission on pulse elements
 * @param {Event} event
 */
function handleSubmit(event) {
  const form = event.target;
  if (!form.hasAttribute(PULSE_ATTR)) return;

  const pulseType = form.getAttribute(PULSE_ATTR);
  const targetSelector = form.getAttribute(TARGET_ATTR);

  if (pulseType === 'commit') {
    event.preventDefault();
    commit(form, targetSelector);
  }
}

/**
 * Handle browser back/forward navigation
 * @param {PopStateEvent} event
 */
function handlePopState(event) {
  if (event.state?.surf) {
    sendPulse(event.state.url, { method: 'GET' }, event.state.target || 'html');
  } else {
    // If we land on a state without surf data (e.g. external link or hard refresh),
    // we should probably let the browser handle it or reload.
    // But since we are here, browser has already navigated url.
    // If the content is stale, we might want to refresh 'body'.
    window.location.reload();
  }
}

/**
 * Initialize pulse handling
 */
export function init() {
  // Delegate click events
  document.addEventListener('click', handleClick);

  // Delegate form submissions
  document.addEventListener('submit', handleSubmit);

  // Handle browser navigation
  window.addEventListener('popstate', handlePopState);

  // Initialize history state if missing
  if (!history.state) {
    history.replaceState(
      {
        surf: true,
        url: window.location.href,
        target: 'html',
      },
      '',
      window.location.href
    );
  }
}

/**
 * Programmatic navigation (Surf.go)
 * @param {string} url
 * @param {Object} options
 */
export async function go(url, options = {}) {
  const target = options.target || 'html';
  await navigate(url, target, options);
}

/**
 * Programmatic form submission (Surf.submit)
 * @param {Element} element - Element within a form
 */
export function submit(element) {
  const form = element.tagName === 'FORM' ? element : element.closest('form');
  if (form) {
    if (form.requestSubmit) {
      form.requestSubmit();
    } else {
      form.submit();
    }
  } else {
    console.warn('[Surf] No form found to submit for element:', element);
  }
}

export default {
  on,
  off,
  emit,
  navigate,
  commit,
  refresh,
  action,
  go,
  submit,
  init,
};
