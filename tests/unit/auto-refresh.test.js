
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
        el.setAttribute('d-auto-refresh', '1000');
        el.setAttribute('d-auto-refresh-url', url);
        container.appendChild(el);
        
        global.fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('Updated')
        });

        const mockSurf = {
            _modules: {
                Surface: { replace: vi.fn() },
                Patch: { isPatch: vi.fn().mockReturnValue(false), parse: vi.fn() },
                Echo: { withPreservation: (el, cb) => cb() }
            }
        };

        AutoRefresh.install(mockSurf);

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
         
         const mockSurf = {
             _modules: {
                 Surface: { replace: vi.fn() },
                 Patch: { isPatch: vi.fn().mockReturnValue(false), parse: vi.fn() },
                 Echo: { withPreservation: (el, cb) => cb() }
             }
         };
         
         AutoRefresh.install(mockSurf);
         
         expect(global.fetch).toHaveBeenCalledTimes(2); // Initial calls
         
         vi.advanceTimersByTime(1000);
         expect(global.fetch).toHaveBeenCalledTimes(3); // el1 refreshed
         
         vi.advanceTimersByTime(1000); // Total 2000
         expect(global.fetch).toHaveBeenCalledTimes(5); // el1 (2nd time) + el2 (1st time)
    });

    it('should handle patch responses in auto-refresh', async () => {
        const el = document.createElement('div');
        el.setAttribute('d-auto-refresh', '1000');
        container.appendChild(el);

        const target1 = document.createElement('div');
        target1.id = 's1';
        container.appendChild(target1);

        const target2 = document.createElement('div');
        target2.id = 's2';
        container.appendChild(target2);

        global.fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('<d-patch><surface target="#s1">P1</surface><surface target="#s2">P2</surface></d-patch>')
        });

        const mockSurf = {
            _modules: {
                Surface: { replace: vi.fn() },
                Patch: { 
                    isPatch: vi.fn().mockReturnValue(true), 
                    parse: vi.fn().mockReturnValue([
                        { target: '#s1', content: 'P1' },
                        { target: '#s2', content: 'P2' }
                    ]) 
                },
                Echo: { withPreservation: (el, cb) => cb() }
            }
        };

        AutoRefresh.install(mockSurf);
        
        // Initial fetch happens immediately
        await vi.waitFor(() => {
            expect(mockSurf._modules.Surface.replace).toHaveBeenCalledWith(target1, 'P1');
            expect(mockSurf._modules.Surface.replace).toHaveBeenCalledWith(target2, 'P2');
        });
    });

    it('should handle fetch errors gracefully', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const el = document.createElement('div');
        el.setAttribute('d-auto-refresh', '1000');
        container.appendChild(el);

        global.fetch.mockRejectedValue(new Error('Fail'));

        const mockSurf = {
            _modules: {
                Surface: { replace: vi.fn() },
                Patch: { isPatch: vi.fn() },
                Echo: { withPreservation: (el, cb) => cb() }
            }
        };

        AutoRefresh.install(mockSurf);
        await Promise.resolve();

        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Auto-refresh failed'), expect.anything());
        spy.mockRestore();
    });
});
