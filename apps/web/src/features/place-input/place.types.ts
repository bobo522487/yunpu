export interface GenealogyPlace {
  schemaVersion: 1;
  kind: 'structured' | 'phrase';
  /** ISO 3166-1 alpha-2 country/region code, e.g. 'CN', 'US', 'JP' */
  countryCode?: string;
  country?: string;
  /** GB/T 2260 6-digit code (CN mainland/SAR) or ISO 3166-2 subdivision code */
  provinceCode?: string;
  province?: string;
  /** GB/T 2260 6-digit code or ISO/UN-LOCODE subdivision code */
  cityCode?: string;
  city?: string;
  /** GB/T 2260 6-digit code or official municipal district code */
  districtCode?: string;
  district?: string;
  originalText?: string | null;
}

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
