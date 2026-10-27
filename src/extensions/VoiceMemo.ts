import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VoiceMemoNode } from '../components/Editor/VoiceMemoNode';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    voiceMemo: {
      /**
       * Insert a voice memo block.
       */
      setVoiceMemo: (options: {
        src: string;
        fileName: string;
        duration: number;
        createdAt?: string | null;
        peaks?: number[];
        lang?: string;
        variant?: string;
      }) => ReturnType;
    };
  }
}

export interface VoiceMemoAttributes {
  src: string;
  fileName: string;
  duration: number;
  createdAt: string | null;
  peaks: number[];
  lang: string;
  variant: string;
}

export const VoiceMemo = Node.create({
  name: 'voiceMemo',

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
      peaks: {
        default: [],
        parseHTML: element => {
          const raw = element.getAttribute('data-peaks');
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        },
        renderHTML: attributes =>
          attributes.peaks?.length
            ? { 'data-peaks': JSON.stringify(attributes.peaks) }
            : {},
      },
      lang: {
        default: '',
        parseHTML: element => element.getAttribute('data-lang') || '',
        renderHTML: attributes => (attributes.lang ? { 'data-lang': attributes.lang } : {}),
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
        tag: 'div[data-type="voice-memo"]',
        getAttrs: element => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }
          return {
            src: element.getAttribute('data-src') || '',
            fileName: element.getAttribute('data-file-name') || '',
            duration: Number(element.getAttribute('data-duration') || 0),
            createdAt: element.getAttribute('data-created-at'),
            peaks: (() => {
              const raw = element.getAttribute('data-peaks');
              if (!raw) return [];
              try {
                return JSON.parse(raw);
              } catch {
                return [];
              }
            })(),
            lang: element.getAttribute('data-lang') || '',
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
      mergeAttributes({ 'data-type': 'voice-memo' }, HTMLAttributes),
      // Fallback: a plain native player so the block degrades gracefully outside
      // the editor (e.g. in a static export or when JS is unavailable).
      ['audio', src ? { src, controls: 'true' } : {}, `${duration ? `${duration} ms` : ''}`],
    ];
  },

  // The transcript is inserted as a regular paragraph right after the memo, marked
  // with `data-voice-transcript` so it can be found/styled. We extend the built-in
  // `paragraph` node with this attribute rather than storing the transcript inside
  // the memo node itself.
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          voiceTranscript: {
            default: null,
            parseHTML: element => element.getAttribute('data-voice-transcript'),
            renderHTML: attributes => {
              if (!attributes.voiceTranscript) return {};
              return { 'data-voice-transcript': attributes.voiceTranscript };
            },
          },
        },
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VoiceMemoNode);
  },

  addCommands() {
    return {
      setVoiceMemo:
        options =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              fileName: options.fileName,
              duration: options.duration,
              createdAt: options.createdAt ?? null,
              peaks: options.peaks ?? [],
              lang: options.lang ?? '',
              variant: options.variant ?? 'compact',
            },
          });
        },
    };
  },
});
