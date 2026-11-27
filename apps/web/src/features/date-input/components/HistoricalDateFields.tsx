import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NativeSelect as Select } from '@/components/ui/native-select';
import {
  LUNAR_DAY_LABELS,
  LUNAR_MONTH_LABELS,
  SIXTY_JIAZI,
} from '../calendar-adapter';
import type {
  RegnalParts,
  SexagenaryBasis,
  SexagenaryParts,
} from '../date.types';
import {
  DYNASTIES,
  REIGN_ERAS,
  findEraById,
  formatHistoricalYearSpan,
} from '../era-data';

interface RegnalFieldsProps {
  value: RegnalParts;
  onChange: (next: RegnalParts) => void;
  idPrefix?: string;
}

export const RegnalDateFields: React.FC<RegnalFieldsProps> = ({
  value,
  onChange,
  idPrefix = 'regnal',
}) => {
  const [eraQuery, setEraQuery] = useState('');
  const [customMode, setCustomMode] = useState(
    Boolean(value.eraName && !value.eraId && !findEraById(value.eraId))
  );

  const activeDynastyId = value.dynastyId || '';
  const selectedEra = findEraById(value.eraId);

  const filteredEras = useMemo(() => {
    const q = eraQuery.trim();
    return REIGN_ERAS.filter((era) => {
      if (activeDynastyId && era.dynastyId !== activeDynastyId) return false;
      if (!q) return true;
      return (
        era.eraName.includes(q) ||
        era.dynastyName.includes(q) ||
        era.ruler.includes(q)
      );
    });
  }, [activeDynastyId, eraQuery]);

  const handleDynastyChange = (dynastyId: string) => {
    const firstInDynasty = dynastyId
      ? REIGN_ERAS.find((e) => e.dynastyId === dynastyId)
      : REIGN_ERAS[0];
    if (!customMode && firstInDynasty) {
      onChange({
        ...value,
        dynastyId: dynastyId || undefined,
        eraId: firstInDynasty.id,
        eraName: firstInDynasty.eraName,
        yearInEra: Math.min(value.yearInEra || 1, firstInDynasty.maxYear),
      });
    } else {
      onChange({
        ...value,
        dynastyId: dynastyId || undefined,
      });
    }
  };

  const handleEraSelect = (eraId: string) => {
    if (eraId === '__custom__') {
      setCustomMode(true);
      onChange({
        ...value,
        eraId: undefined,
        eraName: value.eraName || '',
      });
      return;
    }
    setCustomMode(false);
    const found = findEraById(eraId);
    if (found) {
      onChange({
        ...value,
        dynastyId: found.dynastyId,
        eraId: found.id,
        eraName: found.eraName,
        yearInEra: value.yearInEra || 1,
      });
    }
  };

  return (
    <div className="space-y-3">
      {/* Row 1: Era quick filter + Dynasty */}
      {!customMode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/75"
            />
            <Input
              value={eraQuery}
              onChange={(e) => setEraQuery(e.target.value)}
              placeholder="检索年号或帝号（如 洪武、光绪）"
              className="pl-8.5"
            />
          </div>

          <Select
            id={`${idPrefix}-dynasty`}
            aria-label="朝代筛选"
            value={activeDynastyId}
            isPlaceholder={!activeDynastyId}
            onChange={(e) => handleDynastyChange(e.target.value)}
          >
            <option value="" className="bg-card text-foreground">
              全部朝代
            </option>
            {DYNASTIES.map((d) => (
              <option key={d.id} value={d.id} className="bg-card text-foreground">
                {d.name}（{d.periodLabel}）
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Row 2: Era + Year in Era */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor={`${idPrefix}-era`}
              className="text-[12px] font-medium text-muted-foreground"
            >
              年号
            </label>
            <button
              type="button"
              onClick={() => {
                if (customMode) {
                  setCustomMode(false);
                  const fallback = filteredEras[0] || REIGN_ERAS[0];
                  onChange({
                    ...value,
                    dynastyId: fallback.dynastyId,
                    eraId: fallback.id,
                    eraName: fallback.eraName,
                  });
                } else {
                  setCustomMode(true);
                  onChange({ ...value, eraId: undefined });
                }
              }}
              className="text-[12px] font-medium text-primary hover:underline cursor-pointer"
            >
              {customMode ? '选内置年号' : '手动填写'}
            </button>
          </div>
          {customMode ? (
            <Input
              id={`${idPrefix}-era`}
              value={value.eraName}
              onChange={(e) =>
                onChange({ ...value, eraId: undefined, eraName: e.target.value })
              }
              placeholder="输入古籍年号"
            />
          ) : (
            <Select
              id={`${idPrefix}-era`}
              value={value.eraId || ''}
              isPlaceholder={!value.eraId}
              onChange={(e) => handleEraSelect(e.target.value)}
            >
              <option value="" className="bg-card text-placeholder">
                选择年号
              </option>
              {filteredEras.map((era) => (
                <option
                  key={era.id}
                  value={era.id}
                  className="bg-card text-foreground"
                >
                  {era.dynastyName} · {era.eraName}
                </option>
              ))}
              <option value="__custom__" className="bg-card text-primary">
                + 自定义其他年号...
              </option>
            </Select>
          )}
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-year-in-era`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            年次（第几年）
          </label>
          <Input
            id={`${idPrefix}-year-in-era`}
            type="number"
            min={1}
            max={200}
            value={value.yearInEra || ''}
            onChange={(e) => {
              const num = parseInt(e.target.value, 10);
              onChange({
                ...value,
                yearInEra: Number.isNaN(num) ? 0 : Math.max(1, Math.min(200, num)),
              });
            }}
            placeholder="例如：23"
            className="tabular-nums"
          />
        </div>
      </div>

      {/* Row 3: Optional Historical Month & Day */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 items-end">
        <div>
          <label
            htmlFor={`${idPrefix}-month`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            历史月份（可留空）
          </label>
          <Select
            id={`${idPrefix}-month`}
            value={value.month ? String(value.month) : ''}
            isPlaceholder={!value.month}
            onChange={(e) => {
              const nextMonth = e.target.value ? Number(e.target.value) : null;
              onChange({
                ...value,
                month: nextMonth,
                isLeapMonth: nextMonth ? value.isLeapMonth : false,
                day: nextMonth ? value.day : null,
              });
            }}
          >
            <option value="" className="bg-card text-muted-foreground">
              不详（仅年份）
            </option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={String(m)} className="bg-card text-foreground">
                {LUNAR_MONTH_LABELS[m] || `${m}月`}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-day`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            历史日期（可留空）
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
            {LUNAR_DAY_LABELS.map((label, idx) => (
              <option
                key={label}
                value={String(idx + 1)}
                className="bg-card text-foreground"
              >
                {label}
              </option>
            ))}
          </Select>
        </div>

        {value.month ? (
          <label className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-card text-[13px] text-foreground cursor-pointer select-none col-span-2 sm:col-span-1">
            <input
              type="checkbox"
              checked={Boolean(value.isLeapMonth)}
              onChange={(e) =>
                onChange({ ...value, isLeapMonth: e.target.checked })
              }
              className="rounded border-input accent-primary h-4 w-4 cursor-pointer"
            />
            <span>史载为闰月</span>
          </label>
        ) : null}
      </div>

      {/* Selected era historical context */}
      {selectedEra ? (
        <div className="text-[12px] text-muted-foreground leading-relaxed">
          <span>{selectedEra.ruler}</span>
          <span aria-hidden="true"> · </span>
          <span className="tabular-nums">
            {formatHistoricalYearSpan(selectedEra)}（限 {selectedEra.maxYear} 年）
          </span>
          <span aria-hidden="true"> · </span>
          <span>
            {selectedEra.conversionStatus === 'verified'
              ? '支持辅助公历换算'
              : selectedEra.conversionStatus === 'partial'
                ? '存在改元交叉，公历仅作参考'
                : '仅记录史料年号，暂不自动换算公历'}
          </span>
          {selectedEra.note && (
            <div className="mt-0.5">注：{selectedEra.note}</div>
          )}
        </div>
      ) : (
        <div className="text-[12px] text-muted-foreground">
          未匹配内置年号字典：系统将完整保存自定义年号与史料记载，不做公历推断。
        </div>
      )}
    </div>
  );
};

interface SexagenaryFieldsProps {
  value: SexagenaryParts;
  onChange: (next: SexagenaryParts) => void;
  idPrefix?: string;
}

export const SexagenaryDateFields: React.FC<SexagenaryFieldsProps> = ({
  value,
  onChange,
  idPrefix = 'sexagenary',
}) => {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor={`${idPrefix}-cycle`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            六十甲子干支年
          </label>
          <Select
            id={`${idPrefix}-cycle`}
            value={value.cycleYear}
            onChange={(e) => {
              const cycleYear = e.target.value;
              const cycleIndex = SIXTY_JIAZI.indexOf(cycleYear);
              onChange({
                ...value,
                cycleYear,
                cycleIndex: cycleIndex >= 0 ? cycleIndex : 0,
              });
            }}
          >
            {SIXTY_JIAZI.map((gz, idx) => (
              <option key={gz} value={gz} className="bg-card text-foreground">
                {String(idx + 1).padStart(2, '0')} · {gz}年
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label
            htmlFor={`${idPrefix}-basis`}
            className="block text-[12px] font-medium text-muted-foreground mb-1.5"
          >
            换年历法依据
          </label>
          <Select
            id={`${idPrefix}-basis`}
            value={value.basis}
            onChange={(e) =>
              onChange({
                ...value,
                basis: e.target.value as SexagenaryBasis,
              })
            }
          >
            <option value="lunar_new_year" className="bg-card text-foreground">
              农历正月初一换年（家谱常规）
            </option>
            <option value="lichun" className="bg-card text-foreground">
              立春交节时刻换年（干支岁首）
            </option>
          </Select>
        </div>
      </div>

      <p className="text-[12px] text-muted-foreground leading-relaxed">
        干支纪年每 60 年周而复始，仅凭干支不会自动推断公元年份；若已知具体年份或年号，请优先使用公历、农历或年号纪年录入。
      </p>
    </div>
  );
};
