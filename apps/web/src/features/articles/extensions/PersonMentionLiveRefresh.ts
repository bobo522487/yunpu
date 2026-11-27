import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { notifyPersonMentionViews } from '../components/PersonMentionView';

export const personMentionRefreshKey = new PluginKey('personMentionLiveRefresh');

export const PersonMentionLiveRefresh = Extension.create({
  name: 'personMentionLiveRefresh',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: personMentionRefreshKey,
        appendTransaction(transactions) {
          if (
            transactions.some((tr) => tr.getMeta('personMentionRefresh'))
          ) {
            notifyPersonMentionViews();
          }
          return null;
        },
      }),
    ];
  },
});