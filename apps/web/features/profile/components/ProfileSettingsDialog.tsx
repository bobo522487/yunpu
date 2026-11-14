import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Palette,
  Moon,
  Sun,
  Monitor,
  Triangle,
  Database,
  MessageSquare,
  Code,
  Check,
} from 'lucide-react';
import { AppTheme, ThemeMode } from '../../../types';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Separator } from '../../../components/ui/separator';

interface ProfileSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileSettingsDialog: React.FC<ProfileSettingsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'appearance'>('general');
  const [isMounted, setIsMounted] = useState(false);

  const user = usePreferencesStore((s) => s.user);
  const updateUser = usePreferencesStore((s) => s.updateUser);
  const theme = usePreferencesStore((s) => s.theme);
  const setAppTheme = usePreferencesStore((s) => s.setAppTheme);
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setBio(user.bio || '');
    }
  }, [isOpen, user]);

  if (!isMounted || !isOpen) return null;

  const handleSave = () => {
    updateUser({ name, bio });
    onClose();
  };

  const avatarInitial = (name || '用').trim().slice(0, 1).toUpperCase();

  const themes: { id: AppTheme; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'vercel', label: 'Vercel', icon: Triangle, color: 'bg-black text-white' },
    { id: 'supabase', label: 'Supabase', icon: Database, color: 'bg-emerald-500 text-white' },
    { id: 'slack', label: 'Slack', icon: MessageSquare, color: 'bg-purple-800 text-white' },
    { id: 'vscode', label: 'VS Code', icon: Code, color: 'bg-blue-500 text-white' },
  ];

  const modeOptions: { id: ThemeMode; label: string; icon: React.ElementType }[] = [
    { id: 'system', label: '跟随系统', icon: Monitor },
    { id: 'light', label: '浅色模式', icon: Sun },
    { id: 'dark', label: '深色模式', icon: Moon },
  ];

  const content = (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-[600px] h-[500px] bg-background rounded-xl shadow-2xl flex overflow-hidden border border-border">
        <div className="w-[172px] bg-muted/30 border-r border-border p-4 flex flex-col gap-1 shrink-0">
          <h2 className="text-sm font-semibold mb-3 px-2 text-foreground">账号设置</h2>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'general'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <User size={15} /> 个人资料
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'appearance'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Palette size={15} /> 外观与主题
          </button>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-14 px-6 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="text-base font-semibold text-foreground">
              {activeTab === 'general' ? '个人资料' : '外观与主题'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-semibold shadow-sm"
                    style={{ backgroundColor: '#4B177B' }}
                  >
                    {avatarInitial}
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{name}</h4>
                    <p className="text-xs text-muted-foreground">{user.role || '工作区成员'}</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">显示名称</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-email">邮箱地址</Label>
                    <Input
                      id="profile-email"
                      value={user.email}
                      disabled
                      className="max-w-sm bg-muted/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="profile-bio">个人简介</Label>
                    <Input
                      id="profile-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="max-w-sm"
                      placeholder="介绍一下你自己"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <Label>颜色模式</Label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {modeOptions.map((opt) => {
                      const Icon = opt.icon;
                      const active = themeMode === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setThemeMode(opt.id)}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-medium transition-all ${
                            active
                              ? 'border-primary bg-accent text-accent-foreground'
                              : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <Icon size={14} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label>主题色风格</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {themes.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setAppTheme(t.id)}
                        className={`relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          theme === t.id
                            ? 'border-primary bg-accent/60'
                            : 'border-border bg-card hover:bg-muted/50'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center ${t.color}`}
                        >
                          <t.icon size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {t.label}
                          </p>
                        </div>
                        {theme === t.id && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check size={12} className="text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeTab === 'general' && (
            <div className="p-4 border-t border-border flex justify-end gap-2 bg-muted/10">
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button onClick={handleSave}>保存更改</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ProfileSettingsDialog;
