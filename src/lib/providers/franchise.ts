import { cache } from "react";
import {
  Graph,
  layout,
  type EdgeLabel,
  type GraphLabel,
  type NodeLabel,
} from "@dagrejs/dagre";

import { fetchAniList, MEDIA_CARD_FIELDS } from "@/lib/providers/anilist";
import {
  transformAnimeSummary,
  type AniListMedia,
} from "@/lib/providers/transformers/anilist";
import type {
  FranchiseEdge,
  FranchiseGraph,
  FranchiseNode,
} from "@/types/anime";

/** Card dimensions the layout reserves for each node (px). */
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 96;

// Bound the traversal so a sprawling franchise (e.g. Gundam) can't fan out
// into hundreds of requests. BFS from the root keeps the closest entries.
const MAX_NODES = 60;
const MAX_DEPTH = 6;
const BATCH_SIZE = 50;

// Anime-to-anime relations that describe franchise structure. Manga links
// (SOURCE/ADAPTATION) and non-structural links (CHARACTER/OTHER) are dropped.
const GRAPH_RELATION_TYPES = new Set([
  "PREQUEL",
  "SEQUEL",
  "SIDE_STORY",
  "PARENT",
  "SPIN_OFF",
  "ALTERNATIVE",
  "SUMMARY",
  "COMPILATION",
  "CONTAINS",
]);

type FranchiseMedia = AniListMedia & {
  relations?: {
    edges?: Array<{
      relationType: string | null;
      node?: { id: number; type: string | null } | null;
    } | null> | null;
  } | null;
};

type FranchisePageResult = {
  Page: { media: FranchiseMedia[] | null } | null;
};

const FRANCHISE_QUERY = `
  query ($ids: [Int!]) {
    Page(perPage: ${BATCH_SIZE}) {
      media(id_in: $ids, type: ANIME) {
        ${MEDIA_CARD_FIELDS}
        relations {
          edges {
            relationType
            node {
              id
              type
            }
          }
        }
      }
    }
  }
`;

/** Sortable release value; unknown dates sort last (treated as newest). */
function startValue(node: FranchiseNode): number {
  const date = node.anime.startDate;
  if (date?.year) {
    return date.year * 10000 + (date.month ?? 0) * 100 + (date.day ?? 0);
  }
  if (node.anime.seasonYear) {
    return node.anime.seasonYear * 10000;
  }
  return Number.POSITIVE_INFINITY;
}

/** Orders a related pair so the edge flows older -> newer. */
function orderByDate(a: FranchiseNode, b: FranchiseNode): [number, number] {
  const av = startValue(a);
  const bv = startValue(b);
  if (av === bv) {
    return a.anime.id <= b.anime.id
      ? [a.anime.id, b.anime.id]
      : [b.anime.id, a.anime.id];
  }
  return av < bv ? [a.anime.id, b.anime.id] : [b.anime.id, a.anime.id];
}

/**
 * AniList relations are symmetric (A lists SEQUEL->B, B lists PREQUEL->A), so a
 * pair can carry two labels. Collapse them to a single canonical label.
 */
function canonicalRelation(types: Set<string>): string {
  if (types.has("SEQUEL") || types.has("PREQUEL")) return "SEQUEL";
  if (types.has("PARENT") || types.has("SIDE_STORY")) return "SIDE_STORY";
  if (types.has("SPIN_OFF")) return "SPIN_OFF";
  if (types.has("SUMMARY")) return "SUMMARY";
  if (types.has("COMPILATION") || types.has("CONTAINS")) return "CONTAINS";
  if (types.has("ALTERNATIVE")) return "ALTERNATIVE";
  return [...types][0] ?? "RELATED";
}

/**
 * Walks the AniList relation graph outward from `rootId` and returns the
 * connected franchise as normalized nodes + canonical edges (no layout yet).
 * Tolerates provider failure by returning whatever was collected so far.
 */
export const getFranchiseGraph = cache(async function getFranchiseGraph(
  rootId: number,
): Promise<FranchiseGraph> {
  const nodes = new Map<number, FranchiseNode>();
  const visited = new Set<number>();
  const pairs = new Map<string, { a: number; b: number; types: Set<string> }>();

  let frontier: number[] = [rootId];
  let depth = 0;

  while (frontier.length > 0 && depth < MAX_DEPTH && visited.size < MAX_NODES) {
    const batch = frontier
      .filter((id) => !visited.has(id))
      .slice(0, BATCH_SIZE);
    if (batch.length === 0) break;
    batch.forEach((id) => visited.add(id));

    let data: FranchisePageResult;
    try {
      data = await fetchAniList<FranchisePageResult>(
        FRANCHISE_QUERY,
        { ids: batch },
        900,
      );
    } catch {
      // Return the partial graph rather than failing the whole request.
      break;
    }

    const nextFrontier: number[] = [];

    for (const item of data.Page?.media ?? []) {
      if (!nodes.has(item.id)) {
        nodes.set(item.id, {
          anime: transformAnimeSummary(item),
          isRoot: item.id === rootId,
          x: 0,
          y: 0,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
        });
      }

      for (const edge of item.relations?.edges ?? []) {
        const neighbor = edge?.node;
        const relationType = edge?.relationType ?? "";
        if (
          !neighbor ||
          neighbor.type !== "ANIME" ||
          !GRAPH_RELATION_TYPES.has(relationType)
        ) {
          continue;
        }

        const a = Math.min(item.id, neighbor.id);
        const b = Math.max(item.id, neighbor.id);
        const key = `${a},${b}`;
        const existing = pairs.get(key);
        if (existing) {
          existing.types.add(relationType);
        } else {
          pairs.set(key, { a, b, types: new Set([relationType]) });
        }

        if (!visited.has(neighbor.id)) {
          nextFrontier.push(neighbor.id);
        }
      }
    }

    frontier = nextFrontier;
    depth += 1;
  }

  // Keep only edges whose endpoints were actually fetched, so we never point
  // at a node that was dropped by the traversal cap.
  const edges: FranchiseEdge[] = [];
  for (const { a, b, types } of pairs.values()) {
    const nodeA = nodes.get(a);
    const nodeB = nodes.get(b);
    if (!nodeA || !nodeB) continue;
    const [from, to] = orderByDate(nodeA, nodeB);
    edges.push({ from, to, relationType: canonicalRelation(types) });
  }

  return {
    rootId,
    nodes: [...nodes.values()],
    edges,
    width: 0,
    height: 0,
  };
});

/**
 * Runs a left-to-right layered layout (dagre) over the graph, writing top-left
 * coordinates onto each node and the overall bounds onto the graph.
 */
export function layoutFranchiseGraph(graph: FranchiseGraph): FranchiseGraph {
  if (graph.nodes.length === 0) {
    return { ...graph, width: 0, height: 0 };
  }

  const g = new Graph<GraphLabel, NodeLabel, EdgeLabel>({ directed: true });
  g.setGraph({
    rankdir: "LR",
    nodesep: 48,
    ranksep: 120,
    marginx: 32,
    marginy: 32,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(String(node.anime.id), {
      width: node.width || NODE_WIDTH,
      height: node.height || NODE_HEIGHT,
    });
  }
  for (const edge of graph.edges) {
    g.setEdge(String(edge.from), String(edge.to));
  }

  layout(g);

  const nodes = graph.nodes.map((node) => {
    const laid = g.node(String(node.anime.id));
    const width = node.width || NODE_WIDTH;
    const height = node.height || NODE_HEIGHT;
    // dagre returns node centers; convert to top-left for absolute rendering.
    return {
      ...node,
      x: (laid?.x ?? 0) - width / 2,
      y: (laid?.y ?? 0) - height / 2,
    };
  });

  const { width = 0, height = 0 } = g.graph();
  return { ...graph, nodes, width, height };
}
