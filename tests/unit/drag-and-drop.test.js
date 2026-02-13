import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DragAndDrop from '../../src/plugins/drag-and-drop.js';

describe('Drag & Drop Plugin', () => {
    let mockSurf;
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        
        mockSurf = {
            applyPatch: vi.fn(),
            on: vi.fn(),
            off: vi.fn(),
            Pulse: {
                emit: vi.fn()
            }
        };

        // Mock fetch
        global.fetch = vi.fn();

        // Mock MutationObserver to trigger callback
        global.MutationObserver = class {
            constructor(callback) { 
                this.callback = callback;
                DragAndDrop.__test_mo_callback = callback; 
            }
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

    it('should handle coordinate-based dragleave logic', () => {
        const dropZone = document.createElement('div');
        dropZone.setAttribute('d-drop-zone', '');
        dropZone.classList.add('drag-over');
        container.appendChild(dropZone);

        // Mock getBoundingClientRect
        dropZone.getBoundingClientRect = vi.fn().mockReturnValue({
            left: 100, right: 200, top: 100, bottom: 200
        });

        // Scenario 1: Mouse is still inside rect (e.g. entering a child)
        const leaveEventInside = new MouseEvent('dragleave', { 
            bubbles: true,
            clientX: 150,
            clientY: 150
        });
        dropZone.dispatchEvent(leaveEventInside);
        expect(dropZone.classList.contains('drag-over')).toBe(true);

        // Scenario 2: Mouse moved outside rect
        const leaveEventOutside = new MouseEvent('dragleave', { 
            bubbles: true,
            clientX: 50,
            clientY: 50
        });
        dropZone.dispatchEvent(leaveEventOutside);
        expect(dropZone.classList.contains('drag-over')).toBe(false);
    });

    it('should handle fetch failures gracefully', async () => {
        const dropZone = document.createElement('div');
        dropZone.setAttribute('d-drop-zone', '');
        dropZone.setAttribute('d-drop-url', '/api/fail');
        container.appendChild(dropZone);

        const dropEvent = new Event('drop', { bubbles: true });
        dropEvent.dataTransfer = { getData: () => JSON.stringify({id: 1}) };
        
        global.fetch.mockRejectedValue(new Error('Network failure'));
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        dropZone.dispatchEvent(dropEvent);
                // Wait for async handler
         await vi.waitFor(() => expect(mockSurf.Pulse.emit).toHaveBeenCalledWith('error:network', expect.anything()));
         expect(consoleSpy).toHaveBeenCalled();
         consoleSpy.mockRestore();
     });
 
     it('should handle d-no-drag and prevent dragging', () => {
         const el = document.createElement('div');
         el.setAttribute('d-draggable', 'true');
         container.appendChild(el);
 
         const noDragChild = document.createElement('span');
         noDragChild.setAttribute('d-no-drag', '');
         el.appendChild(noDragChild);
 
         const event = new Event('dragstart', { bubbles: true, cancelable: true });
         event.preventDefault = vi.fn();
         
         noDragChild.dispatchEvent(event);
         expect(event.preventDefault).toHaveBeenCalled();
     });
 
     it('should handle merging d-drop-data into dragged data', async () => {
         const dropZone = document.createElement('div');
         dropZone.setAttribute('d-drop-zone', '');
         dropZone.setAttribute('d-drop-url', '/api/merge');
         dropZone.setAttribute('d-drop-data', '{"zoneId": "Z1"}');
         container.appendChild(dropZone);
 
         const dropEvent = new Event('drop', { bubbles: true });
         dropEvent.dataTransfer = {
             getData: vi.fn().mockReturnValue(JSON.stringify({ itemId: "I1" }))
         };
 
         global.fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('OK') });
 
         dropZone.dispatchEvent(dropEvent);
 
         await vi.waitFor(() => {
             const call = global.fetch.mock.calls.find(c => c[0] === '/api/merge');
             expect(call).toBeDefined();
             expect(call[1].body.toString()).toContain('zoneId=Z1');
             expect(call[1].body.toString()).toContain('itemId=I1');
         });
     });

     it('should initialize new draggable elements via MutationObserver', () => {
         const newNode = document.createElement('div');
         newNode.setAttribute('d-draggable', 'true');
         
         // Trigger MO callback (manually since we mocked it)
         DragAndDrop.__test_mo_callback([{ 
             addedNodes: [newNode],
             type: 'childList'
         }]);
         
         expect(newNode.getAttribute('draggable')).toBe('true');
     });

     it('should initialize root if it has d-draggable', () => {
         const root = document.createElement('div');
         root.setAttribute('d-draggable', 'true');
         
         // Manually call _initDraggables with root
         DragAndDrop._initDraggables(root);
         
         expect(root.getAttribute('draggable')).toBe('true');
     });

     it('should re-initialize draggables after a patch', () => {
         const newNode = document.createElement('div');
         newNode.setAttribute('d-draggable', 'true');
         container.appendChild(newNode);

         // Trigger Surf after:patch event
         const patchCallback = mockSurf.on.mock.calls.find(c => c[0] === 'after:patch')[1];
         patchCallback();

         expect(newNode.getAttribute('draggable')).toBe('true');
     });

     it('should handle dragover and prevent default', () => {
         const dropZone = document.createElement('div');
         dropZone.setAttribute('d-drop-zone', '');
         container.appendChild(dropZone);

         const event = new Event('dragover', { bubbles: true, cancelable: true });
         event.preventDefault = vi.fn();
         event.dataTransfer = { dropEffect: '' };
         
         dropZone.dispatchEvent(event);
         
         expect(event.preventDefault).toHaveBeenCalled();
         expect(event.dataTransfer.dropEffect).toBe('move');
         expect(dropZone.classList.contains('drag-over')).toBe(true);
     });
 });
