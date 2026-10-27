import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VideoMemoNode } from '../components/Editor/VideoMemoNode';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoMemo: {
      /**
       * Insert a video memo block.
       */
      setVideoMemo: (options: {
        src: string;
        fileName: string;
        duration: number;
        createdAt?: string | null;
        poster?: string;
        variant?: string;
      }) => ReturnType;
    };
  }
}

export interface VideoMemoAttributes {
  src: string;
  fileName: string;
  duration: number;
  createdAt: string | null;
  poster: string;
  variant: string;
}

export const VideoMemo = Node.create({
  name: 'videoMemo',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: '',
        parseHTML: element => element.getAttribute('data-src') || '',
        renderHTML: attributes => ({ 'data-src': attributes.src }),
      },
      fileName: {
        default: '',
        parseHTML: element => element.getAttribute('data-file-name') || '',
        renderHTML: attributes => ({ 'data-file-name': attributes.fileName }),
      },
      duration: {
        default: 0,
        parseHTML: element => Number(element.getAttribute('data-duration') || 0),
        renderHTML: attributes => ({ 'data-duration': String(attributes.duration) }),
      },
      createdAt: {
        default: null,
        parseHTML: element => element.getAttribute('data-created-at'),
        renderHTML: attributes =>
          attributes.createdAt ? { 'data-created-at': attributes.createdAt } : {},
      },
      poster: {
        default: '',
        parseHTML: element => element.getAttribute('data-poster') || '',
        renderHTML: attributes => (attributes.poster ? { 'data-poster': attributes.poster } : {}),
      },
      variant: {
        default: 'compact',
        parseHTML: element => element.getAttribute('data-variant') || 'compact',
        renderHTML: attributes => ({ 'data-variant': attributes.variant }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="video-memo"]',
        getAttrs: element => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          return {
            src: element.getAttribute('data-src') || '',
            fileName: element.getAttribute('data-file-name') || '',
            duration: Number(element.getAttribute('data-duration') || 0),
            createdAt: element.getAttribute('data-created-at'),
            poster: element.getAttribute('data-poster') || '',
            variant: element.getAttribute('data-variant') || 'compact',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { 'data-src': src, 'data-duration': duration } = HTMLAttributes as {
      'data-src'?: string;
      'data-duration'?: string;
    };
    return [
      'div',
      mergeAttributes({ 'data-type': 'video-memo' }, HTMLAttributes),
      // Fallback: a plain native player so the block degrades gracefully outside
      // the editor (e.g. in a static export or when JS is unavailable).
      ['video', src ? { src, controls: 'true' } : {}, `${duration ? `${duration} ms` : ''}`],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoMemoNode);
  },

  addCommands() {
    return {
      setVideoMemo:
        options =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              fileName: options.fileName,
              duration: options.duration,
              createdAt: options.createdAt ?? null,
              poster: options.poster ?? '',
              variant: options.variant ?? 'compact',
            },
          });
        },
    };
  },
});
