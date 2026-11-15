import React from 'react';
import { PersonRecord } from '../types';
import { Crown, Heart, MapPin, Award } from 'lucide-react';
import { formatGivenName } from '../utils/nameUtils';

interface LineageGridViewProps {
  persons: PersonRecord[];
  selectedPersonId: string | null;
  clanSurname?: string;
  onSelectPerson: (id: string) => void;
  onAddChild: (fatherId: string) => void;
}

export const LineageGridView: React.FC<LineageGridViewProps> = ({
  persons,
  selectedPersonId,
  clanSurname = '',
  onSelectPerson,
  onAddChild,
}) => {
  const maxGen = Math.max(...persons.map((p) => p.generation), 1);
  const generations = Array.from(
    { length: Math.max(Math.min(maxGen, 5), 1) },
    (_, i) => i + 1
  );

  return (
    <div className="w-full h-full overflow-auto bg-background p-6 select-none">
      {/* Intro Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground font-serif">
            欧式五世一表 · 世系大表
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            依宋代欧阳修世系表体例，五世一图，昭穆分明，每世详注名讳、字号、官衔、配偶生卒及葬茔坐向。
          </p>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          五世图谱 (1世 ~ {generations.length}世)
        </div>
      </div>

      {/* Five-Generation Column Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[1000px]">
        {generations.map((gen) => {
          const genPersons = persons.filter((p) => p.generation === gen);
          return (
            <div
              key={gen}
              className="flex flex-col border border-border rounded-xl bg-card overflow-hidden shadow-sm"
            >
              <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-sm text-foreground tabular-nums">
                  {gen === 1 && <Crown size={15} className="text-amber-500" />}
                  <span>第 {gen} 世</span>
                </div>
                <span className="text-xs text-muted-foreground font-medium tabular-nums">
                  {genPersons.length} 人
                </span>
              </div>

              <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                {genPersons.length === 0 ? (
                  <div className="text-center py-10 text-xs text-muted-foreground">
                    暂无本世族人
                  </div>
                ) : (
                  genPersons.map((p) => {
                    const isSelected = p.id === selectedPersonId;
                    const children = persons.filter((c) => c.fatherId === p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => onSelectPerson(p.id)}
                        className={`p-3 rounded-lg border transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                            : 'border-border/80 bg-background hover:border-primary/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-foreground font-serif">
                                {formatGivenName(p.name, clanSurname)}
                              </span>
                              {p.courtesyName && (
                                <span className="text-[11px] text-muted-foreground">
                                  字{p.courtesyName}
                                </span>
                              )}
                            </div>
                            {p.fatherName && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                父：{formatGivenName(p.fatherName, clanSurname)}公
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {p.rank || (gen === 1 ? '始祖' : '男')}
                          </span>
                        </div>

                        {p.officialTitle && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate">
                            <Award size={11} className="shrink-0" />
                            <span className="truncate">{p.officialTitle}</span>
                          </div>
                        )}

                        {p.spouses && p.spouses.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Heart
                              size={11}
                              className="text-rose-500 shrink-0"
                            />
                            <span className="truncate">
                              配：{p.spouses.map((s) => s.name).join('、')}
                            </span>
                          </div>
                        )}

                        {p.burialPlace && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80 truncate">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{p.burialPlace}</span>
                          </div>
                        )}

                        <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                          <span>出 {children.length} 子</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddChild(p.id);
                            }}
                            className="text-primary hover:underline font-medium cursor-pointer"
                          >
                            + 添子嗣
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
