import {
  LUNAR_DAY_LABELS,
  LUNAR_MONTH_LABELS,
  SIXTY_JIAZI,
  isValidGregorianDate,
} from './calendar-adapter';
import {
  convertCalendarPoint,
  createDefaultPoint,
  derivePrecisionFromParts,
  finalizeGenealogyDate,
  validateGenealogyDate,
} from './date-core';
import { formatGenealogyDate } from './date-format';
import type {
  CalendarDatePoint,
  CalendarType,
  DatePrecision,
  DateQualifier,
  GenealogyDate,
  GregorianParts,
  LunarParts,
  RegnalParts,
} from './date.types';
import {
  REIGN_ERAS,
  findEraByName,
  formatHistoricalYearSpan,
} from './era-data';

export interface QuickParseOptions {
  calendars?: CalendarType[];
  enableOriginal?: boolean;
  minYear?: number;
  maxYear?: number;
}

export type QuickParseResult =
  | { ok: true; value: GenealogyDate | null }
  | { ok: false; error: string };

const CHINESE_DIGIT_MAP: Record<string, number> = {
  '〇': 0,
  '零': 0,
  '一': 1,
  '壹': 1,
  '二': 2,
  '贰': 2,
  '两': 2,
  '三': 3,
  '叁': 3,
  '四': 4,
  '肆': 4,
  '五': 5,
  '伍': 5,
  '六': 6,
  '陆': 6,
  '七': 7,
  '柒': 7,
  '八': 8,
  '捌': 8,
  '九': 9,
  '玖': 9,
};

function normalizeFullWidth(raw: string): string {
  return raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[－—–]/g, '-')
    .replace(/／/g, '/')
    .replace(/．/g, '.')
    .trim();
}

function parseChineseOrArabicNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  if (trimmed === '元') return 1;

  // Handle year like 一九九〇 or 二〇一四 (digit-by-digit)
  if (/^[〇零一二三四五六七八九]{4}$/.test(trimmed)) {
    let val = 0;
    for (const ch of trimmed) {
      val = val * 10 + (CHINESE_DIGIT_MAP[ch] ?? 0);
    }
    return val;
  }

  // Handle Chinese numerals 1..199 (e.g. 十, 十一, 二十三, 三十, 一百零二)
  if (!/^[〇零一壹二贰两三叁四肆五伍六陆七柒八捌九玖十拾百佰]+$/.test(trimmed)) {
    return null;
  }

  let total = 0;
  let current = 0;
  for (const ch of trimmed) {
    if (ch === '百' || ch === '佰') {
      total += (current || 1) * 100;
      current = 0;
    } else if (ch === '十' || ch === '拾') {
      total += (current || 1) * 10;
      current = 0;
    } else {
      const d = CHINESE_DIGIT_MAP[ch];
      if (d === undefined) return null;
      current = current * 10 + d;
    }
  }
  return total + current;
}

function parseLunarMonthToken(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d{1,2}$/.test(t)) {
    const m = parseInt(t, 10);
    return m >= 1 && m <= 12 ? m : null;
  }
  if (t === '正' || t === '元') return 1;
  if (t === '冬') return 11;
  if (t === '腊') return 12;
  for (let m = 1; m <= 12; m++) {
    const label = LUNAR_MONTH_LABELS[m];
    if (label && (label === `${t}月` || label.replace(/月$/, '') === t)) {
      return m;
    }
  }
  const num = parseChineseOrArabicNumber(t);
  return num && num >= 1 && num <= 12 ? num : null;
}

function parseLunarDayToken(raw: string): number | null {
  const t = raw.trim().replace(/[日号]$/, '');
  if (!t) return null;
  if (/^\d{1,2}$/.test(t)) {
    const d = parseInt(t, 10);
    return d >= 1 && d <= 30 ? d : null;
  }
  const idx = LUNAR_DAY_LABELS.findIndex((label) => label === t);
  if (idx >= 0) return idx + 1;
  if (t.startsWith('廿')) {
    const tail = t.slice(1);
    if (!tail) return 20;
    const d = parseChineseOrArabicNumber(tail);
    return d && d >= 1 && d <= 9 ? 20 + d : null;
  }
  const parsed = parseChineseOrArabicNumber(t);
  return parsed && parsed >= 1 && parsed <= 30 ? parsed : null;
}

function extractQualifier(text: string): { qualifier: DateQualifier; core: string } {
  let core = text.trim();
  let qualifier: DateQualifier = 'exact';

  if (/^(大约|约|[~≈])\s*/.test(core)) {
    qualifier = 'about';
    core = core.replace(/^(大约|约|[~≈])\s*/, '').trim();
  } else if (/(以前|之前)$/.test(core)) {
    qualifier = 'before';
    core = core.replace(/(以前|之前)$/, '').trim();
  } else if (/(以后|之后)$/.test(core)) {
    qualifier = 'after';
    core = core.replace(/(以后|之后)$/, '').trim();
  } else if (/^.+[年年月日号\d]\s*前$/.test(core) && !/^公元前/.test(core)) {
    qualifier = 'before';
    core = core.replace(/前$/, '').trim();
  } else if (/^.+[年年月日号\d]\s*后$/.test(core)) {
    qualifier = 'after';
    core = core.replace(/后$/, '').trim();
  }

  return { qualifier, core };
}

function tryParseGregorian(
  core: string,
  minYear: number,
  maxYear: number
):
  | { matched: false }
  | { matched: true; ok: true; parts: GregorianParts }
  | { matched: true; ok: false; error: string } {
  // Compact 8-digit YYYYMMDD
  const compactMatch = core.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const year = parseInt(compactMatch[1], 10);
    const month = parseInt(compactMatch[2], 10);
    const day = parseInt(compactMatch[3], 10);
    if (year < minYear || year > maxYear) {
      return { matched: true, ok: false, error: `年份需在 ${minYear} 至 ${maxYear} 之间。` };
    }
    if (month < 1 || month > 12) {
      return { matched: true, ok: false, error: '月份需在 1 至 12 之间。' };
    }
    if (!isValidGregorianDate(year, month, day)) {
      return {
        matched: true,
        ok: false,
        error:
          year === 1582 && month === 10 && day >= 5 && day <= 14
            ? '1582年10月5日–14日因历法切换在历史上不存在。'
            : `公历 ${year}年${month}月${day}日 不是合法日期。`,
      };
    }
    return { matched: true, ok: true, parts: { year, month, day } };
  }

  // Separated YYYY-MM-DD / YYYY/M/D / YYYY.M.D or YYYY年M月D日
  const fullMatch = core.match(
    /^(?:公元)?(?:(前)\s*)?(-?\d{1,4})\s*(?:[-/.年])\s*(\d{1,2})\s*(?:[-/.月])\s*(\d{1,2})\s*日?$/
  );
  if (fullMatch) {
    const isBce = Boolean(fullMatch[1]);
    let year = parseInt(fullMatch[2], 10);
    if (isBce && year > 0) year = -year;
    const month = parseInt(fullMatch[3], 10);
    const day = parseInt(fullMatch[4], 10);
    if (year === 0 || year < minYear || year > maxYear) {
      return { matched: true, ok: false, error: `公历年份需在 ${minYear} 至 ${maxYear} 之间（非零）。` };
    }
    if (month < 1 || month > 12) {
      return { matched: true, ok: false, error: '月份需在 1 至 12 之间。' };
    }
    if (!isValidGregorianDate(year, month, day)) {
      return {
        matched: true,
        ok: false,
        error:
          year === 1582 && month === 10 && day >= 5 && day <= 14
            ? '1582年10月5日–14日因历法切换在历史上不存在。'
            : `公历 ${year}年${month}月${day}日 不是合法日期。`,
      };
    }
    return { matched: true, ok: true, parts: { year, month, day } };
  }

  // Year-Month: YYYY-MM / YYYY/M / YYYY年M月
  const ymMatch = core.match(
    /^(?:公元)?(?:(前)\s*)?(-?\d{1,4})\s*(?:[-/.年])\s*(\d{1,2})\s*月?$/
  );
  if (ymMatch) {
    const isBce = Boolean(ymMatch[1]);
    let year = parseInt(ymMatch[2], 10);
    if (isBce && year > 0) year = -year;
    const month = parseInt(ymMatch[3], 10);
    if (year === 0 || year < minYear || year > maxYear) {
      return { matched: true, ok: false, error: `公历年份需在 ${minYear} 至 ${maxYear} 之间（非零）。` };
    }
    if (month < 1 || month > 12) {
      return { matched: true, ok: false, error: '月份需在 1 至 12 之间。' };
    }
    return { matched: true, ok: true, parts: { year, month, day: null } };
  }

  // Year-only: YYYY / YYYY年 / 公元前221年
  const yMatch = core.match(/^(?:公元)?(?:(前)\s*)?(-?\d{1,4})\s*年?$/);
  if (yMatch) {
    const isBce = Boolean(yMatch[1]);
    let year = parseInt(yMatch[2], 10);
    if (isBce && year > 0) year = -year;
    if (year === 0 || year < minYear || year > maxYear) {
      return { matched: true, ok: false, error: `公历年份需在 ${minYear} 至 ${maxYear} 之间（非零）。` };
    }
    return { matched: true, ok: true, parts: { year, month: null, day: null } };
  }

  return { matched: false };
}

function tryParseExplicitLunar(
  core: string,
  minYear: number,
  maxYear: number
):
  | { matched: false }
  | { matched: true; ok: true; parts: LunarParts }
  | { matched: true; ok: false; error: string } {
  const m = core.match(
    /^(?:农历|阴历|夏历)\s*(?:公元)?(?:(前)\s*)?([〇零一二三四五六七八九\d]{1,4})\s*(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])?\s*年(?:\s*(闰)?\s*([正一二三四五六七八九十冬腊\d]{1,2})\s*月(?:\s*([初廿一二三四五六七八九十\d]{1,3})\s*[日号]?)?)?$/
  );
  if (!m) return { matched: false };

  let year = parseChineseOrArabicNumber(m[2]);
  if (!year) return { matched: false };
  if (m[1]) year = -year;
  if (year === 0 || year < minYear || year > maxYear) {
    return { matched: true, ok: false, error: `农历年份需在 ${minYear} 至 ${maxYear} 之间（非零）。` };
  }

  const isLeapMonth = Boolean(m[3]);
  const month = m[4] ? parseLunarMonthToken(m[4]) : null;
  if (m[4] && !month) {
    return { matched: true, ok: false, error: '无法识别该农历月份。' };
  }
  const day = m[5] ? parseLunarDayToken(m[5]) : null;
  if (m[5] && !day) {
    return { matched: true, ok: false, error: '无法识别该农历日期。' };
  }

  return {
    matched: true,
    ok: true,
    parts: { year, month, isLeapMonth: Boolean(month && isLeapMonth), day },
  };
}

function tryParseRegnal(
  core: string
):
  | { matched: false }
  | { matched: true; ok: true; parts: RegnalParts }
  | { matched: true; ok: false; error: string } {
  // Sort eras by descending length so "民国" / "建文" / "后至元" match reliably
  const sorted = [...REIGN_ERAS].sort(
    (a, b) => b.eraName.length - a.eraName.length
  );

  for (const era of sorted) {
    const prefixes = [
      `${era.dynastyName}${era.eraName}`,
      `${era.dynastyName.replace(/朝$/, '')}${era.eraName}`,
      era.eraName,
    ];
    for (const prefix of prefixes) {
      if (!core.startsWith(prefix)) continue;
      const rest = core.slice(prefix.length).trim();
      const match = rest.match(
        /^([元一二三四五六七八九十百\d]{1,5})\s*年(?:\s*(闰)?\s*([正一二三四五六七八九十冬腊\d]{1,2})\s*月(?:\s*([初廿一二三四五六七八九十\d]{1,3})\s*[日号]?)?)?$/
      );
      if (!match) continue;
      const yearInEra = parseChineseOrArabicNumber(match[1]);
      if (!yearInEra || yearInEra < 1 || yearInEra > 200) {
        return { matched: true, ok: false, error: '年号年次需为 1–200 的正整数。' };
      }
      const isLeapMonth = Boolean(match[2]);
      const month = match[3] ? parseLunarMonthToken(match[3]) : null;
      if (match[3] && !month) {
        return { matched: true, ok: false, error: '无法识别历史月份。' };
      }
      const day = match[4] ? parseLunarDayToken(match[4]) : null;
      if (match[4] && !day) {
        return { matched: true, ok: false, error: '无法识别历史日期。' };
      }
      const found = findEraByName(era.eraName) || era;
      return {
        matched: true,
        ok: true,
        parts: {
          dynastyId: found.dynastyId,
          eraId: found.id,
          eraName: found.eraName,
          yearInEra,
          month,
          isLeapMonth: Boolean(month && isLeapMonth),
          day,
        },
      };
    }
  }

  return { matched: false };
}

export function parseQuickDateInput(
  raw: string,
  options: QuickParseOptions = {}
): QuickParseResult {
  const {
    calendars = ['gregorian', 'chinese_lunisolar', 'regnal', 'sexagenary'],
    enableOriginal = true,
    minYear = -3000,
    maxYear = 9999,
  } = options;

  const normalized = normalizeFullWidth(raw);
  if (!normalized) {
    return { ok: true, value: null };
  }

  const { qualifier, core } = extractQualifier(normalized);

  // 1. Gregorian fast path
  if (calendars.includes('gregorian')) {
    const greg = tryParseGregorian(core, minYear, maxYear);
    if (greg.matched) {
      if (!greg.ok) {
        return { ok: false, error: 'error' in greg ? greg.error : '公历日期格式无效。' };
      }
      const precision = derivePrecisionFromParts(greg.parts.month, greg.parts.day);
      const draft: GenealogyDate = {
        schemaVersion: 1,
        kind: 'date',
        calendar: 'gregorian',
        qualifier,
        precision,
        parts: greg.parts,
        time: null,
        originalText: null,
        normalized: null,
      };
      const check = validateGenealogyDate(draft);
      if (!check.valid) return { ok: false, error: check.errors[0] || '公历日期格式无效。' };
      return { ok: true, value: finalizeGenealogyDate(draft) };
    }
  }

  // 2. Explicit Lunar fast path (e.g. 农历2014年正月初一)
  if (calendars.includes('chinese_lunisolar')) {
    const lunar = tryParseExplicitLunar(core, minYear, maxYear);
    if (lunar.matched) {
      if (!lunar.ok) {
        return { ok: false, error: 'error' in lunar ? lunar.error : '农历日期格式无效。' };
      }
      const precision = derivePrecisionFromParts(lunar.parts.month, lunar.parts.day);
      const draft: GenealogyDate = {
        schemaVersion: 1,
        kind: 'date',
        calendar: 'chinese_lunisolar',
        qualifier,
        precision,
        parts: lunar.parts,
        time: null,
        originalText: null,
        normalized: null,
      };
      const check = validateGenealogyDate(draft);
      if (!check.valid) return { ok: false, error: check.errors[0] || '农历日期格式无效。' };
      return { ok: true, value: finalizeGenealogyDate(draft) };
    }
  }

  // 3. Built-in Regnal era fast path (e.g. 光绪二十三年 / 民国12年5月)
  if (calendars.includes('regnal')) {
    const regnal = tryParseRegnal(core);
    if (regnal.matched) {
      if (!regnal.ok) {
        return { ok: false, error: 'error' in regnal ? regnal.error : '年号日期格式无效。' };
      }
      const precision = derivePrecisionFromParts(regnal.parts.month, regnal.parts.day);
      const draft: GenealogyDate = {
        schemaVersion: 1,
        kind: 'date',
        calendar: 'regnal',
        qualifier,
        precision,
        parts: regnal.parts,
        time: null,
        originalText: null,
        normalized: null,
      };
      const check = validateGenealogyDate(draft);
      if (!check.valid) return { ok: false, error: check.errors[0] || '年号日期格式无效。' };
      return { ok: true, value: finalizeGenealogyDate(draft) };
    }
  }

  // Reject malformed purely numeric inputs (e.g. "1990-" or "1990123")
  if (/^[\d\-/.\s]+$/.test(core)) {
    return {
      ok: false,
      error: '请输入有效公历格式（如 1990-05-12、1990-05 或 1990）。',
    };
  }

  // 4. Preserve unrecognized archival text safely as phrase when allowed
  if (enableOriginal) {
    if (normalized.length > 300) {
      return { ok: false, error: '日期记载文本不得超过 300 个字符。' };
    }
    return {
      ok: true,
      value: finalizeGenealogyDate({
        schemaVersion: 1,
        kind: 'phrase',
        originalText: normalized,
        time: null,
      }),
    };
  }

  return {
    ok: false,
    error: '请输入有效日期（如 1990-05-12、1990-05 或 1990）。',
  };
}

export function createQuickPointDraft(
  calendar: CalendarType,
  yearHint?: number
): ReturnType<typeof createDefaultPoint> {
  return createDefaultPoint(calendar, yearHint);
}

export interface DateSuggestionItem {
  id: string;
  kind: 'structured' | 'phrase';
  primaryLabel: string;
  metaLabel: string;
  value: GenealogyDate;
}

const PRECISION_LABEL_MAP: Record<DatePrecision, string> = {
  year: '仅年份',
  month: '年月',
  day: '年月日',
};

const QUALIFIER_NOTE_MAP: Record<DateQualifier, string> = {
  exact: '',
  about: '约 · ',
  before: '之前 · ',
  after: '之后 · ',
};

function buildStructuredDate(
  point: CalendarDatePoint,
  qualifier: DateQualifier
): GenealogyDate | null {
  const draft: GenealogyDate = {
    schemaVersion: 1,
    kind: 'date',
    calendar: point.calendar,
    qualifier,
    precision: point.precision,
    parts: point.parts,
    time: null,
    originalText: null,
    normalized: null,
  };
  const check = validateGenealogyDate(draft);
  if (!check.valid) return null;
  return finalizeGenealogyDate(draft);
}

function addCandidate(
  list: DateSuggestionItem[],
  seen: Set<string>,
  value: GenealogyDate | null,
  metaLabel: string,
  kind: 'structured' | 'phrase' = 'structured',
  maxStructured = 7
): void {
  if (!value) return;
  if (
    kind === 'structured' &&
    list.filter((i) => i.kind === 'structured').length >= maxStructured
  ) {
    return;
  }
  const primaryLabel = formatGenealogyDate(value);
  if (!primaryLabel) return;
  const calKey =
    value.kind === 'date' ? value.calendar : value.kind === 'phrase' ? 'phrase' : 'range';
  const dedupeKey = `${kind}:${calKey}:${primaryLabel}`;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  list.push({
    id: `date-opt-${list.length}`,
    kind,
    primaryLabel,
    metaLabel,
    value,
  });
}

function appendCalendarConversions(
  basePoint: CalendarDatePoint,
  qualifier: DateQualifier,
  calendars: CalendarType[],
  list: DateSuggestionItem[],
  seen: Set<string>
): void {
  const qPrefix = QUALIFIER_NOTE_MAP[qualifier];

  if (basePoint.calendar !== 'gregorian' && calendars.includes('gregorian')) {
    const conv = convertCalendarPoint(basePoint, 'gregorian');
    if (conv.carried) {
      addCandidate(
        list,
        seen,
        buildStructuredDate(conv.point, qualifier),
        `${qPrefix}公历 · 对应换算`
      );
    }
  }

  if (
    basePoint.calendar !== 'chinese_lunisolar' &&
    calendars.includes('chinese_lunisolar')
  ) {
    const conv = convertCalendarPoint(basePoint, 'chinese_lunisolar');
    if (conv.carried) {
      addCandidate(
        list,
        seen,
        buildStructuredDate(conv.point, qualifier),
        `${qPrefix}农历 · 对应换算`
      );
    }
  }

  if (basePoint.calendar !== 'regnal' && calendars.includes('regnal')) {
    const conv = convertCalendarPoint(basePoint, 'regnal');
    if (conv.carried) {
      addCandidate(
        list,
        seen,
        buildStructuredDate(conv.point, qualifier),
        `${qPrefix}历史年号 · 对应换算`
      );
    }
  }
}

export function generateDateSuggestions(
  raw: string,
  options: QuickParseOptions = {}
): DateSuggestionItem[] {
  const {
    calendars = ['gregorian', 'chinese_lunisolar', 'regnal', 'sexagenary'],
    enableOriginal = true,
    minYear = -3000,
    maxYear = 9999,
  } = options;

  const normalized = normalizeFullWidth(raw);
  if (!normalized) return [];

  const { qualifier, core } = extractQualifier(normalized);
  const qPrefix = QUALIFIER_NOTE_MAP[qualifier];
  const suggestions: DateSuggestionItem[] = [];
  const seen = new Set<string>();
  let explicitInvalidCalendarDate = false;

  // 1. Gregorian exact & mid-typing prefix recognition
  if (calendars.includes('gregorian') && core) {
    // Handle trailing "0" in month/day while typing e.g. "1942-0" or "1942-01-0"
    const trailingZeroDay = core.match(
      /^(?:公元)?(?:(前)\s*)?(-?\d{1,4})\s*(?:[-/.年])\s*(\d{1,2})\s*(?:[-/.月])\s*0$/
    );
    const trailingZeroMonthOrSep = core.match(
      /^(?:公元)?(?:(前)\s*)?(-?\d{1,4})\s*(?:[-/.年])\s*(?:0)?$/
    );
    const trailingDaySep = core.match(
      /^(?:公元)?(?:(前)\s*)?(-?\d{1,4})\s*(?:[-/.年])\s*(\d{1,2})\s*[-/.]$/
    );

    if (trailingZeroDay) {
      let y = parseInt(trailingZeroDay[2], 10);
      if (trailingZeroDay[1] && y > 0) y = -y;
      const m = parseInt(trailingZeroDay[3], 10);
      if (y !== 0 && y >= minYear && y <= maxYear && m >= 1 && m <= 12) {
        const pt: CalendarDatePoint = {
          calendar: 'gregorian',
          precision: 'month',
          parts: { year: y, month: m, day: null },
        };
        addCandidate(
          suggestions,
          seen,
          buildStructuredDate(pt, qualifier),
          `${qPrefix}公历 · 年月`
        );
        appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
      }
    } else if (trailingDaySep) {
      let y = parseInt(trailingDaySep[2], 10);
      if (trailingDaySep[1] && y > 0) y = -y;
      const m = parseInt(trailingDaySep[3], 10);
      if (y !== 0 && y >= minYear && y <= maxYear && m >= 1 && m <= 12) {
        const pt: CalendarDatePoint = {
          calendar: 'gregorian',
          precision: 'month',
          parts: { year: y, month: m, day: null },
        };
        addCandidate(
          suggestions,
          seen,
          buildStructuredDate(pt, qualifier),
          `${qPrefix}公历 · 年月`
        );
        appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
      }
    } else if (trailingZeroMonthOrSep) {
      let y = parseInt(trailingZeroMonthOrSep[2], 10);
      if (trailingZeroMonthOrSep[1] && y > 0) y = -y;
      if (y !== 0 && y >= minYear && y <= maxYear) {
        const pt: CalendarDatePoint = {
          calendar: 'gregorian',
          precision: 'year',
          parts: { year: y, month: null, day: null },
        };
        addCandidate(
          suggestions,
          seen,
          buildStructuredDate(pt, qualifier),
          `${qPrefix}公历 · 仅年份`
        );
        appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
      }
    } else {
      const greg = tryParseGregorian(core, minYear, maxYear);
      if (greg.matched) {
        if (!greg.ok) {
          explicitInvalidCalendarDate = true;
        } else {
          const precision = derivePrecisionFromParts(
            greg.parts.month,
            greg.parts.day
          );
          const pt: CalendarDatePoint = {
            calendar: 'gregorian',
            precision,
            parts: greg.parts,
          };
          addCandidate(
            suggestions,
            seen,
            buildStructuredDate(pt, qualifier),
            `${qPrefix}公历 · ${PRECISION_LABEL_MAP[precision]}`
          );

          // If month is a single digit "1" (could become 10, 11, 12), offer month completions
          const partialMonthOnly = core.match(
            /^(?:公元)?(?:(前)\s*)?(-?\d{1,4})\s*(?:[-/.年])\s*1$/
          );
          if (partialMonthOnly && precision === 'month') {
            for (const m of [10, 11, 12]) {
              const compPt: CalendarDatePoint = {
                calendar: 'gregorian',
                precision: 'month',
                parts: { year: greg.parts.year, month: m, day: null },
              };
              addCandidate(
                suggestions,
                seen,
                buildStructuredDate(compPt, qualifier),
                `${qPrefix}公历 · 月份补全`
              );
            }
          }

          appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
        }
      }
    }
  }

  // 2. Explicit Lunar (including partial "农历2014")
  if (calendars.includes('chinese_lunisolar') && core && !explicitInvalidCalendarDate) {
    const lunarFull = tryParseExplicitLunar(core, minYear, maxYear);
    if (lunarFull.matched && lunarFull.ok) {
      const precision = derivePrecisionFromParts(
        lunarFull.parts.month,
        lunarFull.parts.day
      );
      const pt: CalendarDatePoint = {
        calendar: 'chinese_lunisolar',
        precision,
        parts: lunarFull.parts,
      };
      addCandidate(
        suggestions,
        seen,
        buildStructuredDate(pt, qualifier),
        `${qPrefix}农历 · ${PRECISION_LABEL_MAP[precision]}`
      );
      appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
    } else {
      const partialLunar = core.match(
        /^(?:农历|阴历|夏历)\s*(?:公元)?(?:(前)\s*)?(\d{1,4})$/
      );
      if (partialLunar) {
        let y = parseInt(partialLunar[2], 10);
        if (partialLunar[1] && y > 0) y = -y;
        if (y !== 0 && y >= minYear && y <= maxYear) {
          const pt: CalendarDatePoint = {
            calendar: 'chinese_lunisolar',
            precision: 'year',
            parts: { year: y, month: null, isLeapMonth: false, day: null },
          };
          addCandidate(
            suggestions,
            seen,
            buildStructuredDate(pt, qualifier),
            `${qPrefix}农历 · 仅年份`
          );
          appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
        }
      }
    }
  }

  // 3. Regnal era (full, partial without "年", or era-name prefix)
  if (calendars.includes('regnal') && core && !explicitInvalidCalendarDate) {
    const regnalFull = tryParseRegnal(core);
    if (regnalFull.matched && regnalFull.ok) {
      const precision = derivePrecisionFromParts(
        regnalFull.parts.month,
        regnalFull.parts.day
      );
      const pt: CalendarDatePoint = {
        calendar: 'regnal',
        precision,
        parts: regnalFull.parts,
      };
      addCandidate(
        suggestions,
        seen,
        buildStructuredDate(pt, qualifier),
        `${qPrefix}历史年号 · ${PRECISION_LABEL_MAP[precision]}`
      );
      appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
    } else {
      const sortedEras = [...REIGN_ERAS].sort(
        (a, b) => b.eraName.length - a.eraName.length
      );
      let matchedPartial = false;
      for (const era of sortedEras) {
        const prefixes = [
          `${era.dynastyName}${era.eraName}`,
          `${era.dynastyName.replace(/朝$/, '')}${era.eraName}`,
          era.eraName,
        ];
        for (const prefix of prefixes) {
          if (!core.startsWith(prefix)) continue;
          const rest = core.slice(prefix.length).trim();
          if (!rest) continue;
          const numMatch = rest.match(/^([元一二三四五六七八九十百\d]{1,5})$/);
          if (!numMatch) continue;
          const yearInEra = parseChineseOrArabicNumber(numMatch[1]);
          if (yearInEra && yearInEra >= 1 && yearInEra <= 200) {
            matchedPartial = true;
            const pt: CalendarDatePoint = {
              calendar: 'regnal',
              precision: 'year',
              parts: {
                dynastyId: era.dynastyId,
                eraId: era.id,
                eraName: era.eraName,
                yearInEra,
                month: null,
                isLeapMonth: false,
                day: null,
              },
            };
            const approxYear = era.startYear + yearInEra - 1;
            const approxText =
              approxYear < 0 ? `前${Math.abs(approxYear)}年` : `${approxYear}年`;
            addCandidate(
              suggestions,
              seen,
              buildStructuredDate(pt, qualifier),
              `${qPrefix}历史年号 · 约公元${approxText}`
            );
            appendCalendarConversions(pt, qualifier, calendars, suggestions, seen);
            break;
          }
        }
        if (matchedPartial) break;
      }

      // Era name prefix match (e.g. "光绪" / "洪武")
      if (!matchedPartial && /^[\u4e00-\u9fa5（）]+$/.test(core) && core.length >= 1) {
        const matchingEras = REIGN_ERAS.filter(
          (e) =>
            e.eraName.includes(core) ||
            `${e.dynastyName}${e.eraName}`.includes(core)
        ).slice(0, 4);
        for (const era of matchingEras) {
          const pt: CalendarDatePoint = {
            calendar: 'regnal',
            precision: 'year',
            parts: {
              dynastyId: era.dynastyId,
              eraId: era.id,
              eraName: era.eraName,
              yearInEra: 1,
              month: null,
              isLeapMonth: false,
              day: null,
            },
          };
          addCandidate(
            suggestions,
            seen,
            buildStructuredDate(pt, qualifier),
            `${era.dynastyName}${era.eraName}（${formatHistoricalYearSpan(era)}）`
          );
        }
      }
    }
  }

  // 4. Sexagenary cycle year (e.g. "甲午" or "甲午年")
  if (calendars.includes('sexagenary') && core && !explicitInvalidCalendarDate) {
    const cleanCycle = core.replace(/年$/, '');
    const cycleIndex = SIXTY_JIAZI.indexOf(cleanCycle);
    if (cycleIndex >= 0) {
      const pt: CalendarDatePoint = {
        calendar: 'sexagenary',
        precision: 'year',
        parts: {
          cycleYear: SIXTY_JIAZI[cycleIndex],
          cycleIndex,
          basis: 'lunar_new_year',
        },
      };
      addCandidate(
        suggestions,
        seen,
        buildStructuredDate(pt, qualifier),
        `${qPrefix}干支纪年 · 六十甲子`
      );
    }
  }

  // 5. Original archival text fallback (always last when enabled and not an explicit invalid calendar date)
  if (enableOriginal && !explicitInvalidCalendarDate && normalized.length <= 300) {
    const phraseDate = finalizeGenealogyDate({
      schemaVersion: 1,
      kind: 'phrase',
      originalText: normalized,
      time: null,
    });
    const isAlreadyPhraseOnly = suggestions.length === 0;
    addCandidate(
      suggestions,
      seen,
      phraseDate,
      isAlreadyPhraseOnly ? '原始记载 · 仅原文保存' : '按原始文本保存 · 不作标准化',
      'phrase'
    );
  }

  return suggestions;
}
