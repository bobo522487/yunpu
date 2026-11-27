import React from 'react';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { getPersonDateDisplay } from '../../date-input';
import { getPersonPlaceDisplay } from '../../place-input';
import { formatVitalGenderText } from '../domain/personDetailActions';
import type { PersonRecord } from '../types';
import type { VitalQuickEditField } from './PersonVitalEditModal';

interface PersonVitalsSectionProps {
  person: PersonRecord;
  displayName: string;
  romanizedDisplay: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onQuickEditVital: (field: VitalQuickEditField) => void;
  onOpenBirthEvent: () => void;
  onOpenDeathEvent: () => void;
}

export const PersonVitalsSection: React.FC<PersonVitalsSectionProps> = ({
  person,
  displayName,
  romanizedDisplay,
  expanded,
  onToggleExpand,
  onQuickEditVital,
  onOpenBirthEvent,
  onOpenDeathEvent,
}) => {
  const vitalGenderText = formatVitalGenderText(person.gender);
  const vitalBirthDateText = getPersonDateDisplay(person, 'birth').trim();
  const vitalBirthPlaceText = getPersonPlaceDisplay(person, 'birth').trim();
  const vitalDeathDateText = getPersonDateDisplay(person, 'death').trim();
  const vitalDeathPlaceText = getPersonPlaceDisplay(person, 'death').trim();

  return (
    <section
      data-testid="section-card-vitals"
      className="px-5 py-4 border-b border-border/70"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 text-left py-1 rounded text-[14px] font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <span>基本资料</span>
          {expanded ? (
            <ChevronUp
              size={14}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown
              size={14}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5">
          {/* 2-Column Vitals Grid: 姓名 / 性别 / 出生 / 死亡 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {/* 1. 姓名 */}
            <div
              data-testid="highlight-NAME"
              className="group relative rounded-lg px-2.5 py-2 -mx-2.5 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => onQuickEditVital('name')}
                className="w-full text-left pr-8 cursor-pointer"
              >
                <div className="text-[12px] font-medium text-muted-foreground">
                  姓名
                </div>
                <div className="mt-0.5 text-[14px] font-medium text-foreground leading-snug break-words">
                  <span>{displayName}</span>
                  {romanizedDisplay && (
                    <span className="block text-[12px] font-normal text-muted-foreground">
                      {romanizedDisplay}
                    </span>
                  )}
                </div>
              </button>

              <button
                type="button"
                aria-label="编辑姓名"
                aria-haspopup="dialog"
                onClick={() => onQuickEditVital('name')}
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground opacity-75 group-hover:opacity-100 hover:bg-[var(--surface-active)] hover:text-primary transition-colors cursor-pointer"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            </div>

            {/* 2. 性别 */}
            <div
              data-testid="highlight-GENDER"
              className="group relative rounded-lg px-2.5 py-2 -mx-2.5 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => onQuickEditVital('gender')}
                className="w-full text-left pr-8 cursor-pointer"
              >
                <div className="text-[12px] font-medium text-muted-foreground">
                  性别
                </div>
                <div className="mt-0.5 text-[14px] font-medium text-foreground leading-snug">
                  {vitalGenderText}
                </div>
              </button>

              <button
                type="button"
                aria-label="编辑性别"
                aria-haspopup="dialog"
                onClick={() => onQuickEditVital('gender')}
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground opacity-75 group-hover:opacity-100 hover:bg-[var(--surface-active)] hover:text-primary transition-colors cursor-pointer"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            </div>

            {/* 3. 出生 */}
            <div
              data-testid="highlight-BIRTH"
              className="group relative rounded-lg px-2.5 py-2 -mx-2.5 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={onOpenBirthEvent}
                className="w-full text-left pr-8 cursor-pointer"
              >
                <div className="text-[12px] font-medium text-muted-foreground">
                  出生
                </div>
                {vitalBirthDateText || vitalBirthPlaceText ? (
                  <div className="mt-0.5 space-y-0.5 text-[13px] text-foreground leading-snug">
                    {vitalBirthDateText && (
                      <div className="tabular-nums font-medium">
                        {vitalBirthDateText}
                      </div>
                    )}
                    {vitalBirthPlaceText && (
                      <div className="text-muted-foreground">
                        {vitalBirthPlaceText}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[13px] text-placeholder">
                    未填写
                  </div>
                )}
              </button>

              <button
                type="button"
                aria-label="编辑出生"
                aria-haspopup="dialog"
                onClick={onOpenBirthEvent}
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground opacity-75 group-hover:opacity-100 hover:bg-[var(--surface-active)] hover:text-primary transition-colors cursor-pointer"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            </div>

            {/* 4. 死亡 */}
            <div
              data-testid="highlight-DEATH"
              className="group relative rounded-lg px-2.5 py-2 -mx-2.5 hover:bg-[var(--surface-hover)] transition-colors"
            >
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={onOpenDeathEvent}
                className="w-full text-left pr-8 cursor-pointer"
              >
                <div className="text-[12px] font-medium text-muted-foreground">
                  死亡
                </div>
                {person.status === 'living' ? (
                  <div className="mt-0.5 text-[14px] font-medium text-foreground leading-snug">
                    在世
                  </div>
                ) : vitalDeathDateText || vitalDeathPlaceText ? (
                  <div className="mt-0.5 space-y-0.5 text-[13px] text-foreground leading-snug">
                    {vitalDeathDateText && (
                      <div className="tabular-nums font-medium">
                        {vitalDeathDateText}
                      </div>
                    )}
                    {vitalDeathPlaceText && (
                      <div className="text-muted-foreground">
                        {vitalDeathPlaceText}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[13px] text-muted-foreground">
                    已故
                  </div>
                )}
              </button>

              <button
                type="button"
                aria-label="编辑死亡"
                aria-haspopup="dialog"
                onClick={onOpenDeathEvent}
                className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground opacity-75 group-hover:opacity-100 hover:bg-[var(--surface-active)] hover:text-primary transition-colors cursor-pointer"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
