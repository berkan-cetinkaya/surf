/**
 * Cell Module
 *
 * A Cell is a small, local, client-side state container.
 * Cells are isolated and must survive Surface updates (Echo rule).
 *
 * Defined with: d-cell
 */

const CELL_ATTR = 'd-cell';
const ID_ATTR = 'd-id';

// WeakMap to store cell states without polluting DOM
const cellStates = new WeakMap();

// Map for cell IDs to support Echo (state preservation)
const cellIdStates = new Map();

/**
 * Parse the seed expression from d-cell attribute
 * @param {string} seedExpr - The seed expression (e.g., "{ count: 0 }" or "count: 0")
 * @returns {Object}
 */
function parseSeed(seedExpr) {
  if (!seedExpr) return {};

  const trimmed = seedExpr.trim();

  try {
    // Decide format based on first character
    // If it starts with {, treat as object literal: { count: 0 }
    // Otherwise, wrap in braces: count: 0 -> { count: 0 }
    const expression = trimmed.startsWith('{') ? `return ${trimmed}` : `return { ${trimmed} }`;
    return new Function(expression)();
  } catch (e) {
    console.warn(`[Surf] Invalid seed expression: "${trimmed}"`, e);
    return {};
  }
}

/**
 * Get the unique identifier for a cell
 * @param {Element} element
 * @returns {string|null}
 */
export function getCellId(element) {
  return element.getAttribute(ID_ATTR) || element.id || null;
}

/**
 * Find all cell elements in the document or within a container
 * @param {Element} container - Optional container to search within
 * @returns {NodeListOf<Element>}
 */
export function findAll(container = document) {
  return container.querySelectorAll(`[${CELL_ATTR}]`);
}

/**
 * Initialize a cell with its seed state
 * @param {Element} element
 * @returns {Object} The initialized state
 */
export function init(element) {
  if (!element.hasAttribute(CELL_ATTR)) {
    console.warn('[Surf] Element is not a cell:', element);
    return {};
  }

  const cellId = getCellId(element);

  // Check if we have preserved state from Echo
  if (cellId && cellIdStates.has(cellId)) {
    const preservedState = cellIdStates.get(cellId);
    cellStates.set(element, preservedState);
    return preservedState;
  }

  // Parse seed and initialize new state
  // Parse seed and initialize new state
  const cellExpr = element.getAttribute(CELL_ATTR);
  const state = parseSeed(cellExpr || '{}');

  cellStates.set(element, state);

  // Store by ID for Echo support
  if (cellId) {
    cellIdStates.set(cellId, state);
  }

  return state;
}

/**
 * Get the current state of a cell
 * @param {Element} element
 * @returns {Object}
 */
export function getState(element) {
  if (!cellStates.has(element)) {
    return init(element);
  }
  return cellStates.get(element);
}

/**
 * Update the state of a cell
 * @param {Element} element
 * @param {Object} newState - Partial state to merge
 * @returns {Object} The updated state
 */
export function setState(element, newState) {
  const currentState = getState(element);
  const updatedState = { ...currentState, ...newState };

  cellStates.set(element, updatedState);

  // Update ID-based storage for Echo
  const cellId = getCellId(element);
  if (cellId) {
    cellIdStates.set(cellId, updatedState);
  }

  return updatedState;
}

/**
 * Set a single property in the cell state
 * @param {Element} element
 * @param {string} key
 * @param {any} value
 * @returns {Object} The updated state
 */
export function setProperty(element, key, value) {
  return setState(element, { [key]: value });
}

/**
 * Snapshot all cell states for Echo preservation
 * @param {Element} container
 * @returns {Map<string, Object>}
 */
export function snapshot(container = document) {
  const cells = findAll(container);
  const snap = new Map();

  cells.forEach((cell) => {
    const cellId = getCellId(cell);
    if (cellId) {
      snap.set(cellId, { ...getState(cell) });
    }
  });

  return snap;
}

/**
 * Restore cell states from a snapshot (Echo rule)
 * @param {Map<string, Object>} snap
 */
export function restore(snap) {
  snap.forEach((state, cellId) => {
    cellIdStates.set(cellId, state);
  });
}

/**
 * Initialize all cells in a container
 * @param {Element} container
 */
export function initAll(container = document) {
  const cells = findAll(container);
  cells.forEach((cell) => {
    if (!cell.getAttribute(ID_ATTR) && !cell.id) {
      console.warn(
        '[Surf] Cell is missing a "d-id" attribute. ' +
          'Add d-id="unique-name" for reliable state preservation.',
        cell
      );
    }
    init(cell);
  });
}

/**
 * Clear preserved state for a cell ID (used when cell is intentionally reset)
 * @param {string} cellId
 */
export function clearPreserved(cellId) {
  cellIdStates.delete(cellId);
}

export default {
  findAll,
  getCellId,
  init,
  getState,
  setState,
  setProperty,
  snapshot,
  restore,
  initAll,
  clearPreserved,
};
