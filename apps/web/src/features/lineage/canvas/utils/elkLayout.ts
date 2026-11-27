import type { ElkNode } from 'elkjs/lib/elk.bundled.js';
import { type GenealogyFlowNode, type GenealogyFlowEdge } from '../types';
import { FS_CARD_H, FS_CARD_W } from './layoutBuilder';

let elkPromise: Promise<{ layout: (graph: ElkNode) => Promise<ElkNode> }> | null =
  null;

function getElkInstance() {
  if (!elkPromise) {
    elkPromise = import('elkjs/lib/elk.bundled.js').then(
      ({ default: ELK }) => new ELK()
    );
  }
  return elkPromise;
}

export async function layoutWithElk(
  nodes: GenealogyFlowNode[],
  edges: GenealogyFlowEdge[]
): Promise<GenealogyFlowNode[]> {
  if (!nodes || nodes.length === 0) return [];

  const clanHeaders = nodes.filter((n) => n.type === 'clanHeader');
  const graphNodes = nodes.filter((n) => n.type !== 'clanHeader');

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '28',
      'elk.layered.spacing.nodeNodeBetweenLayers': '68',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: graphNodes.map((node) => {
      const isCard = node.type === 'person';
      const isUnion = node.type === 'union';
      const width = isCard ? FS_CARD_W : isUnion ? 32 : 8;
      const height = isCard ? FS_CARD_H : isUnion ? 32 : 8;
      const generation =
        node.type === 'person'
          ? (node.data as { person?: { generation?: number } }).person?.generation
          : (node.data as { generation?: number })?.generation;

      return {
        id: node.id,
        width,
        height,
        layoutOptions: generation
          ? {
              'elk.layered.layering.layerId': String(generation),
            }
          : undefined,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  try {
    const elk = await getElkInstance();
    const layouted = await elk.layout(elkGraph);

    const updatedGraphNodes = graphNodes.map((node) => {
      const layoutNode = layouted.children?.find((c) => c.id === node.id);
      return {
        ...node,
        position: {
          x: layoutNode?.x ?? node.position.x,
          y: layoutNode?.y ?? node.position.y,
        },
      };
    });

    // Reposition clan headers right above their corresponding root card
    const updatedHeaders = clanHeaders.map((header) => {
      const rootId = header.id.replace(/^clan-header-/, '');
      const rootNode = updatedGraphNodes.find((n) => n.id === rootId);
      if (!rootNode) return header;
      return {
        ...header,
        position: {
          x: rootNode.position.x + FS_CARD_W / 2 - 120,
          y: rootNode.position.y - 58,
        },
      };
    });

    return [...updatedHeaders, ...updatedGraphNodes];
  } catch {
    return nodes;
  }
}
