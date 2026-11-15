import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FileText, Search as SearchIcon } from 'lucide-react';
import { ProjectColoredIcon } from '../common/NocoIcons';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
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

  const workspaceProjects = projects.filter(
    (p) => p.workspaceId === activeWorkspaceId
  );

  const q = query.trim().toLowerCase();
  const matchedProjects = workspaceProjects.filter((p) =>
    p.name.toLowerCase().includes(q)
  );

  const workbenchModules = [
    {
      id: 'lineage',
      name: '谱系',
      desc: '世系图谱与房支结构',
      path: `/projects/${activeProjectId}/lineage`,
    },
    {
      id: 'articles',
      name: '谱文',
      desc: '谱序、凡例与人物传记',
      path: `/projects/${activeProjectId}/articles`,
    },
    {
      id: 'books',
      name: '谱书',
      desc: '分卷目录与线装成书',
      path: `/projects/${activeProjectId}/books`,
    },
  ].filter(
    (m) =>
      m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)
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
            placeholder="搜索云谱项目、谱系、谱文或谱书..."
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
                云谱项目
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

          {workbenchModules.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                项目工作台模块
              </div>
              <div className="space-y-0.5">
                {workbenchModules.map((mod) => (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(mod.path);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted text-left transition-colors"
                  >
                    <FileText size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-[13px] font-medium text-foreground flex-1 truncate">
                      {mod.name}
                    </span>
                    <span className="text-[12px] text-muted-foreground truncate">
                      {mod.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedProjects.length === 0 && workbenchModules.length === 0 && (
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
