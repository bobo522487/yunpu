import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  CheckCheck,
  HelpCircle,
  Home,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useAuthStore } from '../../features/auth/useAuthStore';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import ProfileSettingsDialog from '../../features/profile/components/ProfileSettingsDialog';
import { ThemeMode } from '../../types';
import { Button } from '../ui/button';

interface UserAvatarMenuProps {
  variant?: 'sidebar' | 'rail';
}

export const UserAvatarMenu: React.FC<UserAvatarMenuProps> = ({
  variant = 'sidebar',
}) => {
  const navigate = useNavigate();
  const user = usePreferencesStore((s) => s.user);
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const signOut = useAuthStore((s) => s.signOut);

  const notifications = useWorkspaceStore((s) => s.notifications);
  const markNotificationRead = useWorkspaceStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useWorkspaceStore((s) => s.markAllNotificationsRead);

  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<'help' | 'docs' | null>(null);

  const menuContainerRef = useRef<HTMLDivElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(e.target as Node)
      ) {
        setIsAvatarOpen(false);
      }
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(e.target as Node)
      ) {
        setIsNotifOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAvatarOpen(false);
        setIsNotifOpen(false);
        setInfoModal(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const avatarInitial = (user.name || '用').trim().slice(0, 1).toUpperCase();

  const themeOptions: { id: ThemeMode; label: string; icon: React.ElementType }[] = [
    { id: 'system', label: '跟随系统', icon: Monitor },
    { id: 'light', label: '浅色', icon: Sun },
    { id: 'dark', label: '深色', icon: Moon },
  ];

  const handleLogout = async () => {
    setIsAvatarOpen(false);
    try {
      await signOut();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const userMenuPopover = isAvatarOpen && (
    <div
      data-side={variant === 'rail' ? 'right' : 'top'}
      data-align="start"
      role="dialog"
      className={
        variant === 'rail'
          ? 'absolute bottom-0 left-full ml-2 w-[288px] p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] z-[85]'
          : 'absolute bottom-full left-0 mb-2 w-[288px] p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] z-[80]'
      }
    >
                <div className="flex flex-col" role="menu">
                  {/* Account Settings Header Row */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAvatarOpen(false);
                      setIsSettingsOpen(true);
                    }}
                    className="flex flex-row items-center justify-between w-full px-2 py-1.5 rounded-md hover:bg-muted transition-colors gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-foreground truncate">
                        {user.name}
                      </div>
                      <div className="text-[12px] text-muted-foreground truncate">
                        {user.email}
                      </div>
                    </div>
                    <Settings size={15} className="flex-none text-muted-foreground" />
                  </button>

                  <hr className="my-1.5 -mx-1.5 border-border" />

                  {/* Theme Segmented Control Row */}
                  <div className="flex items-center justify-between px-2 py-1.5 text-[13px] font-medium text-foreground">
                    <span>主题</span>
                    <div
                      role="radiogroup"
                      aria-label="主题切换"
                      className="inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5 gap-0.5"
                    >
                      {themeOptions.map((opt) => {
                        const Icon = opt.icon;
                        const active = themeMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            title={opt.label}
                            onClick={() => setThemeMode(opt.id)}
                            className={`w-7 h-6 rounded-full flex items-center justify-center transition-colors ${
                              active
                                ? 'bg-background text-foreground shadow-xs border border-border/80'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Icon size={13} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <hr className="my-1.5 -mx-1.5 border-border" />

                  {/* Home Page */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAvatarOpen(false);
                      navigate('/home');
                    }}
                    className="flex items-center justify-between w-full h-8 px-2 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <span>首页</span>
                    <Home size={15} className="text-muted-foreground" />
                  </button>

                  {/* Help */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAvatarOpen(false);
                      setInfoModal('help');
                    }}
                    className="flex items-center justify-between w-full h-8 px-2 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <span>帮助</span>
                    <HelpCircle size={15} className="text-muted-foreground" />
                  </button>

                  {/* Docs */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAvatarOpen(false);
                      setInfoModal('docs');
                    }}
                    className="flex items-center justify-between w-full h-8 px-2 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <span>文档</span>
                    <BookOpen size={15} className="text-muted-foreground" />
                  </button>

                  <hr className="my-1.5 -mx-1.5 border-border" />

                  {/* Log Out */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex items-center justify-between w-full h-8 px-2 rounded-md text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <span>退出登录</span>
                    <LogOut size={15} />
                  </button>
                </div>
              </div>
  );

  if (variant === 'rail') {
    return (
      <>
        <div ref={menuContainerRef} className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setIsAvatarOpen((v) => !v)}
            data-testid="nc-sidebar-userinfo"
            title={`${user.name} (${user.email})`}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white select-none"
              style={{ backgroundColor: '#4B177B' }}
            >
              {avatarInitial}
            </div>
          </button>
          {userMenuPopover}
        </div>

        <ProfileSettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />

        {infoModal &&
          createPortal(
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-xs"
                onClick={() => setInfoModal(null)}
              />
              <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-foreground">
                    {infoModal === 'help' ? '快捷键与使用帮助' : '工作区使用文档'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => setInfoModal(null)}
                  >
                    <X size={15} />
                  </Button>
                </div>
                {infoModal === 'help' ? (
                  <div className="space-y-2.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                      <span>打开全局快速搜索</span>
                      <kbd className="px-2 py-0.5 rounded bg-muted text-foreground font-mono">
                        Ctrl + K
                      </kbd>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                      <span>点击「项目」卡片</span>
                      <span className="text-foreground">进入项目概览与数据表</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span>点击「应用」卡片</span>
                      <span className="text-foreground">进入可视化页面构建器</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                    <p>1. 在项目概览与「数据」面板中可管理数据表结构、视图与外键关系。</p>
                    <p>2. 在「应用」面板中可拖拽表格、图表、统计卡与表单组件构建页面。</p>
                    <p>3. 在「设置」面板中可配置项目基本信息、外部数据源及代码文件。</p>
                  </div>
                )}
                <div className="mt-5 flex justify-end">
                  <Button size="sm" onClick={() => setInfoModal(null)}>
                    知道了
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  return (
    <>
      <div className="flex-none border-t border-border px-2 py-1.5 bg-background">
        <div className="flex items-center gap-1">
          {/* User Trigger + Top-Start Popover */}
          <div ref={menuContainerRef} className="relative flex-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                setIsAvatarOpen((v) => !v);
                setIsNotifOpen(false);
              }}
              data-testid="nc-sidebar-userinfo"
              className="w-full flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer min-w-0 transition-colors hover:bg-muted text-left"
            >
              <div
                className="w-6 h-6 rounded-full flex-none flex items-center justify-center text-[12px] font-semibold text-white select-none"
                style={{ backgroundColor: '#4B177B' }}
              >
                {avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-[14px] leading-5 font-semibold text-foreground">
                  {user.name}
                </div>
                <div className="truncate text-[12px] leading-4 font-medium text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </button>

            {userMenuPopover}
          </div>

          {/* Notification Bell Button */}
          <div ref={notifContainerRef} className="relative flex-none">
            <button
              type="button"
              onClick={() => {
                setIsNotifOpen((v) => !v);
                setIsAvatarOpen(false);
              }}
              data-testid="nc-home-sidebar-notification"
              title="通知"
              className="w-8 h-8 rounded-md flex items-center justify-center text-foreground/80 hover:text-foreground hover:bg-muted transition-colors relative"
            >
              <Bell size={16} strokeWidth={1.6} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-[310px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-[80] overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                  <span className="text-xs font-semibold text-foreground">
                    工作区通知 ({unreadCount})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <CheckCheck size={12} /> 全部已读
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/60">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      暂无通知消息
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${
                          !n.read ? 'bg-accent/40' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground truncate">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {n.time}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {n.description}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ProfileSettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {infoModal &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
              onClick={() => setInfoModal(null)}
            />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-foreground">
                  {infoModal === 'help' ? '快捷键与使用帮助' : '工作区使用文档'}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={() => setInfoModal(null)}
                >
                  <X size={15} />
                </Button>
              </div>
              {infoModal === 'help' ? (
                <div className="space-y-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                    <span>打开全局快速搜索</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted text-foreground font-mono">
                      Ctrl + K
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border/60">
                    <span>点击「项目」卡片</span>
                    <span className="text-foreground">进入数据表与模型视图</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span>点击「应用」卡片</span>
                    <span className="text-foreground">进入可视化页面构建器</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p>1. 在「项目」面板中可管理数据表结构、外键关系与数据源连接。</p>
                  <p>2. 在「应用」面板中可拖拽表格、图表、统计卡与表单组件构建页面。</p>
                  <p>3. 使用左侧底部头像菜单可随时切换工作区主题或退出登录。</p>
                </div>
              )}
              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={() => setInfoModal(null)}>
                  知道了
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default UserAvatarMenu;
