import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { TreeItem } from '../../components/common/Tree/types';
import {
  collectTreeNodesByType,
  duplicateTreeNode,
  findFirstTreeNodeByType,
  findTreeNode,
  insertTreeNode,
  removeTreeNode,
} from '../../lib/treeOps';
import { formatGenealogyDate, parseQuickDateInput } from '../date-input';
import { formatGenealogyPlace, parsePlaceText } from '../place-input';
import { buildGenealogyGraph } from './canvas/utils/layoutBuilder';
import {
  addParentToPersons,
  buildLineageGraph,
  collectSubtreeIds,
  deleteSubtreeFromPersons,
  detachPersonFromPersons,
} from './domain/lineageGraph';
import {
  applyAddRelative,
  createDirectPersonRecord,
} from './domain/relativeMutations';
import { createSeedPersonsForChart } from './__fixtures__/lineageData';
import type { PersonEventType, PersonRecord } from './types';
import { computeLineageStats } from './utils/lineageStats';
import {
  buildLineageGraphIndex,
  computeAutoRankLabel,
  computeSpouseOrderIndex,
  formatSpouseSequenceLabel,
  getDerivedChildren,
  getDerivedSpouses,
  getPersonAliasItems,
  getPersonPrimaryTitle,
  normalizePersonForSave,
  syncAliasesFromItems,
} from './utils/personHelpers';
import {
  applyUnifiedEventToPerson,
  buildPersonTimelineEvents,
  removeUnifiedEventFromPerson,
  resolvePersonRelationshipHeader,
} from './utils/personTimeline';

const VALID_UNIFIED_EVENT_TYPES = new Set<PersonEventType>([
  'birth',
  'education',
  'career',
  'marriage',
  'residence',
  'death',
  'other',
]);

function assertNoShadowKeys(record: PersonRecord) {
  const obj = record as unknown as Record<string, unknown>;
  const forbiddenTopKeys = [
    'spouses',
    'courtesyName',
    'rank',
    'fatherName',
    'motherName',
    'spouseRelationLabel',
    'birthDate',
    'deathDate',
    'burialPlace',
    'age',
    'officialTitle',
    'biographyPage',
    'career',
  ];
  for (const key of forbiddenTopKeys) {
    assert.equal(key in obj, false, `Unexpected legacy key "${key}" on ${record.id}`);
  }
  if (record.birth) {
    const b = record.birth as unknown as Record<string, unknown>;
    assert.equal('date' in b, false, `Unexpected birth.date on ${record.id}`);
    assert.equal('place' in b, false, `Unexpected birth.place on ${record.id}`);
  }
  if (record.death) {
    const d = record.death as unknown as Record<string, unknown>;
    assert.equal('date' in d, false, `Unexpected death.date on ${record.id}`);
    assert.equal('place' in d, false, `Unexpected death.place on ${record.id}`);
    assert.equal('burialDate' in d, false, `Unexpected death.burialDate on ${record.id}`);
    assert.equal('burialPlace' in d, false, `Unexpected death.burialPlace on ${record.id}`);
  }
  if (record.privateInfo) {
    const priv = record.privateInfo as unknown as Record<string, unknown>;
    assert.equal('idCardName' in priv, false, `Unexpected privateInfo.idCardName on ${record.id}`);
  }
  if (record.events) {
    const forbiddenEventKeys = [
      'customTypeLabel',
      'organization',
      'position',
      'educationLevel',
      'deathCause',
      'relatedPersonId',
      'relatedPersonName',
      'date',
      'place',
    ];
    for (const ev of record.events) {
      assert.ok(
        VALID_UNIFIED_EVENT_TYPES.has(ev.type),
        `Invalid unified event type "${String(ev.type)}" on ${record.id}`
      );
      const evObj = ev as unknown as Record<string, unknown>;
      for (const ek of forbiddenEventKeys) {
        assert.equal(
          ek in evObj,
          false,
          `Unexpected legacy event key "${ek}" on ${record.id}#${ev.id}`
        );
      }
    }
  }
}

function runLineageSsotTests() {
  // 1. Canonical SSOT fixtures & normalization
  const date1900 = parseQuickDateInput('1900-05-12');
  const date1978 = parseQuickDateInput('1978-11-03');
  const date1902 = parseQuickDateInput('1902-03-01');
  const deanPlace = parsePlaceText('江西省/九江市/德安县');

  const anc: PersonRecord = normalizePersonForSave(
    {
      id: 'anc-1',
      branchId: 'chart-1',
      name: '陈伯康',
      legalName: '陈伯康',
      aliases: ['字子安', '号竹溪'],
      gender: 'male',
      status: 'deceased',
      generation: 1,
      fatherId: null,
      birth: { structuredDate: date1900.ok ? date1900.value : null },
      death: {
        structuredDate: date1978.ok ? date1978.value : null,
        structuredBurialPlace: deanPlace,
      },
      sequenceMeta: { originalPage: 20 },
      events: [{ id: 'ev-title-1', type: 'career', description: '乡贤' }],
    },
    []
  );

  const promotedSpouse: PersonRecord = normalizePersonForSave(
    {
      id: 'spouse-1',
      branchId: 'chart-1',
      name: '王氏',
      gender: 'female',
      status: 'deceased',
      generation: 1,
      siblingOrder: 1,
      fatherId: null,
      spouseOfId: 'anc-1',
      relationType: '妻子',
      notes: '太原王氏',
      birth: { structuredDate: date1902.ok ? date1902.value : null },
      death: { structuredBurialPlace: deanPlace },
    },
    [anc]
  );

  const child: PersonRecord = normalizePersonForSave(
    {
      id: 'child-1',
      branchId: 'chart-1',
      name: '陈仲文',
      gender: 'male',
      status: 'living',
      generation: 2,
      siblingOrder: 1,
      fatherId: 'anc-1',
      motherId: promotedSpouse.id,
    },
    [anc, promotedSpouse]
  );

  const basePersons = [anc, promotedSpouse, child];
  for (const p of basePersons) {
    assertNoShadowKeys(p);
  }
  assert.equal(getPersonPrimaryTitle(anc), '乡贤');
  assert.equal(formatGenealogyDate(anc.birth?.structuredDate), '1900年5月12日');
  assert.equal(formatGenealogyPlace(anc.death?.structuredBurialPlace), '江西省九江市德安县');
  assert.equal(child.motherId, promotedSpouse.id);

  // 2. Unified event apply/remove & timeline building
  const testPerson: PersonRecord = {
    id: 'u-1',
    branchId: 'c-1',
    name: '测试人物',
    gender: 'male',
    status: 'living',
    generation: 1,
    fatherId: null,
  };
  const parsed2000 = parseQuickDateInput('2000-06-01');
  const parsed2022 = parseQuickDateInput('2022');
  const date2000 = parsed2000.ok ? parsed2000.value : null;
  const date2022 = parsed2022.ok ? parsed2022.value : null;
  const placeBj = parsePlaceText('北京市');

  const birthPayload = {
    type: 'birth' as const,
    structuredDate: date2000,
    structuredPlace: placeBj,
    description: '生于京师',
  };
  const withBirth = {
    ...testPerson,
    ...applyUnifiedEventToPerson(testPerson, [testPerson], birthPayload, {
      mode: 'create',
      targetPersonId: testPerson.id,
      initialEvent: birthPayload,
    }),
  } as PersonRecord;
  assert.equal(withBirth.birth?.summary, '生于京师');
  assert.equal(withBirth.events?.length ?? 0, 0);

  const careerPayload = {
    type: 'career' as const,
    structuredDate: date2022,
    structuredPlace: placeBj,
    description: '翰林院编修',
  };
  const withCareer = {
    ...withBirth,
    ...applyUnifiedEventToPerson(withBirth, [withBirth], careerPayload, {
      mode: 'create',
      targetPersonId: withBirth.id,
      initialEvent: careerPayload,
    }),
  } as PersonRecord;
  assertNoShadowKeys(withCareer);
  assert.equal(withCareer.events?.length, 1);
  assert.equal(withCareer.events?.[0].type, 'career');
  assert.equal(withCareer.events?.[0].description, '翰林院编修');

  const timeline = buildPersonTimelineEvents(withCareer, [withCareer]);
  assert.ok(timeline.some((ev) => ev.eventType === 'birth' && ev.title === '出生'));
  assert.ok(timeline.some((ev) => ev.eventType === 'career' && ev.title === '任职'));

  const careerTimelineItem = timeline.find((ev) => ev.eventType === 'career')!;
  const afterRemovePatch = removeUnifiedEventFromPerson(withCareer, [withCareer], {
    mode: 'edit',
    sourceKind: careerTimelineItem.sourceKind,
    sourceId: careerTimelineItem.sourceId,
    targetPersonId: withCareer.id,
    initialEvent: {
      type: careerTimelineItem.eventType,
      structuredDate: careerTimelineItem.structuredDate ?? null,
      structuredPlace: careerTimelineItem.structuredPlace ?? null,
      description: careerTimelineItem.description ?? '',
    },
  });
  assert.ok(afterRemovePatch, 'Unified event deletion must return updated record patch');
  assert.equal(afterRemovePatch.events?.length ?? 0, 0);

  // 3. O(N) Graph index, rank derivation & independent spouse statistics
  const graphPersons: PersonRecord[] = [
    ...basePersons,
    {
      id: 'child-1-wife',
      branchId: 'chart-1',
      name: '李氏',
      gender: 'female',
      status: 'living',
      generation: 2,
      siblingOrder: 1,
      fatherId: null,
      spouseOfId: 'child-1',
      relationType: '妻子',
    },
    {
      id: 'child-2',
      branchId: 'chart-1',
      name: '陈季芳',
      gender: 'female',
      status: 'living',
      generation: 2,
      siblingOrder: 2,
      fatherId: 'anc-1',
    },
    {
      id: 'child-2-husband',
      branchId: 'chart-1',
      name: '张明',
      gender: 'male',
      status: 'living',
      generation: 2,
      siblingOrder: 1,
      fatherId: null,
      spouseOfId: 'child-2',
      relationType: '丈夫',
    },
  ];

  const index = buildLineageGraphIndex(graphPersons);
  assert.equal(index.personById.get('anc-1')?.name, '陈伯康');
  assert.equal(index.childrenByFatherId.get('anc-1')?.length, 2);
  assert.equal(index.spousesByPartnerId.get('anc-1')?.length, 1);

  assert.equal(getDerivedSpouses(graphPersons, anc.id).length, 1);
  assert.equal(
    formatSpouseSequenceLabel(computeSpouseOrderIndex(promotedSpouse, graphPersons)),
    '原配'
  );
  assert.equal(computeAutoRankLabel(promotedSpouse, graphPersons), '');
  assert.equal(
    resolvePersonRelationshipHeader(promotedSpouse, graphPersons),
    '第 1 世 · 妻子'
  );
  assert.equal(computeAutoRankLabel(child, graphPersons), '之男');
  assert.equal(
    computeAutoRankLabel(
      graphPersons.find((p) => p.id === 'child-2')!,
      graphPersons
    ),
    '之女'
  );

  // 3b. Chronological child rank computation (长子 / 次子 derived from birth dates)
  const birth1988 = parseQuickDateInput('1988-03-10');
  const birth1992 = parseQuickDateInput('1992-05-01');
  const sonLater: PersonRecord = {
    id: 'son-1992',
    branchId: 'c-rank',
    name: '次子测试',
    gender: 'male',
    status: 'living',
    generation: 2,
    siblingOrder: 1,
    fatherId: 'anc-1',
    birth: { structuredDate: birth1992.ok ? birth1992.value : null },
  };
  const sonOlder: PersonRecord = {
    id: 'son-1988',
    branchId: 'c-rank',
    name: '长子测试',
    gender: 'male',
    status: 'living',
    generation: 2,
    siblingOrder: 2,
    fatherId: 'anc-1',
    birth: { structuredDate: birth1988.ok ? birth1988.value : null },
  };
  const rankTestPersons: PersonRecord[] = [anc, sonLater, sonOlder];
  const orderedKids = getDerivedChildren(rankTestPersons, anc.id);
  assert.equal(orderedKids[0].id, 'son-1988');
  assert.equal(orderedKids[1].id, 'son-1992');
  assert.equal(computeAutoRankLabel(sonOlder, rankTestPersons), '长子');
  assert.equal(computeAutoRankLabel(sonLater, rankTestPersons), '次子');

  const stats = computeLineageStats(graphPersons, 1);
  assert.equal(stats.totalPersons, 6);
  assert.equal(stats.maleCount, 2);
  assert.equal(stats.femaleCount, 1);
  assert.equal(stats.maleLivingMarried, 1);
  assert.equal(stats.femaleLivingMarried, 1);
  assert.equal(stats.daughterInLawCount, 2);
  assert.equal(stats.daughterInLawLiving, 1);
  assert.equal(stats.daughterInLawDeceased, 1);
  assert.equal(stats.sonInLawCount, 1);
  assert.equal(stats.sonInLawLiving, 1);

  // 4. Built-in seed data must strictly conform to SSOT with no legacy keys
  for (const chartId of ['lineage-royal-1', 'lineage-other-1', 'custom-chart']) {
    const seed = createSeedPersonsForChart(chartId, '测试世系', '刘');
    assert.ok(seed.length > 0);
    for (const p of seed) {
      assertNoShadowKeys(p);
    }
  }

  // 5. Structured alias items & legacy string alias compatibility
  const legacyAliasItems = getPersonAliasItems(anc);
  assert.equal(legacyAliasItems.length, 2);
  assert.equal(legacyAliasItems[0].type, '字');
  assert.equal(legacyAliasItems[0].name, '子安');
  assert.equal(legacyAliasItems[1].type, '号');
  assert.equal(legacyAliasItems[1].name, '竹溪');

  const withStructuredAliases = normalizePersonForSave(
    {
      ...anc,
      aliasItems: [
        {
          id: 'al-1',
          type: '字',
          name: '伯宣',
          romanizedName: { name: 'Boxuan' },
        },
        {
          id: 'al-2',
          type: '曾用名',
          surname: '陈',
          name: '明远',
          romanizedName: { surname: 'Chen', name: 'Mingyuan' },
        },
      ],
    },
    basePersons
  );
  assert.deepEqual(withStructuredAliases.aliases, ['字伯宣', '陈明远']);
  assert.equal(withStructuredAliases.aliasItems?.length, 2);
  assert.deepEqual(
    syncAliasesFromItems(withStructuredAliases.aliasItems || []),
    ['字伯宣', '陈明远']
  );

  // 6. Generic treeOps utilities
  const sampleTree: TreeItem[] = [
    {
      id: 'folder-1',
      type: 'folder',
      collapsed: true,
      children: [
        { id: 'chart-a', type: 'chart', children: [], data: { name: '宗图甲' } },
      ],
      data: { name: '卷一' },
    },
  ];
  assert.equal(findTreeNode(sampleTree, 'chart-a')?.data?.name, '宗图甲');
  assert.equal(findFirstTreeNodeByType(sampleTree, 'chart')?.id, 'chart-a');
  assert.equal(collectTreeNodesByType(sampleTree, 'chart').length, 1);

  const inserted = insertTreeNode(
    sampleTree,
    { id: 'chart-b', type: 'chart', children: [], data: { name: '宗图乙' } },
    'folder-1'
  );
  assert.equal(inserted[0].collapsed, false);
  assert.equal(collectTreeNodesByType(inserted, 'chart').length, 2);

  const clonedIds: Array<[string, string]> = [];
  const duplicated = duplicateTreeNode(inserted, 'chart-a', (src, dst) => {
    clonedIds.push([src, dst]);
  });
  assert.equal(clonedIds.length, 1);
  assert.equal(collectTreeNodesByType(duplicated, 'chart').length, 3);
  const removed = removeTreeNode(duplicated, clonedIds[0][1]);
  assert.equal(collectTreeNodesByType(removed, 'chart').length, 2);

  // 7. Orthogonal LineageGraph & Single-Mother Relative Mutations (no fake "不详" father node)
  const singleChild: PersonRecord = {
    id: 'single-gen1',
    branchId: 'c-mat',
    surname: '林',
    name: '修远',
    gender: 'male',
    status: 'living',
    generation: 1,
    fatherId: null,
  };
  const grandChild: PersonRecord = {
    id: 'single-gen2',
    branchId: 'c-mat',
    surname: '林',
    name: '小远',
    gender: 'female',
    status: 'living',
    generation: 2,
    fatherId: 'single-gen1',
  };

  const singleMotherResult = applyAddRelative(
    [singleChild, grandChild],
    'c-mat',
    '林',
    { relation: 'parent', targetPerson: singleChild },
    { surname: '周', name: '淑华', gender: 'female', status: 'living' },
    true
  );

  // Must create ONLY 1 new parent (mother) with zero placeholder "不详" father node
  assert.equal(singleMotherResult.persons.length, 3);
  assert.equal(
    singleMotherResult.persons.some((p) => p.name === '不详'),
    false,
    'Single mother line must never fabricate an unknown father record'
  );
  const motherNode = singleMotherResult.persons.find((p) => p.name === '淑华')!;
  assert.ok(motherNode);
  assert.equal(motherNode.generation, 1);
  assert.equal(singleMotherResult.selectId, motherNode.id);

  const shiftedChild = singleMotherResult.persons.find((p) => p.id === 'single-gen1')!;
  const shiftedGrand = singleMotherResult.persons.find((p) => p.id === 'single-gen2')!;
  assert.equal(shiftedChild.motherId, motherNode.id);
  assert.equal(shiftedChild.fatherId, null);
  assert.equal(shiftedChild.generation, 2);
  assert.equal(shiftedGrand.generation, 3);

  // Orthogonal buildLineageGraph & canvas layoutBuilder must connect single-mother -> child cleanly
  const matGraph = buildLineageGraph(singleMotherResult.persons);
  assert.equal(matGraph.childrenByFatherId.get(motherNode.id)?.length, 1);
  assert.equal(matGraph.parentUnionByChildId.get('single-gen1')?.partnerIds[0], motherNode.id);

  const canvas = buildGenealogyGraph(singleMotherResult.persons, { clanSurname: '林' });
  const personNodes = canvas.nodes.filter((n) => n.type === 'person');
  assert.equal(personNodes.length, 3);
  assert.equal(
    canvas.edges.some(
      (e) =>
        e.data?.relationship === 'bloodline' &&
        e.source === `union-${motherNode.id}` &&
        e.target === 'single-gen1'
    ),
    true
  );

  // Subtree deletion, detach generation shift-back, addParentToPersons, direct person factory
  assert.equal(collectSubtreeIds(matGraph, 'single-gen1').size, 2);
  const afterSubtreeDelete = deleteSubtreeFromPersons(singleMotherResult.persons, 'single-gen1');
  assert.equal(afterSubtreeDelete.persons.length, 1);
  assert.equal(afterSubtreeDelete.persons[0].id, motherNode.id);

  const afterDetach = detachPersonFromPersons(singleMotherResult.persons, motherNode.id);
  assert.equal(afterDetach.length, 2);
  const restoredChild = afterDetach.find((p) => p.id === 'single-gen1')!;
  assert.equal(restoredChild.generation, 1);
  assert.equal(restoredChild.motherId, undefined);

  const addedFather = addParentToPersons([singleChild, grandChild], 'single-gen1', {
    id: 'father-root',
    branchId: 'c-mat',
    name: '振华',
    gender: 'male',
    status: 'deceased',
    generation: 1,
    fatherId: null,
  });
  assert.equal(addedFather.addedParentId, 'father-root');
  assert.equal(addedFather.persons.find((p) => p.id === 'single-gen1')?.generation, 2);
  assert.equal(addedFather.persons.find((p) => p.id === 'single-gen2')?.generation, 3);

  const direct = createDirectPersonRecord('c-mat', '林', 0, {
    name: '直录成员',
    gender: 'female',
  });
  assert.equal(direct.surname, '林');
  assert.equal(direct.relationType, '生女');

  console.log('All lineage SSOT, domain graph, treeOps & stats tests PASSED.');
}

test('lineage SSOT, domain graph, treeOps & stats', () => {
  runLineageSsotTests();
});
