import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  useReactFlow,
  useViewport,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type PersonRecord } from '../types';
import { PersonNode } from './nodes/PersonNode';
import { ClanHeaderNode } from './nodes/ClanHeaderNode';
import { UnionNode } from './nodes/UnionNode';
import { GenealogyEdge } from './edges/GenealogyEdge';
import { buildGenealogyGraph } from './utils/layoutBuilder';
import {
  computeTopologySignature,
  patchFlowNodesAttributes,
} from './utils/canvasGraphDiff';
import { layoutWithElk } from './utils/elkLayout';
import { type GenealogyFlowNode, type GenealogyFlowEdge } from './types';
import { CanvasZoomBar } from './components/CanvasZoomBar';
import { formatPersonAliases } from '../utils/personHelpers';
import {
  Sparkles,
  RotateCcw,
  Map as MapIcon,
  Filter,
  Printer,
  Search,
  ChevronDown,
  X,
} from 'lucide-react';
import { usePreferencesStore } from '../../../store/usePreferencesStore';

const nodeTypes = {
  person: PersonNode,
  clanHeader: ClanHeaderNode,
  union: UnionNode,
};

const edgeTypes = {
  genealogy: GenealogyEdge,
};

interface GenealogyCanvasProps {
  persons: PersonRecord[];
  selectedPersonId?: string | null;
  branchTitle?: string;
  clanSurname?: string;
  onSelectPerson?: (id: string | null) => void;
  onAddChild?: (fatherId: string, gender?: 'male' | 'female') => void;
  onAddSibling?: (refPersonId: string, gender?: 'male' | 'female') => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (personId: string) => void;
  onDeletePerson?: (id: string) => void;
  onAddPersonDirectly?: (
    person: Partial<PersonRecord>,
    position?: { x: number; y: number }
  ) => void;
  onUpdatePersonFather?: (childId: string, fatherId: string | null) => void;
  maxGenerationFilter?: number;
}

interface CardTreeCanvasViewProps {
  filteredPersons: PersonRecord[];
  selectedPersonId?: string | null;
  clanSurname?: string;
  showMiniMap: boolean;
  locateNonce: number;
  resetNonce: number;
  elkNonce: number;
  onIsLayoutingChange: (layouting: boolean) => void;
  onSelectPerson?: (id: string | null) => void;
  onAddChild?: (fatherId: string, gender?: 'male' | 'female') => void;
  onAddSibling?: (refPersonId: string, gender?: 'male' | 'female') => void;
  onAddSpouse?: (personId: string) => void;
  onAddParent?: (personId: string) => void;
  onDeletePerson?: (id: string) => void;
  onUpdatePersonFather?: (childId: string, fatherId: string | null) => void;
  toolbar?: React.ReactNode;
}

const CardTreeCanvasView: React.FC<CardTreeCanvasViewProps> = ({
  filteredPersons,
  selectedPersonId,
  clanSurname = '',
  showMiniMap,
  locateNonce,
  resetNonce,
  elkNonce,
  onIsLayoutingChange,
  onSelectPerson,
  onAddChild,
  onAddSibling,
  onAddSpouse,
  onAddParent,
  onDeletePerson,
  onUpdatePersonFather,
  toolbar,
}) => {
  const reactFlow = useReactFlow();
  const { zoom } = useViewport();
  const isDarkMode = usePreferencesStore((state) => state.isDarkMode);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    new Set()
  );
  const [openMenuPersonId, setOpenMenuPersonId] = useState<string | null>(null);

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

  const callbacksRef = useRef({
    onSelectPerson,
    onAddChild,
    onAddSibling,
    onAddSpouse,
    onAddParent,
    onDeletePerson,
    onIsLayoutingChange,
  });
  useEffect(() => {
    callbacksRef.current = {
      onSelectPerson,
      onAddChild,
      onAddSibling,
      onAddSpouse,
      onAddParent,
      onDeletePerson,
      onIsLayoutingChange,
    };
  });

  const stableOnSelectPerson = useCallback(
    (id: string | null) => callbacksRef.current.onSelectPerson?.(id),
    []
  );
  const stableOnAddChild = useCallback(
    (fatherId: string, gender?: 'male' | 'female') =>
      callbacksRef.current.onAddChild?.(fatherId, gender),
    []
  );
  const stableOnAddSibling = useCallback(
    (refPersonId: string, gender?: 'male' | 'female') =>
      callbacksRef.current.onAddSibling?.(refPersonId, gender),
    []
  );
  const stableOnAddSpouse = useCallback(
    (personId: string) => callbacksRef.current.onAddSpouse?.(personId),
    []
  );
  const stableOnAddParent = useCallback(
    (personId: string) => callbacksRef.current.onAddParent?.(personId),
    []
  );
  const stableOnDeletePerson = useCallback(
    (id: string) => callbacksRef.current.onDeletePerson?.(id),
    []
  );

  const topologySignature = useMemo(
    () =>
      computeTopologySignature(filteredPersons, collapsedNodeIds, clanSurname),
    [filteredPersons, collapsedNodeIds, clanSurname]
  );

  const buildGraphWithLatestCallbacks = useCallback(
    () =>
      buildGenealogyGraph(filteredPersons, {
        selectedPersonId,
        openMenuPersonId,
        clanSurname,
        collapsedNodeIds,
        onToggleCollapse: handleToggleCollapse,
        onToggleAddMenu: setOpenMenuPersonId,
        onSelectPerson: stableOnSelectPerson,
        onAddChild: stableOnAddChild,
        onAddSibling: stableOnAddSibling,
        onAddSpouse: stableOnAddSpouse,
        onAddParent: stableOnAddParent,
        onDeletePerson: stableOnDeletePerson,
      }),
    [
      filteredPersons,
      selectedPersonId,
      openMenuPersonId,
      clanSurname,
      collapsedNodeIds,
      handleToggleCollapse,
      stableOnSelectPerson,
      stableOnAddChild,
      stableOnAddSibling,
      stableOnAddSpouse,
      stableOnAddParent,
      stableOnDeletePerson,
    ]
  );

  const [initialGraph] = useState(() => buildGraphWithLatestCallbacks());

  const [nodes, setNodes, onNodesChange] =
    useNodesState<GenealogyFlowNode>(initialGraph.nodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<GenealogyFlowEdge>(initialGraph.edges);

  const prevTopologyRef = useRef<string>(topologySignature);
  const latestBuildRef = useRef(buildGraphWithLatestCallbacks);
  useEffect(() => {
    latestBuildRef.current = buildGraphWithLatestCallbacks;
  }, [buildGraphWithLatestCallbacks]);

  useEffect(() => {
    if (prevTopologyRef.current !== topologySignature) {
      prevTopologyRef.current = topologySignature;
      const next = latestBuildRef.current();
      setNodes(next.nodes);
      setEdges(next.edges);
      return;
    }

    setNodes((prev) =>
      patchFlowNodesAttributes(prev, {
        persons: filteredPersons,
        selectedPersonId,
        openMenuPersonId,
        clanSurname,
      })
    );
  }, [
    topologySignature,
    filteredPersons,
    selectedPersonId,
    openMenuPersonId,
    clanSurname,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    let rafId = 0;
    const timer = setTimeout(() => {
      rafId = requestAnimationFrame(() => {
        reactFlow.fitView({ padding: 0.15, duration: 400 });
      });
    }, 150);
    return () => {
      clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [filteredPersons.length, resetNonce, reactFlow]);

  useEffect(() => {
    if (locateNonce === 0 || !selectedPersonId) return;
    const match = reactFlow.getNode(selectedPersonId);
    if (match) {
      reactFlow.setCenter(match.position.x, match.position.y, {
        duration: 600,
        zoom: 1.1,
      });
    }
  }, [locateNonce, selectedPersonId, reactFlow]);

  useEffect(() => {
    if (elkNonce === 0) return;
    const abortController = new AbortController();
    let fitViewTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      callbacksRef.current.onIsLayoutingChange(true);
      try {
        const currentNodes = reactFlow.getNodes() as GenealogyFlowNode[];
        const currentEdges = reactFlow.getEdges() as GenealogyFlowEdge[];
        const layoutedNodes = await layoutWithElk(currentNodes, currentEdges, {
          signal: abortController.signal,
        });
        if (!abortController.signal.aborted) {
          setNodes(layoutedNodes);
          fitViewTimer = setTimeout(() => {
            if (!abortController.signal.aborted) {
              reactFlow.fitView({ padding: 0.15, duration: 500 });
            }
          }, 50);
        }
      } catch {
        // Ignore cancellation or auto-layout failures and keep existing positions
      } finally {
        if (!abortController.signal.aborted) {
          callbacksRef.current.onIsLayoutingChange(false);
        }
      }
    };
    run();
    return () => {
      abortController.abort();
      if (fitViewTimer !== null) {
        clearTimeout(fitViewTimer);
      }
    };
  }, [elkNonce, reactFlow, setNodes]);

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
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: 'genealogy',
            data: { relationship: 'bloodline' },
          },
          eds
        )
      );
      if (connection.source && connection.target && onUpdatePersonFather) {
        onUpdatePersonFather(connection.target, connection.source);
      }
    },
    [setEdges, onUpdatePersonFather]
  );

  return (
    <div className="w-full h-full relative border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneClick={() => {
          setOpenMenuPersonId(null);
          onSelectPerson?.(null);
        }}
        minZoom={0.2}
        maxZoom={2.8}
        defaultViewport={{ x: 60, y: 60, zoom: 0.9 }}
        className="touch-none fs-card-tree-stage"
      >
        {showMiniMap && (
          <MiniMap
            position="top-right"
            nodeColor={(node: Node) => {
              if (node.type === 'clanHeader') return 'transparent';
              if (node.type === 'union') return isDarkMode ? '#5E6973' : '#9EA1A3';
              if (node.id === selectedPersonId)
                return isDarkMode ? '#58B1CD' : '#057091';
              const gen =
                (node.data as { person?: { generation?: number } })?.person
                  ?.generation || 1;
              if (gen === 1) return isDarkMode ? '#4A98B2' : '#057091';
              return isDarkMode ? '#64748b' : '#9EA1A3';
            }}
            nodeStrokeWidth={2}
            className="!bg-card/95 !backdrop-blur !border-border !rounded-lg !shadow-[var(--shadow-card-hover)] !w-44 !h-32"
          />
        )}

      </ReactFlow>

      {/* Top-Left Floating Toolbar (separated from Bottom-Left ZoomBar & Top-Right MiniMap) */}
      {toolbar && (
        <div
          data-no-print="true"
          className={`absolute top-3 left-3 z-30 pointer-events-none ${
            showMiniMap ? 'right-52' : 'right-3'
          }`}
        >
          <div className="inline-flex pointer-events-auto max-w-full">{toolbar}</div>
        </div>
      )}

      {/* Bottom-Left Compact Zoom Controls */}
      <div
        data-no-print="true"
        className="absolute bottom-3 left-3 z-30 pointer-events-none"
      >
        <div className="pointer-events-auto shrink-0">
          <CanvasZoomBar
            zoom={zoom}
            minZoom={0.2}
            maxZoom={2.8}
            onZoomOut={() => reactFlow.zoomOut({ duration: 150 })}
            onZoomIn={() => reactFlow.zoomIn({ duration: 150 })}
            onResetZoom={() => reactFlow.zoomTo(1, { duration: 200 })}
          />
        </div>
      </div>
    </div>
  );
};

export const GenealogyCanvas: React.FC<GenealogyCanvasProps> = ({
  persons,
  selectedPersonId,
  clanSurname = '',
  onSelectPerson,
  onAddChild,
  onAddSibling,
  onAddSpouse,
  onAddParent,
  onDeletePerson,
  onUpdatePersonFather,
  maxGenerationFilter = 99,
}) => {
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [activeGenFilter, setActiveGenFilter] =
    useState<number>(maxGenerationFilter);
  const [isLayouting, setIsLayouting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locateNonce, setLocateNonce] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [elkNonce, setElkNonce] = useState(0);

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => (p.generation || 1) <= activeGenFilter);
  }, [persons, activeGenFilter]);

  const handleSearchLocate = (query: string) => {
    setSearchQuery(query);
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = filteredPersons.find((p) => {
      const surname = p.surname?.trim() || (p.spouseOfId ? '' : clanSurname);
      const fullName =
        surname && !p.name.startsWith(surname) ? `${surname}${p.name}` : p.name;
      return (
        p.name.toLowerCase().includes(q) ||
        fullName.toLowerCase().includes(q) ||
        formatPersonAliases(p).toLowerCase().includes(q)
      );
    });
    if (match) {
      onSelectPerson?.(match.id);
      setLocateNonce((n) => n + 1);
    }
  };

  const maxGen = Math.max(...persons.map((p) => p.generation || 1), 1);

  const floatingToolbar = (
    <div
      data-no-print="true"
      className="flex flex-wrap items-center gap-1 bg-card/95 backdrop-blur-md border border-border rounded-lg p-1 shadow-[var(--shadow-card-hover)]"
    >
      {/* Quick Search */}
      <div className="relative w-40 md:w-48">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={13}
        />
        <input
          type="text"
          placeholder="搜姓名或字号定位..."
          value={searchQuery}
          onChange={(e) => handleSearchLocate(e.target.value)}
          className="w-full h-8 pl-8 pr-7 py-1 bg-[var(--surface-subtle)] border border-border rounded-md text-[13px] text-foreground placeholder:text-placeholder outline-none focus:bg-card focus:border-primary focus:ring-1 focus:ring-primary focus:shadow-[var(--shadow-focus-halo)] transition-all duration-150"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="清空搜索"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <span
        aria-hidden="true"
        className="hidden sm:block h-4 w-px bg-border mx-0.5 shrink-0"
      />

      {/* Contextual Tools & Generation Filter */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setElkNonce((n) => n + 1)}
          disabled={isLayouting}
          className="h-8 px-2.5 rounded-md text-[13px] bg-[var(--surface-active)] hover:bg-primary/15 text-primary border border-primary/25 flex items-center gap-1.5 font-semibold whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
        >
          <Sparkles
            size={13}
            className={isLayouting ? 'animate-spin' : ''}
          />
          <span>{isLayouting ? '排版中' : 'ELK排版'}</span>
        </button>

        {/* Generation Range Filter */}
        <div className="relative flex items-center h-8 rounded-md px-2 hover:bg-[var(--surface-hover)] transition-colors">
          <Filter
            size={13}
            className="text-primary shrink-0 mr-1.5"
          />
          <select
            aria-label="世代范围筛选"
            value={activeGenFilter}
            onChange={(e) => setActiveGenFilter(Number(e.target.value))}
            className="appearance-none bg-transparent border-none text-foreground font-medium outline-none text-[13px] cursor-pointer tabular-nums pr-4"
          >
            <option value={99} className="bg-card text-foreground">
              全部世代 ({maxGen}世)
            </option>
            {Array.from({ length: maxGen }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g} className="bg-card text-foreground">
                前 {g} 世
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            aria-hidden="true"
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>

        <span
          aria-hidden="true"
          className="h-4 w-px bg-border mx-0.5 shrink-0"
        />

        {/* Fit / Reset View */}
        <button
          type="button"
          onClick={() => setResetNonce((n) => n + 1)}
          className="h-8 px-2.5 rounded-md text-[13px] font-medium text-muted-foreground hover:text-primary hover:bg-[var(--surface-active)] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          title="居中重置视图"
        >
          <RotateCcw size={13} />
          <span>居中</span>
        </button>

        {/* Print / Export */}
        <button
          type="button"
          onClick={() => window.print()}
          className="h-8 w-8 rounded-md text-muted-foreground hover:text-primary hover:bg-[var(--surface-active)] transition-colors flex items-center justify-center cursor-pointer shrink-0"
          title="打印世系图"
          aria-label="打印世系图"
        >
          <Printer size={14} />
        </button>

        {/* Toggle MiniMap */}
        <button
          type="button"
          onClick={() => setShowMiniMap(!showMiniMap)}
          className={`h-8 w-8 rounded-md transition-colors flex items-center justify-center cursor-pointer shrink-0 ${
            showMiniMap
              ? 'bg-[var(--surface-active)] text-primary'
              : 'text-muted-foreground hover:text-primary hover:bg-[var(--surface-active)]'
          }`}
          title="切换小地图"
          aria-label="切换小地图"
        >
          <MapIcon size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full relative overflow-hidden bg-background text-foreground select-none">
      <ReactFlowProvider>
        <CardTreeCanvasView
          filteredPersons={filteredPersons}
          selectedPersonId={selectedPersonId}
          clanSurname={clanSurname}
          showMiniMap={showMiniMap}
          locateNonce={locateNonce}
          resetNonce={resetNonce}
          elkNonce={elkNonce}
          onIsLayoutingChange={setIsLayouting}
          onSelectPerson={onSelectPerson}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onAddSpouse={onAddSpouse}
          onAddParent={onAddParent}
          onDeletePerson={onDeletePerson}
          onUpdatePersonFather={onUpdatePersonFather}
          toolbar={floatingToolbar}
        />
      </ReactFlowProvider>
    </div>
  );
};

export default GenealogyCanvas;
