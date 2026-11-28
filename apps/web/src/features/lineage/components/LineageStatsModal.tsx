import React, { useMemo, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { findItemDeep } from '../../../components/common/Tree/utilities';
import { ModalShell } from '@/components/ui/modal';
import { cn } from '../../../lib/utils';
import {
  findFirstChartId,
  makeChartStorageKey,
  useLineageStore,
} from '../../../store/useLineageStore';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { useProjectLineageSnapshot } from '../queries';
import {
  computeLineageStats,
  flattenChartsInTree,
  formatStatPct,
} from '../utils/lineageStats';

export type StatsScope = 'chart' | 'project';

interface LineageStatsModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
}

export const LineageStatsModal: React.FC<LineageStatsModalProps> = ({
  open,
  projectId,
  onClose,
}) => {
  const [scope, setScope] = useState<StatsScope>('chart');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const projects = useWorkspaceStore((s) => s.projects);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { lineageTree, personsByChart } = useProjectLineageSnapshot(projectId);
  const selectedNodeIdByProject = useLineageStore(
    (s) => s.selectedNodeIdByProject
  );

  const activeProject =
    projects.find((p) => p.id === projectId) ||
    projects.find((p) => p.organizationId === activeWorkspaceId) ||
    projects[0];

  const allCharts = useMemo(
    () => flattenChartsInTree(lineageTree),
    [lineageTree]
  );

  const defaultChartId = useMemo(
    () =>
      findFirstChartId(lineageTree) ||
      String(allCharts[0]?.chartId || ''),
    [lineageTree, allCharts]
  );

  const selectedNodeId = selectedNodeIdByProject[projectId] ?? defaultChartId;
  const selectedNode = useMemo(
    () => findItemDeep(lineageTree, selectedNodeId),
    [lineageTree, selectedNodeId]
  );

  const activeChart = useMemo(() => {
    if (selectedNode?.type === 'chart') {
      return (
        allCharts.find((c) => c.chartId === String(selectedNode.id)) || {
          chartId: String(selectedNode.id),
          chartName: selectedNode.data?.name || '谱系图谱',
          index: 1,
        }
      );
    }
    return (
      allCharts.find((c) => c.chartId === defaultChartId) ||
      allCharts[0] || {
        chartId: defaultChartId,
        chartName: '谱系图谱',
        index: 1,
      }
    );
  }, [selectedNode, allCharts, defaultChartId]);

  const stats = useMemo(() => {
    if (scope === 'chart') {
      const key = makeChartStorageKey(projectId, activeChart.chartId);
      const persons = activeChart.chartId ? (personsByChart[key] ?? []) : [];
      return computeLineageStats(persons, activeChart.chartId ? 1 : 0);
    }

    const allPersons = allCharts.flatMap((chart) => {
      const key = makeChartStorageKey(projectId, chart.chartId);
      return personsByChart[key] ?? [];
    });
    return computeLineageStats(allPersons, allCharts.length);
  }, [
    scope,
    projectId,
    activeChart,
    allCharts,
    personsByChart,
  ]);

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      zIndexClass="z-[110]"
      ariaLabel="深度统计图表"
      className={cn(
        'bg-background transition-all duration-150',
        isFullscreen
          ? 'w-full h-[96vh] max-w-none max-h-[96vh]'
          : 'w-full max-w-[1160px] max-h-[92vh]'
      )}
    >
      {/* Modal Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--surface-active)] text-primary text-[12px] font-semibold border border-primary/25 whitespace-nowrap shrink-0">
            {scope === 'chart' ? '谱系' : '宗谱'}
          </span>
          <span className="text-[14px] font-semibold text-foreground font-mono tabular-nums whitespace-nowrap shrink-0">
            {scope === 'chart'
              ? `第 ${activeChart.index} 卷`
              : `${stats.chartCount} 卷`}
          </span>
          <span className="text-border select-none" aria-hidden="true">
            |
          </span>
          <h2 className="text-[15px] font-semibold text-foreground truncate">
            深度统计图表 · 男丁女丁与婚嫁分析
            {scope === 'chart' && activeChart.chartName
              ? `（${activeChart.chartName}）`
              : activeProject?.name
                ? `（${activeProject.name}）`
                : ''}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Scope Toggle: Current Chart vs Whole Project */}
          <div
            role="tablist"
            aria-label="统计范围"
            className="flex items-center gap-0.5 p-0.5 rounded-md bg-[var(--surface-subtle)] border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'chart'}
              onClick={() => setScope('chart')}
              className={cn(
                'h-7 px-2.5 rounded text-[12px] transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                scope === 'chart'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/60'
                  : 'text-muted-foreground font-medium hover:text-foreground'
              )}
            >
              当前谱系图
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scope === 'project'}
              onClick={() => setScope('project')}
              className={cn(
                'h-7 px-2.5 rounded text-[12px] transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                scope === 'project'
                  ? 'bg-card text-foreground font-semibold shadow-xs border border-border/60'
                  : 'text-muted-foreground font-medium hover:text-foreground'
              )}
            >
              整本宗谱
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? '还原窗口' : '全屏查看'}
            aria-label={isFullscreen ? '还原窗口' : '全屏查看'}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="关闭"
            aria-label="关闭统计弹窗"
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[var(--surface-subtle)]/50">
        {/* Row 1: 5 KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Entered Persons */}
          <div className="col-span-2 sm:col-span-1 rounded-xl border border-primary/25 bg-primary/[0.08] p-4 flex flex-col justify-between min-h-[124px]">
            <div className="text-[13px] font-semibold text-primary">
              录入总人数
            </div>
            <div className="text-[28px] leading-none font-bold text-primary font-mono tabular-nums mt-3">
              {stats.totalPersons}
            </div>
          </div>

          {/* Card 2: Male Count */}
          <div className="rounded-xl border border-border border-t-2 border-t-lineage-male bg-card p-3.5 flex flex-col justify-between min-h-[124px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-foreground truncate">
                男性人数（人）
              </span>
              <span className="px-1.5 py-0.5 rounded bg-lineage-male/12 text-lineage-male-fg text-[12px] font-medium font-mono tabular-nums shrink-0">
                {formatStatPct(stats.allMaleCount, stats.totalPersons, 2)}
              </span>
            </div>
            <div className="text-[24px] leading-tight font-bold text-foreground font-mono tabular-nums my-2">
              {stats.allMaleCount}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[12px] text-muted-foreground tabular-nums">
              <span>
                健在{' '}
                <strong className="text-foreground font-mono">
                  {stats.allMaleLiving}
                </strong>
              </span>
              <span>
                已故{' '}
                <strong className="text-foreground font-mono">
                  {stats.allMaleDeceased}
                </strong>
              </span>
            </div>
          </div>

          {/* Card 3: Female Count */}
          <div className="rounded-xl border border-border border-t-2 border-t-lineage-female bg-card p-3.5 flex flex-col justify-between min-h-[124px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-foreground truncate">
                女性人数（人）
              </span>
              <span className="px-1.5 py-0.5 rounded bg-lineage-female/12 text-lineage-female-fg text-[12px] font-medium font-mono tabular-nums shrink-0">
                {formatStatPct(stats.allFemaleCount, stats.totalPersons, 2)}
              </span>
            </div>
            <div className="text-[24px] leading-tight font-bold text-foreground font-mono tabular-nums my-2">
              {stats.allFemaleCount}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[12px] text-muted-foreground tabular-nums">
              <span>
                健在{' '}
                <strong className="text-foreground font-mono">
                  {stats.allFemaleLiving}
                </strong>
              </span>
              <span>
                已故{' '}
                <strong className="text-foreground font-mono">
                  {stats.allFemaleDeceased}
                </strong>
              </span>
            </div>
          </div>

          {/* Card 4: Living Count */}
          <div className="rounded-xl border border-border border-t-2 border-t-lineage-living bg-card p-3.5 flex flex-col justify-between min-h-[124px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-foreground truncate">
                健在人数（人）
              </span>
              <span className="px-1.5 py-0.5 rounded bg-lineage-living/12 text-lineage-living-fg text-[12px] font-medium font-mono tabular-nums shrink-0">
                {formatStatPct(stats.livingCount, stats.totalPersons, 2)}
              </span>
            </div>
            <div className="text-[24px] leading-tight font-bold text-foreground font-mono tabular-nums my-2">
              {stats.livingCount}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[12px] text-muted-foreground tabular-nums">
              <span>
                男性{' '}
                <strong className="text-foreground font-mono">
                  {stats.allMaleLiving}
                </strong>
              </span>
              <span>
                女性{' '}
                <strong className="text-foreground font-mono">
                  {stats.allFemaleLiving}
                </strong>
              </span>
            </div>
          </div>

          {/* Card 5: Deceased Count */}
          <div className="rounded-xl border border-border border-t-2 border-t-lineage-unknown bg-card p-3.5 flex flex-col justify-between min-h-[124px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-foreground truncate">
                已故人数（人）
              </span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[12px] font-medium font-mono tabular-nums shrink-0">
                {formatStatPct(stats.deceasedCount, stats.totalPersons, 2)}
              </span>
            </div>
            <div className="text-[24px] leading-tight font-bold text-foreground font-mono tabular-nums my-2">
              {stats.deceasedCount}
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[12px] text-muted-foreground tabular-nums">
              <span>
                男性{' '}
                <strong className="text-foreground font-mono">
                  {stats.allMaleDeceased}
                </strong>
              </span>
              <span>
                女性{' '}
                <strong className="text-foreground font-mono">
                  {stats.allFemaleDeceased}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Male & Female Lineage Member Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Male Lineage Analysis */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-lineage-male shrink-0" />
              <h3 className="text-[14px] font-semibold text-foreground">
                男丁分析（非配偶节点男性）
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
              <div className="rounded-lg bg-lineage-male/[0.08] dark:bg-lineage-male/[0.12] border border-lineage-male/22 p-4 flex flex-col justify-between min-h-[132px]">
                <div className="text-[12px] font-semibold text-lineage-male-fg">
                  男丁总数（人）
                </div>
                <div className="text-[24px] font-bold text-lineage-male-fg font-mono tabular-nums">
                  {stats.maleCount}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <SubMetricTile
                  label="健在男丁"
                  value={stats.maleLiving}
                  pct={formatStatPct(stats.maleLiving, stats.maleCount, 2)}
                />
                <SubMetricTile
                  label="已故男丁"
                  value={stats.maleDeceased}
                  pct={formatStatPct(stats.maleDeceased, stats.maleCount, 2)}
                />
                <SubMetricTile
                  label="健在已婚"
                  value={stats.maleLivingMarried}
                  pct={formatStatPct(
                    stats.maleLivingMarried,
                    stats.maleCount,
                    2
                  )}
                />
                <SubMetricTile
                  label="健在未婚"
                  value={stats.maleLivingUnmarried}
                  pct={formatStatPct(
                    stats.maleLivingUnmarried,
                    stats.maleCount,
                    2
                  )}
                />
              </div>
            </div>
          </section>

          {/* Female Lineage Analysis */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-lineage-female shrink-0" />
              <h3 className="text-[14px] font-semibold text-foreground">
                女丁分析（非配偶节点女性）
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
              <div className="rounded-lg bg-lineage-female/[0.08] dark:bg-lineage-female/[0.12] border border-lineage-female/22 p-4 flex flex-col justify-between min-h-[132px]">
                <div className="text-[12px] font-semibold text-lineage-female-fg">
                  女丁总数（人）
                </div>
                <div className="text-[24px] font-bold text-lineage-female-fg font-mono tabular-nums">
                  {stats.femaleCount}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <SubMetricTile
                  label="健在女丁"
                  value={stats.femaleLiving}
                  pct={formatStatPct(stats.femaleLiving, stats.femaleCount, 0)}
                />
                <SubMetricTile
                  label="已故女丁"
                  value={stats.femaleDeceased}
                  pct={formatStatPct(
                    stats.femaleDeceased,
                    stats.femaleCount,
                    0
                  )}
                />
                <SubMetricTile
                  label="健在已出嫁"
                  value={stats.femaleLivingMarried}
                  pct={formatStatPct(
                    stats.femaleLivingMarried,
                    stats.femaleCount,
                    0
                  )}
                />
                <SubMetricTile
                  label="健在未出嫁"
                  value={stats.femaleLivingUnmarried}
                  pct={formatStatPct(
                    stats.femaleLivingUnmarried,
                    stats.femaleCount,
                    0
                  )}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Row 3: Daughter-in-law & Son-in-law Spouse Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daughter-in-law Analysis */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-lineage-female shrink-0" />
              <h3 className="text-[14px] font-semibold text-foreground">
                儿媳分析（男丁配偶）
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
              <div className="rounded-lg bg-lineage-female/[0.08] dark:bg-lineage-female/[0.12] border border-lineage-female/22 p-4 flex flex-col justify-between min-h-[132px]">
                <div className="text-[12px] font-semibold text-lineage-female-fg">
                  儿媳总数（人）
                </div>
                <div className="text-[24px] font-bold text-lineage-female-fg font-mono tabular-nums">
                  {stats.daughterInLawCount}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 justify-between">
                <SubMetricTile
                  label="健在儿媳"
                  value={stats.daughterInLawLiving}
                  pct={formatStatPct(
                    stats.daughterInLawLiving,
                    stats.daughterInLawCount,
                    0
                  )}
                />
                <SubMetricTile
                  label="已故儿媳"
                  value={stats.daughterInLawDeceased}
                  pct={formatStatPct(
                    stats.daughterInLawDeceased,
                    stats.daughterInLawCount,
                    0
                  )}
                />
              </div>
            </div>
          </section>

          {/* Son-in-law Analysis */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-lineage-male shrink-0" />
              <h3 className="text-[14px] font-semibold text-foreground">
                女婿分析（女丁配偶）
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
              <div className="rounded-lg bg-lineage-male/[0.08] dark:bg-lineage-male/[0.12] border border-lineage-male/22 p-4 flex flex-col justify-between min-h-[132px]">
                <div className="text-[12px] font-semibold text-lineage-male-fg">
                  女婿总数（人）
                </div>
                <div className="text-[24px] font-bold text-lineage-male-fg font-mono tabular-nums">
                  {stats.sonInLawCount}
                </div>
              </div>

              <div className="flex flex-col gap-2.5 justify-between">
                <SubMetricTile
                  label="健在女婿"
                  value={stats.sonInLawLiving}
                  pct={formatStatPct(
                    stats.sonInLawLiving,
                    stats.sonInLawCount,
                    0
                  )}
                />
                <SubMetricTile
                  label="已故女婿"
                  value={stats.sonInLawDeceased}
                  pct={formatStatPct(
                    stats.sonInLawDeceased,
                    stats.sonInLawCount,
                    0
                  )}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </ModalShell>
  );
};

interface SubMetricTileProps {
  label: string;
  value: number;
  pct: string;
}

const SubMetricTile: React.FC<SubMetricTileProps> = ({ label, value, pct }) => (
  <div className="rounded-lg bg-[var(--surface-subtle)] border border-border/60 px-3.5 py-2.5 flex flex-col justify-between min-h-[64px]">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-muted-foreground truncate">{label}</span>
      <span className="px-1.5 py-0.5 rounded bg-card border border-border/60 text-[12px] font-medium text-muted-foreground font-mono tabular-nums shrink-0">
        {pct}
      </span>
    </div>
    <div className="text-[18px] font-bold text-foreground font-mono tabular-nums leading-tight mt-1">
      {value}
    </div>
  </div>
);
