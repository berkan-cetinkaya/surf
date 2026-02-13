/**
 * Drag & Drop Plugin for Surf
 *
 * Enables declarative drag and drop functionality.
 * Usage:
 * <div d-drop-zone d-drop-url="/api/move">
 *   <div d-draggable="true" d-drag-data='{"id": 1}'>Item</div>
 * </div>
 */

/**
 * Drag & Drop Plugin for Surf
 *
 * Enables declarative drag and drop functionality.
 * Usage:
 * <div d-drop-zone d-drop-url="/api/move">
 *   <div d-draggable="true" d-drag-data='{"id": 1}'>Item</div>
 * </div>
 */
const DragAndDrop = {
  name: 'SurfDragAndDrop',

  // Private State (Not strictly private but prefixed as per convention)
  _Surf: null,
  _draggedItem: null,

  /**
   * Install the plugin
   * @param {Object} Surf - The Surf instance
   * @param {Object} options - Plugin options
   */
  install(Surf, _options = {}) {
    this._Surf = Surf;

    // Initialize existing elements
    this._initDraggables();

    // Observe for new elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // ELEMENT_NODE
            this._initDraggables(node);
          }
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Explicitly re-init draggables after any patch
    Surf.on('after:patch', (_detail) => {
      this._initDraggables();
    });

    // Bind event handlers to maintain `this` context
    document.addEventListener('dragstart', this._onDragStart.bind(this));
    document.addEventListener('dragend', this._onDragEnd.bind(this));
    document.addEventListener('dragover', this._onDragOver.bind(this));
    document.addEventListener('dragleave', this._onDragLeave.bind(this));
    document.addEventListener('drop', this._onDrop.bind(this));

    console.log('[Surf] Drag & Drop plugin installed');
  },

  /**
   * Initialize draggable elements
   * @private
   * @param {Element|Document} root
   */
  _initDraggables(root = document) {
    const els =
      root === document
        ? document.querySelectorAll('[d-draggable="true"]')
        : root.querySelectorAll
          ? root.querySelectorAll('[d-draggable="true"]')
          : [];

    if (root.hasAttribute && root.hasAttribute('d-draggable')) {
      root.setAttribute('draggable', 'true');
    }

    els.forEach((el) => {
      el.setAttribute('draggable', 'true');
    });

    if (els.length > 0) {
      console.debug(`[Surf DnD] Initialized ${els.length} draggable(s)`);
    }
  },

  /**
   * Handle drag start
   * @private
   * @param {DragEvent} e
   */
  _onDragStart(e) {
    if (e.target.closest('[d-no-drag]')) {
      e.preventDefault();
      return;
    }

    const target = e.target.closest('[d-draggable="true"]');
    if (!target) return;

    this._draggedItem = target;
    const data = target.getAttribute('d-drag-data');

    if (data) {
      e.dataTransfer.setData('text/plain', data);
    }

    e.dataTransfer.effectAllowed = 'move';
    target.classList.add('dragging');
  },

  /**
   * Handle drag end
   * @private
   * @param {DragEvent} e
   */
  _onDragEnd(_e) {
    if (this._draggedItem) {
      this._draggedItem.classList.remove('dragging');
      this._draggedItem = null;
    }
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
  },

  /**
   * Handle drag over
   * @private
   * @param {DragEvent} e
   */
  _onDragOver(e) {
    const dropZone = e.target.closest('[d-drop-zone]');
    if (!dropZone) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropZone.classList.add('drag-over');
  },

  /**
   * Handle drag leave
   * @private
   * @param {DragEvent} e
   */
  _onDragLeave(e) {
    const dropZone = e.target.closest('[d-drop-zone]');
    if (!dropZone) return;

    const rect = dropZone.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      dropZone.classList.remove('drag-over');
    }
  },

  /**
   * Handle drop
   * @private
   * @param {DragEvent} e
   */
  async _onDrop(e) {
    const dropZone = e.target.closest('[d-drop-zone]');
    if (!dropZone) return;

    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const url = dropZone.getAttribute('d-drop-url');
    if (!url) return;

    const Pulse = this._Surf?.Pulse;

    // Notify start of network activity
    if (Pulse) Pulse.emit('before:pulse', { url, target: dropZone });

    try {
      const rawData = e.dataTransfer.getData('text/plain');
      if (!rawData) return;

      const data = JSON.parse(rawData);
      const zoneDataRaw = dropZone.getAttribute('d-drop-data');

      if (zoneDataRaw) {
        Object.assign(data, JSON.parse(zoneDataRaw));
      }

      const formData = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        formData.append(key, value);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (response.ok) {
        const patchHtml = await response.text();
        if (this._Surf && this._Surf.applyPatch) {
          this._Surf.applyPatch(patchHtml);
        }

        // Notify success
        if (Pulse) Pulse.emit('after:patch', { url, target: dropZone });
      }
    } catch (err) {
      console.error('[Surf DnD] Drop error', err);
      // Notify error
      if (Pulse) Pulse.emit('error:network', { url, error: err });
    }
  },
};

export default DragAndDrop;
