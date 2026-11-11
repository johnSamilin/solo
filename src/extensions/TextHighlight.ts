import { Mark } from '@tiptap/core';

export const HIGHLIGHT_COLORS = {
  yellow: '#fff3a6',
  peach: '#ffdfc4',
  pink: '#ffd9e6',
  lavender: '#e5dcff',
  mint: '#d2f2df',
  sky: '#d8ecff',
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HIGHLIGHT_COLORS, value);
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textHighlight: {
      setTextHighlight: (color: HighlightColor) => ReturnType;
      unsetTextHighlight: () => ReturnType;
    };
  }
}

export const TextHighlight = Mark.create({
  name: 'textHighlight',
  inclusive: false,

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  addAttributes() {
    return {
      color: {
        default: 'yellow',
        parseHTML: element => {
          const color = element.getAttribute('data-highlight-color');
          return isHighlightColor(color) ? color : 'yellow';
        },
        renderHTML: attributes => {
          const color = isHighlightColor(attributes.color) ? attributes.color : 'yellow';
          return {
            'data-highlight-color': color,
            style: `background-color: ${HIGHLIGHT_COLORS[color]}`,
          };
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0];
  },

  addCommands() {
    return {
      setTextHighlight: (color: HighlightColor) => ({ commands }) =>
        isHighlightColor(color) && commands.setMark(this.name, { color }),
      unsetTextHighlight: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});
