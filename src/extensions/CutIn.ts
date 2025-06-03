import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CutInComponent } from '../components/CutIn';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    cutIn: {
      /**
       * Add a cut-in
       */
      setCutIn: (options: { text?: string; image?: string; position?: 'left' | 'right' }) => ReturnType;
    };
  }
}

export const CutIn = Node.create({
  name: 'cutIn',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      text: {
        default: '',
      },
      image: {
        default: '',
      },
      position: {
        default: 'right',
        parseHTML: element => element.getAttribute('data-position'),
        renderHTML: attributes => {
          return {
            'data-position': attributes.position,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="cut-in"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-type': 'cut-in' }, HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CutInComponent);
  },

  addCommands() {
    return {
      setCutIn:
        options =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});