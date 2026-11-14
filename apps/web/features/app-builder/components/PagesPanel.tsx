import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  File,
  LayoutGrid,
  ShoppingCart,
  Settings,
  Home,
  Folder,
  FolderOpen,
  FolderPlus,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  ChevronDown,
  MousePointerClick,
  Type,
  TextCursor,
  FileText,
  BarChart3,
  Table as TableIcon,
  Image as ImageIcon,
  Tag,
  List,
  Mail,
  Lock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ComponentsPanel from './ComponentsPanel';
import { Button } from '../../../components/ui/button';
import { Page } from '../../../types';
import { Tree } from '../../../components/common/Tree/Tree';
import { TreeItem } from '../../../components/common/Tree/types';
import { flatten } from '../../../components/common/Tree/utilities';
import { useRouteContext } from '../../../hooks/useRouteContext';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import {
  getBreakpointForDevice,
  resolveCanvasItems,
  useBuilderStore,
} from '../../../store/useBuilderStore';

const PagesPanel: React.FC = () => {
  const navigate = useNavigate();
  const { activeProjectId, appId, activePageId } = useRouteContext();

  const buildPageRoute = (pageId: string) =>
    `/projects/${activeProjectId}/apps/${appId}/pages/${pageId}`;

  const activeDevice = usePreferencesStore((s) => s.activeDevice);
  const pages = useBuilderStore((s) => s.pages);
  const addPage = useBuilderStore((s) => s.addPage);
  const deletePage = useBuilderStore((s) => s.deletePage);
  const updatePage = useBuilderStore((s) => s.updatePage);
  const duplicatePage = useBuilderStore((s) => s.duplicatePage);
  const reorderPages = useBuilderStore((s) => s.reorderPages);
  const togglePageFolder = useBuilderStore((s) => s.togglePageFolder);
  const pageWidgets = useBuilderStore((s) => s.widgetsByPage[activePageId]);
  const pageLayouts = useBuilderStore((s) => s.layoutsByPage[activePageId]);
  const selectedComponentId = useBuilderStore((s) => s.selectedComponentId);
  const setSelectedComponentId = useBuilderStore((s) => s.setSelectedComponentId);

  const [showComponents, setShowComponents] = useState(false);
  const [pagesHeight, setPagesHeight] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);

  const treeItems = useMemo(() => {
    const buildTree = (parentId?: string): TreeItem[] =>
      pages
        .filter((p) => p.parentId === parentId)
        .map((p) => ({
          id: p.id,
          children: buildTree(p.id),
          collapsed: !p.isOpen,
          type: p.type,
          data: {
            name: p.name,
            icon: p.icon,
            isHome: p.isHome,
          },
        }));
    return buildTree(undefined);
  }, [pages]);

  const handleTreeChange = (newItems: TreeItem[]) => {
    const flattened = flatten(newItems);
    const newPages: Page[] = flattened
      .map((item): Page | null => {
        const original = pages.find((p) => p.id === item.id);
        if (!original) return null;
        return {
          ...original,
          parentId: item.parentId ? (item.parentId as string) : undefined,
          isOpen: !item.collapsed,
        };
      })
      .filter((p): p is Page => p !== null);

    reorderPages(newPages);
  };

  const handleAddPage = () => {
    const newId = `page-${Date.now()}`;
    addPage({
      id: newId,
      name: '新建页面',
      type: 'page',
      icon: 'File',
      isHome: false,
      height: '800',
      isHidden: false,
      isDisabled: false,
    });
    navigate(buildPageRoute(newId));
  };

  const handleAddGroup = () => {
    const newId = `group-${Date.now()}`;
    addPage({
      id: newId,
      name: '新建分组',
      type: 'folder',
      isOpen: true,
      icon: 'Folder',
      isHome: false,
      height: '0',
      isHidden: false,
      isDisabled: false,
    });
  };

  const handleSelectPage = (item: any) => {
    if (item.type === 'folder') {
      togglePageFolder(item.id);
    } else {
      navigate(buildPageRoute(item.id));
    }
  };

  const handleDeletePage = (id: string) => {
    deletePage(id);
    if (activePageId === id) {
      const nextPage = pages.find((p) => p.id !== id && p.type === 'page');
      if (nextPage) {
        navigate(buildPageRoute(nextPage.id));
      }
    }
  };

  const handleAddItemToFolder = (parentId: string) => {
    const newId = `page-${Date.now()}`;
    addPage({
      id: newId,
      name: '新建页面',
      type: 'page',
      icon: 'File',
      parentId,
      isHome: false,
      height: '800',
      isHidden: false,
      isDisabled: false,
    });

    const parent = pages.find((p) => p.id === parentId);
    if (parent && !parent.isOpen) {
      togglePageFolder(parentId);
    }

    navigate(buildPageRoute(newId));
  };

  const renderPageIcon = (item: any) => {
    if (item.type === 'folder') {
      return item.collapsed ? (
        <Folder size={16} className="text-yellow-500/80" />
      ) : (
        <FolderOpen size={16} className="text-yellow-500/80" />
      );
    }
    switch (item.data?.icon) {
      case 'LayoutGrid':
        return <LayoutGrid size={16} />;
      case 'ShoppingCart':
        return <ShoppingCart size={16} />;
      case 'Settings':
        return <Settings size={16} />;
      case 'Home':
        return <Home size={16} />;
      default:
        return <File size={16} />;
    }
  };

  const currentBreakpoint = getBreakpointForDevice(activeDevice);
  const visibleLayout = useMemo(
    () => resolveCanvasItems(pageWidgets, pageLayouts, currentBreakpoint),
    [pageWidgets, pageLayouts, currentBreakpoint]
  );

  const getComponentIcon = (type: string) => {
    switch (type) {
      case 'button':
        return <MousePointerClick size={14} className="text-muted-foreground" />;
      case 'input':
        return <TextCursor size={14} className="text-muted-foreground" />;
      case 'email_input':
        return <Mail size={14} className="text-muted-foreground" />;
      case 'password_input':
        return <Lock size={14} className="text-muted-foreground" />;
      case 'textarea':
        return <FileText size={14} className="text-muted-foreground" />;
      case 'text':
        return <Type size={14} className="text-muted-foreground" />;
      case 'table':
        return <TableIcon size={14} className="text-muted-foreground" />;
      case 'chart':
      case 'stat':
        return <BarChart3 size={14} className="text-muted-foreground" />;
      case 'image':
        return <ImageIcon size={14} className="text-muted-foreground" />;
      case 'badge':
        return <Tag size={14} className="text-muted-foreground" />;
      case 'select':
        return <List size={14} className="text-muted-foreground" />;
      default:
        return <LayoutGrid size={14} className="text-muted-foreground" />;
    }
  };

  const getComponentLabel = (type: string) => {
    switch (type) {
      case 'button':
        return '按钮';
      case 'input':
        return '单行输入';
      case 'email_input':
        return '邮箱输入';
      case 'password_input':
        return '密码输入';
      case 'textarea':
        return '多行文本';
      case 'text':
        return '文本';
      case 'table':
        return '数据表格';
      case 'chart':
        return '柱状图表';
      case 'stat':
        return '指标卡';
      case 'image':
        return '图片';
      case 'badge':
        return '徽章标签';
      case 'select':
        return '下拉选择';
      default:
        return '组件';
    }
  };

  const deviceLabel =
    activeDevice === 'mobile'
      ? '移动端'
      : activeDevice === 'tablet'
        ? '平板端'
        : '桌面端';

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newHeight = e.clientY - 120;
        if (newHeight > 100 && newHeight < window.innerHeight - 200) {
          setPagesHeight(newHeight);
        }
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  if (showComponents) {
    return (
      <div ref={panelRef} className="h-full">
        <ComponentsPanel onClose={() => setShowComponents(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden select-none bg-background">
      <div className="h-10 px-4 border-b border-border flex justify-between items-center shrink-0 bg-background">
        <span className="font-semibold text-[14px] text-foreground">应用页面</span>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 mb-2 mt-3 shrink-0">
          <Button
            variant="outline"
            className="w-full justify-start h-8 text-[13px] font-medium"
            size="sm"
            onClick={() => setShowComponents(true)}
          >
            <Plus size={14} className="mr-2" /> 添加组件
          </Button>
        </div>

        <div style={{ height: pagesHeight }} className="flex flex-col shrink-0 min-h-[100px]">
          <div className="px-4 py-1 text-[12px] font-semibold text-muted-foreground mb-1.5 flex justify-between items-center shrink-0">
            <span>页面列表</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleAddGroup}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-[hsl(var(--surface-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                title="新建分组"
              >
                <FolderPlus size={13} />
              </button>
              <button
                onClick={handleAddPage}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-[hsl(var(--surface-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                title="新建页面"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <div className="px-2">
              <Tree
                items={treeItems}
                onItemsChange={handleTreeChange}
                activeId={activePageId}
                onSelect={handleSelectPage}
                onRename={(id, name) => updatePage(id, { name })}
                onRemove={handleDeletePage}
                onAdd={(id) => {
                  const item = pages.find((p) => p.id === id);
                  if (item && item.type === 'folder') {
                    handleAddItemToFolder(id);
                  }
                }}
                onDuplicate={(id) => duplicatePage(id)}
                renderIcon={renderPageIcon}
                collapsible
                removable
                indicator
                canHaveChildren={(item) => item.type === 'folder'}
                hideCollapseButton
              />
            </div>
          </div>
        </div>

        <div
          ref={splitterRef}
          onMouseDown={() => setIsResizing(true)}
          className="h-px bg-border hover:h-[2px] hover:bg-primary/60 cursor-row-resize shrink-0 transition-all z-10"
        />

        <div className="flex-1 flex flex-col min-h-[100px] overflow-hidden pt-2">
          <div className="px-4 py-1 text-[12px] font-semibold text-muted-foreground mb-1 flex justify-between items-center shrink-0">
            <span>组件大纲</span>
            <span className="text-[12px] tabular-nums font-medium">{visibleLayout.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            <div className="mb-1">
              <div className="flex items-center px-4 py-1.5 text-[13px] font-semibold text-foreground">
                <ChevronDown size={12} className="mr-1 text-muted-foreground" />
                {activeDevice === 'mobile' ? (
                  <Smartphone size={12} className="mr-2 text-muted-foreground" />
                ) : activeDevice === 'tablet' ? (
                  <Tablet size={12} className="mr-2 text-muted-foreground" />
                ) : (
                  <Monitor size={12} className="mr-2 text-muted-foreground" />
                )}
                <span>{deviceLabel}</span>
              </div>

              <div className="ml-4 border-l border-[hsl(var(--border-subtle))] pl-0">
                {visibleLayout.length === 0 ? (
                  <div className="px-4 py-2 text-[13px] text-muted-foreground">
                    暂无组件
                  </div>
                ) : (
                  visibleLayout.map((item) => {
                    const isSelected = item.i === selectedComponentId;
                    return (
                      <div
                        key={item.i}
                        onClick={() => setSelectedComponentId(item.i)}
                        className={`group flex items-center px-3 py-1.5 mx-1 rounded-md cursor-pointer text-[13px] transition-colors ${
                          isSelected
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-foreground/85 font-medium hover:bg-[hsl(var(--surface-hover))] hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <span className="mr-2 opacity-75">
                            {getComponentIcon(item.type)}
                          </span>
                          <span className="truncate leading-tight">
                            {item.title || getComponentLabel(item.type)}
                          </span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye size={12} className="text-muted-foreground hover:text-foreground" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PagesPanel;
