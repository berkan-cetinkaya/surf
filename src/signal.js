/**
 * Signal Module
 *
 * Signals define reactive behavior and event handling inside a Cell.
 *
 * Defined with: d-signal, d-text, d-show, d-attr
 */

import * as Cell from './cell.js';
import Events from './events.js';

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
 * Get a nested property from an object using dot notation
 * @param {Object} obj
 * @param {string} path
 * @returns {any}
 */
function getPath(obj, path) {
  if (!path || !obj) return undefined;
  if (path in obj) return obj[path];
  return path.split('.').reduce((prev, curr) => prev && prev[curr], obj);
}

/**
 * Set a nested property on an object using dot notation, preserving sibling keys
 * @param {Object} obj - The changes object to populate
 * @param {string} path
 * @param {any} value
 * @param {Object} state - The current state for sibling preservation
 */
function setPath(obj, path, value, state) {
  const keys = path.split('.');
  let current = obj;
  let currentState = state;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      // Initialize with existing state if available to preserve sibling properties
      current[key] =
        currentState && currentState[key] && typeof currentState[key] === 'object'
          ? { ...currentState[key] }
          : {};
    }
    current = current[key];
    currentState = currentState ? currentState[key] : undefined;
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Evaluate a simple expression against cell state
 * Supports: property access (including nested), boolean operators, simple arithmetic, literals
 * @param {string} expr
 * @param {Object} state
 * @returns {any}
 */
export function evaluate(expr, state) {
  if (!expr || !state) return undefined;

  const trimmed = expr.trim();

  // Literals
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  // Direct or nested property access
  const val = getPath(state, trimmed);
  if (val !== undefined) return val;

  // Boolean negation
  if (trimmed.startsWith('!')) {
    const prop = trimmed.slice(1).trim();
    const target = evaluate(prop, state);
    return !target;
  }

  // Simple comparison: prop == value or prop === value
  const eqMatch = trimmed.match(/^([\w.]+)\s*(==|===)\s*(.+)$/);
  if (eqMatch) {
    const [, prop, , value] = eqMatch;
    return evaluate(prop, state) === evaluate(value, state);
  }

  // Simple inequality: prop != value
  const neqMatch = trimmed.match(/^([\w.]+)\s*(!=|!==)\s*(.+)$/);
  if (neqMatch) {
    const [, prop, , value] = neqMatch;
    return evaluate(prop, state) !== evaluate(value, state);
  }

  // Greater/less than
  const gtMatch = trimmed.match(/^([\w.]+)\s*>\s*(.+)$/);
  if (gtMatch) {
    return (evaluate(gtMatch[1], state) || 0) > (evaluate(gtMatch[2], state) || 0);
  }

  const ltMatch = trimmed.match(/^([\w.]+)\s*<\s*(.+)$/);
  if (ltMatch) {
    return (evaluate(ltMatch[1], state) || 0) < (evaluate(ltMatch[2], state) || 0);
  }

  // Module method calls: MyMod.doSomething()
  const callMatch = trimmed.match(/^([\w]+)\.([\w]+)\((.*)\)$/);
  if (callMatch) {
    const [, modName, method, argsExpr] = callMatch;
    if (modules[modName] && typeof modules[modName][method] === 'function') {
      const args = argsExpr ? argsExpr.split(',').map((a) => evaluate(a.trim(), state)) : [];
      return modules[modName][method](...args);
    }
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
  const methodMatch = trimmed.match(/^([$\w]+)\.(\w+)\((.*)\)$/);
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

    // Special handling for 'event' or '$event'
    if (moduleName === 'event' || moduleName === '$event') {
      if (event && typeof event[methodName] === 'function') {
        const args = parseArguments(argsStr, state, event, element);
        event[methodName](...args);
        return {};
      } else {
        console.warn(`[Surf] Event does not have method: ${methodName}`, event);
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
  const match = trimmed.match(/^([\w.]+)\s*=\s*(.+)$/);
  if (!match) return {};

  const [, prop, valueExpr] = match;
  const valueExprTrimmed = valueExpr.trim();

  // Boolean toggle: prop = !prop
  if (valueExprTrimmed === `!${prop}`) {
    const currentVal = getPath(state, prop);
    const changes = {};
    setPath(changes, prop, !currentVal, state);
    return changes;
  }

  // Boolean literal
  if (valueExprTrimmed === 'true') {
    const changes = {};
    setPath(changes, prop, true, state);
    return changes;
  }
  if (valueExprTrimmed === 'false') {
    const changes = {};
    setPath(changes, prop, false, state);
    return changes;
  }

  // Arithmetic: prop = prop + N or prop = prop - N
  const addMatch = valueExprTrimmed.match(/^([\w.]+)\s*\+\s*(\d+)$/);
  if (addMatch) {
    const [, srcProp, num] = addMatch;
    const changes = {};
    setPath(changes, prop, (getPath(state, srcProp) || 0) + Number(num), state);
    return changes;
  }

  const subMatch = valueExprTrimmed.match(/^([\w.]+)\s*-\s*(\d+)$/);
  if (subMatch) {
    const [, srcProp, num] = subMatch;
    const changes = {};
    setPath(changes, prop, (getPath(state, srcProp) || 0) - Number(num), state);
    return changes;
  }

  // Math.max(prop, N) - clamp to minimum
  const maxMatch = valueExprTrimmed.match(/^Math\.max\(([\w.]+)\s*-\s*(\d+),\s*(\d+)\)$/);
  if (maxMatch) {
    const [, srcProp, delta, min] = maxMatch;
    const newVal = (getPath(state, srcProp) || 0) - Number(delta);
    const changes = {};
    setPath(changes, prop, Math.max(newVal, Number(min)), state);
    return changes;
  }

  // Math.min(prop, N) - clamp to maximum
  const minMatch = valueExprTrimmed.match(/^Math\.min\(([\w.]+)\s*\+\s*(\d+),\s*(\d+)\)$/);
  if (minMatch) {
    const [, srcProp, delta, max] = minMatch;
    const newVal = (getPath(state, srcProp) || 0) + Number(delta);
    const changes = {};
    setPath(changes, prop, Math.min(newVal, Number(max)), state);
    return changes;
  }

  // String literal
  if (valueExprTrimmed.startsWith('"') || valueExprTrimmed.startsWith("'")) {
    const changes = {};
    setPath(changes, prop, valueExprTrimmed.slice(1, -1), state);
    return changes;
  }

  // Number literal
  if (/^\d+$/.test(valueExprTrimmed)) {
    const changes = {};
    setPath(changes, prop, Number(valueExprTrimmed), state);
    return changes;
  }

  // Handle object literals (simple JSON)
  if (valueExprTrimmed.startsWith('{') && valueExprTrimmed.endsWith('}')) {
    try {
      // Very basic parser for object literals since we don't have full JS eval
      // Replace single quotes with double quotes for JSON.parse if it looks like a simple object
      const jsonStr = valueExprTrimmed.replace(/'/g, '"').replace(/([\w]+):/g, '"$1":');
      const val = JSON.parse(jsonStr);
      const changes = {};
      setPath(changes, prop, val, state);
      return changes;
    } catch {
      console.warn('[Surf] Failed to parse object literal:', valueExprTrimmed);
    }
  }

  // Generic expression - try to evaluate
  const result = evaluate(valueExprTrimmed, state, event, element);
  if (result !== undefined) {
    const changes = {};
    setPath(changes, prop, result, state);
    return changes;
  }

  // Property copy: prop = otherProp
  if (valueExprTrimmed in state) {
    const changes = {};
    setPath(changes, prop, state[valueExprTrimmed], state);
    return changes;
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

  return argsStr
    .split(',')
    .map((arg) => {
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
    })
    .filter((a) => a !== undefined && a !== '');
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

export function updateBindings(cellElement, { silent = false } = {}) {
  const state = Cell.getState(cellElement);

  // Update d-text bindings
  const textElements = cellElement.querySelectorAll(`[${TEXT_ATTR}]`);
  textElements.forEach((el) => {
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
  showElements.forEach((el) => {
    // Only update if this element belongs to the current cell
    if (findParentCell(el) !== cellElement) return;

    const expr = el.getAttribute(SHOW_ATTR);
    const visible = evaluate(expr, state);
    el.style.display = visible ? '' : 'none';
  });

  // Update d-attr bindings
  // Format: attr:expression or class.className:expression
  const attrElements = cellElement.querySelectorAll(`[${ATTR_ATTR}]`);
  attrElements.forEach((el) => {
    // Only update if this element belongs to the current cell
    if (findParentCell(el) !== cellElement) return;

    const attrExpr = el.getAttribute(ATTR_ATTR);
    if (!attrExpr) return;

    // Support multiple bindings separated by ;
    const bindings = splitSignals(attrExpr);

    bindings.forEach((binding) => {
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
      const match = binding.match(/^([\w-]+):(.+)$/);
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

  if (!silent) Events.emit('signal:update', { cellElement });
}

/**
 * Split signal expression string into individual signals,
 * respecting code blocks { ... } where semicolons might appear.
 * @param {string} expr
 * @returns {string[]}
 */
const splitSignals = (expr) => {
  const signals = [];
  let current = '';
  let depth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];

    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    else if (char === '[') bracketDepth++;
    else if (char === ']') bracketDepth--;

    if (char === ';' && depth === 0 && parenDepth === 0 && bracketDepth === 0) {
      if (current.trim()) signals.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) signals.push(current.trim());
  return signals;
};

/**
 * Bind signal to an element
 * @param {Element} element
 */
function bindSignalElement(element) {
  const signalExpr = element.getAttribute(SIGNAL_ATTR);
  if (!signalExpr) return;

  // Cleanup old listeners if they exist (to avoid duplicates)
  const existing = boundListeners.get(element);
  if (existing) {
    if (Array.isArray(existing)) {
      existing.forEach((l) => element.removeEventListener(l.event, l.handler));
    } else {
      // Handle legacy single listener
      element.removeEventListener(existing.event, existing.handler);
    }
  }

  const newListeners = [];
  const signals = splitSignals(signalExpr);
  const cellElement = findParentCell(element);

  // Check if any signal on this element requires a cell (state-dependent)
  const needsCell = signals.some((sig) => {
    const actionMatch = sig.match(/^[\w:-]+:\s*(.+)$/s);
    if (!actionMatch) return false;
    const action = actionMatch[1].trim();
    return action !== 'submit' && action !== 'reset';
  });

  if (needsCell && !cellElement) {
    console.warn(`[Surf] d-signal found on element with no parent cell:`, element);
  }

  signals.forEach((sig) => {
    // We need to split by the FIRST colon only
    const match = sig.match(/^([\w:-]+):\s*(.+)$/s);
    if (!match) {
      console.warn(`[Surf] Invalid signal expression: ${sig}`);
      return;
    }

    const [, eventName, actionExpr] = match;

    // Create and store new listener
    const handler = (e) => {
      const state = cellElement ? Cell.getState(cellElement) : {};
      const changes = executeAssignment(actionExpr, state, e, element);

      if (cellElement && Object.keys(changes).length > 0) {
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
  const signalElements = Array.from(container.querySelectorAll(`[${SIGNAL_ATTR}]`));
  if (container !== document && container.hasAttribute(SIGNAL_ATTR)) {
    signalElements.unshift(container);
  }
  signalElements.forEach((el) => bindSignalElement(el));

  // Initialize bindings for all cells
  const cells = Cell.findAll(container);
  cells.forEach((cell) => updateBindings(cell, { silent: true }));
}

/**
 * Cleanup signal bindings in a container (before replacing content)
 * @param {Element} container
 */
export function cleanup(container) {
  const signalElements = Array.from(container.querySelectorAll(`[${SIGNAL_ATTR}]`));
  if (container !== document && container.hasAttribute(SIGNAL_ATTR)) {
    signalElements.unshift(container);
  }
  signalElements.forEach((el) => {
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
  register,
  __test_parseArguments: parseArguments,
  __test_boundListeners: boundListeners,
};
