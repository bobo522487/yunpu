import {
  SIXTY_JIAZI,
  TRADITIONAL_BRANCHES,
  compareDatePoints,
  computeRegnalGregorianYear,
  getGanzhiForLunarYear,
  getGanzhiForSolarDate,
  getLunarYearInfo,
  gregorianToLunarParts,
  isValidGregorianDate,
  lunarToGregorianParts,
  normalizeDatePoint,
  resolveEraForRegnalParts,
} from './calendar-adapter';
import type {
  CalendarDatePoint,
  CalendarType,
  DatePrecision,
  DateTimeValue,
  GenealogyDate,
  GregorianParts,
  LunarParts,
  RegnalParts,
  SexagenaryParts,
} from './date.types';
import { REIGN_ERAS, findEraById, findEraByName } from './era-data';

export const MAX_ORIGINAL_TEXT_LENGTH = 300;

export interface DateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function createDefaultPoint(
  calendar: CalendarType,
  yearHint?: number
): CalendarDatePoint {
  const defaultYear = yearHint ?? new Date().getFullYear();
  switch (calendar) {
    case 'gregorian':
      return {
        calendar: 'gregorian',
        precision: 'day',
        parts: { year: defaultYear, month: 1, day: 1 },
      };
    case 'chinese_lunisolar':
      return {
        calendar: 'chinese_lunisolar',
        precision: 'day',
        parts: { year: defaultYear, month: 1, isLeapMonth: false, day: 1 },
      };
    case 'regnal':
      return {
        calendar: 'regnal',
        precision: 'year',
        parts: {
          dynastyId: 'qing',
          eraId: 'guangxu',
          eraName: '光绪',
          yearInEra: 1,
          month: null,
          isLeapMonth: false,
          day: null,
        },
      };
    case 'sexagenary':
      return {
        calendar: 'sexagenary',
        precision: 'year',
        parts: {
          cycleYear: '甲子',
          cycleIndex: 0,
          basis: 'lunar_new_year',
        },
      };
  }
}

export function createDefaultGenealogyDate(
  calendar: CalendarType = 'gregorian'
): GenealogyDate {
  const pt = createDefaultPoint(calendar);
  return {
    schemaVersion: 1,
    kind: 'date',
    calendar: pt.calendar,
    qualifier: 'exact',
    precision: pt.precision,
    parts: pt.parts,
    time: null,
    originalText: null,
    normalized: null,
  };
}

export function cloneGenealogyDate(value: GenealogyDate): GenealogyDate {
  return JSON.parse(JSON.stringify(value)) as GenealogyDate;
}

export function toCalendarDatePoint(
  date: Extract<GenealogyDate, { kind: 'date' }>
): CalendarDatePoint {
  switch (date.calendar) {
    case 'gregorian':
      return {
        calendar: 'gregorian',
        precision: date.precision,
        parts: date.parts as GregorianParts,
      };
    case 'chinese_lunisolar':
      return {
        calendar: 'chinese_lunisolar',
        precision: date.precision,
        parts: date.parts as LunarParts,
      };
    case 'regnal':
      return {
        calendar: 'regnal',
        precision: date.precision,
        parts: date.parts as RegnalParts,
      };
    case 'sexagenary':
      return {
        calendar: 'sexagenary',
        precision: 'year',
        parts: date.parts as SexagenaryParts,
      };
  }
}

export function derivePrecisionFromParts(
  month?: number | null,
  day?: number | null
): DatePrecision {
  if (!month) return 'year';
  if (!day) return 'month';
  return 'day';
}

export function stripPrecisionParts(point: CalendarDatePoint): CalendarDatePoint {
  if (point.calendar === 'sexagenary') {
    return { ...point, precision: 'year' };
  }
  if (point.precision === 'year') {
    if (point.calendar === 'gregorian') {
      return { ...point, parts: { year: point.parts.year, month: null, day: null } };
    }
    if (point.calendar === 'chinese_lunisolar') {
      return {
        ...point,
        parts: { year: point.parts.year, month: null, isLeapMonth: false, day: null },
      };
    }
    return {
      ...point,
      parts: { ...point.parts, month: null, isLeapMonth: false, day: null },
    };
  }
  if (point.precision === 'month') {
    if (point.calendar === 'gregorian') {
      return {
        ...point,
        parts: { year: point.parts.year, month: point.parts.month ?? 1, day: null },
      };
    }
    if (point.calendar === 'chinese_lunisolar') {
      return {
        ...point,
        parts: {
          year: point.parts.year,
          month: point.parts.month ?? 1,
          isLeapMonth: Boolean(point.parts.isLeapMonth),
          day: null,
        },
      };
    }
    return {
      ...point,
      parts: {
        ...point.parts,
        month: point.parts.month ?? 1,
        isLeapMonth: Boolean(point.parts.isLeapMonth),
        day: null,
      },
    };
  }
  return point;
}

function validateTimeValue(time: DateTimeValue | null | undefined, errors: string[]): void {
  if (!time) return;
  if (time.type === 'traditional_hour') {
    const exists = TRADITIONAL_BRANCHES.some((b) => b.branch === time.branch);
    if (!exists) errors.push('请选择合法的十二时辰。');
    return;
  }
  if (time.type === 'clock') {
    if (
      !Number.isInteger(time.hour) ||
      time.hour < 0 ||
      time.hour > 23 ||
      !Number.isInteger(time.minute) ||
      time.minute < 0 ||
      time.minute > 59
    ) {
      errors.push('具体时间的小时需在 0–23，分钟需在 0–59 之间。');
    }
    return;
  }
  errors.push('不支持的时间格式。');
}

function validateCalendarDatePoint(
  point: CalendarDatePoint,
  labelPrefix: string,
  errors: string[],
  warnings: string[]
): void {
  if (point.calendar === 'gregorian') {
    const { year, month, day } = point.parts;
    if (!Number.isInteger(year) || year === 0 || year < -3000 || year > 9999) {
      errors.push(`${labelPrefix}公历年份必须是 -3000 至 9999 之间的非零整数。`);
      return;
    }
    if (point.precision === 'year') {
      if (month !== null && month !== undefined) {
        errors.push(`${labelPrefix}仅年份精度下不应包含月份。`);
      }
      return;
    }
    if (!Number.isInteger(month) || !month || month < 1 || month > 12) {
      errors.push(`${labelPrefix}请选择 1–12 月。`);
      return;
    }
    if (point.precision === 'month') {
      if (day !== null && day !== undefined) {
        errors.push(`${labelPrefix}年月精度下不应包含日期。`);
      }
      return;
    }
    if (!Number.isInteger(day) || !day || !isValidGregorianDate(year, month, day)) {
      errors.push(
        year === 1582 && month === 10 && day && day >= 5 && day <= 14
          ? `${labelPrefix}1582年10月5日–14日因历法切换在历史上不存在。`
          : `${labelPrefix}公历 ${year}年${month}月${day ?? ''}日 不是合法日期。`
      );
    }
    return;
  }

  if (point.calendar === 'chinese_lunisolar') {
    const { year, month, isLeapMonth, day } = point.parts;
    if (!Number.isInteger(year) || year === 0 || year < -3000 || year > 9999) {
      errors.push(`${labelPrefix}农历年份必须是合法非零整数。`);
      return;
    }
    if (point.precision === 'year') return;

    if (!Number.isInteger(month) || !month || month < 1 || month > 12) {
      errors.push(`${labelPrefix}请选择合法农历月份。`);
      return;
    }

    const yearInfo = getLunarYearInfo(year);
    if (yearInfo.supported) {
      const matched = yearInfo.months.find(
        (m) => m.month === month && m.isLeapMonth === Boolean(isLeapMonth)
      );
      if (!matched) {
        errors.push(
          `${labelPrefix}农历 ${year} 年不存在${isLeapMonth ? '闰' : ''}${month}月。`
        );
        return;
      }
      if (point.precision === 'day') {
        if (!Number.isInteger(day) || !day || day < 1 || day > matched.days) {
          errors.push(
            `${labelPrefix}该农历月只有 ${matched.days} 天，所选日期超出范围。`
          );
        }
      }
    } else {
      warnings.push(`${labelPrefix}年份超出历法引擎精确校验范围，将按原始结构保存。`);
      if (point.precision === 'day' && (!Number.isInteger(day) || !day || day < 1 || day > 30)) {
        errors.push(`${labelPrefix}农历日期必须在 初一 至 三十 之间。`);
      }
    }
    return;
  }

  if (point.calendar === 'regnal') {
    const { eraId, eraName, yearInEra, month, isLeapMonth, day } = point.parts;
    if (!eraName.trim()) {
      errors.push(`${labelPrefix}请填写或选择年号名称。`);
      return;
    }
    if (!Number.isInteger(yearInEra) || yearInEra < 1 || yearInEra > 200) {
      errors.push(`${labelPrefix}年号年次必须是 1–200 之间的正整数。`);
      return;
    }
    const era = findEraById(eraId) || findEraByName(eraName);
    if (era && yearInEra > era.maxYear) {
      warnings.push(
        `${labelPrefix}「${era.eraName}」史载常规最大年次为 ${era.maxYear} 年，请核实是否为沿用旧号。`
      );
    }
    if (point.precision !== 'year') {
      if (!Number.isInteger(month) || !month || month < 1 || month > 12) {
        errors.push(`${labelPrefix}请选择历史月份（1–12月）。`);
        return;
      }
      if (point.precision === 'day') {
        if (!Number.isInteger(day) || !day || day < 1 || day > 30) {
          errors.push(`${labelPrefix}历史日期必须在 初一 至 三十 之间。`);
        }
      }
      if (era && era.conversionStatus === 'verified' && era.id !== 'minguo') {
        const mappedYear = era.startYear + (yearInEra - 1);
        const yearInfo = getLunarYearInfo(mappedYear);
        if (yearInfo.supported && isLeapMonth && yearInfo.leapMonth !== month) {
          warnings.push(
            `${labelPrefix}${era.eraName}${yearInEra}年按现代推算闰${yearInfo.leapMonth ? `${yearInfo.leapMonth}月` : '无月'}，若原谱确有记录可继续保留原文。`
          );
        }
      }
    }
    return;
  }

  if (point.calendar === 'sexagenary') {
    const { cycleYear, cycleIndex, basis } = point.parts;
    if (!SIXTY_JIAZI.includes(cycleYear)) {
      errors.push(`${labelPrefix}请选择合法的六十甲子干支年份。`);
      return;
    }
    if (SIXTY_JIAZI[cycleIndex] !== cycleYear) {
      errors.push(`${labelPrefix}干支名称与六十甲子编码不一致。`);
      return;
    }
    if (basis !== 'lunar_new_year' && basis !== 'lichun') {
      errors.push(`${labelPrefix}必须明确干支换年依据（春节或立春）。`);
    }
  }
}

export function validateGenealogyDate(date: GenealogyDate | null | undefined): DateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!date) {
    return { valid: true, errors, warnings };
  }

  if (date.schemaVersion !== 1) {
    errors.push('不支持的日期数据版本。');
  }

  if (date.originalText && date.originalText.length > MAX_ORIGINAL_TEXT_LENGTH) {
    errors.push(`原始记载文本不得超过 ${MAX_ORIGINAL_TEXT_LENGTH} 个字符。`);
  }

  validateTimeValue(date.time, errors);

  if (date.kind === 'phrase') {
    if (!date.originalText?.trim()) {
      errors.push('仅原始记载模式下，请填写原始日期文本。');
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  if (date.kind === 'range') {
    validateCalendarDatePoint(date.start, '开始日期：', errors, warnings);
    validateCalendarDatePoint(date.end, '结束日期：', errors, warnings);
    if (errors.length === 0) {
      const cmp = compareDatePoints(date.start, date.end);
      if (cmp !== null && cmp > 0) {
        errors.push('开始日期不能晚于结束日期。');
      } else if (cmp === null) {
        warnings.push('部分历史区间端点的公历日期尚无法精确对比，将保留用户输入的起止顺序。');
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  if (date.kind === 'date') {
    const point = toCalendarDatePoint(date);
    validateCalendarDatePoint(point, '', errors, warnings);
    return { valid: errors.length === 0, errors, warnings };
  }

  errors.push('未知日期结构类型。');
  return { valid: false, errors, warnings };
}

export function finalizeGenealogyDate(draft: GenealogyDate): GenealogyDate {
  if (draft.kind === 'phrase') {
    return {
      schemaVersion: 1,
      kind: 'phrase',
      originalText: draft.originalText.trim(),
      calendarHint: draft.calendarHint ?? null,
      time: draft.time ?? null,
    };
  }

  if (draft.kind === 'range') {
    return {
      schemaVersion: 1,
      kind: 'range',
      start: stripPrecisionParts(draft.start),
      end: stripPrecisionParts(draft.end),
      time: draft.time ?? null,
      originalText: draft.originalText?.trim() || null,
    };
  }

  const cleanedPoint = stripPrecisionParts(toCalendarDatePoint(draft));
  const normalized = normalizeDatePoint(cleanedPoint);

  return {
    schemaVersion: 1,
    kind: 'date',
    calendar: cleanedPoint.calendar,
    qualifier: draft.qualifier,
    precision: cleanedPoint.precision,
    parts: cleanedPoint.parts,
    time: draft.time ?? null,
    originalText: draft.originalText?.trim() || null,
    normalized,
  };
}

function parseIsoYmd(iso?: string): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const m = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

function extractReferenceYear(point: CalendarDatePoint): number | null {
  if (point.calendar === 'gregorian') {
    return point.parts.year && point.parts.year !== 0 ? point.parts.year : null;
  }
  if (point.calendar === 'chinese_lunisolar') {
    return point.parts.year && point.parts.year !== 0 ? point.parts.year : null;
  }
  if (point.calendar === 'regnal') {
    const era = resolveEraForRegnalParts(point.parts);
    if (!era) return null;
    return computeRegnalGregorianYear(era, point.parts.yearInEra);
  }
  return null;
}

export function convertCalendarPoint(
  source: CalendarDatePoint,
  targetCalendar: CalendarType
): { point: CalendarDatePoint; carried: boolean } {
  const cleaned = stripPrecisionParts(source);
  if (cleaned.calendar === targetCalendar) {
    return { point: cleaned, carried: true };
  }

  // Target: Gregorian
  if (targetCalendar === 'gregorian') {
    if (cleaned.calendar === 'chinese_lunisolar') {
      const { year, month, isLeapMonth, day } = cleaned.parts;
      if (month && day) {
        const greg = lunarToGregorianParts(cleaned.parts);
        if (greg) {
          return {
            point: { calendar: 'gregorian', precision: 'day', parts: greg },
            carried: true,
          };
        }
      }
      if (month) {
        const firstDay = lunarToGregorianParts({
          year,
          month,
          isLeapMonth,
          day: 1,
        });
        if (firstDay) {
          return {
            point: {
              calendar: 'gregorian',
              precision: 'month',
              parts: { year: firstDay.year, month: firstDay.month, day: null },
            },
            carried: true,
          };
        }
        return {
          point: {
            calendar: 'gregorian',
            precision: 'month',
            parts: { year, month, day: null },
          },
          carried: true,
        };
      }
      if (year && year !== 0) {
        return {
          point: {
            calendar: 'gregorian',
            precision: 'year',
            parts: { year, month: null, day: null },
          },
          carried: true,
        };
      }
    }

    if (cleaned.calendar === 'regnal') {
      const norm = normalizeDatePoint(cleaned);
      if (norm.status === 'exact' && norm.start) {
        const ymd = parseIsoYmd(norm.start);
        if (ymd) {
          return {
            point: { calendar: 'gregorian', precision: 'day', parts: ymd },
            carried: true,
          };
        }
      }
      const refYear = extractReferenceYear(cleaned);
      if (refYear !== null) {
        const era = resolveEraForRegnalParts(cleaned.parts);
        if (era?.id === 'minguo' && cleaned.parts.month) {
          const month = cleaned.parts.month;
          const day = cleaned.parts.day ?? null;
          const validDay =
            day && isValidGregorianDate(refYear, month, day) ? day : null;
          return {
            point: {
              calendar: 'gregorian',
              precision: derivePrecisionFromParts(month, validDay),
              parts: { year: refYear, month, day: validDay },
            },
            carried: true,
          };
        }
        return {
          point: {
            calendar: 'gregorian',
            precision: 'year',
            parts: { year: refYear, month: null, day: null },
          },
          carried: true,
        };
      }
    }

    return { point: createDefaultPoint('gregorian'), carried: false };
  }

  // Target: Chinese Lunisolar
  if (targetCalendar === 'chinese_lunisolar') {
    if (cleaned.calendar === 'gregorian') {
      const { year, month, day } = cleaned.parts;
      if (month && day) {
        const lunar = gregorianToLunarParts(cleaned.parts);
        if (lunar) {
          return {
            point: { calendar: 'chinese_lunisolar', precision: 'day', parts: lunar },
            carried: true,
          };
        }
      }
      if (month) {
        return {
          point: {
            calendar: 'chinese_lunisolar',
            precision: 'month',
            parts: { year, month, isLeapMonth: false, day: null },
          },
          carried: true,
        };
      }
      if (year && year !== 0) {
        return {
          point: {
            calendar: 'chinese_lunisolar',
            precision: 'year',
            parts: { year, month: null, isLeapMonth: false, day: null },
          },
          carried: true,
        };
      }
    }

    if (cleaned.calendar === 'regnal') {
      const era = resolveEraForRegnalParts(cleaned.parts);
      const refYear = extractReferenceYear(cleaned);
      if (era?.id === 'minguo' && refYear !== null && cleaned.parts.month && cleaned.parts.day) {
        const lunar = gregorianToLunarParts({
          year: refYear,
          month: cleaned.parts.month,
          day: cleaned.parts.day,
        });
        if (lunar) {
          return {
            point: { calendar: 'chinese_lunisolar', precision: 'day', parts: lunar },
            carried: true,
          };
        }
      }
      if (refYear !== null) {
        const yearInfo = getLunarYearInfo(refYear);
        const month = cleaned.parts.month ?? null;
        let isLeapMonth = Boolean(month && cleaned.parts.isLeapMonth);
        let day = cleaned.parts.day ?? null;
        if (month && yearInfo.supported) {
          let matched = yearInfo.months.find(
            (m) => m.month === month && m.isLeapMonth === isLeapMonth
          );
          if (!matched) {
            isLeapMonth = false;
            matched = yearInfo.months.find((m) => m.month === month && !m.isLeapMonth);
          }
          if (matched && day && day > matched.days) {
            day = matched.days;
          }
        }
        return {
          point: {
            calendar: 'chinese_lunisolar',
            precision: derivePrecisionFromParts(month, day),
            parts: { year: refYear, month, isLeapMonth, day },
          },
          carried: true,
        };
      }
    }

    return { point: createDefaultPoint('chinese_lunisolar'), carried: false };
  }

  // Target: Regnal (年号纪年)
  if (targetCalendar === 'regnal') {
    let refYear = extractReferenceYear(cleaned);
    let lunarPartsForHistorical: LunarParts | null = null;
    let gregorianPartsForMinguo: GregorianParts | null = null;

    if (cleaned.calendar === 'gregorian') {
      gregorianPartsForMinguo = cleaned.parts;
      const gYear = cleaned.parts.year;
      const gMonth = cleaned.parts.month ?? 1;
      const gDay = cleaned.parts.day ?? 1;
      const isBeforeAbdication =
        gYear < 1912 ||
        (gYear === 1912 && (gMonth < 2 || (gMonth === 2 && gDay <= 12)));
      if (!isBeforeAbdication && gYear >= 1912 && gYear <= 1949) {
        refYear = gYear;
      } else if (cleaned.parts.month && cleaned.parts.day) {
        const lunar = gregorianToLunarParts(cleaned.parts);
        if (lunar) {
          lunarPartsForHistorical = lunar;
          refYear = lunar.year;
        }
      }
    } else if (cleaned.calendar === 'chinese_lunisolar') {
      lunarPartsForHistorical = cleaned.parts;
    }

    if (refYear !== null) {
      const resolvedRefYear = refYear;
      let matchedEra = REIGN_ERAS.find(
        (era) => era.startYear <= resolvedRefYear && resolvedRefYear <= era.endYear
      );
      if (
        cleaned.calendar === 'gregorian' &&
        resolvedRefYear >= 1912 &&
        resolvedRefYear <= 1949
      ) {
        matchedEra = findEraById('minguo') || matchedEra;
      }
      if (
        matchedEra?.id === 'minguo' &&
        cleaned.calendar === 'chinese_lunisolar' &&
        cleaned.parts.month &&
        cleaned.parts.day
      ) {
        const greg = lunarToGregorianParts(cleaned.parts);
        if (greg) {
          gregorianPartsForMinguo = greg;
          refYear = greg.year;
          matchedEra = REIGN_ERAS.find(
            (era) => era.startYear <= greg.year && greg.year <= era.endYear
          );
        }
      }
      if (matchedEra) {
        const yearInEra = refYear - matchedEra.startYear + 1;
        if (matchedEra.id === 'minguo' && gregorianPartsForMinguo) {
          const month = gregorianPartsForMinguo.month ?? null;
          const day = gregorianPartsForMinguo.day ?? null;
          return {
            point: {
              calendar: 'regnal',
              precision: derivePrecisionFromParts(month, day),
              parts: {
                dynastyId: matchedEra.dynastyId,
                eraId: matchedEra.id,
                eraName: matchedEra.eraName,
                yearInEra,
                month,
                isLeapMonth: false,
                day,
              },
            },
            carried: true,
          };
        }
        if (lunarPartsForHistorical) {
          const month = lunarPartsForHistorical.month ?? null;
          const day = lunarPartsForHistorical.day ?? null;
          return {
            point: {
              calendar: 'regnal',
              precision: derivePrecisionFromParts(month, day),
              parts: {
                dynastyId: matchedEra.dynastyId,
                eraId: matchedEra.id,
                eraName: matchedEra.eraName,
                yearInEra,
                month,
                isLeapMonth: Boolean(month && lunarPartsForHistorical.isLeapMonth),
                day,
              },
            },
            carried: true,
          };
        }
        return {
          point: {
            calendar: 'regnal',
            precision: 'year',
            parts: {
              dynastyId: matchedEra.dynastyId,
              eraId: matchedEra.id,
              eraName: matchedEra.eraName,
              yearInEra,
              month: null,
              isLeapMonth: false,
              day: null,
            },
          },
          carried: true,
        };
      }
    }

    return { point: createDefaultPoint('regnal'), carried: false };
  }

  // Target: Sexagenary (干支纪年)
  if (targetCalendar === 'sexagenary') {
    if (cleaned.calendar === 'gregorian' && cleaned.parts.month && cleaned.parts.day) {
      const gz = getGanzhiForSolarDate(
        cleaned.parts.year,
        cleaned.parts.month,
        cleaned.parts.day,
        'lunar_new_year'
      );
      if (gz) {
        return {
          point: {
            calendar: 'sexagenary',
            precision: 'year',
            parts: {
              cycleYear: gz.cycleYear,
              cycleIndex: gz.cycleIndex,
              basis: 'lunar_new_year',
            },
          },
          carried: true,
        };
      }
    }
    const refYear = extractReferenceYear(cleaned);
    if (refYear !== null) {
      const gz = getGanzhiForLunarYear(refYear);
      if (gz) {
        return {
          point: {
            calendar: 'sexagenary',
            precision: 'year',
            parts: {
              cycleYear: gz.cycleYear,
              cycleIndex: gz.cycleIndex,
              basis: 'lunar_new_year',
            },
          },
          carried: true,
        };
      }
    }
    return { point: createDefaultPoint('sexagenary'), carried: false };
  }

  return { point: createDefaultPoint(targetCalendar), carried: false };
}
