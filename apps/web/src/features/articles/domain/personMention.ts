import type { PersonRecord } from '../../lineage/types';

export interface MentionCandidate {
  personId: string;
  chartId: string;
  name: string;
  generation: number;
}

export function filterPersonMentions(query: string, people: MentionCandidate[]): MentionCandidate[] {
  const needle = query.trim().toLowerCase();
  const matched = needle
    ? people.filter((person) => person.name.toLowerCase().includes(needle))
    : people;
  return matched.slice(0, 8);
}

export function resolvePersonMentionLabel(
  attrs: { personId: string; fallbackName: string },
  people: Array<{ id: string; name: string }>,
): { text: string; missing: boolean } {
  const found = people.find((person) => person.id === attrs.personId);
  if (!found) return { text: attrs.fallbackName || '未命名', missing: true };
  return { text: found.name || attrs.fallbackName || '未命名', missing: false };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildBiographyMentionHtml(person: PersonRecord, chartId: string, summary: string): string {
  const name = person.name || '未命名';
  const safeName = escapeHtmlAttr(name);
  const safeSummary = escapeHtmlText(summary);
  return `<h2>生平概略</h2>
<p><span data-type="personMention" data-person-id="${escapeHtmlAttr(person.id)}" data-chart-id="${escapeHtmlAttr(chartId)}" data-fallback-name="${safeName}" data-generation="${person.generation}">${escapeHtmlText(name)}</span>，${safeSummary}</p>`;
}