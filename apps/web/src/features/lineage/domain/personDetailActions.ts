import type { PersonAliasRecord, PersonRecord } from '../types';
import {
  getPersonAliasItems,
  syncAliasesFromItems,
} from '../utils/personHelpers';

export type AliasEditContext = {
  mode: 'create' | 'edit';
  index?: number;
  initialAlias: PersonAliasRecord;
};

export function formatVitalGenderText(
  gender: PersonRecord['gender']
): string {
  if (gender === 'male') return '男';
  if (gender === 'female') return '女';
  return '未知';
}

export function applyAliasSave(
  person: PersonRecord,
  ctx: AliasEditContext,
  nextAlias: PersonAliasRecord
): Pick<PersonRecord, 'aliasItems' | 'aliases'> {
  const currentItems = getPersonAliasItems(person);
  const nextItems =
    ctx.mode === 'create'
      ? [...currentItems, nextAlias]
      : currentItems.map((it, idx) =>
          idx === ctx.index || it.id === ctx.initialAlias.id ? nextAlias : it
        );
  const syncedAliases = syncAliasesFromItems(nextItems);
  return {
    aliasItems: nextItems.length > 0 ? nextItems : undefined,
    aliases: syncedAliases.length > 0 ? syncedAliases : undefined,
  };
}

export function applyAliasDelete(
  person: PersonRecord,
  ctx: AliasEditContext
): Pick<PersonRecord, 'aliasItems' | 'aliases'> {
  const currentItems = getPersonAliasItems(person);
  const nextItems = currentItems.filter(
    (it, idx) => idx !== ctx.index && it.id !== ctx.initialAlias.id
  );
  const syncedAliases = syncAliasesFromItems(nextItems);
  return {
    aliasItems: nextItems.length > 0 ? nextItems : undefined,
    aliases: syncedAliases.length > 0 ? syncedAliases : undefined,
  };
}
