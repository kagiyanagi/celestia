"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

import { getDisplayTitle } from "@/lib/format";
import type { FranchiseGraph, FranchiseNode, RelationItem } from "@/types/anime";

import { DetailsRelations } from "./DetailsRelations";

interface DetailsFranchiseProps {
  animeId: number;
  relatedItems: RelationItem[];
}

type Transform = { x: number; y: number; scale: number };

const MIN_SCALE = 0.3;
const MAX_SCALE = 2;
const ZOOM_STEP = 1.2;

const FORMAT_LABELS: Record<string, string> = {
  TV: "TV Series",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
};

function formatLabel(format?: string | null): string {
  if (!format) return "";
  return FORMAT_LABELS[format] ?? format.replaceAll("_", " ");
}

function metaLabel(node: FranchiseNode): string {
  const { episodes, status } = node.anime;
  if (episodes && episodes > 0) {
    return `${episodes} Episode${episodes === 1 ? "" : "s"}`;
  }
  if (status === "RELEASING") return "Releasing";
  if (status === "NOT_YET_RELEASED") return "Upcoming";
  if (status === "CANCELLED") return "Cancelled";
  return "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function edgePath(from: FranchiseNode, to: FranchiseNode) {
  const sx = from.x + from.width;
  const sy = from.y + from.height / 2;
  const tx = to.x;
  const ty = to.y + to.height / 2;
  const dx = Math.max(40, Math.abs(tx - sx) / 2);
  return {
    d: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`,
    mx: (sx + tx) / 2,
    my: (sy + ty) / 2,
  };
}

export function DetailsFranchise({ animeId, relatedItems }: DetailsFranchiseProps) {
  const [graph, setGraph] = useState<FranchiseGraph | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const movedRef = useRef(false);

  const showGraph = status === "ready" && !!graph && graph.nodes.length >= 2;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/anime/${animeId}/franchise`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("request failed"))))
      .then((data: { graph: FranchiseGraph | null }) => {
        if (cancelled) return;
        setGraph(data.graph);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  const nodeById = useMemo(() => {
    const map = new Map<number, FranchiseNode>();
    graph?.nodes.forEach((node) => map.set(node.anime.id, node));
    return map;
  }, [graph]);

  const fitToView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || !graph || graph.width === 0 || graph.height === 0) return;
    const pad = 32;
    const sw = (vp.clientWidth - pad * 2) / graph.width;
    const sh = (vp.clientHeight - pad * 2) / graph.height;
    const scale = clamp(Math.min(sw, sh), MIN_SCALE, 1);
    setTransform({
      scale,
      x: (vp.clientWidth - graph.width * scale) / 2,
      y: (vp.clientHeight - graph.height * scale) / 2,
    });
  }, [graph]);

  const resetView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || !graph || graph.nodes.length === 0) return;
    const root = graph.nodes.find((node) => node.isRoot) ?? graph.nodes[0];
    const cx = root.x + root.width / 2;
    const cy = root.y + root.height / 2;
    setTransform({ scale: 1, x: vp.clientWidth / 2 - cx, y: vp.clientHeight / 2 - cy });
  }, [graph]);

  const zoomTo = useCallback((nextScale: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const px = vp.clientWidth / 2;
    const py = vp.clientHeight / 2;
    setTransform((t) => {
      const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const k = scale / t.scale;
      return { scale, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    });
  }, []);

  // Fit once the laid-out graph mounts.
  useLayoutEffect(() => {
    if (showGraph) fitToView();
  }, [showGraph, fitToView]);

  // Non-passive wheel zoom (passive listeners can't preventDefault page scroll).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !showGraph) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = vp.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setTransform((t) => {
        const scale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
        const k = scale / t.scale;
        return { scale, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
      });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [showGraph]);

  const onPointerDown = (event: React.PointerEvent) => {
    movedRef.current = false;
    if ((event.target as HTMLElement).closest("[data-franchise-node]")) return;
    if (event.button !== 0) return;
    const vp = viewportRef.current;
    if (!vp) return;
    vp.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      origX: transform.x,
      origY: transform.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
    setTransform((t) => ({ ...t, x: drag.origX + dx, y: drag.origY + dy }));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    dragRef.current.active = false;
    const vp = viewportRef.current;
    if (vp?.hasPointerCapture(event.pointerId)) vp.releasePointerCapture(event.pointerId);
  };

  if (status === "loading") {
    return (
      <div className="franchise-graph franchise-graph--message">
        <span className="franchise-message">Building franchise graph…</span>
      </div>
    );
  }

  if (!showGraph) {
    if (relatedItems.length > 0) {
      return <DetailsRelations relatedItems={relatedItems} />;
    }
    return (
      <div className="franchise-graph franchise-graph--message">
        <span className="franchise-message">No related entries.</span>
      </div>
    );
  }

  return (
    <div className="franchise-graph">
      <div
        ref={viewportRef}
        className="franchise-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="franchise-canvas"
          style={{
            width: graph!.width,
            height: graph!.height,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          <svg
            className="franchise-edges"
            width={graph!.width}
            height={graph!.height}
            viewBox={`0 0 ${graph!.width} ${graph!.height}`}
          >
            {graph!.edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);
              if (!from || !to) return null;
              const { d, mx, my } = edgePath(from, to);
              return (
                <g key={`${edge.from}-${edge.to}`} className="franchise-edge">
                  <path d={d} />
                  <text x={mx} y={my} dy={-6} textAnchor="middle">
                    {edge.relationType.replaceAll("_", " ")}
                  </text>
                </g>
              );
            })}
          </svg>

          {graph!.nodes.map((node) => (
            <Link
              key={node.anime.id}
              href={`/anime/${node.anime.id}`}
              data-franchise-node
              draggable={false}
              className={`franchise-node${node.isRoot ? " is-root" : ""}`}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                minHeight: node.height,
              }}
              onClick={(event) => {
                if (movedRef.current) event.preventDefault();
              }}
            >
              <strong className="franchise-node-title">
                {getDisplayTitle(node.anime.title)}
              </strong>
              <span className="franchise-node-row">
                <span className="franchise-node-format">
                  {formatLabel(node.anime.format)}
                </span>
                <span className="franchise-node-meta">{metaLabel(node)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="franchise-controls">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomTo(transform.scale * ZOOM_STEP)}
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomTo(transform.scale / ZOOM_STEP)}
        >
          <Minus size={16} />
        </button>
        <button type="button" aria-label="Fit to screen" onClick={fitToView}>
          <Maximize2 size={16} />
        </button>
        <button type="button" aria-label="Reset view" onClick={resetView}>
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
