import type { JSONContent } from '@tiptap/core';
import type {
  ArticleCitationInput,
  ArticleDocType,
  ArticleDto,
  ArticlePrivacy,
  ArticleRevisionDto,
  ArticleStatus,
} from '@yunpu/shared';
import type { GenealogyPlace } from '../place-input/place.types';

export type { ArticleDocType, ArticlePrivacy, ArticleStatus };

export type ArticleCitation = ArticleCitationInput;

export interface ArticleAssetRecord {
  assetId: string;
  contentType: string;
  bytes: Uint8Array;
}

export type ArticleDocument = Omit<
  ArticleDto,
  | 'projectId'
  | 'folderId'
  | 'seq'
  | 'subtitle'
  | 'author'
  | 'contentJson'
  | 'updatedBy'
  | 'createdAt'
> &
  Partial<
    Pick<
      ArticleDto,
      | 'projectId'
      | 'folderId'
      | 'seq'
      | 'subtitle'
      | 'author'
      | 'updatedBy'
      | 'createdAt'
    >
  > & {
    contentJson?: JSONContent;
  };

export type ArticleRevision = Omit<
  ArticleRevisionDto,
  'projectId' | 'contentJson' | 'summary' | 'createdBy'
> &
  Partial<Pick<ArticleRevisionDto, 'projectId' | 'summary' | 'createdBy'>> & {
    contentJson: JSONContent;
  };

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
