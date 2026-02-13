
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Cell from '../../src/cell.js';

describe('Cell Module', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('parseSeed', () => {
    // Note: parseSeed is not exported directly, but we test it via init() behavior
    // or we can test it if we exported it. 
    // Since it's internal to cell.js in the current code (not exported), 
    // we rely on effective state initialization to verify it.
    
    // Wait, let's check if I can test it implicitly via init.
    // Yes.
    
    it('should parse object literal with braces', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', '{ count: 10 }');
      container.appendChild(el);
      
      const state = Cell.init(el);
      expect(state).toEqual({ count: 10 });
    });

    it('should parse object literal WITHOUT braces', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', 'count: 20');
      container.appendChild(el);
      
      const state = Cell.init(el);
      expect(state).toEqual({ count: 20 });
    });

    it('should handle complex types', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', "name: 'Surf', active: true, list: [1,2,3]");
      container.appendChild(el);
      
      const state = Cell.init(el);
      expect(state.name).toBe('Surf');
      expect(state.active).toBe(true);
      expect(state.list).toEqual([1, 2, 3]);
    });
    
    it('should handle invalid syntax gracefully', () => {
        // e.g. a syntax error
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const el = document.createElement('div');
        el.setAttribute('d-cell', 'count: ;;;');
        container.appendChild(el);

        const state = Cell.init(el);
        expect(state).toEqual({}); // Checks that it returns empty object on error
        spy.mockRestore();
    });
  });

  describe('State Management', () => {
    it('should get state from initialized element', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', 'msg: "hello"');
      container.appendChild(el);
      
      Cell.init(el);
      const state = Cell.getState(el);
      expect(state.msg).toBe('hello');
    });

    it('should set state properties', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', 'val: 1');
      container.appendChild(el);
      
      Cell.init(el);
      Cell.setState(el, { val: 2, newProp: 'test' });
      
      const state = Cell.getState(el);
      expect(state.val).toBe(2);
      expect(state.newProp).toBe('test');
    });
  });

  describe('Echo Preservation', () => {
    it('should preserve state by d-id', () => {
        // 1. Init first element
        const el1 = document.createElement('div');
        el1.setAttribute('d-cell', 'count: 1');
        el1.setAttribute('d-id', 'test-cell');
        container.appendChild(el1);
        
        Cell.init(el1);
        
        // 2. Modify state
        Cell.setState(el1, { count: 99 });
        
        // 3. Remove el1 and create el2 with same ID (simulating swap)
        container.removeChild(el1);
        
        const el2 = document.createElement('div');
        el2.setAttribute('d-cell', 'count: 1'); // Original seed
        el2.setAttribute('d-id', 'test-cell'); // Same ID
        container.appendChild(el2);
        
        // 4. Init new element -> Should have Preserved State (99) not Seed (1)
        const state = Cell.init(el2);
        expect(state.count).toBe(99);
    });

    it('should warn when d-cell has no d-id', () => {
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const el = document.createElement('div');
        el.setAttribute('d-cell', 'count: 0');
        container.appendChild(el);
        
        Cell.initAll(container);
        
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('missing a "d-id"'),
          el
        );
        spy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should warn and return empty object when initializing non-cell element', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const el = document.createElement('div');
      container.appendChild(el);
      
      const state = Cell.init(el);
      expect(state).toEqual({});
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Element is not a cell'), el);
      spy.mockRestore();
    });

    it('should initialize cell automatically in getState if not initialized', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', 'auto: true');
      container.appendChild(el);
      
      // We don't call Cell.init(el)
      const state = Cell.getState(el);
      expect(state.auto).toBe(true);
    });

    it('should support setProperty helper', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', 'prop: 1');
      container.appendChild(el);
      Cell.init(el);
      
      Cell.setProperty(el, 'prop', 2);
      expect(Cell.getState(el).prop).toBe(2);
    });

    it('should support clearPreserved for ID-based state', () => {
      const el = document.createElement('div');
      el.setAttribute('d-cell', 'val: 1');
      el.setAttribute('d-id', 'clear-me');
      container.appendChild(el);
      Cell.init(el);
      Cell.setState(el, { val: 10 });
      
      Cell.clearPreserved('clear-me');
      
      const el2 = document.createElement('div');
      el2.setAttribute('d-cell', 'val: 1');
      el2.setAttribute('d-id', 'clear-me');
      container.appendChild(el2);
      
      // Should get initial seed instead of preserved 10
      const state = Cell.init(el2);
      expect(state.val).toBe(1);
    });
  });
});
