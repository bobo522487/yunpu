import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import {
  filterPersonMentions,
  type MentionCandidate,
} from '../domain/personMention';
import {
  filterSlashCommands,
  type SlashCommandItem,
} from '../domain/slashCommands';
import { createSuggestionRender } from './suggestionRender';

const slashCommandPluginKey = new PluginKey('slashCommand');
const personMentionSuggestionPluginKey = new PluginKey(
  'personMentionSuggestion',
);

function slashCommandMenuProps(props: SuggestionProps<SlashCommandItem>) {
  return {
    items: props.items.map((item) => ({
      id: item.id,
      title: item.title,
    })),
    onSelect: (id: string) => {
      const item = props.items.find((candidate) => candidate.id === id);
      if (item) {
        props.command(item);
      }
    },
  };
}

function personMentionMenuProps(props: SuggestionProps<MentionCandidate>) {
  return {
    items: props.items.map((item) => ({
      id: item.personId,
      title: item.name,
    })),
    onSelect: (id: string) => {
      const item = props.items.find((candidate) => candidate.personId === id);
      if (item) {
        props.command(item);
      }
    },
  };
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: '/',
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.run(editor);
        },
        render: createSuggestionRender(slashCommandMenuProps),
      }),
    ];
  },
});

export const PersonMentionSuggestion = Extension.create<{
  getPeople: () => MentionCandidate[];
}>({
  name: 'personMentionSuggestion',

  addOptions() {
    return {
      getPeople: () => [] as MentionCandidate[],
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<MentionCandidate>({
        editor: this.editor,
        pluginKey: personMentionSuggestionPluginKey,
        char: '@',
        items: ({ query }) =>
          filterPersonMentions(query, this.options.getPeople()),
        command: ({ editor, range, props: item }) => {
          editor.chain().focus().deleteRange(range).run();
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'personMention',
              attrs: {
                personId: item.personId,
                chartId: item.chartId,
                fallbackName: item.name,
                generation: item.generation,
              },
            })
            .run();
        },
        render: createSuggestionRender(personMentionMenuProps),
      }),
    ];
  },
});