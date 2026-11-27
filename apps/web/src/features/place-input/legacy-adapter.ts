import type { PersonRecord } from '../lineage/types';
import {
  formatGenealogyPlace,
  getAllPlaceCountries,
  isPlaceholderCityName,
  matchRegionFromText,
  normalizePlaceSearchText,
  stripAdminSuffix,
} from './place-core';
import type { GenealogyPlace } from './place.types';

export type PersonPlaceField = 'birth' | 'death' | 'burial';

function matchAdminSegment(candidateName: string, inputSeg: string): boolean {
  const normCand = normalizePlaceSearchText(candidateName);
  const normInput = normalizePlaceSearchText(inputSeg);
  if (!normCand || !normInput) return false;
  if (normCand === normInput) return true;
  const candShort = normalizePlaceSearchText(stripAdminSuffix(candidateName));
  const inputShort = normalizePlaceSearchText(stripAdminSuffix(inputSeg));
  return Boolean(candShort && inputShort && candShort === inputShort);
}

/**
 * Parse a legacy or API text string (e.g. '江西省/九江市/德安县', '美国/加利福尼亚/旧金山',
 * or archival text '庐陵郡太和县南溪里') into a canonical GenealogyPlace with standard codes.
 */
export function parsePlaceText(
  raw: string | GenealogyPlace | null | undefined
): GenealogyPlace | null {
  if (!raw) return null;
  if (typeof raw === 'object') {
    return raw;
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const directMatch = matchRegionFromText(trimmed);
  if (directMatch) {
    return directMatch;
  }

  if (trimmed.includes('/')) {
    const segments = trimmed
      .split('/')
      .map((s) => s.trim())
      .filter((s) => Boolean(s) && !isPlaceholderCityName(s));

    if (segments.length > 0) {
      const countries = getAllPlaceCountries();
      let idx = 0;
      let country = countries.find((c) => matchAdminSegment(c.name, segments[0]));
      if (country) {
        idx = 1;
      } else {
        country = countries.find((c) => c.code === 'CN') || countries[0];
      }

      if (idx === segments.length && country) {
        return {
          schemaVersion: 1,
          kind: 'structured',
          countryCode: country.code,
          country: country.name,
          originalText: null,
        };
      }

      const provSeg = segments[idx];
      const prov = provSeg
        ? country?.provinces.find((p) => matchAdminSegment(p.name, provSeg))
        : undefined;

      if (prov) {
        idx += 1;
        if (idx === segments.length) {
          return {
            schemaVersion: 1,
            kind: 'structured',
            countryCode: country.code,
            country: country.name,
            provinceCode: prov.code,
            province: prov.name,
            originalText: null,
          };
        }

        const nextSeg = segments[idx];
        const selectableCities = prov.cities.filter(
          (c) => !c.isInternalHolder && !isPlaceholderCityName(c.name)
        );
        const cityMatch = selectableCities.find((c) =>
          matchAdminSegment(c.name, nextSeg)
        );

        if (cityMatch) {
          idx += 1;
          if (idx === segments.length) {
            return {
              schemaVersion: 1,
              kind: 'structured',
              countryCode: country.code,
              country: country.name,
              provinceCode: prov.code,
              province: prov.name,
              cityCode: cityMatch.code,
              city: cityMatch.name,
              originalText: null,
            };
          }
          if (idx === segments.length - 1) {
            const distMatch = cityMatch.districts.find((d) =>
              matchAdminSegment(d.name, segments[idx])
            );
            if (distMatch) {
              return {
                schemaVersion: 1,
                kind: 'structured',
                countryCode: country.code,
                country: country.name,
                provinceCode: prov.code,
                province: prov.name,
                cityCode: cityMatch.code,
                city: cityMatch.name,
                districtCode: distMatch.code,
                district: distMatch.name,
                originalText: null,
              };
            }
          }
        } else if (idx === segments.length - 1) {
          const placeholderDistricts = prov.cities
            .filter((c) => c.isInternalHolder || isPlaceholderCityName(c.name))
            .flatMap((c) => c.districts);
          const distMatch = placeholderDistricts.find((d) =>
            matchAdminSegment(d.name, nextSeg)
          );
          if (distMatch) {
            return {
              schemaVersion: 1,
              kind: 'structured',
              countryCode: country.code,
              country: country.name,
              provinceCode: prov.code,
              province: prov.name,
              districtCode: distMatch.code,
              district: distMatch.name,
              originalText: null,
            };
          }
        }
      }
    }
  }

  return {
    schemaVersion: 1,
    kind: 'phrase',
    originalText: trimmed,
  };
}

export function readGenealogyPlace(
  person: Pick<PersonRecord, 'birth' | 'death'> | null | undefined,
  field: PersonPlaceField
): GenealogyPlace | null {
  if (!person) return null;

  return field === 'birth'
    ? (person.birth?.structuredPlace ?? null)
    : field === 'burial'
      ? (person.death?.structuredBurialPlace ?? null)
      : (person.death?.structuredPlace ?? null);
}

export function writeGenealogyPlace(
  person: PersonRecord,
  field: PersonPlaceField,
  nextPlace: GenealogyPlace | null
): PersonRecord {
  if (field === 'birth') {
    return {
      ...person,
      birth: {
        ...(person.birth || {}),
        structuredPlace: nextPlace ?? undefined,
      },
    };
  }

  if (field === 'burial') {
    return {
      ...person,
      death: {
        ...(person.death || {}),
        structuredBurialPlace: nextPlace ?? undefined,
      },
    };
  }

  return {
    ...person,
    death: {
      ...(person.death || {}),
      structuredPlace: nextPlace ?? undefined,
    },
  };
}

export function getPersonPlaceDisplay(
  person: Pick<PersonRecord, 'birth' | 'death'> | null | undefined,
  field: PersonPlaceField
): string {
  const structured = readGenealogyPlace(person, field);
  return structured ? formatGenealogyPlace(structured) : '';
}
