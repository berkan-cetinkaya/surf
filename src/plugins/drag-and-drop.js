/**
 * Drag & Drop Plugin for Surf
 * 
 * Enables declarative drag and drop functionality.
 * Usage:
 * <div d-drag-zone>
 *   <div d-draggable="true" d-drag-data='{"id": 1}'>Item</div>
 * </div>
 */
const DragAndDrop = {
  name: 'SurfDragAndDrop',

  install(Surf, options = {}) {
    let draggedItem = null;

    // Helper to initialize draggable elements
    const initDraggables = (root = document) => {
      root.querySelectorAll('[d-draggable="true"]').forEach(el => {
        el.setAttribute('draggable', 'true');
      });
    };

    // Initialize existing elements
    initDraggables();

    // Observe for new elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.hasAttribute('d-draggable')) {
              node.setAttribute('draggable', 'true');
            }
            // Check children
            initDraggables(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Global drag start handler
    document.addEventListener('dragstart', (e) => {
      // Allow preventing drag on specific children (like buttons, inputs, etc)
      if (e.target.closest('[d-no-drag]')) {
        e.preventDefault();
        return;
      }

      if (!e.target.closest('[d-draggable="true"]')) return;
      
      const target = e.target.closest('[d-draggable="true"]');
      draggedItem = target;
      
      // Get data
      const data = target.getAttribute('d-drag-data');
      if (data) {
        e.dataTransfer.setData('text/plain', data);
      }
      
      e.dataTransfer.effectAllowed = 'move';
      target.classList.add('dragging');
    });

    // Global drag end handler
    document.addEventListener('dragend', (e) => {
      if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
      }
      
      // Cleanup drag-over classes
      document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
      });
    });

    // Global drag over handler
    document.addEventListener('dragover', (e) => {
      const dropZone = e.target.closest('[d-drop-zone]');
      if (!dropZone) return;

      e.preventDefault(); // Allow drop
      e.dataTransfer.dropEffect = 'move';
      
      dropZone.classList.add('drag-over');
    });

    // Global drag leave handler
    document.addEventListener('dragleave', (e) => {
      const dropZone = e.target.closest('[d-drop-zone]');
      if (!dropZone) return;

      // Only remove if we really left the element (not just entered a child)
      const rect = dropZone.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      
      if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
        dropZone.classList.remove('drag-over');
      }
    });

    // Global drop handler
    document.addEventListener('drop', async (e) => {
      const dropZone = e.target.closest('[d-drop-zone]');
      if (!dropZone) return;

      e.preventDefault();
      dropZone.classList.remove('drag-over');

      const url = dropZone.getAttribute('d-drop-url');
      if (!url) return;

      try {
        const rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) return;

        const data = JSON.parse(rawData);
        
        // Add drop zone data if exists
        const zoneDataRaw = dropZone.getAttribute('d-drop-data');
        if (zoneDataRaw) {
          const zoneData = JSON.parse(zoneDataRaw);
          Object.assign(data, zoneData);
        }

        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
          formData.append(key, value);
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData
        });

        if (response.ok) {
          const patchHtml = await response.text();
          if (Surf && Surf.applyPatch) {
            Surf.applyPatch(patchHtml);
          }
        } else {
          console.error('[Surf DnD] Drop request failed', response.status);
        }
      } catch (err) {
        console.error('[Surf DnD] Drop error', err);
      }
    });

    console.log('[Surf] Drag & Drop plugin installed');
  }
};

export default DragAndDrop;
