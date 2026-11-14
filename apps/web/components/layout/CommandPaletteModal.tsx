import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FileText, LayoutGrid, Search as SearchIcon, Table } from 'lucide-react';
import { AppColoredIcon, ProjectColoredIcon } from '../common/NocoIcons';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useDataStore } from '../../store/useDataStore';
import { useBuilderStore } from '../../store/useBuilderStore';
import { useRouteContext } from '../../hooks/useRouteContext';

interface CommandPaletteContextValue {
  isOpen: boolean;
  openPalette: (initialQuery?: string) => void;
  closePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  isOpen: false,
  openPalette: () => {},
  closePalette: () => {},
});

export const useCommandPalette = () => useContext(CommandPaletteContext);

export const CommandPaletteProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  const openPalette = (initialQuery?: string) => {
    if (typeof initialQuery === 'string') {
      setPaletteQuery(initialQuery);
    }
    setIsOpen(true);
  };

  const closePalette = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, openPalette, closePalette }}>
      {children}
      {isOpen && (
        <CommandPaletteModal
          query={paletteQuery}
          onQueryChange={setPaletteQuery}
          onClose={closePalette}
        />
      )}
    </CommandPaletteContext.Provider>
  );
};

interface CommandPaletteModalProps {
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
}

const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  query,
  onQueryChange,
  onClose,
}) => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveProjectId = useWorkspaceStore((s) => s.setActiveProjectId);
  const projects = useWorkspaceStore((s) => s.projects);
  const apps = useWorkspaceStore((s) => s.apps);
  const tables = useDataStore((s) => s.tables);
  const pages = useBuilderStore((s) => s.pages);

  const workspaceProjects = projects.filter(
    (p) => p.workspaceId === activeWorkspaceId
  );
  const workspaceApps = apps.filter((a) => a.workspaceId === activeWorkspaceId);

  const q = query.trim().toLowerCase();
  const matchedProjects = workspaceProjects.filter((p) =>
    p.name.toLowerCase().includes(q)
  );
  const matchedApps = workspaceApps.filter((a) =>
    a.name.toLowerCase().includes(q)
  );
  const matchedTables = tables.filter((t) => t.name.toLowerCase().includes(q));
  const matchedPages = pages.filter(
    (p) => p.type === 'page' && p.name.toLowerCase().includes(q)
  );

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[14vh] px-4">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-3.5 h-12 border-b border-border gap-2.5">
          <SearchIcon size={16} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索项目、应用、数据表或页面..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted hover:text-foreground font-mono"
          >
            ESC
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {matchedProjects.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                项目
              </div>
              <div className="space-y-0.5">
                {matchedProjects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      setActiveProjectId(proj.id);
                      navigate(`/projects/${proj.id}`);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                  >
                    <ProjectColoredIcon
                      colorTheme={proj.colorTheme}
                      className="w-4 h-4 shrink-0"
                    />
                    <span className="text-[13px] font-medium text-foreground flex-1 truncate">
                      {proj.name}
                    </span>
                    <span className="text-[12px] text-muted-foreground">项目</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedTables.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                数据表
              </div>
              <div className="space-y-0.5">
                {matchedTables.map((t) => {
                  const targetProjectId = t.projectId || activeProjectId;
                  const projName = projects.find((p) => p.id === targetProjectId)?.name;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onClose();
                        if (targetProjectId) {
                          setActiveProjectId(targetProjectId);
                        }
                        navigate(`/projects/${targetProjectId}/data/${t.id}`);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                    >
                      <Table size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-[13px] font-medium text-foreground flex-1 truncate">
                        {t.name}
                      </span>
                      <span className="text-[12px] text-muted-foreground truncate max-w-[140px]">
                        {projName || '数据表'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {matchedApps.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                应用
              </div>
              <div className="space-y-0.5">
                {matchedApps.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(
                        `/projects/${activeProjectId}/apps/${app.id}/pages/${app.defaultPageId}`
                      );
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                  >
                    <AppColoredIcon
                      colorTheme={app.colorTheme}
                      className="w-4 h-4 shrink-0"
                    />
                    <span className="text-[13px] font-medium text-foreground flex-1 truncate">
                      {app.name}
                    </span>
                    <span className="text-[12px] text-muted-foreground">应用</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedPages.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                应用页面
              </div>
              <div className="space-y-0.5">
                {matchedPages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      const firstApp = workspaceApps[0] || apps[0];
                      navigate(
                        `/projects/${activeProjectId}/apps/${
                          firstApp?.id || 'app-order-mgmt'
                        }/pages/${p.id}`
                      );
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                  >
                    <FileText size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-medium text-foreground flex-1 truncate">
                      {p.name}
                    </span>
                    <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1">
                      <LayoutGrid size={11} /> 页面
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedProjects.length === 0 &&
            matchedApps.length === 0 &&
            matchedTables.length === 0 &&
            matchedPages.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                未找到与 “{query}” 匹配的内容
              </div>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
};
