import React, { memo, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { type PersonFlowNode } from '../types';
import { formatGivenName, toFullNamePinyin } from '../../utils/nameUtils';
import { getPersonDateDisplay } from '../../../date-input';
import {
  formatPersonGregorianLifespan,
  resolveRomanizedDisplayName,
} from '../../utils/personTimeline';

const FirstAncestorBadgeIcon: React.FC = () => (
  <svg
    viewBox="0 0 20 20"
    className="w-[14px] h-[14px] text-[#202121]"
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Person silhouette + star accent matching FamilySearch first-ancestor badge */}
    <circle cx="8" cy="6" r="2.6" />
    <path d="M3 15.5c0-2.6 2.2-4.3 5-4.3s5 1.7 5 4.3v.7H3v-.7z" />
    <path d="M15.2 4.2l.75 1.55 1.7.25-1.23 1.2.29 1.7-1.51-.8-1.51.8.29-1.7-1.23-1.2 1.7-.25.75-1.55z" />
  </svg>
);

export const PersonNode: React.FC<NodeProps<PersonFlowNode>> = memo(
  ({ data, selected }) => {
    const {
      person,
      clanSurname = '',
      isFirstAncestor = false,
      isAddMenuOpen = false,
      onSelect,
      onAddChild,
      onAddSibling,
      onAddSpouse,
      onToggleAddMenu,
    } = data;

    const menuContainerRef = useRef<HTMLDivElement | null>(null);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
      setImgError(false);
    }, [person.avatarUrl]);

    useEffect(() => {
      if (!isAddMenuOpen) return;
      const handlePointerDown = (e: PointerEvent) => {
        if (
          menuContainerRef.current &&
          !menuContainerRef.current.contains(e.target as Node)
        ) {
          onToggleAddMenu?.(null);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onToggleAddMenu?.(null);
        }
      };
      document.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('pointerdown', handlePointerDown);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isAddMenuOpen, onToggleAddMenu]);

    const isFemale = person.gender === 'female';
    const isUnknownGender = person.gender === 'unknown';
    const isSpouseNode = Boolean(person.spouseOfId);
    const isDeceased = person.status === 'deceased';

    const effectiveSurname = isSpouseNode
      ? person.surname?.trim() || ''
      : person.surname?.trim() || clanSurname.trim();

    const displayName = isSpouseNode
      ? [
          effectiveSurname && !person.name.startsWith(effectiveSurname)
            ? effectiveSurname
            : '',
          person.name,
        ].join('') || '配偶'
      : (() => {
          const given = formatGivenName(person.name, effectiveSurname);
          if (effectiveSurname && given && !given.startsWith(effectiveSurname)) {
            return `${effectiveSurname}${given}`;
          }
          return given || effectiveSurname || '未命名';
        })();

    const avatarToneClass = isFemale
      ? 'bg-[#ED5481]/12 text-[#B6335A] dark:bg-[#D16686]/15 dark:text-[#E590AA] border-[#ED5481]/25 dark:border-[#D16686]/30'
      : isUnknownGender
        ? 'bg-[#E8EAEA] text-[#56585A] dark:bg-slate-700 dark:text-slate-300 border-[#D8DADA] dark:border-slate-600'
        : 'bg-[#2097B7]/12 text-[#057091] dark:bg-[#3E9EB8]/15 dark:text-[#6EC2DB] border-[#2097B7]/25 dark:border-[#3E9EB8]/30';

    const pinyinName =
      resolveRomanizedDisplayName(person) ||
      toFullNamePinyin(displayName, effectiveSurname);

    const rawBirthText = getPersonDateDisplay(person, 'birth').trim();
    const rawDeathText = getPersonDateDisplay(person, 'death').trim();
    const gregorianLifespan = formatPersonGregorianLifespan(person);

    const topStripeClass = isFemale
      ? 'border-t-[#ED5481] dark:border-t-[#D16686]'
      : isUnknownGender
        ? 'border-t-[#9EA1A3] dark:border-t-[#7A828A]'
        : 'border-t-[#2097B7] dark:border-t-[#3E9EB8]';

    const genderSrText = isFemale ? '女' : isUnknownGender ? '性别不详' : '男';

    const tooltipLines = [
      displayName,
      pinyinName,
      rawBirthText ? `生：${rawBirthText}` : '',
      rawDeathText ? `卒：${rawDeathText}` : isDeceased ? '歿' : '存',
    ].filter(Boolean);

    const avatarSrc = person.avatarUrl?.trim();
    const hasAvatar = Boolean(avatarSrc && !imgError);

    return (
      <div
        role="group"
        tabIndex={0}
        aria-label={`${displayName}，${genderSrText}`}
        title={tooltipLines.join('\n')}
        onClick={(e) => {
          e.stopPropagation();
          if (isAddMenuOpen) {
            onToggleAddMenu?.(null);
          }
          onSelect?.(person.id);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(person.id);
          }
        }}
        className={`group relative w-[123px] h-[220px] rounded-[8px] border-t-[4px] ${topStripeClass} bg-[#FEFEFE] dark:bg-card flex flex-col items-center select-none outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-[#057091] dark:focus-visible:ring-[#58B1CD] focus-visible:shadow-[0_0_0_5px_rgba(5,112,145,0.18),0_4px_12px_rgba(15,23,42,0.16)] dark:focus-visible:shadow-[0_0_0_5px_rgba(88,177,205,0.22),0_6px_16px_rgba(0,0,0,0.48)] ${
          selected || data.isSelected
            ? 'ring-2 ring-[#057091] dark:ring-[#58B1CD] shadow-[0_0_0_5px_rgba(5,112,145,0.16),0_4px_12px_rgba(15,23,42,0.16)] dark:shadow-[0_0_0_5px_rgba(88,177,205,0.20),0_6px_16px_rgba(0,0,0,0.48)]'
            : 'shadow-[0_1px_3px_rgba(15,23,42,0.18)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.48)] hover:shadow-[0_4px_12px_rgba(15,23,42,0.16)] dark:hover:shadow-[0_6px_16px_rgba(0,0,0,0.55)]'
        }`}
      >
        <span className="sr-only">{genderSrText}</span>

        {/* Top Target Handle (Incoming parent bloodline) */}
        <Handle
          type="target"
          position={Position.Top}
          id="parent-in"
          className="!w-2 !h-2 !opacity-0 pointer-events-none !top-0"
        />

        {/* Bottom Handles (Outgoing child stem & childless couple bracket) */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="child-out"
          className="!w-2 !h-2 !opacity-0 pointer-events-none !bottom-0"
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="spouse-bottom-in"
          className="!w-2 !h-2 !opacity-0 pointer-events-none !bottom-0"
        />

        {/* Top-Left First Ancestor Badge */}
        {isFirstAncestor && (
          <div
            className="absolute top-[9px] left-[9px] w-[22.5px] h-[22.5px] rounded-full bg-[#FFC400] dark:bg-[#E0AF22] flex items-center justify-center pointer-events-none z-10"
            title="开基始祖"
          >
            <FirstAncestorBadgeIcon />
          </div>
        )}

        {/* Top-Right Persistent '+' Add Relative Button + Popover Menu */}
        <div
          ref={menuContainerRef}
          className="nodrag nopan nowheel absolute top-[3px] right-[3px] z-30"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`为${displayName}加入亲属`}
            aria-haspopup="menu"
            aria-expanded={isAddMenuOpen}
            title="加入亲属"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAddMenu?.(isAddMenuOpen ? null : person.id);
            }}
            className={`w-[35px] h-[35px] rounded-full flex items-center justify-center transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#057091] dark:focus-visible:ring-[#58B1CD] focus-visible:shadow-[var(--shadow-focus-halo)] ${
              isAddMenuOpen
                ? 'bg-[#EAF4F7] dark:bg-[#58B1CD]/15 text-[#057091] dark:text-[#58B1CD]'
                : 'text-[rgba(0,3,5,0.737)] dark:text-foreground/75 hover:bg-[#EAF4F7] dark:hover:bg-[#58B1CD]/15 hover:text-[#057091] dark:hover:text-[#58B1CD]'
            }`}
          >
            <Plus size={19} strokeWidth={2} />
          </button>

          {isAddMenuOpen && (
            <div
              role="dialog"
              aria-modal="false"
              aria-label={`为${displayName}加入亲属`}
              className="absolute top-[38px] right-0 min-w-[112px] rounded-[12px] overflow-hidden bg-white dark:bg-popover border border-black/[0.06] dark:border-border shadow-[0_8px_24px_rgba(0,0,0,0.16),0_3px_8px_rgba(0,0,0,0.10)] z-50"
            >
              <ul role="menu" className="py-1.5 m-0 list-none">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled="false"
                    onClick={() => {
                      onToggleAddMenu?.(null);
                      onAddSpouse?.(person.id);
                    }}
                    className="w-full px-4 py-2.5 text-left text-[14px] font-medium leading-[1.35] text-[#202121] dark:text-foreground hover:bg-[#F2F3F4] dark:hover:bg-accent active:bg-[#E7E9EA] dark:active:bg-accent/80 focus-visible:outline-none focus-visible:bg-[#EAF4F7] focus-visible:text-[#057091] dark:focus-visible:bg-[#057091]/25 dark:focus-visible:text-[#58B1CD] whitespace-nowrap cursor-pointer transition-colors"
                  >
                    加入配偶
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled="false"
                    onClick={() => {
                      onToggleAddMenu?.(null);
                      onAddChild?.(person.id, 'male');
                    }}
                    className="w-full px-4 py-2.5 text-left text-[14px] font-medium leading-[1.35] text-[#202121] dark:text-foreground hover:bg-[#F2F3F4] dark:hover:bg-accent active:bg-[#E7E9EA] dark:active:bg-accent/80 focus-visible:outline-none focus-visible:bg-[#EAF4F7] focus-visible:text-[#057091] dark:focus-visible:bg-[#057091]/25 dark:focus-visible:text-[#58B1CD] whitespace-nowrap cursor-pointer transition-colors"
                  >
                    加入儿子
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled="false"
                    onClick={() => {
                      onToggleAddMenu?.(null);
                      onAddChild?.(person.id, 'female');
                    }}
                    className="w-full px-4 py-2.5 text-left text-[14px] font-medium leading-[1.35] text-[#202121] dark:text-foreground hover:bg-[#F2F3F4] dark:hover:bg-accent active:bg-[#E7E9EA] dark:active:bg-accent/80 focus-visible:outline-none focus-visible:bg-[#EAF4F7] focus-visible:text-[#057091] dark:focus-visible:bg-[#057091]/25 dark:focus-visible:text-[#58B1CD] whitespace-nowrap cursor-pointer transition-colors"
                  >
                    加入女儿
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled="false"
                    onClick={() => {
                      onToggleAddMenu?.(null);
                      onAddSibling?.(person.id, 'male');
                    }}
                    className="w-full px-4 py-2.5 text-left text-[14px] font-medium leading-[1.35] text-[#202121] dark:text-foreground hover:bg-[#F2F3F4] dark:hover:bg-accent active:bg-[#E7E9EA] dark:active:bg-accent/80 focus-visible:outline-none focus-visible:bg-[#EAF4F7] focus-visible:text-[#057091] dark:focus-visible:bg-[#057091]/25 dark:focus-visible:text-[#58B1CD] whitespace-nowrap cursor-pointer transition-colors"
                  >
                    加入兄弟
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    aria-disabled="false"
                    onClick={() => {
                      onToggleAddMenu?.(null);
                      onAddSibling?.(person.id, 'female');
                    }}
                    className="w-full px-4 py-2.5 text-left text-[14px] font-medium leading-[1.35] text-[#202121] dark:text-foreground hover:bg-[#F2F3F4] dark:hover:bg-accent active:bg-[#E7E9EA] dark:active:bg-accent/80 focus-visible:outline-none focus-visible:bg-[#EAF4F7] focus-visible:text-[#057091] dark:focus-visible:bg-[#057091]/25 dark:focus-visible:text-[#58B1CD] whitespace-nowrap cursor-pointer transition-colors"
                  >
                    加入姐妹
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* 主体内容区：统一为圆形头像 + 横排姓名 */}
        <div className="flex-1 w-full min-h-0 flex flex-col items-center justify-start overflow-hidden px-[10px] pt-[28px] pb-[4px] pointer-events-none">
          <div
            aria-hidden="true"
            className={`w-[72px] h-[72px] rounded-full overflow-hidden border flex items-center justify-center shrink-0 select-none ${
              hasAvatar
                ? 'border-black/[0.08] dark:border-slate-700 bg-[#F2F3F4] dark:bg-slate-800'
                : `${avatarToneClass} text-[24px] font-bold`
            }`}
          >
            {hasAvatar ? (
              <img
                src={avatarSrc}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{displayName ? displayName.slice(0, 1) : '族'}</span>
            )}
          </div>

          <div className="mt-[8px] w-full text-[15px] leading-[1.25] font-medium text-[#202121] dark:text-foreground text-center line-clamp-2 break-words">
            {displayName}
          </div>
        </div>

        {/* 底部统一对齐区：姓名拼音 + 公历生殁年份（增加底部留白） */}
        <div className="w-full shrink-0 px-[10px] pb-[24px] flex flex-col items-center gap-[3px] pointer-events-none">
          {pinyinName ? (
            <div
              lang="zh-Latn"
              className="w-full text-[12px] leading-[1.3] text-[rgba(0,3,5,0.737)] dark:text-muted-foreground text-center truncate"
            >
              {pinyinName}
            </div>
          ) : (
            <div className="min-h-[15.6px] w-full" aria-hidden="true" />
          )}

          <div className="w-full text-[12px] leading-[1.3] text-[rgba(0,3,5,0.737)] dark:text-muted-foreground tabular-nums text-center truncate">
            {gregorianLifespan}
          </div>
        </div>
      </div>
    );
  }
);

PersonNode.displayName = 'PersonNode';
