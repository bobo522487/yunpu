import type {
  ApiRelationKind,
  CreateFolderInput,
  CreateLineageInput,
  CreatePersonInput,
  CreateRelativeInput,
  PersonEventType,
  PersonNameKind,
  PersonSex,
  UpdateFolderInput,
  UpdateLineageInput,
  UpdatePersonAggregateInput,
} from '@yunpu/shared';
import type { GenealogyDate } from '../date-input/date.types';
import type { GenealogyPlace } from '../place-input/place.types';
import { apiRequest, apiUpload } from '../../lib/api';
import type { PersonBirthInfo, PersonDeathInfo } from './types';

export interface FolderDto {
  id: string;
  projectId: string;
  name: string;
  seq: number;
  createdAt: string;
  updatedAt: string;
}

export interface LineageDto {
  id: string;
  projectId: string;
  folderId: string | null;
  name: string;
  surname: string | null;
  hallName: string | null;
  progenitor: string | null;
  region: GenealogyPlace | null;
  seq: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LineageDirectoryPayload {
  folders: FolderDto[];
  lineages: LineageDto[];
}

export interface PersonNameDto {
  id: string;
  projectId: string;
  personId: string;
  kind: PersonNameKind;
  value: string;
  surname: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  label: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PersonEventDto {
  id: string;
  projectId: string;
  personId: string;
  type: PersonEventType;
  structuredDate: GenealogyDate | null;
  structuredPlace: GenealogyPlace | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonDto {
  id: string;
  projectId: string;
  lineageId: string;
  displayName: string;
  sex: PersonSex;
  surname: string | null;
  givenName: string | null;
  romanizedSurname: string | null;
  romanizedName: string | null;
  romanizedSuffix: string | null;
  birthYear: number | null;
  deathYear: number | null;
  isLiving: boolean;
  birthInfo: PersonBirthInfo | null;
  deathInfo: PersonDeathInfo | null;
  generationWord: string | null;
  relationTitle: string | null;
  siblingOrder: number | null;
  biography: string | null;
  notes: string | null;
  avatarKey: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  names?: PersonNameDto[];
  events?: PersonEventDto[];
}

export interface RelationDto {
  id: string;
  projectId: string;
  fromPersonId: string;
  toPersonId: string;
  kind: ApiRelationKind;
  fromRoleLabel: string | null;
  toRoleLabel: string | null;
  sortOrder: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectionDto {
  personId: string;
  primaryPath: string;
  generation: number;
}

export interface LineageGraphPayload {
  lineage: LineageDto;
  persons: PersonDto[];
  relations: RelationDto[];
  projections: ProjectionDto[];
}

export interface PersonPagePayload {
  persons: PersonDto[];
  nextCursor: string | null;
}

export interface SubgraphPayload {
  rootPersonId: string;
  persons: PersonDto[];
  relations: RelationDto[];
  hasMoreAncestors: boolean;
  hasMoreDescendants: boolean;
}

export interface SubgraphQueryOptions {
  rootPersonId: string;
  upDepth?: number;
  downDepth?: number;
  limit?: number;
}

export interface PersonAggregatePayload {
  person: PersonDto;
  relations: RelationDto[];
  projection: ProjectionDto | null;
}

export interface CreateRelativePayload {
  person: PersonDto;
  companionPerson: PersonDto | null;
  relations: RelationDto[];
  anchorEvents: PersonEventDto[];
}

export interface ProjectMediaUploadPayload {
  key: string;
  url: string;
}

export function projectMediaUrl(projectId: string, avatarKey: string): string {
  return `/api/v1/projects/${projectId}/media/${encodeURIComponent(avatarKey)}`;
}

// ---- 平铺分组 & 谱系图 ----

export const fetchLineageDirectory = (projectId: string) =>
  apiRequest<LineageDirectoryPayload>(`/api/v1/projects/${projectId}/lineages`);

export const createFolderRequest = (
  projectId: string,
  payload: CreateFolderInput,
) =>
  apiRequest<{ folder: FolderDto }>(`/api/v1/projects/${projectId}/folders`, {
    method: 'POST',
    body: payload,
  });

export const updateFolderRequest = (
  projectId: string,
  folderId: string,
  payload: UpdateFolderInput,
) =>
  apiRequest<{ folder: FolderDto }>(
    `/api/v1/projects/${projectId}/folders/${folderId}`,
    { method: 'PATCH', body: payload },
  );

export const deleteFolderRequest = (projectId: string, folderId: string) =>
  apiRequest<{ deleted: boolean }>(
    `/api/v1/projects/${projectId}/folders/${folderId}`,
    { method: 'DELETE' },
  );

export const createLineageRequest = (
  projectId: string,
  payload: CreateLineageInput,
) =>
  apiRequest<{ lineage: LineageDto; progenitorPerson: PersonDto | null }>(
    `/api/v1/projects/${projectId}/lineages`,
    { method: 'POST', body: payload },
  );

export const updateLineageRequest = (
  projectId: string,
  lineageId: string,
  payload: UpdateLineageInput,
) =>
  apiRequest<{ lineage: LineageDto }>(
    `/api/v1/projects/${projectId}/lineages/${lineageId}`,
    { method: 'PATCH', body: payload },
  );

export const deleteLineageRequest = (projectId: string, lineageId: string) =>
  apiRequest<{ deleted: boolean }>(
    `/api/v1/projects/${projectId}/lineages/${lineageId}`,
    { method: 'DELETE' },
  );

export const fetchLineageGraph = (projectId: string, lineageId: string) =>
  apiRequest<LineageGraphPayload>(
    `/api/v1/projects/${projectId}/lineages/${lineageId}/graph`,
  );

export const fetchPersonDetail = (projectId: string, personId: string) =>
  apiRequest<{ person: PersonDto }>(
    `/api/v1/projects/${projectId}/persons/${personId}`,
  );

export const fetchLineagePersonsPage = (
  projectId: string,
  options: { lineageId?: string; cursor?: string; limit?: number } = {},
) => {
  const search = new URLSearchParams();
  if (options.lineageId) search.set('lineageId', options.lineageId);
  if (options.cursor) search.set('cursor', options.cursor);
  if (options.limit !== undefined) search.set('limit', String(options.limit));
  const qs = search.toString();
  return apiRequest<PersonPagePayload>(
    `/api/v1/projects/${projectId}/persons${qs ? `?${qs}` : ''}`,
  );
};

export const fetchSubgraph = (
  projectId: string,
  options: SubgraphQueryOptions,
) => {
  const search = new URLSearchParams({
    rootPersonId: options.rootPersonId,
  });
  if (options.upDepth !== undefined) {
    search.set('upDepth', String(options.upDepth));
  }
  if (options.downDepth !== undefined) {
    search.set('downDepth', String(options.downDepth));
  }
  if (options.limit !== undefined) {
    search.set('limit', String(options.limit));
  }
  return apiRequest<SubgraphPayload>(
    `/api/v1/projects/${projectId}/subgraph?${search.toString()}`,
  );
};

// ---- 人物（聚合与创建/删除） ----

export const createPersonRequest = (
  projectId: string,
  payload: CreatePersonInput,
) =>
  apiRequest<{ person: PersonDto }>(`/api/v1/projects/${projectId}/persons`, {
    method: 'POST',
    body: payload,
  });

export const updatePersonAggregateRequest = (
  projectId: string,
  personId: string,
  payload: UpdatePersonAggregateInput,
) =>
  apiRequest<PersonAggregatePayload>(
    `/api/v1/projects/${projectId}/persons/${personId}/aggregate`,
    { method: 'PUT', body: payload },
  );

export const createRelativeRequest = (
  projectId: string,
  payload: CreateRelativeInput,
) =>
  apiRequest<CreateRelativePayload>(
    `/api/v1/projects/${projectId}/relatives`,
    { method: 'POST', body: payload },
  );

export const deletePersonRequest = (projectId: string, personId: string) =>
  apiRequest<unknown>(`/api/v1/projects/${projectId}/persons/${personId}`, {
    method: 'DELETE',
  });

// ---- 项目媒体 ----

export const uploadProjectMediaRequest = (
  projectId: string,
  blob: Blob,
  contentType = blob.type || 'image/jpeg',
) =>
  apiUpload<ProjectMediaUploadPayload>(
    `/api/v1/projects/${projectId}/media`,
    blob,
    contentType,
  );
