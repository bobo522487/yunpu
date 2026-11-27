import type { PersonRecord } from '../types';

/**
 * Create a starter progenitor person record for a newly created lineage chart.
 */
export function createStarterProgenitorForChart(
  chartId: string,
  chartName?: string,
  surname?: string,
  progenitor?: string,
): PersonRecord[] {
  const cleanSurname = surname?.trim() || undefined;
  const cleanProgenitor = progenitor?.trim();

  const rootName =
    cleanProgenitor ||
    (cleanSurname
      ? `${cleanSurname}始祖`
      : chartName?.replace(/世系图|图系|世次/g, '').trim() || '始祖');

  return [
    {
      id: `${chartId}-root-1`,
      surname: cleanSurname,
      name: rootName,
      generation: 1,
      gender: 'male',
      relationTitle: '始祖',
      status: 'deceased',
      fatherId: null,
      biography: `「${chartName || '新建世系图'}」开基始祖，可点击节点上方或右侧档案面板继续添录配偶、子嗣与生平传记。`,
      branchId: chartId,
      sequenceMeta: { originalPage: 1 },
      biographyOrder: 1,
    },
  ];
}
