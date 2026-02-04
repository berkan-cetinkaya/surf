
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Surface from '../../src/surface.js';

describe('Surface Module', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container.innerHTML = '';
  });

  describe('Selection', () => {
    beforeEach(() => {
      container.innerHTML = `
        <div id="main" d-surface>Main Content</div>
        <div id="sidebar" d-surface>Sidebar</div>
        <div id="footer">Footer (Not Surface)</div>
      `;
    });

    it('should find all surfaces', () => {
      const surfaces = Surface.findAll();
      // Note: findAll queries globally (document), so it should find ours + maybe others if leaked
      // But we clean up document.body.
      // Filter to our container to be safe or just check count if environment is clean
      const ourSurfaces = Array.from(surfaces).filter(el => container.contains(el));
      expect(ourSurfaces.length).toBe(2);
    });

    it('should find surface by ID', () => {
      const main = Surface.getById('main');
      expect(main).toBeTruthy();
      expect(main.textContent).toBe('Main Content');

      const footer = Surface.getById('footer');
      expect(footer).toBeNull(); // Not a surface (missing attribute)
    });
    
    it('should handle # in ID', () => {
      const main = Surface.getById('#main');
      expect(main).toBeTruthy();
    });

    it('should find surface by selector', () => {
      const sidebar = Surface.getBySelector('#sidebar');
      expect(sidebar).toBeTruthy();
      expect(sidebar.textContent).toBe('Sidebar');
      
      const missing = Surface.getBySelector('#footer');
      expect(missing).toBeNull(); // Not a surface
    });
  });

  describe('Modification', () => {
    let surface;
    
    beforeEach(() => {
      surface = document.createElement('div');
      surface.id = 'content';
      surface.setAttribute('d-surface', '');
      surface.innerHTML = '<p>Initial</p>';
      container.appendChild(surface);
    });

    it('should replace content', () => {
      Surface.replace(surface, '<h1>New Content</h1>');
      expect(surface.innerHTML).toBe('<h1>New Content</h1>');
    });

    it('should replace content using selector', () => {
      Surface.replace('#content', '<span>Updated via selector</span>');
      expect(surface.innerHTML).toBe('<span>Updated via selector</span>');
    });

    it('should append content', () => {
      Surface.append(surface, '<p>Appended</p>');
      expect(surface.innerHTML).toBe('<p>Initial</p><p>Appended</p>');
    });

    it('should prepend content', () => {
      Surface.prepend(surface, '<p>Prepended</p>');
      expect(surface.innerHTML).toBe('<p>Prepended</p><p>Initial</p>');
    });
    
    it('should handle multiple elements in append/prepend', () => {
        Surface.append(surface, '<span>A</span><span>B</span>');
        expect(surface.innerHTML).toContain('<span>A</span><span>B</span>');
    });
  });

  describe('Initialization', () => {
    it('should mark surfaces as ready', () => {
      const el = document.createElement('div');
      el.setAttribute('d-surface', '');
      container.appendChild(el);
      
      Surface.init();
      
      expect(el.getAttribute('data-surf-ready')).toBe('true');
    });
  });
});
