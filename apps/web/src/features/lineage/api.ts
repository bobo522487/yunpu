import type {
  ApiRelationKind,
  CreateFolderInput,
  CreateLineageInput,
  CreatePersonEventInput,
  CreatePersonInput,
  CreatePersonNameInput,
  CreateRelationInput,
  PersonEventType,
  PersonNameKind,
  PersonSex,
  UpdateFolderInput,
  UpdateLineageInput,
  UpdatePersonEventInput,
  UpdatePersonInput,
  UpdatePersonNameInput,
  UpdateRelationInput,
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

// ---- 人物 ----

export const createPersonRequest = (
  projectId: string,
  payload: CreatePersonInput,
) =>
  apiRequest<{ person: PersonDto }>(`/api/v1/projects/${projectId}/persons`, {
    method: 'POST',
    body: payload,
  });

export const updatePersonRequest = (
  projectId: string,
  personId: string,
  payload: UpdatePersonInput,
) =>
  apiRequest<{ person: PersonDto }>(
    `/api/v1/projects/${projectId}/persons/${personId}`,
    { method: 'PATCH', body: payload },
  );

export const deletePersonRequest = (projectId: string, personId: string) =>
  apiRequest<unknown>(`/api/v1/projects/${projectId}/persons/${personId}`, {
    method: 'DELETE',
  });

// ---- 人物名号 ----

export const createPersonNameRequest = (
  projectId: string,
  personId: string,
  payload: CreatePersonNameInput,
) =>
  apiRequest<{ name: PersonNameDto }>(
    `/api/v1/projects/${projectId}/persons/${personId}/names`,
    { method: 'POST', body: payload },
  );

export const updatePersonNameRequest = (
  projectId: string,
  personId: string,
  nameId: string,
  payload: UpdatePersonNameInput,
) =>
  apiRequest<{ name: PersonNameDto }>(
    `/api/v1/projects/${projectId}/persons/${personId}/names/${nameId}`,
    { method: 'PATCH', body: payload },
  );

export const deletePersonNameRequest = (
  projectId: string,
  personId: string,
  nameId: string,
) =>
  apiRequest<unknown>(
    `/api/v1/projects/${projectId}/persons/${personId}/names/${nameId}`,
    { method: 'DELETE' },
  );

// ---- 人物关系 ----

export const createRelationRequest = (
  projectId: string,
  payload: CreateRelationInput,
) =>
  apiRequest<{ relation: RelationDto }>(
    `/api/v1/projects/${projectId}/relations`,
    { method: 'POST', body: payload },
  );

export const updateRelationRequest = (
  projectId: string,
  relationId: string,
  payload: UpdateRelationInput,
) =>
  apiRequest<{ relation: RelationDto }>(
    `/api/v1/projects/${projectId}/relations/${relationId}`,
    { method: 'PATCH', body: payload },
  );

export const deleteRelationRequest = (projectId: string, relationId: string) =>
  apiRequest<unknown>(`/api/v1/projects/${projectId}/relations/${relationId}`, {
    method: 'DELETE',
  });

// ---- 生平事件 ----

export const createPersonEventRequest = (
  projectId: string,
  personId: string,
  payload: CreatePersonEventInput,
) =>
  apiRequest<{ event: PersonEventDto }>(
    `/api/v1/projects/${projectId}/persons/${personId}/events`,
    { method: 'POST', body: payload },
  );

export const updatePersonEventRequest = (
  projectId: string,
  personId: string,
  eventId: string,
  payload: UpdatePersonEventInput,
) =>
  apiRequest<{ event: PersonEventDto }>(
    `/api/v1/projects/${projectId}/persons/${personId}/events/${eventId}`,
    { method: 'PATCH', body: payload },
  );

export const deletePersonEventRequest = (
  projectId: string,
  personId: string,
  eventId: string,
) =>
  apiRequest<unknown>(
    `/api/v1/projects/${projectId}/persons/${personId}/events/${eventId}`,
    { method: 'DELETE' },
  );

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
