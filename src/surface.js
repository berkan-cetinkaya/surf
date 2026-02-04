/**
 * Surface Module
 * 
 * A Surface is a DOM region that can be replaced by server responses.
 * Defined with: d-surface
 */

const SURFACE_ATTR = 'd-surface';

/**
 * Find all surface elements in the document
 * @returns {NodeListOf<Element>}
 */
export function findAll() {
  return document.querySelectorAll(`[${SURFACE_ATTR}]`);
}

/**
 * Get a surface element by its ID
 * @param {string} id - The surface ID (without #)
 * @returns {Element|null}
 */
export function getById(id) {
  const cleanId = id.startsWith('#') ? id.slice(1) : id;
  const element = document.getElementById(cleanId);
  
  if (element && element.hasAttribute(SURFACE_ATTR)) {
    return element;
  }
  
  return null;
}

/**
 * Get a surface element by selector
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
export function getBySelector(selector) {
  const element = document.querySelector(selector);
  
  if (element && element.hasAttribute(SURFACE_ATTR)) {
    return element;
  }
  
  return null;
}

/**
 * Replace surface content with new HTML
 * @param {string|Element} selectorOrElement - Target surface selector or element
 * @param {string} html - New HTML content
 * @returns {Element|null} - The updated surface element
 */
export function replace(selectorOrElement, html) {
  // Handle both selector strings and element references
  let surface;
  if (typeof selectorOrElement === 'string') {
    surface = getBySelector(selectorOrElement) || document.querySelector(selectorOrElement);
  } else {
    surface = selectorOrElement;
  }
  
  if (!surface) {
    console.warn(`[Surf] Surface not found: ${selectorOrElement}`);
    return null;
  }
  
  // Create a template to parse the HTML
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  
  // Replace inner content, preserving the surface element itself
  surface.innerHTML = '';
  
  // Append all children from the template
  while (template.content.firstChild) {
    surface.appendChild(template.content.firstChild);
  }
  
  return surface;
}

/**
 * Append content to surface
 * @param {string|Element} selectorOrElement 
 * @param {string} html 
 * @returns {Element|null}
 */
export function append(selectorOrElement, html) {
  return inject(selectorOrElement, html, 'beforeend');
}

/**
 * Prepend content to surface
 * @param {string|Element} selectorOrElement 
 * @param {string} html 
 * @returns {Element|null}
 */
export function prepend(selectorOrElement, html) {
  return inject(selectorOrElement, html, 'afterbegin');
}

/**
 * Inject content into surface at position
 * @param {string|Element} selectorOrElement 
 * @param {string} html 
 * @param {string} position - 'beforeend' or 'afterbegin'
 * @returns {Element|null}
 */
function inject(selectorOrElement, html, position) {
  let surface;
  if (typeof selectorOrElement === 'string') {
    surface = getBySelector(selectorOrElement) || document.querySelector(selectorOrElement);
  } else {
    surface = selectorOrElement;
  }
  
  if (!surface) {
    console.warn(`[Surf] Surface not found: ${selectorOrElement}`);
    return null;
  }
  
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  
  // Use DocumentFragment for efficient insertion
  const fragment = document.createDocumentFragment();
  while (template.content.firstChild) {
    fragment.appendChild(template.content.firstChild);
  }
  
  if (position === 'beforeend') {
    surface.appendChild(fragment);
  } else {
    surface.insertBefore(fragment, surface.firstChild);
  }
  
  return surface;
}

/**
 * Initialize surfaces - mark them as ready
 */
export function init() {
  const surfaces = findAll();
  surfaces.forEach(surface => {
    surface.setAttribute('data-surf-ready', 'true');
  });
}

export default {
  findAll,
  getById,
  getBySelector,
  replace,
  append,
  prepend,
  init
};
