import type { GenealogyDate } from '../../date-input';
import type { PersonRecord, RelationKind } from '../types';
import { formatGivenName } from '../utils/nameUtils';
import { getDerivedSpouses } from '../utils/personHelpers';
import { extractYearLabel } from '../utils/personTimeline';

export type ChildRelationCategory =
  | 'biological'
  | 'adoptive_heir'
  | 'foster'
  | 'step';

export const UNKNOWN_MOTHER_KEY = '__unknown_mother__';

export interface MotherOption {
  key: string;
  id?: string;
  name: string;
  avatarUrl?: string;
  lifespan?: string;
  isAutoCreateUnknown?: boolean;
}

export function resolvePersonFullName(
  person: PersonRecord,
  clanSurname: string = ''
): string {
  const isSpouse = Boolean(person.spouseOfId);
  const effectiveSurname = isSpouse
    ? person.surname?.trim() || ''
    : person.surname?.trim() || clanSurname.trim();
  const given = isSpouse
    ? person.name.trim()
    : formatGivenName(person.name, effectiveSurname);

  if (effectiveSurname && given && !given.startsWith(effectiveSurname)) {
    return `${effectiveSurname}${given}`;
  }
  return given || effectiveSurname || '未命名';
}

function formatLifespanYear(structuredDate?: GenealogyDate | null): string {
  const label = extractYearLabel(structuredDate).trim();
  if (!label) return '';
  return /^-?\d+$/.test(label) ? `${label}年` : label;
}

export function formatPersonLifespan(p: PersonRecord): string {
  const birth = formatLifespanYear(p.birth?.structuredDate);
  const death =
    p.status === 'living'
      ? '存'
      : formatLifespanYear(p.death?.structuredDate) || '歿';

  if (birth) return `${birth}–${death}`;
  if (death !== '存' && death !== '歿') return `–${death}`;
  return death;
}

export function buildMotherOptionsForFather(
  father: PersonRecord,
  allPersons: PersonRecord[],
  clanSurname: string
): MotherOption[] {
  const nodeSpouses = getDerivedSpouses(allPersons, father.id);
  const rawOptions: MotherOption[] = nodeSpouses.map((sp) => ({
    key: sp.id,
    id: sp.id,
    name: resolvePersonFullName(sp, clanSurname),
    avatarUrl: sp.avatarUrl,
    lifespan: formatPersonLifespan(sp),
  }));

  const knownOptions = rawOptions.filter((opt) => opt.name !== '不详');
  const existingUnknown = rawOptions.find((opt) => opt.name === '不详');

  if (existingUnknown) {
    return [
      ...knownOptions,
      {
        ...existingUnknown,
        isAutoCreateUnknown: false,
      },
    ];
  }

  return [
    ...knownOptions,
    {
      key: UNKNOWN_MOTHER_KEY,
      id: undefined,
      name: '不详',
      isAutoCreateUnknown: true,
    },
  ];
}

export function resolveChildRelationValue(
  category: ChildRelationCategory,
  gender: 'male' | 'female' | 'unknown'
): RelationKind {
  switch (category) {
    case 'adoptive_heir':
      return '过继';
    case 'foster':
      return gender === 'female' ? '养女' : '养子';
    case 'step':
      return gender === 'female' ? '继女' : '继子';
    case 'biological':
    default:
      return gender === 'female' ? '生女' : '生子';
  }
}

export function getChildRelationSelectOptions(
  gender: 'male' | 'female' | 'unknown'
): Array<{ value: ChildRelationCategory; label: string }> {
  if (gender === 'female') {
    return [
      { value: 'biological', label: '生女' },
      { value: 'adoptive_heir', label: '过继 / 嗣女' },
      { value: 'foster', label: '养女' },
      { value: 'step', label: '继女' },
    ];
  }
  if (gender === 'male') {
    return [
      { value: 'biological', label: '生子' },
      { value: 'adoptive_heir', label: '过继 / 嗣子' },
      { value: 'foster', label: '养子' },
      { value: 'step', label: '继子' },
    ];
  }
  return [
    { value: 'biological', label: '生子女' },
    { value: 'adoptive_heir', label: '过继 / 嗣子' },
    { value: 'foster', label: '养子女' },
    { value: 'step', label: '继子女' },
  ];
}
