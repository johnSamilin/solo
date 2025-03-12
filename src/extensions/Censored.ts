import { Mark, markPasteRule, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    censored: {
      /**
       * Set censored mark
       */
      setCensored: () => ReturnType;
      /**
       * Toggle censored mark
       */
      toggleCensored: () => ReturnType;
      /**
       * Unset censored mark
       */
      unsetCensored: () => ReturnType;
    };
  }
}

export const Censored = Mark.create({
  name: 'censored',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-censored]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-censored': '' }, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setCensored:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name);
        },
      toggleCensored:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
      unsetCensored:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-x': () => this.editor.commands.toggleCensored(),
    };
  },
});