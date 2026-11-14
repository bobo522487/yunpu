import React from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import Breadcrumb from '../common/Breadcrumb';
import { useWorkspaceStore } from '../../store/useWorkspaceStore';
import { useCommandPalette } from './CommandPaletteModal';

const Header: React.FC = () => {
  const searchQuery = useWorkspaceStore((s) => s.searchQuery);
  const setSearchQuery = useWorkspaceStore((s) => s.setSearchQuery);
  const { openPalette } = useCommandPalette();

  return (
    <header className="h-14 w-full border-b border-border bg-background flex items-center justify-between gap-3 px-4 shrink-0 z-20">
      {/* Left Breadcrumb */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Breadcrumb />
      </div>

      {/* Center Search Box (NocoDB Ctrl K style for Workspace Shell) */}
      <div className="flex-none w-full max-w-[420px] hidden sm:block">
        <div className="relative flex items-center h-9 rounded-lg border border-input bg-background shadow-[var(--shadow-control)] hover:border-[hsl(var(--border-strong))] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-150 px-2.5">
          <SearchIcon size={15} className="text-muted-foreground shrink-0 mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索多个项目"
            className="flex-1 bg-transparent text-[13px] font-medium text-foreground placeholder:text-muted-foreground placeholder:font-normal focus:outline-none min-w-0"
            data-testid="nc-ws-home-topbar-search"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-0.5 text-muted-foreground hover:text-foreground mr-1 rounded"
              title="清空搜索"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => openPalette()}
            className="px-1.5 py-0.5 text-[11px] font-medium font-mono text-muted-foreground bg-[hsl(var(--surface-subtle))] rounded border border-border shrink-0 hover:text-foreground hover:border-[hsl(var(--border-strong))] transition-colors"
          >
            Ctrl K
          </button>
        </div>
      </div>

      {/* Right Spacer / Mobile Search Button */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => openPalette()}
          className="sm:hidden h-8 w-8 rounded-lg border border-input shadow-[var(--shadow-control)] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-[hsl(var(--border-strong))] transition-colors"
          title="搜索 (Ctrl K)"
        >
          <SearchIcon size={15} />
        </button>
      </div>
    </header>
  );
};

export default Header;