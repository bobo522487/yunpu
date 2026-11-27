import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

export const FigureImage = Image.extend({
  name: 'figureImage',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-asset-id') || '',
        renderHTML: (attributes) => ({ 'data-asset-id': attributes.assetId || undefined }),
      },
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute('src'),
        renderHTML: () => ({}),
      },
      alt: { default: '' },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption') || '',
        renderHTML: (attributes) => ({ 'data-caption': attributes.caption || undefined }),
      },
      widthPct: {
        default: 80,
        parseHTML: (element) => Number(element.getAttribute('data-width-pct') || 80),
        renderHTML: (attributes) => ({ 'data-width-pct': String(attributes.widthPct ?? 80) }),
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({ 'data-align': attributes.align || 'center' }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'figure[data-asset-id]' },
      { tag: 'img[data-asset-id]' },
      {
        tag: 'img',
        getAttrs: (element) => {
          const src = (element as HTMLElement).getAttribute('src') || '';
          if (!src.startsWith('asset://')) return false;
          return { assetId: src.slice('asset://'.length), src: null, caption: '' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const caption = String(HTMLAttributes['data-caption'] ?? '');
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { class: 'puwen-figure' }),
      ['img', { 'data-asset-id': HTMLAttributes['data-asset-id'], alt: caption }],
      ['figcaption', {}, caption],
    ];
  },
});