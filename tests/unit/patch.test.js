
import { describe, it, expect, vi } from 'vitest';
import Patch from '../../src/patch.js';

describe('Patch Module', () => {
    describe('parse', () => {
        it('should return empty array for non-patch HTML', () => {
            const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const html = '<div>Just content</div>';
            const patches = Patch.parse(html);
            expect(patches).toEqual([]);
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });

        it('should parse simple patch', () => {
            const html = `
                <d-patch>
                    <surface target="#main">Content A</surface>
                </d-patch>
            `;
            const patches = Patch.parse(html);
            expect(patches).toHaveLength(1);
            expect(patches[0]).toEqual({
                target: '#main',
                content: 'Content A'
            });
        });

        it('should parse multiple surfaces', () => {
            const html = `
                <d-patch>
                    <surface target="#header">Header</surface>
                    <surface target="#footer">Footer</surface>
                </d-patch>
            `;
            const patches = Patch.parse(html);
            expect(patches).toHaveLength(2);
            expect(patches[0].target).toBe('#header');
            expect(patches[1].target).toBe('#footer');
        });
        
        it('should ignore surfaces without target', () => {
             const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
             const html = `
                <d-patch>
                    <surface>Missing Target</surface>
                    <surface target="#valid">Valid</surface>
                </d-patch>
            `;
            const patches = Patch.parse(html);
            expect(patches).toHaveLength(1);
            expect(patches[0].target).toBe('#valid');
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    describe('isPatch', () => {
        it('should detect patch strings', () => {
            expect(Patch.isPatch('<d-patch>')).toBe(true);
            expect(Patch.isPatch('  <d-patch>  ')).toBe(true);
            expect(Patch.isPatch('<div>...</div>')).toBe(false);
        });
    });
    
    describe('create', () => {
        it('should generate patch HTML', () => {
            const surfaces = [
                { target: '#main', content: 'World' }
            ];
            const html = Patch.create(surfaces);
            
            expect(html).toContain('<d-patch>');
            expect(html).toContain('<surface target="#main">World</surface>');
            expect(html).toContain('</d-patch>');
        });
    });
});
