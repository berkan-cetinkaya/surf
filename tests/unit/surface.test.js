
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Surface, { getSignature, smartReplaceHead } from '../../src/surface.js';

describe('Surface Module', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'app-root';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container.innerHTML = '';
  });

  describe('Selection', () => {
    beforeEach(() => {
      container.innerHTML = `
        <div id="main">Main Content</div>
        <div id="sidebar">Sidebar</div>
        <div id="footer">Footer</div>
      `;
    });

    it('should find element by ID', () => {
      const main = Surface.getById('main');
      expect(main).toBeTruthy();
      expect(main.textContent).toBe('Main Content');
    });
    
    it('should handle # in ID', () => {
      const main = Surface.getById('#main');
      expect(main).toBeTruthy();
    });

    it('should find element by selector', () => {
      const sidebar = Surface.getBySelector('#sidebar');
      expect(sidebar).toBeTruthy();
      expect(sidebar.textContent).toBe('Sidebar');
    });

    it('should return null for non-existent selector', () => {
      const missing = Surface.getBySelector('#nonexistent');
      expect(missing).toBeNull();
    });
  });

  describe('Modification', () => {
    let surface;
    
    beforeEach(() => {
      surface = document.createElement('div');
      surface.id = 'content';
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


  describe('Smart Head Replacement', () => {
    describe('getSignature', () => {
      it('identifies TITLE tags', () => {
        const el = document.createElement('title');
        el.textContent = 'Test';
        expect(getSignature(el)).toBe('TITLE');
      });

      it('identifies LINK tags by href', () => {
        const el = document.createElement('link');
        el.setAttribute('href', '/css/app.css');
        expect(getSignature(el)).toBe('LINK:/css/app.css');
      });

      it('identifies META tags by name', () => {
        const el = document.createElement('meta');
        el.setAttribute('name', 'description');
        expect(getSignature(el)).toBe('META:description');
      });

      it('identifies SCRIPT tags by src', () => {
        const el = document.createElement('script');
        el.setAttribute('src', '/js/app.js');
        expect(getSignature(el)).toBe('SCRIPT:/js/app.js');
      });

      it('identifies STYLE tags by content', () => {
        const el = document.createElement('style');
        el.textContent = 'body { color: red; }';
        expect(getSignature(el)).toBe('STYLE:body { color: red; }');
      });

      it('uses outerHTML for other elements', () => {
        const el = document.createElement('meta');
        el.setAttribute('charset', 'utf-8');
        expect(getSignature(el)).toBe('<meta charset="utf-8">');
      });
    });

    describe('smartReplaceHead', () => {
      let originalHeadHTML;
      
      beforeEach(() => {
        originalHeadHTML = document.head.innerHTML;
        document.head.innerHTML = '<title>Old Title</title>';
      });
      
      afterEach(() => {
        document.head.innerHTML = originalHeadHTML;
      });

      it('updates title', () => {
        const newHead = document.createElement('head');
        newHead.innerHTML = '<title>New Title</title>';

        smartReplaceHead(newHead);
        expect(document.title).toBe('New Title');
      });

      it('preserves existing elements that match', () => {
        const link = document.createElement('link');
        link.setAttribute('href', 'style.css');
        document.head.appendChild(link);

        const newHead = document.createElement('head');
        newHead.innerHTML = '<title>Old Title</title><link href="style.css">';

        smartReplaceHead(newHead);

        // Check reference equality
        const currentLink = document.head.querySelector('link');
        expect(currentLink).toBe(link);
      });

      it('removes elements not in new head', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'old-meta');
        document.head.appendChild(meta);

        const newHead = document.createElement('head');
        newHead.innerHTML = '<title>Old Title</title>';

        smartReplaceHead(newHead);

        expect(document.head.querySelector('meta[name="old-meta"]')).toBeNull();
      });

      it('adds new elements', () => {
        const newHead = document.createElement('head');
        newHead.innerHTML = '<title>Old Title</title><script src="new.js"></script>';

        smartReplaceHead(newHead);

        expect(document.head.querySelector('script[src="new.js"]')).not.toBeNull();
      });
      it('integration: replace(document.documentElement) uses smart head replacement', () => {
        document.head.innerHTML = '<title>Old</title><link href="keep.css">';
        const oldLink = document.head.querySelector('link');
        
        const newHtml = `<!DOCTYPE html><html><head><title>New</title><link href="keep.css"><script src="new.js"></script></head><body><div id="new-body">New Body</div></body></html>`;
        
        Surface.replace(document.documentElement, newHtml);
        
        expect(document.title).toBe('New');
        expect(document.head.querySelector('link')).toBe(oldLink);
        expect(document.head.querySelector('script[src="new.js"]')).not.toBeNull();
        expect(document.body.querySelector('#new-body')).not.toBeNull();
      });
    });
  });
});
