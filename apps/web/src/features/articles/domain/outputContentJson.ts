import type { JSONContent } from '@tiptap/core';
import type { PersonRecord } from '../../lineage/types';
import { resolvePersonMentionLabel } from './personMention';

export interface PersonMentionOutputContext {
  projectId: string;
  personsByChart: Record<string, PersonRecord[]>;
}

function lineagePeopleForChart(
  ctx: PersonMentionOutputContext,
  chartId: string,
): Array<{ id: string; name: string }> {
  const key = `${ctx.projectId}::${chartId}`;
  const persons = ctx.personsByChart[key] ?? [];
  return persons.map((person) => ({
    id: person.id,
    name: person.name || '未命名',
  }));
}

export function mapContentJsonPersonMentionsForOutput(
  json: JSONContent,
  ctx: PersonMentionOutputContext,
): JSONContent {
  if (json.type === 'personMention' && json.attrs) {
    const chartId = String(json.attrs.chartId ?? '');
    const personId = String(json.attrs.personId ?? '');
    const fallbackName = String(json.attrs.fallbackName ?? '');
    const { text } = resolvePersonMentionLabel(
      { personId, fallbackName },
      lineagePeopleForChart(ctx, chartId),
    );
    return {
      ...json,
      attrs: {
        ...json.attrs,
        fallbackName: text,
      },
    };
  }

  if (json.content?.length) {
    return {
      ...json,
      content: json.content.map((child) =>
        mapContentJsonPersonMentionsForOutput(child, ctx),
      ),
    };
  }

  return json;
}