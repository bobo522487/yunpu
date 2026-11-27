export type CalendarType =
  | 'gregorian'
  | 'chinese_lunisolar'
  | 'regnal'
  | 'sexagenary';

export type DatePrecision = 'year' | 'month' | 'day';

export type DateQualifier = 'exact' | 'about' | 'before' | 'after';

export type TimeBranch =
  | 'zi'
  | 'chou'
  | 'yin'
  | 'mao'
  | 'chen'
  | 'si'
  | 'wu'
  | 'wei'
  | 'shen'
  | 'you'
  | 'xu'
  | 'hai';

export type SexagenaryBasis = 'lunar_new_year' | 'lichun';

export type CalendarBasis =
  | 'gregorian'
  | 'julian'
  | 'julian_gregorian_hybrid'
  | 'historical_chinese';

export interface GregorianParts {
  year: number;
  month?: number | null;
  day?: number | null;
}

export interface LunarParts {
  year: number;
  month?: number | null;
  isLeapMonth?: boolean;
  day?: number | null;
}

/**
 * 历史年号独立定义月日结构，不直接复用现代 GB/T 33661 农历结构，
 * 以避免将不同朝代（如建子/建丑/改元）的历法规则混同为现代农历。
 */
export interface RegnalParts {
  dynastyId?: string;
  eraId?: string;
  eraName: string;
  yearInEra: number;
  month?: number | null;
  isLeapMonth?: boolean;
  day?: number | null;
}

export interface SexagenaryParts {
  cycleYear: string;
  cycleIndex: number; // 0-based (0 = 甲子, 59 = 癸亥)
  basis: SexagenaryBasis;
}

export type CalendarDatePoint =
  | {
      calendar: 'gregorian';
      precision: DatePrecision;
      parts: GregorianParts;
    }
  | {
      calendar: 'chinese_lunisolar';
      precision: DatePrecision;
      parts: LunarParts;
    }
  | {
      calendar: 'regnal';
      precision: DatePrecision;
      parts: RegnalParts;
    }
  | {
      calendar: 'sexagenary';
      precision: 'year';
      parts: SexagenaryParts;
    };

export type DateTimeValue =
  | {
      type: 'traditional_hour';
      branch: TimeBranch;
      subPeriod?: 'early' | 'late';
    }
  | {
      type: 'clock';
      hour: number;
      minute: number;
    };

export interface NormalizedDate {
  status: 'exact' | 'period' | 'ambiguous' | 'unsupported';
  calendarBasis?: CalendarBasis;
  start?: string | null; // YYYY-MM-DD (no timezone)
  end?: string | null; // YYYY-MM-DD (no timezone)
  engine?: string;
  engineVersion?: string;
  note?: string;
}

export type GenealogyDate =
  | {
      schemaVersion: 1;
      kind: 'date';
      calendar: CalendarType;
      qualifier: DateQualifier;
      precision: DatePrecision;
      parts: GregorianParts | LunarParts | RegnalParts | SexagenaryParts;
      time?: DateTimeValue | null;
      originalText?: string | null;
      normalized?: NormalizedDate | null;
    }
  | {
      schemaVersion: 1;
      kind: 'range';
      start: CalendarDatePoint;
      end: CalendarDatePoint;
      time?: DateTimeValue | null;
      originalText?: string | null;
    }
  | {
      schemaVersion: 1;
      kind: 'phrase';
      originalText: string;
      calendarHint?: CalendarType | null;
      time?: DateTimeValue | null;
    };

export interface LunarMonthInfo {
  month: number; // 1..12
  isLeapMonth: boolean;
  monthWithLeap: number; // positive normal, negative leap
  days: 29 | 30;
  label: string;
}

export interface LunarYearInfo {
  year: number;
  ganzhiLunarYear: string;
  ganzhiLichunYear: string;
  leapMonth: number; // 0 if none
  months: LunarMonthInfo[];
  supported: boolean;
}
