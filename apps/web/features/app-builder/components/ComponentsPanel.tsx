
import React, { useState } from 'react';
import { 
  Search, 
  ChevronDown, 
  ChevronRight, 
  LayoutGrid,
  GripVertical,
  X
} from 'lucide-react';
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useDraggable } from '@dnd-kit/core';
import { registry } from '../../../widgets/registry';
import { WidgetManifest } from '../../../widgets/types';

interface DraggableItemProps {
  manifest: WidgetManifest;
}

const DraggableItem: React.FC<DraggableItemProps> = ({ manifest }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `draggable-${manifest.type}`,
    data: manifest
  });

  return (
    <div 
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={`flex flex-col items-center justify-center p-2 rounded-lg border border-[hsl(var(--border-subtle))] bg-card hover:bg-[hsl(var(--surface-hover))] hover:border-[hsl(var(--border-strong))] hover:shadow-[var(--shadow-control)] cursor-grab active:cursor-grabbing transition-all duration-150 group relative ${isDragging ? 'opacity-50' : ''}`}
    >
        <div className="w-9 h-9 flex items-center justify-center mb-1 relative bg-[hsl(var(--surface-subtle))] rounded-md group-hover:bg-background transition-colors border border-transparent group-hover:border-border">
            <manifest.icon size={18} strokeWidth={1.6} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        <span className="text-[12px] font-medium text-foreground/85 text-center leading-tight group-hover:text-foreground mt-0.5 truncate w-full">
            {manifest.name}
        </span>
    </div>
  );
};

interface ComponentsPanelProps {
    onClose: () => void;
}

const STATIC_MODULES = [
    { id: 1, title: '登录认证表单', icon: LayoutGrid },
    { id: 2, title: '顶部导航栏', icon: GripVertical }
];

const ComponentsPanel: React.FC<ComponentsPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'components' | 'modules'>('components');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Initialize open sections based on registry categories
  const categories = registry.getCategories();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    categories.reduce((acc, cat) => ({ ...acc, [cat]: true }), {})
  );

  const toggleSection = (title: string) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredCategories = categories
    .map((category) => {
      const widgets = registry.getByCategory(category).filter((def) => {
        if (!normalizedQuery) return true;
        return (
          def.manifest.name.toLowerCase().includes(normalizedQuery) ||
          def.manifest.type.toLowerCase().includes(normalizedQuery) ||
          category.toLowerCase().includes(normalizedQuery)
        );
      });
      return { category, widgets };
    })
    .filter((group) => group.widgets.length > 0);

  const filteredModules = STATIC_MODULES.filter((mod) =>
    !normalizedQuery ? true : mod.title.toLowerCase().includes(normalizedQuery)
  );

  return (
    <div className="flex flex-col h-full bg-background animate-in slide-in-from-left-4 duration-200">
      {/* Header (Unified) */}
      <div className="h-10 px-4 border-b border-border flex justify-between items-center shrink-0 bg-background">
          <span className="font-semibold text-[14px] text-foreground">组件库</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="关闭组件库">
             <X size={14} className="text-muted-foreground hover:text-foreground"/>
          </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-4 pt-2 pb-0 border-b border-border shrink-0 bg-background">
         <div className="flex-1 flex gap-5">
            <button 
                onClick={() => setActiveTab('components')}
                className={`pb-2 text-[13px] border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'components' 
                    ? 'text-foreground font-semibold border-primary' 
                    : 'text-foreground/75 font-medium border-transparent hover:text-foreground'
                }`}
            >
                基础组件
            </button>
            <button 
                onClick={() => setActiveTab('modules')}
                className={`pb-2 text-[13px] border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'modules' 
                    ? 'text-foreground font-semibold border-primary' 
                    : 'text-foreground/75 font-medium border-transparent hover:text-foreground'
                }`}
            >
                业务模块
            </button>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent p-0">
        
        {/* Search Bar */}
        <div className="px-3 my-3 relative">
             <Search size={13} className="absolute left-5.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
             <Input 
               type="text" 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="搜索组件或模块..." 
               className="pl-8 pr-7 h-8 text-xs"
             />
             {searchQuery && (
               <button
                 type="button"
                 onClick={() => setSearchQuery('')}
                 className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
                 title="清空搜索"
               >
                 <X size={12} />
               </button>
             )}
        </div>

        <div className="px-3 pb-4">
            {activeTab === 'components' ? (
                /* Components Tab */
                filteredCategories.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">
                        未找到匹配的组件
                    </div>
                ) : (
                    <div className="space-y-1">
                        {filteredCategories.map(({ category, widgets }) => {
                            const isOpen = normalizedQuery ? true : openSections[category];
                            return (
                                <div key={category} className="border-b border-transparent">
                                    <button 
                                        onClick={() => toggleSection(category)}
                                        className="w-full flex items-center justify-between py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors group"
                                    >
                                        <span>{category}</span>
                                        {isOpen ? (
                                            <ChevronDown size={12} className="text-muted-foreground group-hover:text-foreground" />
                                        ) : (
                                            <ChevronRight size={12} className="text-muted-foreground group-hover:text-foreground" />
                                        )}
                                    </button>
                                    
                                    {isOpen && (
                                        <div className="grid grid-cols-3 gap-2 pb-3 animate-in fade-in zoom-in-95 duration-150">
                                            {widgets.map((def) => (
                                                <DraggableItem key={def.manifest.type} manifest={def.manifest} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                /* Modules Tab */
                filteredModules.length === 0 ? (
                    <div className="py-10 text-center text-[13px] text-muted-foreground">
                        未找到匹配的业务模块
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredModules.map((mod) => (
                            <div 
                                key={mod.id} 
                                className="flex items-center p-2 rounded-lg border border-[hsl(var(--border-subtle))] bg-card hover:bg-[hsl(var(--surface-hover))] hover:border-[hsl(var(--border-strong))] hover:shadow-[var(--shadow-control)] cursor-pointer transition-all group"
                            >
                                <div className="w-10 h-9 flex items-center justify-center bg-[hsl(var(--surface-subtle))] rounded-md mr-3 group-hover:bg-background transition-colors border border-transparent group-hover:border-border">
                                    <mod.icon size={18} strokeWidth={1.6} className="text-muted-foreground group-hover:text-primary" />
                                </div>
                                <span className="text-[13px] font-medium text-foreground">{mod.title}</span>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>

      </div>
    </div>
  );
};

export default ComponentsPanel;
