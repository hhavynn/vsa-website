import React, { useMemo } from 'react';
import { FamAccent } from './FamCover';

export interface TreeNode {
  id: string;
  initial: string;
  label: string;
  role: string;
  cohort?: string | null;
  parent?: string | null;
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

  const roots = nodes.filter((n) => !n.parent).map((n) => n.id);

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

  const edges: Array<{ id: string; d: string }> = [];
  nodes.forEach((n) => {
    if (!n.parent) return;
    if (!layout.positions[n.parent]) return;
    const a = xy(n.parent);
    const b = xy(n.id);
    const my = (a.y + b.y) / 2;
    edges.push({
      id: `${n.parent}-${n.id}`,
      d: `M ${a.x} ${a.y + nodeR} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y - nodeR}`,
    });
  });

  const gridDot = dark ? 'rgba(255,255,255,0.06)' : 'rgba(20,32,40,0.08)';
  const patternId = `tree-grid-${accent}-${dark ? 'd' : 'l'}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', maxWidth: 'none' }} role="img" aria-label="Family tree">
      <defs>
        <pattern id={patternId} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.7" fill={gridDot} />
        </pattern>
      </defs>
      <rect width={w} height={h} fill={`url(#${patternId})`} opacity="0.7" />

      {edges.map((e) => (
        <path
          key={e.id}
          d={e.d}
          fill="none"
          stroke={A.edge}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.6}
        />
      ))}

      {nodes.map((n) => {
        const p = xy(n.id);
        const isFocus = focusId === n.id;
        const isOG = n.role && n.role.startsWith('OG');
        const isLittle = n.role === 'Little';
        return (
          <g
            key={n.id}
            transform={`translate(${p.x}, ${p.y})`}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onClick={() => onSelect && onSelect(n.id)}
          >
            {isFocus && <circle r={nodeR + 8} fill={A.ring} />}
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
    </svg>
  );
}
