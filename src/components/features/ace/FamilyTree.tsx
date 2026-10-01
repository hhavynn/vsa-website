import React, { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { FamAccent } from './FamCover';

export interface TreeNode {
  id: string;
  initial: string;
  label: string;
  role: string;
  cohort?: string | null;
  parent?: string | null;
  photoUrl?: string | null;
}

interface AccentPalette {
  fill: string;
  dark: string;
  ring: string;
  edge: string;
  label: string;
  sub: string;
  node2bg: string;
}

const ACCENTS: Record<'light' | 'dark', Record<FamAccent, AccentPalette>> = {
  light: {
    teal:  { fill: '#1e8878', dark: '#0f5a4f', ring: 'rgba(30,136,120,0.18)', edge: '#c4b8a8', label: '#142028', sub: '#4a6b68', node2bg: '#ffffff' },
    coral: { fill: '#e8623a', dark: '#a83a18', ring: 'rgba(232,98,58,0.18)', edge: '#c4b8a8', label: '#142028', sub: '#4a6b68', node2bg: '#ffffff' },
    gold:  { fill: '#d4841a', dark: '#7a4806', ring: 'rgba(212,132,26,0.18)', edge: '#c4b8a8', label: '#142028', sub: '#4a6b68', node2bg: '#ffffff' },
  },
  dark: {
    teal:  { fill: '#3bbdb5', dark: '#0d6a62', ring: 'rgba(59,189,181,0.22)', edge: '#1a3038', label: '#e4d8c8', sub: '#6a9a94', node2bg: '#0d1a20' },
    coral: { fill: '#f07858', dark: '#a83a18', ring: 'rgba(240,120,88,0.22)', edge: '#1a3038', label: '#e4d8c8', sub: '#6a9a94', node2bg: '#0d1a20' },
    gold:  { fill: '#e8a838', dark: '#7a4806', ring: 'rgba(232,168,56,0.22)', edge: '#1a3038', label: '#e4d8c8', sub: '#6a9a94', node2bg: '#0d1a20' },
  },
};

interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  totalWidth: number;
  depthMax: number;
}

export function layoutTree(nodes: TreeNode[]): LayoutResult {
  const byId: Record<string, TreeNode> = {};
  const children: Record<string, string[]> = {};
  nodes.forEach((n) => {
    byId[n.id] = n;
    children[n.id] = [];
  });
  nodes.forEach((n) => {
    if (n.parent && children[n.parent]) children[n.parent].push(n.id);
  });

  // A Big who isn't in the tree (e.g. unpublished) leaves their Little as a
  // root; otherwise that Little would never be placed.
  const roots = nodes.filter((n) => !n.parent || !byId[n.parent]).map((n) => n.id);

  const widths: Record<string, number> = {};
  function computeWidth(id: string): number {
    const kids = children[id];
    if (!kids.length) return (widths[id] = 1);
    return (widths[id] = kids.reduce((s, k) => s + computeWidth(k), 0));
  }
  roots.forEach(computeWidth);

  const positions: Record<string, { x: number; y: number }> = {};
  let cursor = 0;
  function place(id: string, depth: number) {
    const kids = children[id];
    if (!kids.length) {
      positions[id] = { x: cursor + 0.5, y: depth };
      cursor += 1;
      return;
    }
    const startX = cursor;
    kids.forEach((k) => place(k, depth + 1));
    const endX = cursor;
    positions[id] = { x: (startX + endX) / 2, y: depth };
  }
  roots.forEach((r) => place(r, 0));

  let depthMax = 0;
  Object.values(positions).forEach((p) => {
    if (p.y > depthMax) depthMax = p.y;
  });

  return { positions, totalWidth: Math.max(cursor, 1), depthMax };
}

/**
 * Ancestry of `targetId`, family root first and `targetId` last. Each member
 * has a single Big (`parent`), so this is one chain; it stops at a Big who
 * isn't in the tree or at a cycle. Empty when `targetId` isn't a node.
 */
export function lineagePath(
  nodes: Pick<TreeNode, 'id' | 'parent'>[],
  targetId: string | null | undefined,
): string[] {
  if (!targetId) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(targetId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current.id);
    current = current.parent ? byId.get(current.parent) : undefined;
  }
  return path.reverse();
}

const LINEAGE_ROOT_LEAD_MS = 260;
const LINEAGE_STEP_MAX_MS = 480;
const LINEAGE_TRAVEL_BUDGET_MS = 2400;
const LINEAGE_TRAVEL_SHARE = 0.78;

export interface LineageTimeline {
  /** When node `i` of the path lights up. */
  nodeDelay: (i: number) => number;
  /** When the light leaves node `i` toward node `i + 1`. */
  edgeDelay: (i: number) => number;
  edgeDuration: number;
}

/**
 * Light leaves the root after a short lead, then crosses one generation per
 * step. Deep lineages share a fixed budget so the trace never drags.
 */
export function lineageTimeline(pathLength: number, reduceMotion = false): LineageTimeline {
  const generations = Math.max(pathLength - 1, 0);
  if (reduceMotion || generations === 0) {
    return { nodeDelay: () => 0, edgeDelay: () => 0, edgeDuration: 0 };
  }
  const step = Math.min(LINEAGE_STEP_MAX_MS, LINEAGE_TRAVEL_BUDGET_MS / generations);
  const travel = Math.round(step * LINEAGE_TRAVEL_SHARE);
  const edgeDelay = (i: number) => Math.round(LINEAGE_ROOT_LEAD_MS + i * step);
  return {
    nodeDelay: (i) => (i === 0 ? 0 : edgeDelay(i - 1) + travel),
    edgeDelay,
    edgeDuration: travel,
  };
}

type Point = { x: number; y: number };

function cubicLength(p0: Point, p1: Point, p2: Point, p3: Point): number {
  const at = (t: number, a: number, b: number, c: number, d: number) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const next = { x: at(t, p0.x, p1.x, p2.x, p3.x), y: at(t, p0.y, p1.y, p2.y, p3.y) };
    length += Math.hypot(next.x - prev.x, next.y - prev.y);
    prev = next;
  }
  return length;
}

const SPARK_LENGTH = 22;

function lineageStyle(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

interface FamilyTreeProps {
  nodes: TreeNode[];
  accent?: FamAccent;
  focusId?: string | null;
  onSelect?: (id: string) => void;
  compact?: boolean;
  dark?: boolean;
}

export function FamilyTree({
  nodes,
  accent = 'teal',
  focusId,
  onSelect,
  compact = false,
  dark = false,
}: FamilyTreeProps) {
  const layout = useMemo(() => layoutTree(nodes), [nodes]);
  const reduceMotion = !!useReducedMotion();

  const unitX = compact ? 96 : 132;
  const unitY = compact ? 118 : 148;
  const padX = compact ? 24 : 48;
  const padY = compact ? 24 : 48;
  const nodeR = compact ? 22 : 28;

  const w = layout.totalWidth * unitX + padX * 2;
  const h = (layout.depthMax + 1) * unitY + padY * 2;

  const A = ACCENTS[dark ? 'dark' : 'light'][accent] ?? ACCENTS.light.teal;

  const xy = (id: string) => {
    const p = layout.positions[id];
    return { x: p.x * unitX + padX, y: p.y * unitY + padY };
  };

  const edges: Array<{ id: string; d: string; length: number }> = [];
  nodes.forEach((n) => {
    if (!n.parent) return;
    if (!layout.positions[n.parent]) return;
    const a = xy(n.parent);
    const b = xy(n.id);
    const my = (a.y + b.y) / 2;
    edges.push({
      id: `${n.parent}-${n.id}`,
      d: `M ${a.x} ${a.y + nodeR} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y - nodeR}`,
      length: cubicLength(
        { x: a.x, y: a.y + nodeR },
        { x: a.x, y: my },
        { x: b.x, y: my },
        { x: b.x, y: b.y - nodeR },
      ),
    });
  });
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  const lineage = focusId ? lineagePath(nodes, focusId) : [];
  const lineageIds = new Set(lineage);
  const lineageEdges = lineage.slice(1).map((id, i) => edgeById.get(`${lineage[i]}-${id}`));
  const lineageEdgeIds = new Set(lineageEdges.map((e) => e?.id));
  const timeline = lineageTimeline(lineage.length, reduceMotion);
  const lastIndex = lineage.length - 1;
  const sparkCore = dark ? '#fff4dc' : '#fffaf0';

  const gridDot = dark ? 'rgba(255,255,255,0.06)' : 'rgba(20,32,40,0.08)';
  const patternId = `tree-grid-${accent}-${dark ? 'd' : 'l'}`;
  const photoClipId = `tree-photo-clip-${compact ? 'c' : 'f'}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`ace-family-tree${lineage.length > 0 ? ' has-lineage' : ''}`}
      style={{ display: 'block', maxWidth: 'none' }}
      role={onSelect ? 'group' : 'img'}
      aria-label="Family tree"
    >
      <defs>
        <pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.7" fill={gridDot} />
        </pattern>
        <clipPath id={photoClipId}>
          <circle r={nodeR} />
        </clipPath>
      </defs>
      <rect width={w} height={h} fill={`url(#${patternId})`} opacity="0.7" />

      {edges.map((e) => (
        <path
          key={e.id}
          className={`ace-tree-edge${lineageEdgeIds.has(e.id) ? ' is-lineage' : ''}`}
          d={e.d}
          fill="none"
          stroke={A.edge}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.6}
        />
      ))}

      {lineage.length > 0 && (
        // Keyed by the selection so picking someone else replays the trace.
        <g
          key={`lineage-${focusId}`}
          className={`ace-lineage${reduceMotion ? ' is-static' : ''}`}
          data-testid="ace-lineage"
          data-motion={reduceMotion ? 'reduced' : 'full'}
          aria-hidden="true"
          pointerEvents="none"
        >
          {lineageEdges.map((e, i) => e && (
            <g
              key={e.id}
              data-lineage-edge={e.id}
              style={lineageStyle({
                '--lineage-len': `${e.length.toFixed(1)}px`,
                '--lineage-spark': `${SPARK_LENGTH}px`,
                '--lineage-delay': `${timeline.edgeDelay(i)}ms`,
                '--lineage-dur': `${timeline.edgeDuration}ms`,
              })}
            >
              <path
                className="ace-lineage-glow"
                d={e.d}
                fill="none"
                stroke={A.fill}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={e.length}
              />
              <path
                className="ace-lineage-line"
                d={e.d}
                fill="none"
                stroke={A.fill}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray={e.length}
              />
              {!reduceMotion && (
                <>
                  <path
                    className="ace-lineage-spark ace-lineage-spark-glow"
                    d={e.d}
                    fill="none"
                    stroke={A.fill}
                    strokeWidth={10}
                    strokeLinecap="round"
                    strokeDasharray={`${SPARK_LENGTH} ${e.length + SPARK_LENGTH}`}
                  />
                  <path
                    className="ace-lineage-spark"
                    d={e.d}
                    fill="none"
                    stroke={sparkCore}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray={`${SPARK_LENGTH} ${e.length + SPARK_LENGTH}`}
                  />
                </>
              )}
            </g>
          ))}
          {lineage.map((id, i) => {
            const p = xy(id);
            const isTarget = i === lastIndex;
            return (
              <g key={id} transform={`translate(${p.x}, ${p.y})`}>
                {isTarget && !reduceMotion && (
                  // Waiting socket: shows the tap landed while the light travels.
                  <circle
                    className="ace-lineage-socket"
                    r={nodeR + 8}
                    fill="none"
                    stroke={A.fill}
                    strokeWidth={1.5}
                    strokeDasharray="3 5"
                    style={lineageStyle({ '--lineage-delay': `${timeline.nodeDelay(i)}ms` })}
                  />
                )}
                <circle
                  className={`ace-lineage-halo${isTarget ? ' is-target' : ''}`}
                  data-lineage-node={id}
                  r={nodeR + (isTarget ? 8 : 6)}
                  fill={A.ring}
                  stroke={A.fill}
                  strokeWidth={isTarget ? 2 : 1.5}
                  strokeOpacity={isTarget ? 0.9 : 0.55}
                  style={lineageStyle({ '--lineage-delay': `${timeline.nodeDelay(i)}ms` })}
                />
              </g>
            );
          })}
        </g>
      )}

      {nodes.map((n) => {
        const p = xy(n.id);
        const isFocus = focusId === n.id;
        const isOG = n.role && n.role.startsWith('OG');
        const isLittle = n.role === 'Little';
        return (
          <g
            key={n.id}
            className={`ace-tree-node${lineageIds.has(n.id) ? ' is-lineage' : ''}`}
            data-node-id={n.id}
            transform={`translate(${p.x}, ${p.y})`}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect && onSelect(n.id)}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? `${n.label}, ${n.role || 'Member'}` : undefined}
            aria-pressed={onSelect ? isFocus : undefined}
            onKeyDown={onSelect ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              onSelect(n.id);
            } : undefined}
          >
            {isFocus && !lineageIds.has(n.id) && <circle r={nodeR + 8} fill={A.ring} />}
            <circle
              r={nodeR}
              fill={isLittle ? A.node2bg : A.fill}
              stroke={isLittle ? A.fill : A.dark}
              strokeWidth={isLittle ? 2 : 0}
            />
            {isOG && <circle cx={0} cy={-nodeR - 4} r={3} fill={A.fill} />}
            <text
              x={0} y={1}
              textAnchor="middle" dominantBaseline="middle"
              fill={isLittle ? A.fill : '#ffffff'}
              fontFamily='"DM Serif Display", Georgia, serif'
              fontSize={compact ? 18 : 22}
              fontStyle="italic"
            >
              {n.initial}
            </text>
            {n.photoUrl && (
              <>
                {/* Drawn over the initial, so a failed image still shows it. */}
                <image
                  href={n.photoUrl}
                  x={-nodeR}
                  y={-nodeR}
                  width={nodeR * 2}
                  height={nodeR * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${photoClipId})`}
                />
                <circle r={nodeR - 1} fill="none" stroke={isLittle ? A.fill : A.dark} strokeWidth={2} />
              </>
            )}
            <text
              x={0} y={nodeR + 18}
              textAnchor="middle"
              fill={A.label}
              fontFamily='"DM Sans", system-ui, sans-serif'
              fontSize={compact ? 11 : 12}
              fontWeight="600"
            >
              {n.label}
            </text>
            <text
              x={0} y={nodeR + 32}
              textAnchor="middle"
              fill={A.sub}
              fontFamily='"JetBrains Mono", ui-monospace, monospace'
              fontSize={compact ? 9 : 10}
              letterSpacing="0.04em"
            >
              {(n.role || 'Member').toUpperCase()}{n.cohort ? ` · ${n.cohort}` : ''}
            </text>
          </g>
        );
      })}

      {lineage.length > 0 && !reduceMotion && (
        // Arrival ripples sit above the nodes; the selected member pulses twice.
        <g key={`lineage-fx-${focusId}`} className="ace-lineage-fx" aria-hidden="true" pointerEvents="none">
          {lineage.map((id, i) => {
            const p = xy(id);
            return (
              <g key={id} transform={`translate(${p.x}, ${p.y})`}>
                <circle
                  className={`ace-lineage-ripple${i === lastIndex ? ' is-target' : ''}`}
                  r={nodeR + 2}
                  fill="none"
                  stroke={A.fill}
                  strokeWidth={2}
                  style={lineageStyle({ '--lineage-delay': `${timeline.nodeDelay(i)}ms` })}
                />
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}
