import React from 'react';
import { Calendar, Camera, ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { usePersonDetailController } from '../hooks/usePersonDetailController';
import type { PersonRecord } from '../types';
import { normalizePersonForSave } from '../utils/personHelpers';
import { resolvePersonDisplayName } from '../utils/personTimeline';
import { ParentChildRelationModal } from './ParentChildRelationModal';
import { PersonAliasModal } from './PersonAliasModal';
import { PersonAliasSection } from './PersonAliasSection';
import { PersonAvatarPortrait } from './PersonAvatarPortrait';
import { PersonDeleteBar } from './PersonDeleteBar';
import { PersonEventModal } from './PersonEventModal';
import { PersonFamilySection } from './PersonFamilySection';
import { PersonPortraitModal } from './PersonPortraitModal';
import { PersonTimelineSection } from './PersonTimelineSection';
import { PersonVitalEditModal } from './PersonVitalEditModal';
import { PersonVitalsSection } from './PersonVitalsSection';

interface PersonDetailPanelProps {
  person: PersonRecord | null;
  allPersons: PersonRecord[];
  clanSurname?: string;
  onSelectPerson?: (personId: string) => void;
  onUpdatePerson: (id: string, updates: Partial<PersonRecord>) => void;
  onCommitPersons?: (persons: PersonRecord[]) => void;
  onDeletePerson: (id: string) => void;
  onAddChild: (
    fatherId: string,
    gender?: 'male' | 'female',
    motherInfo?: { motherId?: string; motherName?: string }
  ) => void;
  onAddSpouse: (personId: string) => void;
  onAddSibling?: (personId: string, gender?: 'male' | 'female') => void;
  onAddParent?: (personId: string) => void;
  width: number;
  onClose?: () => void;
}

export const PersonDetailPanel: React.FC<PersonDetailPanelProps> = ({
  person,
  allPersons,
  clanSurname = '',
  onSelectPerson,
  onUpdatePerson,
  onCommitPersons,
  onDeletePerson,
  onAddChild,
  onAddSpouse,
  width,
  onClose,
}) => {
  const {
    portraitModalOpen,
    setPortraitModalOpen,
    eventEditContext,
    setEventEditContext,
    vitalQuickEditField,
    setVitalQuickEditField,
    aliasEditContext,
    setAliasEditContext,
    editingParentChildId,
    setEditingParentChildId,
    vitalsExpanded,
    setVitalsExpanded,
    otherInfoExpanded,
    setOtherInfoExpanded,
    familyExpanded,
    setFamilyExpanded,
    timelineExpanded,
    setTimelineExpanded,
    confirmDeleteSelf,
    setConfirmDeleteSelf,
    displayName,
    romanizedDisplay,
    relationshipSubtitle,
    headerBirthLine,
    timelineEvents,
    aliasItems,
    openVitalBirthEventModal,
    openVitalDeathEventModal,
    openCreateEventModal,
    openEditTimelineEventModal,
    openEditMarriageModal,
    handleUnifiedEventSubmit,
    handleUnifiedEventDelete,
    openCreateAliasModal,
    openEditAliasModal,
    handleAliasSave,
    handleAliasDelete,
  } = usePersonDetailController({
    person,
    allPersons,
    clanSurname,
    onUpdatePerson,
    onCommitPersons,
  });

  if (!person) return null;

  const isSpouseNode = Boolean(person.spouseOfId);
  const isRoot = person.generation === 1 && !isSpouseNode;

  return (
    <aside
      style={{ width }}
      aria-label="人物详情抽屉"
      className="h-full max-w-[calc(100%-48px)] bg-card text-foreground border-l border-border flex flex-col overflow-hidden shrink-0 relative z-20"
    >
      {/* 1. Header — Portrait Button opens PersonPortraitModal */}
      <div className="shrink-0 bg-[var(--surface-subtle)] border-b border-border px-5 pt-4 pb-4 relative">
        {onClose && (
          <button
            type="button"
            aria-label="关闭人物抽屉"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        )}

        <div className="flex items-start gap-3.5 pr-10">
          <div className="relative shrink-0">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setPortraitModalOpen(true)}
              title={person.avatarUrl ? '管理肖像照片' : '添加肖像照片'}
              aria-label={person.avatarUrl ? '管理肖像照片' : '添加肖像照片'}
              className="group relative rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PersonAvatarPortrait
                avatarUrl={person.avatarUrl}
                displayName={displayName}
                gender={person.gender}
                sizeClass="w-[72px] h-[72px]"
                textClass="text-[24px]"
              />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-card border border-border text-muted-foreground group-hover:text-primary group-hover:border-primary flex items-center justify-center shadow-xs transition-all duration-150',
                  person.avatarUrl
                    ? 'opacity-0 scale-90 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:scale-100'
                    : 'opacity-100 scale-100'
                )}
              >
                <Camera size={12} aria-hidden="true" />
              </span>
            </button>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="yp-h2 truncate">{displayName}</h2>
            <div className="text-[13px] text-muted-foreground truncate mt-0.5">
              {relationshipSubtitle}
            </div>
            {headerBirthLine && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground tabular-nums">
                <Calendar
                  size={13}
                  className="shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="truncate">{headerBirthLine}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Scrollable Browse Workspace */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-card">
        {/* Section 1: 基本资料 */}
        <PersonVitalsSection
          person={person}
          displayName={displayName}
          romanizedDisplay={romanizedDisplay}
          expanded={vitalsExpanded}
          onToggleExpand={() => setVitalsExpanded((prev) => !prev)}
          onQuickEditVital={setVitalQuickEditField}
          onOpenBirthEvent={openVitalBirthEventModal}
          onOpenDeathEvent={openVitalDeathEventModal}
        />

        {/* Section 2: 其他资料（别名） */}
        <PersonAliasSection
          aliasItems={aliasItems}
          expanded={otherInfoExpanded}
          onToggleExpand={() => setOtherInfoExpanded((prev) => !prev)}
          onCreateAlias={openCreateAliasModal}
          onEditAlias={openEditAliasModal}
        />

        {/* 传记简介 */}
        {person.biography?.trim() && (
          <section className="px-5 py-4 border-b border-border/70">
            <div className="text-[14px] font-semibold text-foreground mb-2">
              传记简介
            </div>
            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
              {person.biography.trim()}
            </p>
          </section>
        )}

        {/* Section 3: 家庭成员（配偶与子女 & 父母与兄弟姐妹） */}
        <section
          data-testid="section-card-family"
          className="px-5 py-4 border-b border-border/70"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={familyExpanded}
              onClick={() => setFamilyExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 text-left py-1 rounded text-[14px] font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <span>家庭成员</span>
              {familyExpanded ? (
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

          {familyExpanded && (
            <div className="mt-3">
              <PersonFamilySection
                person={person}
                allPersons={allPersons}
                clanSurname={clanSurname}
                isWide={width >= 540}
                onSelectPerson={(targetId) => onSelectPerson?.(targetId)}
                onAddChild={(fid, motherInfo) =>
                  onAddChild(fid, 'male', motherInfo)
                }
                onAddSpouse={(pid) => onAddSpouse(pid)}
                onEditMarriage={openEditMarriageModal}
                onEditParentChild={(childId) => setEditingParentChildId(childId)}
              />
            </div>
          )}
        </section>

        {/* Section 4: 时间线 */}
        <PersonTimelineSection
          events={timelineEvents}
          expanded={timelineExpanded}
          onToggleExpand={() => setTimelineExpanded((prev) => !prev)}
          onCreateEvent={openCreateEventModal}
          onEditEvent={openEditTimelineEventModal}
          onSelectPerson={onSelectPerson}
        />
      </div>

      {/* 4. Fixed Bottom Safe Zone Action Bar — Delete Person Only */}
      <PersonDeleteBar
        isRoot={isRoot}
        displayName={displayName}
        confirming={confirmDeleteSelf}
        onStartConfirm={() => setConfirmDeleteSelf(true)}
        onCancelConfirm={() => setConfirmDeleteSelf(false)}
        onConfirmDelete={() => {
          setConfirmDeleteSelf(false);
          onDeletePerson(person.id);
        }}
      />

      {/* Portrait Gallery & Cropper Modal */}
      <PersonPortraitModal
        isOpen={portraitModalOpen}
        person={person}
        displayName={displayName}
        onClose={() => setPortraitModalOpen(false)}
        onUpdateAvatar={(updates) => onUpdatePerson(person.id, updates)}
      />

      {/* Unified Event Editor Modal */}
      <PersonEventModal
        context={eventEditContext}
        personDisplayName={
          eventEditContext && eventEditContext.targetPersonId !== person.id
            ? resolvePersonDisplayName(
                allPersons.find(
                  (p) => p.id === eventEditContext.targetPersonId
                ) || person,
                clanSurname
              )
            : displayName
        }
        allPersons={allPersons}
        onClose={() => setEventEditContext(null)}
        onSubmit={handleUnifiedEventSubmit}
        onDelete={handleUnifiedEventDelete}
      />

      {/* Quick Name / Gender Dialog for Vitals Card */}
      <PersonVitalEditModal
        field={vitalQuickEditField}
        person={person}
        clanSurname={clanSurname}
        onClose={() => setVitalQuickEditField(null)}
        onSave={(updates) => onUpdatePerson(person.id, updates)}
      />

      {/* Structured Alias Editor Modal (mirrors Name modal layout) */}
      <PersonAliasModal
        context={aliasEditContext}
        onClose={() => setAliasEditContext(null)}
        onSave={handleAliasSave}
        onDelete={handleAliasDelete}
      />

      {/* Parent-Child Relationship Editor Modal */}
      <ParentChildRelationModal
        childPerson={
          editingParentChildId
            ? allPersons.find((p) => p.id === editingParentChildId) || null
            : null
        }
        allPersons={allPersons}
        clanSurname={clanSurname}
        onClose={() => setEditingParentChildId(null)}
        onSave={(childId, updates) => {
          const target = allPersons.find((p) => p.id === childId);
          if (!target) return;
          const normalized = normalizePersonForSave(
            { ...target, ...updates },
            allPersons
          );
          onUpdatePerson(childId, normalized);
        }}
      />
    </aside>
  );
};
