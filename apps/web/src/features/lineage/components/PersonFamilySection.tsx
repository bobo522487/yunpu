import React, { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Plus, User } from 'lucide-react';
import type { GenealogyDate } from '../../date-input/date.types';
import { cn } from '../../../lib/utils';
import { type PersonRecord } from '../types';
import { formatGivenName } from '../utils/nameUtils';
import {
  computeAutoRankLabel,
  getDerivedChildren,
  getDerivedSpouses,
  getExtraRelationBadge,
} from '../utils/personHelpers';
import {
  type CoupleMarriageInfo,
  extractYearLabel,
  findCoupleMarriageInfo,
} from '../utils/personTimeline';

export interface PersonFamilySectionProps {
  person: PersonRecord;
  allPersons: PersonRecord[];
  clanSurname?: string;
  isWide?: boolean;
  onSelectPerson?: (personId: string) => void;
  onAddChild: (
    fatherId: string,
    motherInfo?: { motherId?: string; motherName?: string }
  ) => void;
  onAddSpouse: (personId: string) => void;
  onEditMarriage?: (partnerId: string, spouseId: string) => void;
  onEditParentChild?: (childId: string) => void;
}

interface MemberDisplayItem {
  key: string;
  personId: string;
  displayName: string;
  avatarUrl?: string;
  gender: 'male' | 'female' | 'unknown';
  secondaryText: string;
  isFocus: boolean;
}

interface CoupleUnit {
  key: string;
  spouseId?: string;
  spouseItem?: MemberDisplayItem;
  marriageInfo?: CoupleMarriageInfo;
  children: MemberDisplayItem[];
  motherInfo?: { motherId?: string; motherName?: string };
}

function formatLifespanYear(structuredDate?: GenealogyDate | null): string {
  const label = extractYearLabel(structuredDate).trim();
  if (!label) return '';
  return /^-?\d+$/.test(label) ? `${label}年` : label;
}

function formatLifespan(p: PersonRecord): string {
  const birth = formatLifespanYear(p.birth?.structuredDate);
  const death =
    p.status === 'living'
      ? '存'
      : formatLifespanYear(p.death?.structuredDate) || '歿';

  if (birth) return `${birth}–${death}`;
  if (death !== '存' && death !== '歿') return `–${death}`;
  return death;
}

function formatFullDisplayName(p: PersonRecord, clanSurname: string): string {
  const isSpouse = Boolean(p.spouseOfId);
  const effectiveSurname = isSpouse
    ? p.surname?.trim() || ''
    : p.surname?.trim() || clanSurname;
  const baseName = isSpouse
    ? [
        effectiveSurname && !p.name.startsWith(effectiveSurname)
          ? effectiveSurname
          : '',
        p.name,
      ].join('') || '配偶'
    : formatGivenName(p.name, effectiveSurname);
  return [baseName, p.nameSuffix?.trim() || ''].join('') || '未命名';
}

function buildSecondaryMeta(
  p: PersonRecord,
  livePersons: PersonRecord[]
): string {
  const lifespan = formatLifespan(p);
  const rankLabel = p.spouseOfId
    ? ''
    : !p.fatherId && p.relationTitle?.trim()
      ? p.relationTitle.trim()
      : computeAutoRankLabel(p, livePersons);
  const extraRel = getExtraRelationBadge(p);
  return [lifespan, rankLabel, extraRel].filter(Boolean).join(' · ');
}

function getGenderBarClass(gender: 'male' | 'female' | 'unknown'): string {
  if (gender === 'female') return 'bg-[#ED5481] dark:bg-[#D16686]';
  if (gender === 'male') return 'bg-[#2097B7] dark:bg-[#3E9EB8]';
  return 'bg-[#9EA1A3] dark:bg-slate-500';
}

function getFocusBgClass(gender: 'male' | 'female' | 'unknown'): string {
  if (gender === 'female') return 'bg-[#FBEBF0] dark:bg-[#ED5481]/18';
  if (gender === 'male') return 'bg-[#E7F3F7] dark:bg-[#2097B7]/18';
  return 'bg-[#F1F3F4] dark:bg-slate-800/70';
}

const MemberAvatar: React.FC<{
  avatarUrl?: string;
  displayName: string;
  gender: 'male' | 'female' | 'unknown';
}> = ({ avatarUrl, displayName, gender }) => {
  const toneClass =
    gender === 'female'
      ? 'bg-[#ED5481]/12 dark:bg-[#D16686]/15 text-[#B6335A] dark:text-[#E590AA] border-[#ED5481]/25 dark:border-[#D16686]/30'
      : gender === 'male'
        ? 'bg-[#2097B7]/12 dark:bg-[#3E9EB8]/15 text-[#057091] dark:text-[#6EC2DB] border-[#2097B7]/25 dark:border-[#3E9EB8]/30'
        : 'bg-[#E8EAEA] text-[#56585A] dark:bg-slate-700 dark:text-slate-300 border-[#D8DADA] dark:border-slate-600';

  return (
    <div
      aria-hidden="true"
      className={cn(
        'w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center shrink-0 text-[14px] font-bold select-none',
        toneClass
      )}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : displayName ? (
        <span>{displayName.slice(0, 1)}</span>
      ) : (
        <User size={16} />
      )}
    </div>
  );
};

interface CoupleSlotPersonRowProps {
  item: MemberDisplayItem;
  position: 'top' | 'bottom';
  onSelect?: (id: string) => void;
}

const CoupleSlotPersonRow: React.FC<CoupleSlotPersonRowProps> = ({
  item,
  position,
  onSelect,
}) => {
  const canNavigate = Boolean(onSelect && !item.isFocus);
  const genderBarClass = getGenderBarClass(item.gender);
  const focusBgClass = getFocusBgClass(item.gender);

  const innerContent = (
    <div className="flex items-stretch min-w-0 w-full">
      <div
        aria-hidden="true"
        className={cn('w-[4px] shrink-0', genderBarClass)}
      />
      <div className="flex items-center gap-2.5 min-w-0 flex-1 px-3 py-2.5">
        <MemberAvatar
          avatarUrl={item.avatarUrl}
          displayName={item.displayName}
          gender={item.gender}
        />
        <div className="min-w-0 flex-1 text-left">
          <div
            className={cn(
              'text-[14px] font-semibold truncate leading-snug',
              canNavigate
                ? 'text-foreground group-hover:text-primary group-hover:underline underline-offset-2'
                : 'text-foreground'
            )}
          >
            {item.displayName}
          </div>
          {item.secondaryText && (
            <div className="text-[12px] text-muted-foreground truncate tabular-nums mt-0.5 leading-snug">
              {item.secondaryText}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (canNavigate) {
    return (
      <button
        type="button"
        data-position={position}
        data-testid={`couple-person-${item.personId}`}
        onClick={() => onSelect?.(item.personId)}
        className="group w-full flex text-left hover:bg-[var(--surface-hover)] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      data-position={position}
      data-testid={item.isFocus ? 'focusPersonHighlight' : 'couple-person'}
      className={cn(
        'w-full flex',
        item.isFocus ? focusBgClass : 'bg-transparent'
      )}
    >
      {innerContent}
    </div>
  );
};

interface HorizontalCoupleCardProps {
  topItem: MemberDisplayItem;
  bottomItem?: MemberDisplayItem;
  marriageInfo?: CoupleMarriageInfo;
  onSelectPerson?: (id: string) => void;
  onEditMarriage?: () => void;
  emptyBottomAction?: {
    label: string;
    title: string;
    onClick: () => void;
  };
}

const HorizontalCoupleCard: React.FC<HorizontalCoupleCardProps> = ({
  topItem,
  bottomItem,
  marriageInfo,
  onSelectPerson,
  onEditMarriage,
  emptyBottomAction,
}) => {
  const hasMarriageDetail = Boolean(
    marriageInfo?.dateText ||
      marriageInfo?.placeText ||
      marriageInfo?.description
  );

  const marriageSummaryParts = marriageInfo
    ? [
        marriageInfo.dateText,
        marriageInfo.placeText,
        !marriageInfo.dateText && !marriageInfo.placeText
          ? marriageInfo.description
          : '',
      ].filter(Boolean)
    : [];

  return (
    <div
      data-testid="couple-card"
      className="rounded-lg overflow-hidden bg-card border border-border shadow-[var(--shadow-card)]"
    >
      {/* Top half: Primary / Father */}
      <CoupleSlotPersonRow
        item={topItem}
        position="top"
        onSelect={onSelectPerson}
      />

      {/* Middle marriage bar (when both members of the couple exist) */}
      {bottomItem && marriageInfo && (
        <div
          data-testid="wrapper-marriage-details"
          className="group relative border-y border-border/75 bg-[var(--surface-subtle)] flex items-center justify-between gap-2 pl-3 pr-1.5 py-1.5"
        >
          <button
            type="button"
            data-testid="marriage-list-item"
            onClick={onEditMarriage}
            disabled={!onEditMarriage}
            className={cn(
              'min-w-0 flex-1 text-left flex items-baseline gap-1.5 flex-wrap',
              onEditMarriage ? 'cursor-pointer' : 'cursor-default'
            )}
          >
            <span className="text-[13px] font-semibold text-foreground shrink-0">
              结婚
            </span>
            {hasMarriageDetail ? (
              <span className="text-[12px] text-muted-foreground tabular-nums break-words leading-snug">
                {marriageSummaryParts.join(' · ')}
              </span>
            ) : (
              <span className="text-[12px] text-placeholder">
                添加结婚日期与地点
              </span>
            )}
          </button>

          {onEditMarriage && (
            <button
              type="button"
              data-testid="couple-relationship-view-button"
              aria-label={`编辑夫妻：${topItem.displayName}和${bottomItem.displayName}`}
              title={`编辑夫妻：${topItem.displayName}和${bottomItem.displayName}`}
              onClick={onEditMarriage}
              className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-muted-foreground opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-[var(--surface-active)] hover:text-primary transition-opacity duration-150 cursor-pointer"
            >
              <Pencil size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Bottom half: Spouse / Mother OR inline "加入配偶" placeholder slot */}
      {bottomItem ? (
        <CoupleSlotPersonRow
          item={bottomItem}
          position="bottom"
          onSelect={onSelectPerson}
        />
      ) : emptyBottomAction ? (
        <button
          type="button"
          data-position="bottom"
          data-testid="add-spouse2-button"
          title={emptyBottomAction.title}
          onClick={emptyBottomAction.onClick}
          className="group w-full flex items-stretch border-t border-border/75 hover:bg-[var(--surface-active)] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <div
            aria-hidden="true"
            className="w-[4px] shrink-0 bg-border group-hover:bg-primary/60 transition-colors"
          />
          <div className="flex items-center gap-2.5 min-w-0 flex-1 px-3 py-2.5">
            <div
              aria-hidden="true"
              className="w-10 h-10 rounded-full border border-dashed border-border bg-[var(--surface-subtle)] text-muted-foreground group-hover:border-primary/50 group-hover:text-primary flex items-center justify-center shrink-0 transition-colors"
            >
              <User size={18} />
            </div>
            <span className="text-[14px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
              {emptyBottomAction.label}
            </span>
          </div>
        </button>
      ) : null}
    </div>
  );
};

interface ChildListRowProps {
  item: MemberDisplayItem;
  onSelect?: (id: string) => void;
  onEditParentChild?: (personId: string) => void;
}

const ChildListRow: React.FC<ChildListRowProps> = ({
  item,
  onSelect,
  onEditParentChild,
}) => {
  const canNavigate = Boolean(onSelect && !item.isFocus);
  const genderBarClass = getGenderBarClass(item.gender);
  const focusBgClass = getFocusBgClass(item.gender);

  const personBody = (
    <div
      data-testid="person"
      className="flex items-center gap-2.5 min-w-0 flex-1"
    >
      <MemberAvatar
        avatarUrl={item.avatarUrl}
        displayName={item.displayName}
        gender={item.gender}
      />
      <div className="min-w-0 flex-1 text-left">
        {canNavigate ? (
          <button
            type="button"
            onClick={() => onSelect?.(item.personId)}
            className="block max-w-full text-left text-[14px] font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 truncate leading-snug cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[3px]"
          >
            {item.displayName}
          </button>
        ) : (
          <div className="text-[14px] font-semibold text-foreground truncate leading-snug">
            {item.displayName}
          </div>
        )}

        {item.secondaryText && (
          <div className="text-[12px] text-muted-foreground truncate tabular-nums mt-0.5 leading-snug">
            {item.secondaryText}
          </div>
        )}
      </div>
    </div>
  );

  const editAction = onEditParentChild ? (
    <button
      type="button"
      data-testid="parent-child-relationship-view-button"
      aria-label={`编辑${item.displayName}的父母`}
      title={`编辑${item.displayName}的父母关系`}
      onClick={(e) => {
        e.stopPropagation();
        onEditParentChild(item.personId);
      }}
      className="w-8 h-8 rounded-full shrink-0 self-center flex items-center justify-center text-muted-foreground opacity-70 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 hover:bg-[var(--surface-active)] hover:text-primary transition-opacity duration-150 cursor-pointer"
    >
      <Pencil size={14} aria-hidden="true" />
    </button>
  ) : null;

  if (item.isFocus) {
    return (
      <div
        data-testid="focusPersonHighlight"
        className={cn(
          'group flex items-center justify-between gap-2 rounded-[6px] overflow-hidden pr-1.5',
          focusBgClass
        )}
      >
        <div className="flex items-stretch gap-2.5 min-w-0 flex-1">
          <div
            aria-hidden="true"
            className={cn('w-[3px] shrink-0', genderBarClass)}
          />
          <div className="py-1.5 min-w-0 flex-1 flex items-center">
            {personBody}
          </div>
        </div>
        {editAction}
      </div>
    );
  }

  return (
    <div
      data-testid="rowGenderBar"
      className="group flex items-stretch justify-between gap-2 py-1 pr-1"
    >
      <div className="flex items-stretch gap-2.5 min-w-0 flex-1">
        <div
          aria-hidden="true"
          className={cn('w-[3px] rounded-full shrink-0 my-0.5', genderBarClass)}
        />
        <div className="py-0.5 min-w-0 flex-1 flex items-center">
          {personBody}
        </div>
      </div>
      {editAction}
    </div>
  );
};

export const PersonFamilySection: React.FC<PersonFamilySectionProps> = ({
  person,
  allPersons,
  clanSurname = '',
  isWide = false,
  onSelectPerson,
  onAddChild,
  onAddSpouse,
  onEditMarriage,
  onEditParentChild,
}) => {
  const [expandedChildrenByUnit, setExpandedChildrenByUnit] = useState<
    Record<string, boolean>
  >({});
  const [parentChildrenExpanded, setParentChildrenExpanded] = useState(true);

  const isUnitExpanded = (unitKey: string) =>
    expandedChildrenByUnit[unitKey] !== false;

  const toggleUnitExpanded = (unitKey: string) => {
    setExpandedChildrenByUnit((prev) => ({
      ...prev,
      [unitKey]: prev[unitKey] === false,
    }));
  };

  const livePersons = useMemo(() => {
    const exists = allPersons.some((p) => p.id === person.id);
    return exists
      ? allPersons.map((p) => (p.id === person.id ? person : p))
      : [...allPersons, person];
  }, [allPersons, person]);

  const isSpouseNode = Boolean(person.spouseOfId);
  const primaryId = person.spouseOfId || person.id;

  const primaryPerson = useMemo(() => {
    return livePersons.find((p) => p.id === primaryId) || person;
  }, [livePersons, primaryId, person]);

  const primaryCoupleItem = useMemo<MemberDisplayItem>(
    () => ({
      key: primaryPerson.id,
      personId: primaryPerson.id,
      displayName: formatFullDisplayName(primaryPerson, clanSurname),
      avatarUrl: primaryPerson.avatarUrl,
      gender: primaryPerson.gender,
      secondaryText: buildSecondaryMeta(primaryPerson, livePersons),
      isFocus: primaryPerson.id === person.id,
    }),
    [primaryPerson, clanSurname, livePersons, person.id]
  );

  const spouseRecords = useMemo(() => {
    return getDerivedSpouses(livePersons, primaryPerson.id);
  }, [livePersons, primaryPerson.id]);

  const ownChildrenRecords = useMemo(() => {
    return getDerivedChildren(livePersons, primaryPerson.id);
  }, [livePersons, primaryPerson.id]);

  const coupleUnits = useMemo<CoupleUnit[]>(() => {
    const toChildItem = (child: PersonRecord): MemberDisplayItem => ({
      key: child.id,
      personId: child.id,
      displayName: formatFullDisplayName(child, clanSurname),
      avatarUrl: child.avatarUrl,
      gender: child.gender,
      secondaryText: buildSecondaryMeta(child, livePersons),
      isFocus: child.id === person.id,
    });

    if (spouseRecords.length === 0) {
      return [
        {
          key: 'couple-primary-only',
          children: ownChildrenRecords.map(toChildItem),
        },
      ];
    }

    const buckets: PersonRecord[][] = spouseRecords.map(() => []);
    ownChildrenRecords.forEach((child) => {
      let matchedIndex = -1;
      if (child.motherId) {
        matchedIndex = spouseRecords.findIndex((sp) => sp.id === child.motherId);
      }
      if (matchedIndex === -1) {
        matchedIndex = 0;
      }
      buckets[matchedIndex].push(child);
    });

    return spouseRecords.map((sp, idx) => {
      const spouseDisplayName = formatFullDisplayName(sp, clanSurname);
      return {
        key: `couple-${sp.id}`,
        spouseId: sp.id,
        spouseItem: {
          key: sp.id,
          personId: sp.id,
          displayName: spouseDisplayName,
          avatarUrl: sp.avatarUrl,
          gender: sp.gender,
          secondaryText: buildSecondaryMeta(sp, livePersons),
          isFocus: sp.id === person.id,
        },
        marriageInfo: findCoupleMarriageInfo(
          primaryPerson,
          sp,
          spouseRecords.length,
          clanSurname
        ),
        children: buckets[idx].map(toChildItem),
        motherInfo: {
          motherId: sp.id,
          motherName: spouseDisplayName,
        },
      };
    });
  }, [
    spouseRecords,
    ownChildrenRecords,
    clanSurname,
    livePersons,
    person.id,
    primaryPerson,
  ]);

  // 父母与兄弟姐妹数据
  const fatherRecord = useMemo(() => {
    if (!person.fatherId) return null;
    return livePersons.find((p) => p.id === person.fatherId) || null;
  }, [livePersons, person.fatherId]);

  const parentSpouses = useMemo(() => {
    if (!fatherRecord) return [];
    return getDerivedSpouses(livePersons, fatherRecord.id);
  }, [fatherRecord, livePersons]);

  const matchedMotherRecord = useMemo(() => {
    if (person.motherId) {
      return (
        parentSpouses.find((m) => m.id === person.motherId) ||
        livePersons.find((m) => m.id === person.motherId) ||
        null
      );
    }
    return parentSpouses[0] || null;
  }, [person.motherId, parentSpouses, livePersons]);

  const fatherItem = useMemo<MemberDisplayItem | null>(() => {
    if (!fatherRecord) return null;
    return {
      key: fatherRecord.id,
      personId: fatherRecord.id,
      displayName: formatFullDisplayName(fatherRecord, clanSurname),
      avatarUrl: fatherRecord.avatarUrl,
      gender: fatherRecord.gender,
      secondaryText: buildSecondaryMeta(fatherRecord, livePersons),
      isFocus: false,
    };
  }, [fatherRecord, clanSurname, livePersons]);

  const motherItem = useMemo<MemberDisplayItem | null>(() => {
    if (!matchedMotherRecord) return null;
    return {
      key: matchedMotherRecord.id,
      personId: matchedMotherRecord.id,
      displayName: formatFullDisplayName(matchedMotherRecord, clanSurname),
      avatarUrl: matchedMotherRecord.avatarUrl,
      gender: matchedMotherRecord.gender,
      secondaryText: buildSecondaryMeta(matchedMotherRecord, livePersons),
      isFocus: false,
    };
  }, [matchedMotherRecord, clanSurname, livePersons]);

  const parentMarriageInfo = useMemo(() => {
    if (!fatherRecord || !matchedMotherRecord) return undefined;
    if (matchedMotherRecord.spouseOfId !== fatherRecord.id) return undefined;
    return findCoupleMarriageInfo(
      fatherRecord,
      matchedMotherRecord,
      Math.max(1, parentSpouses.length),
      clanSurname
    );
  }, [fatherRecord, matchedMotherRecord, parentSpouses.length, clanSurname]);

  const siblingItems = useMemo<MemberDisplayItem[]>(() => {
    if (!fatherRecord) return [];
    return getDerivedChildren(livePersons, fatherRecord.id).map((sib) => ({
      key: sib.id,
      personId: sib.id,
      displayName: formatFullDisplayName(sib, clanSurname),
      avatarUrl: sib.avatarUrl,
      gender: sib.gender,
      secondaryText: buildSecondaryMeta(sib, livePersons),
      isFocus: sib.id === person.id,
    }));
  }, [fatherRecord, livePersons, clanSurname, person.id]);

  const parentMotherInfo = matchedMotherRecord
    ? {
        motherId: matchedMotherRecord.id,
        motherName: formatFullDisplayName(matchedMotherRecord, clanSurname),
      }
    : undefined;

  const hasSpouses = spouseRecords.length > 0;

  return (
    <div
      className={cn(
        'grid gap-6',
        isWide ? 'grid-cols-2 items-start' : 'grid-cols-1'
      )}
    >
      {/* 分组一：配偶与子女 */}
      <div className="min-w-0 space-y-2.5">
        <h3 className="text-[13px] font-semibold text-muted-foreground">
          配偶与子女
        </h3>

        <div className="space-y-4">
          {coupleUnits.map((unit) => {
            const expanded = isUnitExpanded(unit.key);
            return (
              <div key={unit.key} className="space-y-1.5">
                {/* 横版画布夫妻合并卡片 */}
                <HorizontalCoupleCard
                  topItem={primaryCoupleItem}
                  bottomItem={unit.spouseItem}
                  marriageInfo={unit.marriageInfo}
                  onSelectPerson={onSelectPerson}
                  onEditMarriage={
                    unit.spouseId && onEditMarriage
                      ? () => onEditMarriage(primaryPerson.id, unit.spouseId!)
                      : undefined
                  }
                  emptyBottomAction={
                    !hasSpouses
                      ? {
                          label: '加入配偶',
                          title: `加入配偶给${primaryCoupleItem.displayName}`,
                          onClick: () => onAddSpouse(primaryPerson.id),
                        }
                      : undefined
                  }
                />

                {/* 紧贴卡片下方的子女折叠列表 */}
                <div className="pl-2.5 space-y-1">
                  <button
                    type="button"
                    data-testid="children-expander-button"
                    aria-expanded={expanded}
                    onClick={() => toggleUnitExpanded(unit.key)}
                    className="w-full flex items-center justify-between gap-2 px-1.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <span className="tabular-nums">
                      子女（{unit.children.length}）
                    </span>
                    <ChevronDown
                      size={15}
                      aria-hidden="true"
                      className={cn(
                        'text-muted-foreground shrink-0 transition-transform duration-150',
                        expanded ? 'rotate-180' : ''
                      )}
                    />
                  </button>

                  {expanded && (
                    <div className="space-y-1">
                      {unit.children.length > 0 ? (
                        <ol
                          data-testid="children-person-list"
                          className="space-y-1"
                        >
                          {unit.children.map((child) => (
                            <li key={child.key} data-testid="child-person">
                              <ChildListRow
                                item={child}
                                onSelect={onSelectPerson}
                                onEditParentChild={onEditParentChild}
                              />
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="px-2 py-1 text-[12px] text-muted-foreground">
                          暂无子女记录
                        </p>
                      )}

                      <button
                        type="button"
                        data-testid="add-child"
                        onClick={() =>
                          onAddChild(primaryPerson.id, unit.motherInfo)
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-semibold text-primary hover:bg-[var(--surface-active)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Plus size={15} aria-hidden="true" />
                        <span>加入子女</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 已有配偶时保留底部添加继配入口；无配偶时已内嵌于卡片下半部 */}
        {hasSpouses && (
          <button
            type="button"
            data-testid="add-spouse"
            onClick={() => onAddSpouse(primaryPerson.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-semibold text-primary hover:bg-[var(--surface-active)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus size={15} aria-hidden="true" />
            <span>加入配偶</span>
          </button>
        )}
      </div>

      {/* 分组二：父母与兄弟姐妹 */}
      <div
        className={cn(
          'min-w-0 space-y-2.5',
          !isWide
            ? 'pt-4 border-t border-border/70'
            : ''
        )}
      >
        <h3 className="text-[13px] font-semibold text-muted-foreground">
          父母与兄弟姐妹
        </h3>

        {fatherItem || motherItem || siblingItems.length > 0 ? (
          <div className="space-y-1.5">
            {/* 横版画布父母合并卡片 */}
            {(fatherItem || motherItem) && (
              <HorizontalCoupleCard
                topItem={(fatherItem || motherItem)!}
                bottomItem={fatherItem && motherItem ? motherItem : undefined}
                marriageInfo={parentMarriageInfo}
                onSelectPerson={onSelectPerson}
                onEditMarriage={
                  fatherRecord &&
                  matchedMotherRecord &&
                  parentMarriageInfo &&
                  onEditMarriage
                    ? () =>
                        onEditMarriage(fatherRecord.id, matchedMotherRecord.id)
                    : undefined
                }
              />
            )}

            {/* 紧贴父母卡片下方的子女（含当前人物与兄弟姐妹） */}
            {fatherRecord && (
              <div className="pl-2.5 space-y-1">
                <button
                  type="button"
                  aria-expanded={parentChildrenExpanded}
                  onClick={() => setParentChildrenExpanded((v) => !v)}
                  className="w-full flex items-center justify-between gap-2 px-1.5 py-1.5 rounded-md text-[13px] font-medium text-foreground hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                >
                  <span className="tabular-nums">
                    子女（{siblingItems.length}）
                  </span>
                  <ChevronDown
                    size={15}
                    aria-hidden="true"
                    className={cn(
                      'text-muted-foreground shrink-0 transition-transform duration-150',
                      parentChildrenExpanded ? 'rotate-180' : ''
                    )}
                  />
                </button>

                {parentChildrenExpanded && (
                  <div className="space-y-1">
                    <ol className="space-y-1">
                      {siblingItems.map((sib) => (
                        <li key={sib.key}>
                          <ChildListRow
                            item={sib}
                            onSelect={onSelectPerson}
                            onEditParentChild={onEditParentChild}
                          />
                        </li>
                      ))}
                    </ol>

                    <button
                      type="button"
                      data-testid="add-parent-child"
                      onClick={() =>
                        onAddChild(fatherRecord.id, parentMotherInfo)
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] font-semibold text-primary hover:bg-[var(--surface-active)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus size={15} aria-hidden="true" />
                      <span>加入子女</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="py-1 text-[13px] text-muted-foreground leading-relaxed">
            {isSpouseNode
              ? '当前为配偶节点，未关联原生父母世系。'
              : '暂无父母与兄弟姐妹记录（开基始祖或尚未关联父母）。'}
          </p>
        )}
      </div>
    </div>
  );
};
