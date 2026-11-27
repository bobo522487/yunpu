import React, { useEffect, useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
} from '@/components/ui/modal';
import { NativeSelect as Select } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '../../../lib/utils';
import { DateInput, type GenealogyDate } from '../../date-input';
import { PlaceInput, type GenealogyPlace } from '../../place-input';
import { type PersonEventType, type PersonRecord } from '../types';
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  type EventEditContext,
  type UnifiedEventSubmitPayload,
} from '../utils/personTimeline';

interface PersonEventModalProps {
  context: EventEditContext | null;
  personDisplayName: string;
  allPersons: PersonRecord[];
  onClose: () => void;
  onSubmit: (
    context: EventEditContext,
    payload: UnifiedEventSubmitPayload
  ) => void;
  onDelete?: (context: EventEditContext) => void;
}

export const PersonEventModal: React.FC<PersonEventModalProps> = ({
  context,
  personDisplayName,
  allPersons,
  onClose,
  onSubmit,
  onDelete,
}) => {
  const titleId = useId();
  const typeSelectId = useId();
  const dateInputId = useId();
  const placeInputId = useId();
  const descInputId = useId();

  const [eventType, setEventType] = useState<PersonEventType>('career');
  const [structuredDate, setStructuredDate] = useState<GenealogyDate | null>(
    null
  );
  const [structuredPlace, setStructuredPlace] =
    useState<GenealogyPlace | null>(null);
  const [description, setDescription] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!context) return;
    const init = context.initialEvent;
    setEventType(init.type);
    setStructuredDate(init.structuredDate ?? null);
    setStructuredPlace(init.structuredPlace ?? null);
    setDescription(init.description || '');
    setConfirmDelete(false);
  }, [context]);

  if (!context) return null;

  const isTypeLocked =
    context.mode === 'edit' &&
    (context.sourceKind === 'birth' ||
      context.sourceKind === 'child_birth' ||
      context.sourceKind === 'death' ||
      context.sourceKind === 'burial' ||
      context.sourceKind === 'marriage_node');

  const typeLabel = EVENT_TYPE_LABELS[eventType] || '事件';
  const modalTitle =
    context.mode === 'create' ? '添加生平事件' : `编辑${typeLabel}事件`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(context, {
      type: eventType,
      structuredDate,
      structuredPlace,
      description,
    });
  };

  const labelClass = 'block text-[13px] font-medium text-foreground mb-1.5';

  return (
    <ModalShell
      open={Boolean(context)}
      onClose={onClose}
      size="xl"
      zIndexClass="z-[96]"
      ariaLabelledBy={titleId}
      className="fs-lineage-theme"
    >
      <ModalHeader
        titleId={titleId}
        title={modalTitle}
        subtitle={`人物：${personDisplayName}`}
        onClose={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        noValidate
      >
        <ModalBody className="space-y-5">
          {/* 1. 事件类型 */}
          <div>
            <label htmlFor={typeSelectId} className={labelClass}>
              事件类型 <span className="text-destructive ml-0.5">*</span>
            </label>
            <Select
              id={typeSelectId}
              value={eventType}
              disabled={isTypeLocked}
              onChange={(e) =>
                setEventType(e.target.value as PersonEventType)
              }
              className={cn(
                isTypeLocked ? 'opacity-80 cursor-not-allowed' : ''
              )}
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
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

          {/* 2. 日期 & 3. 地点 */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label htmlFor={dateInputId} className={labelClass}>
                日期
              </label>
              <DateInput
                id={dateInputId}
                label="事件日期"
                value={structuredDate}
                onChange={setStructuredDate}
                enableTime
                enableOriginal
                placeholder="如 1977-02-21，或点右侧选择"
              />
            </div>

            <div className="sm:col-span-7">
              <label htmlFor={placeInputId} className={labelClass}>
                地点
              </label>
              <PlaceInput
                id={placeInputId}
                label="事件地点"
                value={structuredPlace}
                onChange={setStructuredPlace}
                clanPersons={allPersons}
                placeholder="输入省市区县或原始地名，或点右侧选择"
              />
            </div>
          </div>

          {/* 4. 描述 */}
          <div>
            <label htmlFor={descInputId} className={labelClass}>
              描述
            </label>
            <Textarea
              id={descInputId}
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="填写该事件的经过、学校/单位/职衔、功名或谱牒记述..."
              className="min-h-[108px] leading-relaxed"
            />
          </div>
        </ModalBody>

        <ModalFooter className="justify-between">
          <div>
            {context.mode === 'edit' && context.canDelete && onDelete && (
              !confirmDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>删除事件</span>
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(context)}
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
            <Button type="submit">保存事件</Button>
          </div>
        </ModalFooter>
      </form>
    </ModalShell>
  );
};
