import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  computeTopologySignature,
  patchFlowNodesAttributes,
} from './canvas/utils/canvasGraphDiff.ts';
import { buildGenealogyGraph } from './canvas/utils/layoutBuilder.ts';
import { getLineageGraph } from './domain/lineageGraph.ts';
import type { PersonRecord } from './types.ts';
import { extractGregorianYear, extractYearDisplay } from './utils/dateRange.ts';
import {
  computeAutoRankLabel,
  getDerivedChildren,
  getDerivedSpouses,
  getDescendantExclusionSet,
} from './utils/personHelpers.ts';
import {
  applyCoupleMarriageEvent,
  buildCoupleMarriageEventId,
  findCoupleMarriageInfo,
} from './utils/personTimeline.ts';

function makeSampleFamily(): PersonRecord[] {
  return [
    {
      id: 'p-root',
      branchId: 'branch-1',
      name: '刘邦',
      surname: '刘',
      gender: 'male',
      generation: 1,
      status: 'deceased',
      fatherId: null,
    },
    {
      id: 'p-spouse-1',
      branchId: 'branch-1',
      name: '吕雉',
      surname: '吕',
      gender: 'female',
      generation: 1,
      status: 'deceased',
      spouseOfId: 'p-root',
      siblingOrder: 1,
      fatherId: null,
    },
    {
      id: 'p-spouse-2',
      branchId: 'branch-1',
      name: '戚氏',
      surname: '戚',
      gender: 'female',
      generation: 1,
      status: 'deceased',
      spouseOfId: 'p-root',
      siblingOrder: 2,
      fatherId: null,
    },
    {
      id: 'p-child-1',
      branchId: 'branch-1',
      name: '刘盈',
      surname: '刘',
      gender: 'male',
      generation: 2,
      status: 'deceased',
      fatherId: 'p-root',
      motherId: 'p-spouse-1',
      siblingOrder: 1,
    },
    {
      id: 'p-child-2',
      branchId: 'branch-1',
      name: '刘如意',
      surname: '刘',
      gender: 'male',
      generation: 2,
      status: 'deceased',
      fatherId: 'p-root',
      motherId: 'p-spouse-2',
      siblingOrder: 2,
    },
    {
      id: 'p-grandchild-1',
      branchId: 'branch-1',
      name: '刘恭',
      surname: '刘',
      gender: 'male',
      generation: 3,
      status: 'deceased',
      fatherId: 'p-child-1',
      siblingOrder: 1,
    },
  ];
}

test('getLineageGraph hits WeakMap cache for identical array references and exposes O(1) bidirectional indices', () => {
  const family = makeSampleFamily();
  const g1 = getLineageGraph(family);
  const g2 = getLineageGraph(family);
  assert.equal(g1, g2);

  // Children indexed by both fatherId and motherId
  assert.deepEqual(
    getDerivedChildren(family, 'p-root').map((c) => c.id),
    ['p-child-1', 'p-child-2']
  );
  assert.deepEqual(
    getDerivedChildren(family, 'p-spouse-2').map((c) => c.id),
    ['p-child-2']
  );
  assert.deepEqual(
    getDerivedSpouses(family, 'p-root').map((s) => s.id),
    ['p-spouse-1', 'p-spouse-2']
  );

  // Descendant exclusion covers self + spouses + descendants recursively
  const excluded = getDescendantExclusionSet(family, 'p-child-1');
  assert.ok(excluded.has('p-child-1'));
  assert.ok(excluded.has('p-grandchild-1'));
  assert.equal(excluded.has('p-child-2'), false);

  assert.equal(computeAutoRankLabel(family[3], family), '长子');
  assert.equal(computeAutoRankLabel(family[4], family), '次子');
});

test('applyCoupleMarriageEvent atomically synchronizes partner and spouse with deterministic couple event ID and preserves legacy fallback', () => {
  const family = makeSampleFamily();
  const partner = family[0];
  const spouse2 = family[2];

  const nextFamily = applyCoupleMarriageEvent(
    family,
    {
      partnerId: partner.id,
      spouseId: spouse2.id,
      partnerEventId: buildCoupleMarriageEventId(partner.id, spouse2.id),
      spouseEventId: buildCoupleMarriageEventId(partner.id, spouse2.id),
    },
    {
      type: 'marriage',
      structuredDate: {
        schemaVersion: 1,
        kind: 'date',
        calendar: 'gregorian',
        qualifier: 'exact',
        precision: 'year',
        parts: { year: -205 },
      },
      structuredPlace: null,
      description: '成婚于定陶',
    },
    {
      mode: 'edit',
      sourceKind: 'marriage_node',
      targetPersonId: partner.id,
      initialEvent: {
        type: 'marriage',
        structuredDate: null,
        structuredPlace: null,
        description: '',
      },
    }
  );

  const info = findCoupleMarriageInfo(
    nextFamily.find((p) => p.id === partner.id)!,
    nextFamily.find((p) => p.id === spouse2.id)!,
    2,
    '刘'
  );
  assert.equal(info.description, '成婚于定陶');
  assert.equal(info.partnerEventId, buildCoupleMarriageEventId(partner.id, spouse2.id));
  assert.equal(info.spouseEventId, buildCoupleMarriageEventId(partner.id, spouse2.id));

  // Legacy fallback matcher still reads historical ev-marriage-<otherId> IDs
  const legacyPartner: PersonRecord = {
    ...partner,
    events: [
      {
        id: `ev-marriage-${spouse2.id}`,
        type: 'marriage',
        description: '旧ID婚约',
      },
    ],
  };
  const legacyInfo = findCoupleMarriageInfo(legacyPartner, spouse2, 2, '刘');
  assert.equal(legacyInfo.description, '旧ID婚约');
  assert.equal(legacyInfo.partnerEventId, `ev-marriage-${spouse2.id}`);
});

test('computeTopologySignature ignores display/selection edits while patchFlowNodesAttributes preserves custom ELK coordinates', () => {
  const family = makeSampleFamily();
  const collapsed = new Set<string>();

  const sigBefore = computeTopologySignature(family, collapsed, '刘');

  // Build graph and assign custom ELK-like coordinates
  const graph = buildGenealogyGraph(family, {
    selectedPersonId: null,
    openMenuPersonId: null,
    clanSurname: '刘',
    collapsedNodeIds: collapsed,
  });
  const elkMovedNodes = graph.nodes.map((node, idx) => ({
    ...node,
    position: { x: 900 + idx * 50, y: 400 + idx * 25 },
  }));

  // Non-structural edit: rename person + change biography
  const renamedFamily = family.map((p) =>
    p.id === 'p-child-1' ? { ...p, name: '刘盈（孝惠帝）', biography: '西汉第二位皇帝' } : p
  );
  const sigAfterRename = computeTopologySignature(renamedFamily, collapsed, '刘');
  assert.equal(sigAfterRename, sigBefore);

  const patched = patchFlowNodesAttributes(elkMovedNodes, {
    persons: renamedFamily,
    selectedPersonId: 'p-child-1',
    openMenuPersonId: 'p-child-1',
    clanSurname: '刘',
  });

  const childNode = patched.find((n) => n.id === 'p-child-1');
  assert.ok(childNode && childNode.type === 'person');
  const origIdx = elkMovedNodes.findIndex((n) => n.id === 'p-child-1');
  assert.deepEqual(childNode.position, {
    x: 900 + origIdx * 50,
    y: 400 + origIdx * 25,
  });
  assert.equal(childNode.data.person.name, '刘盈（孝惠帝）');
  assert.equal(childNode.data.isSelected, true);
  assert.equal(childNode.data.isAddMenuOpen, true);
  assert.equal(childNode.zIndex, 1000);

  // Structural edit: collapse a subtree -> topology signature changes
  const nextCollapsed = new Set<string>(['p-child-1']);
  assert.notEqual(
    computeTopologySignature(renamedFamily, nextCollapsed, '刘'),
    sigBefore
  );
});

test('unified dateRange helpers preserve BCE/CE gregorian year extraction', () => {
  const bceDate = {
    schemaVersion: 1 as const,
    kind: 'date' as const,
    calendar: 'gregorian' as const,
    qualifier: 'exact' as const,
    precision: 'year' as const,
    parts: { year: -256 },
  };
  assert.equal(extractGregorianYear(bceDate), -256);
  assert.equal(extractYearDisplay(bceDate), '-256');
});
