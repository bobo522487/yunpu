import {
  LUNAR_DAY_LABELS,
  LUNAR_MONTH_LABELS,
  TRADITIONAL_BRANCHES,
  getGanzhiForLunarYear,
} from './calendar-adapter';
import type {
  CalendarDatePoint,
  DatePrecision,
  DateTimeValue,
  GenealogyDate,
  GregorianParts,
  LunarParts,
  RegnalParts,
  SexagenaryParts,
} from './date.types';

const CHINESE_NUM_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function toTraditionalEraYearLabel(yearInEra: number): string {
  if (!Number.isInteger(yearInEra) || yearInEra <= 0) return String(yearInEra);
  if (yearInEra === 1) return '元';
  if (yearInEra < 10) return CHINESE_NUM_DIGITS[yearInEra];
  if (yearInEra === 10) return '十';
  if (yearInEra < 20) return `十${CHINESE_NUM_DIGITS[yearInEra % 10]}`;
  if (yearInEra < 100) {
    const tens = Math.floor(yearInEra / 10);
    const ones = yearInEra % 10;
    return `${CHINESE_NUM_DIGITS[tens]}十${ones > 0 ? CHINESE_NUM_DIGITS[ones] : ''}`;
  }
  return String(yearInEra);
}

export function formatLunarMonthLabel(month?: number | null, isLeapMonth?: boolean): string {
  if (!month) return '';
  const base = LUNAR_MONTH_LABELS[month] || `${month}月`;
  return isLeapMonth ? `闰${base}` : base;
}

export function formatLunarDayLabel(day?: number | null): string {
  if (!day) return '';
  return LUNAR_DAY_LABELS[day - 1] || `${day}日`;
}

export function formatDateTimeValue(time?: DateTimeValue | null): string {
  if (!time) return '';
  if (time.type === 'traditional_hour') {
    const found = TRADITIONAL_BRANCHES.find((b) => b.branch === time.branch);
    const base = found ? found.label : `${time.branch}时`;
    if (time.subPeriod === 'early') return `${base}初`;
    if (time.subPeriod === 'late') return `${base}正`;
    return base;
  }
  const hh = String(time.hour).padStart(2, '0');
  const mm = String(time.minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatGregorianPoint(
  parts: GregorianParts,
  precision: DatePrecision
): string {
  const yearText = parts.year < 0 ? `公元前${Math.abs(parts.year)}年` : `${parts.year}年`;
  if (precision === 'year' || !parts.month) return yearText;
  if (precision === 'month' || !parts.day) return `${yearText}${parts.month}月`;
  return `${yearText}${parts.month}月${parts.day}日`;
}

export function formatLunarPoint(
  parts: LunarParts,
  precision: DatePrecision
): string {
  const ganzhi = getGanzhiForLunarYear(parts.year);
  const yearLabel =
    parts.year < 0
      ? `农历公元前${Math.abs(parts.year)}年`
      : `农历${parts.year}${ganzhi ? ganzhi.cycleYear : ''}年`;
  if (precision === 'year' || !parts.month) return yearLabel;
  const monthLabel = formatLunarMonthLabel(parts.month, parts.isLeapMonth);
  if (precision === 'month' || !parts.day) return `${yearLabel}${monthLabel}`;
  const dayLabel = formatLunarDayLabel(parts.day);
  return `${yearLabel}${monthLabel}${dayLabel}`;
}

export function formatRegnalPoint(
  parts: RegnalParts,
  precision: DatePrecision
): string {
  const eraDisplay = parts.eraName.trim() || '未知年号';
  const yearLabel = `${eraDisplay}${toTraditionalEraYearLabel(parts.yearInEra)}年`;
  if (precision === 'year' || !parts.month) return yearLabel;
  if (parts.eraId === 'minguo' && !parts.isLeapMonth) {
    if (precision === 'month' || !parts.day) {
      return `${yearLabel}${parts.month}月`;
    }
    return `${yearLabel}${parts.month}月${parts.day}日`;
  }
  const monthLabel = formatLunarMonthLabel(parts.month, parts.isLeapMonth);
  if (precision === 'month' || !parts.day) return `${yearLabel}${monthLabel}`;
  const dayLabel = formatLunarDayLabel(parts.day);
  return `${yearLabel}${monthLabel}${dayLabel}`;
}

export function formatSexagenaryPoint(parts: SexagenaryParts): string {
  return `${parts.cycleYear}年`;
}

export function formatCalendarDatePoint(point: CalendarDatePoint): string {
  switch (point.calendar) {
    case 'gregorian':
      return formatGregorianPoint(point.parts, point.precision);
    case 'chinese_lunisolar':
      return formatLunarPoint(point.parts, point.precision);
    case 'regnal':
      return formatRegnalPoint(point.parts, point.precision);
    case 'sexagenary':
      return formatSexagenaryPoint(point.parts);
  }
}

export function formatGenealogyDate(value: GenealogyDate | null | undefined): string {
  if (!value) return '';

  const timeText = formatDateTimeValue(value.time);

  if (value.kind === 'phrase') {
    const base = value.originalText.trim();
    if (!base) return '';
    return timeText ? `${base} ${timeText}` : base;
  }

  if (value.kind === 'range') {
    const startText = formatCalendarDatePoint(value.start);
    const endText = formatCalendarDatePoint(value.end);
    const rangeText = `${startText}至${endText}`;
    return timeText ? `${rangeText} ${timeText}` : rangeText;
  }

  const point: CalendarDatePoint =
    value.calendar === 'gregorian'
      ? {
          calendar: 'gregorian',
          precision: value.precision,
          parts: value.parts as GregorianParts,
        }
      : value.calendar === 'chinese_lunisolar'
        ? {
            calendar: 'chinese_lunisolar',
            precision: value.precision,
            parts: value.parts as LunarParts,
          }
        : value.calendar === 'regnal'
          ? {
              calendar: 'regnal',
              precision: value.precision,
              parts: value.parts as RegnalParts,
            }
          : {
              calendar: 'sexagenary',
              precision: 'year',
              parts: value.parts as SexagenaryParts,
            };

  let core = formatCalendarDatePoint(point);

  if (value.qualifier === 'about') {
    core = `约${core}`;
  } else if (value.qualifier === 'before') {
    core = `${core}以前`;
  } else if (value.qualifier === 'after') {
    core = `${core}以后`;
  }

  if (timeText) {
    // Traditional Chinese dates attach 时辰 directly; Gregorian puts a space before HH:mm
    core =
      value.calendar === 'gregorian' && value.time?.type === 'clock'
        ? `${core} ${timeText}`
        : `${core}${timeText}`;
  }

  return core;
}
