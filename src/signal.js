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
    const module = modules[moduleName];
    
    if (!module || typeof module[methodName] !== 'function') {
      console.warn(`[Surf] Unknown module method: ${moduleName}.${methodName}`);
      return {};
    }

    const args = parseArguments(argsStr, state, event, element);
    const result = module[methodName](...args);
    return typeof result === 'object' ? result : {};
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
    const prop = el.getAttribute(TEXT_ATTR);
    const value = evaluate(prop, state);
    if (value !== undefined) {
      el.textContent = String(value);
    }
  });
  
  // Update d-show bindings
  const showElements = cellElement.querySelectorAll(`[${SHOW_ATTR}]`);
  showElements.forEach(el => {
    const expr = el.getAttribute(SHOW_ATTR);
    const visible = evaluate(expr, state);
    el.style.display = visible ? '' : 'none';
  });
  
  // Update d-attr bindings
  // Format: attr:expression or class.className:expression
  const attrElements = cellElement.querySelectorAll(`[${ATTR_ATTR}]`);
  attrElements.forEach(el => {
    const attrExpr = el.getAttribute(ATTR_ATTR);
    
    // Check for class.className: expression format
    const classMatch = attrExpr.match(/^class\.([\w-]+):\s*(.+)$/);
    if (classMatch) {
      const [, className, expr] = classMatch;
      const shouldAdd = evaluate(expr.trim(), state);
      
      if (shouldAdd) {
        el.classList.add(className);
      } else {
        el.classList.remove(className);
      }
      return;
    }
    
    // Standard attr:expression format
    const match = attrExpr.match(/^(\w+):(.+)$/);
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
}

/**
 * Bind signal event handlers to an element
 * @param {Element} element 
 */
function bindSignalElement(element) {
  const signalExpr = element.getAttribute(SIGNAL_ATTR);
  if (!signalExpr) return;
  
  // Parse: event: expression
  const match = signalExpr.match(/^(\w+):\s*(.+)$/);
  if (!match) {
    console.warn(`[Surf] Invalid signal expression: ${signalExpr}`);
    return;
  }
  
  const [, eventName, actionExpr] = match;
  const cellElement = findParentCell(element);
  
  if (!cellElement) {
    console.warn('[Surf] Signal element has no parent cell:', element);
    return;
  }
  
  // Remove existing listener if any
  const existing = boundListeners.get(element);
  if (existing) {
    element.removeEventListener(existing.event, existing.handler);
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
  boundListeners.set(element, { event: eventName, handler });
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
    const existing = boundListeners.get(el);
    if (existing) {
      el.removeEventListener(existing.event, existing.handler);
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
