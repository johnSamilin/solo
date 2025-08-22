import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { annotate, RoughAnnotation } from 'rough-notation';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    roughNotation: {
      /**
       * Set rough notation mark
       */
      setRoughNotation: (options: { type: string; color?: string }) => ReturnType;
      /**
       * Toggle rough notation mark
       */
      toggleRoughNotation: (options: { type: string; color?: string }) => ReturnType;
      /**
       * Unset rough notation mark
       */
      unsetRoughNotation: () => ReturnType;
    };
  }
}

export const RoughNotation = Mark.create({
  name: 'roughNotation',

  addOptions() {
    return {
      HTMLAttributes: {},
      types: ['underline', 'box', 'circle', 'highlight', 'strike-through', 'crossed-off'],
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff'],
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'underline',
        parseHTML: element => element.getAttribute('data-notation-type'),
        renderHTML: attributes => {
          if (!attributes.type) return {};
          return { 'data-notation-type': attributes.type };
        },
      },
      color: {
        default: '#ff6b6b',
        parseHTML: element => element.getAttribute('data-notation-color'),
        renderHTML: attributes => {
          if (!attributes.color) return {};
          return { 'data-notation-color': attributes.color };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-notation-type]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { type = 'underline', color = '#ff6b6b' } = HTMLAttributes;
    
    // Create SVG based on rough-notation logic
    const createSVG = (type: string, color: string) => {
      const strokeWidth = 2;
      const padding = 4;
      
      let svgContent = '';
      const viewBox = '0 0 100 20';
      
      switch (type) {
        case 'underline':
          // Rough underline path
          svgContent = `<path d="M2,16 Q25,14 50,16 T98,16" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.8"/>`;
          break;
        case 'box':
          // Rough rectangle
          svgContent = `<path d="M2,2 L98,2 L98,18 L2,18 Z" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.8"/>`;
          break;
        case 'circle':
          // Rough circle/ellipse
          svgContent = `<ellipse cx="50" cy="10" rx="48" ry="8" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.8"/>`;
          break;
        case 'highlight':
          // Background highlight
          svgContent = `<rect x="0" y="2" width="100" height="16" fill="${color}" opacity="0.3"/>`;
          break;
        case 'strike-through':
          // Strike through line
          svgContent = `<path d="M2,10 Q25,8 50,10 T98,10" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.8"/>`;
          break;
        case 'crossed-off':
          // Multiple crossing lines
          svgContent = `
            <path d="M2,10 Q25,8 50,10 T98,10" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.8"/>
            <path d="M5,5 L95,15" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.6"/>
            <path d="M5,15 L95,5" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.6"/>
          `;
          break;
        default:
          svgContent = `<path d="M2,16 Q25,14 50,16 T98,16" stroke="${color}" stroke-width="${strokeWidth}" fill="none" opacity="0.8"/>`;
      }
      
      return `<svg viewBox="${viewBox}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1;">${svgContent}</svg>`;
    };
    
    const svg = createSVG(type, color);
    
    return [
      'span', 
      mergeAttributes(
        this.options.HTMLAttributes, 
        HTMLAttributes,
        {
          style: 'position: relative; display: inline-block;'
        }
      ), 
      [
        'span',
        {
          innerHTML: svg,
          style: 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;'
        }
      ],
      0
    ];
  },

  addCommands() {
    return {
      setRoughNotation:
        (options) =>
        ({ commands }) => {
          return commands.setMark(this.name, options);
        },
      toggleRoughNotation:
        (options) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, options);
        },
      unsetRoughNotation:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addProseMirrorPlugins() {
    // Only return plugins if we have content with rough notations
    return [];
  },
});