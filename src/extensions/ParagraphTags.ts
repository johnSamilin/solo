import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

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

  addProseMirrorPlugins() {
    const key = new PluginKey('paragraphTags');
    
    return [
      new Plugin({
        key,
        props: {
          decorations: state => {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos) => {
              if (node.type.name === 'paragraph' && node.attrs.tags?.length) {
                const tags = node.attrs.tags as string[];
                decorations.push(
                  Decoration.widget(pos + node.nodeSize, () => {
                    const tagContainer = document.createElement('div');
                    tagContainer.className = 'paragraph-tags';
                    tags.forEach(tag => {
                      const tagEl = document.createElement('span');
                      tagEl.className = 'paragraph-tag';
                      tagEl.textContent = tag;
                      tagContainer.appendChild(tagEl);
                    });
                    return tagContainer;
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});