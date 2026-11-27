import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import {
  SlashCommandMenu,
  type SlashCommandMenuProps,
  type SlashCommandMenuHandle,
} from '../components/SlashCommandMenu';

function positionPopup(
  popup: HTMLElement,
  clientRect?: (() => DOMRect | null) | null,
) {
  if (!clientRect) {
    return;
  }
  const rect = clientRect();
  if (!rect) {
    return;
  }
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom}px`;
}

export function createSuggestionRender<T>(
  toMenuProps: (props: SuggestionProps<T>) => SlashCommandMenuProps,
) {
  let popup: HTMLDivElement | null = null;
  let renderer: ReactRenderer<SlashCommandMenuHandle> | null = null;

  return () => ({
    onStart: (props: SuggestionProps<T>) => {
      popup = document.createElement('div');
      popup.style.position = 'fixed';
      popup.style.zIndex = '50';
      document.body.appendChild(popup);

      renderer = new ReactRenderer(SlashCommandMenu, {
        editor: props.editor,
        props: toMenuProps(props),
      });
      popup.appendChild(renderer.element);
      positionPopup(popup, props.clientRect);
    },

    onUpdate: (props: SuggestionProps<T>) => {
      renderer?.updateProps(toMenuProps(props));
      if (popup) {
        positionPopup(popup, props.clientRect);
      }
    },

    onExit: () => {
      renderer?.destroy();
      renderer = null;
      popup?.remove();
      popup = null;
    },

    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'Escape') {
        return true;
      }
      return renderer?.ref?.onKeyDown(event) ?? false;
    },
  });
}