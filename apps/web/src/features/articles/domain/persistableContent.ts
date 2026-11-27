import type { JSONContent } from '@tiptap/core';

function cloneNode(node: JSONContent): JSONContent {
  const next: JSONContent = { ...node, attrs: node.attrs ? { ...node.attrs } : undefined };
  if (next.type === 'figureImage' && next.attrs) {
    const src = String(next.attrs.src ?? '');
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      next.attrs.src = null;
    }
  }
  if (node.content) next.content = node.content.map(cloneNode);
  return next;
}

export function persistableContentJson(json: JSONContent): JSONContent {
  return cloneNode(json);
}