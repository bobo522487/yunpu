import type { PersonAliasRecord, PersonRecord } from '../types';

export const ALIAS_TYPE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: '', label: '未指定' },
  { value: '字', label: '字' },
  { value: '号', label: '号' },
  { value: '曾用名', label: '曾用名' },
  { value: '乳名', label: '乳名' },
  { value: '谱名', label: '谱名' },
  { value: '谥号', label: '谥号' },
  { value: '其他', label: '其他' },
];

export function getPersonAliases(
  person: Pick<PersonRecord, 'aliases'> | null | undefined
): string[] {
  if (!person?.aliases?.length) return [];
  return Array.from(
    new Set(person.aliases.map((item) => item.trim()).filter(Boolean))
  );
}

export function formatAliasItemDisplayName(
  item: Pick<PersonAliasRecord, 'surname' | 'name'>
): string {
  return [item.surname?.trim(), item.name?.trim()].filter(Boolean).join('');
}

export function formatAliasItemRomanized(
  item: Pick<PersonAliasRecord, 'romanizedName'>
): string {
  return [
    item.romanizedName?.surname?.trim(),
    item.romanizedName?.name?.trim(),
    item.romanizedName?.suffix?.trim(),
  ]
    .filter(Boolean)
    .join(' ');
}

export function formatAliasItemToSummaryString(
  item: PersonAliasRecord
): string {
  const fullName = formatAliasItemDisplayName(item);
  if (!fullName) return '';
  const type = item.type?.trim();
  if ((type === '字' || type === '号') && !fullName.startsWith(type)) {
    return `${type}${fullName}`;
  }
  return fullName;
}

export function normalizeAliasItems(
  items: PersonAliasRecord[] | undefined
): PersonAliasRecord[] {
  if (!items?.length) return [];
  const result: PersonAliasRecord[] = [];
  items.forEach((item, idx) => {
    const surname = item.surname?.trim() || undefined;
    const name = item.name?.trim() || '';
    if (!surname && !name) return;
    const type = item.type?.trim() || undefined;
    const rSur = item.romanizedName?.surname?.trim() || undefined;
    const rNam = item.romanizedName?.name?.trim() || undefined;
    const rSuf = item.romanizedName?.suffix?.trim() || undefined;
    const romanizedName =
      rSur || rNam || rSuf
        ? {
            ...(rSur ? { surname: rSur } : {}),
            ...(rNam ? { name: rNam } : {}),
            ...(rSuf ? { suffix: rSuf } : {}),
          }
        : undefined;
    result.push({
      id: item.id?.trim() || `alias-${idx + 1}`,
      ...(type ? { type } : {}),
      ...(surname ? { surname } : {}),
      name: name || surname || '',
      ...(romanizedName ? { romanizedName } : {}),
    });
  });
  return result;
}

export function syncAliasesFromItems(items: PersonAliasRecord[]): string[] {
  return Array.from(
    new Set(
      items.map((item) => formatAliasItemToSummaryString(item)).filter(Boolean)
    )
  );
}

const KNOWN_ALIAS_PREFIXES = ['字', '号'] as const;

export function parseLegacyAliasString(
  raw: string,
  index: number
): PersonAliasRecord {
  const trimmed = raw.trim();
  for (const prefix of KNOWN_ALIAS_PREFIXES) {
    if (trimmed.startsWith(prefix) && trimmed.length > prefix.length) {
      const rest = trimmed
        .slice(prefix.length)
        .replace(/^[:：\s]+/, '')
        .trim();
      if (rest) {
        return {
          id: `legacy-alias-${index}`,
          type: prefix,
          name: rest,
        };
      }
    }
  }
  return {
    id: `legacy-alias-${index}`,
    name: trimmed,
  };
}

export function getPersonAliasItems(
  person: Pick<PersonRecord, 'aliasItems' | 'aliases'> | null | undefined
): PersonAliasRecord[] {
  if (!person) return [];
  const normalized = normalizeAliasItems(person.aliasItems);
  if (normalized.length > 0) return normalized;
  if (person.aliasItems !== undefined) return [];
  const legacyList = getPersonAliases(person);
  return legacyList.map((raw, idx) => parseLegacyAliasString(raw, idx));
}

export function formatPersonAliases(
  person: Pick<PersonRecord, 'aliases' | 'aliasItems'> | null | undefined
): string {
  const items = normalizeAliasItems(person?.aliasItems);
  if (items.length > 0) {
    return syncAliasesFromItems(items).join('、');
  }
  return getPersonAliases(person).join('、');
}

export function parseAliasInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[、,，;；\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}
