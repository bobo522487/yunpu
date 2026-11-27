import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import { cn } from '../../../lib/utils';
import { type PersonRecord } from '../types';
import { toGivenNamePinyin, toSurnamePinyin } from '../utils/nameUtils';

export type VitalQuickEditField = 'name' | 'gender' | null;

interface PersonVitalEditModalProps {
  field: VitalQuickEditField;
  person: PersonRecord | null;
  clanSurname?: string;
  onClose: () => void;
  onSave: (updates: Partial<PersonRecord>) => void;
}

interface BlueRadioOptionProps {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onChange: () => void;
}

const BlueRadioOption: React.FC<BlueRadioOptionProps> = ({
  name,
  value,
  checked,
  label,
  onChange,
}) => (
  <label
    className={cn(
      'inline-flex items-center gap-2.5 cursor-pointer select-none py-1.5 pr-4 text-[14px] transition-colors',
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

export const PersonVitalEditModal: React.FC<PersonVitalEditModalProps> = ({
  field,
  person,
  clanSurname = '',
  onClose,
  onSave,
}) => {
  const titleId = useId();
  const surnameInputId = useId();
  const givenNameInputId = useId();
  const surnamePinyinInputId = useId();
  const givenNamePinyinInputId = useId();

  const isSurnameComposingRef = useRef(false);
  const isGivenNameComposingRef = useRef(false);

  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [romSurname, setRomSurname] = useState('');
  const [romName, setRomName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('male');
  const [nameError, setNameError] = useState<string | null>(null);

  const isOpen = Boolean(field && person);

  useEffect(() => {
    if (!field || !person) return;
    isSurnameComposingRef.current = false;
    isGivenNameComposingRef.current = false;
    setSurname(
      person.spouseOfId
        ? person.surname || ''
        : person.surname || clanSurname || ''
    );
    setName(person.name || '');
    setRomSurname(person.romanizedName?.surname || '');
    setRomName(person.romanizedName?.name || '');
    setGender(person.gender || 'unknown');
    setNameError(null);
  }, [field, person, clanSurname]);

  if (!isOpen || !person || !field) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (field === 'name') {
      const cleanName = name.trim();
      const cleanSurname = surname.trim();
      if (!cleanName && !cleanSurname) {
        setNameError('请填写姓氏或名字');
        return;
      }
      const rSur = romSurname.trim();
      const rNam = romName.trim();
      const rSuffix = person.romanizedName?.suffix?.trim();
      onSave({
        surname: cleanSurname || undefined,
        name: cleanName || cleanSurname,
        romanizedName:
          rSur || rNam || rSuffix
            ? {
                ...(rSur ? { surname: rSur } : {}),
                ...(rNam ? { name: rNam } : {}),
                ...(rSuffix ? { suffix: rSuffix } : {}),
              }
            : undefined,
      });
      onClose();
      return;
    }

    if (field === 'gender') {
      let nextRelation = person.relationType;
      if (person.spouseOfId) {
        nextRelation =
          gender === 'male'
            ? '丈夫'
            : gender === 'female'
              ? '妻子'
              : '配偶';
      } else if (gender === 'female') {
        if (nextRelation === '继子') nextRelation = '继女';
        else if (nextRelation === '养子') nextRelation = '养女';
        else if (nextRelation === '生子' || !nextRelation)
          nextRelation = '生女';
      } else if (gender === 'male') {
        if (nextRelation === '继女') nextRelation = '继子';
        else if (nextRelation === '养女') nextRelation = '养子';
        else if (nextRelation === '生女' || !nextRelation)
          nextRelation = '生子';
      }
      onSave({
        gender,
        relationType: nextRelation,
      });
      onClose();
    }
  };

  const labelClass = 'block text-[13px] font-medium text-foreground mb-1.5';

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      size="lg"
      zIndexClass="z-[96]"
      ariaLabelledBy={titleId}
      className="fs-lineage-theme"
    >
      <ModalHeader
        titleId={titleId}
        title={field === 'name' ? '编辑姓名' : '编辑性别'}
        onClose={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        noValidate
      >
        <ModalBody className="space-y-5">
          {field === 'name' ? (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label htmlFor={surnameInputId} className={labelClass}>
                      姓氏
                    </label>
                    <Input
                      id={surnameInputId}
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
                        setRomSurname(toSurnamePinyin(nextValue));
                      }}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setSurname(nextValue);
                        if (!isSurnameComposingRef.current) {
                          setRomSurname(toSurnamePinyin(nextValue));
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
                      id={givenNameInputId}
                      data-lang="zh"
                      autoComplete="off"
                      maxLength={256}
                      value={name}
                      onCompositionStart={() => {
                        isGivenNameComposingRef.current = true;
                      }}
                      onCompositionEnd={(e) => {
                        isGivenNameComposingRef.current = false;
                        const nextValue = e.currentTarget.value;
                        setName(nextValue);
                        setRomName(toGivenNamePinyin(nextValue));
                      }}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setName(nextValue);
                        if (!isGivenNameComposingRef.current) {
                          setRomName(toGivenNamePinyin(nextValue));
                        }
                        if (nameError) setNameError(null);
                      }}
                      placeholder="请输入名字"
                    />
                  </div>
                </div>

                {nameError && (
                  <p className="-mt-2 text-[12px] text-destructive font-medium">
                    {nameError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor={surnamePinyinInputId}
                      className={labelClass}
                    >
                      姓氏拼音
                    </label>
                    <Input
                      id={surnamePinyinInputId}
                      data-lang="zh-Latn"
                      autoComplete="off"
                      maxLength={256}
                      value={romSurname}
                      onChange={(e) => setRomSurname(e.target.value)}
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
                      data-lang="zh-Latn"
                      autoComplete="off"
                      maxLength={256}
                      value={romName}
                      onChange={(e) => setRomName(e.target.value)}
                      placeholder="如：Wenzhao"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className={labelClass}>性别</div>
              <div
                role="radiogroup"
                aria-label="性别"
                className="flex flex-wrap items-center gap-4 pt-1"
              >
                <BlueRadioOption
                  name="vital-edit-gender"
                  value="male"
                  checked={gender === 'male'}
                  label="男"
                  onChange={() => setGender('male')}
                />
                <BlueRadioOption
                  name="vital-edit-gender"
                  value="female"
                  checked={gender === 'female'}
                  label="女"
                  onChange={() => setGender('female')}
                />
                <BlueRadioOption
                  name="vital-edit-gender"
                  value="unknown"
                  checked={gender === 'unknown'}
                  label="未知"
                  onChange={() => setGender('unknown')}
                />
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">保存</Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
