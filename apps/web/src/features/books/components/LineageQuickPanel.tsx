import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  GitFork,
  Search,
  UserCheck,
} from 'lucide-react';
import { collectTreeNodesByType } from '../../../lib/treeOps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActiveProject } from '../../../hooks/useActiveProject';
import { useProjectLineageSnapshot } from '../../lineage/queries';
import type { PersonRecord } from '../../lineage/types';
import { getLineageGraph } from '../../lineage/domain/lineageGraph';
import {
  computeAutoRankLabel,
  formatPersonAliases,
} from '../../lineage/utils/personHelpers';
import { resolveChartPersons, toChineseNumeral } from '../bookCompiler';

export interface SelectedLineageMember {
  chartId: string;
  chartName: string;
  person: PersonRecord;
}

interface LineageQuickPanelProps {
  mode: 'browse' | 'select';
  initialChartId?: string;
  selectedMemberId?: string;
  onSelectMember?: (member: SelectedLineageMember) => void;
  className?: string;
}

export const LineageQuickPanel: React.FC<LineageQuickPanelProps> = ({
  mode,
  initialChartId,
  selectedMemberId,
  onSelectMember,
  className = '',
}) => {
  const {
    projectId: activeProjectId,
    project: activeProject,
    surname: projectSurname,
  } = useActiveProject();

  const { lineageTree, personsByChart } = useProjectLineageSnapshot(activeProjectId);

  const chartOptions = useMemo(
    () =>
      collectTreeNodesByType(lineageTree, 'chart').map((item) => ({
        id: String(item.id),
        name: item.data?.name || String(item.id),
      })),
    [lineageTree]
  );

  const [chartId, setChartId] = useState<string>(
    () => initialChartId || chartOptions[0]?.id || ''
  );

  const activeChartId = useMemo(() => {
    if (chartId && chartOptions.some((c) => c.id === chartId)) {
      return chartId;
    }
    return chartOptions[0]?.id || '';
  }, [chartId, chartOptions]);

  const { chartName, persons } = useMemo(() => {
    if (!activeChartId) {
      return { chartName: '暂无谱系图', persons: [] as PersonRecord[] };
    }
    return resolveChartPersons(
      activeProjectId,
      activeChartId,
      lineageTree,
      personsByChart,
      projectSurname || undefined
    );
  }, [
    activeProjectId,
    activeChartId,
    lineageTree,
    personsByChart,
    projectSurname,
  ]);

  const [genFilter, setGenFilter] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [appliedGen, setAppliedGen] = useState('');
  const [appliedName, setAppliedName] = useState('');
  const [focusedPersonId, setFocusedPersonId] = useState<string>(
    selectedMemberId || ''
  );
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  const graphIndex = useMemo(() => getLineageGraph(persons), [persons]);
  const personMap = graphIndex.personById;
  const childrenMap = graphIndex.childrenByFatherId;

  const rootPersons = useMemo(
    () =>
      persons.filter(
        (p) =>
          !p.spouseOfId &&
          (!p.fatherId || !personMap.has(p.fatherId)) &&
          (!p.motherId || !personMap.has(p.motherId))
      ),
    [persons, personMap]
  );

  const filteredRows = useMemo(() => {
    const genNum = Number(appliedGen.trim());
    const q = appliedName.trim().toLowerCase();
    return persons.filter((p) => {
      if (appliedGen.trim() && Number.isFinite(genNum) && genNum > 0) {
        if (p.generation !== genNum) return false;
      }
      if (q) {
        const rankLabel = computeAutoRankLabel(p, persons);
        const fullText = `${p.name} ${formatPersonAliases(p)} ${rankLabel}`.toLowerCase();
        if (!fullText.includes(q)) return false;
      }
      return true;
    });
  }, [persons, appliedGen, appliedName]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedGen(genFilter);
    setAppliedName(nameQuery);
  };

  const toggleExpand = (id: string) => {
    setCollapsedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePickPerson = (person: PersonRecord) => {
    setFocusedPersonId(person.id);
    if (onSelectMember && activeChartId) {
      onSelectMember({
        chartId: activeChartId,
        chartName,
        person,
      });
    }
  };

  const expandAncestors = (person: PersonRecord) => {
    const updates: Record<string, boolean> = {};
    let curr: PersonRecord | undefined = person;
    const guard = new Set<string>();
    while (curr) {
      const parentId =
        curr.fatherId && personMap.has(curr.fatherId)
          ? curr.fatherId
          : curr.motherId && personMap.has(curr.motherId)
            ? curr.motherId
            : undefined;
      if (!parentId || guard.has(parentId)) break;
      guard.add(parentId);
      updates[parentId] = false;
      curr = personMap.get(parentId);
    }
    setCollapsedIds((prev) => ({ ...prev, ...updates }));
    setFocusedPersonId(person.id);
  };

  const renderTreeNodes = (
    list: PersonRecord[],
    depth: number,
    visited: Set<string>
  ): React.ReactNode => {
    return list.map((p) => {
      if (visited.has(p.id)) return null;
      const nextVisited = new Set(visited);
      nextVisited.add(p.id);
      const kids = childrenMap.get(p.id) || [];
      const hasKids = kids.length > 0;
      const isCollapsed = Boolean(collapsedIds[p.id]);
      const isSelected = (selectedMemberId || focusedPersonId) === p.id;

      return (
        <div key={p.id}>
          <div
            onClick={() => handlePickPerson(p)}
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            className={`flex items-center gap-1.5 py-1 pr-2 rounded-md text-[12px] cursor-pointer transition-colors ${
              isSelected
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-foreground/85 hover:bg-muted/70'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (hasKids) toggleExpand(p.id);
              }}
              className={`w-4 h-4 flex items-center justify-center rounded text-muted-foreground shrink-0 ${
                hasKids ? 'hover:text-foreground cursor-pointer' : 'opacity-0 pointer-events-none'
              }`}
              aria-label={isCollapsed ? '展开后裔' : '收起后裔'}
            >
              {isCollapsed ? (
                <ChevronRight size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
            </button>
            <span className="text-[11px] text-primary/85 font-medium shrink-0 tabular-nums">
              [{toChineseNumeral(p.generation)}世]
            </span>
            <span className="truncate">{p.name}</span>
            {(() => {
              const rankLabel = computeAutoRankLabel(p, persons);
              return rankLabel ? (
                <span className="text-[11px] text-muted-foreground truncate ml-auto">
                  {rankLabel}
                </span>
              ) : null;
            })()}
          </div>
          {hasKids && !isCollapsed && renderTreeNodes(kids, depth + 1, nextVisited)}
        </div>
      );
    });
  };

  return (
    <div
      className={`flex flex-col h-full min-h-0 bg-card border border-border rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-border bg-[var(--surface-subtle)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <GitFork size={14} className="text-primary shrink-0" />
          <span className="text-[13px] font-semibold text-foreground truncate">
            谱系信息
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground truncate">
          家族：{activeProject?.name || '本族'}
        </span>
      </div>

      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="p-3 border-b border-border space-y-2.5 shrink-0 bg-background"
      >
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-muted-foreground shrink-0 w-10">
            谱系表
          </label>
          <select
            value={activeChartId}
            onChange={(e) => {
              setChartId(e.target.value);
              setFocusedPersonId('');
            }}
            className="flex-1 min-w-0 h-8 rounded-md border border-input bg-card px-2.5 text-[12px] text-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)]"
          >
            {chartOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={1}
            placeholder="世数"
            value={genFilter}
            onChange={(e) => {
              setGenFilter(e.target.value);
              setAppliedGen(e.target.value);
            }}
            className="w-16 h-8 text-[12px] px-2 tabular-nums"
          />
          <Input
            type="text"
            placeholder="输入族丁名字"
            value={nameQuery}
            onChange={(e) => {
              setNameQuery(e.target.value);
              setAppliedName(e.target.value);
            }}
            className="flex-1 min-w-0 h-8 text-[12px] px-2.5"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8 px-2.5 gap-1 text-[12px] shrink-0 whitespace-nowrap"
          >
            <Search size={12} />
            <span>搜索</span>
          </Button>
        </div>
      </form>

      {/* Upper Tree + Lower Search Results Split */}
      <div className="flex-1 min-h-0 flex flex-col divide-y divide-border overflow-hidden">
        {/* Hierarchical Lineage Tree */}
        <div className="flex-1 min-h-[140px] overflow-y-auto p-2 space-y-0.5 bg-background/40">
          {rootPersons.length > 0 ? (
            renderTreeNodes(rootPersons, 0, new Set())
          ) : (
            <div className="h-full flex items-center justify-center text-[12px] text-muted-foreground py-6">
              该谱系表暂无族丁记录
            </div>
          )}
        </div>

        {/* Search Result Grid */}
        <div className="h-[190px] shrink-0 flex flex-col bg-card overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border bg-[var(--surface-subtle)] flex items-center justify-between text-[12px] font-medium text-muted-foreground shrink-0">
            <span>族丁检索结果</span>
            <span className="font-mono tabular-nums">{filteredRows.length} 人</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {filteredRows.length > 0 ? (
              <table className="w-full text-[12px] border-collapse">
                <thead className="sticky top-0 bg-card border-b border-border text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium py-1.5 px-2.5">世数</th>
                    <th className="text-left font-medium py-1.5 px-2">名字</th>
                    <th className="text-left font-medium py-1.5 px-2">父亲</th>
                    <th className="text-left font-medium py-1.5 px-2">祖父</th>
                    <th className="text-right font-medium py-1.5 px-2.5">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRows.slice(0, 60).map((p) => {
                    const father = p.fatherId
                      ? personMap.get(p.fatherId)
                      : undefined;
                    const grandfather = father?.fatherId
                      ? personMap.get(father.fatherId)
                      : undefined;
                    const isSelected =
                      (selectedMemberId || focusedPersonId) === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handlePickPerson(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/10'
                            : 'hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
                          第{toChineseNumeral(p.generation)}世
                        </td>
                        <td className="py-1.5 px-2 font-medium text-foreground whitespace-nowrap">
                          {p.name}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                          {father?.name || '—'}
                        </td>
                        <td className="py-1.5 px-2 text-muted-foreground whitespace-nowrap">
                          {grandfather?.name || '—'}
                        </td>
                        <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                          {mode === 'select' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePickPerson(p);
                              }}
                              className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium cursor-pointer"
                            >
                              <UserCheck size={11} />
                              <span>选择</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                expandAncestors(p);
                              }}
                              className="text-primary hover:underline font-medium cursor-pointer"
                            >
                              定位
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex items-center justify-center text-[12px] text-muted-foreground">
                未找到匹配的族丁
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
