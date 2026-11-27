import React from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect as Select } from '@/components/ui/native-select';
import { getGregorianDayOptions } from '../calendar-adapter';
import type { GregorianParts } from '../date.types';

interface GregorianDateFieldsProps {
  value: GregorianParts;
  onChange: (next: GregorianParts) => void;
  minYear?: number;
  maxYear?: number;
  idPrefix?: string;
}

export const GregorianDateFields: React.FC<GregorianDateFieldsProps> = ({
  value,
  onChange,
  minYear = -3000,
  maxYear = 9999,
  idPrefix = 'gregorian',
}) => {
  const days = value.month ? getGregorianDayOptions(value.year, value.month) : [];

  const handleYearChange = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      onChange({ ...value, year: 0 });
      return;
    }
    const clamped = Math.max(minYear, Math.min(maxYear, parsed));
    let nextDay = value.day ?? null;
    if (value.month && nextDay) {
      const nextValidDays = getGregorianDayOptions(clamped, value.month);
      if (!nextValidDays.includes(nextDay)) {
        nextDay = null;
      }
    }
    onChange({ ...value, year: clamped, day: nextDay });
  };

  const handleMonthChange = (raw: string) => {
    const month = raw ? Number(raw) : null;
    if (!month) {
      onChange({ ...value, month: null, day: null });
      return;
    }
    let nextDay = value.day ?? null;
    if (nextDay) {
      const nextValidDays = getGregorianDayOptions(value.year, month);
      if (!nextValidDays.includes(nextDay)) {
        nextDay = null;
      }
    }
    onChange({ ...value, month, day: nextDay });
  };

  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div>
        <label
          htmlFor={`${idPrefix}-year`}
          className="block text-[12px] font-medium text-muted-foreground mb-1.5"
        >
          公历年份
        </label>
        <Input
          id={`${idPrefix}-year`}
          type="number"
          min={minYear}
          max={maxYear}
          value={value.year === 0 ? '' : value.year}
          onChange={(e) => handleYearChange(e.target.value)}
          placeholder="例如：1912"
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
          value={value.month ? String(value.month) : ''}
          isPlaceholder={!value.month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="tabular-nums"
        >
          <option value="" className="bg-card text-muted-foreground">
            不详（仅年份）
          </option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={String(m)} className="bg-card text-foreground">
              {m}月
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
          disabled={!value.month || days.length === 0}
          onChange={(e) =>
            onChange({
              ...value,
              day: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="tabular-nums"
        >
          <option value="" className="bg-card text-muted-foreground">
            {value.month ? '不详（仅年月）' : '请先选月'}
          </option>
          {days.map((d) => (
            <option key={d} value={String(d)} className="bg-card text-foreground">
              {d}日
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
};
