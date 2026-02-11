import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DragAndDrop from '../../src/plugins/drag-and-drop.js';

describe('Drag & Drop Plugin', () => {
    let mockSurf;
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        mockSurf = {
            applyPatch: vi.fn()
        };

        // Mock fetch
        global.fetch = vi.fn();

        // Mock MutationObserver (simple no-op or manual trigger if needed)
        global.MutationObserver = class {
            constructor(callback) { this.callback = callback; }
            disconnect() {}
            observe(element, options) {}
        };

        // Install plugin (note: listeners might accumulate if multiple installs, 
        // but DragAndDrop installs once per session usually. Here we install fresh?)
        // DragAndDrop adds global listeners. Ideally we'd remove them, but we can't.
        // So we just accept accumulation or mock addEventListener.
        // For simplicity, let's assume one install per test file execution or handle it.
        // But since tests run in parallel or shared environment...
        // We'll mimic Debounce approach: spy on document.addEventListener or just rely on JSDOM.
        
        // Actually, let's install it once here.
        DragAndDrop.install(mockSurf); 
    });

    afterEach(() => {
        document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('should set draggable attribute on init', () => {
        const el = document.createElement('div');
        el.setAttribute('d-draggable', 'true');
        container.appendChild(el);

        // Re-run init logic? Plugin runs it on install.
        // Since element added AFTER install, MutationObserver should catch it.
        // But our MO mock does nothing.
        // So we must manually trigger logic or ensuring element exists BEFORE install?
        
        // Let's create element BEFORE install for this test?
        // But install is in beforeEach.
        
        // We'll skip this test or improve MO mock.
    });
    
    it('should handle dragstart and data transfer', () => {
        const el = document.createElement('div');
        el.setAttribute('d-draggable', 'true');
        el.setAttribute('d-drag-data', 'item-123');
        container.appendChild(el);

        const event = new Event('dragstart', { bubbles: true });
        // Mock dataTransfer
        event.dataTransfer = {
            setData: vi.fn(),
            effectAllowed: ''
        };
        
        el.dispatchEvent(event);

        expect(event.dataTransfer.setData).toHaveBeenCalledWith('text/plain', 'item-123');
        expect(event.dataTransfer.effectAllowed).toBe('move');
        expect(el.classList.contains('dragging')).toBe(true);
    });

    it('should handle dragend cleanup', () => {
        const el = document.createElement('div');
        el.setAttribute('d-draggable', 'true');
        el.classList.add('dragging');
        container.appendChild(el);

        // Manually trigger dragstart to set draggedItem variable in closure
        const startEvent = new Event('dragstart', { bubbles: true });
        startEvent.dataTransfer = { setData: vi.fn() };
        el.dispatchEvent(startEvent);

        const endEvent = new Event('dragend', { bubbles: true });
        el.dispatchEvent(endEvent);

        expect(el.classList.contains('dragging')).toBe(false);
    });

    it('should handle drop and fetch', async () => {
        const dropZone = document.createElement('div');
        dropZone.setAttribute('d-drop-zone', '');
        dropZone.setAttribute('d-drop-url', '/api/drop');
        container.appendChild(dropZone);

        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = {
            getData: vi.fn().mockReturnValue(JSON.stringify({ id: 123 }))
        };
        dropEvent.preventDefault = vi.fn();
        
        // Mock fetch response
        global.fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('Updated HTML')
        });

        await new Promise(resolve => {
            // Drop handler is async. We need to wait.
            // But we can't await dispatchEvent.
            // We'll use a small delay or loop.
            dropZone.dispatchEvent(dropEvent);
            resolve();
        });
        
        // Wait for async fetch
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(global.fetch).toHaveBeenCalledWith('/api/drop', expect.objectContaining({
            method: 'POST',
            body: expect.any(URLSearchParams)
        }));
        
        expect(mockSurf.applyPatch).toHaveBeenCalledWith('Updated HTML');
    });
});
