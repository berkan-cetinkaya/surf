/**
 * Auto Refresh Plugin
 *
 * Adds polling capabilities to elements.
 * Usage: <div id="data" d-auto-refresh="3000" d-auto-refresh-url="/api/data">
 */

const AutoRefresh = {
  name: 'SurfAutoRefresh',

  install(Surf, options = {}) {
    // Access internal modules provided by Surf
    const { Surface, Patch, Echo } = Surf._modules;

    /**
     * Refresh a specific surface from URL
     */
    async function refreshSurface(surface, url) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: 'text/html',
            'X-Surf-Request': 'true',
          },
        });

        if (!response.ok) return;

        const html = await response.text();

        // Check if response is a patch
        if (Patch.isPatch(html)) {
          const patches = Patch.parse(html);
          patches.forEach(({ target, content }) => {
            const el = document.querySelector(target);
            if (el) {
              Echo.withPreservation(el, () => {
                Surface.replace(el, content);
              });
            }
          });
        } else {
          // Apply directly to this surface
          Echo.withPreservation(surface, () => {
            Surface.replace(surface, html);
          });
        }
      } catch (e) {
        console.error('[Surf] Auto-refresh failed:', e);
      }
    }

    /**
     * Initialize auto-refresh for surfaces
     */
    const surfaces = document.querySelectorAll('[d-auto-refresh]');

    surfaces.forEach((surface) => {
      const intervalStr = surface.getAttribute('d-auto-refresh');
      const interval = parseInt(intervalStr) || 3000;
      const url = surface.getAttribute('d-auto-refresh-url') || window.location.href;

      // Option to skip initial fetch
      if (options.skipInitial !== true) {
        refreshSurface(surface, url);
      }

      // Set up interval
      setInterval(() => refreshSurface(surface, url), interval);
    });

    console.log('[Surf] Auto-refresh plugin installed');
  },
};

export default AutoRefresh;
