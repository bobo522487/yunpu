import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import { NativeSelect as Select } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  TRADITIONAL_BRANCHES,
  getCalendarBasisLabel,
  normalizeDatePoint,
} from '../calendar-adapter';
import {
  MAX_ORIGINAL_TEXT_LENGTH,
  cloneGenealogyDate,
  convertCalendarPoint,
  createDefaultGenealogyDate,
  createDefaultPoint,
  derivePrecisionFromParts,
  finalizeGenealogyDate,
  stripPrecisionParts,
  toCalendarDatePoint,
  validateGenealogyDate,
} from '../date-core';
import {
  formatDateTimeValue,
  formatGenealogyDate,
} from '../date-format';
import { parseQuickDateInput } from '../date-parser';
import type {
  CalendarDatePoint,
  CalendarType,
  DatePrecision,
  DateQualifier,
  DateTimeValue,
  GenealogyDate,
} from '../date.types';
import { GregorianDateFields } from './GregorianDateFields';
import {
  RegnalDateFields,
  SexagenaryDateFields,
} from './HistoricalDateFields';
import { LunarDateFields } from './LunarDateFields';

interface DateInputDialogProps {
  isOpen: boolean;
  title: string;
  value: GenealogyDate | null;
  onClose: () => void;
  onConfirm: (next: GenealogyDate | null) => void;
  calendars: CalendarType[];
  enableTime?: boolean;
  enableOriginal?: boolean;
  minYear?: number;
  maxYear?: number;
}

type MainTab = 'gregorian' | 'chinese_lunisolar' | 'historical' | 'phrase';

function getMainTabForDate(date: GenealogyDate): MainTab {
  if (date.kind === 'phrase') return 'phrase';
  const cal = date.kind === 'range' ? date.start.calendar : date.calendar;
  if (cal === 'gregorian') return 'gregorian';
  if (cal === 'chinese_lunisolar') return 'chinese_lunisolar';
  return 'historical';
}

function hasAdvancedOptions(date: GenealogyDate): boolean {
  if (date.kind === 'range') return true;
  if (date.time) return true;
  if (date.kind === 'date') {
    if (date.qualifier !== 'exact') return true;
    if (date.originalText?.trim()) return true;
  }
  return false;
}

const CALENDAR_LABELS: Record<CalendarType, string> = {
  gregorian: '公历',
  chinese_lunisolar: '农历',
  regnal: '年号纪年',
  sexagenary: '干支纪年',
};

const PRECISION_LABELS: Record<DatePrecision, string> = {
  year: '仅年份',
  month: '年月',
  day: '年月日',
};

const QUALIFIER_OPTIONS: Array<{ value: DateQualifier | 'range'; label: string }> = [
  { value: 'exact', label: '确定' },
  { value: 'about', label: '大约' },
  { value: 'before', label: '之前' },
  { value: 'after', label: '之后' },
  { value: 'range', label: '起止范围' },
];

export const DateInputDialog: React.FC<DateInputDialogProps> = ({
  isOpen,
  title,
  value,
  onClose,
  onConfirm,
  calendars,
  enableTime = false,
  enableOriginal = true,
  minYear = -3000,
  maxYear = 9999,
}) => {
  const defaultCalendar: CalendarType = calendars[0] || 'gregorian';
  const [draft, setDraft] = useState<GenealogyDate>(() =>
    value ? cloneGenealogyDate(value) : createDefaultGenealogyDate(defaultCalendar)
  );
  const [showMoreOptions, setShowMoreOptions] = useState<boolean>(() =>
    value ? hasAdvancedOptions(value) : false
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const anchorPointRef = useRef<CalendarDatePoint | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const nextDraft = value
      ? cloneGenealogyDate(value)
      : createDefaultGenealogyDate(defaultCalendar);
    setDraft(nextDraft);
    setShowMoreOptions(hasAdvancedOptions(nextDraft));
    setSubmitAttempted(false);

    if (nextDraft.kind === 'date') {
      anchorPointRef.current = toCalendarDatePoint(nextDraft);
    } else if (nextDraft.kind === 'range') {
      anchorPointRef.current = nextDraft.start;
    } else if (nextDraft.kind === 'phrase' && nextDraft.originalText.trim()) {
      const parsed = parseQuickDateInput(nextDraft.originalText, {
        calendars,
        enableOriginal,
        minYear,
        maxYear,
      });
      anchorPointRef.current =
        parsed.ok && parsed.value?.kind === 'date'
          ? toCalendarDatePoint(parsed.value)
          : null;
    } else {
      anchorPointRef.current = null;
    }
  }, [isOpen, value, defaultCalendar, calendars, enableOriginal, minYear, maxYear]);

  const validation = useMemo(() => validateGenealogyDate(draft), [draft]);

  const normalizedPreview = useMemo(() => {
    if (draft.kind === 'date') {
      return normalizeDatePoint(stripPrecisionParts(toCalendarDatePoint(draft)));
    }
    if (draft.kind === 'range') {
      const s = normalizeDatePoint(stripPrecisionParts(draft.start));
      const e = normalizeDatePoint(stripPrecisionParts(draft.end));
      return { startNorm: s, endNorm: e };
    }
    return null;
  }, [draft]);

  const advancedSummary = useMemo(() => {
    const parts: string[] = [];
    if (draft.kind === 'range') {
      parts.push('起止范围');
    } else if (draft.kind === 'date' && draft.qualifier !== 'exact') {
      const q = QUALIFIER_OPTIONS.find((o) => o.value === draft.qualifier);
      if (q) parts.push(q.label);
    }
    if (draft.time) {
      parts.push(formatDateTimeValue(draft.time));
    }
    if (draft.kind === 'date' && draft.originalText?.trim()) {
      parts.push('含原文');
    }
    return parts.join(' · ');
  }, [draft]);

  const hasGregorian = calendars.includes('gregorian');
  const hasLunar = calendars.includes('chinese_lunisolar');
  const hasRegnal = calendars.includes('regnal');
  const hasSexagenary = calendars.includes('sexagenary');
  const hasHistorical = hasRegnal || hasSexagenary;

  const activeMainTab = getMainTabForDate(draft);

  const resolveSourcePointForSwitch = (): CalendarDatePoint | null => {
    if (draft.kind === 'date') {
      if (draft.calendar === 'sexagenary' && anchorPointRef.current) {
        return anchorPointRef.current;
      }
      if (
        draft.calendar === 'regnal' &&
        anchorPointRef.current &&
        anchorPointRef.current.calendar !== 'regnal'
      ) {
        const anchorConverted = convertCalendarPoint(anchorPointRef.current, 'regnal');
        if (!anchorConverted.carried) {
          return anchorPointRef.current;
        }
      }
      return toCalendarDatePoint(draft);
    }
    if (draft.kind === 'range') {
      return draft.start;
    }
    if (draft.kind === 'phrase' && draft.originalText.trim()) {
      const parsed = parseQuickDateInput(draft.originalText, {
        calendars,
        enableOriginal,
        minYear,
        maxYear,
      });
      if (parsed.ok && parsed.value?.kind === 'date') {
        return toCalendarDatePoint(parsed.value);
      }
    }
    return anchorPointRef.current;
  };

  const handleSelectMainTab = (tab: MainTab) => {
    if (tab === activeMainTab) return;
    setSubmitAttempted(false);

    const existingOriginal =
      draft.kind === 'phrase' ? draft.originalText : draft.originalText ?? null;
    const existingTime = draft.time ?? null;

    if (tab === 'phrase') {
      if (draft.kind === 'date') {
        const resolved = resolveSourcePointForSwitch();
        if (resolved) anchorPointRef.current = resolved;
      } else if (draft.kind === 'range') {
        anchorPointRef.current = draft.start;
      }
      setDraft({
        schemaVersion: 1,
        kind: 'phrase',
        originalText: existingOriginal || '',
        time: existingTime,
      });
      return;
    }

    const nextCal: CalendarType =
      tab === 'gregorian'
        ? 'gregorian'
        : tab === 'chinese_lunisolar'
          ? 'chinese_lunisolar'
          : hasRegnal
            ? 'regnal'
            : 'sexagenary';

    const sourcePoint = resolveSourcePointForSwitch();
    const nextPoint = sourcePoint
      ? convertCalendarPoint(sourcePoint, nextCal).point
      : createDefaultPoint(nextCal);

    setDraft({
      schemaVersion: 1,
      kind: 'date',
      calendar: nextPoint.calendar,
      qualifier: draft.kind === 'date' ? draft.qualifier : 'exact',
      precision: nextPoint.precision,
      parts: nextPoint.parts,
      time: existingTime,
      originalText: existingOriginal,
      normalized: null,
    });
  };

  const handleSelectHistoricalSub = (subCal: 'regnal' | 'sexagenary') => {
    const existingOriginal =
      draft.kind === 'phrase' ? draft.originalText : draft.originalText ?? null;
    const existingTime = draft.time ?? null;
    const sourcePoint = resolveSourcePointForSwitch();
    const nextPoint = sourcePoint
      ? convertCalendarPoint(sourcePoint, subCal).point
      : createDefaultPoint(subCal);
    setDraft({
      schemaVersion: 1,
      kind: 'date',
      calendar: nextPoint.calendar,
      qualifier: draft.kind === 'date' ? draft.qualifier : 'exact',
      precision: nextPoint.precision,
      parts: nextPoint.parts,
      time: existingTime,
      originalText: existingOriginal,
      normalized: null,
    });
  };

  const handleQualifierChange = (nextVal: DateQualifier | 'range') => {
    if (nextVal === 'range') {
      if (draft.kind === 'range') return;
      const startPoint =
        draft.kind === 'date'
          ? toCalendarDatePoint(draft)
          : resolveSourcePointForSwitch() ?? createDefaultPoint(defaultCalendar);
      const endPoint: CalendarDatePoint = JSON.parse(JSON.stringify(startPoint));
      setDraft({
        schemaVersion: 1,
        kind: 'range',
        start: startPoint,
        end: endPoint,
        time: draft.time ?? null,
        originalText: draft.originalText ?? null,
      });
      return;
    }

    if (draft.kind === 'range') {
      const pt = draft.start;
      anchorPointRef.current = pt;
      setDraft({
        schemaVersion: 1,
        kind: 'date',
        calendar: pt.calendar,
        qualifier: nextVal,
        precision: pt.precision,
        parts: pt.parts,
        time: draft.time ?? null,
        originalText: draft.originalText ?? null,
        normalized: null,
      });
      return;
    }

    if (draft.kind === 'date') {
      setDraft({ ...draft, qualifier: nextVal });
    }
  };

  const renderPointEditor = (
    point: CalendarDatePoint,
    onPointChange: (next: CalendarDatePoint) => void,
    idPrefix: string,
    showPointCalendarSelect: boolean
  ) => {
    return (
      <div className="space-y-3">
        {showPointCalendarSelect && (
          <div>
            <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
              历法
            </label>
            <Select
              value={point.calendar}
              onChange={(e) => {
                const nextCal = e.target.value as CalendarType;
                onPointChange(convertCalendarPoint(point, nextCal).point);
              }}
            >
              {calendars.map((c) => (
                <option key={c} value={c} className="bg-card text-foreground">
                  {CALENDAR_LABELS[c]}
                </option>
              ))}
            </Select>
          </div>
        )}

        {point.calendar === 'gregorian' && (
          <GregorianDateFields
            value={point.parts}
            minYear={minYear}
            maxYear={maxYear}
            idPrefix={idPrefix}
            onChange={(parts) =>
              onPointChange({
                calendar: 'gregorian',
                precision: derivePrecisionFromParts(parts.month, parts.day),
                parts,
              })
            }
          />
        )}

        {point.calendar === 'chinese_lunisolar' && (
          <LunarDateFields
            value={point.parts}
            minYear={minYear}
            maxYear={maxYear}
            idPrefix={idPrefix}
            onChange={(parts) =>
              onPointChange({
                calendar: 'chinese_lunisolar',
                precision: derivePrecisionFromParts(parts.month, parts.day),
                parts,
              })
            }
          />
        )}

        {point.calendar === 'regnal' && (
          <RegnalDateFields
            value={point.parts}
            idPrefix={idPrefix}
            onChange={(parts) =>
              onPointChange({
                calendar: 'regnal',
                precision: derivePrecisionFromParts(parts.month, parts.day),
                parts,
              })
            }
          />
        )}

        {point.calendar === 'sexagenary' && (
          <SexagenaryDateFields
            value={point.parts}
            idPrefix={idPrefix}
            onChange={(parts) =>
              onPointChange({
                calendar: 'sexagenary',
                precision: 'year',
                parts,
              })
            }
          />
        )}
      </div>
    );
  };

  const timeMode: 'none' | 'traditional_hour' | 'clock' = !draft.time
    ? 'none'
    : draft.time.type;

  const setTimeMode = (nextMode: 'none' | 'traditional_hour' | 'clock') => {
    if (nextMode === 'none') {
      setDraft({ ...draft, time: null });
    } else if (nextMode === 'traditional_hour') {
      setDraft({
        ...draft,
        time:
          draft.time?.type === 'traditional_hour'
            ? draft.time
            : { type: 'traditional_hour', branch: 'zi' },
      });
    } else {
      setDraft({
        ...draft,
        time:
          draft.time?.type === 'clock'
            ? draft.time
            : { type: 'clock', hour: 12, minute: 0 },
      });
    }
  };

  const updateClockTime = (hour: number, minute: number) => {
    const nextTime: DateTimeValue = { type: 'clock', hour, minute };
    setDraft({ ...draft, time: nextTime });
  };

  const handleConfirmClick = () => {
    setSubmitAttempted(true);
    if (!validation.valid) return;
    onConfirm(finalizeGenealogyDate(draft));
  };

  const handleClearClick = () => {
    onConfirm(null);
  };

  const formattedPreview = formatGenealogyDate(draft);

  const renderTimeSelector = () => {
    if (!enableTime) return null;
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <Clock size={13} aria-hidden="true" />
          <span>时辰 / 时间（选填）</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { id: 'none', label: '不记录' },
              { id: 'traditional_hour', label: '十二时辰' },
              { id: 'clock', label: '具体时间' },
            ] as const
          ).map((opt) => {
            const active = timeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeMode(opt.id)}
                className={`h-8 px-2.5 rounded-md border text-[13px] transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[var(--surface-active)] border-primary/60 text-foreground font-semibold'
                    : 'bg-background border-input text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {draft.time?.type === 'traditional_hour' && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
              {TRADITIONAL_BRANCHES.map((item) => {
                const active =
                  draft.time?.type === 'traditional_hour' &&
                  draft.time.branch === item.branch;
                return (
                  <button
                    key={item.branch}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        time: {
                          type: 'traditional_hour',
                          branch: item.branch,
                        },
                      })
                    }
                    className={`h-8 rounded-md border text-[12px] transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--surface-active)] border-primary/60 text-foreground font-semibold'
                        : 'bg-background border-input text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {(() => {
                const b = TRADITIONAL_BRANCHES.find(
                  (item) =>
                    draft.time?.type === 'traditional_hour' &&
                    item.branch === draft.time.branch
                );
                return b
                  ? `${b.label}约对应 ${b.approxRange}，传统时辰仅按地支保存。`
                  : '';
              })()}
            </div>
          </div>
        )}

        {draft.time?.type === 'clock' && (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="date-clock-hour"
                className="block text-[12px] font-medium text-muted-foreground mb-1.5"
              >
                小时
              </label>
              <Select
                id="date-clock-hour"
                value={String(draft.time.hour)}
                onChange={(e) =>
                  updateClockTime(
                    Number(e.target.value),
                    draft.time?.type === 'clock' ? draft.time.minute : 0
                  )
                }
                className="tabular-nums"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={String(h)} className="bg-card text-foreground">
                    {String(h).padStart(2, '0')} 时
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                htmlFor="date-clock-minute"
                className="block text-[12px] font-medium text-muted-foreground mb-1.5"
              >
                分钟
              </label>
              <Select
                id="date-clock-minute"
                value={String(draft.time.minute)}
                onChange={(e) =>
                  updateClockTime(
                    draft.time?.type === 'clock' ? draft.time.hour : 0,
                    Number(e.target.value)
                  )
                }
                className="tabular-nums"
              >
                {Array.from({ length: 60 }, (_, m) => (
                  <option key={m} value={String(m)} className="bg-card text-foreground">
                    {String(m).padStart(2, '0')} 分
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      size="lg"
      zIndexClass="z-[110]"
      ariaLabelledBy="date-dialog-title"
    >
      <ModalHeader
        titleId="date-dialog-title"
        title={title}
        icon={<Calendar size={18} className="text-primary" aria-hidden="true" />}
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {/* 1. Main Calendar Tabs */}
        <div
          role="tablist"
          aria-label="历法选择"
          className="flex items-center gap-1 p-1 rounded-lg bg-[var(--surface-subtle)] border border-border"
        >
          {hasGregorian && (
            <button
              type="button"
              role="tab"
              aria-selected={activeMainTab === 'gregorian'}
              onClick={() => handleSelectMainTab('gregorian')}
              className={`flex-1 py-1.5 px-2.5 text-[13px] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMainTab === 'gregorian'
                  ? 'bg-card text-primary font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              公历
            </button>
          )}
          {hasLunar && (
            <button
              type="button"
              role="tab"
              aria-selected={activeMainTab === 'chinese_lunisolar'}
              onClick={() => handleSelectMainTab('chinese_lunisolar')}
              className={`flex-1 py-1.5 px-2.5 text-[13px] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMainTab === 'chinese_lunisolar'
                  ? 'bg-card text-primary font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              农历
            </button>
          )}
          {hasHistorical && (
            <button
              type="button"
              role="tab"
              aria-selected={activeMainTab === 'historical'}
              onClick={() => handleSelectMainTab('historical')}
              className={`flex-1 py-1.5 px-2.5 text-[13px] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMainTab === 'historical'
                  ? 'bg-card text-primary font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              历史纪年
            </button>
          )}
          {enableOriginal && (
            <button
              type="button"
              role="tab"
              aria-selected={activeMainTab === 'phrase'}
              onClick={() => handleSelectMainTab('phrase')}
              className={`flex-1 py-1.5 px-2.5 text-[13px] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMainTab === 'phrase'
                  ? 'bg-card text-primary font-semibold shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground font-medium'
              }`}
            >
              仅原文
            </button>
          )}
        </div>

        {/* 2. Historical sub-mode switch */}
        {activeMainTab === 'historical' &&
          draft.kind === 'date' &&
          hasRegnal &&
          hasSexagenary && (
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'regnal', label: '年号纪年（如洪武/光绪）' },
                  { id: 'sexagenary', label: '干支纪年（六十甲子）' },
                ] as const
              ).map((sub) => {
                const active = draft.calendar === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => handleSelectHistoricalSub(sub.id)}
                    className={`h-8 px-2.5 rounded-md border text-[13px] transition-colors cursor-pointer whitespace-nowrap truncate ${
                      active
                        ? 'bg-[var(--surface-active)] border-primary/60 text-foreground font-semibold'
                        : 'bg-background border-input text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          )}

        {/* 3. Core Date Fields (Single Date vs Range vs Phrase) */}
        {draft.kind === 'date' && (
          <div>
            {renderPointEditor(
              toCalendarDatePoint(draft),
              (nextPt) => {
                anchorPointRef.current = nextPt;
                setDraft({
                  ...draft,
                  calendar: nextPt.calendar,
                  precision: nextPt.precision,
                  parts: nextPt.parts,
                });
              },
              'single-date',
              false
            )}
          </div>
        )}

        {draft.kind === 'range' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[13px] font-semibold text-foreground">
                开始日期
              </div>
              {renderPointEditor(
                draft.start,
                (nextStart) => {
                  anchorPointRef.current = nextStart;
                  setDraft({ ...draft, start: nextStart });
                },
                'range-start',
                true
              )}
            </div>
            <div className="space-y-2 pt-3 border-t border-border/60">
              <div className="text-[13px] font-semibold text-foreground">
                结束日期
              </div>
              {renderPointEditor(
                draft.end,
                (nextEnd) => setDraft({ ...draft, end: nextEnd }),
                'range-end',
                true
              )}
            </div>
          </div>
        )}

        {draft.kind === 'phrase' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="date-original-text"
                  className="text-[13px] font-medium text-foreground"
                >
                  原始日期记载（必填）
                </label>
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {(draft.originalText || '').length}/{MAX_ORIGINAL_TEXT_LENGTH}
                </span>
              </div>
              <Textarea
                id="date-original-text"
                rows={2}
                maxLength={MAX_ORIGINAL_TEXT_LENGTH}
                value={draft.originalText || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    originalText: e.target.value,
                  })
                }
                placeholder="例如：清末某年春季 / 民国初年二月 / 明洪武十八年乙丑三月初六日亥时"
                className="min-h-[68px] p-3 resize-none leading-relaxed"
              />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                适用于难以拆分为具体年月的古籍表述，原样保存且不会被覆盖。
              </p>
            </div>
            {renderTimeSelector()}
          </div>
        )}

        {/* 4. Single Collapsible "更多选项" Section */}
        {draft.kind !== 'phrase' && (
          <div className="pt-2 border-t border-border/60">
            <button
              type="button"
              aria-expanded={showMoreOptions}
              onClick={() => setShowMoreOptions((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 py-1 text-left text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-medium">
                {showMoreOptions ? (
                  <ChevronDown size={15} aria-hidden="true" />
                ) : (
                  <ChevronRight size={15} aria-hidden="true" />
                )}
                <span>
                  更多选项（不确定性
                  {enableTime ? ' · 时辰' : ''}
                  {' · 范围'}
                  {enableOriginal ? ' · 原文' : ''}）
                </span>
              </span>
              {!showMoreOptions && advancedSummary && (
                <span className="text-[12px] text-primary font-medium truncate max-w-[200px]">
                  已设：{advancedSummary}
                </span>
              )}
            </button>

            {showMoreOptions && (
              <div className="mt-3 space-y-4 pt-3 border-t border-border/50">
                <div>
                  <span className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                    日期性质与范围
                  </span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {QUALIFIER_OPTIONS.map((opt) => {
                      const currentVal =
                        draft.kind === 'range' ? 'range' : draft.qualifier;
                      const active = currentVal === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleQualifierChange(opt.value)}
                          className={`h-8 px-1.5 rounded-md border text-[13px] transition-colors cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[var(--surface-active)] border-primary/60 text-foreground font-semibold'
                              : 'bg-background border-input text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {renderTimeSelector()}

                {enableOriginal && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="date-original-text"
                        className="text-[12px] font-medium text-muted-foreground"
                      >
                        原始日期记载（选填，独立保存不被覆盖）
                      </label>
                      <span className="text-[12px] text-muted-foreground tabular-nums">
                        {(draft.originalText || '').length}/{MAX_ORIGINAL_TEXT_LENGTH}
                      </span>
                    </div>
                    <Textarea
                      id="date-original-text"
                      rows={2}
                      maxLength={MAX_ORIGINAL_TEXT_LENGTH}
                      value={draft.originalText || ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          originalText: e.target.value,
                        })
                      }
                      placeholder="例如：明洪武十八年乙丑三月初六日亥时"
                      className="min-h-[60px] p-2.5 resize-none leading-relaxed"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Compact Live Preview & Conversion Status */}
        <div className="rounded-lg border border-border bg-[var(--surface-subtle)] p-3.5 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">
              日期预览
            </span>
            <span className="text-[12px] text-muted-foreground">
              {draft.kind === 'phrase'
                ? '原始记载'
                : draft.kind === 'range'
                  ? '日期范围'
                  : `${CALENDAR_LABELS[draft.calendar]} · ${PRECISION_LABELS[draft.precision]}`}
            </span>
          </div>

          <div className="text-[14px] font-semibold text-foreground tabular-nums">
            {formattedPreview || '尚未填写有效日期'}
          </div>

          {draft.kind === 'date' &&
            normalizedPreview &&
            'status' in normalizedPreview && (
              <div className="text-[12px] text-muted-foreground space-y-0.5 leading-relaxed">
                {normalizedPreview.status === 'exact' && normalizedPreview.start ? (
                  <div className="tabular-nums">
                    辅助公历：{normalizedPreview.start}（{getCalendarBasisLabel(normalizedPreview.calendarBasis)}）
                  </div>
                ) : normalizedPreview.status === 'period' &&
                  normalizedPreview.start &&
                  normalizedPreview.end ? (
                  <div className="tabular-nums">
                    辅助公历区间：{normalizedPreview.start} 至 {normalizedPreview.end}（{getCalendarBasisLabel(normalizedPreview.calendarBasis)}）
                  </div>
                ) : (
                  <div>
                    对应公历：暂无法唯一换算（仅作历史结构化保留）
                  </div>
                )}
                {normalizedPreview.note && (
                  <div className="flex items-start gap-1">
                    <Info size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{normalizedPreview.note}</span>
                  </div>
                )}
              </div>
            )}

          {(submitAttempted || validation.errors.length > 0) &&
            validation.errors.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border/60">
                {validation.errors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 text-[12px] text-destructive font-medium"
                  >
                    <AlertCircle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

          {validation.warnings.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/60">
              {validation.warnings.map((warn, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[12px] text-amber-700 dark:text-amber-400"
                >
                  <Info size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter className="justify-between bg-card">
        <div>
          {(value || draft.originalText) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearClick}
              className="text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 size={13} />
              <span>清空日期</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <Button type="button" variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!validation.valid}
            onClick={handleConfirmClick}
          >
            确定
          </Button>
        </div>
      </ModalFooter>
    </ModalShell>
  );
};
