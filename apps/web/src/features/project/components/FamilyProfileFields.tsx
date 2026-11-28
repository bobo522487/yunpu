import React, { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  PlaceInput,
  type GenealogyPlace,
} from '../../place-input';

export type FamilyHelpKey =
  | 'family-name'
  | 'family-surname'
  | 'family-founder'
  | 'family-hall'
  | 'family-location';

export const FAMILY_HELP_CONTENT: Record<
  FamilyHelpKey,
  { title: string; body: string }
> = {
  'family-name': {
    title: '家族名称说明',
    body: '建议采用「郡望/迁居地 + 姓氏」或族谱传统题名，例如「清河张氏」「义门陈氏宗谱」，将作为家族主名称展示。',
  },
  'family-surname': {
    title: '家族姓氏说明',
    body: '填写本谱核心主姓氏（如「张」「陈」），用于谱系节点名讳排版与宗族档案归类。',
  },
  'family-founder': {
    title: '始迁祖说明',
    body: '填写迁居当地开基立业的第一世祖先名讳。新建家族时将自动在谱系图谱中生成第一世「始迁祖」根节点。',
  },
  'family-hall': {
    title: '堂号说明',
    body: '家族宗祠或支派的传统堂号（如「百忍堂」「敦本堂」「颍川堂」），可选填，用于谱书封面与档案展示。',
  },
  'family-location': {
    title: '所在地区说明',
    body: '输入或选择家族主要聚居地、修谱祖籍所在的省市区县，或填写历史旧地名（可选填）。',
  },
};

export type FamilyFieldErrors = {
  familyName?: string;
  familySurname?: string;
  ancestor?: string;
};

export interface FamilyProfileFormValues {
  familyName: string;
  familySurname: string;
  ancestor: string;
  hallName: string;
  regionPlace: GenealogyPlace | null;
  description: string;
}

export function validateFamilyProfile(
  values: Pick<
    FamilyProfileFormValues,
    'familyName' | 'familySurname' | 'ancestor'
  >,
): FamilyFieldErrors {
  const nextErrors: FamilyFieldErrors = {};
  if (!values.familyName.trim()) nextErrors.familyName = '请输入家族名称';
  if (!values.familySurname.trim()) nextErrors.familySurname = '请输入家族姓氏';
  if (!values.ancestor.trim()) nextErrors.ancestor = '请录入始迁祖姓名';
  return nextErrors;
}

interface FamilyProfileFieldsProps {
  values: FamilyProfileFormValues;
  errors: FamilyFieldErrors;
  onChange: (patch: Partial<FamilyProfileFormValues>) => void;
  onClearError: (field: keyof FamilyFieldErrors) => void;
  disabled?: boolean;
  autoFocusName?: boolean;
  idPrefix?: string;
}

export const FamilyProfileFields: React.FC<FamilyProfileFieldsProps> = ({
  values,
  errors,
  onChange,
  onClearError,
  disabled = false,
  autoFocusName = false,
  idPrefix = 'family',
}) => {
  const [activeHelp, setActiveHelp] = useState<FamilyHelpKey | null>(null);

  useEffect(() => {
    if (!activeHelp) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('[data-help-trigger]') ||
        target.closest('[data-help-popover]')
      ) {
        return;
      }
      setActiveHelp(null);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveHelp(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [activeHelp]);

  const idFor = (suffix: string) =>
    idPrefix === 'family'
      ? `family${suffix}`
      : `${idPrefix}-${suffix.toLowerCase()}`;

  const renderHelpTrigger = (helpKey: FamilyHelpKey, ariaLabel: string) => {
    const isOpen = activeHelp === helpKey;
    const tip = FAMILY_HELP_CONTENT[helpKey];
    return (
      <span className="relative inline-flex items-center">
        <button
          type="button"
          className={`zy-help-btn inline-flex items-center justify-center w-4 h-4 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition-colors cursor-pointer ${
            isOpen
              ? 'text-primary'
              : 'text-muted-foreground/70 hover:text-primary'
          }`}
          data-help={helpKey}
          data-help-trigger={helpKey}
          data-help-bound="1"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          onClick={() =>
            setActiveHelp((prev) => (prev === helpKey ? null : helpKey))
          }
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
        {isOpen && (
          <div
            data-help-popover={helpKey}
            role="tooltip"
            className="absolute left-0 top-6 z-30 w-64 rounded-xl border border-border bg-popover text-popover-foreground p-3 shadow-[var(--shadow-popover)] text-left animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="text-[12px] font-semibold text-foreground mb-1">
              {tip.title}
            </div>
            <p className="text-[12px] font-normal leading-relaxed text-muted-foreground">
              {tip.body}
            </p>
          </div>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label
            htmlFor={idFor('NameInput')}
            className="flex items-center gap-1"
          >
            <span>家族名称</span>
            <span className="text-destructive">*</span>
            {renderHelpTrigger('family-name', '家族名称说明')}
          </Label>
          <Input
            id={idFor('NameInput')}
            name="familyName"
            placeholder="如：清河张氏"
            required
            type="text"
            autoFocus={autoFocusName}
            autoComplete="off"
            disabled={disabled}
            value={values.familyName}
            onChange={(e) => {
              onChange({ familyName: e.target.value });
              if (errors.familyName) onClearError('familyName');
            }}
            className={
              errors.familyName
                ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
                : ''
            }
          />
          {errors.familyName && (
            <p className="text-[12px] text-destructive">{errors.familyName}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor={idFor('SurnameInput')}
            className="flex items-center gap-1"
          >
            <span>家族姓氏</span>
            <span className="text-destructive">*</span>
            {renderHelpTrigger('family-surname', '家族姓氏说明')}
          </Label>
          <Input
            id={idFor('SurnameInput')}
            name="familySurname"
            placeholder="如：张"
            required
            type="text"
            autoComplete="off"
            disabled={disabled}
            value={values.familySurname}
            onChange={(e) => {
              onChange({ familySurname: e.target.value });
              if (errors.familySurname) onClearError('familySurname');
            }}
            className={
              errors.familySurname
                ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
                : ''
            }
          />
          {errors.familySurname && (
            <p className="text-[12px] text-destructive">
              {errors.familySurname}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor={idFor('AncestorInput')}
          className="flex items-center gap-1"
        >
          <span>始迁祖</span>
          <span className="text-destructive">*</span>
          {renderHelpTrigger('family-founder', '始迁祖说明')}
        </Label>
        <Input
          id={idFor('AncestorInput')}
          name="ancestor"
          placeholder="录入始迁祖姓名"
          required
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={values.ancestor}
          onChange={(e) => {
            onChange({ ancestor: e.target.value });
            if (errors.ancestor) onClearError('ancestor');
          }}
          className={
            errors.ancestor
              ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
              : ''
          }
        />
        {errors.ancestor && (
          <p className="text-[12px] text-destructive">{errors.ancestor}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label
            htmlFor={idFor('HallNameInput')}
            className="flex items-center gap-1"
          >
            <span>堂号</span>
            {renderHelpTrigger('family-hall', '堂号说明')}
          </Label>
          <Input
            id={idFor('HallNameInput')}
            name="hallName"
            placeholder="如：百忍堂"
            type="text"
            autoComplete="off"
            disabled={disabled}
            value={values.hallName}
            onChange={(e) => onChange({ hallName: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor={idFor('LocationInput')}
            className="flex items-center gap-1"
          >
            <span>所在地区</span>
            {renderHelpTrigger('family-location', '所在地区说明')}
          </Label>
          <PlaceInput
            id={idFor('LocationInput')}
            label="所在地区"
            value={values.regionPlace}
            onChange={(regionPlace) => onChange({ regionPlace })}
            placeholder="输入省市区县或原始地名"
            className="bg-card"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={idFor('DescriptionInput')} className="block">
          家族简介
        </Label>
        <Textarea
          id={idFor('DescriptionInput')}
          name="description"
          placeholder="简要描述家族历史及现状..."
          rows={3}
          disabled={disabled}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="resize-none min-h-[76px] shadow-[var(--shadow-control)] focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
};
