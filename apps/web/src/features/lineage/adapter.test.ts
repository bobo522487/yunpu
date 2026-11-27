import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  aliasTypeToPersonNameKind,
  buildUpdatePersonInput,
  chineseRelationToApiKind,
  composeDisplayName,
  directoryToTreeItems,
  graphToPersonRecords,
} from './adapter.ts';
import type { LineageGraphPayload } from './api.ts';

test('directoryToTreeItems constructs flat 1-level folders and root lineages sorted by seq', () => {
  const items = directoryToTreeItems(
    [
      {
        id: 'folder-1',
        projectId: 'proj-1',
        name: '总世系与支系',
        seq: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    [
      {
        id: 'lin-root',
        projectId: 'proj-1',
        folderId: null,
        name: '根部世系',
        surname: '陈',
        hallName: null,
        progenitor: '陈祖',
        region: null,
        seq: 0,
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'lin-child',
        projectId: 'proj-1',
        folderId: 'folder-1',
        name: '支系世系',
        surname: '陈',
        hallName: '义门堂',
        progenitor: '陈旺',
        region: null,
        seq: 0,
        version: 2,
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      },
    ],
    { 'folder-1': true },
  );

  assert.equal(items.length, 2);
  assert.equal(items[0]?.id, 'lin-root');
  assert.equal(items[0]?.type, 'chart');
  assert.equal(items[1]?.id, 'folder-1');
  assert.equal(items[1]?.type, 'folder');
  assert.equal(items[1]?.collapsed, true);
  assert.equal(items[1]?.children.length, 1);
  assert.equal(items[1]?.children[0]?.id, 'lin-child');
});

test('graphToPersonRecords maps multi-generation parents, spouses, aliases, events, and avatars', () => {
  const graph: LineageGraphPayload = {
    lineage: {
      id: 'lin-1',
      projectId: 'proj-1',
      folderId: null,
      name: '义门陈氏总世系',
      surname: '陈',
      hallName: '义门堂',
      progenitor: '陈旺',
      region: null,
      seq: 0,
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    persons: [
      {
        id: 'p-root',
        projectId: 'proj-1',
        lineageId: 'lin-1',
        displayName: '陈旺',
        sex: 'male',
        surname: '陈',
        givenName: '旺',
        romanizedSurname: null,
        romanizedName: null,
        romanizedSuffix: null,
        birthYear: 815,
        deathYear: 882,
        isLiving: false,
        birthInfo: null,
        deathInfo: null,
        generationWord: '旺',
        relationTitle: '始祖',
        siblingOrder: 1,
        biography: null,
        notes: null,
        avatarKey: '00000000-0000-7000-8000-000000000001.jpg',
        version: 3,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        names: [
          {
            id: 'n1',
            projectId: 'proj-1',
            personId: 'p-root',
            kind: 'formal',
            value: '陈旺',
            surname: '陈',
            romanizedSurname: null,
            romanizedName: null,
            label: null,
            isPrimary: true,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 'n2',
            projectId: 'proj-1',
            personId: 'p-root',
            kind: 'courtesy',
            value: '子兴',
            surname: null,
            romanizedSurname: null,
            romanizedName: null,
            label: '字',
            isPrimary: false,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
        events: [
          {
            id: 'e1',
            projectId: 'proj-1',
            personId: 'p-root',
            type: 'residence',
            structuredDate: null,
            structuredPlace: null,
            description: '迁居义门村',
            sortOrder: 0,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
      {
        id: 'p-spouse',
        projectId: 'proj-1',
        lineageId: 'lin-1',
        displayName: '林氏',
        sex: 'female',
        surname: '林',
        givenName: '淑贤',
        romanizedSurname: null,
        romanizedName: null,
        romanizedSuffix: null,
        birthYear: null,
        deathYear: null,
        isLiving: false,
        birthInfo: null,
        deathInfo: null,
        generationWord: null,
        relationTitle: '始祖母',
        siblingOrder: null,
        biography: null,
        notes: null,
        avatarKey: null,
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'p-child',
        projectId: 'proj-1',
        lineageId: 'lin-1',
        displayName: '陈伯宣',
        sex: 'male',
        surname: '陈',
        givenName: '伯宣',
        romanizedSurname: null,
        romanizedName: null,
        romanizedSuffix: null,
        birthYear: null,
        deathYear: null,
        isLiving: true,
        birthInfo: null,
        deathInfo: null,
        generationWord: '伯',
        relationTitle: null,
        siblingOrder: 1,
        biography: null,
        notes: null,
        avatarKey: null,
        version: 1,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    relations: [
      {
        id: 'r-spouse',
        projectId: 'proj-1',
        fromPersonId: 'p-spouse',
        toPersonId: 'p-root',
        kind: 'spouse',
        fromRoleLabel: '元配',
        toRoleLabel: '夫',
        sortOrder: 0,
        note: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'r-father',
        projectId: 'proj-1',
        fromPersonId: 'p-root',
        toPersonId: 'p-child',
        kind: 'biological_parent',
        fromRoleLabel: null,
        toRoleLabel: null,
        sortOrder: 0,
        note: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'r-mother',
        projectId: 'proj-1',
        fromPersonId: 'p-spouse',
        toPersonId: 'p-child',
        kind: 'biological_parent',
        fromRoleLabel: null,
        toRoleLabel: null,
        sortOrder: 0,
        note: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
    projections: [
      { personId: 'p-root', primaryPath: 'r0', generation: 0 },
      { personId: 'p-child', primaryPath: 'r0.c0', generation: 1 },
    ],
  };

  const persons = graphToPersonRecords('proj-1', graph);
  const root = persons.find((p) => p.id === 'p-root');
  const spouse = persons.find((p) => p.id === 'p-spouse');
  const child = persons.find((p) => p.id === 'p-child');

  assert.ok(root && spouse && child);
  assert.equal(root.generation, 1);
  assert.equal(root.name, '旺');
  assert.equal(root.aliasItems?.[0]?.name, '子兴');
  assert.equal(root.events?.[0]?.description, '迁居义门村');
  assert.equal(
    root.avatarUrl,
    '/api/v1/projects/proj-1/media/00000000-0000-7000-8000-000000000001.jpg',
  );

  // Even when symmetric spouse edge stores female first, male/husband resolves as anchor
  assert.equal(spouse.spouseOfId, 'p-root');
  assert.equal(spouse.relationType, '元配');
  assert.equal(spouse.generation, 1);

  assert.equal(child.generation, 2);
  assert.equal(child.fatherId, 'p-root');
  assert.equal(child.motherId, 'p-spouse');
});

test('forward helper conversions preserve semantics and living/deceased invariants', () => {
  assert.equal(composeDisplayName('陈', '陈旺'), '陈旺');
  assert.equal(composeDisplayName('陈', '旺'), '陈旺');
  assert.equal(aliasTypeToPersonNameKind('字'), 'courtesy');
  assert.equal(chineseRelationToApiKind('过继'), 'ritual_heir');

  const update = buildUpdatePersonInput(
    {
      id: 'p1',
      branchId: 'lin-1',
      version: 4,
      surname: '陈',
      name: '旺',
      gender: 'male',
      status: 'deceased',
      fatherId: null,
      generation: 1,
    },
    { status: 'living', avatarKey: null },
  );
  assert.deepEqual(update, {
    version: 4,
    isLiving: true,
    deathInfo: null,
    deathYear: null,
    avatarKey: null,
  });
});
