import {
  LunarDay,
  LunarYear,
  SixtyCycle,
  SixtyCycleYear,
  SolarDay,
  SolarMonth,
} from 'tyme4ts';
import type {
  CalendarBasis,
  CalendarDatePoint,
  GregorianParts,
  LunarMonthInfo,
  LunarParts,
  LunarYearInfo,
  NormalizedDate,
  RegnalParts,
  SexagenaryBasis,
  TimeBranch,
} from './date.types';
import { findEraById, findEraByName, type EraDefinition } from './era-data';

export const TYME_ENGINE_NAME = 'tyme4ts';
export const TYME_ENGINE_VERSION = '1.5.6';

export const SIXTY_JIAZI: string[] = [...SixtyCycle.NAMES];

export const LUNAR_MONTH_LABELS: Record<number, string> = {
  1: '正月',
  2: '二月',
  3: '三月',
  4: '四月',
  5: '五月',
  6: '六月',
  7: '七月',
  8: '八月',
  9: '九月',
  10: '十月',
  11: '冬月',
  12: '腊月',
};

export const LUNAR_DAY_LABELS: string[] = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

export const TRADITIONAL_BRANCHES: Array<{
  branch: TimeBranch;
  label: string;
  shortLabel: string;
  approxRange: string;
}> = [
  { branch: 'zi', label: '子时', shortLabel: '子', approxRange: '23:00–01:00（跨日）' },
  { branch: 'chou', label: '丑时', shortLabel: '丑', approxRange: '01:00–03:00' },
  { branch: 'yin', label: '寅时', shortLabel: '寅', approxRange: '03:00–05:00' },
  { branch: 'mao', label: '卯时', shortLabel: '卯', approxRange: '05:00–07:00' },
  { branch: 'chen', label: '辰时', shortLabel: '辰', approxRange: '07:00–09:00' },
  { branch: 'si', label: '巳时', shortLabel: '巳', approxRange: '09:00–11:00' },
  { branch: 'wu', label: '午时', shortLabel: '午', approxRange: '11:00–13:00' },
  { branch: 'wei', label: '未时', shortLabel: '未', approxRange: '13:00–15:00' },
  { branch: 'shen', label: '申时', shortLabel: '申', approxRange: '15:00–17:00' },
  { branch: 'you', label: '酉时', shortLabel: '酉', approxRange: '17:00–19:00' },
  { branch: 'xu', label: '戌时', shortLabel: '戌', approxRange: '19:00–21:00' },
  { branch: 'hai', label: '亥时', shortLabel: '亥', approxRange: '21:00–23:00' },
];

export function formatIsoDate(year: number, month: number, day: number): string {
  const y =
    year < 0
      ? `-${String(Math.abs(year)).padStart(4, '0')}`
      : String(year).padStart(4, '0');
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getCalendarBasisForGregorian(
  year: number,
  month?: number | null,
  day?: number | null
): CalendarBasis {
  if (year < 1582) return 'julian';
  if (year > 1582) return 'gregorian';
  if (!month) return 'julian_gregorian_hybrid';
  if (month < 10) return 'julian';
  if (month > 10) return 'gregorian';
  if (!day) return 'julian_gregorian_hybrid';
  return day <= 4 ? 'julian' : 'gregorian';
}

export function getCalendarBasisLabel(basis?: CalendarBasis): string {
  switch (basis) {
    case 'gregorian':
      return '格里高利历（公历）';
    case 'julian':
      return '儒略历（1582年10月4日及以前）';
    case 'julian_gregorian_hybrid':
      return '儒略历/格里高利历切换边界（1582年10月）';
    case 'historical_chinese':
      return '中国传统历史历法（非现代标准农历）';
    default:
      return '未指定历法依据';
  }
}

export function getGregorianDayOptions(year: number, month: number): number[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return [];
  }
  if (year >= 1 && year <= 9999) {
    try {
      return SolarMonth.fromYm(year, month)
        .getDays()
        .map((d) => d.getDay());
    } catch {
      // Fallback below
    }
  }
  // Fallback proleptic calculation for out-of-range years
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const maxDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return Array.from({ length: maxDays }, (_, i) => i + 1);
}

export function isValidGregorianDate(year: number, month: number, day: number): boolean {
  return getGregorianDayOptions(year, month).includes(day);
}

export function getLunarYearInfo(year: number): LunarYearInfo {
  if (!Number.isInteger(year) || year < -1 || year > 9999 || year === 0) {
    return {
      year,
      ganzhiLunarYear: '',
      ganzhiLichunYear: '',
      leapMonth: 0,
      months: buildFallbackLunarMonths(),
      supported: false,
    };
  }

  try {
    const ly = LunarYear.fromYear(year);
    const leapMonth = ly.getLeapMonth();
    const tymeMonths = ly.getMonths();

    // LunarYear.getMonths() returns months belonging to that lunar year (sometimes includes transition? Let's filter to year === ly.getYear())
    const seen = new Set<number>();
    const months: LunarMonthInfo[] = [];

    for (const m of tymeMonths) {
      if (m.getYear() !== year) continue;
      const monthWithLeap = m.getMonthWithLeap();
      if (seen.has(monthWithLeap)) continue;
      seen.add(monthWithLeap);

      const monthNum = m.getMonth();
      const isLeapMonth = m.isLeap();
      const days = m.getDayCount() === 30 ? 30 : 29;
      const baseLabel = LUNAR_MONTH_LABELS[monthNum] || `${monthNum}月`;
      months.push({
        month: monthNum,
        isLeapMonth,
        monthWithLeap,
        days,
        label: isLeapMonth ? `闰${baseLabel}` : baseLabel,
      });
    }

    const ganzhiLunarYear = ly.getSixtyCycle().getName();
    let ganzhiLichunYear = '';
    try {
      ganzhiLichunYear = SixtyCycleYear.fromYear(year).getSixtyCycle().getName();
    } catch {
      ganzhiLichunYear = ganzhiLunarYear;
    }

    return {
      year,
      ganzhiLunarYear,
      ganzhiLichunYear,
      leapMonth,
      months: months.length > 0 ? months : buildFallbackLunarMonths(),
      supported: true,
    };
  } catch {
    return {
      year,
      ganzhiLunarYear: '',
      ganzhiLichunYear: '',
      leapMonth: 0,
      months: buildFallbackLunarMonths(),
      supported: false,
    };
  }
}

function buildFallbackLunarMonths(): LunarMonthInfo[] {
  return Array.from({ length: 12 }, (_, idx) => {
    const month = idx + 1;
    return {
      month,
      isLeapMonth: false,
      monthWithLeap: month,
      days: 30,
      label: LUNAR_MONTH_LABELS[month] || `${month}月`,
    };
  });
}

export function getGanzhiForSolarDate(
  year: number,
  month: number,
  day: number,
  basis: SexagenaryBasis = 'lunar_new_year'
): { cycleYear: string; cycleIndex: number } | null {
  if (year < 1 || year > 9999) return null;
  try {
    const solar = SolarDay.fromYmd(year, month, day);
    const sc =
      basis === 'lichun'
        ? solar.getSixtyCycleDay().getYear()
        : solar.getLunarDay().getLunarMonth().getLunarYear().getSixtyCycle();
    return {
      cycleYear: sc.getName(),
      cycleIndex: sc.getIndex(),
    };
  } catch {
    return null;
  }
}

export function getGanzhiForLunarYear(year: number): {
  cycleYear: string;
  cycleIndex: number;
} | null {
  if (year < -1 || year > 9999 || year === 0) return null;
  try {
    const sc = LunarYear.fromYear(year).getSixtyCycle();
    return {
      cycleYear: sc.getName(),
      cycleIndex: sc.getIndex(),
    };
  } catch {
    return null;
  }
}

export function gregorianToLunarParts(parts: GregorianParts): LunarParts | null {
  if (!parts.month || !parts.day) return null;
  if (parts.year < 1 || parts.year > 9999) return null;
  if (!isValidGregorianDate(parts.year, parts.month, parts.day)) return null;
  try {
    const solar = SolarDay.fromYmd(parts.year, parts.month, parts.day);
    const lunar = solar.getLunarDay();
    const lm = lunar.getLunarMonth();
    return {
      year: lunar.getYear(),
      month: lm.getMonth(),
      isLeapMonth: lm.isLeap(),
      day: lunar.getDay(),
    };
  } catch {
    return null;
  }
}

export function lunarToGregorianParts(parts: LunarParts): GregorianParts | null {
  if (!parts.month || !parts.day) return null;
  if (parts.year < -1 || parts.year > 9999 || parts.year === 0) return null;
  try {
    const monthWithLeap = parts.isLeapMonth ? -Math.abs(parts.month) : Math.abs(parts.month);
    const lunar = LunarDay.fromYmd(parts.year, monthWithLeap, parts.day);
    const solar = lunar.getSolarDay();
    return {
      year: solar.getYear(),
      month: solar.getMonth(),
      day: solar.getDay(),
    };
  } catch {
    return null;
  }
}

export function resolveEraForRegnalParts(parts: RegnalParts): EraDefinition | undefined {
  return findEraById(parts.eraId) || findEraByName(parts.eraName);
}

/**
 * Compute approximate or verified Gregorian year for a regnal year.
 * NOTE: Reign changes within the same year mean month/day matters near boundaries.
 */
export function computeRegnalGregorianYear(
  era: EraDefinition,
  yearInEra: number
): number {
  return era.startYear + (yearInEra - 1);
}

export function normalizeDatePoint(point: CalendarDatePoint): NormalizedDate {
  if (point.calendar === 'gregorian') {
    const { year, month, day } = point.parts;
    const basis = getCalendarBasisForGregorian(year, month, day);

    if (year < 1 || year > 9999) {
      return {
        status: 'unsupported',
        calendarBasis: basis,
        engine: TYME_ENGINE_NAME,
        engineVersion: TYME_ENGINE_VERSION,
        note: '公历年份超出历法引擎支持范围（1–9999年），已完整保留结构化记录。',
      };
    }

    if (point.precision === 'year') {
      const decDays = getGregorianDayOptions(year, 12);
      const endDay = decDays[decDays.length - 1] || 31;
      return {
        status: 'period',
        calendarBasis: basis,
        start: formatIsoDate(year, 1, 1),
        end: formatIsoDate(year, 12, endDay),
        engine: TYME_ENGINE_NAME,
        engineVersion: TYME_ENGINE_VERSION,
        note:
          basis !== 'gregorian'
            ? getCalendarBasisLabel(basis)
            : undefined,
      };
    }

    if (point.precision === 'month' && month) {
      const days = getGregorianDayOptions(year, month);
      if (days.length === 0) {
        return { status: 'unsupported', calendarBasis: basis };
      }
      return {
        status: 'period',
        calendarBasis: basis,
        start: formatIsoDate(year, month, days[0]),
        end: formatIsoDate(year, month, days[days.length - 1]),
        engine: TYME_ENGINE_NAME,
        engineVersion: TYME_ENGINE_VERSION,
        note:
          basis !== 'gregorian'
            ? getCalendarBasisLabel(basis)
            : undefined,
      };
    }

    if (point.precision === 'day' && month && day) {
      if (!isValidGregorianDate(year, month, day)) {
        return {
          status: 'unsupported',
          calendarBasis: basis,
          note:
            year === 1582 && month === 10 && day >= 5 && day <= 14
              ? '1582年10月5日至14日因儒略历切换为格里高利历而被跳过，历史上不存在。'
              : '公历日期不合法。',
        };
      }
      const iso = formatIsoDate(year, month, day);
      return {
        status: 'exact',
        calendarBasis: basis,
        start: iso,
        end: iso,
        engine: TYME_ENGINE_NAME,
        engineVersion: TYME_ENGINE_VERSION,
        note:
          basis !== 'gregorian'
            ? getCalendarBasisLabel(basis)
            : undefined,
      };
    }

    return { status: 'unsupported', calendarBasis: basis };
  }

  if (point.calendar === 'chinese_lunisolar') {
    const { year, month, isLeapMonth, day } = point.parts;
    if (year < -1 || year > 9999 || year === 0) {
      return {
        status: 'unsupported',
        calendarBasis: 'historical_chinese',
        engine: TYME_ENGINE_NAME,
        engineVersion: TYME_ENGINE_VERSION,
        note: '农历年份超出引擎计算范围（-1至9999年），仅保留结构化记录。',
      };
    }

    try {
      const yearInfo = getLunarYearInfo(year);
      if (!yearInfo.supported) {
        return {
          status: 'unsupported',
          calendarBasis: 'historical_chinese',
          engine: TYME_ENGINE_NAME,
          engineVersion: TYME_ENGINE_VERSION,
        };
      }

      if (point.precision === 'year') {
        const firstMonth = yearInfo.months[0];
        const lastMonth = yearInfo.months[yearInfo.months.length - 1];
        const startSolar = LunarDay.fromYmd(year, firstMonth.monthWithLeap, 1).getSolarDay();
        const endSolar = LunarDay.fromYmd(
          year,
          lastMonth.monthWithLeap,
          lastMonth.days
        ).getSolarDay();
        const basis = getCalendarBasisForGregorian(
          startSolar.getYear(),
          startSolar.getMonth(),
          startSolar.getDay()
        );
        return {
          status: 'period',
          calendarBasis: basis,
          start: formatIsoDate(startSolar.getYear(), startSolar.getMonth(), startSolar.getDay()),
          end: formatIsoDate(endSolar.getYear(), endSolar.getMonth(), endSolar.getDay()),
          engine: TYME_ENGINE_NAME,
          engineVersion: TYME_ENGINE_VERSION,
          note:
            year < 1900
              ? `按现代天文历法推算参考（${getCalendarBasisLabel(basis)}），早期历史实际颁行历法偶有置闰差异。`
              : basis !== 'gregorian'
                ? getCalendarBasisLabel(basis)
                : undefined,
        };
      }

      if (point.precision === 'month' && month) {
        const matched = yearInfo.months.find(
          (m) => m.month === month && m.isLeapMonth === Boolean(isLeapMonth)
        );
        if (!matched) {
          return {
            status: 'unsupported',
            calendarBasis: 'historical_chinese',
            note: `${year}年不存在${isLeapMonth ? '闰' : ''}${LUNAR_MONTH_LABELS[month] || `${month}月`}。`,
          };
        }
        const startSolar = LunarDay.fromYmd(year, matched.monthWithLeap, 1).getSolarDay();
        const endSolar = LunarDay.fromYmd(
          year,
          matched.monthWithLeap,
          matched.days
        ).getSolarDay();
        const basis = getCalendarBasisForGregorian(
          startSolar.getYear(),
          startSolar.getMonth(),
          startSolar.getDay()
        );
        return {
          status: 'period',
          calendarBasis: basis,
          start: formatIsoDate(startSolar.getYear(), startSolar.getMonth(), startSolar.getDay()),
          end: formatIsoDate(endSolar.getYear(), endSolar.getMonth(), endSolar.getDay()),
          engine: TYME_ENGINE_NAME,
          engineVersion: TYME_ENGINE_VERSION,
          note:
            year < 1900
              ? `按推算历法对照（${getCalendarBasisLabel(basis)}），史料实历置闰请以古籍为准。`
              : undefined,
        };
      }

      if (point.precision === 'day' && month && day) {
        const matched = yearInfo.months.find(
          (m) => m.month === month && m.isLeapMonth === Boolean(isLeapMonth)
        );
        if (!matched || day < 1 || day > matched.days) {
          return {
            status: 'unsupported',
            calendarBasis: 'historical_chinese',
            note: '农历月份或日期超出该月实际天数。',
          };
        }
        const solar = LunarDay.fromYmd(year, matched.monthWithLeap, day).getSolarDay();
        const iso = formatIsoDate(solar.getYear(), solar.getMonth(), solar.getDay());
        const basis = getCalendarBasisForGregorian(
          solar.getYear(),
          solar.getMonth(),
          solar.getDay()
        );
        return {
          status: 'exact',
          calendarBasis: basis,
          start: iso,
          end: iso,
          engine: TYME_ENGINE_NAME,
          engineVersion: TYME_ENGINE_VERSION,
          note:
            year < 1900
              ? `按现代天文算法推算（${getCalendarBasisLabel(basis)}），1900年以前仅供参考。`
              : basis !== 'gregorian'
                ? getCalendarBasisLabel(basis)
                : undefined,
        };
      }
    } catch {
      return {
        status: 'unsupported',
        calendarBasis: 'historical_chinese',
        engine: TYME_ENGINE_NAME,
        engineVersion: TYME_ENGINE_VERSION,
        note: '该农历日期暂无法完成换算。',
      };
    }

    return { status: 'unsupported', calendarBasis: 'historical_chinese' };
  }

  if (point.calendar === 'regnal') {
    const era = resolveEraForRegnalParts(point.parts);
    if (!era) {
      return {
        status: 'unsupported',
        calendarBasis: 'historical_chinese',
        note: '自定义或未收录年号，暂无法换算公元日期，已完整保存历史纪年。',
      };
    }

    if (era.conversionStatus === 'unverified') {
      const approxYear = computeRegnalGregorianYear(era, point.parts.yearInEra);
      return {
        status: 'unsupported',
        calendarBasis: 'historical_chinese',
        note: `${era.dynastyName}${era.eraName}行用${era.calendarSystem}（约公元${approxYear < 0 ? `前${Math.abs(approxYear)}` : approxYear}年前后），岁首与置闰规则待考，不承诺自动精准换算。`,
      };
    }

    const mappedYear = computeRegnalGregorianYear(era, point.parts.yearInEra);

    // Republic of China (1912+) defaults to Gregorian when month/day entered under Minguo
    if (era.id === 'minguo') {
      const gregResult = normalizeDatePoint({
        calendar: 'gregorian',
        precision: point.precision,
        parts: {
          year: mappedYear,
          month: point.parts.month,
          day: point.parts.day,
        },
      });
      if (era.conversionStatus === 'verified') {
        return {
          ...gregResult,
          note:
            point.parts.isLeapMonth
              ? '民国年号若兼指传统农历闰月，请改选「农历」录入以获取精确公历换算。'
              : gregResult.note || '民国纪年按公历对应（若原谱指农历月日，建议改用农历历法录入）。',
        };
      }
    }

    // Ming / Qing verified or partial eras map via Chinese lunar calendar as reference
    const lunarMapped = normalizeDatePoint({
      calendar: 'chinese_lunisolar',
      precision: point.precision,
      parts: {
        year: mappedYear,
        month: point.parts.month,
        isLeapMonth: point.parts.isLeapMonth,
        day: point.parts.day,
      },
    });

    if (era.conversionStatus === 'partial' && lunarMapped.status === 'exact') {
      return {
        ...lunarMapped,
        status: 'ambiguous',
        note: era.note || `${era.eraName}年间存在同年改元或历法并行情况，公历对应仅供参考。`,
      };
    }

    return {
      ...lunarMapped,
      note: era.note
        ? `${era.note}（依据：${era.source}）`
        : `${era.dynastyName}${era.eraName} · ${era.calendarSystem}（依据：${era.source}）`,
    };
  }

  // Sexagenary (干支纪年) repeats every 60 years — never infer a unique Gregorian year!
  return {
    status: 'ambiguous',
    calendarBasis: 'historical_chinese',
    note: `干支纪年（${point.parts.cycleYear}，按${point.parts.basis === 'lichun' ? '立春' : '农历春节'}换年）每60年循环一次，无其它时代上下文时不能唯一推算公元年份。`,
  };
}

/**
 * Compare two CalendarDatePoints chronologically ONLY if both resolve reliably.
 * Returns negative if a < b, 0 if equal/overlapping unambiguous, positive if a > b,
 * or null when incomparable (e.g. historical/sexagenary dates).
 */
export function compareDatePoints(
  a: CalendarDatePoint,
  b: CalendarDatePoint
): number | null {
  const na = normalizeDatePoint(a);
  const nb = normalizeDatePoint(b);
  if (
    !na.start ||
    !nb.start ||
    na.status === 'unsupported' ||
    nb.status === 'unsupported' ||
    na.status === 'ambiguous' ||
    nb.status === 'ambiguous'
  ) {
    return null;
  }
  // ISO YYYY-MM-DD (or -YYYY-MM-DD) comparison works only for positive 4-digit years directly
  const toSortableNumber = (iso: string): number | null => {
    const match = /^(-?\d+)-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    return y * 10000 + m * 100 + d;
  };

  const aStart = toSortableNumber(na.start);
  const bEnd = toSortableNumber(nb.end || nb.start);
  const aEnd = toSortableNumber(na.end || na.start);
  const bStart = toSortableNumber(nb.start);
  if (aStart === null || bEnd === null || aEnd === null || bStart === null) {
    return null;
  }
  if (aStart > bEnd) return 1;
  if (aEnd < bStart) return -1;
  return 0;
}
