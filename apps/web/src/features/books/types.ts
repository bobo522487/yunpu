export type BookStep = 'catalog' | 'layout' | 'editions';

export type CatalogSectionCode = 'preface' | 'body' | 'lineage' | 'appendix';

export type DescendantScope =
  | 'all'
  | 'member'
  | 'member_inclusive'
  | 'generations';

export interface LineageSubTableConfig {
  enabled: boolean;
  inToc: boolean;
  tocTitle: string;
}

export interface CatalogArticleNode {
  id: string;
  nodeType: 'article';
  sourceArticleId: string;
  sourceTitle: string;
  displayTitle: string;
}

export interface CatalogLineageNode {
  id: string;
  nodeType: 'lineage';
  totalTitle: string;
  eyebrowTitle: string;
  chartId: string;
  chartName: string;
  startMemberId: string;
  startMemberName: string;
  descendantScope: DescendantScope;
  endMemberId?: string;
  endMemberName?: string;
  maxGenerations?: number;
  indexConfig: LineageSubTableConfig;
  diaoxianConfig: LineageSubTableConfig;
  shixiConfig: LineageSubTableConfig;
}

export type CatalogLeafNode = CatalogArticleNode | CatalogLineageNode;

export interface CatalogChapterNode {
  id: string;
  nodeType: 'chapter';
  title: string;
  collapsed?: boolean;
  children: CatalogLeafNode[];
}

export type CatalogNode = CatalogChapterNode | CatalogLeafNode;

export interface CatalogSectionState {
  code: CatalogSectionCode;
  label: string;
  hint: string;
  collapsed: boolean;
  items: CatalogNode[];
}

export type BookBindingStyle = 'thread' | 'hardcover';
export type BookLineageStyle = 'euler' | 'su' | 'modern_double';
export type BookPaperSize = 'thread_185x290' | 'a4_210x297' | 'k16_185x260';
export type BookBorderStyle = 'double' | 'single' | 'none';
export type BookFontFamily = 'song' | 'kai' | 'fangsong' | 'hei';
export type BookDensity = 'loose' | 'standard' | 'compact';
export type BookFishtailStyle = 'black' | 'white' | 'double' | 'none';
export type BookPageNumberStyle = 'chinese' | 'arabic';

export interface BookLayoutConfig {
  bindingStyle: BookBindingStyle;
  lineageStyle: BookLineageStyle;
  paperSize: BookPaperSize;
  borderStyle: BookBorderStyle;
  fontFamily: BookFontFamily;
  density: BookDensity;
  fishtailStyle: BookFishtailStyle;
  showHallName: boolean;
  showHeaderName: boolean;
  pageNumberStyle: BookPageNumberStyle;
}

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

export interface CompiledPage {
  pageNo: number;
  type:
    | 'cover'
    | 'toc'
    | 'article'
    | 'lineage_index'
    | 'lineage_tree'
    | 'lineage_table';
  sectionCode: CatalogSectionCode | 'cover' | 'toc';
  headerTitle: string;
  eyebrowTitle: string;
  hallName: string;
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
}

export interface BookEdition {
  id: string;
  createdAt: string;
  bindingStyle: BookBindingStyle;
  lineageStyle: BookLineageStyle;
  paperSize: BookPaperSize;
  pageCount: number;
  memberCount: number;
  wordCount: number;
  printStatus: 'none' | 'finalized';
  layoutSnapshot: BookLayoutConfig;
  pages: CompiledPage[];
}

export interface BookRecord {
  id: string;
  bookName: string;
  headerName: string;
  hallName: string;
  volumeNo: string;
  editor: string;
  compilationDate: string;
  sections: Record<CatalogSectionCode, CatalogSectionState>;
  layoutConfig: BookLayoutConfig;
  editions: BookEdition[];
  updatedAt: string;
}

export interface BookMetaInput {
  bookName: string;
  headerName: string;
  hallName: string;
  volumeNo: string;
  editor: string;
  compilationDate: string;
}
