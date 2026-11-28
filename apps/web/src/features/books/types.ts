import type {
  BookBindingStyle,
  BookBorderStyle,
  BookDensity,
  BookDto,
  BookEditionDto,
  BookFishtailStyle,
  BookFontFamily,
  BookLayoutConfigInput,
  BookLineageStyle,
  BookPageNumberStyle,
  BookPaperSize,
  CatalogArticleNode,
  CatalogChapterNode,
  CatalogLeafNode,
  CatalogLineageNode,
  CatalogNode,
  CatalogSectionCode,
  CatalogSectionState,
  CompiledPage as SharedCompiledPage,
  DescendantScope,
  LineageSubTableConfig,
} from '@yunpu/shared';

export type BookStep = 'catalog' | 'layout' | 'editions';

export type {
  BookBindingStyle,
  BookBorderStyle,
  BookDensity,
  BookFishtailStyle,
  BookFontFamily,
  BookLineageStyle,
  BookPageNumberStyle,
  BookPaperSize,
  CatalogArticleNode,
  CatalogChapterNode,
  CatalogLeafNode,
  CatalogLineageNode,
  CatalogNode,
  CatalogSectionCode,
  CatalogSectionState,
  DescendantScope,
  LineageSubTableConfig,
};

export type BookLayoutConfig = BookLayoutConfigInput;

export interface CompiledTocEntry {
  title: string;
  sectionLabel: string;
  pageNo: number;
  level: 1 | 2;
}

export interface CompiledLineageEntry {
  id: string;
  name: string;
  surname?: string;
  aliasesText?: string;
  generation: number;
  rank?: string;
  fatherName?: string;
  spousesText?: string;
  summaryText: string;
  childrenNames: string[];
}

export type CompiledPage = SharedCompiledPage & {
  chapterTitle?: string;
  title?: string;
  author?: string;
  contentHtml?: string;
  tocEntries?: CompiledTocEntry[];
  indexRows?: Array<{
    name: string;
    generation: number;
    fatherName: string;
    pageRef: number;
  }>;
  treePersons?: Array<{
    id: string;
    name: string;
    generation: number;
    fatherId: string | null;
    rank?: string;
  }>;
  lineageEntries?: CompiledLineageEntry[];
  lineageStyle?: BookLineageStyle;
};

export type BookEdition = Omit<
  BookEditionDto,
  'projectId' | 'bookId' | 'pages'
> &
  Partial<Pick<BookEditionDto, 'projectId' | 'bookId'>> & {
    pages: CompiledPage[];
  };

export type BookRecord = Omit<
  BookDto,
  'projectId' | 'folderId' | 'seq' | 'version' | 'createdAt'
> &
  Partial<
    Pick<BookDto, 'projectId' | 'folderId' | 'seq' | 'version' | 'createdAt'>
  > & {
    editions?: BookEdition[];
  };

export interface BookMetaInput {
  bookName: string;
  headerName: string;
  hallName: string;
  volumeNo: string;
  editor: string;
  compilationDate: string;
}
