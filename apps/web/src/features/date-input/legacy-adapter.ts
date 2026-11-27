import type { PersonRecord } from '../lineage/types';
import { formatGenealogyDate } from './date-format';
import type { GenealogyDate } from './date.types';

export type PersonDateField = 'birth' | 'death' | 'burial';

/**
 * Single Source of Truth adapter for structuredDate / structuredBurialDate on PersonRecord.
 */
export function readGenealogyDate(
  person: Pick<PersonRecord, 'birth' | 'death'> | null | undefined,
  field: PersonDateField
): GenealogyDate | null {
  if (!person) return null;
  if (field === 'birth') return person.birth?.structuredDate ?? null;
  if (field === 'burial') return person.death?.structuredBurialDate ?? null;
  return person.death?.structuredDate ?? null;
}

export function writeGenealogyDate(
  person: PersonRecord,
  field: PersonDateField,
  value: GenealogyDate | null
): PersonRecord {
  if (field === 'birth') {
    return {
      ...person,
      birth: {
        ...(person.birth || {}),
        structuredDate: value ?? undefined,
      },
    };
  }

  if (field === 'burial') {
    return {
      ...person,
      death: {
        ...(person.death || {}),
        structuredBurialDate: value ?? undefined,
      },
    };
  }

  return {
    ...person,
    death: {
      ...(person.death || {}),
      structuredDate: value ?? undefined,
    },
  };
}

export function getPersonDateDisplay(
  person: Pick<PersonRecord, 'birth' | 'death'> | null | undefined,
  field: PersonDateField
): string {
  const structured = readGenealogyDate(person, field);
  return structured ? formatGenealogyDate(structured) : '';
}
