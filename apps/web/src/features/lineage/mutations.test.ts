import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'vitest';
import { resetApiTransportForTests } from '../../lib/api.ts';
import { graphToPersonRecords } from './adapter.ts';
import type { LineageGraphPayload } from './api.ts';
import { createRelativeViaApi, syncPersonUpdatesToApi } from './mutations.ts';

const originalFetch = globalThis.fetch;

interface CapturedRequest {
  url: string;
  method: string;
  body: Record<string, unknown>;
}

function mockJsonFetch(responseData: unknown) {
  const calls: CapturedRequest[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    });
    return new Response(JSON.stringify({ ok: true, data: responseData }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return calls;
}

const UUID_FATHER_UNKNOWN_SEX = '00000000-0000-4000-8000-000000000001';
const UUID_FATHER_NEW = '00000000-0000-4000-8000-000000000002';
const UUID_MOTHER = '00000000-0000-4000-8000-000000000003';
const UUID_CHILD = '00000000-0000-4000-8000-000000000004';
const UUID_EDGE_FATHER = '00000000-0000-4000-8000-000000000011';
const UUID_EDGE_MOTHER = '00000000-0000-4000-8000-000000000012';
const UUID_NAME_ALIAS = '00000000-0000-4000-8000-000000000021';
const UUID_EVENT_1 = '00000000-0000-4000-8000-000000000031';
const UUID_LINEAGE = '00000000-0000-4000-8000-000000000099';
const UUID_PROJECT = '00000000-0000-4000-8000-000000000088';

function makeGraph(): LineageGraphPayload {
  const ts = '2026-01-01T00:00:00Z';
  const basePerson = (id: string, displayName: string, sex: 'male' | 'female' | 'unknown') => ({
    id,
    projectId: UUID_PROJECT,
    lineageId: UUID_LINEAGE,
    displayName,
    sex,
    surname: '陈',
    givenName: displayName,
    romanizedSurname: null,
    romanizedName: null,
    romanizedSuffix: null,
    birthYear: null,
    deathYear: null,
    isLiving: true,
    birthInfo: null,
    deathInfo: null,
    generationWord: null,
    relationTitle: null,
    siblingOrder: null,
    biography: null,
    notes: null,
    avatarKey: null,
    version: 3,
    createdAt: ts,
    updatedAt: ts,
  });

  return {
    lineage: {
      id: UUID_LINEAGE,
      projectId: UUID_PROJECT,
      folderId: null,
      name: '主世系',
      surname: '陈',
      hallName: null,
      progenitor: null,
      region: null,
      seq: 0,
      version: 1,
      createdAt: ts,
      updatedAt: ts,
    },
    persons: [
      basePerson(UUID_FATHER_UNKNOWN_SEX, '父甲', 'unknown'),
      basePerson(UUID_FATHER_NEW, '父乙', 'male'),
      basePerson(UUID_MOTHER, '林母', 'female'),
      {
        ...basePerson(UUID_CHILD, '子', 'male'),
        names: [
          {
            id: UUID_NAME_ALIAS,
            projectId: UUID_PROJECT,
            personId: UUID_CHILD,
            kind: 'courtesy',
            value: '旧字',
            surname: null,
            romanizedSurname: null,
            romanizedName: null,
            label: '字',
            isPrimary: false,
            createdAt: ts,
            updatedAt: ts,
          },
        ],
        events: [
          {
            id: UUID_EVENT_1,
            projectId: UUID_PROJECT,
            personId: UUID_CHILD,
            type: 'career',
            structuredDate: null,
            structuredPlace: null,
            description: '旧事',
            sortOrder: 0,
            createdAt: ts,
            updatedAt: ts,
          },
        ],
      },
    ],
    relations: [
      {
        id: UUID_EDGE_FATHER,
        projectId: UUID_PROJECT,
        fromPersonId: UUID_FATHER_UNKNOWN_SEX,
        toPersonId: UUID_CHILD,
        kind: 'biological_parent',
        fromRoleLabel: null,
        toRoleLabel: '生子',
        sortOrder: 0,
        note: null,
        createdAt: ts,
        updatedAt: ts,
      },
      {
        id: UUID_EDGE_MOTHER,
        projectId: UUID_PROJECT,
        fromPersonId: UUID_MOTHER,
        toPersonId: UUID_CHILD,
        kind: 'biological_parent',
        fromRoleLabel: null,
        toRoleLabel: '生子',
        sortOrder: 0,
        note: null,
        createdAt: ts,
        updatedAt: ts,
      },
    ],
    projections: [
      { personId: UUID_FATHER_UNKNOWN_SEX, primaryPath: 'a', generation: 0 },
      { personId: UUID_CHILD, primaryPath: 'a.c', generation: 1 },
    ],
  };
}

beforeEach(() => {
  resetApiTransportForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiTransportForTests();
});

test('syncPersonUpdatesToApi issues a single PUT /aggregate call and diffs parent edges by ID without sex guessing', async () => {
  const graph = makeGraph();
  const records = graphToPersonRecords(UUID_PROJECT, graph);
  const calls = mockJsonFetch({ person: graph.persons[3], relations: [], projection: null });

  await syncPersonUpdatesToApi(UUID_PROJECT, graph, records, UUID_CHILD, {
    name: '新子',
    fatherId: UUID_FATHER_NEW,
    fatherRelationType: '养子',
    aliasItems: [{ id: 'alias-new', type: '号', name: '青峰' }],
    events: [{ id: UUID_EVENT_1, type: 'career', description: '新事' }],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'PUT');
  assert.equal(
    calls[0]?.url,
    `/api/v1/projects/${UUID_PROJECT}/persons/${UUID_CHILD}/aggregate`,
  );
  assert.deepEqual(calls[0]?.body, {
    version: 3,
    person: {
      displayName: '陈新子',
      givenName: '新子',
    },
    names: {
      create: [{ kind: 'art', value: '青峰', label: '号' }],
      deleteIds: [UUID_NAME_ALIAS],
    },
    events: {
      update: [
        {
          id: UUID_EVENT_1,
          type: 'career',
          structuredDate: null,
          structuredPlace: null,
          description: '新事',
          sortOrder: 0,
        },
      ],
    },
    relations: {
      create: [
        {
          fromPersonId: UUID_FATHER_NEW,
          toPersonId: UUID_CHILD,
          kind: 'adoptive_parent',
          toRoleLabel: '养子',
        },
      ],
      deleteIds: [UUID_EDGE_FATHER],
    },
  });
});

test('createRelativeViaApi issues a single POST /relatives call for child with auto-created mother', async () => {
  const graph = makeGraph();
  const records = graphToPersonRecords(UUID_PROJECT, graph);
  const fatherRecord = records.find((p) => p.id === UUID_FATHER_NEW)!;
  const calls = mockJsonFetch({
    person: { id: 'new-child-id' },
    companionPerson: { id: 'new-mother-id' },
    relations: [],
    anchorEvents: [],
  });

  const res = await createRelativeViaApi(
    UUID_PROJECT,
    UUID_LINEAGE,
    graph,
    records,
    '陈',
    { relation: 'child', targetPerson: fatherRecord },
    {
      surname: '陈',
      name: '季常',
      gender: 'male',
      status: 'living',
      shouldAutoCreateMother: true,
      motherName: '王氏',
    },
  );

  assert.equal(res.selectId, 'new-child-id');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'POST');
  assert.equal(calls[0]?.url, `/api/v1/projects/${UUID_PROJECT}/relatives`);
  assert.equal(calls[0]?.body.anchorPersonId, UUID_FATHER_NEW);
  assert.ok(calls[0]?.body.companion);
});
