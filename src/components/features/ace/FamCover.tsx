import React from 'react';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';

export type FamAccent = 'teal' | 'coral' | 'gold';
export type FamPattern = 'sunburst' | 'wave' | 'dots' | 'arches' | 'lantern' | 'leaves';

interface PaletteEntry {
  ink: string;
  wash: string;
  deep: string;
  cream: string;
}

const PALETTE: Record<FamAccent, PaletteEntry> = {
  teal:  { ink: '#1e8878', wash: '#d2efec', deep: '#0f5a4f', cream: '#f5f1ea' },
  coral: { ink: '#e8623a', wash: '#fde0d4', deep: '#a83a18', cream: '#fdf2eb' },
  gold:  { ink: '#d4841a', wash: '#fbe8c4', deep: '#7a4806', cream: '#fbf3e2' },
};

interface FamCoverProps {
  pattern: FamPattern;
  accent: FamAccent;
  height?: number;
  imageUrl?: string | null;
  alt?: string;
}

export function FamCover({ pattern, accent, height = 132, imageUrl, alt }: FamCoverProps) {
  if (imageUrl) {
    return (
      <img
        className="ace-fam-cover-img"
        src={getSupabaseImageUrl(imageUrl, { width: 520, height: 180, resize: 'cover', quality: 72 })}
        alt={alt ?? ''}
        style={{ height }}
        loading="lazy"
        decoding="async"
      />
    );
  }
  const p = PALETTE[accent] ?? PALETTE.teal;
  const w = 600;
  const h = 240;
  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', background: p.wash }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: 'block' }} aria-hidden>
        {pattern === 'sunburst' && <Sunburst p={p} />}
        {pattern === 'wave'     && <Wave p={p} />}
        {pattern === 'dots'     && <Dots p={p} />}
        {pattern === 'arches'   && <Arches p={p} />}
        {pattern === 'lantern'  && <Lanterns p={p} />}
        {pattern === 'leaves'   && <Leaves p={p} />}
      </svg>
    </div>
  );
}

function Sunburst({ p }: { p: PaletteEntry }) {
  const cx = 480, cy = 60, R = 280;
  const rays = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI;
    const x = cx + Math.cos(Math.PI + a) * R;
    const y = cy + Math.sin(Math.PI + a) * R;
    rays.push(<line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={p.ink} strokeWidth="1.5" opacity={i % 2 ? 0.35 : 0.6} />);
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill={p.cream} />
      {rays}
      <circle cx={cx} cy={cy} r={36} fill={p.ink} />
      <circle cx={cx} cy={cy} r={26} fill={p.cream} />
      <circle cx={cx} cy={cy} r={16} fill={p.ink} />
    </g>
  );
}

function Wave({ p }: { p: PaletteEntry }) {
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M -20 ${60 + i * 36} Q 150 ${10 + i * 30} 320 ${60 + i * 36} T 640 ${60 + i * 36}`}
          stroke={p.ink} strokeWidth={2} fill="none" opacity={0.25 + i * 0.12}
        />
      ))}
      <circle cx={520} cy={56} r={26} fill={p.ink} />
      <circle cx={520} cy={56} r={14} fill={p.cream} />
    </g>
  );
}

function Dots({ p }: { p: PaletteEntry }) {
  const dots = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 18; x++) {
      const off = (y % 2) * 18;
      const r = 3 + ((x + y) % 4);
      dots.push(<circle key={`${x}-${y}`} cx={20 + x * 34 + off} cy={20 + y * 30} r={r} fill={p.ink} opacity={0.18 + ((x + y) % 4) * 0.15} />);
    }
  }
  return <g>{dots}</g>;
}

function Arches({ p }: { p: PaletteEntry }) {
  return (
    <g>
      {[0, 1, 2, 3].map((i) => {
        const x = 60 + i * 150;
        return (
          <g key={i}>
            <path d={`M ${x} 220 L ${x} 120 Q ${x + 50} 40 ${x + 100} 120 L ${x + 100} 220 Z`}
                  fill="none" stroke={p.ink} strokeWidth={2} opacity={0.55} />
            <circle cx={x + 50} cy={110} r={8} fill={p.ink} opacity={0.7} />
          </g>
        );
      })}
      <line x1={0} y1={220} x2={600} y2={220} stroke={p.ink} strokeWidth={2} opacity={0.5} />
    </g>
  );
}

function Lanterns({ p }: { p: PaletteEntry }) {
  const lanterns = [
    { x: 90, y: 100, r: 38 },
    { x: 220, y: 70, r: 28 },
    { x: 330, y: 110, r: 44 },
    { x: 460, y: 80, r: 32 },
    { x: 550, y: 130, r: 24 },
  ];
  return (
    <g>
      <line x1={0} y1={20} x2={600} y2={36} stroke={p.ink} strokeWidth={1.5} opacity={0.5} />
      {lanterns.map((l, i) => (
        <g key={i}>
          <line x1={l.x} y1={28} x2={l.x} y2={l.y - l.r} stroke={p.ink} strokeWidth={1} opacity={0.5} />
          <ellipse cx={l.x} cy={l.y} rx={l.r * 0.7} ry={l.r} fill={p.ink} opacity={0.85} />
          <ellipse cx={l.x} cy={l.y} rx={l.r * 0.4} ry={l.r * 0.7} fill={p.cream} opacity={0.55} />
          <line x1={l.x - 10} y1={l.y + l.r} x2={l.x + 10} y2={l.y + l.r} stroke={p.ink} strokeWidth={1.5} />
          <line x1={l.x} y1={l.y + l.r} x2={l.x} y2={l.y + l.r + 14} stroke={p.ink} strokeWidth={1} opacity={0.6} />
        </g>
      ))}
    </g>
  );
}

function Leaves({ p }: { p: PaletteEntry }) {
  const leaves: Array<[number, number, number]> = [
    [90, 80, 30], [180, 150, 20], [260, 60, 36], [360, 130, 26],
    [440, 80, 32], [520, 160, 22], [60, 180, 24],
  ];
  return (
    <g>
      {leaves.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x}, ${y}) rotate(${i * 35})`}>
          <path d={`M 0 0 Q ${s} ${-s} 0 ${-s * 2.2} Q ${-s} ${-s} 0 0 Z`} fill={p.ink} opacity={0.8 - i * 0.06} />
          <line x1={0} y1={0} x2={0} y2={-s * 2.2} stroke={p.cream} strokeWidth={1} opacity={0.5} />
        </g>
      ))}
    </g>
  );
}
