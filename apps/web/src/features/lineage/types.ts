import type { GenealogyDate } from '../date-input/date.types';
import type { GenealogyPlace } from '../place-input/place.types';

export type RelationKind =
  | '生子'
  | '抚子'
  | '养子'
  | '继子'
  | '赘子'
  | '义子'
  | '出继'
  | '出嗣'
  | '承嗣'
  | '出祧'
  | '兼祧'
  | '出绍'
  | '过继'
  | '承继'
  | '奉祀'
  | '无(断代)'
  | '生女'
  | '继女'
  | '养女'
  | string;

export interface PersonBirthInfo {
  structuredDate?: GenealogyDate | null;
  structuredPlace?: GenealogyPlace | null;
  summary?: string;
}


export interface PersonDeathInfo {
  structuredDate?: GenealogyDate | null;
  structuredPlace?: GenealogyPlace | null;
  structuredBurialDate?: GenealogyDate | null;
  structuredBurialPlace?: GenealogyPlace | null;
  cause?: string;
  summary?: string;
  /** Manual lifespan override used only when birth/death dates cannot yield an age */
  manualAge?: number;
}

export interface PersonRomanizedName {
  surname?: string;
  name?: string;
  suffix?: string;
}

export type PersonAliasType =
  | '字'
  | '号'
  | '曾用名'
  | '乳名'
  | '谱名'
  | '谥号'
  | '其他';

export interface PersonAliasRecord {
  id: string;
  type?: PersonAliasType | string;
  surname?: string;
  name: string;
  romanizedName?: PersonRomanizedName;
}

export interface PersonSequenceMeta {
  mainLabel?: string;
  mainNumber?: number;
  subLabel?: string;
  subNumber?: number;
  originalPage?: number;
}

export interface PersonPrivateInfo {
  idCardNum?: string;
  mobile?: string;
  address?: string;
}

export type PersonEventType =
  | 'birth'
  | 'education'
  | 'career'
  | 'marriage'
  | 'residence'
  | 'death'
  | 'other';

export interface PersonLifeEvent {
  id: string;
  type: PersonEventType;
  structuredDate?: GenealogyDate | null;
  structuredPlace?: GenealogyPlace | null;
  description?: string;
}

/**
 * Canonical Single-Source-of-Truth PersonRecord.
 * - Spouses are standard PersonRecord nodes linked via `spouseOfId` + `siblingOrder`.
 * - Derived labels (rank, spouse sequence label, parent names, full display name,
 *   formatted dates/places, computed age, primary title) are computed on read.
 */
export interface PersonRecord {
  id: string;
  branchId: string;

  // 1. Core Identity & Names
  avatarUrl?: string;
  avatarOriginalUrl?: string;
  avatarPhotos?: string[];
  surname?: string;
  name: string;
  nameSuffix?: string;
  romanizedName?: PersonRomanizedName;
  legalName?: string;
  aliases?: string[];
  aliasItems?: PersonAliasRecord[];
  childhoodName?: string;
  gender: 'male' | 'female' | 'unknown';
  status: 'living' | 'deceased';

  // 2. Lineage Graph & Kinship
  generation: number;
  generationWord?: string;
  hangOrder?: string;
  siblingOrder?: number;
  fatherId: string | null;
  motherId?: string;
  spouseOfId?: string;
  relationType?: RelationKind;
  fatherRelationType?: RelationKind;
  motherRelationType?: RelationKind;
  relationTitle?: string;
  relationPrefix?: string;
  relationNotes?: string;
  lineageRemarks?: string;
  branchLabel?: string;
  headingLine?: string;

  // 3. Cohesive Lifecycle Data
  birth?: PersonBirthInfo;
  death?: PersonDeathInfo;
  events?: PersonLifeEvent[];
  sequenceMeta?: PersonSequenceMeta;
  privateInfo?: PersonPrivateInfo;

  // 4. Biography & Archival Notes
  biography?: string;
  biographyOrder?: number;
  notes?: string;
}

export type LineageViewMode = 'tree' | 'biography' | 'grid' | 'table';

export type DrawerLayoutMode = 'narrow' | 'wide';

export interface BiographyPreviewPreferences {
  showBirth: boolean;
  showBirthDetail: boolean;
  showLife: boolean;
  showDeath: boolean;
  showDeathDetail: boolean;
  showBiography: boolean;
  showChildren: boolean;
  showRemarks: boolean;
  showPrivateInfo: boolean;
}
