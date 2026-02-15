import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Surf from '../../src/surf.js';
import { VisualDebugger } from '../../src/plugins/debug-plugin.js';
import Events from '../../src/events.js';

describe('Visual Debugger Plugin', () => {
  let container;
  let host;
  let shadow;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock scrollIntoView as JSDOM doesn't support it
    Element.prototype.scrollIntoView = vi.fn();

    // Ensure plugin is installed
    if (!Surf.plugins.some((p) => p.name === 'VisualDebugger')) {
      Surf.use(VisualDebugger);
    }

    // Toggle on to initialize UI
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }));

    host = document.getElementById('surf-debugger-host');
    shadow = host?.shadowRoot;

    // Use fake timers for animation testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (VisualDebugger.__test) VisualDebugger.__test.reset();
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Reset global state marker
    window.__SURF_DEBUG_INSTALLED__ = false;
  });

  it('should initialize and register with Surf', () => {
    expect(Surf.plugins.some((p) => p.name === 'VisualDebugger')).toBe(true);
  });

  it('should toggle UI on Shift + D', async () => {
    // Already ON from beforeEach, toggle OFF
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }));
    const panel = shadow.querySelector('.surf-debug-panel');
    expect(panel.classList.contains('active')).toBe(false);

    // Toggle back ON
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D', shiftKey: true }));
    expect(panel.classList.contains('active')).toBe(true);
  });

  it('should display active cells in the panel', async () => {
    container.innerHTML = `
      <div d-cell="{ count: 1 }" d-id="test-cell" id="test-cell">
        <span d-text="count"></span>
      </div>
    `;
    Surf.Cell.initAll(container);

    // Give it a tiny bit of time for the cell:init event to propagate and refresh UI
    await vi.waitFor(() => {
      const cellItem = shadow.querySelector('.cell-item[data-cell-id="test-cell"]');
      expect(cellItem).not.toBeNull();
      expect(cellItem.textContent).toContain('"count": 1');
    });
  });

  it('should update timeline on Pulse events', async () => {
    // Mock fetch for pulse
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('OK'),
      headers: new Headers(),
    });

    await Surf.go('/test', { target: '#main' });

    await vi.waitFor(() => {
      const timeline = shadow.querySelector('.timeline-section');
      expect(timeline.textContent).toContain('pulse');
      expect(timeline.textContent).toContain('GET /test -> #main');
    });
  });

  it('should handle Target interaction correctly', async () => {
    container.innerHTML = `<div d-cell="{}" d-id="target-test" id="target-test"></div>`;
    Surf.Cell.initAll(container);

    const el = container.querySelector('#target-test');

    // Trigger target event
    shadow.dispatchEvent(
      new CustomEvent('surf-debug-target', {
        detail: { type: 'cell', id: 'target-test' },
        bubbles: true,
        composed: true,
      })
    );

    expect(el.scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));

    // Advance time for highlight animation
    vi.advanceTimersByTime(610);
    expect(el.classList.contains('surf-highlight-signal')).toBe(true);

    vi.advanceTimersByTime(2100);
    expect(el.classList.contains('surf-highlight-signal')).toBe(false);
  });

  it('should implement Key-Value editing and saving', async () => {
    container.innerHTML = `<div d-cell="{ count: 10, active: true }" d-id="edit-test" id="edit-test"></div>`;
    Surf.Cell.initAll(container);

    // 1. Enter edit mode
    shadow.dispatchEvent(
      new CustomEvent('surf-debug-edit', {
        detail: 'edit-test',
        bubbles: true,
        composed: true,
      })
    );

    const countInput = shadow.querySelector('input[data-key="count"]');
    expect(countInput).not.toBeNull();
    countInput.value = '20';

    // 2. Save
    const setStateSpy = vi.spyOn(Surf, 'setState');
    shadow.dispatchEvent(
      new CustomEvent('surf-debug-save', {
        detail: 'edit-test',
        bubbles: true,
        composed: true,
      })
    );

    expect(setStateSpy).toHaveBeenCalledWith(
      container.querySelector('#edit-test'),
      expect.objectContaining({ count: 20 })
    );

    // Verify UI exited edit mode
    expect(shadow.querySelector('.cell-edit-fields')).toBeNull();
  });

  it('should draw boundaries on window resize', async () => {
    container.innerHTML = `<div d-cell="{}" d-id="b-cell" style="width:100px; height:50px;"></div>`;

    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 10,
      width: 100,
      height: 50,
      bottom: 60,
      right: 110,
    });

    window.dispatchEvent(new Event('resize'));

    const overlay = shadow.querySelector('.surf-debug-overlay');
    expect(overlay.querySelectorAll('.surf-boundary').length).toBe(1);
    expect(overlay.textContent).toContain('CELL: b-cell');
  });

  it('should handle timeline clear', async () => {
    Events.emit('pulse:start', { url: '/api', target: '#target' });

    const timeline = shadow.querySelector('.timeline-section');
    expect(timeline.querySelectorAll('.timeline-item').length).toBe(1);

    const clearBtn = shadow.querySelector('.clear-btn');
    clearBtn.click();

    // Check global shadow count to avoid stale timeline element
    expect(shadow.querySelectorAll('.timeline-item').length).toBe(0);
  });

  it('should highlight signals onFramework Warning and allow targeting', async () => {
    // Suppress the expected warning in console for this test
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    container.innerHTML = `<div><div d-cell="{}"></div></div>`;
    Surf.Cell.initAll(container);

    const timeline = shadow.querySelector('.warnings-section');
    expect(timeline.textContent).toContain('Framework Warning: missing-id');

    const targetBtn = timeline.querySelector('.target-btn');
    expect(targetBtn).not.toBeNull();

    const anonCell = container.querySelector('[d-cell]');
    targetBtn.click();

    expect(anonCell.scrollIntoView).toHaveBeenCalled();
  });

  it('should handle Echo lifecycle events', async () => {
    Events.emit('echo:before', { surface: { id: 's1' } });
    Events.emit('echo:after', { surface: { id: 's1' } });

    const timeline = shadow.querySelector('.timeline-section');
    expect(timeline.textContent).toContain('Snapshotting surface s1');
    expect(timeline.textContent).toContain('Restored surface s1');
  });
});
