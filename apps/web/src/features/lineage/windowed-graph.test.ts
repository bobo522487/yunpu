import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'vitest';
import { resetApiTransportForTests } from '../../lib/api.ts';
import {
  graphToPersonRecords,
  mergePersonDetailIntoGraph,
  subgraphToLineageGraphPayload,
} from './adapter.ts';
import type { LineageDto, PersonDto, SubgraphPayload } from './api.ts';
import {
  loadWindowedLineageCanvas,
  selectWindowAnchorPersonId,
} from './queries.ts';

const originalFetch = globalThis.fetch;

const LINEAGE: LineageDto = {
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
};

function makePersonDto(
  id: string,
  displayName: string,
  overrides: Partial<PersonDto> = {},
): PersonDto {
  return {
    id,
    projectId: 'proj-1',
    lineageId: 'lin-1',
    displayName,
    sex: 'male',
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
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetApiTransportForTests();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiTransportForTests();
});

test('loadWindowedLineageCanvas uses /graph when lineage size is within threshold', async () => {
  const requestedUrls: string[] = [];
  const p1 = makePersonDto('p-1', '陈旺', { relationTitle: '始祖' });

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes('/persons?')) {
      return new Response(
        JSON.stringify({ ok: true, data: { persons: [p1], nextCursor: null } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          lineage: LINEAGE,
          persons: [p1],
          relations: [],
          projections: [{ personId: 'p-1', primaryPath: 'p1', generation: 0 }],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as typeof fetch;

  const result = await loadWindowedLineageCanvas({
    projectId: 'proj-1',
    lineage: LINEAGE,
    threshold: 5,
  });

  assert.equal(result.mode, 'graph');
  assert.equal(result.subgraphMeta, null);
  assert.equal(result.graph.persons.length, 1);
  assert.equal(requestedUrls.some((u) => u.includes('/graph')), true);
  assert.equal(requestedUrls.some((u) => u.includes('/subgraph')), false);
});

test('loadWindowedLineageCanvas switches to /subgraph centered on anchor when exceeding threshold', async () => {
  const requestedUrls: string[] = [];
  const p1 = makePersonDto('p-1', '陈旺');
  const p2 = makePersonDto('p-2', '陈始', { relationTitle: '始祖' });
  const p3 = makePersonDto('p-3', '陈子');

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes('/persons?')) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { persons: [p1, p2], nextCursor: 'p-2' },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.includes('/subgraph?')) {
      const payload: SubgraphPayload = {
        rootPersonId: 'p-2',
        persons: [p2, p3],
        relations: [
          {
            id: 'r-1',
            projectId: 'proj-1',
            fromPersonId: 'p-2',
            toPersonId: 'p-3',
            kind: 'biological_parent',
            fromRoleLabel: null,
            toRoleLabel: '生子',
            sortOrder: 0,
            note: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
        hasMoreAncestors: false,
        hasMoreDescendants: true,
      };
      return new Response(JSON.stringify({ ok: true, data: payload }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await loadWindowedLineageCanvas({
    projectId: 'proj-1',
    lineage: LINEAGE,
    threshold: 2,
  });

  assert.equal(result.mode, 'subgraph');
  assert.equal(result.subgraphMeta?.rootPersonId, 'p-2');
  assert.equal(result.subgraphMeta?.hasMoreDescendants, true);
  assert.equal(requestedUrls.some((u) => u.includes('/graph')), false);
  assert.equal(
    requestedUrls.some((u) => u.includes('/subgraph?rootPersonId=p-2')),
    true,
  );

  const records = graphToPersonRecords('proj-1', result.graph);
  assert.equal(records.find((r) => r.id === 'p-2')?.generation, 1);
  assert.equal(records.find((r) => r.id === 'p-3')?.generation, 2);
});

test('selectWindowAnchorPersonId prioritizes explicit anchor, then valid selection, then progenitor', () => {
  const p1 = makePersonDto('p-1', '普通');
  const p2 = makePersonDto('p-2', '始祖', { relationTitle: '开基始祖' });
  const p3 = makePersonDto('p-3', '后裔');

  assert.equal(selectWindowAnchorPersonId([p1, p2, p3], 'p-3', 'p-1'), 'p-3');
  assert.equal(selectWindowAnchorPersonId([p1, p2, p3], null, 'p-1'), 'p-1');
  assert.equal(
    selectWindowAnchorPersonId([p1, p2, p3], null, 'not-in-probe'),
    'p-2',
  );
  assert.equal(selectWindowAnchorPersonId([p1, p3], null, null), 'p-1');
});

test('mergePersonDetailIntoGraph hydrates events and names for selected person without mutating others', () => {
  const light = makePersonDto('p-1', '张', { givenName: null });
  const blank = makePersonDto('p-2', '', { surname: null, givenName: null });
  const graph = subgraphToLineageGraphPayload(LINEAGE, {
    rootPersonId: 'p-1',
    persons: [light, blank],
    relations: [],
    hasMoreAncestors: false,
    hasMoreDescendants: false,
  });

  const detail = makePersonDto('p-1', '张', {
    givenName: null,
    names: [
      {
        id: 'n-alias',
        projectId: 'proj-1',
        personId: 'p-1',
        kind: 'courtesy',
        value: '子敬',
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
        id: 'ev-1',
        projectId: 'proj-1',
        personId: 'p-1',
        type: 'career',
        structuredDate: null,
        structuredPlace: null,
        description: '任县令',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ],
  });

  const merged = mergePersonDetailIntoGraph(graph, detail);
  const records = graphToPersonRecords('proj-1', merged);
  const p1 = records.find((r) => r.id === 'p-1');
  const p2 = records.find((r) => r.id === 'p-2');

  assert.equal(p1?.events?.[0]?.description, '任县令');
  assert.equal(p1?.aliasItems?.[0]?.name, '子敬');
  assert.equal(p2?.name, '');
});
