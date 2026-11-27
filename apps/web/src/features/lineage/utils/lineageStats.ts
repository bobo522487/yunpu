import { type TreeItem } from '../../../components/common/Tree/types';
import { collectTreeNodesByType } from '../../../lib/treeOps';
import { getLineageGraph } from '../domain/lineageGraph';
import { type PersonRecord } from '../types';

export interface ChartEntry {
  chartId: string;
  chartName: string;
  index: number;
}

export interface LineageStatsSummary {
  chartCount: number;
  totalPersons: number;

  // All entered nodes (Row 1 KPI cards)
  allMaleCount: number;
  allMaleLiving: number;
  allMaleDeceased: number;
  allFemaleCount: number;
  allFemaleLiving: number;
  allFemaleDeceased: number;
  livingCount: number;
  deceasedCount: number;

  // Non-spouse lineage members (Row 2 男丁 / 女丁)
  maleCount: number;
  maleLiving: number;
  maleDeceased: number;
  maleLivingMarried: number;
  maleLivingUnmarried: number;

  femaleCount: number;
  femaleLiving: number;
  femaleDeceased: number;
  femaleLivingMarried: number;
  femaleLivingUnmarried: number;

  // Independent spouse nodes (Row 3 儿媳 / 女婿)
  daughterInLawCount: number;
  daughterInLawLiving: number;
  daughterInLawDeceased: number;

  sonInLawCount: number;
  sonInLawLiving: number;
  sonInLawDeceased: number;
}

export function flattenChartsInTree(items: TreeItem[]): ChartEntry[] {
  return collectTreeNodesByType(items, 'chart').map((node, index) => ({
    chartId: String(node.id),
    chartName: node.data?.name || String(node.id),
    index: index + 1,
  }));
}

export function computeLineageStats(
  persons: PersonRecord[],
  chartCount = 1
): LineageStatsSummary {
  const index = getLineageGraph(persons);

  let allMaleCount = 0;
  let allMaleLiving = 0;
  let allMaleDeceased = 0;
  let allFemaleCount = 0;
  let allFemaleLiving = 0;
  let allFemaleDeceased = 0;
  let livingCount = 0;
  let deceasedCount = 0;

  let maleCount = 0;
  let maleLiving = 0;
  let maleDeceased = 0;
  let maleLivingMarried = 0;
  let maleLivingUnmarried = 0;

  let femaleCount = 0;
  let femaleLiving = 0;
  let femaleDeceased = 0;
  let femaleLivingMarried = 0;
  let femaleLivingUnmarried = 0;

  let daughterInLawCount = 0;
  let daughterInLawLiving = 0;
  let daughterInLawDeceased = 0;

  let sonInLawCount = 0;
  let sonInLawLiving = 0;
  let sonInLawDeceased = 0;

  for (const person of persons) {
    const isLiving = person.status === 'living';

    if (isLiving) livingCount += 1;
    else deceasedCount += 1;

    if (person.gender === 'female') {
      allFemaleCount += 1;
      if (isLiving) allFemaleLiving += 1;
      else allFemaleDeceased += 1;
    } else {
      allMaleCount += 1;
      if (isLiving) allMaleLiving += 1;
      else allMaleDeceased += 1;
    }

    if (person.spouseOfId) {
      const partner = index.personById.get(person.spouseOfId);
      const isSonInLaw =
        partner?.gender === 'female' ||
        (partner?.gender !== 'male' && person.gender === 'male');

      if (isSonInLaw) {
        sonInLawCount += 1;
        if (isLiving) sonInLawLiving += 1;
        else sonInLawDeceased += 1;
      } else {
        daughterInLawCount += 1;
        if (isLiving) daughterInLawLiving += 1;
        else daughterInLawDeceased += 1;
      }
      continue;
    }

    const spouseNodes = index.spousesByPartnerId.get(person.id) || [];
    const hasSpouse = spouseNodes.length > 0;

    if (person.gender === 'female') {
      femaleCount += 1;
      if (isLiving) {
        femaleLiving += 1;
        if (hasSpouse) femaleLivingMarried += 1;
        else femaleLivingUnmarried += 1;
      } else {
        femaleDeceased += 1;
      }
    } else {
      maleCount += 1;
      if (isLiving) {
        maleLiving += 1;
        if (hasSpouse) maleLivingMarried += 1;
        else maleLivingUnmarried += 1;
      } else {
        maleDeceased += 1;
      }
    }
  }

  return {
    chartCount,
    totalPersons: persons.length,
    allMaleCount,
    allMaleLiving,
    allMaleDeceased,
    allFemaleCount,
    allFemaleLiving,
    allFemaleDeceased,
    livingCount,
    deceasedCount,
    maleCount,
    maleLiving,
    maleDeceased,
    maleLivingMarried,
    maleLivingUnmarried,
    femaleCount,
    femaleLiving,
    femaleDeceased,
    femaleLivingMarried,
    femaleLivingUnmarried,
    daughterInLawCount,
    daughterInLawLiving,
    daughterInLawDeceased,
    sonInLawCount,
    sonInLawLiving,
    sonInLawDeceased,
  };
}

export function formatStatPct(part: number, total: number, digits: 0 | 2 = 2): string {
  if (!total || total <= 0) {
    return digits === 0 ? '0%' : '0.00%';
  }
  const pct = (part / total) * 100;
  if (digits === 0) {
    return `${Math.round(pct)}%`;
  }
  return `${pct.toFixed(2)}%`;
}
