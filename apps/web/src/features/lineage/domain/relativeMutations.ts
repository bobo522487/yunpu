import { createEntityId } from '../../../lib/id';
import type {
  AddRelativeContext,
  AddRelativeSubmitPayload,
} from './addRelativeTypes';
import type { PersonLifeEvent, PersonRecord } from '../types';
import { normalizePersonForSave } from '../utils/personHelpers';
import { addParentToPersons, collectSubtreeIds } from './lineageGraph';

export interface RelativeMutationResult {
  persons: PersonRecord[];
  selectId: string | null;
}

function makePersonId(prefix = 'person'): string {
  return createEntityId(prefix);
}

function buildVitalFields(payload: AddRelativeSubmitPayload): {
  birth?: PersonRecord['birth'];
  death?: PersonRecord['death'];
} {
  const birth =
    payload.birthDate || payload.birthPlace
      ? {
          structuredDate: payload.birthDate ?? undefined,
          structuredPlace: payload.birthPlace ?? undefined,
        }
      : undefined;

  const death =
    payload.status === 'deceased' &&
    (payload.deathDate ||
      payload.deathPlace ||
      payload.deathCause ||
      payload.burialPlace)
      ? {
          structuredDate: payload.deathDate ?? undefined,
          structuredPlace: payload.deathPlace ?? undefined,
          cause: payload.deathCause,
          structuredBurialPlace: payload.burialPlace ?? undefined,
        }
      : undefined;

  return { birth, death };
}

function formatFullName(
  person: Pick<PersonRecord, 'surname' | 'name' | 'spouseOfId'>,
  fallbackSurname: string
): string {
  const surname =
    person.surname?.trim() || (!person.spouseOfId ? fallbackSurname : '');
  const given = person.name?.trim() || '';
  if (surname && given && !given.startsWith(surname)) {
    return `${surname}${given}`;
  }
  return given || surname || '配偶';
}

function insertChild(
  persons: PersonRecord[],
  chartId: string,
  context: AddRelativeContext,
  payload: AddRelativeSubmitPayload,
  keepSelection: boolean
): RelativeMutationResult {
  const anchor = context.targetPerson;
  const isAnchorMother = Boolean(anchor.gender === 'female' && !anchor.spouseOfId);
  const siblingCount = persons.filter(
    (p) =>
      !p.spouseOfId &&
      (isAnchorMother ? p.motherId === anchor.id : p.fatherId === anchor.id)
  ).length;

  let referencePersons = persons;
  let resolvedMotherId = payload.motherId ?? context.motherInfo?.motherId;

  if (payload.shouldAutoCreateMother && !isAnchorMother) {
    const existingSpouseCount = persons.filter(
      (p) => p.spouseOfId === anchor.id
    ).length;
    const autoMother = normalizePersonForSave(
      {
        id: makePersonId('person-mother'),
        branchId: chartId,
        name: payload.motherName?.trim() || '不详',
        generation: anchor.generation,
        gender: 'female',
        status: anchor.status || 'living',
        siblingOrder: existingSpouseCount + 1,
        fatherId: null,
        spouseOfId: anchor.id,
        relationType: '妻子',
        biographyOrder: persons.length + 1,
      },
      referencePersons
    );
    referencePersons = [...referencePersons, autoMother];
    resolvedMotherId = autoMother.id;
  }

  const { birth, death } = buildVitalFields(payload);
  const defaultRel = payload.gender === 'female' ? '生女' : '生子';
  const child = normalizePersonForSave(
    {
      id: makePersonId(),
      branchId: chartId,
      surname: payload.surname,
      name: payload.name,
      romanizedName: payload.romanizedName,
      generation: anchor ? anchor.generation + 1 : 1,
      gender: payload.gender,
      status: payload.status,
      siblingOrder: siblingCount + 1,
      fatherId: isAnchorMother ? null : anchor.id,
      motherId: isAnchorMother ? anchor.id : resolvedMotherId,
      relationType: payload.relationType || defaultRel,
      fatherRelationType:
        payload.fatherRelationType || payload.relationType || defaultRel,
      motherRelationType:
        payload.motherRelationType || payload.relationType || defaultRel,
      birth,
      death,
      biographyOrder: referencePersons.length + 1,
    },
    referencePersons
  );

  return {
    persons: [...referencePersons, child],
    selectId: keepSelection ? child.id : null,
  };
}

function insertSibling(
  persons: PersonRecord[],
  chartId: string,
  context: AddRelativeContext,
  payload: AddRelativeSubmitPayload,
  keepSelection: boolean
): RelativeMutationResult {
  const ref = context.targetPerson;
  const siblingCount = ref.fatherId
    ? persons.filter((p) => p.fatherId === ref.fatherId && !p.spouseOfId).length
    : ref.motherId
      ? persons.filter((p) => p.motherId === ref.motherId && !p.spouseOfId).length
      : persons.filter(
          (p) => !p.fatherId && !p.spouseOfId && p.generation === ref.generation
        ).length;

  const { birth, death } = buildVitalFields(payload);
  const sibling = normalizePersonForSave(
    {
      id: makePersonId(),
      branchId: chartId,
      surname: payload.surname,
      name: payload.name,
      romanizedName: payload.romanizedName,
      generation: ref.generation || 1,
      gender: payload.gender,
      status: payload.status,
      siblingOrder: siblingCount + 1,
      fatherId: ref.fatherId ?? null,
      motherId: ref.motherId,
      relationType: payload.gender === 'female' ? '生女' : '生子',
      birth,
      death,
      biographyOrder: persons.length + 1,
    },
    persons
  );

  return {
    persons: [...persons, sibling],
    selectId: keepSelection ? sibling.id : null,
  };
}

function insertSpouse(
  persons: PersonRecord[],
  chartId: string,
  effectiveSurname: string,
  context: AddRelativeContext,
  payload: AddRelativeSubmitPayload,
  keepSelection: boolean
): RelativeMutationResult {
  const partner = context.targetPerson;
  const existingSpouseCount = persons.filter(
    (p) => p.spouseOfId === partner.id
  ).length;
  const relationType =
    payload.gender === 'male'
      ? '丈夫'
      : payload.gender === 'female'
        ? '妻子'
        : '配偶';

  const newSpouseId = makePersonId();
  const hasMarriageEvent = Boolean(
    payload.marriageDate || payload.marriagePlace
  );
  const partnerName = formatFullName(partner, effectiveSurname);
  const spouseName = formatFullName(
    { surname: payload.surname, name: payload.name, spouseOfId: partner.id },
    ''
  );

  const { birth, death } = buildVitalFields(payload);
  const spouseEvents: PersonLifeEvent[] | undefined = hasMarriageEvent
    ? [
        {
          id: `ev-marriage-${partner.id}`,
          type: 'marriage',
          structuredDate: payload.marriageDate ?? undefined,
          structuredPlace: payload.marriagePlace ?? undefined,
          description: `与${partnerName}结缡`,
        },
      ]
    : undefined;

  const spouse = normalizePersonForSave(
    {
      id: newSpouseId,
      branchId: chartId,
      surname: payload.surname,
      name: payload.name,
      romanizedName: payload.romanizedName,
      generation: partner.generation,
      gender: payload.gender,
      status: payload.status,
      siblingOrder: existingSpouseCount + 1,
      fatherId: null,
      spouseOfId: partner.id,
      relationType,
      birth,
      death,
      events: spouseEvents,
      biographyOrder: persons.length + 1,
    },
    persons
  );

  const nextPersons = hasMarriageEvent
    ? persons.map((p) => {
        if (p.id !== partner.id) return p;
        const partnerEvent: PersonLifeEvent = {
          id: `ev-marriage-${newSpouseId}`,
          type: 'marriage',
          structuredDate: payload.marriageDate ?? undefined,
          structuredPlace: payload.marriagePlace ?? undefined,
          description: `与${spouseName}结缡`,
        };
        return { ...p, events: [...(p.events || []), partnerEvent] };
      })
    : persons;

  return {
    persons: [...nextPersons, spouse],
    selectId: keepSelection ? spouse.id : null,
  };
}

function insertParent(
  persons: PersonRecord[],
  chartId: string,
  context: AddRelativeContext,
  payload: AddRelativeSubmitPayload,
  keepSelection: boolean
): RelativeMutationResult {
  const target = context.targetPerson;
  const existingFather = target.fatherId
    ? persons.find((p) => p.id === target.fatherId) || null
    : null;
  const { birth, death } = buildVitalFields(payload);
  const newParentId = makePersonId();

  // Case 1: Adding mother when father already exists -> attach as father's spouse + set motherId
  if (payload.gender === 'female' && existingFather) {
    const spouseCount = persons.filter(
      (p) => p.spouseOfId === existingFather.id
    ).length;
    const mother = normalizePersonForSave(
      {
        id: newParentId,
        branchId: chartId,
        surname: payload.surname,
        name: payload.name,
        romanizedName: payload.romanizedName,
        generation: existingFather.generation,
        gender: 'female',
        status: payload.status,
        siblingOrder: spouseCount + 1,
        fatherId: null,
        spouseOfId: existingFather.id,
        relationType: '妻子',
        birth,
        death,
        biographyOrder: persons.length + 1,
      },
      persons
    );
    const nextPersons = persons.map((p) =>
      p.id === target.id ? { ...p, motherId: mother.id } : p
    );
    return {
      persons: [...nextPersons, mother],
      selectId: keepSelection && !target.spouseOfId ? mother.id : null,
    };
  }

  // Case 2: Adding mother without father (or parent of a spouse node) -> no fake "不详" father node!
  if (payload.gender === 'female' || target.spouseOfId) {
    const parentGen = Math.max(1, (target.generation || 1) - 1);
    const needShiftDown =
      !target.spouseOfId && (target.generation || 1) <= 1 && payload.gender === 'female';
    const subtreeIds = needShiftDown
      ? collectSubtreeIds(persons, target.id)
      : new Set<string>();
    const parentDraft = normalizePersonForSave(
      {
        id: newParentId,
        branchId: chartId,
        surname: payload.surname,
        name: payload.name,
        romanizedName: payload.romanizedName,
        generation: needShiftDown ? 1 : parentGen,
        gender: payload.gender,
        status: payload.status,
        fatherId: null,
        birth,
        death,
        biographyOrder: 1,
      },
      persons
    );

    const linkField = payload.gender === 'female' ? 'motherId' : 'fatherId';
    const updatedPersons = persons.map((p) => {
      const genBump = needShiftDown && subtreeIds.has(p.id) ? 1 : 0;
      if (p.id === target.id) {
        return {
          ...p,
          generation: (p.generation || 1) + genBump,
          [linkField]: parentDraft.id,
          relationTitle:
            needShiftDown && p.relationTitle === '始迁祖'
              ? undefined
              : p.relationTitle,
        };
      }
      return genBump > 0
        ? { ...p, generation: (p.generation || 1) + genBump }
        : p;
    });

    return {
      persons: [parentDraft, ...updatedPersons],
      selectId: keepSelection && !target.spouseOfId ? parentDraft.id : null,
    };
  }

  // Case 3: Adding father for primary lineage member -> shift gen-1 subtree if needed
  const fatherDraft = normalizePersonForSave(
    {
      id: newParentId,
      branchId: chartId,
      surname: payload.surname,
      name: payload.name,
      romanizedName: payload.romanizedName,
      generation: target.generation <= 1 ? 1 : target.generation - 1,
      gender: payload.gender,
      status: payload.status,
      fatherId: null,
      birth,
      death,
      biographyOrder: 1,
    },
    persons
  );
  const res = addParentToPersons(persons, target.id, fatherDraft);
  return {
    persons: res.persons,
    selectId: keepSelection ? res.addedParentId : null,
  };
}

export function applyAddRelative(
  persons: PersonRecord[],
  chartId: string,
  effectiveSurname: string,
  context: AddRelativeContext,
  payload: AddRelativeSubmitPayload,
  keepSelection: boolean
): RelativeMutationResult {
  switch (context.relation) {
    case 'child':
      return insertChild(persons, chartId, context, payload, keepSelection);
    case 'sibling':
      return insertSibling(persons, chartId, context, payload, keepSelection);
    case 'spouse':
      return insertSpouse(
        persons,
        chartId,
        effectiveSurname,
        context,
        payload,
        keepSelection
      );
    case 'parent':
      return insertParent(persons, chartId, context, payload, keepSelection);
  }
}

export function createDirectPersonRecord(
  chartId: string,
  effectiveSurname: string,
  existingCount: number,
  initialData: Partial<PersonRecord>
): PersonRecord {
  return {
    id: makePersonId(),
    surname: effectiveSurname || undefined,
    name: initialData.name || '新录族人',
    generation: initialData.generation || 1,
    gender: initialData.gender || 'male',
    status: initialData.status || 'living',
    fatherId: initialData.fatherId ?? null,
    relationType:
      initialData.relationType ??
      (initialData.gender === 'female' ? '生女' : '生子'),
    branchId: chartId,
    biographyOrder: existingCount + 1,
  };
}
