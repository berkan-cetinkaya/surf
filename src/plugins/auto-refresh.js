/**
 * Auto Refresh Plugin
 * 
 * Adds polling capabilities to Surfaces.
 * Usage: <div d-surface d-auto-refresh="3000" d-auto-refresh-url="/api/data">
 */

import * as Surface from '../surface.js';
import * as Patch from '../patch.js';
import * as Echo from '../echo.js';

/**
 * Refresh a specific surface from URL
 */
async function refreshSurface(surface, url) {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html',
        'X-Surf-Request': 'true'
      }
    });
    
    if (!response.ok) return;
    
    const html = await response.text();
    
    // Check if response is a patch
    if (Patch.isPatch(html)) {
      const patches = Patch.parse(html);
      patches.forEach(({ target, content }) => {
        const el = document.querySelector(target);
        if (el) {
          Echo.withPreservation(el, content, () => {
            Surface.replace(el, content);
          });
        }
      });
    } else {
      // Apply directly to this surface
      Echo.withPreservation(surface, html, () => {
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
function init() {
  const surfaces = document.querySelectorAll('[d-auto-refresh]');
  
  surfaces.forEach(surface => {
    const interval = parseInt(surface.getAttribute('d-auto-refresh')) || 3000;
    const url = surface.getAttribute('d-auto-refresh-url') || window.location.href;
    
    // Initial fetch
    refreshSurface(surface, url);
    
    // Set up interval
    setInterval(() => refreshSurface(surface, url), interval);
  });
}

export default {
  init
};
