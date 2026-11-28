import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ModalBody,
  ModalFooter,
  ModalShell,
} from '@/components/ui/modal';
import { NativeSelect as Select } from '@/components/ui/native-select';
import { cn } from '../../../lib/utils';
import type { PersonRecord, PersonRomanizedName } from '../types';
import {
  getGenderAvatarToneClass,
  getGenderCardSurfaceClass,
} from '../utils/lineageTheme';
import { toGivenNamePinyin, toSurnamePinyin } from '../utils/nameUtils';
import {
  DateInput,
  formatGenealogyDate,
  type GenealogyDate,
} from '../../date-input';
import {
  PlaceInput,
  formatGenealogyPlace,
  type GenealogyPlace,
} from '../../place-input';
import {
  UNKNOWN_MOTHER_KEY,
  formatPersonLifespan,
  getChildRelationSelectOptions,
  resolveChildRelationValue,
  resolvePersonFullName,
  buildMotherOptionsForFather,
  type ChildRelationCategory,
  type MotherOption,
} from '../domain/addRelativeForm';
import type {
  AddRelativeContext,
  AddRelativeRelation,
  AddRelativeSubmitPayload,
} from '../domain/addRelativeTypes';

export type {
  AddRelativeContext,
  AddRelativeRelation,
  AddRelativeSubmitPayload,
} from '../domain/addRelativeTypes';

interface AddRelativeModalProps {
  context: AddRelativeContext | null;
  allPersons: PersonRecord[];
  clanSurname?: string;
  onClose: () => void;
  onSubmit: (
    context: AddRelativeContext,
    payload: AddRelativeSubmitPayload
  ) => void;
}

const RELATION_TITLES: Record<AddRelativeRelation, string> = {
  child: '加入子女',
  spouse: '加入配偶',
  sibling: '加入同胞',
  parent: '加入父母',
};

interface BlueThemeRadioProps {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onChange: () => void;
}

const BlueThemeRadio: React.FC<BlueThemeRadioProps> = ({
  name,
  value,
  checked,
  label,
  onChange,
}) => (
  <label
    className={cn(
      'inline-flex items-center gap-2 cursor-pointer select-none py-1 pr-2 text-[14px] transition-colors',
      checked
        ? 'text-foreground font-medium'
        : 'text-muted-foreground hover:text-foreground'
    )}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={onChange}
      className="sr-only"
    />
    <span
      aria-hidden="true"
      className={cn(
        'w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center transition-colors shrink-0 bg-card',
        checked ? 'border-primary' : 'border-[var(--border-strong)]'
      )}
    >
      {checked && <span className="w-[9px] h-[9px] rounded-full bg-primary" />}
    </span>
    <span>{label}</span>
  </label>
);

export const AddRelativeModal: React.FC<AddRelativeModalProps> = ({
  context,
  allPersons,
  clanSurname = '',
  onClose,
  onSubmit,
}) => {
  const titleId = useId();
  const fatherFieldId = useId();
  const motherFieldId = useId();
  const fatherRelationFieldId = useId();
  const motherRelationFieldId = useId();
  const surnameInputId = useId();
  const givenNameInputId = useId();
  const surnamePinyinInputId = useId();
  const givenNamePinyinInputId = useId();
  const birthDateId = useId();
  const birthPlaceId = useId();
  const deathDateId = useId();
  const deathPlaceId = useId();
  const marriageDateId = useId();
  const marriagePlaceId = useId();

  const surnameRef = useRef<HTMLInputElement | null>(null);
  const givenNameRef = useRef<HTMLInputElement | null>(null);
  const isSurnameComposingRef = useRef(false);
  const isGivenNameComposingRef = useRef(false);

  const [surname, setSurname] = useState('');
  const [givenName, setGivenName] = useState('');
  const [surnamePinyin, setSurnamePinyin] = useState('');
  const [givenNamePinyin, setGivenNamePinyin] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('male');
  const [status, setStatus] = useState<'living' | 'deceased'>('living');
  const [fatherRelationCategory, setFatherRelationCategory] =
    useState<ChildRelationCategory>('biological');
  const [motherRelationCategory, setMotherRelationCategory] =
    useState<ChildRelationCategory>('biological');
  const [selectedMotherKey, setSelectedMotherKey] = useState('');
  const [birthDate, setBirthDate] = useState<GenealogyDate | null>(null);
  const [birthPlace, setBirthPlace] = useState<GenealogyPlace | null>(null);
  const [deathDate, setDeathDate] = useState<GenealogyDate | null>(null);
  const [deathPlace, setDeathPlace] = useState<GenealogyPlace | null>(null);
  const [marriageDate, setMarriageDate] = useState<GenealogyDate | null>(null);
  const [marriagePlace, setMarriagePlace] = useState<GenealogyPlace | null>(
    null
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const motherOptions = useMemo<MotherOption[]>(() => {
    if (!context || context.relation !== 'child') return [];
    return buildMotherOptionsForFather(
      context.targetPerson,
      allPersons,
      clanSurname
    );
  }, [context, allPersons, clanSurname]);

  const isMotherLocked =
    context?.relation === 'child' && context.initiatedFrom === 'mother';

  const allPersonsRef = useRef(allPersons);
  useEffect(() => {
    allPersonsRef.current = allPersons;
  }, [allPersons]);

  useEffect(() => {
    if (!context) return;

    const { relation, targetPerson, defaultGender, motherInfo, initiatedFrom } =
      context;
    const resolvedGender: 'male' | 'female' | 'unknown' =
      defaultGender ||
      (relation === 'spouse'
        ? targetPerson.gender === 'male'
          ? 'female'
          : 'male'
        : 'male');

    const inheritedSurname =
      relation === 'spouse'
        ? ''
        : relation === 'parent'
          ? resolvedGender === 'female'
            ? ''
            : targetPerson.spouseOfId
              ? targetPerson.surname?.trim() || ''
              : targetPerson.surname?.trim() || clanSurname.trim() || ''
          : targetPerson.surname?.trim() || clanSurname.trim() || '';

    const resolvedStatus: 'living' | 'deceased' =
      relation === 'parent'
        ? 'deceased'
        : relation === 'spouse'
          ? targetPerson.status || 'living'
          : 'living';

    isSurnameComposingRef.current = false;
    isGivenNameComposingRef.current = false;
    setSurname(inheritedSurname);
    setSurnamePinyin(toSurnamePinyin(inheritedSurname));
    setGivenName('');
    setGivenNamePinyin('');
    setGender(resolvedGender);
    setStatus(resolvedStatus);
    setFatherRelationCategory('biological');
    setMotherRelationCategory('biological');

    if (relation === 'child') {
      const options = buildMotherOptionsForFather(
        targetPerson,
        allPersonsRef.current,
        clanSurname
      );
      if (initiatedFrom === 'mother' && motherInfo) {
        const matched = options.find(
          (opt) =>
            (motherInfo.motherId && opt.id === motherInfo.motherId) ||
            (motherInfo.motherName && opt.name === motherInfo.motherName.trim())
        );
        setSelectedMotherKey(matched?.key || options[0]?.key || UNKNOWN_MOTHER_KEY);
      } else {
        const matched = motherInfo
          ? options.find(
              (opt) =>
                (motherInfo.motherId && opt.id === motherInfo.motherId) ||
                (motherInfo.motherName &&
                  opt.name === motherInfo.motherName.trim())
            )
          : undefined;
        setSelectedMotherKey(
          (matched || options[0])?.key || UNKNOWN_MOTHER_KEY
        );
      }
    } else {
      setSelectedMotherKey('');
    }

    setBirthDate(null);
    setBirthPlace(null);
    setDeathDate(null);
    setDeathPlace(null);
    setMarriageDate(null);
    setMarriagePlace(null);
    setNameError(null);
    setIsMaximized(false);

    const timer = window.setTimeout(() => {
      if (inheritedSurname) {
        givenNameRef.current?.focus();
      } else {
        surnameRef.current?.focus();
      }
    }, 20);

    return () => window.clearTimeout(timer);
    // Reset only when modal context opens/switches, not on unrelated allPersons updates
  }, [context, clanSurname]);

  const fatherDisplayName = useMemo(() => {
    if (!context) return '';
    return resolvePersonFullName(context.targetPerson, clanSurname);
  }, [context, clanSurname]);

  const selectedMotherOption = useMemo(() => {
    if (!context || context.relation !== 'child') return undefined;
    return (
      motherOptions.find((m) => m.key === selectedMotherKey) || motherOptions[0]
    );
  }, [context, motherOptions, selectedMotherKey]);

  const activeMotherDisplayName = useMemo(() => {
    if (!context || context.relation !== 'child') return '';
    if (isMotherLocked) {
      return (
        context.motherInfo?.motherName?.trim() ||
        selectedMotherOption?.name ||
        '不详'
      );
    }
    return selectedMotherOption?.name || '不详';
  }, [context, isMotherLocked, selectedMotherOption]);

  if (!context) return null;

  const isChildMode = context.relation === 'child';
  const isSpouseMode = context.relation === 'spouse';
  const titleText =
    context.relation === 'sibling'
      ? gender === 'female'
        ? '加入姐妹'
        : gender === 'male'
          ? '加入兄弟'
          : RELATION_TITLES.sibling
      : RELATION_TITLES[context.relation];
  const isDeceased = status === 'deceased';
  const childRelationOptions = getChildRelationSelectOptions(gender);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanSurname = surname.trim();
    const cleanGiven = givenName.trim();

    if (!cleanSurname && !cleanGiven) {
      setNameError('请填写姓氏或名字');
      givenNameRef.current?.focus();
      return;
    }

    const normalizedGiven =
      cleanSurname &&
      cleanGiven.startsWith(cleanSurname) &&
      cleanGiven.length > cleanSurname.length
        ? cleanGiven.slice(cleanSurname.length).trim()
        : cleanGiven || cleanSurname;

    let childRelationPayload: Partial<AddRelativeSubmitPayload> = {};
    if (isChildMode) {
      const resolvedFatherRelationType = resolveChildRelationValue(
        fatherRelationCategory,
        gender
      );
      const resolvedMotherRelationType = resolveChildRelationValue(
        motherRelationCategory,
        gender
      );
      const primaryRelationType =
        fatherRelationCategory !== 'biological'
          ? resolvedFatherRelationType
          : motherRelationCategory !== 'biological'
            ? resolvedMotherRelationType
            : resolvedFatherRelationType;

      if (isMotherLocked) {
        childRelationPayload = {
          relationType: primaryRelationType,
          fatherRelationType: resolvedFatherRelationType,
          motherRelationType: resolvedMotherRelationType,
          motherId: context.motherInfo?.motherId,
          motherName:
            context.motherInfo?.motherName?.trim() ||
            activeMotherDisplayName ||
            '不详',
          shouldAutoCreateMother: false,
        };
      } else {
        const chosenMother = selectedMotherOption || {
          key: UNKNOWN_MOTHER_KEY,
          id: undefined,
          name: '不详',
          isAutoCreateUnknown: true,
        };
        childRelationPayload = {
          relationType: primaryRelationType,
          fatherRelationType: resolvedFatherRelationType,
          motherRelationType: resolvedMotherRelationType,
          motherId: chosenMother.id,
          motherName: chosenMother.name,
          shouldAutoCreateMother: Boolean(chosenMother.isAutoCreateUnknown),
        };
      }
    }

    const cleanSurnamePinyin = surnamePinyin.trim();
    const cleanGivenPinyin = givenNamePinyin.trim();
    const romanizedName: PersonRomanizedName | undefined =
      cleanSurnamePinyin || cleanGivenPinyin
        ? {
            ...(cleanSurnamePinyin ? { surname: cleanSurnamePinyin } : {}),
            ...(cleanGivenPinyin ? { name: cleanGivenPinyin } : {}),
          }
        : undefined;

    onSubmit(context, {
      surname: cleanSurname || undefined,
      name: normalizedGiven,
      romanizedName,
      gender,
      status,
      ...childRelationPayload,
      birthDate:
        birthDate && formatGenealogyDate(birthDate).trim() ? birthDate : null,
      birthPlace:
        birthPlace && formatGenealogyPlace(birthPlace).trim()
          ? birthPlace
          : null,
      deathDate:
        isDeceased && deathDate && formatGenealogyDate(deathDate).trim()
          ? deathDate
          : null,
      deathPlace:
        isDeceased && deathPlace && formatGenealogyPlace(deathPlace).trim()
          ? deathPlace
          : null,
      marriageDate:
        isSpouseMode && marriageDate && formatGenealogyDate(marriageDate).trim()
          ? marriageDate
          : null,
      marriagePlace:
        isSpouseMode &&
        marriagePlace &&
        formatGenealogyPlace(marriagePlace).trim()
          ? marriagePlace
          : null,
    });
  };

  const labelClass = 'block text-[13px] font-medium text-foreground mb-1.5';

  return (
    <ModalShell
      open={Boolean(context)}
      onClose={onClose}
      zIndexClass="z-[95]"
      closeOnBackdrop={false}
      closeOnEsc={context.relation !== 'child'}
      ariaLabelledBy={titleId}
      className={cn(
        'transition-[border-radius,max-width,height] duration-150',
        isMaximized
          ? 'h-[95vh] max-w-none max-h-[95vh]'
          : 'max-w-[900px]'
      )}
    >
      {/* Header */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-foreground truncate"
          >
            {titleText}
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label={isMaximized ? '还原窗口' : '最大化窗口'}
            title={isMaximized ? '还原窗口' : '最大化窗口'}
            onClick={() => setIsMaximized((prev) => !prev)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isMaximized ? (
              <Minimize2 size={16} aria-hidden="true" />
            ) : (
              <Maximize2 size={16} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            aria-label="关闭"
            title="关闭"
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Form Body */}
      <form
        id="add-relative-modal-form"
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        noValidate
      >
        <ModalBody className="space-y-5">
          {/* Row 1: 姓名区块（汉字 + 拼音，均 50% / 50% 两栏） */}
          <div id="nameform-block" className="space-y-4">
            <div data-testid="nameform:zh">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label htmlFor={surnameInputId} className={labelClass}>
                    姓氏
                  </label>
                  <Input
                    ref={surnameRef}
                    id={surnameInputId}
                    name="nameTemplate.zh.lastName"
                    data-testid="zh-last-name"
                    data-lang="zh"
                    autoComplete="off"
                    maxLength={256}
                    value={surname}
                    onCompositionStart={() => {
                      isSurnameComposingRef.current = true;
                    }}
                    onCompositionEnd={(e) => {
                      isSurnameComposingRef.current = false;
                      const nextValue = e.currentTarget.value;
                      setSurname(nextValue);
                      setSurnamePinyin(toSurnamePinyin(nextValue));
                    }}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setSurname(nextValue);
                      if (!isSurnameComposingRef.current) {
                        setSurnamePinyin(toSurnamePinyin(nextValue));
                      }
                      if (nameError) setNameError(null);
                    }}
                    placeholder="如：陈"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor={givenNameInputId} className={labelClass}>
                    名字 <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <Input
                    ref={givenNameRef}
                    id={givenNameInputId}
                    name="nameTemplate.zh.firstName"
                    data-testid="zh-first-name"
                    data-lang="zh"
                    autoComplete="off"
                    maxLength={256}
                    value={givenName}
                    onCompositionStart={() => {
                      isGivenNameComposingRef.current = true;
                    }}
                    onCompositionEnd={(e) => {
                      isGivenNameComposingRef.current = false;
                      const nextValue = e.currentTarget.value;
                      setGivenName(nextValue);
                      setGivenNamePinyin(toGivenNamePinyin(nextValue));
                    }}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setGivenName(nextValue);
                      if (!isGivenNameComposingRef.current) {
                        setGivenNamePinyin(toGivenNamePinyin(nextValue));
                      }
                      if (nameError) setNameError(null);
                    }}
                    placeholder="请输入名字"
                    className={cn(
                      nameError
                        ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20'
                        : ''
                    )}
                  />
                </div>
              </div>

              {nameError && (
                <p className="mt-1.5 text-[12px] text-destructive font-medium">
                  {nameError}
                </p>
              )}
            </div>

            <div data-testid="nameform:zh-Latn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label htmlFor={surnamePinyinInputId} className={labelClass}>
                    姓氏拼音
                  </label>
                  <Input
                    id={surnamePinyinInputId}
                    name="nameTemplate.zh-Latn.lastName"
                    data-testid="zh-latn-last-name"
                    data-lang="zh-Latn"
                    autoComplete="off"
                    maxLength={256}
                    value={surnamePinyin}
                    onChange={(e) => setSurnamePinyin(e.target.value)}
                    placeholder="如：Chen"
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor={givenNamePinyinInputId}
                    className={labelClass}
                  >
                    名字拼音
                  </label>
                  <Input
                    id={givenNamePinyinInputId}
                    name="nameTemplate.zh-Latn.firstName"
                    data-testid="zh-latn-first-name"
                    data-lang="zh-Latn"
                    autoComplete="off"
                    maxLength={256}
                    value={givenNamePinyin}
                    onChange={(e) => setGivenNamePinyin(e.target.value)}
                    placeholder="如：Wenzhao"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: 性别 */}
          <div>
            <div className={labelClass}>性别</div>
            <div
              role="radiogroup"
              aria-label="性别"
              className="flex flex-wrap items-center gap-6 pt-0.5"
            >
              <BlueThemeRadio
                name="add-relative-gender"
                value="male"
                checked={gender === 'male'}
                label="男"
                onChange={() => setGender('male')}
              />
              <BlueThemeRadio
                name="add-relative-gender"
                value="female"
                checked={gender === 'female'}
                label="女"
                onChange={() => setGender('female')}
              />
              <BlueThemeRadio
                name="add-relative-gender"
                value="unknown"
                checked={gender === 'unknown'}
                label="未知"
                onChange={() => setGender('unknown')}
              />
            </div>
          </div>

          {/* Row 3: 出生日期 + 出生地点 (50% / 50%) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label htmlFor={birthDateId} className={labelClass}>
                出生日期
              </label>
              <DateInput
                id={birthDateId}
                label="出生日期"
                value={birthDate}
                onChange={setBirthDate}
                enableTime
                enableOriginal
                placeholder="如 1965-08-12，或点右侧选择"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor={birthPlaceId} className={labelClass}>
                出生地点
              </label>
              <PlaceInput
                id={birthPlaceId}
                label="出生地点"
                value={birthPlace}
                onChange={setBirthPlace}
                clanPersons={allPersons}
                placeholder="输入省市区县或原始地名，或点右侧选择"
              />
            </div>
          </div>

          {/* Row 4: 状态 (存 / 殁) */}
          <div>
            <div className={labelClass}>状态</div>
            <div
              role="radiogroup"
              aria-label="状态"
              className="flex flex-wrap items-center gap-7 pt-0.5"
            >
              <BlueThemeRadio
                name="add-relative-status"
                value="living"
                checked={status === 'living'}
                label="存"
                onChange={() => setStatus('living')}
              />
              <BlueThemeRadio
                name="add-relative-status"
                value="deceased"
                checked={status === 'deceased'}
                label="殁"
                onChange={() => setStatus('deceased')}
              />
            </div>
          </div>

          {/* Row 5: 死亡信息（仅状态为「殁」时显示） */}
          {isDeceased && (
            <div className="pt-1 border-t border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                <div className="min-w-0">
                  <label htmlFor={deathDateId} className={labelClass}>
                    死亡日期
                  </label>
                  <DateInput
                    id={deathDateId}
                    label="死亡日期"
                    value={deathDate}
                    onChange={setDeathDate}
                    enableTime
                    enableOriginal
                    placeholder="如 2018-04-03，或点右侧选择"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor={deathPlaceId} className={labelClass}>
                    死亡地点
                  </label>
                  <PlaceInput
                    id={deathPlaceId}
                    label="死亡地点"
                    value={deathPlace}
                    onChange={setDeathPlace}
                    clanPersons={allPersons}
                    placeholder="输入省市区县或原始地名，或点右侧选择"
                  />
                </div>
              </div>
            </div>
          )}

          {isSpouseMode && (
            <div className="pt-4 border-t border-border">
              <div className="text-[13px] font-medium text-foreground mb-3">
                结婚事件
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <label htmlFor={marriageDateId} className={labelClass}>
                    结婚时间
                  </label>
                  <DateInput
                    id={marriageDateId}
                    label="结婚时间"
                    value={marriageDate}
                    onChange={setMarriageDate}
                    enableTime
                    enableOriginal
                    placeholder="如 1988-05-01，或点右侧选择"
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor={marriagePlaceId} className={labelClass}>
                    结婚地点
                  </label>
                  <PlaceInput
                    id={marriagePlaceId}
                    label="结婚地点"
                    value={marriagePlace}
                    onChange={setMarriagePlace}
                    clanPersons={allPersons}
                    placeholder="输入省市区县或原始地名，或点右侧选择"
                  />
                </div>
              </div>
            </div>
          )}

          {isChildMode && (
            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                {/* 左栏：父亲卡片 + 与父亲的关系 */}
                <div className="min-w-0 flex flex-col gap-3">
                  <div>
                    <span id={fatherFieldId} className={labelClass}>
                      父亲
                    </span>

                    <div
                      aria-labelledby={fatherFieldId}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3.5 py-2.5 min-h-[70px]',
                        getGenderCardSurfaceClass('male')
                      )}
                    >
                      <div
                        aria-hidden="true"
                        className={cn(
                          'w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center shrink-0 text-[13px] font-semibold',
                          getGenderAvatarToneClass('male')
                        )}
                      >
                        {context.targetPerson.avatarUrl ? (
                          <img
                            src={context.targetPerson.avatarUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{fatherDisplayName.slice(0, 1)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-foreground truncate">
                          {fatherDisplayName}
                        </div>
                        <div className="text-[12px] text-muted-foreground truncate font-mono tabular-nums mt-0.5">
                          {formatPersonLifespan(context.targetPerson)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <label
                      htmlFor={fatherRelationFieldId}
                      className={labelClass}
                    >
                      与父亲的关系
                    </label>
                    <Select
                      id={fatherRelationFieldId}
                      value={fatherRelationCategory}
                      onChange={(e) =>
                        setFatherRelationCategory(
                          e.target.value as ChildRelationCategory
                        )
                      }
                    >
                      {childRelationOptions.map((opt) => (
                        <option
                          key={opt.value}
                          value={opt.value}
                          className="bg-card text-foreground"
                        >
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* 右栏：母亲卡片 + 与母亲的关系 */}
                {(() => {
                  const isUnknownSelected =
                    activeMotherDisplayName === '不详';
                  const lockedMotherRecord =
                    isMotherLocked && context.motherInfo?.motherId
                      ? allPersons.find(
                          (p) => p.id === context.motherInfo?.motherId
                        )
                      : undefined;
                  const motherAvatarUrl = isMotherLocked
                    ? lockedMotherRecord?.avatarUrl
                    : selectedMotherOption?.avatarUrl;
                  const motherLifespan = isMotherLocked
                    ? lockedMotherRecord
                      ? formatPersonLifespan(lockedMotherRecord)
                      : ''
                    : selectedMotherOption?.lifespan || '';

                  return (
                    <div className="min-w-0 flex flex-col gap-3">
                      <div>
                        {isMotherLocked ? (
                          <span id={motherFieldId} className={labelClass}>
                            母亲
                          </span>
                        ) : (
                          <label htmlFor={motherFieldId} className={labelClass}>
                            母亲
                          </label>
                        )}

                        <div
                          aria-labelledby={
                            isMotherLocked ? motherFieldId : undefined
                          }
                          className={cn(
                            'flex items-center gap-3 rounded-lg border px-3.5 py-2.5 min-h-[70px]',
                            getGenderCardSurfaceClass(
                              isUnknownSelected ? 'unknown' : 'female'
                            )
                          )}
                        >
                          <div
                            aria-hidden="true"
                            className={cn(
                              'w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center shrink-0 text-[13px] font-semibold',
                              isUnknownSelected
                                ? 'border-border bg-card text-muted-foreground'
                                : getGenderAvatarToneClass('female')
                            )}
                          >
                            {motherAvatarUrl ? (
                              <img
                                src={motherAvatarUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : isUnknownSelected ? (
                              <User size={16} strokeWidth={2} />
                            ) : (
                              <span>
                                {activeMotherDisplayName.slice(0, 1)}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            {isMotherLocked ? (
                              <>
                                <div className="text-[14px] font-semibold text-foreground truncate">
                                  {activeMotherDisplayName}
                                </div>
                                {motherLifespan && (
                                  <div className="text-[12px] text-muted-foreground truncate font-mono tabular-nums mt-0.5">
                                    {motherLifespan}
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <Select
                                  id={motherFieldId}
                                  selectSize="sm"
                                  value={
                                    selectedMotherOption?.key ||
                                    UNKNOWN_MOTHER_KEY
                                  }
                                  onChange={(e) =>
                                    setSelectedMotherKey(e.target.value)
                                  }
                                  className={cn(
                                    '-mx-1.5 px-1.5 pr-7 border-transparent bg-transparent shadow-none text-[14px] font-semibold text-foreground',
                                    isUnknownSelected
                                      ? 'hover:bg-[var(--surface-hover)/0.65]'
                                      : 'hover:bg-lineage-female/[0.09] dark:hover:bg-lineage-female/[0.15]'
                                  )}
                                >
                                  {motherOptions.map((opt) => (
                                    <option
                                      key={opt.key}
                                      value={opt.key}
                                      className="bg-card text-foreground"
                                    >
                                      {opt.name}
                                    </option>
                                  ))}
                                </Select>
                                {motherLifespan && (
                                  <div className="text-[12px] text-muted-foreground truncate font-mono tabular-nums mt-1">
                                    {motherLifespan}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto">
                        <label
                          htmlFor={motherRelationFieldId}
                          className={labelClass}
                        >
                          与母亲的关系
                        </label>
                        <Select
                          id={motherRelationFieldId}
                          value={motherRelationCategory}
                          onChange={(e) =>
                            setMotherRelationCategory(
                              e.target.value as ChildRelationCategory
                            )
                          }
                        >
                          {childRelationOptions.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              className="bg-card text-foreground"
                            >
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">保存并加入</Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
