import { Node, mergeAttributes } from '@tiptap/core';

export interface CarouselOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    carousel: {
      setCarousel: (photos: string[]) => ReturnType;
    };
  }
}

export const Carousel = Node.create<CarouselOptions>({
  name: 'carousel',

  group: 'block',

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      photos: {
        default: [],
        parseHTML: element => {
          const photosAttr = element.getAttribute('data-photos');
          return photosAttr ? JSON.parse(photosAttr) : [];
        },
        renderHTML: attributes => {
          return {
            'data-photos': JSON.stringify(attributes.photos),
          };
        },
      },
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
    const photos = HTMLAttributes['data-photos'] ? JSON.parse(HTMLAttributes['data-photos']) : [];

    const carouselDiv = ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'carousel', class: 'carousel' })];

    const slidesContainer = ['div', { class: 'carousel-slides' }];

    photos.forEach((photo: string, index: number) => {
      (slidesContainer as any[]).push([
        'div',
        {
          class: 'carousel-slide',
          style: index === 0 ? 'display: block;' : 'display: none;',
          'data-index': index.toString(),
        },
        ['img', { src: `file://${photo}`, alt: `Photo ${index + 1}` }],
      ]);
    });

    (carouselDiv as any[]).push(slidesContainer);

    if (photos.length > 1) {
      (carouselDiv as any[]).push([
        'button',
        { class: 'carousel-prev', 'data-action': 'prev' },
        '‹',
      ]);
      (carouselDiv as any[]).push([
        'button',
        { class: 'carousel-next', 'data-action': 'next' },
        '›',
      ]);

      const indicatorsDiv = ['div', { class: 'carousel-indicators' }];
      photos.forEach((_: string, index: number) => {
        (indicatorsDiv as any[]).push([
          'span',
          {
            class: index === 0 ? 'carousel-indicator active' : 'carousel-indicator',
            'data-index': index.toString(),
          },
        ]);
      });
      (carouselDiv as any[]).push(indicatorsDiv);
    }

    return carouselDiv as any;
  },

  addCommands() {
    return {
      setCarousel:
        (photos: string[]) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { photos },
          });
        },
    };
  },
});
