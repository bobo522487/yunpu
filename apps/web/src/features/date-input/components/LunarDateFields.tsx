import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect as Select } from '@/components/ui/native-select';
import {
  LUNAR_DAY_LABELS,
  LUNAR_MONTH_LABELS,
  getLunarYearInfo,
} from '../calendar-adapter';
import type { LunarParts } from '../date.types';

interface LunarDateFieldsProps {
  value: LunarParts;
  onChange: (next: LunarParts) => void;
  minYear?: number;
  maxYear?: number;
  idPrefix?: string;
}

export const LunarDateFields: React.FC<LunarDateFieldsProps> = ({
  value,
  onChange,
  minYear = -3000,
  maxYear = 9999,
  idPrefix = 'lunar',
}) => {
  const yearInfo = useMemo(() => getLunarYearInfo(value.year), [value.year]);

  const selectedMonthValue = value.month
    ? `${value.month}:${value.isLeapMonth ? '1' : '0'}`
    : '';

  const matchedMonth = useMemo(() => {
    if (!value.month) return undefined;
    return yearInfo.months.find(
      (m) => m.month === value.month && m.isLeapMonth === Boolean(value.isLeapMonth)
    );
  }, [yearInfo.months, value.month, value.isLeapMonth]);

  const dayCount = matchedMonth?.days ?? 30;

  const handleYearChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      onChange({ ...value, year: 0 });
      return;
    }
    const clamped = Math.max(minYear, Math.min(maxYear, parsed));
    const nextYearInfo = getLunarYearInfo(clamped);

    let nextMonth = value.month ?? null;
    let nextIsLeap = Boolean(value.isLeapMonth);
    let nextDay = value.day ?? null;

    if (nextYearInfo.supported && nextMonth) {
      const nextMatched = nextYearInfo.months.find(
        (m) => m.month === nextMonth && m.isLeapMonth === nextIsLeap
      );
      if (!nextMatched) {
        nextIsLeap = false;
        const fallback = nextYearInfo.months.find(
          (m) => m.month === nextMonth && !m.isLeapMonth
        );
        if (!fallback) {
          nextMonth = null;
          nextDay = null;
        } else if (nextDay && nextDay > fallback.days) {
          nextDay = null;
        }
      } else if (nextDay && nextDay > nextMatched.days) {
        nextDay = null;
      }
    }

    onChange({
      ...value,
      year: clamped,
      month: nextMonth,
      isLeapMonth: nextIsLeap,
      day: nextDay,
    });
  };

  const handleMonthChange = (raw: string) => {
    if (!raw) {
      onChange({ ...value, month: null, isLeapMonth: false, day: null });
      return;
    }
    const [mStr, leapFlag] = raw.split(':');
    const month = Number(mStr);
    const isLeapMonth = leapFlag === '1';
    const nextMatched = yearInfo.months.find(
      (m) => m.month === month && m.isLeapMonth === isLeapMonth
    );
    const nextMaxDays = nextMatched?.days ?? 30;
    const nextDay = value.day && value.day <= nextMaxDays ? value.day : null;
    onChange({
      ...value,
      month,
      isLeapMonth,
      day: nextDay,
    });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label
            htmlFor={`${idPrefix}-year`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            农历年份
          </label>
          <Input
            id={`${idPrefix}-year`}
            type="number"
            min={minYear}
            max={maxYear}
            value={value.year === 0 ? '' : value.year}
            onChange={(e) => handleYearChange(e.target.value)}
            placeholder="例如：2014"
            className="tabular-nums"
          />
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-month`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            月份（可留空）
          </label>
          <Select
            id={`${idPrefix}-month`}
            value={selectedMonthValue}
            isPlaceholder={!selectedMonthValue}
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            <option value="" className="bg-card text-muted-foreground">
              不详（仅年份）
            </option>
            {yearInfo.months.map((m) => (
              <option
                key={`${m.month}:${m.isLeapMonth ? '1' : '0'}`}
                value={`${m.month}:${m.isLeapMonth ? '1' : '0'}`}
                className="bg-card text-foreground"
              >
                {m.label}（{m.days}天）
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-day`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            日期（可留空）
          </label>
          <Select
            id={`${idPrefix}-day`}
            value={value.day ? String(value.day) : ''}
            isPlaceholder={!value.day}
            disabled={!value.month}
            onChange={(e) =>
              onChange({
                ...value,
                day: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="" className="bg-card text-muted-foreground">
              {value.month ? '不详（仅年月）' : '请先选月'}
            </option>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d)} className="bg-card text-foreground">
                {LUNAR_DAY_LABELS[d - 1] || `${d}日`}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Auxiliary lunar year Ganzhi & leap month info as quiet unboxed text */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
        {yearInfo.supported ? (
          <>
            <span>农历干支：{yearInfo.ganzhiLunarYear}年</span>
            <span aria-hidden="true">·</span>
            <span>
              {yearInfo.leapMonth > 0
                ? `当年有闰${LUNAR_MONTH_LABELS[yearInfo.leapMonth] || `${yearInfo.leapMonth}月`}`
                : '当年无闰月'}
            </span>
          </>
        ) : (
          <span>该年份超出历法引擎推算范围（-1至9999年），将按原始结构保存</span>
        )}
      </div>
    </div>
  );
};
