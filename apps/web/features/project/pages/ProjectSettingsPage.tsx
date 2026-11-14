import React, { useEffect, useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AssetColorTheme } from '../../../types';
import { ProjectColoredIcon } from '../../../components/common/NocoIcons';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { useRouteContext } from '../../../hooks/useRouteContext';
import {
  ASSET_COLOR_PALETTES,
  useWorkspaceStore,
} from '../../../store/useWorkspaceStore';
import { useDataStore } from '../../../store/useDataStore';

const ProjectSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();

  const projects = useWorkspaceStore((s) => s.projects);
  const updateProject = useWorkspaceStore((s) => s.updateProject);
  const duplicateProject = useWorkspaceStore((s) => s.duplicateProject);
  const deleteProject = useWorkspaceStore((s) => s.deleteProject);
  const tables = useDataStore((s) => s.tables);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const projectTables = tables.filter(
    (t) => !t.projectId || t.projectId === activeProjectId
  );

  const [name, setName] = useState(activeProject?.name || '');
  const [description, setDescription] = useState(activeProject?.description || '');
  const [colorTheme, setColorTheme] = useState<AssetColorTheme>(
    activeProject?.colorTheme || 'sky'
  );
  const [defaultTableId, setDefaultTableId] = useState(
    activeProject?.defaultTableId || ''
  );
  const [savedToast, setSavedToast] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setName(activeProject.name);
      setDescription(activeProject.description || '');
      setColorTheme(activeProject.colorTheme);
      setDefaultTableId(activeProject.defaultTableId || '');
      setConfirmDelete(false);
    }
  }, [activeProject]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject || !name.trim()) return;
    updateProject(activeProject.id, {
      name: name.trim(),
      description: description.trim(),
      colorTheme,
      defaultTableId,
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
            管理「{activeProject?.name || '项目'}」的基础信息、图标配色与默认数据表。
          </p>
        </div>

        {/* General Project Info */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-[14px] font-semibold text-foreground">基本信息</h2>
          <form onSubmit={handleSave} className="space-y-4 max-w-lg">
            <div className="space-y-1.5">
              <Label htmlFor="project-name-input">项目名称</Label>
              <Input
                id="project-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="project-desc-input">项目描述</Label>
              <Textarea
                id="project-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="简要说明项目用途..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>图标配色</Label>
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
              <Label htmlFor="project-default-table">默认关联数据表</Label>
              <select
                id="project-default-table"
                value={defaultTableId}
                onChange={(e) => setDefaultTableId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="">未指定（打开首页概览）</option>
                {projectTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
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
                复制项目结构
              </div>
              <div className="text-[12px] text-muted-foreground">
                创建一个包含相同配置的副本项目。
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
