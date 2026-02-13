import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Signal from '../../src/signal.js';
import Cell from '../../src/cell.js';

describe('Signal Module', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container.innerHTML = '';
  });

  // Helper to create an initialized cell
  function createCell(stateSeed = 'count: 0') {
    const el = document.createElement('div');
    el.setAttribute('d-cell', stateSeed);
    container.appendChild(el);
    Cell.init(el);
    return el;
  }

  describe('evaluate', () => {
    it('should access state properties', () => {
      const state = { count: 10, name: 'Surf' };
      expect(Signal.evaluate('count', state)).toBe(10);
      expect(Signal.evaluate('name', state)).toBe('Surf');
    });

    it('should handle boolean negation', () => {
      const state = { open: false, active: true };
      expect(Signal.evaluate('!open', state)).toBe(true);
      expect(Signal.evaluate('!active', state)).toBe(false);
    });

    it('should handle equality checks', () => {
      const state = { role: 'admin', age: 25, active: true };
      expect(Signal.evaluate("role == 'admin'", state)).toBe(true);
      expect(Signal.evaluate("role == 'user'", state)).toBe(false);
      expect(Signal.evaluate('age == 25', state)).toBe(true);
      expect(Signal.evaluate('active == true', state)).toBe(true);
    });

    it('should handle inequality checks', () => {
      const state = { role: 'user' };
      expect(Signal.evaluate("role != 'admin'", state)).toBe(true);
      expect(Signal.evaluate("role != 'user'", state)).toBe(false);
    });

    it('should handle comparisons', () => {
      const state = { price: 100 };
      expect(Signal.evaluate('price > 50', state)).toBe(true);
      expect(Signal.evaluate('price < 50', state)).toBe(false);
    });

    it('should handle nested paths in comparisons', () => {
      const state = { user: { role: 'admin', score: 100 } };
      expect(Signal.evaluate("user.role == 'admin'", state)).toBe(true);
      expect(Signal.evaluate('user.score > 50', state)).toBe(true);
    });
  });

  describe('executeAssignment', () => {
    it('should handle direct assignment', () => {
      const state = { count: 0 };
      const change = Signal.executeAssignment('count = 5', state);
      expect(change).toEqual({ count: 5 });
    });

    it('should handle toggle', () => {
      const state = { open: false };
      const change = Signal.executeAssignment('open = !open', state);
      expect(change).toEqual({ open: true });
    });

    it('should handle arithmetic', () => {
      const state = { count: 10 };
      expect(Signal.executeAssignment('count = count + 1', state)).toEqual({ count: 11 });
      expect(Signal.executeAssignment('count = count - 5', state)).toEqual({ count: 5 });
    });

    it('should handle Math.max/min clamping', () => {
      const state = { count: 0 };
      // Increase but clamp to max 5
      expect(Signal.executeAssignment('count = Math.min(count + 10, 5)', state)).toEqual({
        count: 5,
      });

      // Decrease but clamp to min 0
      const state2 = { count: 10 };
      expect(Signal.executeAssignment('count = Math.max(count - 20, 0)', state2)).toEqual({
        count: 0,
      });
    });
  });

  describe('Binding Updates', () => {
    it('should update d-text', () => {
      const cell = createCell('msg: "Hello"');
      const span = document.createElement('span');
      span.setAttribute('d-text', 'msg');
      cell.appendChild(span);

      Signal.updateBindings(cell);
      expect(span.textContent).toBe('Hello');
    });

    it('should update d-show', () => {
      const cell = createCell('isVisible: false');
      const div = document.createElement('div');
      div.setAttribute('d-show', 'isVisible');
      cell.appendChild(div);

      Signal.updateBindings(cell);
      expect(div.style.display).toBe('none');

      // Update state manually and check again
      Cell.setState(cell, { isVisible: true });
      Signal.updateBindings(cell);
      expect(div.style.display).toBe('');
    });

    it('should update d-attr', () => {
      const cell = createCell('isDisabled: true, val: 123');
      const btn = document.createElement('button');

      // Attribute binding
      btn.setAttribute('d-attr', 'disabled: isDisabled');
      cell.appendChild(btn);

      // Class binding
      const div = document.createElement('div');
      div.setAttribute('d-attr', 'class.active: isDisabled');
      cell.appendChild(div);

      Signal.updateBindings(cell);

      expect(btn.hasAttribute('disabled')).toBe(true);
      expect(div.classList.contains('active')).toBe(true);

      // Toggle
      Cell.setState(cell, { isDisabled: false });
      Signal.updateBindings(cell);

      expect(btn.hasAttribute('disabled')).toBe(false);
      expect(div.classList.contains('active')).toBe(false);
    });
  });

  describe('Event Handling (Integration)', () => {
    it('should handle click events via d-signal', () => {
      const cell = createCell('count: 0');
      const btn = document.createElement('button');
      // d-signal="click: count = count + 1"
      btn.setAttribute('d-signal', 'click: count = count + 1');
      cell.appendChild(btn);

      // We need to init signals
      Signal.initAll(container);

      // Trigger click
      btn.click();

      const state = Cell.getState(cell);
      expect(state.count).toBe(1);
    });

    it('should support this.method() calls', () => {
      const cell = createCell('val: 0');
      const input = document.createElement('input');

      // Mock a method on the element
      input.myMethod = vi.fn();

      input.setAttribute('d-signal', 'input: this.myMethod()');
      cell.appendChild(input);

      Signal.initAll(container);

      input.dispatchEvent(new Event('input'));

      expect(input.myMethod).toHaveBeenCalled();
    });

    it('should support reset command with delay', async () => {
      const cell = createCell('val: 0');
      const form = document.createElement('form');
      form.reset = vi.fn();

      const btn = document.createElement('button');
      btn.type = 'submit';
      btn.setAttribute('d-signal', 'click: reset');
      form.appendChild(btn);
      cell.appendChild(form);

      Signal.initAll(container);

      // Trigger
      btn.click();

      // Should not be called immediately (due to setTimeout)
      expect(form.reset).not.toHaveBeenCalled();

      // Wait for next tick
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(form.reset).toHaveBeenCalled();
    });

    it('should split multiple signals correctly and respect blocks', () => {
      const cell = createCell('count: 0, status: ""');
      const btn = document.createElement('button');
      // Multiple signals with colons inside blocks (object literalls)
      btn.setAttribute('d-signal', 'click: count = count + 1; custom:status = {key: "val"}');
      cell.appendChild(btn);

      Signal.initAll(cell);

      btn.click();
      expect(Cell.getState(cell).count).toBe(1);

      btn.dispatchEvent(new CustomEvent('custom'));
      expect(Cell.getState(cell).status).toEqual({ key: 'val' });
    });

    it('should cleanup listeners in cleanup()', () => {
      const cell = createCell('count: 0');
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: count = count + 1');
      cell.appendChild(btn);

      Signal.initAll(cell);

      // Cleanup
      Signal.cleanup(cell);

      // Click should no longer increment
      btn.click();
      expect(Cell.getState(cell).count).toBe(0);
    });

    it('should overwrite existing listeners on re-bind', () => {
      const cell = createCell('count: 0');
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: count = count + 1');
      cell.appendChild(btn);

      Signal.initAll(cell);

      // Re-bind with different logic
      btn.setAttribute('d-signal', 'click: count = count + 10');
      Signal.initAll(cell);

      btn.click();
      // Should have replaced +1 with +10, not added them
      expect(Cell.getState(cell).count).toBe(10);
    });
  });

  describe('Edge Cases & State Merging', () => {
    it('should handle nested property updates in state', () => {
      const cell = createCell('user: { name: "test", score: 0 }');
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: user.score = user.score + 100');
      cell.appendChild(btn);

      Signal.initAll(cell);
      btn.click();

      const state = Cell.getState(cell);
      expect(state.user.score).toBe(100);
      expect(state.user.name).toBe('test'); // Should preserve other keys
    });

    it('should notify only if changes occur', () => {
      const cell = createCell('val: 10');
      const spy = vi.spyOn(Cell, 'setState');
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: val = 10'); // No actual change
      cell.appendChild(btn);

      Signal.initAll(cell);
      btn.click();

      // Should find no changes and skip setState
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should handle non-boolean d-attr values', () => {
      const cell = createCell('theme: "dark"');
      const div = document.createElement('div');
      div.setAttribute('d-attr', 'data-theme: theme');
      cell.appendChild(div);

      Signal.updateBindings(cell);
      expect(div.getAttribute('data-theme')).toBe('dark');
    });

    it('should handle invalid signal expressions gracefully', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cell = createCell();
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'invalid-format');
      cell.appendChild(btn);

      Signal.initAll(cell);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Invalid signal expression'));
      spy.mockRestore();
    });

    it('should handle signals on elements without parent cell', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: count = 1');
      container.appendChild(btn); // Not inside a d-cell

      Signal.initAll(container);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('no parent cell'),
        expect.anything()
      );
      spy.mockRestore();
    });

    it('should handle string literal assignments', () => {
      const state = { name: 'Old' };
      const changes = Signal.executeAssignment("name = 'New'", state);
      expect(changes.name).toBe('New');
    });

    it('should warn on invalid object literal', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      Signal.executeAssignment('data = {invalid}', {});
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse object literal'),
        expect.anything()
      );
      spy.mockRestore();
    });

    it('should handle property copy assignments', () => {
      const state = { firstName: 'Berkan', user: { name: '' } };
      const changes = Signal.executeAssignment('user.name = firstName', state);
      expect(changes.user.name).toBe('Berkan');
    });

    it('should parse complex function arguments', () => {
      const state = { count: 10, nested: { val: 20 } };
      const btn = document.createElement('button');
      const event = { type: 'click' };

      const el = document.createElement('div');
      el.id = 'target';

      const args = Signal.__test_parseArguments(
        "true, false, event, this, count, nested.val, 'string', 5",
        state,
        event,
        btn
      );

      expect(args[0]).toBe(true);
      expect(args[1]).toBe(false);
      expect(args[2]).toBe(event);
      expect(args[3]).toBe(btn);
      expect(args[4]).toBe(10);
      expect(args[5]).toBe(20);
      expect(args[6]).toBe('string');
      expect(args[7]).toBe(5);
    });

    it('should handle legacy single listener in cleanup()', () => {
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: count = 1');
      const handler = vi.fn();
      btn.addEventListener('click', handler);

      // Manually set a legacy-style single listener object
      Signal.__test_boundListeners.set(btn, { event: 'click', handler });

      Signal.cleanup(btn.parentElement || document.body); // cleanup looks in subtree or el itself?
      // Actually cleanup(container) does querySelectorAll.
      // If we pass a container containing the button:
      const div = document.createElement('div');
      div.appendChild(btn);
      Signal.cleanup(div);

      // Trigger click to see if listener was removed
      btn.click();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should warn when calling missing method on this', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cell = createCell();
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: this.ghost()');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Element does not have method: ghost'),
        expect.anything()
      );
      spy.mockRestore();
    });

    it('should warn when calling missing method on event', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cell = createCell();
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: event.ghost()');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Event does not have method: ghost'),
        expect.anything()
      );
      spy.mockRestore();
    });

    it('should warn on unknown module method', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cell = createCell();
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: Ghost.method()');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown module method: Ghost.method')
      );
      spy.mockRestore();
    });

    it('should handle boolean literal assignments', () => {
      const cell = createCell('val: false');
      const b1 = document.createElement('button');
      b1.setAttribute('d-signal', 'click: val = true');
      cell.appendChild(b1);

      const b2 = document.createElement('button');
      b2.setAttribute('d-signal', 'click: val = false');
      cell.appendChild(b2);

      Signal.initAll(cell);

      b1.click();
      expect(Cell.getState(cell).val).toBe(true);

      b2.click();
      expect(Cell.getState(cell).val).toBe(false);
    });

    it('should support property copy in assignments', () => {
      const cell = createCell('a: 10, b: 0');
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: b = a');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(Cell.getState(cell).b).toBe(10);
    });

    it('should resolve this.property in arguments', () => {
      const cell = createCell('val: 0');
      const btn = document.createElement('button');
      btn.myProp = 'surf';

      Signal.register('Mock', {
        test: (arg) => ({ val: arg }),
      });

      btn.setAttribute('d-signal', 'click: Mock.test(this.myProp)');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(Cell.getState(cell).val).toBe('surf');
    });

    it('should support event.method() calls', () => {
      const cell = createCell();
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: event.preventDefault()');
      cell.appendChild(btn);
      Signal.initAll(cell);

      const event = new MouseEvent('click', { cancelable: true });
      const spy = vi.spyOn(event, 'preventDefault');
      btn.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it('should support submit command on form element', () => {
      const cell = createCell();
      const form = document.createElement('form');
      form.setAttribute('d-signal', 'submit-cmd: submit');
      cell.appendChild(form);
      Signal.initAll(cell);

      const spy = vi.fn();
      form.requestSubmit = spy; // Mock requestSubmit

      const event = new CustomEvent('submit-cmd');
      form.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it('should support legacy submit() fallback', () => {
      const cell = createCell();
      const form = document.createElement('form');
      form.setAttribute('d-signal', 'submit-cmd: submit');
      cell.appendChild(form);
      Signal.initAll(cell);

      const spy = vi.fn();
      form.submit = spy;
      form.requestSubmit = undefined; // Force fallback

      const event = new CustomEvent('submit-cmd');
      form.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it('should handle submit command from child element', () => {
      const cell = createCell();
      const form = document.createElement('form');
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: submit');
      form.appendChild(btn);
      cell.appendChild(form);
      Signal.initAll(cell);

      const spy = vi.fn();
      form.requestSubmit = spy;

      btn.click();
      expect(spy).toHaveBeenCalled();
    });

    it('should handle reset command and defer execution', () => {
      vi.useFakeTimers();
      const cell = createCell();
      const form = document.createElement('form');
      form.setAttribute('d-signal', 'reset-cmd: reset');
      cell.appendChild(form);
      Signal.initAll(cell);

      const spy = vi.fn();
      form.reset = spy;

      const event = new CustomEvent('reset-cmd');
      form.dispatchEvent(event);

      expect(spy).not.toHaveBeenCalled(); // Should be deferred
      vi.runAllTimers();
      expect(spy).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should handle legacy single listener cleanup in bindSignalElement', async () => {
      const cell = createCell();
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: count = 1');
      cell.appendChild(btn);

      // Manually inject a single listener object into the internal Map
      const handler = vi.fn();
      const signalModule = await import('../../src/signal.js');
      const boundListeners = signalModule.default.__test_boundListeners;

      boundListeners.set(btn, { event: 'click', handler });

      // This call to Signal.initAll will trigger bindSignalElement,
      // which will find the single object and call removeEventListener via the 'else' branch
      const removeSpy = vi.spyOn(btn, 'removeEventListener');

      Signal.initAll(cell);

      expect(removeSpy).toHaveBeenCalledWith('click', handler);
    });

    it('should warn when submit/reset command finds no form', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const cell = createCell();
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: submit; keydown: reset');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No form found to submit'), btn);

      const event = new KeyboardEvent('keydown');
      btn.dispatchEvent(event);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No form found to reset'), btn);

      spy.mockRestore();
    });

    it('should handle this.reset() in signal', () => {
      vi.useFakeTimers();
      const cell = createCell();
      const btn = document.createElement('button');
      btn.reset = vi.fn();
      btn.setAttribute('d-signal', 'click: this.reset()');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(btn.reset).not.toHaveBeenCalled(); // Should be deferred
      vi.runAllTimers();
      expect(btn.reset).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should handle property copy b = a where a is undefined in state', () => {
      const cell = createCell('count: 0');
      const btn = document.createElement('button');
      btn.setAttribute('d-signal', 'click: other = ghost');
      cell.appendChild(btn);
      Signal.initAll(cell);

      btn.click();
      expect(Cell.getState(cell).other).toBeUndefined();
    });
  });
});
