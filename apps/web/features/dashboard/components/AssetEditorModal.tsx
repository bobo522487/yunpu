import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Star, X } from 'lucide-react';
import { AssetColorTheme } from '../../../types';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import {
  AppColoredIcon,
  ProjectColoredIcon,
} from '../../../components/common/NocoIcons';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { DEFAULT_REGION_PATH } from '../data/regions';
import { RegionCascader } from './RegionCascader';
import { GenealogyBookPreview } from './GenealogyBookPreview';

export interface AssetEditorSubmitValues {
  name: string;
  description: string;
  colorTheme: AssetColorTheme;
  primarySurname?: string;
  region?: string;
  primaryName?: string;
  projectState?: '0' | '1';
  projectLevel?: number;
}

export interface AssetEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  kind: 'project' | 'app';
  initialValue?: {
    name: string;
    description?: string;
    colorTheme: AssetColorTheme;
    primarySurname?: string;
    region?: string;
    primaryName?: string;
    projectState?: '0' | '1';
    projectLevel?: number;
  };
  /** 提交进行中：禁用提交按钮（由接入方驱动 API 请求）。 */
  submitting?: boolean;
  /** 提交失败的错误回显（如 409 冲突）。 */
  error?: string | null;
  onClose: () => void;
  onSubmit: (values: AssetEditorSubmitValues) => void;
}

type FieldErrors = {
  name?: string;
  primarySurname?: string;
  region?: string;
  primaryName?: string;
};

export const AssetEditorModal: React.FC<AssetEditorModalProps> = ({
  open,
  mode,
  kind,
  initialValue,
  submitting = false,
  error = null,
  onClose,
  onSubmit,
}) => {
  const isDarkMode = usePreferencesStore((s) => s.isDarkMode);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const projects = useWorkspaceStore((s) => s.projects);

  const wsProjectsCount = useMemo(
    () => projects.filter((p) => p.workspaceId === activeWorkspaceId).length,
    [projects, activeWorkspaceId]
  );
  const maxProjectQuota = Math.max(10, wsProjectsCount + 1);
  const remainingQuota = Math.max(1, maxProjectQuota - wsProjectsCount);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [colorTheme, setColorTheme] = useState<AssetColorTheme>(
    kind === 'project' ? 'indigo' : 'indigo'
  );

  // 云谱项目专用字段
  const [primarySurname, setPrimarySurname] = useState('');
  const [region, setRegion] = useState(DEFAULT_REGION_PATH);
  const [primaryName, setPrimaryName] = useState('');
  const [projectState, setProjectState] = useState<'0' | '1'>('0');
  const [projectLevel, setProjectLevel] = useState<number>(1);
  const [hoverLevel, setHoverLevel] = useState<number>(0);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showHelpTip, setShowHelpTip] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setShowHelpTip(false);
    setHoverLevel(0);

    if (initialValue) {
      setName(initialValue.name);
      setDescription(initialValue.description || '');
      setColorTheme(initialValue.colorTheme);
      setPrimarySurname(initialValue.primarySurname || '');
      setRegion(initialValue.region || DEFAULT_REGION_PATH);
      setPrimaryName(initialValue.primaryName || '');
      setProjectState(initialValue.projectState || '0');
      setProjectLevel(initialValue.projectLevel || 1);
    } else {
      setName('');
      setDescription('');
      setColorTheme(kind === 'project' ? 'sky' : 'indigo');
      setPrimarySurname('');
      setRegion(DEFAULT_REGION_PATH);
      setPrimaryName('');
      setProjectState('0');
      setProjectLevel(1);
    }
  }, [open, initialValue, kind]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHelpTip) {
          setShowHelpTip(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose, showHelpTip]);

  useEffect(() => {
    if (!showHelpTip) return;
    const handleOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelpTip(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showHelpTip]);

  if (!open) return null;

  const title =
    kind === 'project'
      ? mode === 'create'
        ? '新建云谱项目'
        : '修改云谱项目'
      : mode === 'create'
      ? '新建应用'
      : '编辑应用信息';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (kind === 'app') {
      if (!name.trim()) {
        setErrors({ name: '请输入应用名称' });
        return;
      }
      onSubmit({
        name: name.trim(),
        description: description.trim(),
        colorTheme,
      });
      return;
    }

    const nextErrors: FieldErrors = {};
    if (!name.trim()) nextErrors.name = '请输入项目名称';
    if (!primarySurname.trim()) nextErrors.primarySurname = '请输入主姓氏';
    if (!region.trim()) nextErrors.region = '请选择项目所属地区';
    if (!primaryName.trim()) nextErrors.primaryName = '请输入主题名';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      colorTheme,
      primarySurname: primarySurname.trim(),
      region: region.trim(),
      primaryName: primaryName.trim(),
      projectState,
      projectLevel,
    });
  };

  // Compact modal for App creation/editing
  if (kind === 'app') {
    return createPortal(
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-xs"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <AppColoredIcon colorTheme={colorTheme} className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onClose}
              aria-label="关闭弹窗"
            >
              <X size={14} />
            </Button>
          </div>

          <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="asset-editor-name">应用名称</Label>
              <Input
                id="asset-editor-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({});
                }}
                placeholder="例如：售后工单门户"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asset-editor-desc">简介（可选）</Label>
              <Input
                id="asset-editor-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述用途..."
              />
            </div>

            <div className="space-y-2">
              <Label>图标配色</Label>
              <div className="flex items-center gap-2">
                {(Object.keys(ASSET_COLOR_PALETTES) as AssetColorTheme[]).map(
                  (key) => {
                    const p = ASSET_COLOR_PALETTES[key];
                    const selected = colorTheme === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setColorTheme(key)}
                        title={p.label}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center border-2 transition-all cursor-pointer ${
                          selected
                            ? 'border-primary scale-105'
                            : 'border-transparent hover:border-border'
                        }`}
                        style={{
                          backgroundColor: isDarkMode ? p.darkTileBg : p.tileBg,
                        }}
                      >
                        <AppColoredIcon colorTheme={key} className="w-4 h-4" />
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" size="sm" disabled={!name.trim()}>
                {mode === 'create' ? '立即创建' : '保存更改'}
              </Button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );
  }

  // Two-column 云谱项目 creation / edit modal
  const activeStar = hoverLevel || projectLevel;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-project-modal-title"
    >
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[840px] max-h-[92vh] rounded-xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: isDarkMode
                  ? ASSET_COLOR_PALETTES[colorTheme].darkTileBg
                  : ASSET_COLOR_PALETTES[colorTheme].tileBg,
              }}
            >
              <ProjectColoredIcon colorTheme={colorTheme} className="w-4 h-4" />
            </div>
            <h3
              id="cloud-project-modal-title"
              className="text-[15px] font-semibold text-foreground truncate"
            >
              {title}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full shrink-0"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            <X size={15} />
          </Button>
        </div>

        {/* Form Body + Footer */}
        <form
          onSubmit={handleFormSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[296px_1fr] overflow-y-auto md:overflow-hidden">
            {/* Left Column: Live Genealogy Book Cover Preview */}
            <div className="bg-[hsl(var(--surface-subtle))] border-b md:border-b-0 md:border-r border-border px-6 py-6 flex flex-col items-center justify-center shrink-0">
              <GenealogyBookPreview
                projectName={name}
                primaryName={primaryName}
                primarySurname={primarySurname}
                region={region}
                projectState={projectState}
                projectLevel={projectLevel}
                colorTheme={colorTheme}
              />
            </div>

            {/* Right Column: Structured Project Metadata Form */}
            <div className="p-5 md:px-6 md:py-5 overflow-y-auto space-y-4">
              {/* 项目名 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label
                    htmlFor="project-name-input"
                    className="text-[13px] font-medium text-foreground"
                  >
                    项目名 <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {name.length}/24
                  </span>
                </div>
                <Input
                  id="project-name-input"
                  value={name}
                  maxLength={24}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="请输入项目名称，限长24个字"
                  autoComplete="off"
                  autoFocus
                  className={
                    errors.name
                      ? 'border-destructive focus-visible:border-destructive'
                      : ''
                  }
                />
                {errors.name && (
                  <p className="text-[12px] text-destructive">{errors.name}</p>
                )}
              </div>

              {/* 姓氏 + 主题名 (2-col on sm+) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 姓氏 */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="project-surname-input"
                    className="text-[13px] font-medium text-foreground"
                  >
                    姓氏 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="project-surname-input"
                    value={primarySurname}
                    maxLength={24}
                    onChange={(e) => {
                      setPrimarySurname(e.target.value);
                      if (errors.primarySurname) {
                        setErrors((prev) => ({
                          ...prev,
                          primarySurname: undefined,
                        }));
                      }
                    }}
                    placeholder="如：陳，一旦确定，不可修改"
                    autoComplete="off"
                    className={
                      errors.primarySurname
                        ? 'border-destructive focus-visible:border-destructive'
                        : ''
                    }
                  />
                  {errors.primarySurname && (
                    <p className="text-[12px] text-destructive">
                      {errors.primarySurname}
                    </p>
                  )}
                </div>

                {/* 主题名 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label
                      htmlFor="project-primary-name-input"
                      className="text-[13px] font-medium text-foreground"
                    >
                      主题名 <span className="text-destructive">*</span>
                    </Label>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {primaryName.length}/10
                    </span>
                  </div>
                  <Input
                    id="project-primary-name-input"
                    value={primaryName}
                    maxLength={10}
                    onChange={(e) => {
                      setPrimaryName(e.target.value);
                      if (errors.primaryName) {
                        setErrors((prev) => ({
                          ...prev,
                          primaryName: undefined,
                        }));
                      }
                    }}
                    placeholder="如：義門陳氏宗谱，一旦确定，不可修改！"
                    autoComplete="off"
                    className={
                      errors.primaryName
                        ? 'border-destructive focus-visible:border-destructive'
                        : ''
                    }
                  />
                  {errors.primaryName && (
                    <p className="text-[12px] text-destructive">
                      {errors.primaryName}
                    </p>
                  )}
                </div>
              </div>

              {/* 地区 */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="project-region-trigger"
                  className="text-[13px] font-medium text-foreground"
                >
                  地区 <span className="text-destructive">*</span>
                </Label>
                <RegionCascader
                  id="project-region-trigger"
                  value={region}
                  onChange={(val) => {
                    setRegion(val);
                    if (errors.region) {
                      setErrors((prev) => ({ ...prev, region: undefined }));
                    }
                  }}
                  placeholder="请选择项目所属地区"
                  hasError={Boolean(errors.region)}
                />
                {errors.region && (
                  <p className="text-[12px] text-destructive">{errors.region}</p>
                )}
              </div>

              {/* 状态 + 重要等级 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-start">
                {/* 状态 */}
                <div className="space-y-1.5">
                  <Label className="text-[13px] font-medium text-foreground">
                    状态
                  </Label>
                  <div
                    role="radiogroup"
                    aria-label="项目状态"
                    className="grid grid-cols-2 p-1 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border h-9"
                  >
                    {[
                      { value: '0' as const, label: '进行中' },
                      { value: '1' as const, label: '已完成' },
                    ].map((opt) => {
                      const active = projectState === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setProjectState(opt.value)}
                          className={`rounded-md text-[13px] transition-all duration-150 whitespace-nowrap cursor-pointer ${
                            active
                              ? 'bg-card text-foreground font-semibold shadow-xs border border-border/60'
                              : 'text-muted-foreground font-medium hover:text-foreground'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 重要等级 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[13px] font-medium text-foreground">
                      重要等级
                    </Label>
                    <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                      {activeStar} 星
                    </span>
                  </div>
                  <div
                    className="h-9 px-3 rounded-md border border-input bg-background flex items-center gap-1.5 shadow-[var(--shadow-control)]"
                    onMouseLeave={() => setHoverLevel(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const filled = star <= activeStar;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverLevel(star)}
                          onClick={() => setProjectLevel(star)}
                          aria-label={`设为 ${star} 星重要等级`}
                          className="p-0.5 rounded-sm transition-transform duration-100 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 cursor-pointer"
                        >
                          <Star
                            size={17}
                            className={`transition-colors ${
                              filled
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/35 hover:text-amber-300'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 图标配色 */}
              <div className="space-y-1.5">
                <Label className="text-[13px] font-medium text-foreground">
                  封面与图标配色
                </Label>
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(ASSET_COLOR_PALETTES) as AssetColorTheme[]).map(
                    (key) => {
                      const p = ASSET_COLOR_PALETTES[key];
                      const selected = colorTheme === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setColorTheme(key)}
                          title={p.label}
                          aria-label={`选择${p.label}配色`}
                          className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 border text-[12px] font-medium transition-all cursor-pointer ${
                            selected
                              ? 'border-primary bg-primary/[0.08] text-foreground shadow-xs'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-[hsl(var(--border-strong))]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: isDarkMode ? p.darkTileBg : p.tileBg,
                            }}
                          >
                            <ProjectColoredIcon
                              colorTheme={key}
                              className="w-3 h-3"
                            />
                          </span>
                          <span>{p.label}</span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* 备注 */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="project-remarks-input"
                  className="text-[13px] font-medium text-foreground"
                >
                  备注
                </Label>
                <Textarea
                  id="project-remarks-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="请输入项目备注"
                  className="resize-none min-h-[68px] shadow-[var(--shadow-control)]"
                />
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="px-5 md:px-6 py-3.5 border-t border-border bg-[hsl(var(--surface-subtle))] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div ref={helpRef} className="relative flex items-center gap-3 text-[13px]">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span>可创建云谱项目数量</span>
                <span className="font-semibold tabular-nums text-foreground">
                  <span className="text-primary">{remainingQuota}</span>/{maxProjectQuota}
                </span>
              </div>

              <span aria-hidden="true" className="text-border">
                |
              </span>

              <button
                type="button"
                onClick={() => setShowHelpTip((v) => !v)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline cursor-pointer whitespace-nowrap"
              >
                <HelpCircle size={13} />
                <span>什么是云谱项目 ？</span>
              </button>

              {showHelpTip && (
                <div className="absolute left-0 bottom-9 w-72 sm:w-80 rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] p-3.5 z-20 animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[13px] font-semibold text-foreground mb-1">
                    什么是云谱项目？
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    云谱项目是用于家族谱牒编修、世系结构管理、数据模型维护与多人协作的独立项目单元。创建时确定的姓氏与主题名将作为族谱封面与归档标识。
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {error && (
                <p
                  role="alert"
                  className="text-[12px] text-destructive mr-1 max-w-[280px] text-right"
                >
                  {error}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
                className="h-8 px-4"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="h-8 px-5"
              >
                {submitting ? '保存中…' : '确定'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
