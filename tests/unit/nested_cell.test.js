import { describe, it, expect, beforeEach } from 'vitest';
import * as Cell from '../../src/cell.js';
import * as Signal from '../../src/signal.js';

describe('Nested d-cell behavior', () => {
  // window and document are globally available in jsdom environment

  beforeEach(async () => {
    // Clear document body before each test
    document.body.innerHTML = '';

    // Mock requestAnimationFrame
    if (!window.requestAnimationFrame) {
      window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
    }
  });

  it('Inner cell bindings should persist when outer cell updates', () => {
    document.body.innerHTML = `
            <div id="outer" d-cell="{ val: 'outer' }">
                <span id="outer-span" d-text="val"></span>
                
                <div id="inner" d-cell="{ val: 'inner' }">
                    <span id="inner-span" d-text="val"></span>
                </div>
            </div>
        `;

    const outer = document.getElementById('outer');
    const inner = document.getElementById('inner');
    const outerSpan = document.getElementById('outer-span');
    const innerSpan = document.getElementById('inner-span');

    // Initialize cells
    Cell.init(outer);
    Cell.init(inner);

    // Update bindings for both
    Signal.updateBindings(inner); // innerSpan -> 'inner'
    Signal.updateBindings(outer); // should update outerSpan -> 'outer' WITHOUT affecting innerSpan

    // Assert outer behaviors
    expect(outerSpan.textContent).toBe('outer');

    // Assert inner behavior (SHOULD BE ISOLATED)
    expect(innerSpan.textContent).toBe('inner');
  });
});
