import { getPersonDateDisplay } from '../../date-input';
import { getPersonPlaceDisplay } from '../../place-input';
import type { PersonRecord } from '../types';
import {
  computeAutoRankLabel,
  formatPersonAliases,
  getPersonPrimaryTitle,
} from '../utils/personHelpers';

export function buildPersonSummary(
  p: PersonRecord,
  allPersons: PersonRecord[],
  childrenNames: string[],
  spouses: PersonRecord[],
  rank: string
): string {
  const parts: string[] = [];
  const aliasText = formatPersonAliases(p);
  if (aliasText) parts.push(`别名 ${aliasText}`);
  if (rank) parts.push(rank);
  const birthDisplay = getPersonDateDisplay(p, 'birth');
  if (birthDisplay) {
    parts.push(`生于${birthDisplay}`);
  }
  const primaryTitle = getPersonPrimaryTitle(p);
  if (primaryTitle) {
    parts.push(primaryTitle);
  }
  if (spouses.length > 0) {
    const spText = spouses
      .map((s) => {
        const rel = computeAutoRankLabel(s, allPersons) || '配';
        const fullName =
          s.surname?.trim() && !s.name.startsWith(s.surname.trim())
            ? `${s.surname.trim()}${s.name}`
            : s.name;
        const origin = s.notes?.trim() ? `（${s.notes.trim()}）` : '';
        return `${rel}${fullName}${origin}`;
      })
      .join('；');
    parts.push(spText);
  }
  const deathDisplay = getPersonDateDisplay(p, 'death');
  if (deathDisplay) {
    parts.push(`卒于${deathDisplay}`);
  }
  const burialPlaceText = getPersonPlaceDisplay(p, 'burial').trim();
  if (burialPlaceText) {
    parts.push(`葬${burialPlaceText}`);
  }
  if (p.biography) {
    parts.push(p.biography);
  }
  if (childrenNames.length > 0) {
    parts.push(`子：${childrenNames.join('、')}`);
  }
  return parts.filter(Boolean).join('。') || '谱系谱名录存录，待补行传。';
}