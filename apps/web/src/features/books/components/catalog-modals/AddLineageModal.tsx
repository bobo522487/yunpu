import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitFork, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { findFirstTreeNodeByType } from '../../../../lib/treeOps';
import { useActiveProject } from '../../../../hooks/useActiveProject';
import { useProjectLineageSnapshot } from '../../../lineage/queries';
import { resolveChartPersons } from '../../bookCompiler';
import type {
  BookRecord,
  CatalogLineageNode,
  DescendantScope,
} from '../../types';
import { FishtailOrnament } from '../BookCoverThumb';
import { HelpTipButton } from '../HelpTipButton';
import {
  LineageQuickPanel,
  type SelectedLineageMember,
} from '../LineageQuickPanel';

interface MemberSearchModalProps {
  open: boolean;
  title: string;
  initialChartId?: string;
  onClose: () => void;
  onConfirm: (member: SelectedLineageMember) => void;
}

const MemberSearchModal: React.FC<MemberSearchModalProps> = ({
  open,
  title,
  initialChartId,
  onClose,
  onConfirm,
}) => {
  const [picked, setPicked] = useState<SelectedLineageMember | null>(null);

  useEffect(() => {
    if (open) setPicked(null);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[660px] h-[540px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <GitFork size={15} className="text-primary" />
            <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onClose}
          >
            <X size={15} />
          </Button>
        </div>

        <div className="flex-1 min-h-0 p-3 overflow-hidden">
          <LineageQuickPanel
            mode="select"
            initialChartId={initialChartId}
            selectedMemberId={picked?.person.id}
            onSelectMember={(m) => setPicked(m)}
            className="h-full"
          />
        </div>

        <div className="px-5 py-3 border-t border-border bg-[var(--surface-subtle)] flex items-center justify-between gap-3 shrink-0">
          <div className="text-[12px] text-muted-foreground truncate">
            {picked ? (
              <span>
                已选择：
                <strong className="text-foreground">
                  {picked.person.name}
                </strong>{' '}
                （第{picked.person.generation}世 · {picked.chartName}）
              </span>
            ) : (
              '请在上方树图或列表中点击选择一位族丁'
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!picked}
              onClick={() => {
                if (picked) onConfirm(picked);
              }}
            >
              确定选择
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

interface AddLineageModalProps {
  open: boolean;
  book: BookRecord;
  targetLabel: string;
  onClose: () => void;
  onSubmit: (payload: Omit<CatalogLineageNode, 'id' | 'nodeType'>) => void;
}

export const AddLineageModal: React.FC<AddLineageModalProps> = ({
  open,
  book,
  targetLabel,
  onClose,
  onSubmit,
}) => {
  const { projectId: activeProjectId, surname: projectSurname } =
    useActiveProject();
  const { lineageTree, personsByChart } = useProjectLineageSnapshot(activeProjectId);

  const [totalTitle, setTotalTitle] = useState('');
  const [eyebrowTitle, setEyebrowTitle] = useState('');
  const [chartId, setChartId] = useState('');
  const [chartName, setChartName] = useState('');
  const [startMemberId, setStartMemberId] = useState('');
  const [startMemberName, setStartMemberName] = useState('');
  const [descendantScope, setDescendantScope] =
    useState<DescendantScope>('all');
  const [endMemberId, setEndMemberId] = useState('');
  const [endMemberName, setEndMemberName] = useState('');
  const [maxGenerations, setMaxGenerations] = useState('5');
  const [error, setError] = useState('');

  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setError('');
    const tree = lineageTree;
    const firstChart = findFirstTreeNodeByType(tree, 'chart');
    if (firstChart) {
      const resolved = resolveChartPersons(
        activeProjectId,
        String(firstChart.id),
        tree,
        personsByChart,
        projectSurname || undefined,
      );
      const root =
        resolved.persons.find((p) => p.generation === 1 && !p.fatherId) ||
        resolved.persons[0];
      setChartId(String(firstChart.id));
      setChartName(resolved.chartName);
      setStartMemberId(root?.id || '');
      setStartMemberName(root?.name || '');
      setEyebrowTitle(`${resolved.chartName}谱系`);
    } else {
      setChartId('');
      setChartName('');
      setStartMemberId('');
      setStartMemberName('');
      setEyebrowTitle('');
    }
    setTotalTitle(book.bookName);
    setDescendantScope('all');
    setEndMemberId('');
    setEndMemberName('');
    setMaxGenerations('5');
  }, [
    open,
    projectSurname,
    book.bookName,
    lineageTree,
    personsByChart,
  ]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eyebrowTitle.trim()) {
      setError('请填写谱系谱眉名');
      return;
    }
    if (!startMemberId) {
      setError('请选择起始族丁');
      return;
    }
    if (
      (descendantScope === 'member' || descendantScope === 'member_inclusive') &&
      !endMemberId
    ) {
      setError('请选择结束族丁');
      return;
    }

    onSubmit({
      totalTitle: totalTitle.trim() || book.bookName,
      eyebrowTitle: eyebrowTitle.trim(),
      chartId,
      chartName,
      startMemberId,
      startMemberName,
      descendantScope,
      endMemberId:
        descendantScope === 'member' || descendantScope === 'member_inclusive'
          ? endMemberId
          : undefined,
      endMemberName:
        descendantScope === 'member' || descendantScope === 'member_inclusive'
          ? endMemberName
          : undefined,
      maxGenerations:
        descendantScope === 'generations'
          ? Math.max(1, Number(maxGenerations) || 5)
          : undefined,
      indexConfig: { enabled: true, inToc: true, tocTitle: '族丁检索表' },
      diaoxianConfig: { enabled: true, inToc: true, tocTitle: '吊线图' },
      shixiConfig: { enabled: true, inToc: true, tocTitle: '谱系表' },
    });
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[95] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-xs"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-[820px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <GitFork size={16} className="text-primary shrink-0" />
              <h3 className="text-[15px] font-semibold text-foreground truncate">
                添加谱系章节
              </h3>
              <span className="text-[12px] text-muted-foreground truncate">
                · {targetLabel}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onClose}
            >
              <X size={15} />
            </Button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex-1 min-h-0 flex flex-col overflow-hidden"
          >
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1.2fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border overflow-y-auto">
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="lineageTotalTitle"
                    className="flex items-center gap-1.5"
                  >
                    <span>总谱 || 分谱标题</span>
                    <HelpTipButton tipKey="lineage-total-title" />
                  </Label>
                  <Input
                    id="lineageTotalTitle"
                    value={totalTitle}
                    onChange={(e) => setTotalTitle(e.target.value)}
                    placeholder="选填，默认沿用谱书名称"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="lineageEyebrowTitle"
                    className="flex items-center gap-1.5"
                  >
                    <span>谱系谱眉名</span>
                    <span className="text-destructive">*</span>
                    <HelpTipButton tipKey="lineage-eyebrow" />
                  </Label>
                  <Input
                    id="lineageEyebrowTitle"
                    value={eyebrowTitle}
                    onChange={(e) => {
                      setEyebrowTitle(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="例如：主支谱系、长房分支谱系"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>起始族丁 *</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerTarget('start')}
                      className="flex-1 h-9 px-3 rounded-md border border-input bg-card text-left text-[13px] flex items-center justify-between hover:border-primary/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:shadow-[var(--shadow-focus-halo)] transition-all duration-150 cursor-pointer"
                    >
                      <span
                        className={
                          startMemberName
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                        }
                      >
                        {startMemberName
                          ? `${startMemberName}（${chartName}）`
                          : '点击选择起始族丁'}
                      </span>
                      <Search size={13} className="text-muted-foreground" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>支派后裔范围</Label>
                  <div className="space-y-2 text-[12px]">
                    {[
                      {
                        value: 'all' as DescendantScope,
                        label: '全部后代（纳入该支脉下所有后裔）',
                      },
                      {
                        value: 'member' as DescendantScope,
                        label: '指定结束族丁（不含该族丁及其后裔）',
                      },
                      {
                        value: 'member_inclusive' as DescendantScope,
                        label: '指定结束族丁（含该族丁但不含其子嗣）',
                      },
                      {
                        value: 'generations' as DescendantScope,
                        label: '指定结束世数（自起始族丁起连续若干世）',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 cursor-pointer text-foreground/90"
                      >
                        <input
                          type="radio"
                          name="descendantScope"
                          checked={descendantScope === opt.value}
                          onChange={() => setDescendantScope(opt.value)}
                          className="accent-[var(--primary)]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {(descendantScope === 'member' ||
                    descendantScope === 'member_inclusive') && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setPickerTarget('end')}
                        className="w-full h-8 px-3 rounded-md border border-input bg-card text-left text-[12px] flex items-center justify-between hover:border-primary/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:shadow-[var(--shadow-focus-halo)] transition-all duration-150 cursor-pointer"
                      >
                        <span
                          className={
                            endMemberName
                              ? 'text-foreground font-medium'
                              : 'text-muted-foreground'
                          }
                        >
                          {endMemberName || '点击选择结束族丁'}
                        </span>
                        <Search size={12} className="text-muted-foreground" />
                      </button>
                    </div>
                  )}

                  {descendantScope === 'generations' && (
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[12px] text-muted-foreground">
                        收录世数：
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={maxGenerations}
                        onChange={(e) => setMaxGenerations(e.target.value)}
                        className="w-20 h-8 text-[12px] tabular-nums"
                      />
                      <span className="text-[12px] text-muted-foreground">世</span>
                    </div>
                  )}
                </div>

                {error && <p className="text-[12px] text-destructive">{error}</p>}
              </div>

              <div className="p-5 bg-[var(--surface-subtle)] flex flex-col items-center justify-center">
                <div className="text-[12px] font-medium text-muted-foreground mb-3">
                  欧式版心 · 排版位置演示
                </div>
                <div
                  className="w-[240px] h-[320px] bg-[#F8FAFB] text-[#1E293B] border border-[#CBD5E1] p-3 flex flex-col shadow-sm select-none"
                  style={{
                    fontFamily:
                      '"Noto Serif SC", "Songti SC", "SimSun", serif',
                  }}
                >
                  <div className="border-2 border-double border-[#057091]/60 flex-1 flex overflow-hidden">
                    <div
                      className="w-8 border-l border-[#057091]/45 flex items-center justify-center text-[11px] font-bold tracking-widest py-2 overflow-hidden"
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                      }}
                    >
                      {totalTitle || book.bookName || '宗谱谱系'}
                    </div>
                    <div className="flex-1 grid grid-rows-5 divide-y divide-[#CBD5E1] text-[10px]">
                      {['一世', '二世', '三世', '四世', '五世'].map(
                        (tier, idx) => (
                          <div
                            key={tier}
                            className="flex items-center justify-between px-2"
                          >
                            <span className="text-[#057091] font-semibold">
                              {tier}
                            </span>
                            <span className="text-[#475569]">
                              {idx === 0
                                ? startMemberName || '始祖'
                                : '承嗣略注'}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                    <div className="w-7 border-r border-[#057091]/45 flex flex-col items-center justify-between py-2 bg-[#EEF5F7] text-[9px]">
                      <span
                        className="font-semibold truncate max-h-20"
                        style={{
                          writingMode: 'vertical-rl',
                          textOrientation: 'upright',
                        }}
                      >
                        {book.headerName || '宗谱'}
                      </span>
                      <FishtailOrnament style={book.layoutConfig.fishtailStyle} />
                      <span
                        className="text-[#057091] font-semibold truncate max-h-20"
                        style={{
                          writingMode: 'vertical-rl',
                          textOrientation: 'upright',
                        }}
                      >
                        {eyebrowTitle || '谱系谱眉'}
                      </span>
                      <span className="text-[8px] text-[#64748B]">第一页</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border bg-[var(--surface-subtle)] flex justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" size="sm">
                确认添加谱系
              </Button>
            </div>
          </form>
        </div>
      </div>

      <MemberSearchModal
        open={pickerTarget !== null}
        title={pickerTarget === 'start' ? '选择起始族丁' : '选择结束族丁'}
        initialChartId={chartId}
        onClose={() => setPickerTarget(null)}
        onConfirm={(picked) => {
          if (pickerTarget === 'start') {
            setChartId(picked.chartId);
            setChartName(picked.chartName);
            setStartMemberId(picked.person.id);
            setStartMemberName(picked.person.name);
            if (!eyebrowTitle.trim()) {
              setEyebrowTitle(`${picked.chartName}谱系`);
            }
          } else {
            setEndMemberId(picked.person.id);
            setEndMemberName(picked.person.name);
          }
          setPickerTarget(null);
        }}
      />
    </>,
    document.body,
  );
};
