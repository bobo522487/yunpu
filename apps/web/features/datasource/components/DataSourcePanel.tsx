
import React, { useState } from 'react';
import { Search, Plus, Server, MoreVertical, Settings, RefreshCcw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRouteContext } from '../../../hooks/useRouteContext';

const DataSourcePanel: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId } = useRouteContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Mock existing datasources
  const datasources = [
    { id: 'src-1', name: 'nocoapp-db', type: 'PostgreSQL', status: 'connected' },
    { id: 'src-2', name: 'production-analytics', type: 'MySQL', status: 'connected' },
    { id: 'src-3', name: 'stripe-api', type: 'Stripe', status: 'error' },
    { id: 'src-4', name: 'google-sheets-sales', type: 'Google Sheets', status: 'connected' },
  ];

  const filteredSources = datasources.filter(ds => 
    ds.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ds.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="h-10 px-4 border-b border-border flex justify-between items-center shrink-0 bg-background">
          <span className="font-medium text-xs text-muted-foreground">数据源列表</span>
          <div className="flex gap-2">
             <Plus size={14} className="text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate(`/projects/${activeProjectId}/datasources`)}/>
          </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-2">
         
         {/* New Source Button */}
         <div className="px-3 mb-4">
            <button 
                onClick={() => navigate(`/projects/${activeProjectId}/datasources`)}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground border border-transparent text-xs font-medium rounded transition-all shadow-sm hover:bg-primary/90"
            >
               <Plus size={14} /> 新建数据源
            </button>
         </div>

         <div className="mb-4">
            <div className="px-4 py-1 text-xs font-semibold text-muted-foreground mb-2 flex justify-between items-center">
               <span>已连接</span>
               <span className="text-[10px] bg-muted px-1.5 rounded text-muted-foreground tabular-nums">{filteredSources.length}</span>
            </div>

            {/* Search Box */}
            <div className="px-3 mb-2">
              <div className="relative group">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                  <input 
                      type="text" 
                      placeholder="搜索数据源..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-muted/30 border border-transparent focus:border-input rounded text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  />
              </div>
            </div>

            {/* List */}
            <div className="space-y-0.5 px-2">
                {filteredSources.map(ds => (
                    <div 
                        key={ds.id} 
                        className="relative px-3 py-2 flex items-center gap-3 text-sm rounded-md cursor-pointer hover:bg-muted/50 group transition-colors"
                    >
                        <div className={`w-2 h-2 rounded-full ${ds.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} title={ds.status} />
                        
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">{ds.name}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{ds.type}</div>
                        </div>
                        
                        {/* Action Menu Button */}
                        <div 
                            className={`p-1 rounded hover:bg-muted transition-all ${activeMenuId === ds.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === ds.id ? null : ds.id);
                            }}
                        >
                            <MoreVertical size={14} className="text-muted-foreground" />
                        </div>

                        {/* Context Menu */}
                        {activeMenuId === ds.id && (
                            <div className="absolute right-2 top-8 w-32 bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col py-1">
                                <button className="flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted w-full text-left transition-colors">
                                    <Settings size={12} /> Configure
                                </button>
                                <button className="flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-muted w-full text-left transition-colors">
                                    <RefreshCcw size={12} /> Sync Now
                                </button>
                                <div className="h-px bg-border my-1" />
                                <button className="flex items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 w-full text-left transition-colors">
                                    <Trash2 size={12} /> Disconnect
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default DataSourcePanel;