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
              return tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            },
            renderHTML: attributes => {
              if (!attributes.tags || !Array.isArray(attributes.tags) || attributes.tags.length === 0) {
                return {};
              }
              return { 
                'data-tags': attributes.tags.join(','),
                'data-paragraph-tags': 'true' // Add marker for easier identification
              };
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
        appendTransaction: (transactions, oldState, newState) => {
          // Handle the case where a new paragraph is created from a tagged paragraph
          let tr = null;
          
          transactions.forEach(transaction => {
            if (!transaction.docChanged) return;
            
            transaction.steps.forEach(step => {
              if (step.jsonID === 'replace') {
                const stepData = step as any;
                if (stepData.slice && stepData.slice.content && stepData.slice.content.content) {
                  stepData.slice.content.content.forEach((node: any, index: number) => {
                    if (node.type && node.type.name === 'paragraph' && node.attrs && node.attrs.tags && node.attrs.tags.length > 0) {
                      // Find the position of this new paragraph in the new state
                      newState.doc.descendants((newNode, pos) => {
                        if (newNode.type.name === 'paragraph' && 
                            newNode.attrs.tags && 
                            newNode.attrs.tags.length > 0 &&
                            JSON.stringify(newNode.attrs.tags) === JSON.stringify(node.attrs.tags)) {
                          
                          // Check if this is a newly created paragraph (not the original one)
                          let isNewParagraph = true;
                          oldState.doc.descendants((oldNode, oldPos) => {
                            if (oldPos === pos && 
                                oldNode.type.name === 'paragraph' && 
                                oldNode.attrs.tags &&
                                JSON.stringify(oldNode.attrs.tags) === JSON.stringify(node.attrs.tags)) {
                              isNewParagraph = false;
                            }
                          });
                          
                          if (isNewParagraph) {
                            if (!tr) {
                              tr = newState.tr;
                            }
                            tr.setNodeMarkup(pos, undefined, {
                              ...newNode.attrs,
                              tags: [],
                            });
                          }
                        }
                      });
                    }
                  });
                }
              }
            });
          });
          
          return tr;
        },
      }),
    ];
  },
});