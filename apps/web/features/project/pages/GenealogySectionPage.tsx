import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FolderOpen,
  GitFork,
  Plus,
  ScrollText,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { findItemDeep } from '../../../components/common/Tree/utilities';
import { useRouteContext } from '../../../hooks/useRouteContext';
import { useResizable } from '../../../hooks/useResizable';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import {
  DEFAULT_LINEAGE_TREE,
  findFirstChartId,
  makeChartStorageKey,
  useLineageStore,
} from '../../../store/useLineageStore';
import {
  DEFAULT_BIOGRAPHY_PREVIEW_PREFS,
  usePreferencesStore,
} from '../../../store/usePreferencesStore';
import { GenealogyBookPreview } from '../../dashboard/components/GenealogyBookPreview';
import { createSeedPersonsForChart } from '../../lineage/lineageData';
import { LineageViewMode, PersonRecord } from '../../lineage/types';
import { LineageTreeView } from '../../lineage/components/LineageTreeView';
import { LineageGridView } from '../../lineage/components/LineageGridView';
import { LineageTableView } from '../../lineage/components/LineageTableView';
import { PersonDetailPanel } from '../../lineage/components/PersonDetailPanel';
import { AddPersonDialog } from '../../lineage/components/AddPersonDialog';

export type GenealogySectionType = 'lineage' | 'articles' | 'books';

interface GenealogySectionPageProps {
  section: GenealogySectionType;
}

const SECTION_CONFIG: Record<
  GenealogySectionType,
  {
    title: string;
    subtitle: string;
    icon: React.FC<{ size?: number; className?: string }>;
    emptyTitle: string;
    emptyDesc: string;
    outlineItems: { name: string; desc: string }[];
  }
> = {
  lineage: {
    title: '谱系',
    subtitle: '梳理家族世代传承、支派脉络与成员亲属关系树。',
    icon: GitFork,
    emptyTitle: '世系图谱工作区',
    emptyDesc:
      '可在左侧世系目录中拖拽排序、折叠分组或切换任意世系图谱。',
    outlineItems: [
      { name: '世系总图', desc: '按世代与支系查看家族树形脉络' },
      { name: '房支管理', desc: '梳理各房分派渊源与迁徙记录' },
      { name: '成员名录', desc: '维护字辈、行第、配偶与生平纪略' },
    ],
  },
  articles: {
    title: '谱文',
    subtitle: '编修序言、凡例、姓氏源流、家训族规与人物传记。',
    icon: ScrollText,
    emptyTitle: '谱文模块准备中',
    emptyDesc:
      '后续可在此撰写与归档家族文献篇章，支持按卷目结构整理历代谱序、碑记与家传。',
    outlineItems: [
      { name: '谱序与凡例', desc: '记录修谱缘起、体例说明与编委会名录' },
      { name: '源流与家训', desc: '汇编姓氏得姓源流、祖训家规与祠规' },
      { name: '传记与艺文', desc: '收录先贤行状、诗词歌赋与大事记' },
    ],
  },
  books: {
    title: '谱书',
    subtitle: '组织分卷目录、版式排版预览与线装谱书成品输出。',
    icon: BookOpen,
    emptyTitle: '谱书模块准备中',
    emptyDesc:
      '后续可将已完成的谱系与谱文自动汇集编排，生成传统欧式、苏式或现代双栏版式谱书。',
    outlineItems: [
      { name: '封面与题签', desc: '沿用当前云谱项目主题名、姓氏印章与配色' },
      { name: '分卷目录', desc: '编排卷首、世系表、谱文及附录页码顺序' },
      { name: '版式与印制', desc: '预览电子版谱书并导出高清印刷成册文件' },
    ],
  },
};

const GenealogySectionPage: React.FC<GenealogySectionPageProps> = ({
  section,
}) => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();
  const projects = useWorkspaceStore((s) => s.projects);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const treesByProject = useLineageStore((s) => s.treesByProject);
  const selectedNodeIdByProject = useLineageStore(
    (s) => s.selectedNodeIdByProject
  );
  const personsByChart = useLineageStore((s) => s.personsByChart);
  const selectedPersonIdByChart = useLineageStore(
    (s) => s.selectedPersonIdByChart
  );
  const selectNode = useLineageStore((s) => s.selectNode);
  const addChart = useLineageStore((s) => s.addChart);
  const selectPersonStore = useLineageStore((s) => s.selectPerson);
  const addPersonStore = useLineageStore((s) => s.addPerson);
  const updatePersonStore = useLineageStore((s) => s.updatePerson);
  const deletePersonStore = useLineageStore((s) => s.deletePerson);
  const reorderSiblingStore = useLineageStore((s) => s.reorderSibling);

  const drawerMode = usePreferencesStore((s) => s.lineageDrawerMode || 'narrow');
  const setDrawerMode = usePreferencesStore((s) => s.setLineageDrawerMode);
  const previewPrefs = usePreferencesStore(
    (s) => s.biographyPreviewPrefs || DEFAULT_BIOGRAPHY_PREVIEW_PREFS
  );
  const updatePreviewPrefs = usePreferencesStore(
    (s) => s.updateBiographyPreviewPrefs
  );

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addDialogParent, setAddDialogParent] = useState<PersonRecord | null>(
    null
  );

  const {
    width: inspectorWidth,
    setWidth: setInspectorWidth,
    startResizing,
  } = useResizable({
    initialWidth: drawerMode === 'wide' ? 760 : 390,
    minWidth: drawerMode === 'wide' ? 660 : 320,
    maxWidth: drawerMode === 'wide' ? 980 : 540,
    edge: 'right',
  });

  const handleChangeDrawerMode = (mode: 'narrow' | 'wide') => {
    setDrawerMode(mode);
    setInspectorWidth(mode === 'wide' ? 760 : 390);
  };

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ||
    projects.find((p) => p.workspaceId === activeWorkspaceId) ||
    projects[0];

  const lineageTree = useMemo(
    () => treesByProject[activeProjectId] || DEFAULT_LINEAGE_TREE,
    [treesByProject, activeProjectId]
  );

  const defaultChartId = useMemo(
    () =>
      findFirstChartId(lineageTree) ||
      String(lineageTree[0]?.id || 'lineage-group-royal'),
    [lineageTree]
  );

  const selectedLineageId =
    selectedNodeIdByProject[activeProjectId] ?? defaultChartId;

  const selectedLineageNode = useMemo(
    () =>
      findItemDeep(lineageTree, selectedLineageId) ||
      findItemDeep(lineageTree, defaultChartId) ||
      lineageTree[0],
    [lineageTree, selectedLineageId, defaultChartId]
  );

  const chartId = String(selectedLineageNode?.id || '');
  const chartName = selectedLineageNode?.data?.name || '世系图谱';
  const chartStorageKey = makeChartStorageKey(activeProjectId, chartId);

  const effectiveSurname = useMemo(() => {
    if (chartId.startsWith('lineage-royal-')) return '刘';
    if (
      chartId.startsWith('lineage-other-') ||
      chartId.startsWith('lineage-ancestor-')
    ) {
      return '';
    }
    return activeProject?.primarySurname || '';
  }, [chartId, activeProject?.primarySurname]);

  const chartPersons = useMemo(() => {
    if (!chartId || selectedLineageNode?.type === 'folder') return [];
    return (
      personsByChart[chartStorageKey] ||
      createSeedPersonsForChart(chartId, chartName, effectiveSurname)
    );
  }, [
    chartId,
    chartName,
    chartStorageKey,
    effectiveSurname,
    personsByChart,
    selectedLineageNode?.type,
  ]);

  const selectedPersonId =
    selectedPersonIdByChart[chartStorageKey] ?? null;

  const selectedPerson = useMemo(
    () =>
      selectedPersonId
        ? chartPersons.find((p) => p.id === selectedPersonId) ?? null
        : null,
    [chartPersons, selectedPersonId]
  );

  const [viewMode, setViewMode] = useState<LineageViewMode>('tree');

  useEffect(() => {
    setViewMode('tree');
  }, [activeProjectId, chartId]);

  const handleSelectPerson = (personId: string | null) => {
    if (!chartId) return;
    selectPersonStore(activeProjectId, chartId, personId);
  };

  const handleUpdatePerson = (
    personId: string,
    updates: Partial<PersonRecord>
  ) => {
    if (!chartId) return;
    updatePersonStore(
      activeProjectId,
      chartId,
      personId,
      updates,
      chartName,
      effectiveSurname
    );
  };

  const handleDeletePerson = (personId: string) => {
    if (!chartId) return;
    deletePersonStore(
      activeProjectId,
      chartId,
      personId,
      chartName,
      effectiveSurname
    );
  };

  const handleReorderSibling = (
    parentId: string,
    childId: string,
    direction: 'up' | 'down'
  ) => {
    if (!chartId) return;
    reorderSiblingStore(
      activeProjectId,
      chartId,
      parentId,
      childId,
      direction,
      chartName,
      effectiveSurname
    );
  };

  const handleOpenAddChild = (fatherId: string) => {
    const father = chartPersons.find((p) => p.id === fatherId) || null;
    setAddDialogParent(father);
    setIsAddDialogOpen(true);
  };

  const handleOpenAddSpouse = (personId: string) => {
    handleSelectPerson(personId);
    const person = chartPersons.find((p) => p.id === personId);
    if (person) {
      const currentSpouses = person.spouses || [];
      handleUpdatePerson(personId, {
        spouses: [...currentSpouses, { name: '妣某氏', clanOrigin: '系出待考' }],
      });
    }
  };

  const handleAddPersonDirectly = (initialData: Partial<PersonRecord>) => {
    if (!chartId) return;
    const newId = `person-${Date.now()}`;
    const newPerson: PersonRecord = {
      id: newId,
      name: initialData.name || '新录族人',
      generation: initialData.generation || 1,
      gender: initialData.gender || 'male',
      rank: initialData.rank || (initialData.generation === 1 ? '始祖' : '子'),
      status: initialData.status || 'living',
      fatherId: initialData.fatherId ?? null,
      fatherName: initialData.fatherName,
      branchId: chartId,
      spouses: initialData.spouses || [],
      biographyPage: 20 + ((initialData.generation || 1) - 1) * 3,
      biographyOrder: chartPersons.length + 1,
    };
    addPersonStore(
      activeProjectId,
      chartId,
      newPerson,
      chartName,
      effectiveSurname
    );
  };

  const handleAddPersonSubmit = (personData: Partial<PersonRecord>) => {
    if (!chartId) return;
    const newId = `person-${Date.now()}`;
    const siblingCount = personData.fatherId
      ? chartPersons.filter((p) => p.fatherId === personData.fatherId).length
      : 0;
    const newPerson: PersonRecord = {
      id: newId,
      name: personData.name || '新录族人',
      courtesyName: personData.courtesyName,
      generation: personData.generation || 1,
      generationWord: personData.generationWord,
      rank: personData.rank,
      siblingOrder: personData.fatherId ? siblingCount + 1 : undefined,
      gender: personData.gender || 'male',
      status: personData.status || 'deceased',
      fatherId: personData.fatherId ?? null,
      fatherName: personData.fatherName,
      spouses: personData.spouses || [],
      birthDate: personData.birthDate,
      officialTitle: personData.officialTitle,
      burialPlace: personData.burialPlace,
      biography: personData.biography,
      birth: personData.birthDate ? { date: personData.birthDate } : undefined,
      career: personData.officialTitle
        ? { title: personData.officialTitle }
        : undefined,
      death: personData.burialPlace
        ? { burialPlace: personData.burialPlace }
        : undefined,
      branchId: chartId,
      biographyPage: 20 + ((personData.generation || 1) - 1) * 3,
      biographyOrder: chartPersons.length + 1,
    };
    addPersonStore(
      activeProjectId,
      chartId,
      newPerson,
      chartName,
      effectiveSurname
    );
  };

  const handleUpdatePersonFather = (
    childId: string,
    fatherId: string | null
  ) => {
    const father = chartPersons.find((p) => p.id === fatherId);
    handleUpdatePerson(childId, {
      fatherId,
      fatherName: father?.name,
      generation: father ? father.generation + 1 : 1,
    });
  };

  const config = SECTION_CONFIG[section];
  const Icon = config.icon;

  // Interactive Genealogy Canvas Workspace when viewing a lineage chart
  if (section === 'lineage' && selectedLineageNode?.type !== 'folder') {
    return (
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-background">
        {/* Main Content & Right Resizable Inspector */}
        <div className="flex-1 flex overflow-hidden relative">
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-muted/10">
            {viewMode === 'tree' && (
              <LineageTreeView
                persons={chartPersons}
                selectedPersonId={selectedPerson?.id ?? null}
                branchTitle={chartName}
                clanSurname={effectiveSurname}
                onSelectPerson={handleSelectPerson}
                onAddChild={handleOpenAddChild}
                onAddSpouse={handleOpenAddSpouse}
                onDeletePerson={handleDeletePerson}
                onAddPersonDirectly={handleAddPersonDirectly}
                onUpdatePersonFather={handleUpdatePersonFather}
              />
            )}
            {viewMode === 'grid' && (
              <LineageGridView
                persons={chartPersons}
                selectedPersonId={selectedPerson?.id ?? null}
                clanSurname={effectiveSurname}
                onSelectPerson={handleSelectPerson}
                onAddChild={handleOpenAddChild}
              />
            )}
            {viewMode === 'table' && (
              <LineageTableView
                persons={chartPersons}
                selectedPersonId={selectedPerson?.id ?? null}
                clanSurname={effectiveSurname}
                onSelectPerson={handleSelectPerson}
                onAddPerson={() => {
                  setAddDialogParent(null);
                  setIsAddDialogOpen(true);
                }}
                onDeletePerson={handleDeletePerson}
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
                drawerMode={drawerMode}
                onChangeDrawerMode={handleChangeDrawerMode}
                previewPrefs={previewPrefs}
                onUpdatePreviewPrefs={updatePreviewPrefs}
                onUpdatePerson={handleUpdatePerson}
                onDeletePerson={handleDeletePerson}
                onAddChild={handleOpenAddChild}
                onSelectPerson={handleSelectPerson}
                onReorderSibling={handleReorderSibling}
                width={inspectorWidth}
                onClose={() => handleSelectPerson(null)}
              />
            </>
          )}
        </div>

        {/* Add Person Modal */}
        <AddPersonDialog
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onAdd={handleAddPersonSubmit}
          parentPerson={addDialogParent}
          existingPersons={chartPersons}
          branchId={chartId}
          clanSurname={effectiveSurname}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-7 space-y-6">
        {/* Top Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl border border-border bg-[hsl(var(--surface-subtle))] flex items-center justify-center text-primary shrink-0">
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-[19px] font-semibold text-foreground tracking-tight truncate">
                  {section === 'lineage' && selectedLineageNode
                    ? selectedLineageNode.data?.name || config.title
                    : config.title}
                </h1>
                <span className="text-[12px] text-muted-foreground truncate">
                  {activeProject?.primaryName || activeProject?.name}
                </span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {config.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/projects/${activeProjectId}`)}
              className="h-8 gap-1.5 text-[13px] whitespace-nowrap"
            >
              <ArrowLeft size={14} /> 返回工作台概览
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/projects/${activeProjectId}/settings`)}
              className="h-8 gap-1.5 text-[13px] whitespace-nowrap"
            >
              <Settings size={14} /> 项目设置
            </Button>
          </div>
        </div>

        {/* Main Section Content */}
        {section === 'lineage' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
                <FolderOpen size={16} className="text-amber-500" />
                <span>{selectedLineageNode?.data?.name}</span>
                <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
                  ({selectedLineageNode?.children?.length || 0} 份世系图)
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  selectedLineageNode &&
                  addChart(activeProjectId, String(selectedLineageNode.id))
                }
                className="h-8 gap-1.5 text-[13px]"
              >
                <Plus size={14} /> 新增世系图
              </Button>
            </div>

            {selectedLineageNode?.children?.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedLineageNode.children.map((child) => (
                  <button
                    key={String(child.id)}
                    type="button"
                    onClick={() =>
                      selectNode(activeProjectId, String(child.id))
                    }
                    className="flex items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card hover:border-[hsl(var(--border-strong))] hover:shadow-[var(--shadow-card-hover)] transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border flex items-center justify-center text-primary shrink-0">
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
                  该分组下暂无世系图，可直接点击上方「新增世系图」或从左侧拖拽节点移入。
                </p>
              </div>
            )}
          </div>
        ) : section === 'books' ? (
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
            <div className="rounded-xl border border-border bg-[hsl(var(--surface-subtle))] p-6 flex flex-col items-center justify-center">
              <GenealogyBookPreview
                projectName={activeProject?.name || '云谱项目'}
                primaryName={activeProject?.primaryName || ''}
                primarySurname={activeProject?.primarySurname || ''}
                region={activeProject?.region || ''}
                projectState={activeProject?.projectState || '0'}
                projectLevel={activeProject?.projectLevel || 1}
                colorTheme={activeProject?.colorTheme || 'sky'}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="space-y-1">
                <h2 className="text-[15px] font-semibold text-foreground">
                  {config.emptyTitle}
                </h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {config.emptyDesc}
                </p>
              </div>

              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {config.outlineItems.map((item, idx) => (
                  <div
                    key={item.name}
                    className="px-4 py-3 flex items-start justify-between gap-4 bg-background"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-[13px] font-semibold text-foreground">
                        0{idx + 1}. {item.name}
                      </div>
                      <div className="text-[12px] text-muted-foreground">
                        {item.desc}
                      </div>
                    </div>
                    <span className="text-[12px] text-muted-foreground whitespace-nowrap shrink-0">
                      占位规划
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 space-y-6">
            <div className="max-w-xl mx-auto text-center space-y-2">
              <div className="w-11 h-11 rounded-xl bg-[hsl(var(--surface-subtle))] border border-border mx-auto flex items-center justify-center text-primary">
                <Icon size={20} />
              </div>
              <h2 className="text-[16px] font-semibold text-foreground">
                {config.emptyTitle}
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                {config.emptyDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {config.outlineItems.map((item, idx) => (
                <div
                  key={item.name}
                  className="rounded-lg border border-border bg-card p-4 space-y-1.5"
                >
                  <div className="text-[13px] font-semibold text-foreground">
                    0{idx + 1}. {item.name}
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenealogySectionPage;
