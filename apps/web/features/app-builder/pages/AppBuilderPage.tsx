import React, { useCallback, useMemo, useState } from 'react';
import {
  Undo2,
  Redo2,
  Monitor,
  Tablet,
  Smartphone,
  Save,
  Play,
  Rocket,
  MousePointer2,
  Hand,
  Trash2,
} from 'lucide-react';
import Canvas from '../components/Canvas';
import PropertyPanel from '../components/PropertyPanel';
import { useResizable } from '../../../hooks/useResizable';
import { useRouteContext } from '../../../hooks/useRouteContext';
import { Button } from '../../../components/ui/button';
import {
  DeviceType,
  LayoutItem,
  Page,
  PageLayouts,
  WidgetInstance,
} from '../../../types';
import { usePreferencesStore } from '../../../store/usePreferencesStore';
import {
  getBreakpointForDevice,
  resolveCanvasItems,
  useBuilderStore,
} from '../../../store/useBuilderStore';

interface AppToolbarProps {
  device: DeviceType;
  setDevice: (device: DeviceType) => void;
  onClearCanvas: () => void;
  pageName: string;
}

const AppToolbar: React.FC<AppToolbarProps> = ({
  device,
  setDevice,
  onClearCanvas,
  pageName,
}) => {
  const [mode, setMode] = useState<'edit' | 'move'>('edit');

  return (
    <div className="h-12 border-b border-border bg-background flex items-center justify-between px-4 shrink-0 z-10 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex bg-[hsl(var(--surface-subtle))] border border-border p-0.5 rounded-lg gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md transition-all ${
              mode === 'edit'
                ? 'bg-background text-foreground shadow-[var(--shadow-control)] border border-border/60 hover:bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('edit')}
            title="编辑模式"
          >
            <MousePointer2 size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 rounded-md transition-all ${
              mode === 'move'
                ? 'bg-background text-foreground shadow-[var(--shadow-control)] border border-border/60 hover:bg-background'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setMode('move')}
            title="移动模式"
          >
            <Hand size={15} />
          </Button>
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        <span className="text-[14px] font-semibold text-foreground truncate">{pageName}</span>
      </div>

      <div className="flex bg-[hsl(var(--surface-subtle))] border border-border p-0.5 rounded-lg gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 rounded-md transition-all ${
            device === 'desktop'
              ? 'bg-background text-foreground shadow-[var(--shadow-control)] border border-border/60 hover:bg-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setDevice('desktop')}
          title="桌面端视图"
        >
          <Monitor size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 rounded-md transition-all ${
            device === 'tablet'
              ? 'bg-background text-foreground shadow-[var(--shadow-control)] border border-border/60 hover:bg-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setDevice('tablet')}
          title="平板端视图"
        >
          <Tablet size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 rounded-md transition-all ${
            device === 'mobile'
              ? 'bg-background text-foreground shadow-[var(--shadow-control)] border border-border/60 hover:bg-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setDevice('mobile')}
          title="移动端视图"
        >
          <Smartphone size={15} />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 mr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="撤销"
          >
            <Undo2 size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="重做"
          >
            <Redo2 size={15} />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClearCanvas}
          className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
          title="清空画布"
        >
          <Trash2 size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="保存"
        >
          <Save size={15} />
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1.5 text-[13px] whitespace-nowrap" title="预览">
          <Play size={13} />
          <span>预览</span>
        </Button>
        <Button variant="default" size="sm" className="h-8 px-2.5 gap-1.5 text-[13px] whitespace-nowrap" title="发布">
          <Rocket size={13} />
          <span>发布</span>
        </Button>
      </div>
    </div>
  );
};

const EMPTY_WIDGETS: Record<string, WidgetInstance> = {};
const EMPTY_LAYOUTS: PageLayouts = { lg: [] };

const AppBuilderPage: React.FC = () => {
  const { activePageId } = useRouteContext();

  const activeDevice = usePreferencesStore((s) => s.activeDevice);
  const setActiveDevice = usePreferencesStore((s) => s.setActiveDevice);

  const activePage = useBuilderStore((s) =>
    s.pages.find((p) => p.id === activePageId)
  );
  const widgetsById = useBuilderStore(
    (s) => s.widgetsByPage[activePageId] || EMPTY_WIDGETS
  );
  const layouts = useBuilderStore(
    (s) => s.layoutsByPage[activePageId] || EMPTY_LAYOUTS
  );
  const selectedComponentId = useBuilderStore((s) => s.selectedComponentId);
  const setSelectedComponentId = useBuilderStore((s) => s.setSelectedComponentId);
  const droppedWidget = useBuilderStore((s) => s.droppedWidget);
  const setDroppedWidget = useBuilderStore((s) => s.setDroppedWidget);
  const updatePage = useBuilderStore((s) => s.updatePage);
  const addWidget = useBuilderStore((s) => s.addWidget);
  const updateWidget = useBuilderStore((s) => s.updateWidget);
  const updateLayoutGeometry = useBuilderStore((s) => s.updateLayoutGeometry);
  const duplicateWidget = useBuilderStore((s) => s.duplicateWidget);
  const deleteWidget = useBuilderStore((s) => s.deleteWidget);
  const setPageLayouts = useBuilderStore((s) => s.setPageLayouts);
  const clearPageCanvas = useBuilderStore((s) => s.clearPageCanvas);

  const currentBreakpoint = getBreakpointForDevice(activeDevice);
  const selectedItem = useMemo(() => {
    if (!selectedComponentId) return null;
    const items = resolveCanvasItems(widgetsById, layouts, currentBreakpoint);
    return items.find((i) => i.i === selectedComponentId) || null;
  }, [selectedComponentId, widgetsById, layouts, currentBreakpoint]);

  const { width, startResizing } = useResizable({
    initialWidth: 260,
    minWidth: 240,
    maxWidth: 600,
    edge: 'right',
  });

  const handleItemConsumed = useCallback(
    () => setDroppedWidget(null),
    [setDroppedWidget]
  );

  const handleClearCanvas = () => {
    if (activePageId) {
      clearPageCanvas(activePageId);
    }
  };

  const handlePageUpdate = (updates: Partial<Page>) => {
    if (activePageId) {
      updatePage(activePageId, updates);
    }
  };

  const handleAddWidget = useCallback(
    (widget: WidgetInstance, geometry: Omit<LayoutItem, 'i'>, bp: typeof currentBreakpoint) => {
      if (activePageId) {
        addWidget(activePageId, widget, geometry, bp);
      }
    },
    [activePageId, addWidget]
  );

  const handleLayoutsChange = useCallback(
    (nextLayouts: PageLayouts) => {
      if (activePageId) {
        setPageLayouts(activePageId, nextLayouts);
      }
    },
    [activePageId, setPageLayouts]
  );

  const handleDuplicateWidget = useCallback(
    (widgetId: string) => {
      if (activePageId) {
        duplicateWidget(activePageId, widgetId);
      }
    },
    [activePageId, duplicateWidget]
  );

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      if (activePageId) {
        deleteWidget(activePageId, widgetId);
      }
    },
    [activePageId, deleteWidget]
  );

  const handleUpdateWidget = useCallback(
    (widgetId: string, updates: Partial<Omit<WidgetInstance, 'id'>>) => {
      if (activePageId) {
        updateWidget(activePageId, widgetId, updates);
      }
    },
    [activePageId, updateWidget]
  );

  const handleUpdateGeometry = useCallback(
    (widgetId: string, updates: Partial<Omit<LayoutItem, 'i'>>) => {
      if (activePageId) {
        updateLayoutGeometry(activePageId, currentBreakpoint, widgetId, updates);
      }
    },
    [activePageId, currentBreakpoint, updateLayoutGeometry]
  );

  return (
    <>
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <AppToolbar
          device={activeDevice}
          setDevice={setActiveDevice}
          onClearCanvas={handleClearCanvas}
          pageName={activePage?.name || '页面'}
        />
        <div className="flex-1 flex overflow-hidden relative">
          <Canvas
            device={activeDevice}
            droppedItem={droppedWidget}
            onItemConsumed={handleItemConsumed}
            widgetsById={widgetsById}
            layouts={layouts}
            onLayoutsChange={handleLayoutsChange}
            onAddWidget={handleAddWidget}
            onDuplicateWidget={handleDuplicateWidget}
            onDeleteWidget={handleDeleteWidget}
            selectedItemId={selectedComponentId}
            onSelectItem={setSelectedComponentId}
          />
        </div>
      </div>

      <div
        className="w-[1px] bg-border hover:bg-primary cursor-col-resize z-50 relative transition-colors"
        onMouseDown={startResizing}
      >
        <div className="absolute inset-y-0 -left-1 w-3 cursor-col-resize z-50" />
      </div>

      <PropertyPanel
        width={width}
        selectedItem={selectedItem}
        onUpdateWidget={handleUpdateWidget}
        onUpdateGeometry={handleUpdateGeometry}
        pageSettings={activePage}
        onPageUpdate={handlePageUpdate}
      />
    </>
  );
};

export default AppBuilderPage;
