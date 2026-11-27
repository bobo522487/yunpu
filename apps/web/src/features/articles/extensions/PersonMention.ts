import { mergeAttributes, Node } from '@tiptap/core';

export const PersonMention = Node.create({
  name: 'personMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      personId: { default: '' },
      chartId: { default: '' },
      fallbackName: { default: '' },
      generation: { default: null },
    };
  },

  parseHTML() {
    const readAttrs = (element: HTMLElement) => ({
      personId: element.getAttribute('data-person-id') ?? '',
      chartId: element.getAttribute('data-chart-id') ?? '',
      fallbackName:
        element.getAttribute('data-fallback-name') ??
        element.textContent?.trim() ??
        '',
      generation: (() => {
        const raw = element.getAttribute('data-generation');
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
      })(),
    });
    return [
      { tag: 'span[data-person-id]', getAttrs: (el) => readAttrs(el as HTMLElement) },
      {
        tag: 'span[data-type="personMention"]',
        getAttrs: (el) => readAttrs(el as HTMLElement),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'personMention',
        'data-person-id': node.attrs.personId,
        'data-chart-id': node.attrs.chartId,
        'data-fallback-name': node.attrs.fallbackName,
        'data-generation': node.attrs.generation ?? '',
        class: 'puwen-person-mention',
      }),
      String(node.attrs.fallbackName || '未命名'),
    ];
  },
});