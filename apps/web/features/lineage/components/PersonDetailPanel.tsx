import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns2,
  PanelRightClose,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  BiographyPreviewPreferences,
  DrawerLayoutMode,
  PersonRecord,
  SpouseInfo,
} from '../types';
import {
  computeRankDisplay,
  EDUCATION_LEVEL_OPTIONS,
  getDerivedChildren,
  getDescendantExclusionSet,
  GRADUATION_STATUS_OPTIONS,
  hydratePersonDraft,
  normalizePersonForSave,
  RELATION_TYPE_OPTIONS,
  SPOUSE_RELATION_OPTIONS,
} from '../utils/personHelpers';
import { formatGivenName } from '../utils/nameUtils';
import { BiographyLivePreview } from './BiographyLivePreview';

interface PersonDetailPanelProps {
  person: PersonRecord | null;
  allPersons: PersonRecord[];
  clanSurname?: string;
  drawerMode: DrawerLayoutMode;
  onChangeDrawerMode: (mode: DrawerLayoutMode) => void;
  previewPrefs: BiographyPreviewPreferences;
  onUpdatePreviewPrefs: (updates: Partial<BiographyPreviewPreferences>) => void;
  onUpdatePerson: (id: string, updates: Partial<PersonRecord>) => void;
  onDeletePerson: (id: string) => void;
  onAddChild: (fatherId: string) => void;
  onSelectPerson: (personId: string | null) => void;
  onReorderSibling: (
    parentId: string,
    childId: string,
    direction: 'up' | 'down'
  ) => void;
  width: number;
  onClose?: () => void;
}

export const PersonDetailPanel: React.FC<PersonDetailPanelProps> = ({
  person,
  allPersons,
  clanSurname = '',
  drawerMode,
  onChangeDrawerMode,
  previewPrefs,
  onUpdatePreviewPrefs,
  onUpdatePerson,
  onDeletePerson,
  onAddChild,
  onSelectPerson,
  onReorderSibling,
  width,
  onClose,
}) => {
  const [formData, setFormData] = useState<PersonRecord | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [confirmDeleteSelf, setConfirmDeleteSelf] = useState(false);
  const [confirmDeleteChildId, setConfirmDeleteChildId] = useState<
    string | null
  >(null);
  const [pendingNavigateChildId, setPendingNavigateChildId] = useState<
    string | null
  >(null);

  // Progressive disclosure states
  const [openBirthDetail, setOpenBirthDetail] = useState(false);
  const [openCareerDetail, setOpenCareerDetail] = useState(false);
  const [openDeathDetail, setOpenDeathDetail] = useState(false);
  const [openLineageMeta, setOpenLineageMeta] = useState(false);
  const [openSpouseList, setOpenSpouseList] = useState(false);
  const [openChildList, setOpenChildList] = useState(false);
  const [openPrivateSection, setOpenPrivateSection] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const privateSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (person) {
      const hydrated = hydratePersonDraft(person, clanSurname);
      setFormData(hydrated);
      setIsDirty(false);
      setConfirmDeleteSelf(false);
      setConfirmDeleteChildId(null);
      setPendingNavigateChildId(null);

      // Auto-open progressive sections if they already contain user data
      setOpenBirthDetail(
        Boolean(hydrated.birth?.place || hydrated.birth?.summary)
      );
      setOpenCareerDetail(
        Boolean(
          hydrated.career?.school ||
            hydrated.career?.major ||
            hydrated.career?.educationLevel ||
            hydrated.career?.resume ||
            hydrated.career?.lifeSummary
        )
      );
      setOpenDeathDetail(
        Boolean(hydrated.death?.summary || hydrated.death?.age)
      );
      setOpenLineageMeta(
        Boolean(
          hydrated.relationTitle ||
            hydrated.relationPrefix ||
            hydrated.branchLabel ||
            hydrated.headingLine ||
            hydrated.sequenceMeta?.originalPage
        )
      );
      setOpenPrivateSection(
        Boolean(
          hydrated.privateInfo?.idCardName ||
            hydrated.privateInfo?.idCardNum ||
            hydrated.privateInfo?.mobile ||
            hydrated.privateInfo?.address
        )
      );
    } else {
      setFormData(null);
    }
  }, [person, clanSurname]);

  useEffect(() => {
    if (!confirmDeleteSelf) return;
    const timer = setTimeout(() => setConfirmDeleteSelf(false), 2500);
    return () => clearTimeout(timer);
  }, [confirmDeleteSelf]);

  useEffect(() => {
    if (!confirmDeleteChildId) return;
    const timer = setTimeout(() => setConfirmDeleteChildId(null), 2500);
    return () => clearTimeout(timer);
  }, [confirmDeleteChildId]);

  const handleSave = useCallback(() => {
    if (!person || !formData) return;
    const normalized = normalizePersonForSave(formData, allPersons);
    onUpdatePerson(person.id, normalized);
    setFormData(hydratePersonDraft(normalized, clanSurname));
    setIsDirty(false);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2200);
  }, [person, formData, allPersons, onUpdatePerson, clanSurname]);

  // Support Ctrl+S / Cmd+S shortcut while drawer is mounted
  useEffect(() => {
    if (!person) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [person, handleSave]);

  const excludedParentIds = useMemo(
    () => (person ? getDescendantExclusionSet(allPersons, person.id) : new Set<string>()),
    [allPersons, person]
  );

  const eligibleParents = useMemo(
    () => allPersons.filter((p) => !excludedParentIds.has(p.id)),
    [allPersons, excludedParentIds]
  );

  const derivedChildren = useMemo(
    () => (person ? getDerivedChildren(allPersons, person.id) : []),
    [allPersons, person]
  );

  if (!person || !formData) return null;

  const rankDisplay = computeRankDisplay(formData, allPersons);
  const effectiveSurname = formData.surname?.trim() || clanSurname;
  const headerDisplayName = formatGivenName(formData.name, effectiveSurname);

  const markDirty = (updater: (prev: PersonRecord) => PersonRecord) => {
    setFormData((prev) => (prev ? updater(prev) : prev));
    setIsDirty(true);
  };

  const handleFieldChange = <K extends keyof PersonRecord>(
    field: K,
    value: PersonRecord[K]
  ) => {
    markDirty((prev) => ({ ...prev, [field]: value }));
  };

  const handleParentSelect = (parentId: string) => {
    const nextParentId = parentId || null;
    const parent = nextParentId
      ? allPersons.find((p) => p.id === nextParentId)
      : null;
    markDirty((prev) => ({
      ...prev,
      fatherId: nextParentId,
      fatherName: parent ? parent.name : undefined,
      generation: parent ? parent.generation + 1 : 1,
    }));
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleFieldChange('avatarUrl', reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Spouse operations (embedded lightweight ordered array)
  const handleAddSpouse = () => {
    setOpenSpouseList(true);
    markDirty((prev) => ({
      ...prev,
      spouses: [
        ...(prev.spouses || []),
        {
          id: `spouse-${Date.now()}`,
          relationLabel: prev.spouses?.length ? '继配' : '原配',
          prefix: '',
          name: '',
          clanOrigin: '',
          remarks: '',
        },
      ],
    }));
  };

  const handleUpdateSpouse = (
    index: number,
    field: keyof SpouseInfo,
    value: string
  ) => {
    markDirty((prev) => {
      const next = [...(prev.spouses || [])];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value };
      }
      return { ...prev, spouses: next };
    });
  };

  const handleMoveSpouse = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    markDirty((prev) => {
      const next = [...(prev.spouses || [])];
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, spouses: next };
    });
  };

  const handleRemoveSpouse = (index: number) => {
    markDirty((prev) => {
      const next = [...(prev.spouses || [])];
      next.splice(index, 1);
      return { ...prev, spouses: next };
    });
  };

  const handleEnterChild = (childId: string) => {
    if (isDirty) {
      setPendingNavigateChildId(childId);
      return;
    }
    onSelectPerson(childId);
  };

  const handleJumpToPrivate = () => {
    setOpenPrivateSection(true);
    setTimeout(() => {
      privateSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 60);
  };

  return (
    <div
      style={{ width }}
      className="h-full max-w-[calc(100%-48px)] bg-card border-l border-border flex flex-col overflow-hidden shrink-0 select-none relative z-20"
    >
      {/* 1. Drawer Top Header */}
      <div className="h-13 px-4 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-muted/20">
        <div className="flex items-center gap-2.5 min-w-0">
          {formData.avatarUrl ? (
            <img
              src={formData.avatarUrl}
              alt={headerDisplayName || '族人头像'}
              className="w-8 h-8 rounded-full object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 font-serif">
              {headerDisplayName ? headerDisplayName.slice(-1) : '族'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <h3 className="font-bold text-sm text-foreground font-serif truncate">
                {headerDisplayName || '未命名'}
              </h3>
              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
                · 第 {formData.generation} 世 ·{' '}
                {formData.status === 'living' ? '健在' : '已故'}
              </span>
            </div>
            {isDirty && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                有未保存改动（Ctrl+S 保存）
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showSavedToast && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium whitespace-nowrap">
              <CheckCircle2 size={12} /> 已保存
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChangeDrawerMode(drawerMode === 'narrow' ? 'wide' : 'narrow')
            }
            className="h-7 px-2 text-[11px] gap-1 whitespace-nowrap shrink-0"
            title={
              drawerMode === 'narrow'
                ? '切换宽版双栏（含实时行传预览）'
                : '切回窄版速编'
            }
          >
            {drawerMode === 'narrow' ? (
              <>
                <Columns2 size={12} />
                <span>宽版预览</span>
              </>
            ) : (
              <>
                <PanelRightClose size={12} />
                <span>窄版速编</span>
              </>
            )}
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onClose}
              title="关闭人物抽屉"
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* 2. Main Split Workspace: Left Form + Optional Right Live Preview */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Scrollable Edit Form */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-5 text-xs">
          {/* A. Photo, Gender, Vital Status & Name Grid */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              {/* Compact Avatar Uploader */}
              <div className="relative shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-20 rounded-lg border border-border bg-muted/30 hover:border-primary/60 flex flex-col items-center justify-center overflow-hidden transition-colors cursor-pointer group"
                  title="点击上传或更换照片"
                >
                  {formData.avatarUrl ? (
                    <img
                      src={formData.avatarUrl}
                      alt={formData.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <Camera
                        size={16}
                        className="text-muted-foreground group-hover:text-primary mb-1"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        传照
                      </span>
                    </>
                  )}
                </button>
                {formData.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => handleFieldChange('avatarUrl', undefined)}
                    title="移除照片"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-background border border-border text-muted-foreground hover:text-destructive flex items-center justify-center text-[10px] cursor-pointer shadow-2xs"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Gender, Living Status & Primary Names */}
              <div className="flex-1 min-w-0 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      性别
                    </label>
                    <div className="grid grid-cols-2 p-0.5 rounded-md border border-input bg-muted/30 h-8">
                      {(
                        [
                          { value: 'male', label: '男' },
                          { value: 'female', label: '女' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleFieldChange('gender', opt.value)}
                          className={`rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            formData.gender === opt.value
                              ? 'bg-background text-foreground shadow-2xs font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      是否健在
                    </label>
                    <div className="grid grid-cols-2 p-0.5 rounded-md border border-input bg-muted/30 h-8">
                      {(
                        [
                          { value: 'living', label: '健在' },
                          { value: 'deceased', label: '已故' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleFieldChange('status', opt.value)}
                          className={`rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            formData.status === opt.value
                              ? 'bg-background text-foreground shadow-2xs font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3-Column Name Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      姓氏
                    </label>
                    <Input
                      value={formData.surname || ''}
                      onChange={(e) =>
                        handleFieldChange('surname', e.target.value)
                      }
                      placeholder={clanSurname || '姓氏'}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      谱名 *
                    </label>
                    <Input
                      value={formData.name || ''}
                      onChange={(e) =>
                        handleFieldChange('name', e.target.value)
                      }
                      placeholder="谱名"
                      className="h-8 text-xs font-semibold font-serif"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      常用名
                    </label>
                    <Input
                      value={formData.legalName || ''}
                      onChange={(e) =>
                        handleFieldChange('legalName', e.target.value)
                      }
                      placeholder="身份证姓名"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Alias / Zi / Hao + HangOrder + Lineage Remarks */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <label className="block text-[11px] text-muted-foreground mb-1">
                  字 / 号 / 别名
                </label>
                <Input
                  value={formData.courtesyName || ''}
                  onChange={(e) =>
                    handleFieldChange('courtesyName', e.target.value)
                  }
                  placeholder="字、号、讳、谥号、小名等"
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[11px] text-muted-foreground mb-1">
                  行第
                </label>
                <Input
                  value={formData.hangOrder || ''}
                  onChange={(e) =>
                    handleFieldChange('hangOrder', e.target.value)
                  }
                  placeholder="如：行十八"
                  className="h-8 text-xs"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[11px] text-muted-foreground mb-1">
                  世系备注
                </label>
                <Input
                  value={formData.lineageRemarks || ''}
                  onChange={(e) =>
                    handleFieldChange('lineageRemarks', e.target.value)
                  }
                  placeholder="如：迁江西"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* B. Parents, Relation & Rank */}
          <div className="space-y-2.5 pt-3 border-t border-border/70">
            <div className="text-[11px] font-semibold text-muted-foreground">
              父母与承祧世系
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="block text-[11px] text-muted-foreground mb-1">
                  父亲（图谱父节点）
                </label>
                <select
                  value={formData.fatherId || ''}
                  onChange={(e) => handleParentSelect(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">-- 无父节点（始祖） --</option>
                  {eligibleParents.map((p) => (
                    <option key={p.id} value={p.id}>
                      第{p.generation}世 ·{' '}
                      {formatGivenName(p.name, effectiveSurname)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <label className="block text-[11px] text-muted-foreground mb-1">
                  关系类别
                </label>
                <select
                  value={formData.relationType || '生子'}
                  onChange={(e) =>
                    handleFieldChange('relationType', e.target.value)
                  }
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
                >
                  {RELATION_TYPE_OPTIONS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className="block text-[11px] text-muted-foreground mb-1">
                  排行（只读）
                </label>
                <Input
                  value={rankDisplay}
                  readOnly
                  className="h-8 text-xs bg-muted/40 text-muted-foreground tabular-nums cursor-default"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  生母姓氏
                </label>
                <Input
                  value={formData.motherName || ''}
                  onChange={(e) =>
                    handleFieldChange('motherName', e.target.value)
                  }
                  placeholder="如：李氏"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  字辈派语
                </label>
                <Input
                  value={formData.generationWord || ''}
                  onChange={(e) =>
                    handleFieldChange('generationWord', e.target.value)
                  }
                  placeholder="如：伯"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  世次
                </label>
                <Input
                  type="number"
                  min={1}
                  value={formData.generation ?? 1}
                  onChange={(e) =>
                    handleFieldChange(
                      'generation',
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  className="h-8 text-xs tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* C. Birth Section (Progressive Disclosure) */}
          <div className="space-y-2.5 pt-3 border-t border-border/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">
                生辰与出生
              </span>
              <button
                type="button"
                onClick={() => setOpenBirthDetail((v) => !v)}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                {openBirthDetail ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span>{openBirthDetail ? '收起出生详述' : '展开出生详述'}</span>
              </button>
            </div>

            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                出生日期（公历 / 农历时辰）
              </label>
              <Input
                value={formData.birth?.date || ''}
                onChange={(e) =>
                  markDirty((prev) => ({
                    ...prev,
                    birth: { ...(prev.birth || {}), date: e.target.value },
                  }))
                }
                placeholder="如：明洪武十八年乙丑三月初六日亥时"
                className="h-8 text-xs"
              />
            </div>

            {openBirthDetail && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    出生地
                  </label>
                  <Input
                    value={formData.birth?.place || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        birth: { ...(prev.birth || {}), place: e.target.value },
                      }))
                    }
                    placeholder="省市县或原籍地名"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    出生描述
                  </label>
                  <Input
                    value={formData.birth?.summary || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        birth: {
                          ...(prev.birth || {}),
                          summary: e.target.value,
                        },
                      }))
                    }
                    placeholder="出生时序或纪略"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* D. Career & Education Section (Progressive Disclosure) */}
          <div className="space-y-2.5 pt-3 border-t border-border/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">
                文化程度、职务与生平
              </span>
              <button
                type="button"
                onClick={() => setOpenCareerDetail((v) => !v)}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                {openCareerDetail ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                <span>
                  {openCareerDetail ? '收起学历履历' : '展开学历与履历'}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  职务
                </label>
                <Input
                  value={formData.career?.profession || ''}
                  onChange={(e) =>
                    markDirty((prev) => ({
                      ...prev,
                      career: {
                        ...(prev.career || {}),
                        profession: e.target.value,
                      },
                    }))
                  }
                  placeholder="单位名称 + 职务"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  功名 / 头衔
                </label>
                <Input
                  value={formData.career?.title || ''}
                  onChange={(e) =>
                    markDirty((prev) => ({
                      ...prev,
                      career: {
                        ...(prev.career || {}),
                        title: e.target.value,
                      },
                    }))
                  }
                  placeholder="奉议大夫 / 荣誉称号"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {openCareerDetail && (
              <div className="space-y-2 pt-0.5">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    文化程度简述
                  </label>
                  <Input
                    value={formData.career?.educationSummary || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        career: {
                          ...(prev.career || {}),
                          educationSummary: e.target.value,
                        },
                      }))
                    }
                    placeholder="学校 专业 学历（如：清华大学 建筑学 本科 毕业）"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={formData.career?.school || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        career: {
                          ...(prev.career || {}),
                          school: e.target.value,
                        },
                      }))
                    }
                    placeholder="就读学校"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={formData.career?.major || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        career: {
                          ...(prev.career || {}),
                          major: e.target.value,
                        },
                      }))
                    }
                    placeholder="就读专业"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.career?.educationLevel || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        career: {
                          ...(prev.career || {}),
                          educationLevel: e.target.value,
                        },
                      }))
                    }
                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                  >
                    <option value="">选择学历</option>
                    {EDUCATION_LEVEL_OPTIONS.map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.career?.graduationStatus || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        career: {
                          ...(prev.career || {}),
                          graduationStatus: e.target.value,
                        },
                      }))
                    }
                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                  >
                    <option value="">修业状态</option>
                    {GRADUATION_STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  value={formData.career?.resume || ''}
                  onChange={(e) =>
                    markDirty((prev) => ({
                      ...prev,
                      career: {
                        ...(prev.career || {}),
                        resume: e.target.value,
                      },
                    }))
                  }
                  placeholder="履历摘要"
                  className="h-8 text-xs"
                />
                <Input
                  value={formData.career?.lifeSummary || ''}
                  onChange={(e) =>
                    markDirty((prev) => ({
                      ...prev,
                      career: {
                        ...(prev.career || {}),
                        lifeSummary: e.target.value,
                      },
                    }))
                  }
                  placeholder="生平记述（如：功德善行、仕途迁转）"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          {/* E. Death & Burial Section (Hidden neatly if living unless expanded) */}
          {formData.status === 'deceased' && (
            <div className="space-y-2.5 pt-3 border-t border-border/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  卒葬与墓茔山向
                </span>
                <button
                  type="button"
                  onClick={() => setOpenDeathDetail((v) => !v)}
                  className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  {openDeathDetail ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                  <span>
                    {openDeathDetail ? '收起享寿与详述' : '展开享寿与详述'}
                  </span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  去世时间（公历 / 农历时辰）
                </label>
                <Input
                  value={formData.death?.date || ''}
                  onChange={(e) =>
                    markDirty((prev) => ({
                      ...prev,
                      death: { ...(prev.death || {}), date: e.target.value },
                    }))
                  }
                  placeholder="如：明永乐二十一年癸卯九月十二日未时"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-muted-foreground mb-1">
                  卒葬地与墓址坐向
                </label>
                <Input
                  value={formData.death?.burialPlace || ''}
                  onChange={(e) =>
                    markDirty((prev) => ({
                      ...prev,
                      death: {
                        ...(prev.death || {}),
                        burialPlace: e.target.value,
                      },
                    }))
                  }
                  placeholder="如：狮子山金钗穴，坐北朝南兼子午三分"
                  className="h-8 text-xs"
                />
              </div>

              {openDeathDetail && (
                <div className="grid grid-cols-12 gap-2 pt-0.5">
                  <div className="col-span-4">
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      享寿（岁）
                    </label>
                    <Input
                      type="number"
                      min={0}
                      value={formData.death?.age ?? ''}
                      onChange={(e) =>
                        markDirty((prev) => ({
                          ...prev,
                          death: {
                            ...(prev.death || {}),
                            age: parseInt(e.target.value, 10) || undefined,
                          },
                        }))
                      }
                      placeholder="78"
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                  <div className="col-span-8">
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      卒葬描述
                    </label>
                    <Input
                      value={formData.death?.summary || ''}
                      onChange={(e) =>
                        markDirty((prev) => ({
                          ...prev,
                          death: {
                            ...(prev.death || {}),
                            summary: e.target.value,
                          },
                        }))
                      }
                      placeholder="迁葬、合葬或立碑说明"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* F. Biography & Tail Remarks */}
          <div className="space-y-2.5 pt-3 border-t border-border/70">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                传记简介
              </label>
              <textarea
                value={formData.biography || ''}
                onChange={(e) =>
                  handleFieldChange('biography', e.target.value)
                }
                rows={3}
                placeholder="记录先祖生平事略、功德善行、迁徙源流等..."
                className="w-full p-2.5 text-xs rounded-md border border-input bg-background resize-y leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                末尾备注（显示在行传与配偶子女信息尾部）
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={2}
                placeholder="补充考订或按语备注..."
                className="w-full p-2 text-xs rounded-md border border-input bg-background resize-y leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          {/* G. Branch, Heading Line, Title & Original Genealogy Meta (Collapsed by default) */}
          <div className="pt-3 border-t border-border/70">
            <button
              type="button"
              onClick={() => setOpenLineageMeta((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
            >
              <span>分房、题行与原谱世序关联</span>
              <span className="flex items-center gap-1 text-primary font-normal">
                {openLineageMeta ? (
                  <>
                    <ChevronDown size={13} /> 收起
                  </>
                ) : (
                  <>
                    <ChevronRight size={13} /> 展开
                  </>
                )}
              </span>
            </button>

            {openLineageMeta && (
              <div className="space-y-2.5 pt-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      自定义关系称谓
                    </label>
                    <Input
                      value={formData.relationTitle || ''}
                      onChange={(e) =>
                        handleFieldChange('relationTitle', e.target.value)
                      }
                      placeholder="如：始迁祖 / 某某之子"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      姓名前缀
                    </label>
                    <Input
                      value={formData.relationPrefix || ''}
                      onChange={(e) =>
                        handleFieldChange('relationPrefix', e.target.value)
                      }
                      placeholder="如：左徒 / 赠公"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      分房归属
                    </label>
                    <Input
                      value={formData.branchLabel || ''}
                      onChange={(e) =>
                        handleFieldChange('branchLabel', e.target.value)
                      }
                      placeholder="如：长房 / 小田幼房"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      题行
                    </label>
                    <Input
                      value={formData.headingLine || ''}
                      onChange={(e) =>
                        handleFieldChange('headingLine', e.target.value)
                      }
                      placeholder="行传版面题行"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      主世序
                    </label>
                    <div className="flex gap-1">
                      <Input
                        value={formData.sequenceMeta?.mainLabel || ''}
                        onChange={(e) =>
                          markDirty((prev) => ({
                            ...prev,
                            sequenceMeta: {
                              ...(prev.sequenceMeta || {}),
                              mainLabel: e.target.value,
                            },
                          }))
                        }
                        placeholder="始祖讳"
                        className="h-8 text-xs min-w-0"
                      />
                      <Input
                        type="number"
                        value={formData.sequenceMeta?.mainNumber ?? ''}
                        onChange={(e) =>
                          markDirty((prev) => ({
                            ...prev,
                            sequenceMeta: {
                              ...(prev.sequenceMeta || {}),
                              mainNumber:
                                parseInt(e.target.value, 10) || undefined,
                            },
                          }))
                        }
                        placeholder="#"
                        className="h-8 text-xs w-14 tabular-nums shrink-0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      子世序
                    </label>
                    <div className="flex gap-1">
                      <Input
                        value={formData.sequenceMeta?.subLabel || ''}
                        onChange={(e) =>
                          markDirty((prev) => ({
                            ...prev,
                            sequenceMeta: {
                              ...(prev.sequenceMeta || {}),
                              subLabel: e.target.value,
                            },
                          }))
                        }
                        placeholder="支祖讳"
                        className="h-8 text-xs min-w-0"
                      />
                      <Input
                        type="number"
                        value={formData.sequenceMeta?.subNumber ?? ''}
                        onChange={(e) =>
                          markDirty((prev) => ({
                            ...prev,
                            sequenceMeta: {
                              ...(prev.sequenceMeta || {}),
                              subNumber:
                                parseInt(e.target.value, 10) || undefined,
                            },
                          }))
                        }
                        placeholder="#"
                        className="h-8 text-xs w-14 tabular-nums shrink-0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      原谱页码
                    </label>
                    <Input
                      type="number"
                      value={formData.sequenceMeta?.originalPage ?? ''}
                      onChange={(e) =>
                        markDirty((prev) => ({
                          ...prev,
                          sequenceMeta: {
                            ...(prev.sequenceMeta || {}),
                            originalPage:
                              parseInt(e.target.value, 10) || undefined,
                          },
                        }))
                      }
                      placeholder="页码"
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    关系备注
                  </label>
                  <Input
                    value={formData.relationNotes || ''}
                    onChange={(e) =>
                      handleFieldChange('relationNotes', e.target.value)
                    }
                    placeholder="过继、入赘、兼祧等说明"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* H. Spouses Table (Lightweight Ordered Struct Array) */}
          <div className="pt-3 border-t border-border/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpenSpouseList((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground hover:text-primary cursor-pointer"
              >
                {openSpouseList ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
                <span className="tabular-nums">
                  配偶信息 ({formData.spouses?.length || 0})
                </span>
              </button>
              <button
                type="button"
                onClick={handleAddSpouse}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              >
                <Plus size={12} /> 添加配偶
              </button>
            </div>

            {openSpouseList && (
              <div className="border border-border rounded-lg overflow-hidden bg-background">
                {(formData.spouses || []).length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-muted-foreground">
                    暂无配偶记录，点击右上角「+ 添加配偶」录入
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {(formData.spouses || []).map((spouse, idx) => (
                      <div key={spouse.id || idx} className="p-2.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-4 shrink-0">
                              {idx + 1}.
                            </span>
                            <select
                              value={spouse.relationLabel || '原配'}
                              onChange={(e) =>
                                handleUpdateSpouse(
                                  idx,
                                  'relationLabel',
                                  e.target.value
                                )
                              }
                              className="h-7 px-1.5 text-[11px] rounded border border-input bg-card text-foreground shrink-0"
                            >
                              {SPOUSE_RELATION_OPTIONS.map((rel) => (
                                <option key={rel} value={rel}>
                                  {rel}
                                </option>
                              ))}
                            </select>
                            <Input
                              value={spouse.prefix || ''}
                              onChange={(e) =>
                                handleUpdateSpouse(
                                  idx,
                                  'prefix',
                                  e.target.value
                                )
                              }
                              placeholder="前缀"
                              className="h-7 text-[11px] w-16 shrink-0"
                            />
                            <Input
                              value={spouse.name || ''}
                              onChange={(e) =>
                                handleUpdateSpouse(idx, 'name', e.target.value)
                              }
                              placeholder="姓氏/名讳 如: 李氏"
                              className="h-7 text-[11px] font-medium flex-1 min-w-0"
                            />
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveSpouse(idx, 'up')}
                              disabled={idx === 0}
                              title="上移"
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSpouse(idx, 'down')}
                              disabled={
                                idx === (formData.spouses || []).length - 1
                              }
                              title="下移"
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSpouse(idx)}
                              title="删除配偶"
                              className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pl-5">
                          <Input
                            value={spouse.clanOrigin || ''}
                            onChange={(e) =>
                              handleUpdateSpouse(
                                idx,
                                'clanOrigin',
                                e.target.value
                              )
                            }
                            placeholder="郡望籍贯 如: 系出清河"
                            className="h-7 text-[11px]"
                          />
                          <Input
                            value={spouse.burialPlace || ''}
                            onChange={(e) =>
                              handleUpdateSpouse(
                                idx,
                                'burialPlace',
                                e.target.value
                              )
                            }
                            placeholder="合葬或墓址备注"
                            className="h-7 text-[11px]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* I. Derived Children Table (Single Source of Truth from fatherId Graph) */}
          <div className="pt-3 border-t border-border/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpenChildList((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground hover:text-primary cursor-pointer"
              >
                {openChildList ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
                <span className="tabular-nums">
                  子女信息 ({derivedChildren.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenChildList(true);
                  onAddChild(person.id);
                }}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              >
                <Plus size={12} /> 添加子女
              </button>
            </div>

            {pendingNavigateChildId && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-foreground">
                  当前人物尚有未保存改动：
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const target = pendingNavigateChildId;
                      handleSave();
                      setPendingNavigateChildId(null);
                      onSelectPerson(target);
                    }}
                    className="px-2 py-0.5 rounded bg-primary text-primary-foreground font-medium cursor-pointer"
                  >
                    保存并进入
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const target = pendingNavigateChildId;
                      setPendingNavigateChildId(null);
                      onSelectPerson(target);
                    }}
                    className="px-2 py-0.5 rounded border border-border bg-card text-foreground cursor-pointer"
                  >
                    放弃进入
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingNavigateChildId(null)}
                    className="px-1.5 py-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {openChildList && (
              <div className="border border-border rounded-lg overflow-hidden bg-background">
                {derivedChildren.length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-muted-foreground">
                    暂无子嗣节点，点击「+ 添加子女」直接挂接至本世系图
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                      <tr>
                        <th className="py-1.5 px-2 w-12">排序</th>
                        <th className="py-1.5 px-2 w-16">称谓</th>
                        <th className="py-1.5 px-2">姓名</th>
                        <th className="py-1.5 px-2 text-right w-24">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {derivedChildren.map((child, idx) => {
                        const isConfirmingChild =
                          confirmDeleteChildId === child.id;
                        return (
                          <tr
                            key={child.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-1.5 px-2 tabular-nums">
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() =>
                                    onReorderSibling(
                                      person.id,
                                      child.id,
                                      'up'
                                    )
                                  }
                                  title="上移顺序"
                                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp size={11} />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === derivedChildren.length - 1}
                                  onClick={() =>
                                    onReorderSibling(
                                      person.id,
                                      child.id,
                                      'down'
                                    )
                                  }
                                  title="下移顺序"
                                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown size={11} />
                                </button>
                              </div>
                            </td>
                            <td className="py-1.5 px-2 text-muted-foreground truncate">
                              {child.relationType ||
                                child.rank ||
                                (child.gender === 'female' ? '女' : '子')}
                            </td>
                            <td className="py-1.5 px-2 font-medium text-foreground font-serif">
                              {[
                                child.relationPrefix,
                                formatGivenName(child.name, effectiveSurname),
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEnterChild(child.id)}
                                  title="进入该子女档案"
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-card hover:border-primary hover:text-primary text-[10px] cursor-pointer whitespace-nowrap"
                                >
                                  进入 <ArrowUpRight size={10} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isConfirmingChild) {
                                      setConfirmDeleteChildId(null);
                                      onDeletePerson(child.id);
                                    } else {
                                      setConfirmDeleteChildId(child.id);
                                    }
                                  }}
                                  title={
                                    isConfirmingChild
                                      ? '确认删除该节点及后裔'
                                      : '删除该子女节点'
                                  }
                                  className={`p-1 rounded cursor-pointer ${
                                    isConfirmingChild
                                      ? 'bg-destructive text-destructive-foreground px-1.5 text-[10px]'
                                      : 'text-muted-foreground hover:text-destructive'
                                  }`}
                                >
                                  {isConfirmingChild ? (
                                    '删'
                                  ) : (
                                    <Trash2 size={11} />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* J. Private Real-Name & Contact Section (Independent Progressive Fold) */}
          <div
            ref={privateSectionRef}
            className="pt-3 border-t border-border/70 pb-2"
          >
            <button
              type="button"
              onClick={() => setOpenPrivateSection((v) => !v)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-primary" />
                <span>实名信息与联系方式</span>
              </span>
              <span className="flex items-center gap-1 text-primary font-normal">
                {openPrivateSection ? (
                  <>
                    <ChevronDown size={13} /> 收起
                  </>
                ) : (
                  <>
                    <ChevronRight size={13} /> 展开维护
                  </>
                )}
              </span>
            </button>

            {openPrivateSection && (
              <div className="space-y-2 pt-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      实名姓名
                    </label>
                    <Input
                      value={formData.privateInfo?.idCardName || ''}
                      onChange={(e) =>
                        markDirty((prev) => ({
                          ...prev,
                          privateInfo: {
                            ...(prev.privateInfo || {}),
                            idCardName: e.target.value,
                          },
                        }))
                      }
                      placeholder="证件法定姓名"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      联系电话
                    </label>
                    <Input
                      value={formData.privateInfo?.mobile || ''}
                      onChange={(e) =>
                        markDirty((prev) => ({
                          ...prev,
                          privateInfo: {
                            ...(prev.privateInfo || {}),
                            mobile: e.target.value,
                          },
                        }))
                      }
                      placeholder="手机号码"
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    身份证件号
                  </label>
                  <Input
                    value={formData.privateInfo?.idCardNum || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        privateInfo: {
                          ...(prev.privateInfo || {}),
                          idCardNum: e.target.value,
                        },
                      }))
                    }
                    placeholder="选填（仅用于宗亲实名核对）"
                    className="h-8 text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    现居地 / 联系地址
                  </label>
                  <Input
                    value={formData.privateInfo?.address || ''}
                    onChange={(e) =>
                      markDirty((prev) => ({
                        ...prev,
                        privateInfo: {
                          ...(prev.privateInfo || {}),
                          address: e.target.value,
                        },
                      }))
                    }
                    placeholder="省市区详细通讯地址"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Live Biography Preview Column (Rendered in Wide Mode) */}
        {drawerMode === 'wide' && (
          <BiographyLivePreview
            draft={formData}
            allPersons={allPersons}
            clanSurname={clanSurname}
            prefs={previewPrefs}
            onUpdatePrefs={onUpdatePreviewPrefs}
          />
        )}
      </div>

      {/* 3. Sticky Drawer Footer Actions */}
      <div className="px-4 h-13 border-t border-border bg-muted/20 flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs gap-1 whitespace-nowrap shrink-0"
            onClick={() => onAddChild(person.id)}
          >
            <Plus size={12} /> 添子女
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0 hidden sm:inline-flex"
            onClick={handleJumpToPrivate}
          >
            实名联系
          </Button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {person.generation > 1 && (
            <Button
              type="button"
              variant={confirmDeleteSelf ? 'destructive' : 'ghost'}
              size="sm"
              className={
                confirmDeleteSelf
                  ? 'h-8 px-2.5 text-xs whitespace-nowrap'
                  : 'h-8 w-8 p-0 text-muted-foreground hover:text-destructive'
              }
              onClick={() => {
                if (confirmDeleteSelf) {
                  setConfirmDeleteSelf(false);
                  onDeletePerson(person.id);
                } else {
                  setConfirmDeleteSelf(true);
                }
              }}
              title={confirmDeleteSelf ? '再次点击确认删除' : '删除该族人'}
            >
              {confirmDeleteSelf ? (
                <>
                  <Check size={12} className="mr-1" /> 确认删除
                </>
              ) : (
                <Trash2 size={13} />
              )}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8 px-3.5 text-xs gap-1.5 whitespace-nowrap shrink-0"
            onClick={handleSave}
          >
            <Save size={13} />
            <span>{isDirty ? '保存人物信息 *' : '保存人物信息'}</span>
            <span className="hidden md:inline text-[10px] opacity-75 font-mono">
              Ctrl+S
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
