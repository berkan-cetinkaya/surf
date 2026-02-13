/**
 * SURF Patch Helper for Node.js
 *
 * Generates d-patch responses for server-side applications.
 */

/**
 * Patch class for building patch responses
 */
export class Patch {
  constructor() {
    this.surfaces = [];
  }

  /**
   * Add a surface update to the patch
   * @param {string} target - CSS selector for the target surface
   * @param {string} content - HTML content to insert
   * @returns {Patch} - Returns this for chaining
   */
  addSurface(target, content) {
    this.surfaces.push({ target, content });
    return this;
  }

  /**
   * Render the patch as HTML
   * @returns {string}
   */
  render() {
    if (this.surfaces.length === 0) {
      return '<d-patch></d-patch>';
    }

    const surfaceHtml = this.surfaces
      .map(
        (s) =>
          `  <surface target="${escapeHtml(s.target)}"><template>${s.content}</template></surface>`
      )
      .join('\n');

    return `<d-patch>\n${surfaceHtml}\n</d-patch>`;
  }

  /**
   * Convert to string (alias for render)
   * @returns {string}
   */
  toString() {
    return this.render();
  }
}

/**
 * Escape HTML special characters in a string
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Create a new patch
 * @returns {Patch}
 */
export function createPatch() {
  return new Patch();
}

/**
 * Content-Type header for patch responses
 */
export const CONTENT_TYPE = 'text/html; charset=utf-8';

/**
 * Express middleware for setting patch headers
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
export function patchMiddleware(req, res, next) {
  // Check if this is a SURF request
  if (req.headers['x-surf-request'] === 'true') {
    res.setHeader('Content-Type', CONTENT_TYPE);
  }
  next();
}

/**
 * Send a patch response (Express helper)
 * @param {Response} res - Express response object
 * @param {Patch} patch - Patch to send
 */
export function sendPatch(res, patch) {
  res.setHeader('Content-Type', CONTENT_TYPE);
  res.send(patch.render());
}

// Example usage:
//
// const { createPatch, sendPatch } = require('./patch');
//
// app.post('/save', (req, res) => {
//   const patch = createPatch()
//     .addSurface('#main', '<h1>Saved!</h1>')
//     .addSurface('#toast', '<div class="toast">Success</div>');
//
//   sendPatch(res, patch);
// });
