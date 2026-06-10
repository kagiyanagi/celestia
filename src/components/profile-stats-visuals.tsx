"use client";

import React from "react";

interface ChartItem {
  label: string;
  count: number;
}

interface DonutChartItem extends ChartItem {
  color?: string;
}

const DEFAULT_RADAR_SIZE = 300;
const DEFAULT_DONUT_SIZE = 180;
const DEFAULT_STROKE_WIDTH = 18;

export function RadarChart({
  items,
  size = DEFAULT_RADAR_SIZE,
}: {
  items: ChartItem[];
  size?: number;
}) {
  const paddingX = 45; // 45px padding on left/right inside SVG
  const width = size + paddingX * 2;
  const height = size;
  const gradientId = React.useId().replace(/:/g, "");

  const { centerX, centerY, radius, points, pathData, backgroundPolygons, axes } = React.useMemo(() => {
    const maxVal = Math.max(...items.map((i) => i.count), 1);
    const cx = width / 2;
    const cy = height / 2;
    const r = (size / 2) * 0.68;
    const step = (Math.PI * 2) / items.length;

    const pts = items.map((item, i) => {
      const currentR = (item.count / maxVal) * r;
      const angle = i * step - Math.PI / 2;
      return {
        x: cx + currentR * Math.cos(angle),
        y: cy + currentR * Math.sin(angle),
        angle,
      };
    });

    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

    const bgPolys = [0.2, 0.4, 0.6, 0.8, 1].map((s) => 
      items.map((_, i) => {
        const angle = i * step - Math.PI / 2;
        const currentR = r * s;
        return `${cx + currentR * Math.cos(angle)},${cy + currentR * Math.sin(angle)}`;
      }).join(" ")
    );

    const axisLines = items.map((_, i) => {
      const angle = i * step - Math.PI / 2;
      return {
        x2: cx + r * Math.cos(angle),
        y2: cy + r * Math.sin(angle),
      };
    });

    return { centerX: cx, centerY: cy, radius: r, points: pts, pathData: path, backgroundPolygons: bgPolys, axes: axisLines };
  }, [items, size, width, height]);

  const titleId = React.useId();
  const descId = React.useId();

  return (
    <div className="radar-chart-container">
      <svg 
        width={width} 
        height={height} 
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
        style={{ maxWidth: "100%" }}
      >
        <title id={titleId}>Stats Radar Chart</title>
        <desc id={descId}>
          A radar chart showing statistics for: {items.map(i => `${i.label} (${i.count})`).join(", ")}
        </desc>
        
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(270, 40%, 60%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(217, 45%, 55%)" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* Background polygons and Axes */}
        <g aria-hidden="true" stroke="var(--border-subtle)" fill="none" strokeWidth="1">
          {backgroundPolygons.map((pointsStr, idx) => (
            <polygon 
              key={idx} 
              points={pointsStr} 
              stroke="rgba(255, 255, 255, 0.05)" 
              strokeDasharray={idx < 4 ? "2, 2" : "none"}
            />
          ))}
          {axes.map((axis, i) => (
            <line 
              key={i} 
              x1={centerX} 
              y1={centerY} 
              x2={axis.x2} 
              y2={axis.y2} 
              stroke="rgba(255, 255, 255, 0.08)"
            />
          ))}
        </g>

        {/* Data polygon */}
        <path 
          d={pathData} 
          fill={`url(#${gradientId})`} 
          stroke="hsl(270, 40%, 60%)" 
          strokeWidth="2" 
          className="radar-polygon" 
        />

        {/* Vertices / Data point dots */}
        {points.map((p, idx) => {
          if (items[idx].count === 0) return null;
          return (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill="hsl(270, 40%, 60%)"
              stroke="var(--surface-0, #000)"
              strokeWidth="1.5"
              className="radar-dot"
              aria-hidden="true"
            />
          );
        })}

        {/* Labels */}
        {items.map((item, i) => {
          const angle = points[i].angle;
          const lx = centerX + (radius + 20) * Math.cos(angle);
          const ly = centerY + (radius + 18) * Math.sin(angle);
          let textAnchor: "start" | "middle" | "end" = "middle";
          const cos = Math.cos(angle);
          if (cos > 0.1) textAnchor = "start";
          else if (cos < -0.1) textAnchor = "end";

          return (
            <text
              key={item.label}
              x={lx}
              y={ly}
              textAnchor={textAnchor}
              fill="var(--text-secondary)"
              fontSize="10"
              fontWeight="700"
              className="radar-label"
              aria-hidden="true"
              dominantBaseline="middle"
            >
              {item.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function DonutChart({
  items,
  size = DEFAULT_DONUT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  hideLegend = false,
}: {
  items: DonutChartItem[];
  size?: number;
  strokeWidth?: number;
  hideLegend?: boolean;
}) {
  const { total, segments, radius } = React.useMemo(() => {
    const t = items.reduce((sum, item) => sum + item.count, 0);
    const r = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * r;

    const segs = items.map((item, i) => {
      const percentage = t > 0 ? (item.count / t) * 100 : 0;
      
      const previousItems = items.slice(0, i);
      const offsetPercentage = t > 0 
        ? previousItems.reduce((sum, it) => sum + (it.count / t) * 100, 0)
        : 0;
      const strokeDashoffset = -((offsetPercentage / 100) * circumference);

      return {
        ...item,
        percentage,
        strokeDasharray: `${(percentage / 100) * circumference} ${circumference}`,
        strokeDashoffset,
        color: item.color || `rgba(255, 255, 255, ${0.1 + (i / items.length) * 0.8})`
      };
    });

    return { total: t, segments: segs, radius: r };
  }, [items, size, strokeWidth]);

  const titleId = React.useId();
  const descId = React.useId();

  return (
    <div className="donut-chart-container">
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>Distribution Donut Chart</title>
        <desc id={descId}>
          A donut chart showing total of {total} items: {items.map(i => `${i.label} (${i.count})`).join(", ")}
        </desc>
        
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth={strokeWidth}
          aria-hidden="true"
        />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={segment.strokeDasharray}
            strokeDashoffset={segment.strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="donut-segment"
            aria-hidden="true"
          />
        ))}
        
        <text
          x="50%"
          y="46%"
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize="26"
          fontWeight="800"
          className="donut-center-total"
          aria-hidden="true"
        >
          {total}
        </text>
        <text
          x="50%"
          y="58%"
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="9"
          fontWeight="800"
          letterSpacing="0.12em"
          className="donut-center-label"
          aria-hidden="true"
        >
          ANIME
        </text>
      </svg>
      
      {!hideLegend && (
        <div className="donut-legend" role="list">
          {segments.map((item) => (
             <div key={item.label} className="donut-legend-item" role="listitem">
               <span 
                 className="donut-dot" 
                 style={{ background: item.color }} 
                 aria-hidden="true" 
               />
               <span className="donut-label">{item.label}</span>
               <span className="donut-count">{item.count}</span>
             </div>
          ))}
        </div>
      )}
    </div>
  );
}
