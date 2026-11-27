import { useEffect, useMemo, useRef, useState } from 'react';
import { createEntityId } from '../../../lib/id';
import { readGenealogyDate } from '../../date-input';
import { readGenealogyPlace } from '../../place-input';
import {
  applyAliasDelete,
  applyAliasSave,
} from '../domain/personDetailActions';
import type { PersonAliasRecord, PersonRecord } from '../types';
import {
  getPersonAliasItems,
  normalizeEventType,
} from '../utils/personHelpers';
import {
  applyCoupleMarriageEvent,
  applyUnifiedEventToPerson,
  buildPersonTimelineEvents,
  type EventEditContext,
  findCoupleMarriageInfo,
  formatHeaderBirthLine,
  type PersonTimelineEvent,
  removeUnifiedEventFromPerson,
  resolvePersonDisplayName,
  resolvePersonRelationshipHeader,
  resolveRomanizedDisplayName,
  type UnifiedEventSubmitPayload,
} from '../utils/personTimeline';
import type { AliasEditContext } from '../components/PersonAliasModal';
import type { VitalQuickEditField } from '../components/PersonVitalEditModal';

interface UsePersonDetailControllerParams {
  person: PersonRecord | null;
  allPersons: PersonRecord[];
  clanSurname: string;
  onUpdatePerson: (id: string, updates: Partial<PersonRecord>) => void;
  onCommitPersons?: (persons: PersonRecord[]) => void;
}

export function usePersonDetailController({
  person,
  allPersons,
  clanSurname,
  onUpdatePerson,
  onCommitPersons,
}: UsePersonDetailControllerParams) {
  const [portraitModalOpen, setPortraitModalOpen] = useState(false);
  const [eventEditContext, setEventEditContext] =
    useState<EventEditContext | null>(null);
  const [vitalQuickEditField, setVitalQuickEditField] =
    useState<VitalQuickEditField>(null);
  const [aliasEditContext, setAliasEditContext] =
    useState<AliasEditContext | null>(null);
  const [editingParentChildId, setEditingParentChildId] = useState<
    string | null
  >(null);

  const [vitalsExpanded, setVitalsExpanded] = useState(true);
  const [otherInfoExpanded, setOtherInfoExpanded] = useState(true);
  const [familyExpanded, setFamilyExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(true);
  const [confirmDeleteSelf, setConfirmDeleteSelf] = useState(false);

  const prevPersonIdRef = useRef<string | null>(null);
  const personId = person?.id ?? null;

  useEffect(() => {
    if (!personId) {
      prevPersonIdRef.current = null;
      setPortraitModalOpen(false);
      setEventEditContext(null);
      setVitalQuickEditField(null);
      setAliasEditContext(null);
      setEditingParentChildId(null);
      setConfirmDeleteSelf(false);
      return;
    }

    if (prevPersonIdRef.current !== personId) {
      prevPersonIdRef.current = personId;
      setPortraitModalOpen(false);
      setEventEditContext(null);
      setVitalQuickEditField(null);
      setAliasEditContext(null);
      setEditingParentChildId(null);
      setConfirmDeleteSelf(false);
    }
  }, [personId]);

  const displayName = useMemo(
    () => (person ? resolvePersonDisplayName(person, clanSurname) : ''),
    [person, clanSurname]
  );

  const romanizedDisplay = useMemo(
    () => (person ? resolveRomanizedDisplayName(person) : ''),
    [person]
  );

  const relationshipSubtitle = useMemo(
    () => (person ? resolvePersonRelationshipHeader(person, allPersons) : ''),
    [person, allPersons]
  );

  const headerBirthLine = useMemo(
    () => (person ? formatHeaderBirthLine(person) : ''),
    [person]
  );

  const timelineEvents = useMemo(
    () =>
      person ? buildPersonTimelineEvents(person, allPersons, clanSurname) : [],
    [person, allPersons, clanSurname]
  );

  const aliasItems = useMemo(
    () => (person ? getPersonAliasItems(person) : []),
    [person]
  );

  const openVitalBirthEventModal = () => {
    if (!person) return;
    setEventEditContext({
      mode: 'edit',
      sourceKind: 'birth',
      targetPersonId: person.id,
      canDelete: false,
      initialEvent: {
        type: 'birth',
        structuredDate: readGenealogyDate(person, 'birth'),
        structuredPlace: readGenealogyPlace(person, 'birth'),
        description: person.birth?.summary || '',
      },
    });
  };

  const openVitalDeathEventModal = () => {
    if (!person) return;
    setEventEditContext({
      mode: 'edit',
      sourceKind: 'death',
      targetPersonId: person.id,
      canDelete: false,
      initialEvent: {
        type: 'death',
        structuredDate: readGenealogyDate(person, 'death'),
        structuredPlace: readGenealogyPlace(person, 'death'),
        description: person.death?.summary || '',
      },
    });
  };

  const openCreateEventModal = () => {
    if (!person) return;
    setEventEditContext({
      mode: 'create',
      targetPersonId: person.id,
      canDelete: false,
      initialEvent: {
        type: 'career',
        structuredDate: null,
        structuredPlace: null,
        description: '',
      },
    });
  };

  const openEditTimelineEventModal = (ev: PersonTimelineEvent) => {
    if (!person) return;
    const target =
      allPersons.find((p) => p.id === ev.targetPersonId) || person;

    const resolvedDate =
      ev.structuredDate ??
      (ev.sourceKind === 'birth' || ev.sourceKind === 'child_birth'
        ? readGenealogyDate(target, 'birth')
        : ev.sourceKind === 'death'
          ? readGenealogyDate(target, 'death')
          : ev.sourceKind === 'burial'
            ? readGenealogyDate(target, 'burial')
            : ev.dateText
              ? {
                  schemaVersion: 1 as const,
                  kind: 'phrase' as const,
                  originalText: ev.dateText,
                }
              : null);

    const resolvedPlace =
      ev.structuredPlace ??
      (ev.sourceKind === 'birth' || ev.sourceKind === 'child_birth'
        ? readGenealogyPlace(target, 'birth')
        : ev.sourceKind === 'death'
          ? readGenealogyPlace(target, 'death')
          : ev.sourceKind === 'burial'
            ? readGenealogyPlace(target, 'burial')
            : ev.placeText
              ? {
                  schemaVersion: 1 as const,
                  kind: 'phrase' as const,
                  originalText: ev.placeText,
                }
              : null);

    const canDelete =
      ev.sourceKind === 'custom_event' || ev.sourceKind === 'burial';

    let coupleMeta: EventEditContext['coupleMeta'];
    if (ev.sourceKind === 'marriage_node' && ev.jumpPersonId) {
      const other = allPersons.find((p) => p.id === ev.jumpPersonId);
      if (other) {
        const partnerRec = target.spouseOfId ? other : target;
        const spouseRec = target.spouseOfId ? target : other;
        const spouseCount = allPersons.filter(
          (p) => p.spouseOfId === partnerRec.id
        ).length;
        const info = findCoupleMarriageInfo(
          partnerRec,
          spouseRec,
          Math.max(1, spouseCount),
          clanSurname
        );
        coupleMeta = {
          partnerId: partnerRec.id,
          spouseId: spouseRec.id,
          partnerEventId: info.partnerEventId,
          spouseEventId: info.spouseEventId,
        };
      }
    }

    setEventEditContext({
      mode: 'edit',
      sourceKind: ev.sourceKind,
      sourceId: ev.sourceId,
      targetPersonId: target.id,
      canDelete,
      coupleMeta,
      initialEvent: {
        type: normalizeEventType(ev.eventType),
        structuredDate: resolvedDate,
        structuredPlace: resolvedPlace,
        description: ev.description || '',
      },
    });
  };

  const openEditMarriageModal = (partnerId: string, spouseId: string) => {
    const partner = allPersons.find((p) => p.id === partnerId);
    const spouse = allPersons.find((p) => p.id === spouseId);
    if (!partner || !spouse) return;
    const spouseCount = allPersons.filter(
      (p) => p.spouseOfId === partner.id
    ).length;
    const info = findCoupleMarriageInfo(
      partner,
      spouse,
      Math.max(1, spouseCount),
      clanSurname
    );
    setEventEditContext({
      mode: 'edit',
      sourceKind: 'marriage_node',
      sourceId: info.partnerEventId,
      targetPersonId: partner.id,
      canDelete: false,
      coupleMeta: {
        partnerId: partner.id,
        spouseId: spouse.id,
        partnerEventId: info.partnerEventId,
        spouseEventId: info.spouseEventId,
      },
      initialEvent: {
        type: 'marriage',
        structuredDate: info.structuredDate,
        structuredPlace: info.structuredPlace,
        description: info.description,
      },
    });
  };

  const handleUnifiedEventSubmit = (
    ctx: EventEditContext,
    payload: UnifiedEventSubmitPayload
  ) => {
    if (!person) return;

    if (ctx.coupleMeta) {
      const nextPersons = applyCoupleMarriageEvent(
        allPersons,
        ctx.coupleMeta,
        payload,
        ctx
      );
      if (onCommitPersons) {
        onCommitPersons(nextPersons);
      } else {
        const affectedIds = [ctx.coupleMeta.partnerId, ctx.coupleMeta.spouseId];
        for (const id of affectedIds) {
          const prev = allPersons.find((p) => p.id === id);
          const next = nextPersons.find((p) => p.id === id);
          if (prev && next && prev !== next) {
            onUpdatePerson(id, { events: next.events });
          }
        }
      }
      setEventEditContext(null);
      return;
    }

    const target =
      allPersons.find((p) => p.id === ctx.targetPersonId) || person;
    const updates = applyUnifiedEventToPerson(target, allPersons, payload, ctx);
    onUpdatePerson(target.id, updates);
    setEventEditContext(null);
  };

  const handleUnifiedEventDelete = (ctx: EventEditContext) => {
    if (!person) return;
    const target =
      allPersons.find((p) => p.id === ctx.targetPersonId) || person;
    const updates = removeUnifiedEventFromPerson(target, allPersons, ctx);
    if (updates) {
      onUpdatePerson(target.id, updates);
    }
    setEventEditContext(null);
  };

  const openCreateAliasModal = () => {
    setAliasEditContext({
      mode: 'create',
      initialAlias: {
        id: createEntityId('alias'),
        type: '',
        surname: '',
        name: '',
      },
    });
  };

  const openEditAliasModal = (item: PersonAliasRecord, index: number) => {
    setAliasEditContext({
      mode: 'edit',
      index,
      initialAlias: item,
    });
  };

  const handleAliasSave = (
    ctx: AliasEditContext,
    nextAlias: PersonAliasRecord
  ) => {
    if (!person) return;
    onUpdatePerson(person.id, applyAliasSave(person, ctx, nextAlias));
  };

  const handleAliasDelete = (ctx: AliasEditContext) => {
    if (!person) return;
    onUpdatePerson(person.id, applyAliasDelete(person, ctx));
  };

  return {
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
  };
}
