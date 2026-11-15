import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  useReactFlow,
  Panel,
  BackgroundVariant,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PersonRecord } from '../types';
import { PersonNode } from './nodes/PersonNode';
import { BookPersonNode } from './nodes/BookPersonNode';
import { GenHeaderNode } from './nodes/GenHeaderNode';
import { UnionNode } from './nodes/UnionNode';
import { GenealogyEdge } from './edges/GenealogyEdge';
import { BookGenealogyEdge } from './edges/BookGenealogyEdge';
import { buildGenealogyGraph } from './utils/layoutBuilder';
import { buildBookLtrGenealogyGraph } from './utils/bookLtrLayout';
import { layoutWithElk } from './utils/elkLayout';
import { GenealogyFlowNode, GenealogyFlowEdge } from './types';
import {
  Sparkles,
  Plus,
  RotateCcw,
  Map as MapIcon,
  Filter,
  BookOpen,
  Printer,
  Search,
  GripHorizontal,
  LayoutGrid,
  User,
  Crown,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { usePreferencesStore } from '../../../store/usePreferencesStore';

const nodeTypes = {
  person: PersonNode,
  bookPerson: BookPersonNode,
  genHeader: GenHeaderNode,
  union: UnionNode,
};

const edgeTypes = {
  genealogy: GenealogyEdge,
  bookGenealogy: BookGenealogyEdge,
};

interface GenealogyCanvasProps {
  persons: PersonRecord[];
  selectedPersonId?: string | null;
  branchTitle?: string;
  clanSurname?: string;
  onSelectPerson?: (id: string | null) => void;
  onAddChild?: (fatherId: string) => void;
  onAddSpouse?: (personId: string) => void;
  onDeletePerson?: (id: string) => void;
  onAddPersonDirectly?: (
    person: Partial<PersonRecord>,
    position?: { x: number; y: number }
  ) => void;
  onUpdatePersonFather?: (childId: string, fatherId: string | null) => void;
  maxGenerationFilter?: number;
}

const CanvasInner: React.FC<GenealogyCanvasProps> = ({
  persons,
  selectedPersonId,
  clanSurname = '',
  onSelectPerson,
  onAddChild,
  onAddSpouse,
  onDeletePerson,
  onAddPersonDirectly,
  onUpdatePersonFather,
  maxGenerationFilter = 20,
}) => {
  const reactFlow = useReactFlow();
  const isDarkMode = usePreferencesStore((state) => state.isDarkMode);
  const [layoutMode, setLayoutMode] = useState<'book_ltr' | 'card_vertical'>(
    'book_ltr'
  );
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [activeGenFilter, setActiveGenFilter] =
    useState<number>(maxGenerationFilter);
  const [isLayouting, setIsLayouting] = useState(false);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleCollapse = useCallback((personId: string) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }, []);

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => (p.generation || 1) <= activeGenFilter);
  }, [persons, activeGenFilter]);

  const { initialNodes, initialEdges } = useMemo(() => {
    if (layoutMode === 'book_ltr') {
      const res = buildBookLtrGenealogyGraph(filteredPersons, {
        selectedPersonId,
        clanSurname,
        collapsedNodeIds,
        onToggleCollapse: handleToggleCollapse,
        onSelectPerson,
        onAddChild,
        onAddSpouse,
        onDeletePerson,
        colWidth: 196,
        rowHeight: 64,
        startX: 60,
        startY: 110,
      });
      return {
        initialNodes: res.nodes,
        initialEdges: res.edges,
      };
    } else {
      const res = buildGenealogyGraph(filteredPersons, {
        selectedPersonId,
        clanSurname,
        collapsedNodeIds,
        onToggleCollapse: handleToggleCollapse,
        onSelectPerson,
        onAddChild,
        onAddSpouse,
        onDeletePerson,
      });
      return {
        initialNodes: res.nodes,
        initialEdges: res.edges,
      };
    }
  }, [
    filteredPersons,
    layoutMode,
    selectedPersonId,
    clanSurname,
    collapsedNodeIds,
    handleToggleCollapse,
    onSelectPerson,
    onAddChild,
    onAddSpouse,
    onDeletePerson,
  ]);

  const [nodes, setNodes, onNodesChange] =
    useNodesState<GenealogyFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<GenealogyFlowEdge>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  useEffect(() => {
    const timer = setTimeout(() => {
      reactFlow.fitView({ padding: 0.15, duration: 400 });
    }, 150);
    return () => clearTimeout(timer);
  }, [filteredPersons.length, layoutMode, reactFlow]);

  const handleApplyElkLayout = useCallback(async () => {
    setIsLayouting(true);
    try {
      const layoutedNodes = await layoutWithElk(nodes, edges);
      setNodes(layoutedNodes);
      setTimeout(() => {
        reactFlow.fitView({ padding: 0.15, duration: 500 });
      }, 50);
    } catch (e) {
      console.error('Auto-layout error:', e);
    } finally {
      setIsLayouting(false);
    }
  }, [nodes, edges, reactFlow, setNodes]);

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (connection.source === connection.target) return false;
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      const sourceGen =
        (sourceNode.data as { person?: { generation?: number }; generation?: number })
          ?.person?.generation ||
        (sourceNode.data as { generation?: number })?.generation;
      const targetGen =
        (targetNode.data as { person?: { generation?: number }; generation?: number })
          ?.person?.generation ||
        (targetNode.data as { generation?: number })?.generation;
      if (sourceGen && targetGen) {
        return sourceGen < targetGen;
      }
      return true;
    },
    [nodes]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeType = layoutMode === 'book_ltr' ? 'bookGenealogy' : 'genealogy';
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: edgeType,
            data: { relationship: 'bloodline' },
          },
          eds
        )
      );
      if (connection.source && connection.target && onUpdatePersonFather) {
        onUpdatePersonFather(connection.target, connection.source);
      }
    },
    [setEdges, layoutMode, onUpdatePersonFather]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const rawData = event.dataTransfer.getData(
        'application/genealogy-template'
      );
      const templateData = rawData ? JSON.parse(rawData) : null;
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let calculatedGeneration = 1;
      if (layoutMode === 'book_ltr') {
        calculatedGeneration = templateData?.isRoot
          ? 1
          : Math.max(1, Math.floor((position.x - 60) / 140) + 1);
      } else {
        calculatedGeneration = templateData?.isRoot
          ? 1
          : Math.max(1, Math.floor(position.y / 240) + 1);
      }

      if (onAddPersonDirectly) {
        onAddPersonDirectly(
          {
            name: templateData?.name || '新录族人',
            gender: templateData?.gender || 'male',
            generation: calculatedGeneration,
            rank: templateData?.rank,
          },
          position
        );
      }
    },
    [reactFlow, layoutMode, onAddPersonDirectly]
  );

  const handleSearchLocate = (query: string) => {
    setSearchQuery(query);
    if (!query) return;
    const match = nodes.find(
      (n) =>
        n.type !== 'union' &&
        n.type !== 'genHeader' &&
        (n.data as { person?: PersonRecord }).person?.name
          ?.toLowerCase()
          .includes(query.toLowerCase())
    );
    if (match) {
      reactFlow.setCenter(match.position.x, match.position.y, {
        duration: 600,
        zoom: 1.1,
      });
      onSelectPerson?.(match.id);
    }
  };

  const maxGen = Math.max(...persons.map((p) => p.generation || 1), 1);

  return (
    <div className="w-full h-full relative overflow-hidden bg-background text-foreground select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneClick={() => onSelectPerson?.(null)}
        minZoom={0.2}
        maxZoom={2.8}
        defaultViewport={{ x: 60, y: 60, zoom: 0.9 }}
        className="touch-none bg-background"
      >
        <Background
          variant={
            layoutMode === 'book_ltr'
              ? BackgroundVariant.Lines
              : BackgroundVariant.Dots
          }
          gap={layoutMode === 'book_ltr' ? 140 : 24}
          size={1}
          color="hsl(var(--border))"
          className="opacity-70 dark:opacity-35"
        />

        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!bg-card/95 !backdrop-blur !border-border !rounded-lg !shadow-md"
        />

        {showMiniMap && (
          <MiniMap
            position="bottom-right"
            nodeColor={(node: Node) => {
              if (node.type === 'union') return '#ec4899';
              if (node.id === selectedPersonId) return 'hsl(var(--primary))';
              const gen =
                (node.data as { person?: { generation?: number } })?.person
                  ?.generation || 1;
              if (gen === 1) return 'hsl(var(--primary))';
              return isDarkMode ? '#52525b' : '#a1a1aa';
            }}
            nodeStrokeWidth={2}
            className="!bg-card/90 !backdrop-blur !border-border !rounded-lg !shadow-md !w-44 !h-32"
          />
        )}

        {/* TOP-RIGHT CONTROLS TOOLBAR */}
        <Panel
          position="top-right"
          className="flex flex-wrap items-center justify-end gap-2 m-3 z-30"
        >
          {/* Quick Search */}
          <div className="relative w-36 md:w-44">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={12}
            />
            <input
              type="text"
              placeholder="搜族人定位..."
              value={searchQuery}
              onChange={(e) => handleSearchLocate(e.target.value)}
              className="w-full h-8 pl-7 pr-2.5 py-1 bg-card/90 backdrop-blur border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-serif"
            />
          </div>

          {/* Layout Mode Switcher */}
          <div className="flex items-center bg-card/90 backdrop-blur border border-border rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setLayoutMode('book_ltr')}
              className={`px-2.5 py-1 rounded text-xs font-serif font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                layoutMode === 'book_ltr'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="现代书籍阅读习惯：欧式世系图（从左至右 横向排版）"
            >
              <BookOpen size={12} /> 欧式图谱
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('card_vertical')}
              className={`px-2.5 py-1 rounded text-xs font-sans font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                layoutMode === 'card_vertical'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="现代卡片式（纵向层级树）"
            >
              <LayoutGrid size={12} /> 卡片树
            </button>
          </div>

          {/* ELK Smart Layout for card mode */}
          {layoutMode === 'card_vertical' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleApplyElkLayout}
              disabled={isLayouting}
              className="h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 shadow-xs flex items-center gap-1 font-medium whitespace-nowrap"
            >
              <Sparkles
                size={12}
                className={isLayouting ? 'animate-spin' : ''}
              />
              {isLayouting ? '排版中' : 'ELK排版'}
            </Button>
          )}

          {/* Generation Range Filter */}
          <div className="flex items-center gap-1 h-8 bg-card/90 backdrop-blur border border-border rounded-lg px-2.5 py-1 shadow-xs text-xs text-muted-foreground font-serif">
            <Filter size={12} className="text-primary shrink-0" />
            <select
              value={activeGenFilter}
              onChange={(e) => setActiveGenFilter(Number(e.target.value))}
              className="bg-transparent border-none text-foreground font-medium outline-none text-xs cursor-pointer font-serif tabular-nums"
            >
              <option value={99}>全部世代 ({maxGen}世)</option>
              {Array.from({ length: maxGen }, (_, i) => i + 1).map((g) => (
                <option key={g} value={g}>
                  前 {g} 世
                </option>
              ))}
            </select>
          </div>

          {/* Fit View */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reactFlow.fitView({ padding: 0.15, duration: 400 })}
            className="h-8 text-xs bg-card/90 backdrop-blur border border-border shadow-xs flex items-center gap-1 whitespace-nowrap"
            title="居中重置"
          >
            <RotateCcw size={12} /> 居中
          </Button>

          {/* Print/Export */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.print()}
            className="h-8 w-8 bg-card/90 backdrop-blur border border-border shadow-xs text-muted-foreground hover:text-foreground"
            title="打印谱系图"
          >
            <Printer size={13} />
          </Button>

          {/* Toggle MiniMap */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowMiniMap(!showMiniMap)}
            className={`h-8 w-8 bg-card/90 backdrop-blur border border-border shadow-xs ${
              showMiniMap
                ? 'text-primary font-bold'
                : 'text-muted-foreground'
            }`}
            title="切换小地图"
          >
            <MapIcon
              size={13}
              className={showMiniMap ? 'text-primary' : undefined}
            />
          </Button>
        </Panel>

        {/* BOTTOM-RIGHT: DRAG & DROP QUICK CREATION PALETTE */}
        <Panel
          position="bottom-right"
          className="m-3 mr-14 flex flex-col gap-1 z-20"
        >
          <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-2 shadow-sm font-serif">
            <div className="flex items-center justify-between text-[11px] font-bold text-foreground pb-1 border-b border-border/50 mb-1.5">
              <span className="flex items-center gap-1">
                <GripHorizontal size={11} className="text-primary" />
                拖拽录入族人
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Male Template */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/genealogy-template',
                    JSON.stringify({
                      name: '新男丁',
                      gender: 'male',
                      rank: '长子',
                    })
                  );
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/40 hover:bg-muted border border-border/70 cursor-grab active:cursor-grabbing text-xs text-foreground transition-all hover:border-primary/50 whitespace-nowrap"
              >
                <User size={11} className="text-primary" />
                <span>男丁</span>
                <Plus size={10} className="text-muted-foreground" />
              </div>

              {/* Female Template */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/genealogy-template',
                    JSON.stringify({
                      name: '新女眷',
                      gender: 'female',
                      rank: '长女',
                    })
                  );
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/40 hover:bg-muted border border-border/70 cursor-grab active:cursor-grabbing text-xs text-foreground transition-all hover:border-pink-500/50 whitespace-nowrap"
              >
                <User size={11} className="text-pink-500" />
                <span>女眷</span>
                <Plus size={10} className="text-muted-foreground" />
              </div>

              {/* Root Ancestor */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/genealogy-template',
                    JSON.stringify({
                      name: '新立始祖',
                      gender: 'male',
                      isRoot: true,
                      generation: 1,
                    })
                  );
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-accent hover:bg-accent/80 border border-border cursor-grab active:cursor-grabbing text-xs text-foreground transition-all whitespace-nowrap"
              >
                <Crown size={11} className="text-primary" />
                <span>始祖</span>
                <Plus size={10} className="text-primary" />
              </div>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export const GenealogyCanvas: React.FC<GenealogyCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
};

export default GenealogyCanvas;
