import React, { useEffect, useState } from 'react';
import { PersonRecord } from '../types';
import {
  Search,
  Plus,
  Heart,
  MapPin,
  Award,
  Trash2,
  Edit3,
  Printer,
  Check,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatGivenName } from '../utils/nameUtils';

interface LineageTableViewProps {
  persons: PersonRecord[];
  selectedPersonId: string | null;
  clanSurname?: string;
  onSelectPerson: (id: string) => void;
  onAddPerson: () => void;
  onDeletePerson: (id: string) => void;
}

export const LineageTableView: React.FC<LineageTableViewProps> = ({
  persons,
  selectedPersonId,
  clanSurname = '',
  onSelectPerson,
  onAddPerson,
  onDeletePerson,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [genFilter, setGenFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 2500);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const maxGen = Math.max(...persons.map((p) => p.generation || 1), 1);

  const filteredPersons = persons.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.courtesyName &&
        p.courtesyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.officialTitle &&
        p.officialTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.burialPlace &&
        p.burialPlace.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesGen =
      genFilter === 'all' || p.generation.toString() === genFilter;
    return matchesSearch && matchesGen;
  });

  return (
    <div className="w-full h-full flex flex-col bg-background p-6 overflow-hidden select-none">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground font-serif">
            宗谱族人名录总表
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            全量谱系人员结构化档案明细，支持跨世代、字号、功名及墓葬方位检索。
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索族人姓名/字号/官阶/葬地..."
              className="h-8 pl-8 text-xs bg-muted/30"
            />
          </div>

          <select
            value={genFilter}
            onChange={(e) => setGenFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">全部世次</option>
            {Array.from({ length: maxGen }, (_, i) => i + 1).map((g) => (
              <option key={g} value={String(g)}>
                第{g}世{g === 1 ? ' (始祖)' : ''}
              </option>
            ))}
          </select>

          <Button size="sm" className="h-8 text-xs" onClick={onAddPerson}>
            <Plus size={14} className="mr-1" /> 新增族人
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 border border-border rounded-xl bg-card overflow-auto shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-muted/50 border-b border-border sticky top-0 z-10 text-muted-foreground font-semibold">
            <tr>
              <th className="py-3 px-4 w-20">世次</th>
              <th className="py-3 px-4 w-32">姓名 / 字号</th>
              <th className="py-3 px-4 w-20">排行</th>
              <th className="py-3 px-4 w-28">承祧父祖</th>
              <th className="py-3 px-4 w-36">配偶</th>
              <th className="py-3 px-4 w-44">功名官阶</th>
              <th className="py-3 px-4 min-w-[200px]">生平与行状纪略</th>
              <th className="py-3 px-4 w-44">墓茔坐向</th>
              <th className="py-3 px-4 w-20 text-center">状态</th>
              <th className="py-3 px-4 w-24 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredPersons.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-12 text-center text-muted-foreground"
                >
                  未匹配到族人记录
                </td>
              </tr>
            ) : (
              filteredPersons.map((p) => {
                const isSelected = p.id === selectedPersonId;
                const isConfirming = confirmDeleteId === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectPerson(p.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-primary/10 text-foreground font-medium'
                        : 'hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-foreground tabular-nums">
                      第{p.generation}世
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground text-sm font-serif">
                        {formatGivenName(p.name, clanSurname)}
                      </div>
                      {p.courtesyName && (
                        <div className="text-[11px] text-muted-foreground">
                          字 {p.courtesyName}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">{p.rank || '男'}</td>
                    <td className="py-3 px-4">
                      {p.fatherName
                        ? `${formatGivenName(p.fatherName, clanSurname)} 公`
                        : p.generation === 1
                        ? '始迁祖'
                        : '待考'}
                    </td>
                    <td className="py-3 px-4">
                      {p.spouses && p.spouses.length > 0 ? (
                        <div className="flex items-center gap-1 text-foreground">
                          <Heart
                            size={11}
                            className="text-rose-500 shrink-0"
                          />
                          <span>{p.spouses.map((s) => s.name).join('、')}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">待注</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {p.officialTitle ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                          <Award size={12} className="shrink-0" />
                          {p.officialTitle}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="line-clamp-2 max-w-md text-[11px] leading-relaxed">
                        {p.biography ||
                          (p.birthDate
                            ? `生于：${p.birthDate}`
                            : '暂无详细事略')}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {p.burialPlace ? (
                        <div className="flex items-center gap-1 text-[11px] truncate max-w-[180px]">
                          <MapPin
                            size={11}
                            className="shrink-0 text-muted-foreground"
                          />
                          <span className="truncate">{p.burialPlace}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[11px] font-medium ${
                          p.status === 'living'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {p.status === 'living' ? '健在' : '已故'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => onSelectPerson(p.id)}
                          title="编辑档案"
                        >
                          <Edit3 size={13} />
                        </Button>
                        {p.generation > 1 && (
                          <Button
                            variant={isConfirming ? 'destructive' : 'ghost'}
                            size={isConfirming ? 'sm' : 'icon'}
                            className={
                              isConfirming
                                ? 'h-7 px-2 text-[11px]'
                                : 'h-7 w-7 text-muted-foreground hover:text-destructive'
                            }
                            onClick={() => {
                              if (isConfirming) {
                                setConfirmDeleteId(null);
                                onDeletePerson(p.id);
                              } else {
                                setConfirmDeleteId(p.id);
                              }
                            }}
                            title={isConfirming ? '确认删除' : '删除'}
                          >
                            {isConfirming ? (
                              <>
                                <Check size={12} className="mr-0.5" /> 删
                              </>
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 shrink-0 tabular-nums">
        <span>
          当前显示 {filteredPersons.length} 条记录 / 总计 {persons.length} 位族人
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => window.print()}
        >
          <Printer size={12} className="mr-1" /> 打印名录
        </Button>
      </div>
    </div>
  );
};
