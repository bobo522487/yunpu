import type {
  ApiRelationKind,
  PersonBirthInfoInput,
  PersonDeathInfoInput,
  PersonNameKind,
  UpdatePersonInput,
} from '@yunpu/shared';
import type { TreeItem } from '../../components/common/Tree/types';
import {
  type FolderDto,
  type LineageDto,
  type LineageGraphPayload,
  type PersonDto,
  type PersonNameDto,
  projectMediaUrl,
  type RelationDto,
} from './api';
import type {
  PersonAliasRecord,
  PersonAliasType,
  PersonLifeEvent,
  PersonRecord,
  RelationKind,
} from './types';

export const PARENT_API_RELATION_KINDS: ReadonlySet<ApiRelationKind> = new Set([
  'biological_parent',
  'adoptive_parent',
  'ritual_heir',
  'step_parent',
  'foster_parent',
]);

export function nonEmptyOrUndefined(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function nonEmptyOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function composeDisplayName(
  surname?: string | null,
  name?: string | null,
): string {
  const s = surname?.trim() ?? '';
  const n = name?.trim() ?? '';
  if (s && n && !n.startsWith(s)) {
    return `${s}${n}`;
  }
  return n || s || '未命名';
}

function extractGivenName(dto: PersonDto): string {
  const surname = dto.surname?.trim() ?? '';
  const display = dto.displayName.trim();
  if (surname && display.startsWith(surname) && display.length > surname.length) {
    return display.slice(surname.length);
  }
  if (dto.givenName?.trim()) {
    return dto.givenName.trim();
  }
  return display;
}

export function personNameKindToChinese(
  kind: PersonNameKind,
  label?: string | null,
): PersonAliasType | string {
  if (label?.trim()) return label.trim();
  switch (kind) {
    case 'courtesy':
      return '字';
    case 'art':
      return '号';
    case 'milk':
      return '乳名';
    case 'genealogy':
      return '谱名';
    case 'posthumous':
      return '谥号';
    case 'formal':
      return '曾用名';
    case 'other':
    default:
      return '其他';
  }
}

export function aliasTypeToPersonNameKind(type?: string): PersonNameKind {
  switch (type?.trim()) {
    case '字':
      return 'courtesy';
    case '号':
      return 'art';
    case '乳名':
      return 'milk';
    case '谱名':
      return 'genealogy';
    case '谥':
    case '谥号':
      return 'posthumous';
    case '曾用名':
      return 'formal';
    default:
      return 'other';
  }
}

export function relationKindToChineseLabel(
  kind: ApiRelationKind,
  childSex: 'male' | 'female' | 'unknown' | 'other',
  roleLabel?: string | null,
): RelationKind {
  if (roleLabel?.trim()) return roleLabel.trim();
  if (kind === 'adoptive_parent') return childSex === 'female' ? '养女' : '养子';
  if (kind === 'ritual_heir') return '承嗣';
  if (kind === 'step_parent') return childSex === 'female' ? '继女' : '继子';
  if (kind === 'foster_parent') return '抚子';
  if (kind === 'spouse') return childSex === 'female' ? '妻子' : '配偶';
  if (kind === 'partner') return '配偶';
  return childSex === 'female' ? '生女' : '生子';
}

export function chineseRelationToApiKind(label?: string): ApiRelationKind {
  const clean = label?.trim() ?? '';
  if (!clean) return 'biological_parent';
  if (clean === '养子' || clean === '养女' || clean === '义子') {
    return 'adoptive_parent';
  }
  if (
    clean === '过继' ||
    clean === '承嗣' ||
    clean === '出嗣' ||
    clean === '出继' ||
    clean === '承继' ||
    clean === '出祧' ||
    clean === '兼祧' ||
    clean === '出绍' ||
    clean === '奉祀'
  ) {
    return 'ritual_heir';
  }
  if (clean === '继子' || clean === '继女') {
    return 'step_parent';
  }
  if (clean === '抚子') {
    return 'foster_parent';
  }
  if (clean === '妻子' || clean === '丈夫' || clean === '配偶') {
    return 'spouse';
  }
  return 'biological_parent';
}

function lineageToTreeItem(item: LineageDto): TreeItem {
  return {
    id: item.id,
    type: 'chart',
    data: {
      name: item.name,
      ...(item.surname ? { surname: item.surname } : {}),
      ...(item.hallName ? { hallName: item.hallName } : {}),
      ...(item.progenitor ? { progenitor: item.progenitor } : {}),
      ...(item.region ? { region: item.region } : {}),
      folderId: item.folderId,
      seq: item.seq,
      version: item.version,
    },
    children: [],
  };
}

export function directoryToTreeItems(
  folders: FolderDto[],
  lineages: LineageDto[],
  collapsedFolderIds: Record<string, boolean> = {},
): TreeItem[] {
  const sortedFolders = [...folders].sort(
    (a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt),
  );
  const sortedLineages = [...lineages].sort(
    (a, b) => a.seq - b.seq || a.createdAt.localeCompare(b.createdAt),
  );

  const folderIdSet = new Set(sortedFolders.map((f) => f.id));
  const childrenByFolder = new Map<string, TreeItem[]>();
  const rootLineages: { seq: number; createdAt: string; item: TreeItem }[] = [];

  for (const item of sortedLineages) {
    const node = lineageToTreeItem(item);
    if (item.folderId && folderIdSet.has(item.folderId)) {
      const list = childrenByFolder.get(item.folderId) ?? [];
      list.push(node);
      childrenByFolder.set(item.folderId, list);
    } else {
      rootLineages.push({ seq: item.seq, createdAt: item.createdAt, item: node });
    }
  }

  const topLevel: { seq: number; createdAt: string; kindOrder: number; item: TreeItem }[] = [];
  for (const folder of sortedFolders) {
    topLevel.push({
      seq: folder.seq,
      createdAt: folder.createdAt,
      kindOrder: 0,
      item: {
        id: folder.id,
        type: 'folder',
        collapsed: Boolean(collapsedFolderIds[folder.id]),
        data: {
          name: folder.name,
          seq: folder.seq,
        },
        children: childrenByFolder.get(folder.id) ?? [],
      },
    });
  }
  for (const entry of rootLineages) {
    topLevel.push({
      seq: entry.seq,
      createdAt: entry.createdAt,
      kindOrder: 1,
      item: entry.item,
    });
  }

  topLevel.sort(
    (a, b) =>
      a.seq - b.seq ||
      a.kindOrder - b.kindOrder ||
      a.createdAt.localeCompare(b.createdAt),
  );
  return topLevel.map((entry) => entry.item);
}

function dtoToGender(sex: PersonDto['sex']): PersonRecord['gender'] {
  return sex === 'female' ? 'female' : sex === 'male' ? 'male' : 'unknown';
}

function dtoNamesToAliasItems(
  names: PersonNameDto[] | undefined,
): PersonAliasRecord[] | undefined {
  if (!names) return undefined;
  const secondary = names.filter((n) => !n.isPrimary);
  if (secondary.length === 0) return [];
  return secondary.map((n) => ({
    id: n.id,
    type: personNameKindToChinese(n.kind, n.label),
    ...(n.surname ? { surname: n.surname } : {}),
    name: n.value,
    ...(n.romanizedSurname || n.romanizedName
      ? {
          romanizedName: {
            ...(n.romanizedSurname ? { surname: n.romanizedSurname } : {}),
            ...(n.romanizedName ? { name: n.romanizedName } : {}),
          },
        }
      : {}),
  }));
}

function resolveSpousePair(
  rel: RelationDto,
  personById: Map<string, PersonDto>,
  parentedPersonIds: Set<string>,
): {
  anchorId: string;
  spouseId: string;
  spouseRoleLabel: string | null;
} {
  const from = personById.get(rel.fromPersonId);
  const to = personById.get(rel.toPersonId);
  const fromHasParent = parentedPersonIds.has(rel.fromPersonId);
  const toHasParent = parentedPersonIds.has(rel.toPersonId);

  let fromIsAnchor = true;
  if (fromHasParent !== toHasParent) {
    fromIsAnchor = fromHasParent;
  } else if (rel.fromRoleLabel === '夫' && rel.toRoleLabel !== '夫') {
    fromIsAnchor = true;
  } else if (rel.toRoleLabel === '夫' && rel.fromRoleLabel !== '夫') {
    fromIsAnchor = false;
  } else if (from?.sex === 'female' && to?.sex === 'male') {
    fromIsAnchor = false;
  } else if (from?.sex === 'male' && to?.sex === 'female') {
    fromIsAnchor = true;
  } else if (
    to?.relationTitle?.includes('始') &&
    !from?.relationTitle?.includes('始')
  ) {
    fromIsAnchor = false;
  } else if (
    from?.relationTitle?.includes('始') &&
    !to?.relationTitle?.includes('始')
  ) {
    fromIsAnchor = true;
  } else if (from?.relationTitle?.includes('配') || from?.relationTitle?.includes('妻')) {
    fromIsAnchor = false;
  }

  return fromIsAnchor
    ? {
        anchorId: rel.fromPersonId,
        spouseId: rel.toPersonId,
        spouseRoleLabel: rel.toRoleLabel,
      }
    : {
        anchorId: rel.toPersonId,
        spouseId: rel.fromPersonId,
        spouseRoleLabel: rel.fromRoleLabel,
      };
}

export function graphToPersonRecords(
  projectId: string,
  payload: LineageGraphPayload,
): PersonRecord[] {
  const personById = new Map(payload.persons.map((p) => [p.id, p]));
  const projectionByPersonId = new Map(
    payload.projections.map((proj) => [proj.personId, proj]),
  );

  const fatherByChild = new Map<string, { id: string; relationType: RelationKind }>();
  const motherByChild = new Map<string, { id: string; relationType: RelationKind }>();
  const parentedPersonIds = new Set<string>();

  for (const rel of payload.relations) {
    if (!PARENT_API_RELATION_KINDS.has(rel.kind)) continue;
    const parentDto = personById.get(rel.fromPersonId);
    const childDto = personById.get(rel.toPersonId);
    if (!parentDto || !childDto) continue;
    parentedPersonIds.add(childDto.id);

    const roleLabel = relationKindToChineseLabel(
      rel.kind,
      childDto.sex,
      rel.toRoleLabel,
    );
    if (parentDto.sex === 'female') {
      if (!motherByChild.has(childDto.id)) {
        motherByChild.set(childDto.id, {
          id: parentDto.id,
          relationType: roleLabel,
        });
      }
    } else if (!fatherByChild.has(childDto.id)) {
      fatherByChild.set(childDto.id, {
        id: parentDto.id,
        relationType: roleLabel,
      });
    }
  }

  const spouseAssignment = new Map<
    string,
    {
      spouseOfId: string;
      relationType: RelationKind;
      siblingOrder: number;
    }
  >();

  const spouseCounterByAnchor = new Map<string, number>();
  for (const rel of payload.relations) {
    if (rel.kind !== 'spouse' && rel.kind !== 'partner') continue;
    if (!personById.has(rel.fromPersonId) || !personById.has(rel.toPersonId)) {
      continue;
    }
    const pair = resolveSpousePair(rel, personById, parentedPersonIds);
    if (spouseAssignment.has(pair.spouseId)) continue;
    const nextIdx = (spouseCounterByAnchor.get(pair.anchorId) ?? 0) + 1;
    spouseCounterByAnchor.set(pair.anchorId, nextIdx);

    const spouseDto = personById.get(pair.spouseId);
    const fallbackLabel =
      spouseDto?.sex === 'male'
        ? '丈夫'
        : spouseDto?.sex === 'female'
          ? '妻子'
          : '配偶';
    spouseAssignment.set(pair.spouseId, {
      spouseOfId: pair.anchorId,
      relationType: pair.spouseRoleLabel?.trim() || fallbackLabel,
      siblingOrder:
        typeof rel.sortOrder === 'number' ? rel.sortOrder + 1 : nextIdx,
    });
  }

  const baseRecords = payload.persons.map((dto, index): PersonRecord => {
    const proj = projectionByPersonId.get(dto.id);
    const father = fatherByChild.get(dto.id);
    const mother = motherByChild.get(dto.id);
    const spouse = spouseAssignment.get(dto.id);
    const aliasItems = dtoNamesToAliasItems(dto.names);
    const romanizedName =
      dto.romanizedSurname || dto.romanizedName || dto.romanizedSuffix
        ? {
            ...(dto.romanizedSurname ? { surname: dto.romanizedSurname } : {}),
            ...(dto.romanizedName ? { name: dto.romanizedName } : {}),
            ...(dto.romanizedSuffix ? { suffix: dto.romanizedSuffix } : {}),
          }
        : undefined;

    const events: PersonLifeEvent[] | undefined = dto.events?.map((ev) => ({
      id: ev.id,
      type: ev.type,
      structuredDate: ev.structuredDate,
      structuredPlace: ev.structuredPlace,
      description: ev.description ?? undefined,
    }));

    const avatarUrl = dto.avatarKey
      ? projectMediaUrl(projectId, dto.avatarKey)
      : undefined;

    return {
      id: dto.id,
      branchId: dto.lineageId,
      version: dto.version,
      avatarKey: dto.avatarKey,
      avatarUrl,
      avatarOriginalUrl: avatarUrl,
      avatarPhotos: avatarUrl ? [avatarUrl] : undefined,
      surname: dto.surname ?? undefined,
      name: extractGivenName(dto),
      ...(romanizedName ? { romanizedName } : {}),
      gender: dtoToGender(dto.sex),
      status: dto.isLiving ? 'living' : 'deceased',
      generation: (proj?.generation ?? 0) + 1,
      generationWord: dto.generationWord ?? undefined,
      siblingOrder:
        spouse?.siblingOrder ?? dto.siblingOrder ?? undefined,
      fatherId: father ? father.id : null,
      motherId: mother?.id,
      spouseOfId: spouse?.spouseOfId,
      relationType:
        spouse?.relationType ??
        father?.relationType ??
        mother?.relationType,
      fatherRelationType: father?.relationType,
      motherRelationType: mother?.relationType,
      relationTitle: dto.relationTitle ?? undefined,
      birth: dto.birthInfo ?? undefined,
      death: dto.deathInfo ?? undefined,
      events,
      biography: dto.biography ?? undefined,
      biographyOrder: index + 1,
      notes: dto.notes ?? undefined,
      aliasItems,
      aliases: aliasItems?.map((a) => `${a.surname ?? ''}${a.name}`),
    };
  });

  // Ensure every spouse shares their anchor partner's generation
  const generationById = new Map(baseRecords.map((p) => [p.id, p.generation]));
  return baseRecords.map((record) => {
    if (!record.spouseOfId) return record;
    const anchorGen = generationById.get(record.spouseOfId);
    if (!anchorGen || anchorGen === record.generation) return record;
    return { ...record, generation: anchorGen };
  });
}

function cleanBirthInfo(
  birth?: PersonRecord['birth'],
): PersonBirthInfoInput | null {
  if (!birth) return null;
  const payload: PersonBirthInfoInput = {
    ...(birth.structuredDate !== undefined
      ? { structuredDate: birth.structuredDate }
      : {}),
    ...(birth.structuredPlace !== undefined
      ? { structuredPlace: birth.structuredPlace }
      : {}),
    ...(birth.summary?.trim() ? { summary: birth.summary.trim() } : {}),
  };
  return Object.keys(payload).length > 0 ? payload : null;
}

function cleanDeathInfo(
  death?: PersonRecord['death'],
): PersonDeathInfoInput | null {
  if (!death) return null;
  const payload: PersonDeathInfoInput = {
    ...(death.structuredDate !== undefined
      ? { structuredDate: death.structuredDate }
      : {}),
    ...(death.structuredPlace !== undefined
      ? { structuredPlace: death.structuredPlace }
      : {}),
    ...(death.structuredBurialDate !== undefined
      ? { structuredBurialDate: death.structuredBurialDate }
      : {}),
    ...(death.structuredBurialPlace !== undefined
      ? { structuredBurialPlace: death.structuredBurialPlace }
      : {}),
    ...(death.cause?.trim() ? { cause: death.cause.trim() } : {}),
    ...(death.summary?.trim() ? { summary: death.summary.trim() } : {}),
    ...(typeof death.manualAge === 'number'
      ? { manualAge: death.manualAge }
      : {}),
  };
  return Object.keys(payload).length > 0 ? payload : null;
}

export function buildUpdatePersonInput(
  current: PersonRecord,
  updates: Partial<PersonRecord>,
): UpdatePersonInput | null {
  const payload: Record<string, unknown> = {
    version: current.version ?? 1,
  };
  let hasField = false;

  if (updates.surname !== undefined || updates.name !== undefined) {
    const nextSurname =
      updates.surname !== undefined ? updates.surname : current.surname;
    const nextName = updates.name !== undefined ? updates.name : current.name;
    payload.displayName = composeDisplayName(nextSurname, nextName);
    if (updates.surname !== undefined) {
      payload.surname = nonEmptyOrNull(updates.surname);
    }
    if (updates.name !== undefined) {
      payload.givenName = nonEmptyOrNull(updates.name);
    }
    hasField = true;
  }

  if (updates.romanizedName !== undefined) {
    payload.romanizedSurname = nonEmptyOrNull(updates.romanizedName?.surname);
    payload.romanizedName = nonEmptyOrNull(updates.romanizedName?.name);
    payload.romanizedSuffix = nonEmptyOrNull(updates.romanizedName?.suffix);
    hasField = true;
  }

  if (updates.gender !== undefined) {
    payload.sex = updates.gender;
    hasField = true;
  }

  if (updates.status !== undefined) {
    const nextLiving = updates.status === 'living';
    payload.isLiving = nextLiving;
    if (nextLiving) {
      payload.deathInfo = null;
      payload.deathYear = null;
    }
    hasField = true;
  }

  if (updates.birth !== undefined) {
    payload.birthInfo = cleanBirthInfo(updates.birth);
    hasField = true;
  }

  if (updates.death !== undefined && updates.status !== 'living') {
    payload.deathInfo = cleanDeathInfo(updates.death);
    hasField = true;
  }

  if (updates.generationWord !== undefined) {
    payload.generationWord = nonEmptyOrNull(updates.generationWord);
    hasField = true;
  }

  if (updates.relationTitle !== undefined) {
    payload.relationTitle = nonEmptyOrNull(updates.relationTitle);
    hasField = true;
  }

  if (updates.siblingOrder !== undefined && !current.spouseOfId) {
    payload.siblingOrder =
      updates.siblingOrder === null || updates.siblingOrder === undefined
        ? null
        : Math.max(0, updates.siblingOrder);
    hasField = true;
  }

  if (updates.biography !== undefined) {
    payload.biography = updates.biography?.trim() ? updates.biography : null;
    hasField = true;
  }

  if (updates.notes !== undefined) {
    payload.notes = updates.notes?.trim() ? updates.notes : null;
    hasField = true;
  }

  if (updates.avatarKey !== undefined) {
    payload.avatarKey = nonEmptyOrNull(updates.avatarKey);
    hasField = true;
  }

  return hasField ? (payload as UpdatePersonInput) : null;
}

export { cleanBirthInfo, cleanDeathInfo };
