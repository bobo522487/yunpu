import {
  NodeViewWrapper,
  type NodeViewProps,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { useEffect, useState, type ComponentType } from 'react';
import { resolvePersonMentionLabel } from '../domain/personMention';

const mentionViewListeners = new Set<() => void>();

export function notifyPersonMentionViews(): void {
  mentionViewListeners.forEach((listener) => listener());
}

export interface PersonMentionViewProps extends NodeViewProps {
  people?: Array<{ id: string; name: string }>;
}

export function PersonMentionView({
  node,
  people = [],
}: PersonMentionViewProps) {
  const { personId, chartId, fallbackName, generation } = node.attrs;
  const { text, missing } = resolvePersonMentionLabel(
    { personId, fallbackName },
    people,
  );

  return (
    <NodeViewWrapper
      as="span"
      className={`puwen-person-mention${missing ? ' is-missing' : ''}`}
      title={missing ? '原谱系节点已移除' : undefined}
      data-type="personMention"
      data-person-id={personId}
      data-chart-id={chartId}
      data-fallback-name={fallbackName}
      data-generation={generation ?? ''}
    >
      {text}
    </NodeViewWrapper>
  );
}

export function createPersonMentionView(
  getPeople: () => Array<{ id: string; name: string }>,
): ComponentType<ReactNodeViewProps> {
  return function PersonMentionViewWithPeople(props: ReactNodeViewProps) {
    const [, setRefreshTick] = useState(0);
    useEffect(() => {
      const bump = () => setRefreshTick((t) => t + 1);
      mentionViewListeners.add(bump);
      return () => {
        mentionViewListeners.delete(bump);
      };
    }, []);

    return <PersonMentionView {...props} people={getPeople()} />;
  };
}