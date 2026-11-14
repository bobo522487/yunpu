import React, { useState, useEffect } from 'react';
import { Check, Copy, Monitor, Moon, Sun } from 'lucide-react';
import { useWorkspaceStore } from '../../../store/useWorkspaceStore';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { AppTheme, ThemeMode } from '../../../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const WorkspaceSettingsPage: React.FC = () => {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);

  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const theme = usePreferencesStore((s) => s.theme);
  const setAppTheme = usePreferencesStore((s) => s.setAppTheme);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const [wsName, setWsName] = useState(activeWorkspace?.name || '');
  const [savedToast, setSavedToast] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setWsName(activeWorkspace?.name || '');
  }, [activeWorkspace?.id, activeWorkspace?.name]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !activeWorkspace) return;
    updateWorkspace(activeWorkspace.id, { name: wsName.trim() });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  };

  const modes: { id: ThemeMode; label: string; icon: React.ElementType }[] = [
    { id: 'system', label: '跟随系统', icon: Monitor },
    { id: 'light', label: '浅色模式', icon: Sun },
    { id: 'dark', label: '深色模式', icon: Moon },
  ];

  const accentThemes: { id: AppTheme; label: string; swatch: string }[] = [
    { id: 'vercel', label: 'Vercel', swatch: '#18181B' },
    { id: 'supabase', label: 'Supabase', swatch: '#3ECF8E' },
    { id: 'slack', label: 'Slack', swatch: '#611F69' },
    { id: 'vscode', label: 'VS Code', swatch: '#007ACC' },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">工作区设置</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            管理当前工作区的基本信息与全局外观偏好。
          </p>
        </div>

        {/* General Card */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-[14px] font-semibold text-foreground">基本信息</h2>
          <form onSubmit={handleSaveName} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name-input">工作区名称</Label>
              <Input
                id="ws-name-input"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>工作区 ID</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={activeWorkspace?.id || ''}
                  disabled
                  className="font-mono text-xs bg-muted/40"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 shrink-0"
                  onClick={() => {
                    navigator.clipboard?.writeText(activeWorkspace?.id || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={!wsName.trim()}>
                保存更改
              </Button>
              {savedToast && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  已保存工作区设置
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Appearance Card */}
        <section className="rounded-xl border border-border bg-card p-5 space-y-5">
          <h2 className="text-[14px] font-semibold text-foreground">外观与主题</h2>

          <div className="space-y-2">
            <Label>显示模式</Label>
            <div className="grid grid-cols-3 gap-2.5 max-w-md">
              {modes.map((m) => {
                const Icon = m.icon;
                const active = themeMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setThemeMode(m.id)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-[13px] font-medium transition-colors ${
                      active
                        ? 'border-primary bg-accent text-accent-foreground font-semibold'
                        : 'border-border bg-background text-foreground/75 hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>品牌强调色</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {accentThemes.map((t) => {
                const active = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAppTheme(t.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-[13px] font-medium transition-colors ${
                      active
                        ? 'border-primary bg-accent text-accent-foreground font-semibold'
                        : 'border-border bg-background text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: t.swatch }}
                    />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorkspaceSettingsPage;
