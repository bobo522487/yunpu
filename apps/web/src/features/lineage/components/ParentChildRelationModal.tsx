import React, { useEffect, useId, useMemo, useState } from 'react';
import { User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import { NativeSelect as Select } from '@/components/ui/native-select';
import { cn } from '../../../lib/utils';
import type { GenealogyDate } from '../../date-input/date.types';
import { type PersonRecord, type RelationKind } from '../types';
import {
  FEMALE_RELATION_TYPE_OPTIONS,
  RELATION_TYPE_OPTIONS,
  getDerivedSpouses,
} from '../utils/personHelpers';
import {
  extractYearLabel,
  resolvePersonDisplayName,
} from '../utils/personTimeline';

interface ParentChildRelationModalProps {
  childPerson: PersonRecord | null;
  allPersons: PersonRecord[];
  clanSurname?: string;
  onClose: () => void;
  onSave: (childId: string, updates: Partial<PersonRecord>) => void;
}

function formatLifespanYear(structuredDate?: GenealogyDate | null): string {
  const label = extractYearLabel(structuredDate).trim();
  if (!label) return '';
  return /^-?\d+$/.test(label) ? `${label}年` : label;
}

function formatShortLifespan(p: PersonRecord): string {
  const birth = formatLifespanYear(p.birth?.structuredDate);
  const death =
    p.status === 'living'
      ? '存'
      : formatLifespanYear(p.death?.structuredDate) || '歿';
  if (birth) return `${birth}–${death}`;
  if (death !== '存' && death !== '歿') return `–${death}`;
  return death;
}

function getRelationOptionsForChild(
  gender: 'male' | 'female' | 'unknown'
): RelationKind[] {
  if (gender === 'female') {
    const merged: RelationKind[] = [
      ...FEMALE_RELATION_TYPE_OPTIONS,
      '过继',
      '出继',
      '承继',
      '抚子',
      '无(断代)',
    ];
    return Array.from(new Set(merged));
  }
  return RELATION_TYPE_OPTIONS;
}

export const ParentChildRelationModal: React.FC<
  ParentChildRelationModalProps
> = ({ childPerson, allPersons, clanSurname = '', onClose, onSave }) => {
  const titleId = useId();
  const fatherRelationId = useId();
  const motherSelectId = useId();
  const motherRelationId = useId();

  const [selectedMotherId, setSelectedMotherId] = useState<string>('');
  const [fatherRelationType, setFatherRelationType] =
    useState<RelationKind>('生子');
  const [motherRelationType, setMotherRelationType] =
    useState<RelationKind>('生子');

  const isOpen = Boolean(childPerson);

  const fatherRecord = useMemo(() => {
    if (!childPerson?.fatherId) return null;
    return allPersons.find((p) => p.id === childPerson.fatherId) || null;
  }, [allPersons, childPerson]);

  const motherOptions = useMemo(() => {
    if (!fatherRecord) return [];
    return getDerivedSpouses(allPersons, fatherRecord.id);
  }, [allPersons, fatherRecord]);

  const relationOptions = useMemo(() => {
    if (!childPerson) return RELATION_TYPE_OPTIONS;
    const base = getRelationOptionsForChild(childPerson.gender);
    const extras = [
      childPerson.fatherRelationType,
      childPerson.motherRelationType,
      childPerson.relationType,
    ].filter((item): item is RelationKind => Boolean(item?.trim()));
    return Array.from(new Set([...base, ...extras]));
  }, [childPerson]);

  useEffect(() => {
    if (!childPerson) return;
    const defaultRel: RelationKind =
      childPerson.gender === 'female' ? '生女' : '生子';
    setFatherRelationType(
      childPerson.fatherRelationType || childPerson.relationType || defaultRel
    );
    setMotherRelationType(
      childPerson.motherRelationType || childPerson.relationType || defaultRel
    );
    const initialMotherId =
      childPerson.motherId ||
      (motherOptions.length === 1 ? motherOptions[0].id : '');
    setSelectedMotherId(initialMotherId);
  }, [childPerson, motherOptions]);

  if (!isOpen || !childPerson) return null;

  const childDisplayName = resolvePersonDisplayName(childPerson, clanSurname);
  const fatherDisplayName = fatherRecord
    ? resolvePersonDisplayName(fatherRecord, clanSurname)
    : '未关联父亲';
  const defaultBioRel: RelationKind =
    childPerson.gender === 'female' ? '生女' : '生子';

  const selectedMotherRecord = motherOptions.find(
    (m) => m.id === selectedMotherId
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedPrimaryRel =
      fatherRelationType !== defaultBioRel
        ? fatherRelationType
        : motherRelationType !== defaultBioRel
          ? motherRelationType
          : fatherRelationType;

    onSave(childPerson.id, {
      motherId: selectedMotherId || undefined,
      fatherRelationType,
      motherRelationType,
      relationType: resolvedPrimaryRel,
    });
    onClose();
  };

  const labelClass = 'block text-[13px] font-medium text-foreground mb-1.5';

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      size="xl"
      zIndexClass="z-[96]"
      ariaLabelledBy={titleId}
      className="fs-lineage-theme"
    >
      <ModalHeader
        titleId={titleId}
        title="编辑父母关系"
        subtitle={`子女：${childDisplayName}`}
        onClose={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        noValidate
      >
        <ModalBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
            {/* Left Column: Father & Father Relation */}
            <div className="min-w-0 flex flex-col gap-4">
              <div>
                <div className={labelClass}>父亲</div>
                <div className="flex items-center gap-3 rounded-lg border border-sky-500/25 dark:border-sky-400/25 bg-sky-500/[0.06] dark:bg-sky-400/[0.08] px-3.5 py-2.5 min-h-[68px]">
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-full overflow-hidden border border-sky-500/30 dark:border-sky-400/35 bg-sky-500/12 dark:bg-sky-400/20 text-primary flex items-center justify-center shrink-0 text-[13px] font-semibold"
                  >
                    {fatherRecord?.avatarUrl ? (
                      <img
                        src={fatherRecord.avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : fatherRecord ? (
                      <span>{fatherDisplayName.slice(0, 1)}</span>
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-foreground truncate">
                      {fatherDisplayName}
                    </div>
                    {fatherRecord && (
                      <div className="text-[12px] text-muted-foreground truncate font-mono tabular-nums mt-0.5">
                        {formatShortLifespan(fatherRecord)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <label htmlFor={fatherRelationId} className={labelClass}>
                  与父亲的关系
                </label>
                <Select
                  id={fatherRelationId}
                  value={fatherRelationType}
                  onChange={(e) =>
                    setFatherRelationType(e.target.value as RelationKind)
                  }
                >
                  {relationOptions.map((rel) => (
                    <option
                      key={rel}
                      value={rel}
                      className="bg-card text-foreground"
                    >
                      {rel}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Right Column: Mother & Mother Relation */}
            <div className="min-w-0 flex flex-col gap-4">
              <div>
                <label htmlFor={motherSelectId} className={labelClass}>
                  母亲
                </label>
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3.5 py-2.5 min-h-[68px]',
                    selectedMotherRecord
                      ? 'border-rose-500/25 dark:border-rose-400/25 bg-rose-500/[0.06] dark:bg-rose-400/[0.08]'
                      : 'border-border bg-[var(--surface-subtle)]'
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      'w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center shrink-0 text-[13px] font-semibold',
                      selectedMotherRecord
                        ? 'border-rose-500/30 dark:border-rose-400/35 bg-rose-500/12 dark:bg-rose-400/20 text-rose-700 dark:text-rose-300'
                        : 'border-border bg-card text-muted-foreground'
                    )}
                  >
                    {selectedMotherRecord?.avatarUrl ? (
                      <img
                        src={selectedMotherRecord.avatarUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : selectedMotherRecord ? (
                      <span>
                        {resolvePersonDisplayName(
                          selectedMotherRecord,
                          clanSurname
                        ).slice(0, 1)}
                      </span>
                    ) : (
                      <User size={16} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Select
                      id={motherSelectId}
                      selectSize="sm"
                      value={selectedMotherId}
                      onChange={(e) => setSelectedMotherId(e.target.value)}
                      className="-mx-1.5 px-1.5 pr-7 border-transparent bg-transparent shadow-none text-[14px] font-semibold text-foreground hover:bg-[var(--surface-hover)/0.65]"
                    >
                      <option value="" className="bg-card text-foreground">
                        不详 / 未指定
                      </option>
                      {motherOptions.map((m) => (
                        <option
                          key={m.id}
                          value={m.id}
                          className="bg-card text-foreground"
                        >
                          {resolvePersonDisplayName(m, clanSurname)}
                        </option>
                      ))}
                    </Select>
                    {selectedMotherRecord && (
                      <div className="text-[12px] text-muted-foreground truncate font-mono tabular-nums mt-0.5">
                        {formatShortLifespan(selectedMotherRecord)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-auto">
                <label htmlFor={motherRelationId} className={labelClass}>
                  与母亲的关系
                </label>
                <Select
                  id={motherRelationId}
                  value={motherRelationType}
                  onChange={(e) =>
                    setMotherRelationType(e.target.value as RelationKind)
                  }
                >
                  {relationOptions.map((rel) => (
                    <option
                      key={rel}
                      value={rel}
                      className="bg-card text-foreground"
                    >
                      {rel}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">保存关系</Button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
