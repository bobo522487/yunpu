import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { BiographyPreviewPreferences, PersonRecord } from '../types';
import { buildBiographyPreviewData } from '../utils/personHelpers';

interface BiographyLivePreviewProps {
  draft: PersonRecord;
  allPersons: PersonRecord[];
  clanSurname?: string;
  prefs: BiographyPreviewPreferences;
  onUpdatePrefs: (updates: Partial<BiographyPreviewPreferences>) => void;
}

const PREF_TOGGLES: {
  key: keyof BiographyPreviewPreferences;
  label: string;
}[] = [
  { key: 'showBirth', label: '出生日期' },
  { key: 'showBirthDetail', label: '出生地与描述' },
  { key: 'showLife', label: '学历职务与生平' },
  { key: 'showDeath', label: '去世时间与享寿' },
  { key: 'showDeathDetail', label: '卒葬地与描述' },
  { key: 'showBiography', label: '传记简介' },
  { key: 'showChildren', label: '子嗣名录' },
  { key: 'showRemarks', label: '末尾备注' },
  { key: 'showPrivateInfo', label: '实名与联系方式' },
];

export const BiographyLivePreview: React.FC<BiographyLivePreviewProps> = ({
  draft,
  allPersons,
  clanSurname = '',
  prefs,
  onUpdatePrefs,
}) => {
  const [showPrefs, setShowPrefs] = useState(false);
  const summary = buildBiographyPreviewData(
    draft,
    allPersons,
    prefs,
    clanSurname
  );

  const hasAnyLine =
    summary.birthLine ||
    summary.lifeLine ||
    summary.deathLine ||
    summary.biographyLine ||
    summary.childrenLine ||
    summary.remarksLine;

  return (
    <div className="w-[330px] shrink-0 border-l border-border bg-muted/15 flex flex-col overflow-hidden">
      {/* Scrollable Preview Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground tracking-wide">
            行传预览
          </span>
          <button
            type="button"
            onClick={() => setShowPrefs((v) => !v)}
            className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              showPrefs
                ? 'border-primary text-primary bg-primary/5'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal size={11} />
            <span>偏好设置</span>
          </button>
        </div>

        {/* Interactive Preference Toggles */}
        {showPrefs && (
          <div className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="text-[11px] font-medium text-muted-foreground">
              行传成文显示项
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
              {PREF_TOGGLES.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-1.5 text-[11px] text-foreground cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[item.key])}
                    onChange={(e) =>
                      onUpdatePrefs({ [item.key]: e.target.checked })
                    }
                    className="rounded border-input accent-primary h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="truncate">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Editorial Biography Sheet */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3 font-serif">
          <div className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-2.5">
            <div className="min-w-0">
              <span className="text-lg font-bold tracking-wider text-foreground">
                {summary.displayName}
              </span>
              {summary.legalNameText && (
                <span className="text-xs text-muted-foreground ml-1 font-sans">
                  {summary.legalNameText}
                </span>
              )}
            </div>
            <span
              className={`text-[11px] font-sans font-medium shrink-0 ${
                draft.status === 'living'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }`}
            >
              {summary.statusBadge}
            </span>
          </div>

          {/* Kinship & Lineage Context */}
          {summary.kinshipLine && (
            <p className="text-xs text-foreground/90 leading-relaxed font-semibold">
              {summary.kinshipLine}
            </p>
          )}

          {/* Spouses */}
          {summary.spouseLine && (
            <p className="text-xs text-foreground/85 leading-relaxed">
              {summary.spouseLine}。
            </p>
          )}

          {/* Structured Life Sections */}
          {(summary.birthLine || summary.lifeLine || summary.deathLine) && (
            <div className="space-y-2 pt-1 text-xs leading-relaxed text-foreground/85">
              {summary.birthLine && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-sans shrink-0 w-8">
                    出生
                  </span>
                  <span>{summary.birthLine}</span>
                </div>
              )}
              {summary.lifeLine && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-sans shrink-0 w-8">
                    生平
                  </span>
                  <span>{summary.lifeLine}</span>
                </div>
              )}
              {summary.deathLine && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground font-sans shrink-0 w-8">
                    卒葬
                  </span>
                  <span>{summary.deathLine}</span>
                </div>
              )}
            </div>
          )}

          {/* Biography Prose */}
          {summary.biographyLine && (
            <div className="pt-2 border-t border-border/50 text-xs leading-relaxed text-foreground text-justify">
              {summary.biographyLine}
            </div>
          )}

          {/* Derived Children */}
          {summary.childrenLine && (
            <div className="pt-2 border-t border-border/50 text-xs leading-relaxed text-foreground/90">
              {summary.childrenLine}。
            </div>
          )}

          {/* Tail Remarks */}
          {summary.remarksLine && (
            <div className="pt-2 border-t border-border/50 text-[11px] leading-relaxed text-muted-foreground">
              注：{summary.remarksLine}
            </div>
          )}

          {!hasAnyLine && !summary.kinshipLine && !summary.spouseLine && (
            <p className="text-xs text-muted-foreground font-sans py-4 text-center">
              在左侧录入姓名、生卒或事略后，此处将实时生成传统行传文本。
            </p>
          )}
        </div>

        {/* Private Contact Summary Card (only when visible & populated) */}
        {summary.privateRows.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
            <div className="text-[11px] font-semibold text-muted-foreground">
              实名与联系方式
            </div>
            <div className="space-y-1.5 text-xs">
              {summary.privateRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="text-muted-foreground shrink-0">
                    {row.label}
                  </span>
                  <span className="text-foreground text-right break-all tabular-nums">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
