
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Pulse from '../../src/pulse.js';
import Surface from '../../src/surface.js';

describe('Pulse Module', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        // Mock global fetch
        global.fetch = vi.fn();
    });

    afterEach(() => {
        document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    describe('navigate (GET)', () => {
        it('should send GET request and update target', async () => {
            const surface = document.createElement('div');
            surface.id = 'main';
            surface.setAttribute('d-surface', '');
            container.appendChild(surface);

            // Mock successful response
            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                text: () => Promise.resolve('<h1>New Page</h1>')
            });

            await Pulse.navigate('/new-page', '#main');

            expect(global.fetch).toHaveBeenCalledWith('/new-page', expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({ 'X-Surf-Request': 'true' })
            }));

            // Should update surface content
            expect(surface.innerHTML).toBe('<h1>New Page</h1>');
        });

        it('should emit lifecycle events', async () => {
             const surface = document.createElement('div');
             surface.id = 'main';
             surface.setAttribute('d-surface', '');
             container.appendChild(surface);

             global.fetch.mockResolvedValue({
                 ok: true,
                 text: () => Promise.resolve('Content')
             });

             const beforeSpy = vi.fn();
             const afterSpy = vi.fn();

             Pulse.on('before:pulse', beforeSpy);
             Pulse.on('after:patch', afterSpy);

             await Pulse.navigate('/test', '#main');

             expect(beforeSpy).toHaveBeenCalled();
             expect(afterSpy).toHaveBeenCalled();
        });
        
        it('should handle network errors', async () => {
             global.fetch.mockRejectedValue(new Error('Network Error'));
             const errorSpy = vi.fn();
             Pulse.on('error:network', errorSpy);

             await Pulse.navigate('/fail', '#main');

             expect(errorSpy).toHaveBeenCalled();
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
                text: () => Promise.resolve('Success')
            });
            
            // Target specific surface
            const resultDiv = document.createElement('div');
            resultDiv.id = 'result';
            resultDiv.setAttribute('d-surface', '');
            container.appendChild(resultDiv);

            await Pulse.commit(form, '#result');
            
            // Should send POST with form data
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/submit'), expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('username=berkan'),
                headers: expect.objectContaining({
                    'Content-Type': 'application/x-www-form-urlencoded'
                })
            }));
            
            expect(resultDiv.innerHTML).toBe('Success');
        });
    });
});
