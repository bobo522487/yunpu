import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { AnyExtension } from '@tiptap/core';
import type { ComponentType } from 'react';
import { FontSize } from './FontSize';
import { TextIndent } from './TextIndent';
import { LineHeight } from './LineHeight';
import { FigureImage } from './FigureImage';
import { FigureImageView } from '../components/FigureImageView';
import { PersonMention } from './PersonMention';
import { InlineAnnotation } from './InlineAnnotation';
import { SlashCommand, PersonMentionSuggestion } from './SlashCommand';
import { PersonMentionLiveRefresh } from './PersonMentionLiveRefresh';
import type { MentionCandidate } from '../domain/personMention';

export function createArticleExtensions(options?: {
  mentionView?: ComponentType<ReactNodeViewProps>;
  getPeople?: () => MentionCandidate[];
  withFigureView?: boolean;
}): AnyExtension[] {
  const personMention = options?.mentionView
    ? PersonMention.extend({
        addNodeView() {
          return ReactNodeViewRenderer(options.mentionView!);
        },
      })
    : PersonMention;

  const figureImage = options?.withFigureView
    ? FigureImage.extend({
        addNodeView() {
          return ReactNodeViewRenderer(FigureImageView);
        },
      })
    : FigureImage;

  const getPeople = options?.getPeople ?? (() => [] as MentionCandidate[]);

  const extensions: AnyExtension[] = [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    Underline,
    TextStyle,
    FontFamily,
    FontSize,
    Color,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextIndent,
    LineHeight,
    figureImage,
    personMention,
    InlineAnnotation,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({
      placeholder: '在此撰写谱文正文，支持标题、列表、引用与表格排版……',
    }),
    SlashCommand,
    PersonMentionSuggestion.configure({ getPeople }),
  ];

  if (options?.mentionView) {
    extensions.push(PersonMentionLiveRefresh);
  }

  return extensions;
}