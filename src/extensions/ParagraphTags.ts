import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const ParagraphTags = Extension.create({
  name: 'paragraphTags',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
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
    };
  },

  addCommands() {
    return {
      setParagraphTags: (tags: string[]) => ({ commands }) => {
        return commands.updateAttributes('paragraph', { tags });
      },
      removeParagraphTags: () => ({ commands }) => {
        return commands.resetAttributes('paragraph', 'tags');
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