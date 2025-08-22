import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Node as ProseMirrorNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphTags: {
      /**
       * Set tags for the current paragraph
       */
      setParagraphTags: (tags: string[]) => ReturnType;
      /**
       * Remove tags from the current paragraph
       */
      removeParagraphTags: () => ReturnType;
    };
  }
}

export const ParagraphTags = Extension.create({
  name: 'paragraphTags',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          tags: {
            default: [],
            parseHTML: element => {
              const tags = element.getAttribute('data-tags');
              return tags ? tags.split(',') : [];
            },
            renderHTML: attributes => {
              if (!attributes.tags?.length) return {};
              return { 'data-tags': attributes.tags.join(',') };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setParagraphTags: (tags: string[]) => ({ tr, dispatch }) => {
        const { selection } = tr;
        const { $from } = selection;
        
        // Find the paragraph node
        const depth = $from.depth;
        const pos = $from.before(depth);
        const node = $from.node(depth);

        if (node.type.name !== 'paragraph') return false;

        if (dispatch) {
          // Update the node's attributes
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            tags,
          });
        }

        return true;
      },
      removeParagraphTags: () => ({ tr, dispatch }) => {
        const { selection } = tr;
        const { $from } = selection;
        
        const depth = $from.depth;
        const pos = $from.before(depth);
        const node = $from.node(depth);

        if (node.type.name !== 'paragraph') return false;

        if (dispatch) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            tags: [],
          });
        }

        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        
        // Check if we're in a paragraph with tags
        const node = $from.node();
        if (node.type.name === 'paragraph' && node.attrs.tags?.length > 0) {
          // Split the paragraph but don't copy tags to the new paragraph
          return editor.commands.splitBlock({
            keepMarks: false,
          });
        }
        
        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    // Paragraph tags are now handled via CSS and data attributes
    // No decorations plugin needed to reduce rerenders
    return [];
  },
});