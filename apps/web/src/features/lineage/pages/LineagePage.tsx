import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  GitFork,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { findItemDeep } from '../../../components/common/Tree/utilities';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { useResizable } from '../../../hooks/useResizable';
import { ApiError, errorMessage } from '../../../lib/api';
import {
  findFirstChartId,
  type LineageChartMeta,
  makeChartStorageKey,
  resolveChartSurname,
  useLineageStore,
} from '../../../store/useLineageStore';
import {
  directoryToTreeItems,
  graphToPersonRecords,
  mergePersonDetailIntoGraph,
} from '../adapter';
import {
  createLineageRequest,
  deletePersonRequest,
  fetchPersonDetail,
  type LineageGraphPayload,
  uploadProjectMediaRequest,
} from '../api';
import {
  createDirectPersonViaApi,
  createRelativeViaApi,
  syncCoupleMarriageEventToApi,
  syncPersonUpdatesToApi,
} from '../mutations';
import {
  DEFAULT_SUBGRAPH_DOWN_DEPTH,
  DEFAULT_SUBGRAPH_LIMIT,
  DEFAULT_SUBGRAPH_UP_DEPTH,
  invalidateLineageDirectory,
  invalidateLineageGraph,
  useLineageDirectoryQuery,
} from '../queries';
import { useLineageCanvasData } from '../hooks/useLineageCanvasData';
import type { PersonRecord } from '../types';
import { LineageTreeView } from '../components/LineageTreeView';
import { PersonDetailPanel } from '../components/PersonDetailPanel';
import { AddRelativeModal } from '../components/AddRelativeModal';
import type {
  AddRelativeContext,
  AddRelativeSubmitPayload,
} from '../domain/addRelativeTypes';
import { LineageEditorModal } from '../../project/components/LineageEditorModal';

const EMPTY_COLLAPSED: Record<string, boolean> = {};

const LineagePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    projectId: activeProjectId,
    project: activeProject,
    surname: projectSurname,
  } = useActiveProject();

  const selectedNodeIdByProject = useLineageStore(
    (s) => s.selectedNodeIdByProject,
  );
  const selectedPersonIdByChart = useLineageStore(
    (s) => s.selectedPersonIdByChart,
  );
  const collapsedFolders = useLineageStore(
    (s) => s.collapsedFoldersByProject[activeProjectId] ?? EMPTY_COLLAPSED,
  );
  const selectNode = useLineageStore((s) => s.selectNode);
  const selectPersonStore = useLineageStore((s) => s.selectPerson);

  const [isCreateLineageOpen, setIsCreateLineageOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isVersionConflict, setIsVersionConflict] = useState(false);

  const { width: inspectorWidth, startResizing } = useResizable({
    initialWidth: 440,
    minWidth: 360,
    maxWidth: 640,
    edge: 'right',
  });

  const directoryQuery = useLineageDirectoryQuery(activeProjectId);

  const lineageTree = useMemo(
    () =>
      directoryToTreeItems(
        directoryQuery.data?.folders ?? [],
        directoryQuery.data?.lineages ?? [],
        collapsedFolders,
      ),
    [directoryQuery.data, collapsedFolders],
  );

  const defaultChartId = useMemo(
    () =>
      findFirstChartId(lineageTree) || String(lineageTree[0]?.id || ''),
    [lineageTree],
  );

  const selectedLineageId =
    selectedNodeIdByProject[activeProjectId] ?? defaultChartId;

  const selectedLineageNode = useMemo(
    () =>
      findItemDeep(lineageTree, selectedLineageId) ||
      findItemDeep(lineageTree, defaultChartId) ||
      lineageTree[0],
    [lineageTree, selectedLineageId, defaultChartId],
  );

  const isFolderSelected = selectedLineageNode?.type === 'folder';
  const chartId =
    selectedLineageNode && !isFolderSelected
      ? String(selectedLineageNode.id)
      : '';
  const chartName = selectedLineageNode?.data?.name || '谱系图谱';
  const chartStorageKey = makeChartStorageKey(activeProjectId, chartId);

  const activeLineage = useMemo(
    () =>
      directoryQuery.data?.lineages.find((item) => item.id === chartId) ?? null,
    [directoryQuery.data, chartId],
  );

  const selectedPersonId =
    selectedPersonIdByChart[chartStorageKey] ?? null;

  const [windowAnchorPersonId, setWindowAnchorPersonId] = useState<
    string | null
  >(null);
  const [windowUpDepth, setWindowUpDepth] = useState(
    DEFAULT_SUBGRAPH_UP_DEPTH,
  );
  const [windowDownDepth, setWindowDownDepth] = useState(
    DEFAULT_SUBGRAPH_DOWN_DEPTH,
  );
  const [windowLimit, setWindowLimit] = useState(DEFAULT_SUBGRAPH_LIMIT);

  const canvasData = useLineageCanvasData({
    projectId: activeProjectId,
    lineage: activeLineage,
    selectedPersonId,
    anchorPersonId: windowAnchorPersonId,
    upDepth: windowUpDepth,
    downDepth: windowDownDepth,
    limit: windowLimit,
  });

  const effectiveSurname = useMemo(
    () => resolveChartSurname(selectedLineageNode, projectSurname),
    [selectedLineageNode, projectSurname],
  );

  const chartPersons = useMemo(() => {
    if (!chartId || isFolderSelected || !canvasData.graphData) return [];
    return graphToPersonRecords(activeProjectId, canvasData.graphData);
  }, [activeProjectId, chartId, isFolderSelected, canvasData.graphData]);

  const selectedPerson = useMemo(
    () =>
      selectedPersonId
        ? chartPersons.find((p) => p.id === selectedPersonId) ?? null
        : null,
    [chartPersons, selectedPersonId],
  );

  const [addRelativeContext, setAddRelativeContext] =
    useState<AddRelativeContext | null>(null);

  useEffect(() => {
    setAddRelativeContext(null);
    setMutationError(null);
    setIsVersionConflict(false);
    setWindowAnchorPersonId(null);
    setWindowUpDepth(DEFAULT_SUBGRAPH_UP_DEPTH);
    setWindowDownDepth(DEFAULT_SUBGRAPH_DOWN_DEPTH);
    setWindowLimit(DEFAULT_SUBGRAPH_LIMIT);
  }, [activeProjectId, chartId]);

  const handleMutationError = (err: unknown) => {
    setMutationError(errorMessage(err));
    setIsVersionConflict(
      err instanceof ApiError && err.code === 'VERSION_CONFLICT',
    );
  };

  const handleSelectPerson = (personId: string | null) => {
    if (!chartId) return;
    selectPersonStore(activeProjectId, chartId, personId);
  };

  const ensureGraphPersonHydrated = async (
    baseGraph: LineageGraphPayload,
    personIds: string[],
  ): Promise<LineageGraphPayload> => {
    const missing = personIds.filter((id) => {
      const dto = baseGraph.persons.find((item) => item.id === id);
      return dto && (dto.events === undefined || dto.names === undefined);
    });
    if (missing.length === 0) return baseGraph;
    const details = await Promise.all(
      missing.map((id) => fetchPersonDetail(activeProjectId, id)),
    );
    return details.reduce(
      (acc, { person }) => mergePersonDetailIntoGraph(acc, person),
      baseGraph,
    );
  };

  const handleUpdatePerson = async (
    personId: string,
    updates: Partial<PersonRecord>,
  ) => {
    if (!chartId || !canvasData.graphData) return;
    setMutationError(null);
    setIsVersionConflict(false);
    try {
      const needsDetail =
        updates.events !== undefined ||
        updates.aliasItems !== undefined ||
        updates.aliases !== undefined;
      const workingGraph = needsDetail
        ? await ensureGraphPersonHydrated(canvasData.graphData, [personId])
        : canvasData.graphData;
      const workingPersons =
        workingGraph === canvasData.graphData
          ? chartPersons
          : graphToPersonRecords(activeProjectId, workingGraph);
      await syncPersonUpdatesToApi(
        activeProjectId,
        workingGraph,
        workingPersons,
        personId,
        updates,
      );
      await invalidateLineageGraph(queryClient, activeProjectId, chartId);
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleDeletePerson = async (personId: string) => {
    if (!chartId) return;
    setMutationError(null);
    setIsVersionConflict(false);
    try {
      await deletePersonRequest(activeProjectId, personId);
      if (selectedPersonId === personId) {
        selectPersonStore(activeProjectId, chartId, null);
      }
      await invalidateLineageGraph(queryClient, activeProjectId, chartId);
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleOpenAddChild = (
    parentId: string,
    gender: 'male' | 'female' = 'male',
    motherInfo?: { motherId?: string; motherName?: string },
  ) => {
    if (!chartId) return;
    const rawParent = chartPersons.find((p) => p.id === parentId);
    if (!rawParent) return;
    const isSpouseNode = Boolean(rawParent.spouseOfId);
    const resolvedPartnerId = rawParent.spouseOfId || rawParent.id;
    const anchor =
      chartPersons.find((p) => p.id === resolvedPartnerId) || rawParent;
    const resolvedMotherId =
      motherInfo?.motherId || (isSpouseNode ? rawParent.id : undefined);
    const resolvedMotherName =
      motherInfo?.motherName ||
      (isSpouseNode
        ? [rawParent.surname?.trim() || '', rawParent.name?.trim() || '']
            .filter(Boolean)
            .join('') || undefined
        : undefined);

    setAddRelativeContext({
      relation: 'child',
      targetPerson: anchor,
      defaultGender: gender,
      initiatedFrom: isSpouseNode ? 'mother' : 'father',
      motherInfo:
        resolvedMotherId || resolvedMotherName
          ? { motherId: resolvedMotherId, motherName: resolvedMotherName }
          : undefined,
    });
  };

  const handleOpenAddSibling = (
    refPersonId: string,
    gender: 'male' | 'female' = 'male',
  ) => {
    if (!chartId) return;
    const rawTarget = chartPersons.find((p) => p.id === refPersonId);
    if (!rawTarget) return;
    const resolvedRefId = rawTarget.spouseOfId || rawTarget.id;
    const refPerson =
      chartPersons.find((p) => p.id === resolvedRefId) || rawTarget;

    setAddRelativeContext({
      relation: 'sibling',
      targetPerson: refPerson,
      defaultGender: gender,
    });
  };

  const handleOpenAddSpouse = (personId: string) => {
    if (!chartId) return;
    const rawTarget = chartPersons.find((p) => p.id === personId);
    if (!rawTarget) return;
    const partnerId = rawTarget.spouseOfId || rawTarget.id;
    const partner = chartPersons.find((p) => p.id === partnerId) || rawTarget;

    setAddRelativeContext({
      relation: 'spouse',
      targetPerson: partner,
      defaultGender: partner.gender === 'male' ? 'female' : 'male',
    });
  };

  const handleOpenAddParent = (personId: string) => {
    if (!chartId) return;
    const target = chartPersons.find((p) => p.id === personId);
    if (!target) return;

    const existingFather = target.fatherId
      ? chartPersons.find((p) => p.id === target.fatherId)
      : null;

    const existingFatherSpouses = existingFather
      ? chartPersons.filter((p) => p.spouseOfId === existingFather.id)
      : [];

    const defaultGender: 'male' | 'female' =
      existingFather && existingFatherSpouses.length === 0 ? 'female' : 'male';

    setAddRelativeContext({
      relation: 'parent',
      targetPerson: target,
      defaultGender,
    });
  };

  const handleConfirmAddRelative = async (
    context: AddRelativeContext,
    payload: AddRelativeSubmitPayload,
  ) => {
    if (!chartId || !canvasData.graphData) return;
    const keepSelection = Boolean(selectedPersonId);
    setMutationError(null);
    setIsVersionConflict(false);
    try {
      const { selectId } = await createRelativeViaApi(
        activeProjectId,
        chartId,
        canvasData.graphData,
        chartPersons,
        effectiveSurname,
        context,
        payload,
      );
      if (keepSelection) {
        selectPersonStore(activeProjectId, chartId, selectId);
      }
      setAddRelativeContext(null);
      await invalidateLineageGraph(queryClient, activeProjectId, chartId);
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleAddPersonDirectly = async (initialData: Partial<PersonRecord>) => {
    if (!chartId) return;
    setMutationError(null);
    setIsVersionConflict(false);
    try {
      const created = await createDirectPersonViaApi(
        activeProjectId,
        chartId,
        effectiveSurname,
        chartPersons.length,
        initialData,
      );
      selectPersonStore(activeProjectId, chartId, created.id);
      await invalidateLineageGraph(queryClient, activeProjectId, chartId);
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleUpdatePersonFather = (
    childId: string,
    fatherId: string | null,
  ) => {
    void handleUpdatePerson(childId, { fatherId });
  };

  const handleCommitPersons = async (nextPersons: PersonRecord[]) => {
    if (!chartId || !canvasData.graphData) return;
    setMutationError(null);
    setIsVersionConflict(false);
    try {
      const changedIds = nextPersons
        .filter((next) => {
          const prev = chartPersons.find((p) => p.id === next.id);
          return prev && prev.events !== next.events;
        })
        .map((p) => p.id);
      const workingGraph = await ensureGraphPersonHydrated(
        canvasData.graphData,
        changedIds,
      );
      const workingPrevPersons =
        workingGraph === canvasData.graphData
          ? chartPersons
          : graphToPersonRecords(activeProjectId, workingGraph);
      await syncCoupleMarriageEventToApi(
        activeProjectId,
        workingGraph,
        workingPrevPersons,
        nextPersons,
      );
      await invalidateLineageGraph(queryClient, activeProjectId, chartId);
    } catch (err) {
      handleMutationError(err);
    }
  };

  const handleCreateLineageSubmit = async (
    values: LineageChartMeta,
    folderId?: string | null,
  ) => {
    setCreateSaving(true);
    setCreateError(null);
    try {
      const created = await createLineageRequest(activeProjectId, {
        name: values.name,
        folderId: folderId ?? null,
        surname: values.surname?.trim() || undefined,
        hallName: values.hallName?.trim() || undefined,
        progenitor: values.progenitor?.trim() || undefined,
        region: values.region ?? null,
        seq: directoryQuery.data?.lineages.length ?? 0,
      });
      await invalidateLineageDirectory(queryClient, activeProjectId);
      selectNode(activeProjectId, created.lineage.id);
      setIsCreateLineageOpen(false);
    } catch (err) {
      setCreateError(errorMessage(err));
    } finally {
      setCreateSaving(false);
    }
  };

  if (directoryQuery.isPending) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background text-[13px] text-muted-foreground">
        正在加载谱系工作区...
      </div>
    );
  }

  if (lineageTree.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-subtle)] border border-border mx-auto flex items-center justify-center text-primary">
            <GitFork size={22} />
          </div>
          <div className="space-y-1.5">
            <h2 className="yp-h2 text-foreground">暂无谱系图谱</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              为当前家族新建一份谱系图以录入始迁祖及后裔脉络。
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <Button
              size="sm"
              onClick={() => {
                setCreateError(null);
                setIsCreateLineageOpen(true);
              }}
            >
              <Plus size={14} /> 新建谱系图
            </Button>
          </div>
        </div>

        <LineageEditorModal
          open={isCreateLineageOpen}
          mode="create"
          saving={createSaving}
          submitError={createError}
          initialValue={{
            name: '',
            surname: projectSurname,
            hallName: activeProject?.hallName || '',
            progenitor: activeProject?.ancestor || '',
            region: null,
          }}
          onClose={() => setIsCreateLineageOpen(false)}
          onSubmit={(values) => handleCreateLineageSubmit(values, null)}
        />
      </div>
    );
  }

  if (!isFolderSelected) {
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full min-w-0 overflow-hidden bg-background">
        {mutationError && (
          <div
            role="alert"
            className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-[12px] text-destructive flex items-center justify-between gap-3"
          >
            <span>{mutationError}</span>
            <div className="flex items-center gap-2 shrink-0">
              {isVersionConflict && (
                <button
                  type="button"
                  onClick={() => {
                    setMutationError(null);
                    setIsVersionConflict(false);
                    void invalidateLineageGraph(
                      queryClient,
                      activeProjectId,
                      chartId,
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 bg-destructive text-destructive-foreground text-[11px] cursor-pointer"
                >
                  <RefreshCw size={11} /> 刷新最新数据
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMutationError(null);
                  setIsVersionConflict(false);
                }}
                className="text-[11px] underline cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative bg-muted/10">
            {canvasData.mode === 'subgraph' && (
              <div
                data-testid="windowed-subgraph-banner"
                className="shrink-0 border-b border-border bg-card/95 px-4 py-1.5 text-[12px] text-muted-foreground flex flex-wrap items-center justify-between gap-2 z-10"
              >
                <span>
                  大谱系窗口化模式：当前仅加载锚点附近 {chartPersons.length} 人
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedPerson &&
                    selectedPerson.id !==
                      canvasData.subgraphMeta?.rootPersonId && (
                      <button
                        type="button"
                        onClick={() => {
                          setWindowAnchorPersonId(selectedPerson.id);
                          setWindowUpDepth(DEFAULT_SUBGRAPH_UP_DEPTH);
                          setWindowDownDepth(DEFAULT_SUBGRAPH_DOWN_DEPTH);
                        }}
                        className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent cursor-pointer"
                      >
                        以「{selectedPerson.surname ?? ''}
                        {selectedPerson.name}」为中心展开
                      </button>
                    )}
                  {canvasData.subgraphMeta?.hasMoreAncestors &&
                    windowUpDepth < 10 && (
                      <button
                        type="button"
                        onClick={() =>
                          setWindowUpDepth((prev) => Math.min(10, prev + 2))
                        }
                        className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent cursor-pointer"
                      >
                        向上扩展世代
                      </button>
                    )}
                  {canvasData.subgraphMeta?.hasMoreDescendants &&
                    windowDownDepth < 20 && (
                      <button
                        type="button"
                        onClick={() =>
                          setWindowDownDepth((prev) => Math.min(20, prev + 2))
                        }
                        className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent cursor-pointer"
                      >
                        向下扩展世代
                      </button>
                    )}
                  {(canvasData.subgraphMeta?.hasMoreAncestors ||
                    canvasData.subgraphMeta?.hasMoreDescendants) &&
                    windowLimit < 1000 && (
                      <button
                        type="button"
                        onClick={() =>
                          setWindowLimit((prev) => Math.min(1000, prev + 200))
                        }
                        className="rounded border border-border px-2 py-0.5 text-foreground hover:bg-accent cursor-pointer"
                      >
                        加载更多节点
                      </button>
                    )}
                </div>
              </div>
            )}
            {canvasData.isPending && !canvasData.graphData ? (
              <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground">
                正在加载谱系图谱数据...
              </div>
            ) : (
              <LineageTreeView
                persons={chartPersons}
                selectedPersonId={selectedPerson?.id ?? null}
                branchTitle={chartName}
                clanSurname={effectiveSurname}
                onSelectPerson={handleSelectPerson}
                onAddChild={handleOpenAddChild}
                onAddSibling={handleOpenAddSibling}
                onAddSpouse={handleOpenAddSpouse}
                onAddParent={handleOpenAddParent}
                onDeletePerson={(pid) => void handleDeletePerson(pid)}
                onAddPersonDirectly={(data) => void handleAddPersonDirectly(data)}
                onUpdatePersonFather={handleUpdatePersonFather}
              />
            )}
          </div>

          {selectedPerson && (
            <>
              <div
                className="w-[1px] bg-border hover:bg-primary cursor-col-resize z-40 relative transition-colors shrink-0"
                onMouseDown={startResizing}
              >
                <div className="absolute inset-y-0 -left-1 w-3 cursor-col-resize z-40" />
              </div>

              <PersonDetailPanel
                person={selectedPerson}
                allPersons={chartPersons}
                clanSurname={effectiveSurname}
                onSelectPerson={handleSelectPerson}
                onUpdatePerson={(id, updates) => void handleUpdatePerson(id, updates)}
                onCommitPersons={(nextPersons) => void handleCommitPersons(nextPersons)}
                onDeletePerson={(id) => void handleDeletePerson(id)}
                onAddChild={handleOpenAddChild}
                onAddSpouse={handleOpenAddSpouse}
                onAddSibling={handleOpenAddSibling}
                onAddParent={handleOpenAddParent}
                onUploadPortrait={(blob, contentType) =>
                  uploadProjectMediaRequest(activeProjectId, blob, contentType)
                }
                width={inspectorWidth}
                onClose={() => handleSelectPerson(null)}
              />
            </>
          )}
        </div>

        <AddRelativeModal
          context={addRelativeContext}
          allPersons={chartPersons}
          clanSurname={effectiveSurname}
          onClose={() => setAddRelativeContext(null)}
          onSubmit={(ctx, payload) => void handleConfirmAddRelative(ctx, payload)}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl border border-border bg-[var(--surface-subtle)] flex items-center justify-center text-primary shrink-0">
              <GitFork size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="yp-h2 text-foreground truncate">
                  {selectedLineageNode.data?.name || '谱系'}
                </h1>
                <span className="text-[12px] text-muted-foreground truncate">
                  {activeProject?.hallName || activeProject?.name}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                梳理家族世代传承、支派脉络与成员亲属关系树。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void navigate({
                  to: '/projects/$projectId',
                  params: { projectId: activeProjectId },
                })
              }
              className="h-8 gap-1.5 text-[13px] whitespace-nowrap"
            >
              <ArrowLeft size={14} /> 返回工作台概览
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void navigate({
                  to: '/projects/$projectId/settings',
                  params: { projectId: activeProjectId },
                })
              }
              className="h-8 gap-1.5 text-[13px] whitespace-nowrap"
            >
              <Settings size={14} /> 家族设置
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
              <FolderOpen size={16} className="text-primary" />
              <span>{selectedLineageNode.data?.name}</span>
              <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
                ({selectedLineageNode.children?.length || 0} 份谱系图)
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreateError(null);
                setIsCreateLineageOpen(true);
              }}
              className="h-8 gap-1.5 text-[13px]"
            >
              <Plus size={14} /> 新增谱系图
            </Button>
          </div>

          {selectedLineageNode.children?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedLineageNode.children.map((child) => (
                <button
                  key={String(child.id)}
                  type="button"
                  onClick={() => selectNode(activeProjectId, String(child.id))}
                  className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-card-hover)] transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--surface-subtle)] border border-border flex items-center justify-center text-primary shrink-0">
                      <GitFork size={15} />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {child.data?.name || String(child.id)}
                    </span>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground group-hover:translate-x-0.5 transition-transform shrink-0"
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 py-12 px-6 text-center space-y-3">
              <p className="text-[13px] text-muted-foreground">
                该分组下暂无谱系图，可直接点击上方「新增谱系图」或从左侧拖拽节点移入。
              </p>
            </div>
          )}
        </div>
      </div>

      <LineageEditorModal
        open={isCreateLineageOpen}
        mode="create"
        saving={createSaving}
        submitError={createError}
        initialValue={{
          name: '',
          surname: projectSurname,
          hallName: activeProject?.hallName || '',
          progenitor: '',
          region: null,
        }}
        onClose={() => setIsCreateLineageOpen(false)}
        onSubmit={(values) =>
          handleCreateLineageSubmit(
            values,
            selectedLineageNode ? String(selectedLineageNode.id) : null,
          )
        }
      />
    </div>
  );
};

export default LineagePage;
