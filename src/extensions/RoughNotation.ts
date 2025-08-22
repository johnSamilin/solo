import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { annotate, RoughAnnotation } from 'rough-notation';

// Export the plugin creation function as a standalone function
export const createRoughNotationPlugin = () => {
  const key = new PluginKey('roughNotation');
  const annotations = new Map<Element, RoughAnnotation>();
  let updateTimeout: NodeJS.Timeout | null = null;

  return new Plugin({
    key,
    view: () => ({
      update: (view) => {
        // Debounce updates to prevent constant re-rendering
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
          // Only update if the document has actually changed
          const currentElements = view.dom.querySelectorAll('span[data-notation-type]');
          
          // Remove annotations for elements that no longer exist
          annotations.forEach((annotation, element) => {
            if (!document.contains(element)) {
              try {
                annotation.remove();
              } catch (e) {
                // Ignore errors
              }
              annotations.delete(element);
            }
          });

          // Add annotations for new elements
          currentElements.forEach((element) => {
            // Skip if already annotated
            if (annotations.has(element)) return;
            
            const type = element.getAttribute('data-notation-type') || 'underline';
            const color = element.getAttribute('data-notation-color') || '#ff6b6b';
            
            try {
              const annotation = annotate(element as HTMLElement, {
                type: type as any,
                color,
                strokeWidth: 2,
                padding: 4,
                animationDuration: 0, // Disable animation to prevent re-rendering
              });
              
              annotation.show();
              annotations.set(element, annotation);
            } catch (e) {
              console.warn('Failed to create rough notation:', e);
            }
          });
        }, 200); // Increased timeout for better stability
      },
      destroy: () => {
        if (updateTimeout) clearTimeout(updateTimeout);
        // Clean up all annotations
        annotations.forEach((annotation) => {
          try {
            annotation.remove();
          } catch (e) {
            // Ignore errors
          }
        });
        annotations.clear();
      },
    }),
  });
};

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
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
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