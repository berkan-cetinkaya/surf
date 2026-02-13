import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import Debounce from '../../src/plugins/debounce.js';

describe('Debounce Plugin', () => {
  let mockSurf;
  let container;

  beforeAll(() => {
    // Mock Surf interface
    mockSurf = {
      go: vi.fn(),
    };

    // Install plugin ONCE to avoid duplicate listeners on document
    Debounce.install(mockSurf);
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Use fake timers
    vi.useFakeTimers();

    // Reset mocks between tests
    mockSurf.go.mockClear();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
    vi.useRealTimers();
    // Note: document listener persists, but that's handled by beforeAll
  });

  it('should trigger Surf.go after delay', () => {
    const input = document.createElement('input');
    input.setAttribute('d-input', '/search');
    input.setAttribute('d-debounce', '300');
    input.value = 'test';
    container.appendChild(input);

    // Trigger input
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Should not call immediately
    expect(mockSurf.go).not.toHaveBeenCalled();

    // Advance timer
    vi.advanceTimersByTime(300);

    // Should call
    expect(mockSurf.go).toHaveBeenCalledWith('/search?q=test', expect.anything());
  });

  it('should debounce multiple inputs', () => {
    const input = document.createElement('input');
    input.setAttribute('d-input', '/search');
    input.setAttribute('d-debounce', '300');
    container.appendChild(input);

    // Type "t"
    input.value = 't';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(100);

    // Type "te"
    input.value = 'te';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(100);

    // Type "tes"
    input.value = 'tes';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Advance 299ms (total from last input)
    vi.advanceTimersByTime(299);
    expect(mockSurf.go).not.toHaveBeenCalled();

    // Advance 1ms more
    vi.advanceTimersByTime(1);
    expect(mockSurf.go).toHaveBeenCalledTimes(1);
    expect(mockSurf.go).toHaveBeenCalledWith('/search?q=tes', expect.anything());
  });

  it('should respect d-min-length', () => {
    const input = document.createElement('input');
    input.setAttribute('d-input', '/search');
    input.setAttribute('d-debounce', '300');
    input.setAttribute('d-min-length', '5');
    container.appendChild(input);

    input.value = 'short'; // 5 chars
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);

    // 'short' is 5 chars. min-length 5 means >= 5 or > 5?
    // Code: value.length < minLength return.
    // 5 < 5 is false. So it proceeds.
    expect(mockSurf.go).toHaveBeenCalledTimes(1);
    expect(mockSurf.go).toHaveBeenCalledWith('/search?q=short', expect.anything());

    mockSurf.go.mockClear();

    input.value = 'tiny'; // 4 chars
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    expect(mockSurf.go).not.toHaveBeenCalled();
  });

  it('should use custom parameter name if provided', () => {
    const input = document.createElement('input');
    input.setAttribute('d-input', '/filter');
    input.name = 'category';
    input.value = 'books';
    container.appendChild(input);

    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);

    expect(mockSurf.go).toHaveBeenCalledWith('/filter?category=books', expect.anything());
  });
});
