import type { GenealogyPlaceInput } from '@yunpu/shared';

export type GenealogyPlace = GenealogyPlaceInput;

export interface ClanPlaceStat {
  label: string;
  count: number;
  structuredPlace?: GenealogyPlace | null;
}

export interface PlaceSuggestionItem {
  id: string;
  kind: 'clan' | 'region' | 'phrase';
  primaryLabel: string;
  metaLabel: string;
  value: GenealogyPlace;
}
