import { formatGenealogyDate } from '../../date-input';
import {
  computeRegnalGregorianYear,
  normalizeDatePoint,
  resolveEraForRegnalParts,
} from '../../date-input/calendar-adapter';
import { toCalendarDatePoint } from '../../date-input/date-core';
import type {
  CalendarDatePoint,
  GenealogyDate,
} from '../../date-input/date.types';
import type { PersonRecord } from '../types';

export interface ComparableDateRange {
  start: number;
  end: number;
}

export function toSortableDateNumber(iso?: string | null): number | null {
  if (!iso) return null;
  const match = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}

function parseIsoYear(iso?: string | null): number | null {
  if (!iso) return null;
  const m = iso.match(/^(-?\d+)-/);
  if (!m) return null;
  const yr = parseInt(m[1], 10);
  return Number.isFinite(yr) ? yr : null;
}

function extractPointGregorianYear(point: CalendarDatePoint): number | null {
  const norm = normalizeDatePoint(point);
  const normYear = parseIsoYear(norm.start);
  if (normYear !== null) return normYear;

  if (
    point.calendar === 'gregorian' ||
    point.calendar === 'chinese_lunisolar'
  ) {
    if (
      typeof point.parts.year === 'number' &&
      Number.isFinite(point.parts.year)
    ) {
      return point.parts.year;
    }
  } else if (point.calendar === 'regnal') {
    const era = resolveEraForRegnalParts(point.parts);
    if (era) {
      return computeRegnalGregorianYear(era, point.parts.yearInEra);
    }
  }

  return null;
}

/**
 * Extract the representative Gregorian year from a GenealogyDate for sorting,
 * age calculation, and timeline display.
 */
export function extractGregorianYear(
  structuredDate?: GenealogyDate | null
): number | null {
  if (!structuredDate) return null;

  if (structuredDate.kind === 'date') {
    const normalizedYear = parseIsoYear(structuredDate.normalized?.start);
    if (normalizedYear !== null) return normalizedYear;
    return extractPointGregorianYear(toCalendarDatePoint(structuredDate));
  }

  if (structuredDate.kind === 'range') {
    return extractPointGregorianYear(structuredDate.start);
  }

  if (structuredDate.kind === 'phrase') {
    const m = structuredDate.originalText.match(/(?<!\d)(-?\d{4})(?!\d)/);
    if (m) return parseInt(m[1], 10);
  }

  return null;
}

export function getComparableDateRange(
  structuredDate?: GenealogyDate | null
): ComparableDateRange | null {
  if (!structuredDate) return null;

  if (structuredDate.kind === 'date') {
    if (structuredDate.normalized?.start) {
      const s = toSortableDateNumber(structuredDate.normalized.start);
      const e = toSortableDateNumber(
        structuredDate.normalized.end || structuredDate.normalized.start
      );
      if (s !== null && e !== null) return { start: s, end: e };
    }
    const pt = toCalendarDatePoint(structuredDate);
    const norm = normalizeDatePoint(pt);
    if (norm.start) {
      const s = toSortableDateNumber(norm.start);
      const e = toSortableDateNumber(norm.end || norm.start);
      if (s !== null && e !== null) return { start: s, end: e };
    }
    if (pt.calendar === 'regnal') {
      const era = resolveEraForRegnalParts(pt.parts);
      if (era) {
        const y = computeRegnalGregorianYear(era, pt.parts.yearInEra);
        return { start: y * 10000 + 101, end: y * 10000 + 1231 };
      }
    }
    return null;
  }

  if (structuredDate.kind === 'range') {
    const ns = normalizeDatePoint(structuredDate.start);
    const ne = normalizeDatePoint(structuredDate.end);
    const s = toSortableDateNumber(ns.start);
    const e = toSortableDateNumber(ne.end || ne.start);
    if (s !== null && e !== null) return { start: s, end: e };
    return null;
  }

  if (structuredDate.kind === 'phrase') {
    const m = structuredDate.originalText.match(/(?<!\d)(-?\d{4})(?!\d)/);
    if (m) {
      const y = parseInt(m[1], 10);
      return { start: y * 10000 + 101, end: y * 10000 + 1231 };
    }
  }

  return null;
}

export function getBirthComparableRange(
  person: Pick<PersonRecord, 'birth'>
): ComparableDateRange | null {
  return getComparableDateRange(person.birth?.structuredDate);
}

export function extractYearDisplay(
  structuredDate?: GenealogyDate | null
): string {
  const gy = extractGregorianYear(structuredDate);
  if (gy !== null) return String(gy);

  if (structuredDate) {
    if (structuredDate.kind === 'date' && structuredDate.calendar === 'regnal') {
      const p = structuredDate.parts as {
        eraName?: string;
        yearInEra?: number;
      };
      if (p.eraName) {
        return `${p.eraName}${p.yearInEra === 1 ? '元' : p.yearInEra || ''}年`;
      }
    }
    if (
      structuredDate.kind === 'date' &&
      structuredDate.calendar === 'sexagenary'
    ) {
      const p = structuredDate.parts as { cycleYear?: string };
      if (p.cycleYear) {
        return `${p.cycleYear}年`;
      }
    }
    const formatted = formatGenealogyDate(structuredDate).trim();
    if (formatted) return formatted;
  }

  return '';
}

export function extractYearLabel(
  structuredDate?: GenealogyDate | null
): string {
  if (!structuredDate) return '';
  if (structuredDate.kind === 'date') {
    if (
      structuredDate.calendar === 'gregorian' ||
      structuredDate.calendar === 'chinese_lunisolar'
    ) {
      const parts = structuredDate.parts as { year?: number };
      if (typeof parts.year === 'number' && Number.isFinite(parts.year)) {
        return String(parts.year);
      }
    }
    if (structuredDate.calendar === 'regnal') {
      const p = structuredDate.parts as {
        eraName?: string;
        yearInEra?: number;
      };
      if (p.eraName) {
        return `${p.eraName}${p.yearInEra === 1 ? '元' : p.yearInEra || ''}年`;
      }
    }
  }
  return extractYearDisplay(structuredDate);
}
