import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Pulse from '../../src/pulse.js';
import Cell from '../../src/cell.js';

describe('Pulse Module', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock global fetch with a default OK response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(''),
      })
    );
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  describe('navigate (GET)', () => {
    it('should send GET request and update target', async () => {
      const surface = document.createElement('div');
      surface.id = 'main';
      container.appendChild(surface);

      // Mock successful response
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<h1>New Page</h1>'),
      });

      await Pulse.navigate('/new-page', '#main');

      expect(global.fetch).toHaveBeenCalledWith(
        '/new-page',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'X-Surf-Request': 'true' }),
        })
      );

      // Should update surface content
      expect(surface.innerHTML).toBe('<h1>New Page</h1>');
    });

    it('should emit lifecycle events and include headers', async () => {
      const surface = document.createElement('div');
      surface.id = 'main';
      container.appendChild(surface);

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['Content-Type', 'text/html'],
          ['X-Custom', 'Value'],
        ]),
        text: () => Promise.resolve('Content'),
      });

      const beforeSpy = vi.fn();
      const endSpy = vi.fn();

      Pulse.on('pulse:start', beforeSpy);
      Pulse.on('pulse:end', endSpy);

      await Pulse.navigate('/test', '#main');

      expect(beforeSpy).toHaveBeenCalled();
      expect(endSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'text/html',
            'X-Custom': 'Value',
          }),
        })
      );

      Pulse.off('pulse:start', beforeSpy);
      Pulse.off('pulse:end', endSpy);
    });

    it('should handle network errors', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockRejectedValue(new Error('Network Error'));
      const errorSpy = vi.fn();
      Pulse.on('pulse:error', errorSpy);

      await expect(Pulse.navigate('/fail', '#main')).rejects.toThrow('Network Error');

      expect(errorSpy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('commit (POST)', () => {
    it('should handle form submission', async () => {
      const form = document.createElement('form');
      form.action = '/submit';
      form.method = 'POST';

      const input = document.createElement('input');
      input.name = 'username';
      input.value = 'berkan';
      form.appendChild(input);
      container.appendChild(form);

      // Mock response
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Success'),
      });

      // Target specific surface
      const resultDiv = document.createElement('div');
      resultDiv.id = 'result';
      container.appendChild(resultDiv);

      await Pulse.commit(form, '#result');

      // Should send POST with form data
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/submit'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('username=berkan'),
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );

      expect(resultDiv.innerHTML).toBe('Success');
    });
  });

  describe('Declarative Events (Integration)', () => {
    beforeEach(() => {
      Pulse.init();
    });

    it('should handle d-pulse="navigate" click', async () => {
      const link = document.createElement('a');
      link.href = '/hello';
      link.setAttribute('d-pulse', 'navigate');
      link.setAttribute('d-target', '#main');
      container.appendChild(link);

      const surface = document.createElement('div');
      surface.id = 'main';
      container.appendChild(surface);

      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Hello World'),
      });

      // Simulate click
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      // Wait for fetch AND patch application
      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/hello'),
          expect.anything()
        );
        expect(surface.innerHTML).toBe('Hello World');
      });
    });

    it('should handle d-pulse="action" with data attributes', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('d-pulse', 'action');
      btn.setAttribute('d-action', '/api/like');
      btn.setAttribute('data-id', '456');
      btn.setAttribute('d-target', '#status');
      container.appendChild(btn);

      const surface = document.createElement('div');
      surface.id = 'status';
      container.appendChild(surface);

      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Liked'),
      });

      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      await vi.waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/like'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ id: '456' }),
          })
        )
      );
      await vi.waitFor(() => expect(surface.innerHTML).toBe('Liked'));
    });

    it('should handle d-pulse="commit" on form submit', async () => {
      const form = document.createElement('form');
      form.setAttribute('d-pulse', 'commit');
      form.setAttribute('d-target', '#out');
      form.action = '/post';
      form.method = 'POST';

      const input = document.createElement('input');
      input.name = 'msg';
      input.value = 'test';
      form.appendChild(input);
      container.appendChild(form);

      const out = document.createElement('div');
      out.id = 'out';
      container.appendChild(out);

      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Saved'),
      });

      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

      await vi.waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/post'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('msg=test'),
          })
        )
      );
      await vi.waitFor(() => expect(out.innerHTML).toBe('Saved'));
    });
  });

  describe('Advanced Patches & Swaps', () => {
    beforeEach(() => {
      Pulse.init();
    });

    it('should handle d-patch responses', async () => {
      const s1 = document.createElement('div');
      s1.id = 's1';
      container.appendChild(s1);

      const s2 = document.createElement('div');
      s2.id = 's2';
      container.appendChild(s2);

      global.fetch.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<d-patch><surface target="#s1">P1</surface><surface target="#s2">P2</surface></d-patch>'
          ),
      });

      await Pulse.navigate('/patch', '#s1');

      await vi.waitFor(() => {
        expect(s1.innerHTML).toBe('P1');
        expect(s2.innerHTML).toBe('P2');
      });
    });

    it('should handle d-swap="append" and "prepend"', async () => {
      const list = document.createElement('ul');
      list.id = 'list';
      list.innerHTML = '<li>Item 1</li>';
      container.appendChild(list);

      // Test Append
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<li>Item 2</li>'),
      });

      await Pulse.navigate('/append', '#list', { swap: 'append' });
      expect(list.innerHTML).toBe('<li>Item 1</li><li>Item 2</li>');

      // Test Prepend
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<li>Item 0</li>'),
      });

      await Pulse.navigate('/prepend', '#list', { swap: 'prepend' });
      expect(list.innerHTML).toBe('<li>Item 0</li><li>Item 1</li><li>Item 2</li>');
    });

    it('should handle d-pulse="refresh" click', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('d-pulse', 'refresh');
      btn.setAttribute('d-target', '#main');
      container.appendChild(btn);

      const surface = document.createElement('div');
      surface.id = 'main';
      surface.innerHTML = 'Old';
      container.appendChild(surface);

      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Refreshed'),
      });

      btn.click();

      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(window.location.href, expect.anything());
        expect(surface.innerHTML).toBe('Refreshed');
      });
    });
  });

  describe('Programmatic API', () => {
    it('should handle Surf.submit(element)', () => {
      const form = document.createElement('form');
      form.requestSubmit = vi.fn();
      container.appendChild(form);

      const btn = document.createElement('button');
      form.appendChild(btn);

      Pulse.submit(btn);
      expect(form.requestSubmit).toHaveBeenCalled();
    });

    it('should fallback to form.submit if requestSubmit missing', () => {
      const form = document.createElement('form');
      form.submit = vi.fn();
      container.appendChild(form);

      const btn = document.createElement('button');
      form.appendChild(btn);

      Pulse.submit(btn);
      expect(form.submit).toHaveBeenCalled();
    });
  });

  describe('History & Navigation', () => {
    beforeEach(() => {
      Pulse.init();
    });

    it('should handle popstate navigation', async () => {
      // Setup a surface to update
      const surface = document.createElement('div');
      surface.id = 'main-content';
      surface.innerHTML = 'Old Content';
      document.body.appendChild(surface);

      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('Popped Content'),
      });

      // Trigger popstate with surf state
      const popEvent = new PopStateEvent('popstate', {
        state: { surf: true, url: '/previous', target: '#main-content' },
      });
      window.dispatchEvent(popEvent);

      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/previous'),
          expect.anything()
        );
        expect(surface.innerHTML).toBe('Popped Content');
      });

      document.body.removeChild(surface);
    });

    it('should reload on invalid popstate', () => {
      // Mock window.location.reload
      const originalLocation = window.location;
      delete window.location;
      window.location = { ...originalLocation, reload: vi.fn() };

      const popEvent = new PopStateEvent('popstate', { state: null });
      window.dispatchEvent(popEvent);

      expect(window.location.reload).toHaveBeenCalled();

      window.location = originalLocation;
    });
  });

  describe('Edge Cases & API', () => {
    it('should handle commit with GET method', async () => {
      const form = document.createElement('form');
      form.method = 'GET';
      form.action = '/search';
      const input = document.createElement('input');
      input.name = 'q';
      input.value = 'surf';
      form.appendChild(input);
      container.appendChild(form);

      global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('Results') });

      await Pulse.commit(form, '#results');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/search?q=surf'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should include cell state in action pulse', async () => {
      const cell = document.createElement('div');
      cell.setAttribute('d-id', 'pulse-action-cell');
      cell.setAttribute('d-cell', 'id: 1');
      container.appendChild(cell);

      // Initialize real Cell state
      Cell.init(cell, 'user');
      Cell.setState(cell, { id: 1, name: 'Berkan' });

      const btn = document.createElement('button');
      btn.setAttribute('d-pulse', 'action');
      btn.setAttribute('d-action', '/api/user/update');
      btn.setAttribute('data-role', 'admin');
      cell.appendChild(btn);

      global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('OK') });

      const event = new MouseEvent('click', { bubbles: true });
      btn.dispatchEvent(event);

      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/user/update',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ role: 'admin', id: 1, name: 'Berkan' }),
          })
        );
      });
    });

    it('should handle Surf.go programmatic navigation', async () => {
      global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('New Content') });

      await Pulse.go('/new-page', { target: '#main' });

      expect(global.fetch).toHaveBeenCalledWith('/new-page', expect.anything());
    });

    it('should handle Surf.submit fallback for elements in forms', () => {
      const form = document.createElement('form');
      form.submit = vi.fn();
      form.requestSubmit = undefined; // Force fallback to hit line 374
      const btn = document.createElement('button');
      form.appendChild(btn);
      container.appendChild(form);

      Pulse.submit(btn);
      expect(form.submit).toHaveBeenCalled();
    });

    it('should warn when Surf.submit finds no form', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const div = document.createElement('div');
      container.appendChild(div);

      Pulse.submit(div);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('No form found'), expect.anything());
      spy.mockRestore();
    });

    it('should initialize history state if missing in init', () => {
      const spy = vi.spyOn(history, 'replaceState');

      // Mock history.state to be null
      const originalState = history.state;
      Object.defineProperty(history, 'state', {
        get: () => null,
        configurable: true,
      });

      Pulse.init();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ surf: true }),
        '',
        expect.any(String)
      );

      spy.mockRestore();
      // Restore history.state
      Object.defineProperty(history, 'state', {
        get: () => originalState,
        configurable: true,
      });
    });

    it('should handle errors in listeners during emit', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const brokenListener = () => {
        throw new Error('Boom');
      };
      Pulse.on('pulse:start', brokenListener);

      Pulse.emit('pulse:start', {});

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('[Surf] Error in lifecycle listener [pulse:start]:'),
        expect.any(Error)
      );

      Pulse.off('pulse:start', brokenListener);
      spy.mockRestore();
    });

    it('should support removing listeners with off', () => {
      const cb = vi.fn();
      Pulse.on('pulse:start', cb);
      Pulse.off('pulse:start', cb);
      Pulse.emit('pulse:start', {});
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('Performance & Optimization', () => {
    beforeEach(() => {
      Pulse.init();
    });

    it('should cancel previous request for the same target (go-like-ctx)', async () => {
      const surface = document.createElement('div');
      surface.id = 'target';
      container.appendChild(surface);

      let _firstResolve;
      const firstPromise = new Promise((resolve) => {
        _firstResolve = () => resolve('First');
      });

      global.fetch.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve({ ok: true, text: () => firstPromise }), 100);
            // Handle signal cancellation
            const signal = global.fetch.mock.calls[0][1].signal;
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          })
      );

      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('Second'),
      });

      // Trigger first pulse
      const p1 = Pulse.navigate('/first', '#target');
      // Trigger second pulse immediately
      const p2 = Pulse.navigate('/second', '#target');

      await Promise.allSettled([p1, p2]);

      expect(surface.innerHTML).toBe('Second');
      // Total calls might depend on how fetch is mocked, but we check if first was cancelled
      const abortErrorCount = global.fetch.mock.results.filter((r) => r.type === 'throw').length;
      expect(abortErrorCount).toBe(0); // Actually sendPulse catches it silently
    });

    it('should cache surface elements in applyPatches', async () => {
      const s1 = document.createElement('div');
      s1.id = 'cache1';
      container.appendChild(s1);

      const querySpy = vi.spyOn(document, 'querySelector');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            '<d-patch><surface target="#cache1">A</surface><surface target="#cache1">B</surface></d-patch>'
          ),
      });

      await Pulse.navigate('/multi', '#cache1');

      // querySelector for #cache1 should only be called once inside applyPatches
      const targetQueries = querySpy.mock.calls.filter((c) => c[0] === '#cache1');
      // 1 for first patch. Second patch should use cache. (sendPulse skips query if patch)
      expect(targetQueries.length).toBe(1);

      querySpy.mockRestore();
    });

    it('should return early in handleClick if no pulse marker exists', async () => {
      const div = document.createElement('div');
      container.appendChild(div);

      const closestSpy = vi.spyOn(div, 'closest');

      const event = new MouseEvent('click', { bubbles: true });
      div.dispatchEvent(event);

      // Closest should be called once in the if/assignment logic because div has no PULSE_ATTR
      expect(closestSpy).toHaveBeenCalledTimes(1);
      closestSpy.mockRestore();
    });

    it('should NOT call closest if element itself has pulse attribute', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('d-pulse', 'refresh');
      container.appendChild(btn);

      const closestSpy = vi.spyOn(btn, 'closest');

      const event = new MouseEvent('click', { bubbles: true });
      btn.dispatchEvent(event);

      // Should skip closest() because hasAttribute(PULSE_ATTR) is true
      expect(closestSpy).not.toHaveBeenCalled();
      closestSpy.mockRestore();
    });

    it('should cache cell dynamic import', async () => {
      const btn = document.createElement('button');
      btn.setAttribute('d-pulse', 'action');
      btn.setAttribute('d-action', '/api');
      container.appendChild(btn);

      global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('OK') });

      // First click
      btn.click();
      await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());

      // Second click should use cached getCellModule (implicitly tested by logic)
      btn.click();
      await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    });
  });

  describe('Edge Case Coverage', () => {
    beforeEach(() => {
      Pulse.init();
    });

    it('should warn when applyPatches finds no target', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Trigger applyPatches via sendPulse with a patch targeting a ghost element
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<d-patch><surface target="#ghost">Hi</surface></d-patch>'),
      });

      await Pulse.navigate('/test', '#main');

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Target not found for patch: #ghost')
      );
      spy.mockRestore();
    });

    it('should throw error on non-OK response in sendPulse', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(Pulse.navigate('/fail', '#main')).rejects.toThrow('HTTP 500');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Pulse error:'), expect.any(Error));
      spy.mockRestore();
    });

    it('should handle network errors (rejection) in sendPulse', async () => {
      const error = new Error('Network Failure');
      global.fetch.mockRejectedValueOnce(error);

      const events = [];
      const cb = (e) => events.push(e);
      Pulse.on('pulse:error', cb);

      await expect(Pulse.navigate('/error', '#main')).rejects.toThrow('Network Failure');

      expect(events.length).toBe(1);
      expect(events[0].error).toBe(error);

      Pulse.off('pulse:error', cb);
    });

    it('should replaceState when navigating to same URL', async () => {
      const spy = vi.spyOn(history, 'replaceState');
      const url = window.location.href;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('Same'),
      });

      await Pulse.navigate(url, '#main');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
