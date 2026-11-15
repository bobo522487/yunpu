import ELK, { ElkNode } from 'elkjs/lib/elk.bundled.js';
import { GenealogyFlowNode, GenealogyFlowEdge } from '../types';

const elk = new ELK();

export async function layoutWithElk(
  nodes: GenealogyFlowNode[],
  edges: GenealogyFlowEdge[]
): Promise<GenealogyFlowNode[]> {
  if (!nodes || nodes.length === 0) return [];

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '48',
      'elk.layered.spacing.nodeNodeBetweenLayers': '90',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: nodes.map((node) => {
      const isPerson = node.type === 'person';
      const width = isPerson ? 220 : 24;
      const height = isPerson ? 120 : 24;
      const generation = isPerson
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
    const layouted = await elk.layout(elkGraph);

    return nodes.map((node) => {
      const layoutNode = layouted.children?.find((c) => c.id === node.id);
      return {
        ...node,
        position: {
          x: layoutNode?.x ?? node.position.x,
          y: layoutNode?.y ?? node.position.y,
        },
      };
    });
  } catch (err) {
    console.warn('ELK layout fallback:', err);
    return nodes;
  }
}
