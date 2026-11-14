import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Responsive as ResponsiveGridLayout } from 'react-grid-layout';
import { GripVertical, MousePointerClick, Copy, Trash2, AlertCircle } from 'lucide-react';
import { useDroppable, useDndMonitor, DragMoveEvent } from '@dnd-kit/core';
import {
  Breakpoint,
  DeviceType,
  LayoutItem,
  PageLayouts,
  WidgetInstance,
} from '../../../types';
import { registry } from '../../../widgets/registry';
import BaseWidget from '../../../widgets/BaseWidget';
import {
  BREAKPOINTS,
  BREAKPOINT_COLS,
  getBreakpointForDevice,
  resolveCanvasItems,
} from '../../../store/useBuilderStore';

interface CanvasProps {
  device?: DeviceType;
  droppedItem?: any;
  onItemConsumed?: () => void;
  widgetsById: Record<string, WidgetInstance>;
  layouts: PageLayouts;
  onLayoutsChange: (layouts: PageLayouts) => void;
  onAddWidget: (
    widget: WidgetInstance,
    geometry: Omit<LayoutItem, 'i'>,
    breakpoint: Breakpoint
  ) => void;
  onDuplicateWidget: (widgetId: string) => void;
  onDeleteWidget: (widgetId: string) => void;
  selectedItemId?: string | null;
  onSelectItem?: (id: string | null) => void;
}

const Canvas: React.FC<CanvasProps> = ({
  device = 'desktop' as DeviceType,
  droppedItem,
  onItemConsumed,
  widgetsById,
  layouts,
  onLayoutsChange,
  onAddWidget,
  onDuplicateWidget,
  onDeleteWidget,
  selectedItemId,
  onSelectItem,
}) => {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [droppingItem, setDroppingItem] = useState<LayoutItem | undefined>(undefined);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>(
    getBreakpointForDevice(device)
  );

  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;

  const margin: [number, number] = [12, 12];
  const rowHeight = 30;

  const { setNodeRef } = useDroppable({
    id: 'canvas-droppable',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCurrentBreakpoint(getBreakpointForDevice(device));
  }, [device]);

  useDndMonitor({
    onDragMove(event: DragMoveEvent) {
      const { active, over } = event;

      if (!over || over.id !== 'canvas-droppable' || !containerRef.current) {
        if (droppingItem) setDroppingItem(undefined);
        return;
      }

      const type = active.data.current?.type;
      if (!type) return;

      const widgetDef = registry.get(type);
      const { w, h } = widgetDef ? widgetDef.manifest.defaultSize : { w: 4, h: 4 };

      const activeRect = active.rect.current.translated;
      if (!activeRect) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const itemCenterX = activeRect.left + activeRect.width / 2;
      const itemCenterY = activeRect.top + activeRect.height / 2;
      const relativeX = itemCenterX - containerRect.left;
      const relativeY = itemCenterY - containerRect.top;

      const currentCols = BREAKPOINT_COLS[currentBreakpoint] || 12;
      const containerWidth = containerRect.width;
      const marginX = margin[0];
      const colWidth = (containerWidth - marginX * (currentCols + 1)) / currentCols;

      let gridX = Math.floor((relativeX - marginX) / (colWidth + marginX));
      let gridY = Math.floor((relativeY - marginX) / (rowHeight + margin[1]));

      gridX = Math.max(0, Math.min(gridX, Math.max(0, currentCols - w)));
      gridY = Math.max(0, gridY);

      setDroppingItem((prev) => {
        if (prev && prev.x === gridX && prev.y === gridY && prev.w === w && prev.h === h) {
          return prev;
        }
        return {
          i: '__dropping-elem__',
          w,
          h,
          x: gridX,
          y: gridY,
        };
      });
    },
    onDragEnd() {
      setDroppingItem(undefined);
    },
    onDragCancel() {
      setDroppingItem(undefined);
    },
  });

  useEffect(() => {
    if (droppedItem && onItemConsumed) {
      const widgetDef = registry.get(droppedItem.type);
      const { w, h } = widgetDef ? widgetDef.manifest.defaultSize : { w: 4, h: 4 };

      const initialContent: Record<string, any> = {};
      widgetDef?.manifest.properties.forEach((prop) => {
        if (prop.defaultValue !== undefined) {
          initialContent[prop.name] = prop.defaultValue;
        }
      });

      const newWidget: WidgetInstance = {
        id: droppedItem.id,
        type: droppedItem.type,
        title: droppedItem.name,
        content: initialContent,
      };

      const geometry: Omit<LayoutItem, 'i'> = {
        x: droppingItem ? droppingItem.x : 0,
        y: droppingItem ? droppingItem.y : Infinity,
        w,
        h,
      };

      onAddWidget(newWidget, geometry, currentBreakpoint);
      onItemConsumed();
    }
  }, [droppedItem, onItemConsumed, droppingItem, currentBreakpoint, onAddWidget]);

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      onDeleteWidget(id);
    },
    [onDeleteWidget]
  );

  const handleDuplicate = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      onDuplicateWidget(id);
    },
    [onDuplicateWidget]
  );

  const handleResponsiveLayoutChange = useCallback(
    (_currentLayout: any[], allLayouts: Record<string, any[]>) => {
      const currentLayoutsState = layoutsRef.current;
      const nextLayoutsState: PageLayouts = {};

      BREAKPOINTS.forEach((bp) => {
        const bpLayoutRGL = allLayouts[bp] || [];
        if (bpLayoutRGL.length === 0) {
          if (currentLayoutsState[bp]) {
            nextLayoutsState[bp] = currentLayoutsState[bp];
          }
          return;
        }

        nextLayoutsState[bp] = bpLayoutRGL
          .filter((l: any) => l.i !== '__dropping-elem__' && widgetsById[l.i])
          .map((l: any) => ({
            i: l.i,
            x: l.x,
            y: l.y,
            w: l.w,
            h: l.h,
            ...(l.minW !== undefined ? { minW: l.minW } : {}),
            ...(l.minH !== undefined ? { minH: l.minH } : {}),
          }));
      });

      const hasLayoutChanged = () => {
        for (const bp of BREAKPOINTS) {
          const listA = nextLayoutsState[bp] || [];
          const listB = currentLayoutsState[bp] || [];
          if (listA.length !== listB.length) return true;
          for (let i = 0; i < listA.length; i++) {
            const itemA = listA[i];
            const itemB = listB[i];
            if (
              !itemB ||
              itemA.i !== itemB.i ||
              itemA.x !== itemB.x ||
              itemA.y !== itemB.y ||
              itemA.w !== itemB.w ||
              itemA.h !== itemB.h
            ) {
              return true;
            }
          }
        }
        return false;
      };

      if (hasLayoutChanged()) {
        onLayoutsChange(nextLayoutsState);
      }
    },
    [onLayoutsChange, widgetsById]
  );

  const getContainerWidth = () => {
    switch (device) {
      case 'mobile':
        return 375;
      case 'tablet':
        return 768;
      case 'desktop':
      default:
        return 1200;
    }
  };

  const getContainerClass = () => {
    const base =
      'bg-background border border-border shadow-[var(--shadow-control)] transition-all duration-300 ease-in-out relative';
    switch (device) {
      case 'mobile':
        return `${base} w-[375px] min-h-[667px] my-8 rounded-[2rem] border-8 border-[hsl(var(--border-strong))]`;
      case 'tablet':
        return `${base} w-[768px] min-h-[1024px] my-8 rounded-xl`;
      case 'desktop':
      default:
        return `${base} w-full max-w-[1200px] min-h-[800px] my-8 rounded-lg`;
    }
  };

  const renderItems = useMemo(
    () => resolveCanvasItems(widgetsById, layouts, currentBreakpoint),
    [widgetsById, layouts, currentBreakpoint]
  );

  const ResponsiveGrid = ResponsiveGridLayout as any;

  return (
    <div className="flex-1 flex flex-col bg-[hsl(var(--surface-subtle))] min-w-0 overflow-auto transition-colors relative">
      <div className="absolute inset-0 z-0 opacity-60 pointer-events-none nc-dot-grid" />

      <div
        className="flex-1 flex justify-center p-8 z-10 min-h-full cursor-default"
        onClick={(e) => {
          if (e.target === e.currentTarget && onSelectItem) {
            onSelectItem(null);
          }
        }}
      >
        <div
          ref={containerRef}
          className={getContainerClass()}
          style={{
            width: device !== 'desktop' ? undefined : '100%',
            maxWidth: device === 'desktop' ? '1200px' : undefined,
          }}
        >
          <div ref={setNodeRef} className="w-full h-full">
            {mounted && (
              <ResponsiveGrid
                className="layout"
                layouts={layouts}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={BREAKPOINT_COLS}
                rowHeight={rowHeight}
                width={getContainerWidth()}
                margin={margin}
                isDraggable={true}
                isResizable={true}
                isDropping={!!droppingItem}
                droppingItem={droppingItem}
                onLayoutChange={handleResponsiveLayoutChange}
                onBreakpointChange={(bp: Breakpoint) => setCurrentBreakpoint(bp)}
                draggableHandle=".drag-handle"
                compactType="vertical"
                measureBeforeMount={false}
              >
                {renderItems.map((item) => {
                  const isSelected = item.i === selectedItemId;
                  const widgetDef = registry.get(item.type);

                  return (
                    <div
                      key={item.i}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectItem) onSelectItem(item.i);
                      }}
                      className={`bg-card border rounded-lg transition-all duration-150 ease-in-out group overflow-hidden ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/25 shadow-[var(--shadow-card-hover)] z-30'
                          : 'border-border/80 hover:border-[hsl(var(--border-strong))] hover:shadow-[var(--shadow-control)]'
                      }`}
                    >
                      <div
                        className="drag-handle absolute top-2 left-2 z-50 p-1 rounded-md cursor-grab active:cursor-grabbing hover:bg-[hsl(var(--surface-hover))] bg-popover/95 border border-border shadow-[var(--shadow-control)] backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        title="拖拽移动"
                      >
                        <GripVertical size={13} className="text-muted-foreground" />
                      </div>

                      <div className="absolute top-2 right-2 z-50 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div
                          onClick={(e) => handleDuplicate(e, item.i)}
                          className="p-1 rounded-md cursor-pointer hover:bg-[hsl(var(--surface-hover))] bg-popover/95 border border-border shadow-[var(--shadow-control)] backdrop-blur-sm"
                          title="复制"
                        >
                          <Copy size={13} className="text-muted-foreground hover:text-foreground" />
                        </div>
                        <div
                          onClick={(e) => handleDelete(e, item.i)}
                          className="p-1 rounded-md cursor-pointer hover:bg-destructive/10 bg-popover/95 border border-border shadow-[var(--shadow-control)] backdrop-blur-sm"
                          title="删除"
                        >
                          <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                        </div>
                      </div>

                      {widgetDef ? (
                        <BaseWidget definition={widgetDef} item={item} />
                      ) : (
                        <div className="p-4 flex flex-col items-center justify-center h-full text-muted-foreground">
                          <AlertCircle size={24} className="mb-2 text-destructive opacity-60" />
                          <span className="text-xs">未知组件类型：{item.type}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </ResponsiveGrid>
            )}

            {renderItems.length === 0 && !droppingItem && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
                <div className="text-center space-y-2">
                  <MousePointerClick size={40} className="mx-auto opacity-25" />
                  <p className="text-sm font-medium text-foreground/80">从左侧拖入组件到画布</p>
                  <p className="text-xs text-muted-foreground">支持自由拖拽排版与响应式布局调整</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Canvas;
