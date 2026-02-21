import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Surf from '../../src/surf.js';

describe('Surf Public API (surf.js)', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock fetch for Pulse tests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('Core Lifecycle', () => {
    it('should expose version', () => {
      expect(Surf.version).toBe('0.3.2');
    });

    it('should expose core modules', () => {
      expect(Surf.Surface).toBeDefined();
      expect(Surf.Cell).toBeDefined();
      expect(Surf.Signal).toBeDefined();
      expect(Surf.Pulse).toBeDefined();
      expect(Surf.Patch).toBeDefined();
      expect(Surf.Echo).toBeDefined();
    });
  });

  describe('Navigation API', () => {
    it('should proxy go() to Pulse.go', async () => {
      const spy = vi.spyOn(Surf.Pulse, 'go').mockResolvedValue();
      await Surf.go('/test', { some: 'option' });
      expect(spy).toHaveBeenCalledWith('/test', { some: 'option' });
    });

    it('should proxy refresh() to Pulse.refresh', async () => {
      const spy = vi.spyOn(Surf.Pulse, 'refresh').mockResolvedValue();
      await Surf.refresh('#target');
      expect(spy).toHaveBeenCalledWith('#target');
    });
  });

  describe('Event API', () => {
    it('should proxy on/off to Events bridge', () => {
      const cb = vi.fn();
      Surf.on('cell:change', cb);
      const el = document.createElement('div');
      el.setAttribute('d-id', 'event-test-cell');
      el.setAttribute('d-cell', 'x:1');
      Surf.Cell.init(el);
      Surf.Cell.setState(el, { x: 2 });
      expect(cb).toHaveBeenCalled();

      Surf.off('cell:change', cb);
      Surf.Cell.setState(el, { x: 3 });
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('State API', () => {
    it('should getState and setState on elements', () => {
      const el = document.createElement('div');
      el.setAttribute('d-id', 'state-test-cell');
      el.setAttribute('d-cell', 'x: 1');
      container.appendChild(el);
      Surf.Cell.init(el);

      expect(Surf.getState(el)).toEqual({ x: 1 });

      Surf.setState(el, { x: 2, y: 3 });
      expect(Surf.getState(el)).toEqual({ x: 2, y: 3 });
    });

    it('should handle string selectors in getState/setState', () => {
      const el = document.createElement('div');
      el.id = 'target-cell';
      el.setAttribute('d-cell', 'val: 10');
      container.appendChild(el);
      Surf.Cell.init(el);

      expect(Surf.getState('#target-cell')).toEqual({ val: 10 });
      Surf.setState('#target-cell', { val: 20 });
      expect(Surf.getState('#target-cell')).toEqual({ val: 20 });
    });
  });

  describe('Patch API', () => {
    it('should apply HTML patches via applyPatch', () => {
      const surface = document.createElement('div');
      surface.id = 'content';
      surface.setAttribute('d-id', 'content');
      surface.innerHTML = '<span d-cell="c: 1" d-id="c1"></span>';
      container.appendChild(surface);
      Surf.Cell.initAll(container);

      const patchHtml =
        '<d-patch><surface target="#content">New Content <span d-cell="c: 2" d-id="c2"></span></surface></d-patch>';
      Surf.applyPatch(patchHtml);

      expect(surface.innerHTML).toContain('New Content');
      // Verify initAll was called on new content (ignore preservation for now by using different d-id or checking content)
      expect(Surf.getState('#content [d-cell]')).toEqual({ c: 2 });
    });

    it('should ignore patches for non-existent targets', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      Surf.applyPatch('<div d-id="missing"></div>');
      // No crash, maybe a warning from Surface.replace (depends on implementation)
    });
  });

  describe('Plugin System', () => {
    it('should install plugins via use()', () => {
      const plugin = {
        name: 'TestPlugin',
        install: vi.fn(),
      };

      Surf.use(plugin, { config: true });
      expect(plugin.install).toHaveBeenCalledWith(Surf, { config: true });
      expect(Surf.plugins.some((p) => p.name === 'TestPlugin')).toBe(true);
    });

    it('should prevent duplicate plugin installation', () => {
      const plugin = {
        name: 'UniquePlugin',
        install: vi.fn(),
      };

      Surf.use(plugin);
      Surf.use(plugin);
      expect(plugin.install).toHaveBeenCalledTimes(1);
    });

    it('should handle anonymous plugins', () => {
      const plugin = {
        install: vi.fn(),
      };
      Surf.use(plugin);
      expect(plugin.install).toHaveBeenCalled();
    });
  });

  describe('Declarative Bridge', () => {
    it('should register modules via register()', () => {
      const module = { doStuff: () => 'done' };
      Surf.register('MyMod', module);
      expect(Surf.Signal.evaluate('MyMod.doStuff()', {})).toBe('done');
    });
  });
});
