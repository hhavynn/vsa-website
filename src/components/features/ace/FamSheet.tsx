import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AceFamily, AceFamilyMember } from '../../../types';
import { membersToTreeNodes } from '../../../lib/aceFamilyAdapter';
import { FamilyTree, TreeNode } from './FamilyTree';
import { FamAccent } from './FamCover';

interface FamSheetProps {
  family: AceFamily;
  members: AceFamilyMember[];
  accent: FamAccent;
  viet: string | null;
  dark: boolean;
  onClose: () => void;
}

function firstInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

interface PanOffset {
  x: number;
  y: number;
}

const PAN_BOUND_PADDING = 32;
const PAN_RESET_Y = 24;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.15;
const DEFAULT_ZOOM = 1;

function clampZoom(next: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(2))));
}

function usePannableTree(resetKey: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, offset: { x: 0, y: 0 } });
  const movedDuringDragRef = useRef(false);
  const [offset, setOffset] = useState<PanOffset>({ x: 0, y: PAN_RESET_Y });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isDragging, setIsDragging] = useState(false);

  const boundOffset = useCallback((next: PanOffset, scale: number): PanOffset => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return next;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const canvasWidth = canvas.offsetWidth * scale;
    const canvasHeight = canvas.offsetHeight * scale;

    if (!viewportWidth || !viewportHeight || !canvasWidth || !canvasHeight) return next;

    const minX = canvasWidth <= viewportWidth - PAN_BOUND_PADDING * 2
      ? (viewportWidth - canvasWidth) / 2
      : viewportWidth - canvasWidth - PAN_BOUND_PADDING;
    const maxX = canvasWidth <= viewportWidth - PAN_BOUND_PADDING * 2
      ? (viewportWidth - canvasWidth) / 2
      : PAN_BOUND_PADDING;
    const minY = canvasHeight <= viewportHeight - PAN_BOUND_PADDING * 2
      ? PAN_RESET_Y
      : viewportHeight - canvasHeight - PAN_BOUND_PADDING;
    const maxY = PAN_BOUND_PADDING;

    return {
      x: Math.min(maxX, Math.max(minX, next.x)),
      y: Math.min(maxY, Math.max(minY, next.y)),
    };
  }, []);

  const getResetOffset = useCallback((scale = DEFAULT_ZOOM): PanOffset => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) {
      return { x: 0, y: PAN_RESET_Y };
    }

    const centeredX = (viewport.clientWidth - canvas.offsetWidth * scale) / 2;
    return boundOffset({ x: centeredX, y: PAN_RESET_Y }, scale);
  }, [boundOffset]);

  const resetView = useCallback(() => {
    const nextZoom = DEFAULT_ZOOM;
    setZoom(nextZoom);
    setOffset(getResetOffset(nextZoom));
  }, [getResetOffset]);

  const zoomTo = useCallback((nextZoom: number) => {
    setZoom((currentZoom) => {
      const clampedZoom = clampZoom(nextZoom);
      if (clampedZoom === currentZoom) return currentZoom;

      setOffset((currentOffset) => {
        const viewport = viewportRef.current;
        if (!viewport) return boundOffset(currentOffset, clampedZoom);

        const focusX = viewport.clientWidth / 2;
        const focusY = viewport.clientHeight / 2;
        const worldX = (focusX - currentOffset.x) / currentZoom;
        const worldY = (focusY - currentOffset.y) / currentZoom;

        return boundOffset({
          x: focusX - worldX * clampedZoom,
          y: focusY - worldY * clampedZoom,
        }, clampedZoom);
      });

      return clampedZoom;
    });
  }, [boundOffset]);

  const zoomIn = useCallback(() => {
    zoomTo(zoom + ZOOM_STEP);
  }, [zoom, zoomTo]);

  const zoomOut = useCallback(() => {
    zoomTo(zoom - ZOOM_STEP);
  }, [zoom, zoomTo]);

  const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomTo(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  }, [zoom, zoomTo]);

  const zoomPercent = Math.round(zoom * 100);
  const canZoomIn = zoom < MAX_ZOOM;
  const canZoomOut = zoom > MIN_ZOOM;

  const controls = {
    zoom,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetView,
  };

  useLayoutEffect(() => {
    resetView();
  }, [resetKey, resetView]);

  useEffect(() => {
    const onResize = () => {
      setOffset((current) => boundOffset(current, zoom));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [boundOffset, zoom]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('button, a, input, textarea, select')) return;

    pointerIdRef.current = e.pointerId;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offset,
    };
    movedDuringDragRef.current = false;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [offset]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      movedDuringDragRef.current = true;
      e.preventDefault();
    }

    setOffset(boundOffset({
      x: dragStartRef.current.offset.x + dx,
      y: dragStartRef.current.offset.y + dy,
    }, zoom));
  }, [boundOffset, zoom]);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (movedDuringDragRef.current) {
      window.setTimeout(() => {
        movedDuringDragRef.current = false;
      }, 300);
    }
  }, []);

  const handleClickCapture = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (!movedDuringDragRef.current) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('button, a, input, textarea, select')) {
      movedDuringDragRef.current = false;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    movedDuringDragRef.current = false;
  }, []);

  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 80 : 40;
    const moves: Record<string, PanOffset> = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    };

    if (e.key === 'Home') {
      e.preventDefault();
      resetView();
      return;
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
      return;
    }
    if (e.key === '-') {
      e.preventDefault();
      zoomOut();
      return;
    }

    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setOffset((current) => boundOffset({ x: current.x + move.x, y: current.y + move.y }, zoom));
  }, [boundOffset, resetView, zoom, zoomIn, zoomOut]);

  return {
    viewportRef,
    canvasRef,
    offset,
    zoom,
    controls,
    isDragging,
    resetView,
    viewportHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture: handleClickCapture,
      onKeyDown: handleKeyDown,
      onWheel: handleWheel,
    },
  };
}

export function FamSheet({ family, members, accent, viet, dark, onClose }: FamSheetProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const treeNodes = useMemo<TreeNode[]>(() => membersToTreeNodes(members), [members]);
  const pan = usePannableTree(`${family.id}:${treeNodes.length}`);

  useEffect(() => {
    setSelectedNode(null);
  }, [family.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const selectedMember = selectedNode ? memberById.get(selectedNode) ?? null : null;
  const selectedBig = selectedMember && selectedMember.parent_member_id
    ? memberById.get(selectedMember.parent_member_id) ?? null
    : null;
  const selectedLittles = selectedMember
    ? members.filter((m) => m.parent_member_id === selectedMember.id)
    : [];

  const genCount = useMemo(() => {
    if (treeNodes.length === 0) return 0;
    const byId = new Map(treeNodes.map((n) => [n.id, n]));
    function depth(id: string, seen: Set<string>): number {
      const n = byId.get(id);
      if (!n || !n.parent || !byId.has(n.parent) || seen.has(id)) return 1;
      seen.add(id);
      return 1 + depth(n.parent, seen);
    }
    let max = 0;
    treeNodes.forEach((n) => {
      const d = depth(n.id, new Set());
      if (d > max) max = d;
    });
    return max;
  }, [treeNodes]);

  const isLittle = (m: AceFamilyMember | null) =>
    !!m && (m.role_label ?? '').toLowerCase().includes('little');

  return (
    <div className="ace-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${family.name} family tree`}>
      <div className="ace-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ace-sheet-grabber" />

        <div className="ace-sheet-head">
          <div className="ace-sheet-head-left">
            <div className={`ace-sheet-eyebrow ace-sheet-eyebrow-${accent}`}>
              Family{viet ? ` · ${viet}` : ''}
            </div>
            <div className="ace-sheet-title">
              {family.name}
              {viet && <span className={`ace-sheet-viet ace-sheet-viet-${accent}`}> · {viet}</span>}
            </div>
            <div className="ace-sheet-meta">
              {members.length} members · {genCount} generation{genCount === 1 ? '' : 's'} · Est. {family.academic_year_start}
            </div>
          </div>
          <button className="ace-iconbtn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="ace-sheet-legend">
          <span className="ace-legend-item">
            <span className={`ace-legend-swatch ace-legend-swatch-fill-${accent}`} />
            Big · in fam
          </span>
          <span className="ace-legend-item">
            <span className={`ace-legend-swatch ace-legend-swatch-ring-${accent}`} />
            Little · current
          </span>
          <span className="ace-legend-item">
            <span className={`ace-legend-line ace-legend-line-${accent}`} />
            Newest line
          </span>
        </div>

        <div
          className={`ace-sheet-treewrap ace-tree-panviewport ${pan.isDragging ? 'is-dragging' : ''}`}
          ref={pan.viewportRef}
          tabIndex={treeNodes.length > 0 ? 0 : undefined}
          aria-label="Family tree canvas. Drag to pan, use arrow keys to pan, use plus and minus to zoom, or press Home to reset the view."
          {...pan.viewportHandlers}
        >
          {treeNodes.length > 0 && (
            <div className="ace-tree-controls">
              <button
                className="ace-tree-control"
                type="button"
                onClick={pan.controls.zoomOut}
                disabled={!pan.controls.canZoomOut}
                aria-label="Zoom out family tree"
              >
                <span className="ace-tree-control-symbol" aria-hidden="true">−</span>
                <span className="ace-tree-control-text">Zoom Out</span>
              </button>
              <div className="ace-tree-zoom-readout" aria-hidden="true">
                {pan.controls.zoomPercent}%
              </div>
              <button
                className="ace-tree-control"
                type="button"
                onClick={pan.controls.zoomIn}
                disabled={!pan.controls.canZoomIn}
                aria-label="Zoom in family tree"
              >
                <span className="ace-tree-control-symbol" aria-hidden="true">+</span>
                <span className="ace-tree-control-text">Zoom In</span>
              </button>
              <button
                className="ace-tree-control ace-tree-reset"
                type="button"
                onClick={pan.resetView}
                aria-label="Reset family tree view"
              >
                <span className="ace-tree-control-symbol" aria-hidden="true">Reset</span>
                <span className="ace-tree-control-text">Reset View</span>
              </button>
            </div>
          )}
          <div
            className="ace-sheet-treepad ace-tree-canvas"
            ref={pan.canvasRef}
            style={{ transform: `translate3d(${pan.offset.x}px, ${pan.offset.y}px, 0) scale(${pan.zoom})` }}
          >
            {treeNodes.length === 0 ? (
              <div className="ace-fam-empty" style={{ minWidth: 280 }}>
                This fam has no published members yet.
              </div>
            ) : (
              <FamilyTree
                nodes={treeNodes}
                accent={accent}
                focusId={selectedNode}
                onSelect={(id) => setSelectedNode(id)}
                compact={false}
                dark={dark}
              />
            )}
          </div>
        </div>

        <div className={`ace-sheet-rail ${selectedMember ? 'is-open' : ''}`}>
          {selectedMember ? (
            <div className="ace-rail-body">
              <div className="ace-rail-card">
                <div className={`ace-rail-avatar ace-rail-avatar-${accent}${isLittle(selectedMember) ? ' is-little' : ''}`}>
                  {firstInitial(selectedMember.name)}
                </div>
                <div className="ace-rail-info">
                  <div className="ace-rail-name">{selectedMember.name}</div>
                  {selectedMember.role_label && (
                    <div className="ace-rail-role">{selectedMember.role_label}</div>
                  )}
                </div>
              </div>
              <div className="ace-rail-rel">
                {selectedBig && (
                  <div>
                    <div className="ace-rail-rel-h">Big</div>
                    <button className="ace-rail-chip" onClick={() => setSelectedNode(selectedBig.id)}>
                      <span className={`ace-rail-chip-dot ace-rail-chip-dot-${accent}`}>
                        {firstInitial(selectedBig.name)}
                      </span>
                      {selectedBig.name}
                      {selectedBig.role_label ? ` · ${selectedBig.role_label}` : ''}
                    </button>
                  </div>
                )}
                {selectedLittles.length > 0 && (
                  <div>
                    <div className="ace-rail-rel-h">Littles ({selectedLittles.length})</div>
                    <div className="ace-rail-chips">
                      {selectedLittles.map((l) => (
                        <button key={l.id} className="ace-rail-chip" onClick={() => setSelectedNode(l.id)}>
                          <span className={`ace-rail-chip-dot ace-rail-chip-dot-${accent}${isLittle(l) ? ' is-little' : ''}`}>
                            {firstInitial(l.name)}
                          </span>
                          {l.name}
                          {l.role_label ? ` · ${l.role_label}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!selectedBig && selectedLittles.length === 0 && (
                  <div className="ace-rail-empty">Founder — no Big in this fam.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="ace-sheet-hint">
              Tap a member to see their Big and Littles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
