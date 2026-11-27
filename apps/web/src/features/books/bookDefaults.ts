import type {
  BookLayoutConfig,
  CatalogSectionCode,
  CatalogSectionState,
} from './types';

export const DEFAULT_BOOK_LAYOUT: BookLayoutConfig = {
  bindingStyle: 'thread',
  lineageStyle: 'euler',
  paperSize: 'thread_185x290',
  borderStyle: 'double',
  fontFamily: 'song',
  density: 'standard',
  fishtailStyle: 'black',
  showHallName: true,
  showHeaderName: true,
  pageNumberStyle: 'chinese',
};

export function createEmptySections(): Record<
  CatalogSectionCode,
  CatalogSectionState
> {
  return {
    preface: {
      code: 'preface',
      label: '卷首',
      hint: '(显示在目录之前的内容)',
      collapsed: false,
      items: [],
    },
    body: {
      code: 'body',
      label: '正文',
      hint: '(建议放源流、字辈、碑文等)',
      collapsed: false,
      items: [],
    },
    lineage: {
      code: 'lineage',
      label: '世系',
      hint: '(族丁检索表、吊线图、世系表)',
      collapsed: false,
      items: [],
    },
    appendix: {
      code: 'appendix',
      label: '附录',
      hint: '',
      collapsed: false,
      items: [],
    },
  };
}
