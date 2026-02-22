/**
 * Auto Refresh Plugin
 *
 * Adds polling capabilities to elements.
 * Usage: <div id="data" d-auto-refresh="3000" d-auto-refresh-url="/api/data">
 */

const AutoRefresh = {
  name: 'SurfAutoRefresh',

  install(Surf, options = {}) {
    const { Surface, Echo } = Surf._modules;
    const initializedSurfaces = new WeakSet();

    async function refreshSurface(surface, url) {
      if (!surface.isConnected) return;
      try {
        const response = await fetch(url, {
          headers: { Accept: 'text/html', 'X-Surf-Request': 'true' },
        });

        if (!response.ok) return;

        const html = await response.text();

        if (html.includes('<d-patch>')) {
          Surf.applyPatch(html);
        } else {
          Echo.withPreservation(surface, () => {
            Surface.replace(surface, html);
            Surf.emit('pulse:end', { target: surface, body: html });
          });
        }
      } catch (e) {
        console.error('[Surf] Auto-refresh failed:', e);
      }
    }

    function initAutoRefresh(root = document) {
      const surfaces = root.querySelectorAll ? root.querySelectorAll('[d-auto-refresh]') : [];

      surfaces.forEach((surface) => {
        if (initializedSurfaces.has(surface)) return;

        const intervalStr = surface.getAttribute('d-auto-refresh');
        const interval = parseInt(intervalStr) || 3000;
        const url = surface.getAttribute('d-auto-refresh-url') || window.location.href;

        initializedSurfaces.add(surface);

        if (options.skipInitial !== true) {
          refreshSurface(surface, url);
        }

        const intervalId = setInterval(() => {
          if (!surface.isConnected) {
            clearInterval(intervalId);
            return;
          }
          refreshSurface(surface, url);
        }, interval);
      });
    }

    // Initial setup
    initAutoRefresh();

    // Listen to changes for new auto-refresh components
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.hasAttribute('d-auto-refresh')) {
              initAutoRefresh(node.parentElement || document);
            } else {
              initAutoRefresh(node);
            }
          }
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Explicitly re-init after patches just in case
    Surf.on('pulse:end', () => {
      initAutoRefresh();
    });

    console.log('[Surf] Auto-refresh plugin installed');
  },
};

export default AutoRefresh;
