import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Echo from '../../src/echo.js';
import Cell from '../../src/cell.js';

describe('Echo Module', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should preserve cell state across updates', () => {
    // Setup initial DOM with a cell
    const el = document.createElement('div');
    el.id = 'counter';
    el.setAttribute('d-cell', 'count: 0');
    container.appendChild(el);

    Cell.init(el);
    Cell.setState(el, { count: 5 }); // Change state

    // Echo.withPreservation simulates a replacement
    Echo.withPreservation(container, () => {
      // Simulate replacement: destroy old, create new with same ID/seed
      // Note: Echo finds matching cells by ID. Old element is gone.

      // In real world, Surf uses replace() logic. Here we manually clear and append new.
      // Wait, if replace() destroys old element, Echo snapshot must capture state BEFORE.

      // The test code inside withPreservation MUST create the new element
      // that Echo restores state to.

      container.innerHTML = '';
      const newEl = document.createElement('div');
      newEl.id = 'counter'; // Same ID matches
      newEl.setAttribute('d-cell', 'count: 0'); // Original seed
      container.appendChild(newEl);
    });

    // Check new element state
    const newEl = document.getElementById('counter');
    const state = Cell.getState(newEl);

    // Should have preserved 5, not reset to 0
    expect(state.count).toBe(5);
  });

  it('should initialize new cells found in content', () => {
    Echo.withPreservation(container, () => {
      const newEl = document.createElement('div');
      newEl.setAttribute('d-id', 'echo-new-cell');
      newEl.setAttribute('d-cell', 'val: 10');
      container.appendChild(newEl);
    });

    const el = container.querySelector('[d-cell]');
    expect(Cell.getState(el)).toEqual({ val: 10 });
  });
});
