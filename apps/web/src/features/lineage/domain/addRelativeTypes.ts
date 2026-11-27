import type { GenealogyDate } from '../../date-input';
import type { GenealogyPlace } from '../../place-input';
import type { PersonRecord, PersonRomanizedName, RelationKind } from '../types';

export type AddRelativeRelation = 'child' | 'spouse' | 'sibling' | 'parent';

export interface AddRelativeContext {
  relation: AddRelativeRelation;
  targetPerson: PersonRecord;
  defaultGender?: 'male' | 'female' | 'unknown';
  motherInfo?: { motherId?: string; motherName?: string };
  initiatedFrom?: 'father' | 'mother';
}

export interface AddRelativeSubmitPayload {
  surname?: string;
  name: string;
  romanizedName?: PersonRomanizedName;
  gender: 'male' | 'female' | 'unknown';
  status: 'living' | 'deceased';
  relationType?: RelationKind;
  fatherRelationType?: RelationKind;
  motherRelationType?: RelationKind;
  motherId?: string;
  motherName?: string;
  shouldAutoCreateMother?: boolean;
  birthDate?: GenealogyDate | null;
  birthPlace?: GenealogyPlace | null;
  deathDate?: GenealogyDate | null;
  deathPlace?: GenealogyPlace | null;
  deathCause?: string;
  burialPlace?: GenealogyPlace | null;
  marriageDate?: GenealogyDate | null;
  marriagePlace?: GenealogyPlace | null;
}
