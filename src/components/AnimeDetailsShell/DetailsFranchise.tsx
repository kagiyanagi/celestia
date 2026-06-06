"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { List, Maximize2, Minus, Network, Plus, RotateCcw } from "lucide-react";

import { getDisplayTitle } from "@/lib/format";
import { useTitleLanguage } from "@/components/use-title-language";
import type {
  AnimeSummary,
  FranchiseGraph,
  FranchiseNode,
  RelationItem,
} from "@/types/anime";

import { DetailsRelations } from "./DetailsRelations";

interface DetailsFranchiseProps {
  animeId: number;
  relatedItems: RelationItem[];
}

type Transform = { x: number; y: number; scale: number };
type ViewMode = "graph" | "list";

const MIN_SCALE = 0.1;
const MAX_SCALE = 2;
const ZOOM_STEP = 1.2;
const MOMENTUM_FRICTION = 0.93;
const MOMENTUM_START_SPEED = 1.5;
const MOMENTUM_STOP_SPEED = 0.1;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DIST = 30;

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

function releaseYear(anime: AnimeSummary): number | null {
  return anime.startDate?.year ?? anime.seasonYear ?? null;
}

/** Sortable release value; unknown dates sort last (treated as newest). */
function startValue(anime: AnimeSummary): number {
  const date = anime.startDate;
  if (date?.year) {
    return date.year * 10000 + (date.month ?? 0) * 100 + (date.day ?? 0);
  }
  if (anime.seasonYear) {
    return anime.seasonYear * 10000;
  }
  return Number.POSITIVE_INFINITY;
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
  const titleLanguage = useTitleLanguage();
  const [graph, setGraph] = useState<FranchiseGraph | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  const [view, setView] = useState<ViewMode>("graph");
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const movedRef = useRef(false);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const minScaleRef = useRef(MIN_SCALE);
  const pointerTypeRef = useRef<string>("mouse");
  const downOnNodeRef = useRef(false);
  const lastTapRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const lastMoveRef = useRef<{ x: number; y: number } | null>(null);
  const velocityRef = useRef({ vx: 0, vy: 0 });
  const momentumRef = useRef<number | null>(null);

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

  // Whichever node is currently emphasized: a tapped/focused node wins over hover.
  const highlightId = focusedId ?? hoverId;

  const connectedIds = useMemo(() => {
    if (highlightId == null || !graph) return null;
    const set = new Set<number>([highlightId]);
    graph.edges.forEach((edge) => {
      if (edge.from === highlightId) set.add(edge.to);
      if (edge.to === highlightId) set.add(edge.from);
    });
    return set;
  }, [highlightId, graph]);

  const sortedNodes = useMemo(() => {
    if (!graph) return [];
    return [...graph.nodes].sort((a, b) => {
      const av = startValue(a.anime);
      const bv = startValue(b.anime);
      if (av === bv) return a.anime.id - b.anime.id;
      return av - bv;
    });
  }, [graph]);

  const computeMinScale = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || !graph || !graph.width || !graph.height) return MIN_SCALE;
    const pad = 32;
    const sw = (vp.clientWidth - pad * 2) / graph.width;
    const sh = (vp.clientHeight - pad * 2) / graph.height;
    // Allow zooming out far enough to frame the whole graph (plus a little slack),
    // so massive franchises like One Piece always fit on screen.
    return Math.min(MIN_SCALE, Math.min(sw, sh) * 0.8);
  }, [graph]);

  const fitToView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || !graph || graph.width === 0 || graph.height === 0) return;
    const pad = 32;
    const sw = (vp.clientWidth - pad * 2) / graph.width;
    const sh = (vp.clientHeight - pad * 2) / graph.height;
    const scale = clamp(Math.min(sw, sh), computeMinScale(), 1);
    setTransform({
      scale,
      x: (vp.clientWidth - graph.width * scale) / 2,
      y: (vp.clientHeight - graph.height * scale) / 2,
    });
  }, [graph, computeMinScale]);

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
      const scale = clamp(nextScale, minScaleRef.current, MAX_SCALE);
      const k = scale / t.scale;
      return { scale, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    });
  }, []);

  const zoomAtPoint = useCallback((clientX: number, clientY: number, target: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    setTransform((t) => {
      const scale = clamp(target, minScaleRef.current, MAX_SCALE);
      const k = scale / t.scale;
      return { scale, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
    });
  }, []);

  const stopMomentum = useCallback(() => {
    if (momentumRef.current != null) {
      cancelAnimationFrame(momentumRef.current);
      momentumRef.current = null;
    }
  }, []);

  const startMomentum = useCallback(() => {
    let { vx, vy } = velocityRef.current;
    const step = () => {
      vx *= MOMENTUM_FRICTION;
      vy *= MOMENTUM_FRICTION;
      if (Math.hypot(vx, vy) < MOMENTUM_STOP_SPEED) {
        momentumRef.current = null;
        return;
      }
      setTransform((t) => ({ ...t, x: t.x + vx, y: t.y + vy }));
      momentumRef.current = requestAnimationFrame(step);
    };
    momentumRef.current = requestAnimationFrame(step);
  }, []);

  // Keep the per-graph zoom-out floor in sync with viewport size.
  useEffect(() => {
    if (!showGraph || view !== "graph") return;
    const update = () => {
      minScaleRef.current = computeMinScale();
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [showGraph, view, computeMinScale]);

  // Fit once the laid-out graph mounts / when re-entering graph view.
  useLayoutEffect(() => {
    if (showGraph && view === "graph") fitToView();
  }, [showGraph, view, fitToView]);

  // Stop any inertia animation on unmount.
  useEffect(() => stopMomentum, [stopMomentum]);

  // Non-passive wheel zoom (passive listeners can't preventDefault page scroll).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || !showGraph || view !== "graph") return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = vp.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setTransform((t) => {
        const scale = clamp(t.scale * factor, minScaleRef.current, MAX_SCALE);
        const k = scale / t.scale;
        return { scale, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
      });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [showGraph, view]);

  const pinchStateFromPointers = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    const vp = viewportRef.current;
    if (!vp) return;
    stopMomentum();
    pointerTypeRef.current = event.pointerType;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size >= 2) {
      // Second finger down: start pinch, cancel any pan in progress.
      dragRef.current.active = false;
      movedRef.current = true;
      pinchRef.current = pinchStateFromPointers();
      return;
    }

    movedRef.current = false;
    velocityRef.current = { vx: 0, vy: 0 };
    lastMoveRef.current = { x: event.clientX, y: event.clientY };
    downOnNodeRef.current = !!(event.target as HTMLElement).closest(
      "[data-franchise-node]",
    );
    if (downOnNodeRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
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
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (pointersRef.current.size >= 2) {
      const vp = viewportRef.current;
      const prev = pinchRef.current;
      const next = pinchStateFromPointers();
      if (!vp || !prev || !next || prev.dist === 0) return;
      const rect = vp.getBoundingClientRect();
      const px = next.cx - rect.left;
      const py = next.cy - rect.top;
      const factor = next.dist / prev.dist;
      setTransform((t) => {
        const scale = clamp(t.scale * factor, minScaleRef.current, MAX_SCALE);
        const k = scale / t.scale;
        return { scale, x: px - (px - t.x) * k, y: py - (py - t.y) * k };
      });
      pinchRef.current = next;
      return;
    }

    const drag = dragRef.current;
    if (!drag.active) return;
    const last = lastMoveRef.current;
    if (last) {
      velocityRef.current = { vx: event.clientX - last.x, vy: event.clientY - last.y };
    }
    lastMoveRef.current = { x: event.clientX, y: event.clientY };
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
    setTransform((t) => ({ ...t, x: drag.origX + dx, y: drag.origY + dy }));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    const wasDrag = dragRef.current.active;
    dragRef.current.active = false;
    const vp = viewportRef.current;
    if (vp?.hasPointerCapture(event.pointerId)) vp.releasePointerCapture(event.pointerId);

    const touch = pointerTypeRef.current !== "mouse";

    // Flick-and-glide: only after a real touch pan that ended with all fingers up.
    if (
      wasDrag &&
      movedRef.current &&
      touch &&
      pointersRef.current.size === 0 &&
      Math.hypot(velocityRef.current.vx, velocityRef.current.vy) > MOMENTUM_START_SPEED
    ) {
      startMomentum();
      return;
    }

    // Tap on empty space: clear focus, or zoom on double-tap.
    if (
      touch &&
      !movedRef.current &&
      !downOnNodeRef.current &&
      pointersRef.current.size === 0
    ) {
      const now = event.timeStamp;
      const last = lastTapRef.current;
      if (
        last &&
        now - last.t < DOUBLE_TAP_MS &&
        Math.hypot(event.clientX - last.x, event.clientY - last.y) < DOUBLE_TAP_DIST
      ) {
        if (transform.scale < 0.9) zoomAtPoint(event.clientX, event.clientY, 1);
        else fitToView();
        lastTapRef.current = null;
      } else {
        lastTapRef.current = { t: now, x: event.clientX, y: event.clientY };
        setFocusedId(null);
      }
    }
  };

  const onNodeClick = (event: React.MouseEvent, id: number) => {
    if (movedRef.current) {
      event.preventDefault();
      return;
    }
    // Touch: first tap focuses the node's connections, a second tap navigates.
    if (pointerTypeRef.current !== "mouse" && focusedId !== id) {
      event.preventDefault();
      setFocusedId(id);
    }
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
      <div className="franchise-toolbar">
        <div className="franchise-view-toggle" role="tablist" aria-label="Franchise view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "graph"}
            className={view === "graph" ? "is-active" : undefined}
            onClick={() => setView("graph")}
          >
            <Network size={14} />
            Graph
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "list"}
            className={view === "list" ? "is-active" : undefined}
            onClick={() => setView("list")}
          >
            <List size={14} />
            Watch order
          </button>
        </div>
      </div>

      {view === "graph" ? (
        <>
          <div
            ref={viewportRef}
            className="franchise-viewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
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
                  const active =
                    highlightId != null &&
                    (edge.from === highlightId || edge.to === highlightId);
                  const edgeClass = `franchise-edge${
                    highlightId == null ? "" : active ? " is-active" : " is-faded"
                  }`;
                  return (
                    <g key={`${edge.from}-${edge.to}`} className={edgeClass}>
                      <path d={d} />
                      <text x={mx} y={my} dy={-6} textAnchor="middle">
                        {edge.relationType.replaceAll("_", " ")}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {graph!.nodes.map((node) => {
                const id = node.anime.id;
                let nodeClass = "franchise-node";
                if (node.isRoot) nodeClass += " is-root";
                if (connectedIds) {
                  if (id === highlightId) nodeClass += " is-active";
                  else if (connectedIds.has(id)) nodeClass += " is-connected";
                  else nodeClass += " is-faded";
                }
                return (
                  <Link
                    key={id}
                    href={`/anime/${id}`}
                    data-franchise-node
                    draggable={false}
                    className={nodeClass}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      minHeight: node.height,
                    }}
                    onClick={(event) => onNodeClick(event, id)}
                    onMouseEnter={() => setHoverId(id)}
                    onMouseLeave={() => setHoverId((cur) => (cur === id ? null : cur))}
                  >
                    <strong className="franchise-node-title">
                      {getDisplayTitle(node.anime.title, titleLanguage)}
                    </strong>
                    <span className="franchise-node-row">
                      <span className="franchise-node-format">
                        {formatLabel(node.anime.format)}
                      </span>
                      <span className="franchise-node-meta">{metaLabel(node)}</span>
                    </span>
                  </Link>
                );
              })}
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
        </>
      ) : (
        <ol className="franchise-list">
          {sortedNodes.map((node, index) => {
            const id = node.anime.id;
            const year = releaseYear(node.anime);
            return (
              <li key={id}>
                <Link
                  href={`/anime/${id}`}
                  className={`franchise-list-item${node.isRoot ? " is-current" : ""}`}
                >
                  <span className="franchise-list-order">{index + 1}</span>
                  <span className="franchise-list-poster">
                    {node.anime.coverImage && (
                      <Image
                        src={node.anime.coverImage}
                        alt={getDisplayTitle(node.anime.title, titleLanguage)}
                        fill
                        sizes="48px"
                      />
                    )}
                  </span>
                  <span className="franchise-list-info">
                    <span className="franchise-list-type">
                      {formatLabel(node.anime.format)}
                      {node.isRoot ? " • Current" : ""}
                    </span>
                    <strong className="franchise-list-title">
                      {getDisplayTitle(node.anime.title, titleLanguage)}
                    </strong>
                    <span className="franchise-list-meta">
                      {[metaLabel(node), year].filter(Boolean).join(" • ")}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
