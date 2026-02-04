
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AutoRefresh from '../../src/plugins/auto-refresh.js';

describe('Auto-Refresh Plugin', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        // Mock fetch and timers
        global.fetch = vi.fn();
        vi.useFakeTimers();
    });

    afterEach(() => {
        document.body.removeChild(container);
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should set up polling for d-auto-refresh elements', () => {
        const url = '/api/poll';
        const el = document.createElement('div');
        el.setAttribute('d-surface', '');
        el.setAttribute('d-auto-refresh', '1000');
        el.setAttribute('d-auto-refresh-url', url);
        container.appendChild(el);
        
        global.fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('Updated')
        });

        AutoRefresh.init();

        // Should fetch immediately
        expect(global.fetch).toHaveBeenCalledWith(url, expect.anything());
        expect(global.fetch).toHaveBeenCalledTimes(1);
        
        // Fast forward 1s
        vi.advanceTimersByTime(1000);
        expect(global.fetch).toHaveBeenCalledTimes(2);
        
        // Fast forward 2s
        vi.advanceTimersByTime(2000);
        expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('should iterate over multiple refresh elements', () => {
         const el1 = document.createElement('div');
         el1.setAttribute('d-auto-refresh', '1000');
         container.appendChild(el1);
         
         const el2 = document.createElement('div');
         el2.setAttribute('d-auto-refresh', '2000');
         container.appendChild(el2);
         
         global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('ok')});
         
         AutoRefresh.init();
         
         expect(global.fetch).toHaveBeenCalledTimes(2); // Initial calls
         
         vi.advanceTimersByTime(1000);
         expect(global.fetch).toHaveBeenCalledTimes(3); // el1 refreshed
         
         vi.advanceTimersByTime(1000); // Total 2000
         expect(global.fetch).toHaveBeenCalledTimes(5); // el1 (2nd time) + el2 (1st time)
    });
});
