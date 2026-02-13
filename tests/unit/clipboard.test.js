import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Clipboard from '../../src/plugins/clipboard.js';

describe('Clipboard Plugin', () => {
  let mockSurf;
  let mockClipboard;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Mock Surf
    mockSurf = {
      register: vi.fn(),
      setState: vi.fn(),
      getState: vi.fn(),
    };

    // Mock navigator.clipboard
    mockClipboard = {
      writeText: vi.fn().mockResolvedValue(),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    // Use fake timers for feedback duration
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should register itself via Surf.use', () => {
    Clipboard.install(mockSurf);
    expect(mockSurf.register).toHaveBeenCalledWith('Clipboard', expect.any(Object));
    expect(mockSurf.register).toHaveBeenCalledTimes(1);
  });

  it('should copy text from target element (string)', async () => {
    Clipboard.install(mockSurf);
    const plugin = mockSurf.register.mock.calls[0][1];

    // Scenario: target is just a string (not element)
    await plugin.copy('Hello World');

    expect(mockClipboard.writeText).toHaveBeenCalledWith('Hello World');
  });

  it('should copy text from previous sibling code block', async () => {
    Clipboard.install(mockSurf);
    const plugin = mockSurf.register.mock.calls[0][1];

    // DOM Structure: <code>Text</code> <button>Copy</button>
    const codeEl = document.createElement('code');
    codeEl.innerText = 'Code Content';
    container.appendChild(codeEl);

    const btn = document.createElement('button');
    container.appendChild(btn);

    // Call copy with button element
    await plugin.copy(btn);

    expect(mockClipboard.writeText).toHaveBeenCalledWith('Code Content');
  });

  it('should prevent copy if already copied (double-click prevention)', async () => {
    Clipboard.install(mockSurf);
    const plugin = mockSurf.register.mock.calls[0][1];

    // DOM Structure: <div d-cell> <button>...</div>
    const cell = document.createElement('div');
    cell.setAttribute('d-cell', '{ copied: true }');
    container.appendChild(cell);

    const btn = document.createElement('button');
    cell.appendChild(btn);

    // Mock Surf.getState to return copied: true
    mockSurf.getState.mockReturnValue({ copied: true });

    await plugin.copy(btn);

    // Should NOT call clipboard write
    expect(mockClipboard.writeText).not.toHaveBeenCalled();
  });

  it('should set copied state and revert after timeout', async () => {
    Clipboard.install(mockSurf, { timeout: 1000 });
    const plugin = mockSurf.register.mock.calls[0][1];

    const cell = document.createElement('div');
    cell.setAttribute('d-cell', '{ copied: false }');
    container.appendChild(cell);

    // Add code element so resolveText finds text
    const code = document.createElement('code');
    code.innerText = 'Test Code';
    cell.appendChild(code);

    const btn = document.createElement('button');
    cell.appendChild(btn);

    mockSurf.getState.mockReturnValue({ copied: false });

    // Trigger copy
    await plugin.copy(btn);

    expect(mockClipboard.writeText).toHaveBeenCalled();

    // Wait for promise resolution (microtask)
    await Promise.resolve();
    // Wait for then() callback
    await Promise.resolve();

    // Should set state to true
    expect(mockSurf.setState).toHaveBeenCalledWith(cell, { copied: true });

    // Fast forward timer
    vi.advanceTimersByTime(1000);

    // Should revert state
    expect(mockSurf.setState).toHaveBeenCalledWith(cell, { copied: false });
  });

  it('should handle event object and stop propagation', async () => {
    Clipboard.install(mockSurf);
    const plugin = mockSurf.register.mock.calls[0][1];

    const btn = document.createElement('button');
    const event = new Event('click');
    Object.defineProperty(event, 'currentTarget', { value: btn });
    vi.spyOn(event, 'stopPropagation');

    // Mock text resolution (since button has no sibling code, pass explicit text? No, plugin resolves from sibling)
    // Let's rely on resolveText returning null if no code found, but propagation should still stop.
    // Or setup DOM.
    const codeEl = document.createElement('code');
    codeEl.innerText = 'Text';
    container.appendChild(codeEl);
    container.appendChild(btn);

    await plugin.copy(event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(mockClipboard.writeText).toHaveBeenCalledWith('Text');
  });
});
