import type { Editor } from '@tiptap/core';

export interface SlashCommandItem {
  id: string;
  title: string;
  keywords: string[];
  run: (editor: Editor) => void;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'heading',
    title: '二级标题',
    keywords: ['标题', 'heading'],
    run: (editor) => {
      editor.chain().focus().setHeading({ level: 2 }).run();
    },
  },
  {
    id: 'blockquote',
    title: '引言',
    keywords: ['引用', 'quote'],
    run: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    id: 'table',
    title: '表格',
    keywords: ['表'],
    run: (editor) => {
      editor
        .chain()
        .focus()
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    id: 'divider',
    title: '分割线',
    keywords: ['hr'],
    run: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
  {
    id: 'interlinear',
    title: '双行夹注',
    keywords: ['夹注', '待考'],
    run: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'inlineAnnotation',
          attrs: { mode: 'interlinear', noteText: '待考' },
        })
        .run();
    },
  },
  {
    id: 'footnote',
    title: '脚注',
    keywords: ['注'],
    run: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'inlineAnnotation',
          attrs: { mode: 'footnote', noteText: '' },
        })
        .run();
    },
  },
];

export function filterSlashCommands(query: string): SlashCommandItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) ||
      item.keywords.some((word) => word.toLowerCase().includes(needle)),
  );
}