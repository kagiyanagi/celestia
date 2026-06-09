# Profile Stats Visuals Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve code quality, accessibility, and performance of `src/components/profile-stats-visuals.tsx`.

**Architecture:** Use `useMemo` for heavy geometry calculations, extract shared types and constants, and add comprehensive ARIA attributes for better accessibility.

**Tech Stack:** React (TypeScript), SVG, Tailwind CSS (via CSS variables).

---

### Task 1: Type Definitions and Utilities

**Files:**
- Modify: `src/components/profile-stats-visuals.tsx`

- [ ] **Step 1: Define shared types and constants**

```typescript
interface ChartItem {
  label: string;
  count: number;
}

interface DonutChartItem extends ChartItem {
  color?: string;
}

const DEFAULT_RADAR_SIZE = 300;
const DEFAULT_DONUT_SIZE = 180;
const DEFAULT_STROKE_WIDTH = 20;
```

---

### Task 2: Refactor RadarChart

**Files:**
- Modify: `src/components/profile-stats-visuals.tsx`

- [ ] **Step 1: Wrap calculations in useMemo**
- [ ] **Step 2: Add accessibility attributes**
- [ ] **Step 3: Extract Background and Axis rendering to sub-components if it helps readability (optional, but keep it clean)**

```typescript
export function RadarChart({
  items,
  size = DEFAULT_RADAR_SIZE,
}: {
  items: ChartItem[];
  size?: number;
}) {
  const { max, centerX, centerY, radius, angleStep, points, pathData, backgroundPolygons, axes } = React.useMemo(() => {
    const maxVal = Math.max(...items.map((i) => i.count), 1);
    const cx = size / 2;
    const cy = size / 2;
    const r = (size / 2) * 0.7;
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

    return { max: maxVal, centerX: cx, centerY: cy, radius: r, angleStep: step, points: pts, pathData: path, backgroundPolygons: bgPolys, axes: axisLines };
  }, [items, size]);

  const titleId = React.useId();
  const descId = React.useId();

  return (
    <div className="radar-chart-container">
      <svg 
        width={size} 
        height={size} 
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>Stats Radar Chart</title>
        <desc id={descId}>
          A radar chart showing statistics for: {items.map(i => `${i.label} (${i.count})`).join(", ")}
        </desc>
        
        <g aria-hidden="true" stroke="var(--border-subtle)" fill="none">
          {backgroundPolygons.map((pointsStr, idx) => (
            <polygon key={idx} points={pointsStr} />
          ))}
          {axes.map((axis, i) => (
            <line key={i} x1={centerX} y1={centerY} x2={axis.x2} y2={axis.y2} />
          ))}
        </g>

        <path d={pathData} fill="rgba(255, 255, 255, 0.1)" stroke="var(--text-primary)" strokeWidth="2" />

        {items.map((item, i) => {
          const angle = points[i].angle;
          const lx = centerX + (radius + 25) * Math.cos(angle);
          const ly = centerY + (radius + 25) * Math.sin(angle);
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
            >
              {item.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
```

---

### Task 3: Refactor DonutChart

**Files:**
- Modify: `src/components/profile-stats-visuals.tsx`

- [ ] **Step 1: Wrap calculations in useMemo**
- [ ] **Step 2: Add accessibility attributes**
- [ ] **Step 3: Improve color logic and structure**

```typescript
export function DonutChart({
  items,
  size = DEFAULT_DONUT_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
}: {
  items: DonutChartItem[];
  size?: number;
  strokeWidth?: number;
}) {
  const { total, segments, radius, circumference } = React.useMemo(() => {
    const t = items.reduce((sum, item) => sum + item.count, 0);
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;

    let currentOffset = 0;
    const segs = items.map((item, i) => {
      const percentage = t > 0 ? (item.count / t) * 100 : 0;
      const strokeDashoffset = -((currentOffset / 100) * c);
      currentOffset += percentage;

      return {
        ...item,
        percentage,
        strokeDasharray: `${(percentage / 100) * c} ${c}`,
        strokeDashoffset,
        color: item.color || `rgba(255, 255, 255, ${0.1 + (i / items.length) * 0.8})`
      };
    });

    return { total: t, segments: segs, radius: r, circumference: c };
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
          stroke="var(--surface-3)"
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
          y="50%"
          dy=".3em"
          textAnchor="middle"
          fill="var(--text-primary)"
          fontSize="24"
          fontWeight="900"
          aria-hidden="true"
        >
          {total}
        </text>
      </svg>
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
    </div>
  );
}
```

---

### Task 4: Final Validation

- [ ] **Step 1: Verify build and types**
- [ ] **Step 2: Check accessibility manually if possible (ARIA roles existence)**

Run: `pnpm build` or check with `tsc`
