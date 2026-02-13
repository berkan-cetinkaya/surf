/**
 * Patch Module
 *
 * A Patch is an HTML response from the server that updates one or more Surfaces.
 *
 * Patch format:
 * <d-patch>
 *   <surface target="#main">...new HTML...</surface>
 *   <surface target="#toast">...notification...</surface>
 * </d-patch>
 */

/**
 * Parse a d-patch response
 * @param {string} html - The HTML string containing <d-patch>
 * @returns {Array<{target: string, content: string}>}
 */
export function parse(html) {
  const patches = [];

  // Create a parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Find the d-patch element
  const patchElement = doc.querySelector('d-patch');

  if (!patchElement) {
    // If no d-patch wrapper, treat the entire response as content for a single surface
    // This allows simpler responses when only updating one surface
    console.warn('[Surf] No <d-patch> element found in response');
    return patches;
  }

  // Find all surface elements within the patch
  const surfaceElements = patchElement.querySelectorAll('surface');

  surfaceElements.forEach((surface) => {
    const target = surface.getAttribute('target');
    if (!target) {
      console.warn('[Surf] Surface element missing target attribute');
      return;
    }

    const template = surface.querySelector('template');
    patches.push({
      target,
      content: template ? template.innerHTML : surface.innerHTML,
    });
  });

  return patches;
}

/**
 * Check if a response is a valid patch response
 * @param {string} html
 * @returns {boolean}
 */
export function isPatch(html) {
  return html.includes('<d-patch>') || html.includes('<d-patch ');
}

/**
 * Create a patch response string (utility for testing/server-side)
 * @param {Array<{target: string, content: string}>} surfaces
 * @returns {string}
 */
export function create(surfaces) {
  const surfaceHtml = surfaces
    .map((s) => `  <surface target="${s.target}">${s.content}</surface>`)
    .join('\n');

  return `<d-patch>\n${surfaceHtml}\n</d-patch>`;
}

export default {
  parse,
  isPatch,
  create,
};
