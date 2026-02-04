/**
 * Echo Module
 * 
 * Echo is the rule that preserves Cell state across Surface patches.
 * If a Cell survives in the DOM, its state must not be reset.
 * 
 * Mental model: "Surface changes, Cell lives."
 */

import * as Cell from './cell.js';
import * as Signal from './signal.js';

/**
 * Prepare for a surface update by capturing cell states
 * @param {Element} surface - The surface about to be updated
 * @returns {Map<string, Object>} - Snapshot of cell states
 */
export function before(surface) {
  // Cleanup existing signal bindings
  Signal.cleanup(surface);
  
  // Snapshot all cell states within the surface
  return Cell.snapshot(surface);
}

/**
 * Complete a surface update by restoring cell states
 * @param {Element} surface - The updated surface
 * @param {Map<string, Object>} snapshot - Previously captured states
 */
export function after(surface, snapshot) {
  // Restore cell states from snapshot
  Cell.restore(snapshot);
  
  // Initialize cells in the new content
  Cell.initAll(surface);
  
  // Initialize signals in the new content
  Signal.initAll(surface);
}

/**
 * Perform a complete surface replacement with Echo preservation
 * @param {Element} surface - The surface element
 * @param {string} newContent - The new HTML content
 * @param {function} replaceFn - Function that performs the actual replacement
 */
export function withPreservation(surface, newContent, replaceFn) {
  // Before: snapshot state
  const snapshot = before(surface);
  
  // Perform the replacement
  replaceFn();
  
  // After: restore state and reinitialize
  after(surface, snapshot);
}

export default {
  before,
  after,
  withPreservation
};
