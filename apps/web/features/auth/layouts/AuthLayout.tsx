import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { WorkspaceLogoIcon } from '../../../components/common/NocoIcons';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import { ThemeMode } from '../../../types';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  const modes: { id: ThemeMode; label: string; icon: React.ElementType }[] = [
    { id: 'system', label: '跟随系统', icon: Monitor },
    { id: 'light', label: '浅色模式', icon: Sun },
    { id: 'dark', label: '深色模式', icon: Moon },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-[0.35] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
        {modes.map((m) => {
          const Icon = m.icon;
          const active = themeMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setThemeMode(m.id)}
              title={m.label}
              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-[400px] space-y-6 z-10">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-1 bg-card border border-border shadow-sm">
            <WorkspaceLogoIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-sm p-7">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;