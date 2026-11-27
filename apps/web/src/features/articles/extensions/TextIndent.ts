import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textIndent: {
      setTextIndent: (textIndent: '0' | '2em') => ReturnType;
    };
  }
}

export const TextIndent = Extension.create({
  name: 'textIndent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (element) => element.style.textIndent || null,
            renderHTML: (attributes) => {
              if (!attributes.textIndent) return {};
              return { style: `text-indent: ${attributes.textIndent}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextIndent:
        (textIndent) =>
        ({ editor, commands }) => {
          const type = editor.isActive('heading') ? 'heading' : 'paragraph';
          return commands.updateAttributes(type, { textIndent });
        },
    };
  },
});