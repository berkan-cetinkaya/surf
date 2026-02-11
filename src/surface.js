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
/**
 * Helper to generate signature for diffing
 * @param {Element} node 
 * @returns {string} 
 */
export function getSignature(node) {
  if (node.tagName === 'TITLE') return 'TITLE';
  if (node.tagName === 'LINK' && node.href) return `LINK:${node.getAttribute('href')}`;
  if (node.tagName === 'META' && node.getAttribute('name')) return `META:${node.getAttribute('name')}`;
  if (node.tagName === 'SCRIPT' && node.src) return `SCRIPT:${node.getAttribute('src')}`;
  if (node.tagName === 'STYLE') return `STYLE:${node.textContent.trim().substring(0, 50)}`; 
  return node.outerHTML; 
}

/**
 * Handle smart head replacement to prevent CSS flicker
 * @param {Element} newHead 
 */
export function smartReplaceHead(newHead) {
    const currentHead = document.head;
    
    // Update title
    const newTitle = newHead.querySelector('title');
    if (newTitle) {
      document.title = newTitle.textContent;
    }

    const currentNodes = Array.from(currentHead.children);
    const currentMap = new Map();
    
    // Map signature to ARRAY of nodes to handle duplicates
    currentNodes.forEach(node => {
      const sig = getSignature(node);
      if (sig === 'TITLE') return;
      
      if (!currentMap.has(sig)) {
        currentMap.set(sig, []);
      }
      currentMap.get(sig).push(node);
    });

    const newNodes = Array.from(newHead.children);
    newNodes.forEach(newNode => {
      const sig = getSignature(newNode);
      if (sig === 'TITLE') return;

      if (currentMap.has(sig) && currentMap.get(sig).length > 0) {
        // Keep one existing instance (remove from deletion list)
        currentMap.get(sig).shift();
      } else {
        // New node, append it
        currentHead.appendChild(newNode);
      }
    });

    // Remove remaining nodes (not in new head)
    currentMap.forEach(list => {
      list.forEach(node => {
        if (node.parentNode) {
          node.remove();
        }
      });
    });
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

  // Special handling for full document replacement
  if (surface === document.documentElement) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Replace head and body content
    const newHead = document.adoptNode(doc.head);
    const newBody = document.adoptNode(doc.body);
    
    smartReplaceHead(newHead);
    
    document.body.replaceWith(newBody);
    
    return surface;
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
