import React, { useEffect, useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import { NativeSelect as Select } from '@/components/ui/native-select';
import type { AliasEditContext } from '../domain/personDetailActions';
import { type PersonAliasRecord } from '../types';
import { toGivenNamePinyin, toSurnamePinyin } from '../utils/nameUtils';
import { ALIAS_TYPE_OPTIONS } from '../utils/personHelpers';

export type { AliasEditContext };

interface PersonAliasModalProps {
  context: AliasEditContext | null;
  onClose: () => void;
  onSave: (context: AliasEditContext, nextAlias: PersonAliasRecord) => void;
  onDelete?: (context: AliasEditContext) => void;
}

export const PersonAliasModal: React.FC<PersonAliasModalProps> = ({
  context,
  onClose,
  onSave,
  onDelete,
}) => {
  const titleId = useId();
  const typeSelectId = useId();
  const surnameInputId = useId();
  const givenNameInputId = useId();
  const surnamePinyinInputId = useId();
  const givenNamePinyinInputId = useId();

  const isSurnameComposingRef = useRef(false);
  const isGivenNameComposingRef = useRef(false);

  const [aliasType, setAliasType] = useState('');
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [romSurname, setRomSurname] = useState('');
  const [romName, setRomName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOpen = Boolean(context);

  useEffect(() => {
    if (!context) return;
    isSurnameComposingRef.current = false;
    isGivenNameComposingRef.current = false;
    const init = context.initialAlias;
    setAliasType(init.type || '');
    setSurname(init.surname || '');
    setName(init.name || '');
    setRomSurname(init.romanizedName?.surname || '');
    setRomName(init.romanizedName?.name || '');
    setNameError(null);
    setConfirmDelete(false);
  }, [context]);

  if (!isOpen || !context) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanSurname = surname.trim();
    if (!cleanName && !cleanSurname) {
      setNameError('请填写姓氏或名字');
      return;
    }

    const rSur = romSurname.trim();
    const rNam = romName.trim();
    const rSuffix = context.initialAlias.romanizedName?.suffix?.trim();
    const cleanType = aliasType.trim();

    const nextAlias: PersonAliasRecord = {
      id: context.initialAlias.id,
      ...(cleanType ? { type: cleanType } : {}),
      ...(cleanSurname ? { surname: cleanSurname } : {}),
      name: cleanName || cleanSurname,
      ...(rSur || rNam || rSuffix
        ? {
            romanizedName: {
              ...(rSur ? { surname: rSur } : {}),
              ...(rNam ? { name: rNam } : {}),
              ...(rSuffix ? { suffix: rSuffix } : {}),
            },
          }
        : {}),
    };

    onSave(context, nextAlias);
    onClose();
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
        title={context.mode === 'create' ? '新增别名' : '编辑别名'}
        onClose={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        noValidate
      >
        <ModalBody className="space-y-5">
          <div>
            <label htmlFor={typeSelectId} className={labelClass}>
              别名类型
            </label>
            <Select
              id={typeSelectId}
              value={aliasType}
              onChange={(e) => setAliasType(e.target.value)}
            >
              {ALIAS_TYPE_OPTIONS.map((opt) => (
                <option
                  key={opt.value || '__none__'}
                  value={opt.value}
                  className="bg-card text-foreground"
                >
                  {opt.label}
                </option>
              ))}
              {aliasType &&
                !ALIAS_TYPE_OPTIONS.some((o) => o.value === aliasType) && (
                  <option value={aliasType} className="bg-card text-foreground">
                    {aliasType}
                  </option>
                )}
            </Select>
          </div>

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
                  placeholder="如：陈（选填）"
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
                  placeholder="如：伯宣、竹溪"
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
                <label htmlFor={surnamePinyinInputId} className={labelClass}>
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
                <label htmlFor={givenNamePinyinInputId} className={labelClass}>
                  名字拼音
                </label>
                <Input
                  id={givenNamePinyinInputId}
                  data-lang="zh-Latn"
                  autoComplete="off"
                  maxLength={256}
                  value={romName}
                  onChange={(e) => setRomName(e.target.value)}
                  placeholder="如：Boxuan"
                />
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="justify-between">
          <div>
            {context.mode === 'edit' && onDelete && (
              !confirmDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>删除别名</span>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      onDelete(context);
                      onClose();
                    }}
                  >
                    确认删除
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    取消
                  </Button>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </div>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
