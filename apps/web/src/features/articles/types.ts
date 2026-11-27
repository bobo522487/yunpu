import type { JSONContent } from '@tiptap/core';
import type { GenealogyPlace } from '../place-input/place.types';

export type ArticleDocType =
  | 'preface'
  | 'rules'
  | 'origin'
  | 'motto'
  | 'biography'
  | 'inscription'
  | 'custom';

export type ArticleStatus = 'draft' | 'review' | 'approved';
export type ArticlePrivacy = 'public' | 'clan' | 'editors';

export interface ArticleCitation {
  id: string;
  label: string;
  sourceType: 'old_genealogy' | 'stele' | 'gazetteer' | 'oral' | 'archive';
  detail?: string;
  mediaAssetId?: string;
}

export interface ArticleAssetRecord {
  assetId: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface ArticleDocument {
  id: string;
  projectId?: string;
  folderId?: string | null;
  seq?: number;
  title: string;
  subtitle?: string;
  author?: string;
  docType: ArticleDocType;
  status: ArticleStatus;
  privacy: ArticlePrivacy;
  contentJson?: JSONContent;
  contentHtml: string;
  linkedPersonIds: string[];
  linkedChartIds: string[];
  citations: ArticleCitation[];
  version: number;
  wordCount: number;
  createdAt?: string;
  updatedAt: string;
}

export interface ArticleRevision {
  id: string;
  projectId?: string;
  articleId: string;
  version: number;
  title: string;
  status: ArticleStatus;
  contentJson: JSONContent;
  contentHtml: string;
  wordCount: number;
  summary?: string;
  authorName: string;
  createdAt: string;
}

export interface ArticleMetaInput {
  title?: string;
  subtitle?: string;
  author?: string;
  docType?: ArticleDocType;
  templateId?: string;
  contentHtml?: string;
  contentJson?: JSONContent;
  status?: ArticleStatus;
  privacy?: ArticlePrivacy;
  citations?: ArticleCitation[];
}

export interface ProjectArticleSeedContext {
  familyName?: string;
  surname?: string;
  hallName?: string;
  ancestor?: string;
  region?: GenealogyPlace | null;
}
