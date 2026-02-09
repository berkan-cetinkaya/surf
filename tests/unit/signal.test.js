
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
      expect(Signal.evaluate("age == 25", state)).toBe(true);
      expect(Signal.evaluate("active == true", state)).toBe(true);
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
        expect(Signal.executeAssignment('count = Math.min(count + 10, 5)', state)).toEqual({ count: 5 });
        
        // Decrease but clamp to min 0
        const state2 = { count: 10 };
        expect(Signal.executeAssignment('count = Math.max(count - 20, 0)', state2)).toEqual({ count: 0 });
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
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(form.reset).toHaveBeenCalled();
    });
  });
});
