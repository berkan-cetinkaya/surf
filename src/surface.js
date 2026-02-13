/**
 * Surface Module
 * 
 * Handles DOM region replacement — replace, append, prepend.
 * Used by Pulse to apply server responses to target elements.
 */

/**
 * Get an element by its ID
 * @param {string} id - The element ID (without #)
 * @returns {Element|null}
 */
export function getById(id) {
  const cleanId = id.startsWith('#') ? id.slice(1) : id;
  return document.getElementById(cleanId);
}

/**
 * Get an element by CSS selector
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
export function getBySelector(selector) {
  return document.querySelector(selector);
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
  if (node.tagName === 'SCRIPT' && (node.src || node.hasAttribute('src'))) {
    const src = node.getAttribute('src');
    const async = node.hasAttribute('async') ? ':async' : '';
    const defer = node.hasAttribute('defer') ? ':defer' : '';
    const type = node.getAttribute('type') ? `:${node.getAttribute('type')}` : '';
    return `SCRIPT:${src}${async}${defer}${type}`;
  }
  if (node.tagName === 'STYLE') return `STYLE:${node.textContent.trim()}`; 
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
 * Activate scripts in a container by recreating them
 * @param {Element} container 
 */
function activateScripts(container) {
  const scripts = container.querySelectorAll('script');
  
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    
    Array.from(oldScript.attributes).forEach(attr => {
      newScript.setAttribute(attr.name, attr.value);
    });

    // Force sequential execution unless explicitly async
    if (!newScript.hasAttribute('async')) {
        newScript.async = false;
    }
    
    // Copy content
    newScript.textContent = oldScript.textContent;
    
    // Replace old script with new one
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

/**
 * Replace the entire document content (head and body)
 * @param {string} html 
 * @returns {Element}
 */
export function replaceDocument(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  smartReplaceHead(document.adoptNode(doc.head));
  
  const newBody = document.adoptNode(doc.body);
  activateScripts(newBody);
  document.body.replaceWith(newBody);
  
  return document.documentElement;
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
    surface = document.querySelector(selectorOrElement);
  } else {
    surface = selectorOrElement;
  }
  
  if (!surface) {
    console.warn(`[Surf] Surface not found: ${selectorOrElement}`);
    return null;
  }

  // Full document replacement
  if (surface === document.documentElement) {
    return replaceDocument(html);
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
    surface = document.querySelector(selectorOrElement);
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

export default {
  getById,
  getBySelector,
  replace,
  append,
  prepend,
  activateScripts,
  replaceDocument
};
