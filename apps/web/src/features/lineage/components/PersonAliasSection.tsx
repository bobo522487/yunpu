import React from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus } from 'lucide-react';
import type { PersonAliasRecord } from '../types';
import {
  formatAliasItemDisplayName,
  formatAliasItemRomanized,
} from '../utils/personHelpers';

interface PersonAliasSectionProps {
  aliasItems: PersonAliasRecord[];
  expanded: boolean;
  onToggleExpand: () => void;
  onCreateAlias: () => void;
  onEditAlias: (item: PersonAliasRecord, index: number) => void;
}

export const PersonAliasSection: React.FC<PersonAliasSectionProps> = ({
  aliasItems,
  expanded,
  onToggleExpand,
  onCreateAlias,
  onEditAlias,
}) => {
  return (
    <section
      data-testid="section-card-other"
      className="px-5 py-4 border-b border-border/70"
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 text-left py-1 rounded text-[14px] font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <span>其他资料</span>
          <span className="text-[12px] font-mono font-medium text-muted-foreground tabular-nums">
            ({aliasItems.length})
          </span>
          {expanded ? (
            <ChevronUp
              size={14}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown
              size={14}
              className="text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3">
          {/* 别名 */}
          <div data-testid="other-info-aliases">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                <span>别名</span>
                <span className="font-mono tabular-nums">
                  ({aliasItems.length})
                </span>
              </div>
              <button
                type="button"
                aria-haspopup="dialog"
                data-testid="add-alias-button"
                onClick={onCreateAlias}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12.5px] font-semibold text-primary hover:bg-[var(--surface-active)] transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus size={13} aria-hidden="true" />
                <span>新增</span>
              </button>
            </div>

            {aliasItems.length === 0 ? (
              <p className="text-[13px] text-placeholder py-1">
                暂无别名记录，可点击右上角新增字、号或曾用名
              </p>
            ) : (
              <div className="space-y-1">
                {aliasItems.map((item, idx) => {
                  const aliasName = formatAliasItemDisplayName(item);
                  const aliasPinyin = formatAliasItemRomanized(item);
                  return (
                    <div
                      key={item.id || `alias-${idx}`}
                      data-testid="other-info-alias-item"
                      className="group relative rounded-lg px-2.5 py-2 -mx-2.5 hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => onEditAlias(item, idx)}
                        className="w-full text-left pr-8 cursor-pointer"
                      >
                        <div className="text-[14px] font-medium text-foreground leading-snug break-words">
                          {item.type && (
                            <span className="text-[12.5px] font-normal text-muted-foreground">
                              {item.type}
                              <span aria-hidden="true"> · </span>
                            </span>
                          )}
                          <span>{aliasName}</span>
                        </div>
                        {aliasPinyin && (
                          <div className="mt-0.5 text-[12px] font-normal text-muted-foreground leading-snug">
                            {aliasPinyin}
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        aria-label={`编辑别名 ${aliasName}`}
                        aria-haspopup="dialog"
                        onClick={() => onEditAlias(item, idx)}
                        className="absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground opacity-75 group-hover:opacity-100 hover:bg-[var(--surface-active)] hover:text-primary transition-colors cursor-pointer"
                      >
                        <Pencil size={13} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
