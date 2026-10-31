import React, { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { FamAccent } from './FamCover';
import { edgeGeometry, layoutTree, uniqueTreeNodes } from '../../../lib/aceTreeLayout';
import type { TreeNode } from '../../../lib/aceTreeLayout';

export { layoutTree } from '../../../lib/aceTreeLayout';
export type { TreeNode } from '../../../lib/aceTreeLayout';

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
    // Accent keys are stored per fam; only their colors follow the #761 palette.
    teal:  { fill: '#4356a1', dark: '#2c3a71', ring: 'rgba(67,86,161,0.18)', edge: '#bbb7d0', label: '#28354d', sub: '#4d5871', node2bg: '#ffffff' },
    coral: { fill: '#a94d8a', dark: '#73305c', ring: 'rgba(169,77,138,0.18)', edge: '#bbb7d0', label: '#28354d', sub: '#4d5871', node2bg: '#ffffff' },
    gold:  { fill: '#7a5fc0', dark: '#4f3a8a', ring: 'rgba(122,95,192,0.18)', edge: '#bbb7d0', label: '#28354d', sub: '#4d5871', node2bg: '#ffffff' },
  },
  dark: {
    teal:  { fill: '#a3b2ec', dark: '#36478a', ring: 'rgba(163,178,236,0.22)', edge: '#3b4a6e', label: '#f4f0fc', sub: '#c6cee6', node2bg: '#1b2843' },
    coral: { fill: '#ebb4da', dark: '#8a3a6c', ring: 'rgba(235,180,218,0.22)', edge: '#3b4a6e', label: '#f4f0fc', sub: '#c6cee6', node2bg: '#1b2843' },
    gold:  { fill: '#c9b6f0', dark: '#4f3a8a', ring: 'rgba(201,182,240,0.22)', edge: '#3b4a6e', label: '#f4f0fc', sub: '#c6cee6', node2bg: '#1b2843' },
  },
};

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
  const uniqueNodes = useMemo(() => uniqueTreeNodes(nodes), [nodes]);
  const layout = useMemo(() => layoutTree(uniqueNodes), [uniqueNodes]);
  const safeNodes = useMemo(
    () => uniqueNodes.map((node) => ({ ...node, parent: layout.parentById[node.id] ?? null })),
    [uniqueNodes, layout],
  );
  const reduceMotion = !!useReducedMotion();

  const unitX = compact ? 96 : 132;
  const unitY = compact ? 118 : 148;
  const padX = compact ? 24 : 48;
  const padY = compact ? 24 : 48;
  const nodeR = compact ? 22 : 28;

  const w = layout.totalWidth * unitX + padX * 2;
  const h = layout.rowCount * unitY + padY * 2;

  const A = ACCENTS[dark ? 'dark' : 'light'][accent] ?? ACCENTS.light.teal;

  const xy = (id: string) => {
    const p = layout.positions[id];
    return { x: p.x * unitX + padX, y: p.y * unitY + padY };
  };

  const edges: Array<{ id: string; d: string; length: number; upward: boolean }> = [];
  safeNodes.forEach((n) => {
    if (!n.parent || !layout.positions[n.parent]) return;
    const geometry = edgeGeometry(xy(n.parent), xy(n.id), nodeR, unitY);
    edges.push({ id: n.parent + '-' + n.id, ...geometry });
  });
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  const lineage = focusId ? lineagePath(safeNodes, focusId) : [];
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
          className={`ace-tree-edge${lineageEdgeIds.has(e.id) ? ' is-lineage' : ''}${e.upward ? ' is-upward' : ''}`}
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

      {safeNodes.map((n) => {
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
