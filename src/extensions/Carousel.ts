import { Node, mergeAttributes } from '@tiptap/core';

export interface CarouselOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    carousel: {
      setCarousel: (images: string[], digikamTag: string) => ReturnType;
    };
  }
}

export const Carousel = Node.create<CarouselOptions>({
  name: 'carousel',

  group: 'block',

  content: 'inline*',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: element => {
          const images = element.dataset.images;
          return images ? JSON.parse(images) : [];
        },
        renderHTML: attributes => {
          return {
            'data-images': JSON.stringify(attributes.images),
          };
        },
      },
      digikamTag: {
        default: '',
        parseHTML: element => {
          return element.dataset.digikamTag;
        },
        renderHTML: attributes => {
          return {
            'data-digikamTag': attributes.digikamTag,
          };
        }
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="carousel"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    let images = [];
    try {
      images = JSON.parse(HTMLAttributes['data-images']);
    } catch (er) {
      // skip
    }

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-type': 'carousel',
        'class': 'carousel-container',
      }, HTMLAttributes),
      [
        'div',
        { class: 'carousel' },
        [
          'div',
          { class: 'carousel-slides' },
          ...images.map((src: string, index: number) => [
            'div',
            { class: 'carousel-slide' },
            ['img', { src, alt: `Slide ${index + 1}` }],
          ]),
        ],
      ],
    ];
  },

  addCommands() {
    return {
      setCarousel:
        (images: string[], digikamTag: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { images, digikamTag },
          });
        },
    };
  },
});
