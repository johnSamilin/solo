import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fullWidthImage: {
      toggleImageFullWidth: () => ReturnType;
    };
  }
}

export const FullWidthImage = Extension.create({
  name: 'fullWidthImage',

  addGlobalAttributes() {
    return [
      {
        types: ['image'],
        attributes: {
          isFullWidth: {
            default: false,
            parseHTML: element => element.classList.contains('full-width'),
            renderHTML: attributes => {
              if (!attributes.isFullWidth) {
                return {};
              }

              return {
                class: 'full-width',
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleImageFullWidth:
        () =>
        ({ tr, dispatch }) => {
          const { selection } = tr;
          const node = tr.doc.nodeAt(selection.from);

          if (!node || node.type.name !== 'image') {
            return false;
          }

          if (dispatch) {
            tr.setNodeMarkup(selection.from, null, {
              ...node.attrs,
              isFullWidth: !node.attrs.isFullWidth,
            });
          }

          return true;
        },
    };
  },
});