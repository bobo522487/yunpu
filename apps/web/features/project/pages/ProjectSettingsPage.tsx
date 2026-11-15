import React, { useEffect, useState } from 'react';
import { Check, Copy, Star, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AssetColorTheme } from '../../../types';
import { ProjectColoredIcon } from '../../../components/common/NocoIcons';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { RegionCascader } from '../../dashboard/components/RegionCascader';
import { DEFAULT_REGION_PATH } from '../../dashboard/data/regions';
import { useRouteContext } from '../../../hooks/useRouteContext';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';

const ProjectSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();

  const projects = useWorkspaceStore((s) => s.projects);
  const updateProject = useWorkspaceStore((s) => s.updateProject);
  const duplicateProject = useWorkspaceStore((s) => s.duplicateProject);
  const deleteProject = useWorkspaceStore((s) => s.deleteProject);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  const [name, setName] = useState(activeProject?.name || '');
  const [primarySurname, setPrimarySurname] = useState(
    activeProject?.primarySurname || ''
  );
  const [primaryName, setPrimaryName] = useState(
    activeProject?.primaryName || ''
  );
  const [region, setRegion] = useState(
    activeProject?.region || DEFAULT_REGION_PATH
  );
  const [projectState, setProjectState] = useState<'0' | '1'>(
    activeProject?.projectState || '0'
  );
  const [projectLevel, setProjectLevel] = useState<number>(
    activeProject?.projectLevel || 1
  );
  const [description, setDescription] = useState(
    activeProject?.description || ''
  );
  const [colorTheme, setColorTheme] = useState<AssetColorTheme>(
    activeProject?.colorTheme || 'sky'
  );

  const [savedToast, setSavedToast] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setName(activeProject.name);
      setPrimarySurname(activeProject.primarySurname || '');
      setPrimaryName(activeProject.primaryName || '');
      setRegion(activeProject.region || DEFAULT_REGION_PATH);
      setProjectState(activeProject.projectState || '0');
      setProjectLevel(activeProject.projectLevel || 1);
      setDescription(activeProject.description || '');
      setColorTheme(activeProject.colorTheme);
      setConfirmDelete(false);
    }
  }, [activeProject]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !name.trim()) return;
    updateProject(activeProject.id, {
      name: name.trim(),
      primarySurname: primarySurname.trim() || undefined,
      primaryName: primaryName.trim() || undefined,
      region: region.trim() || undefined,
      projectState,
      projectLevel,
      description: description.trim(),
      colorTheme,
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const handleDelete = () => {
    if (!activeProject) return;
    deleteProject(activeProject.id);
    navigate('/');
  };

  const colorKeys = Object.keys(ASSET_COLOR_PALETTES) as AssetColorTheme[];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-[18px] font-semibold text-foreground">项目设置</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            管理「{activeProject?.name || '云谱项目'}」的谱牒档案信息、所属地区与封面配色。
          </p>
        </div>

        {/* General Project Info */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-[14px] font-semibold text-foreground">基本信息</h2>
          <form onSubmit={handleSave} className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="project-name-input">项目名</Label>
              <Input
                id="project-name-input"
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="project-settings-surname">姓氏</Label>
                <Input
                  id="project-settings-surname"
                  value={primarySurname}
                  maxLength={24}
                  onChange={(e) => setPrimarySurname(e.target.value)}
                  placeholder="如：陳"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-settings-primary-name">主题名</Label>
                <Input
                  id="project-settings-primary-name"
                  value={primaryName}
                  maxLength={10}
                  onChange={(e) => setPrimaryName(e.target.value)}
                  placeholder="如：義門陳氏宗谱"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-settings-region">地区</Label>
              <RegionCascader
                id="project-settings-region"
                value={region}
                onChange={setRegion}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label>状态</Label>
                <div className="grid grid-cols-2 p-1 rounded-lg bg-[hsl(var(--surface-subtle))] border border-border h-9">
                  {[
                    { value: '0' as const, label: '进行中' },
                    { value: '1' as const, label: '已完成' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setProjectState(opt.value)}
                      className={`rounded-md text-[13px] transition-colors cursor-pointer ${
                        projectState === opt.value
                          ? 'bg-card text-foreground font-semibold shadow-xs border border-border/60'
                          : 'text-muted-foreground font-medium hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>重要等级</Label>
                <div className="h-9 px-3 rounded-md border border-input bg-background flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setProjectLevel(star)}
                      className="p-0.5 cursor-pointer"
                      aria-label={`设为 ${star} 星`}
                    >
                      <Star
                        size={16}
                        className={
                          star <= projectLevel
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/35'
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-desc-input">备注</Label>
              <Textarea
                id="project-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="请输入项目备注"
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>封面与图标配色</Label>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {colorKeys.map((key) => {
                  const p = ASSET_COLOR_PALETTES[key];
                  const selected = colorTheme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setColorTheme(key)}
                      title={p.label}
                      className={`h-9 px-2.5 rounded-lg border flex items-center gap-2 text-[12px] font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'border-primary bg-primary/[0.08] text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <ProjectColoredIcon colorTheme={key} className="w-4 h-4" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>项目 ID</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={activeProject?.id || ''}
                  disabled
                  className="font-mono text-xs bg-muted/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 shrink-0"
                  onClick={() => {
                    navigator.clipboard?.writeText(activeProject?.id || '');
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 1500);
                  }}
                >
                  {copiedId ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" size="sm" disabled={!name.trim()}>
                保存更改
              </Button>
              {savedToast && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  已保存项目设置
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Project Actions */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-[14px] font-semibold text-foreground">项目操作</h2>
          <div className="flex flex-wrap items-center justify-between gap-3 py-1">
            <div>
              <div className="text-[13px] font-medium text-foreground">
                复制云谱项目
              </div>
              <div className="text-[12px] text-muted-foreground">
                创建一个包含相同基础档案的副本项目。
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!activeProject) return;
                const copy = duplicateProject(activeProject.id);
                if (copy) navigate(`/projects/${copy.id}`);
              }}
              className="gap-1.5 whitespace-nowrap shrink-0"
            >
              <Copy size={13} /> 复制项目
            </Button>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-wrap items-center justify-between gap-3 py-1">
            <div>
              <div className="text-[13px] font-medium text-destructive">
                删除当前项目
              </div>
              <div className="text-[12px] text-muted-foreground">
                删除后该项目将从工作区项目列表中移除。
              </div>
            </div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  className="gap-1.5 whitespace-nowrap"
                >
                  确认删除
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10 whitespace-nowrap shrink-0"
              >
                <Trash2 size={13} /> 删除项目
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProjectSettingsPage;
