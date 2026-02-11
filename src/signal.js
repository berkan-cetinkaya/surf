/**
 * Signal Module
 * 
 * Signals define reactive behavior and event handling inside a Cell.
 * 
 * Defined with: d-signal, d-text, d-show, d-attr
 */

import * as Cell from './cell.js';

const SIGNAL_ATTR = 'd-signal';
const TEXT_ATTR = 'd-text';
const SHOW_ATTR = 'd-show';
const ATTR_ATTR = 'd-attr';

// Registry for extension modules
const modules = {};

/**
 * Register a module for use in signals
 * @param {string} name 
 * @param {Object} module 
 */
export function register(name, module) {
  modules[name] = module;
}

// Store bound event listeners for cleanup
const boundListeners = new WeakMap();

/**
 * Find the parent cell of an element
 * @param {Element} element 
 * @returns {Element|null}
 */
function findParentCell(element) {
  return element.closest('[d-cell]');
}

/**
 * Evaluate a simple expression against cell state
 * Supports: property access, boolean operators, simple arithmetic
 * @param {string} expr 
 * @param {Object} state 
 * @returns {any}
 */
function evaluate(expr, state) {
  if (!expr || !state) return undefined;
  
  const trimmed = expr.trim();
  
  // Direct property access
  if (trimmed in state) {
    return state[trimmed];
  }
  
  // Boolean negation
  if (trimmed.startsWith('!')) {
    const prop = trimmed.slice(1).trim();
    return !state[prop];
  }
  
  // Simple comparison: prop == value or prop === value
  const eqMatch = trimmed.match(/^(\w+)\s*={2,3}\s*(.+)$/);
  if (eqMatch) {
    const [, prop, value] = eqMatch;
    const propVal = state[prop];
    const compareVal = value === 'true' ? true : 
                       value === 'false' ? false : 
                       value.startsWith('"') || value.startsWith("'") ? value.slice(1, -1) :
                       Number(value);
    return propVal === compareVal;
  }
  
  // Simple inequality: prop != value
  const neqMatch = trimmed.match(/^(\w+)\s*!=\s*(.+)$/);
  if (neqMatch) {
    const [, prop, value] = neqMatch;
    const propVal = state[prop];
    const compareVal = value === 'true' ? true : 
                       value === 'false' ? false : 
                       value.startsWith('"') || value.startsWith("'") ? value.slice(1, -1) :
                       Number(value);
    return propVal !== compareVal;
  }
  
  // Greater/less than
  const gtMatch = trimmed.match(/^(\w+)\s*>\s*(\d+)$/);
  if (gtMatch) {
    return state[gtMatch[1]] > Number(gtMatch[2]);
  }
  
  const ltMatch = trimmed.match(/^(\w+)\s*<\s*(\d+)$/);
  if (ltMatch) {
    return state[ltMatch[1]] < Number(ltMatch[2]);
  }
  
  return undefined;
}

/**
 * Execute an assignment expression
 * @param {string} expr - e.g., "count = count + 1" or "open = !open"
 * @param {Object} state 
 * @returns {Object} - The changes to apply
 */
/**
 * Execute an assignment expression
 * Supports: prop = val, prop = !prop, prop = prop + N, module.method()
 * @param {string} expr 
 * @param {Object} state 
 * @param {Event} [event] 
 * @param {Element} [element]
 * @returns {Object} State changes
 */
function executeAssignment(expr, state, event, element) {
  const trimmed = expr.trim();
  
  // Check for module method call: module.method() or module.method(args)
  const methodMatch = trimmed.match(/^(\w+)\.(\w+)\((.*)\)$/);
  if (methodMatch) {
    const [, moduleName, methodName, argsStr] = methodMatch;
    
    // Special handling for 'this'
    if (moduleName === 'this') {
      if (typeof element[methodName] === 'function') {
        const args = parseArguments(argsStr, state, event, element);
        
        // Defer 'reset' if it's the reset method to avoid race condition with Pulse
        if (methodName === 'reset') {
            setTimeout(() => element[methodName](...args), 0);
        } else {
            element[methodName](...args);
        }
        return {};
      } else {
         console.warn(`[Surf] Element does not have method: ${methodName}`, element);
         return {};
      }
    }

    const module = modules[moduleName];
    
    if (!module || typeof module[methodName] !== 'function') {
      console.warn(`[Surf] Unknown module method: ${moduleName}.${methodName}`);
      return {};
    }

    const args = parseArguments(argsStr, state, event, element);
    const result = module[methodName](...args);
    return typeof result === 'object' ? result : {};
  }
  
  // Command: submit
  // Triggers form submission on the closest form
  if (trimmed === 'submit') {
    const form = element.tagName === 'FORM' ? element : element.closest('form');
    if (form) {
      if (form.requestSubmit) {
        form.requestSubmit();
      } else {
        form.submit();
      }
    } else {
      console.warn('[Surf] No form found to submit for element:', element);
    }
    return {};
  }

  // Command: reset
  // Resets the closest form
  if (trimmed === 'reset') {
    const form = element.tagName === 'FORM' ? element : element.closest('form');
    if (form) {
      // Defer reset to next tick to allow form submission to complete (Pulse reads data first)
      setTimeout(() => form.reset(), 0);
    } else {
      console.warn('[Surf] No form found to reset for element:', element);
    }
    return {};
  }
  
  // Match: property = expression
  const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
  if (!match) return {};
  
  const [, prop, valueExpr] = match;
  const valueExprTrimmed = valueExpr.trim();
  
  // Boolean toggle: prop = !prop
  if (valueExprTrimmed === `!${prop}`) {
    return { [prop]: !state[prop] };
  }
  
  // Boolean literal
  if (valueExprTrimmed === 'true') {
    return { [prop]: true };
  }
  if (valueExprTrimmed === 'false') {
    return { [prop]: false };
  }
  
  // Arithmetic: prop = prop + N or prop = prop - N
  const addMatch = valueExprTrimmed.match(/^(\w+)\s*\+\s*(\d+)$/);
  if (addMatch) {
    const [, srcProp, num] = addMatch;
    return { [prop]: (state[srcProp] || 0) + Number(num) };
  }
  
  const subMatch = valueExprTrimmed.match(/^(\w+)\s*-\s*(\d+)$/);
  if (subMatch) {
    const [, srcProp, num] = subMatch;
    return { [prop]: (state[srcProp] || 0) - Number(num) };
  }
  
  // Math.max(prop, N) - clamp to minimum
  const maxMatch = valueExprTrimmed.match(/^Math\.max\((\w+)\s*-\s*(\d+),\s*(\d+)\)$/);
  if (maxMatch) {
    const [, srcProp, delta, min] = maxMatch;
    const newVal = (state[srcProp] || 0) - Number(delta);
    return { [prop]: Math.max(newVal, Number(min)) };
  }
  
  // Math.min(prop, N) - clamp to maximum
  const minMatch = valueExprTrimmed.match(/^Math\.min\((\w+)\s*\+\s*(\d+),\s*(\d+)\)$/);
  if (minMatch) {
    const [, srcProp, delta, max] = minMatch;
    const newVal = (state[srcProp] || 0) + Number(delta);
    return { [prop]: Math.min(newVal, Number(max)) };
  }
  
  // String literal
  if (valueExprTrimmed.startsWith('"') || valueExprTrimmed.startsWith("'")) {
    return { [prop]: valueExprTrimmed.slice(1, -1) };
  }
  
  // Number literal
  if (/^\d+$/.test(valueExprTrimmed)) {
    return { [prop]: Number(valueExprTrimmed) };
  }
  
  // Property copy: prop = otherProp
  if (valueExprTrimmed in state) {
    return { [prop]: state[valueExprTrimmed] };
  }
  
  return {};
}

/**
 * Parse function arguments string
 * @param {string} argsStr 
 * @param {Object} state 
 * @param {Event} event 
 * @param {Element} element 
 * @returns {Array}
 */
function parseArguments(argsStr, state, event, element) {
  if (argsStr.trim() === '') return [];

  return argsStr.split(',').map(arg => {
    const a = arg.trim();
    if (a === '') return undefined;
    
    if (a === 'true') return true;
    if (a === 'false') return false;
    if (a === 'event') return event;
    if (a === 'this') return element;
    
    // Handle strings
    if (a.startsWith("'") || a.startsWith('"')) return a.slice(1, -1);
    
    // Handle numbers
    if (!isNaN(a) && a !== '') return Number(a);
    
    // Handle this.property
    if (a.startsWith('this.')) {
      return resolvePath(element, a.slice(5));
    }

    // Handle state property
    return resolvePath(state, a);
  }).filter(a => a !== undefined && a !== '');
}

/**
 * Resolve dot notation path safely
 * @param {Object} obj 
 * @param {string} path 
 * @returns {any}
 */
function resolvePath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Update all reactive bindings in a cell
 * @param {Element} cellElement 
 */

export function updateBindings(cellElement) {
  const state = Cell.getState(cellElement);
  
  // Update d-text bindings
  const textElements = cellElement.querySelectorAll(`[${TEXT_ATTR}]`);
  textElements.forEach(el => {
    // Only update if this element belongs to the current cell (not a nested cell)
    if (findParentCell(el) !== cellElement) return;

    const prop = el.getAttribute(TEXT_ATTR);
    const value = evaluate(prop, state);
    if (value !== undefined) {
      el.textContent = String(value);
    }
  });
  
  // Update d-show bindings
  const showElements = cellElement.querySelectorAll(`[${SHOW_ATTR}]`);
  showElements.forEach(el => {
    // Only update if this element belongs to the current cell
    if (findParentCell(el) !== cellElement) return;

    const expr = el.getAttribute(SHOW_ATTR);
    const visible = evaluate(expr, state);
    el.style.display = visible ? '' : 'none';
  });
  
  // Update d-attr bindings
  // Format: attr:expression or class.className:expression
  const attrElements = cellElement.querySelectorAll(`[${ATTR_ATTR}]`);
  attrElements.forEach(el => {
    // Only update if this element belongs to the current cell
    if (findParentCell(el) !== cellElement) return;

    const attrExpr = el.getAttribute(ATTR_ATTR);
    if (!attrExpr) return;

    // Support multiple bindings separated by ;
    const bindings = splitSignals(attrExpr);
    
    bindings.forEach(binding => {
      // Check for class.className: expression format
      const classMatch = binding.match(/^class\.([\w-]+):\s*(.+)$/);
      if (classMatch) {
        const [, className, expr] = classMatch; // fixed destructuring
        const shouldAdd = evaluate(expr.trim(), state);
        
        if (shouldAdd) {
          el.classList.add(className);
        } else {
          el.classList.remove(className);
        }
        return;
      }
      
      // Standard attr:expression format
      const match = binding.match(/^(\w+):(.+)$/);
      if (!match) return;

      const [, attrName, expr] = match;
      const value = evaluate(expr.trim(), state);

      if (value === undefined) return;

      if (typeof value !== 'boolean') {
        el.setAttribute(attrName, String(value));
        return;
      }

      if (value) {
        el.setAttribute(attrName, '');
      } else {
        el.removeAttribute(attrName);
      }
    });
  });
}


/**
 * Split signal expression string into individual signals,
 * respecting code blocks { ... } where semicolons might appear.
 * @param {string} expr 
 * @returns {string[]}
 */
function splitSignals(expr) {
  const signals = [];
  let current = '';
  let depth = 0;
  
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    
    if (char === '{') depth++;
    else if (char === '}') depth--;
    
    if (char === ';' && depth === 0) {
      if (current.trim()) signals.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) signals.push(current.trim());
  return signals;
}

/**
 * Bind signal event handlers to an element
 * @param {Element} element 
 */
function bindSignalElement(element) {
  const signalExpr = element.getAttribute(SIGNAL_ATTR);
  if (!signalExpr) return;
  
  // Split into multiple signal definitions (separated by ;), respecting blocks
  const signals = splitSignals(signalExpr);
  
  // Remove existing listeners if any
  const existingListeners = boundListeners.get(element);
  if (existingListeners) {
    if (Array.isArray(existingListeners)) {
      existingListeners.forEach(({ event, handler }) => {
        element.removeEventListener(event, handler);
      });
    } else {
      element.removeEventListener(existingListeners.event, existingListeners.handler);
    }
  }
  
  const newListeners = [];
  
  signals.forEach(sig => {
    // Parse: event: expression
    // We need to match the first colon that isn't inside a block? 
    // Usually event names are simple strings like "click", "keydown", "custom:event"
    // So /^([\w:-]+):\s*(.+)$/ should work safely.
    // However, if the expression itself has colons (e.g. object literal), we must be careful.
    // But regex is greedy by default, so (.+) will eat everything. 
    // So we need non-greedy for the event part? No, event part is at start.
    const match = sig.match(/^([\w:-]+):\s*(.+)$/s); // Added 's' flag for dotAll just in case of newlines
    if (!match) {
      console.warn(`[Surf] Invalid signal expression: ${sig}`);
      return;
    }
    
    const [, eventName, actionExpr] = match;
    const cellElement = findParentCell(element);
    
    if (!cellElement) {
      console.warn('[Surf] Signal element has no parent cell:', element);
      return;
    }
    
    // Create and store new listener
    const handler = (e) => {
      const state = Cell.getState(cellElement);
      const changes = executeAssignment(actionExpr, state, e, element);
      
      if (Object.keys(changes).length > 0) {
        Cell.setState(cellElement, changes);
        updateBindings(cellElement);
      }
    };
    
    element.addEventListener(eventName, handler);
    newListeners.push({ event: eventName, handler });
  });

  boundListeners.set(element, newListeners);
}

/**
 * Initialize all signals in a container
 * @param {Element} container 
 */
export function initAll(container = document) {
  // Find all signal elements and bind them
  const signalElements = container.querySelectorAll(`[${SIGNAL_ATTR}]`);
  signalElements.forEach(el => bindSignalElement(el));
  
  // Initialize bindings for all cells
  const cells = Cell.findAll(container);
  cells.forEach(cell => updateBindings(cell));
}

/**
 * Cleanup signal bindings in a container (before replacing content)
 * @param {Element} container 
 */
export function cleanup(container) {
  const signalElements = container.querySelectorAll(`[${SIGNAL_ATTR}]`);
  signalElements.forEach(el => {
    const existingListeners = boundListeners.get(el);
    if (existingListeners) {
      // Handle array of listeners
      if (Array.isArray(existingListeners)) {
        existingListeners.forEach(({ event, handler }) => {
          el.removeEventListener(event, handler);
        });
      } else {
        // Handle legacy single listener object (checking for backwards compatibility)
        el.removeEventListener(existingListeners.event, existingListeners.handler);
      }
      boundListeners.delete(el);
    }
  });
}

export default {
  updateBindings,
  initAll,
  cleanup,
  evaluate,
  executeAssignment,
  register
};
