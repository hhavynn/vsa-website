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
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
const ZOOM_BUTTON_FACTOR = 1.2;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const DEFAULT_ZOOM = 1;

function clampZoom(next: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(3))));
}

function distance(a: PanOffset, b: PanOffset): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PanOffset, b: PanOffset): PanOffset {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function usePannableTree(resetKey: string) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef(new Map<number, PanOffset>());
  const pointerIdRef = useRef<number | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, offset: { x: 0, y: 0 } });
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
    world: PanOffset;
  } | null>(null);
  const movedDuringDragRef = useRef(false);
  const offsetRef = useRef<PanOffset>({ x: 0, y: PAN_RESET_Y });
  const zoomRef = useRef(DEFAULT_ZOOM);
  const [offset, setOffset] = useState<PanOffset>({ x: 0, y: PAN_RESET_Y });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

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
    const nextOffset = getResetOffset(nextZoom);
    zoomRef.current = nextZoom;
    offsetRef.current = nextOffset;
    setZoom(nextZoom);
    setOffset(nextOffset);
  }, [getResetOffset]);

  const viewportPoint = useCallback((clientX: number, clientY: number): PanOffset => {
    const viewport = viewportRef.current;
    if (!viewport) return { x: clientX, y: clientY };
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const zoomTo = useCallback((nextZoom: number, focus?: PanOffset) => {
    setZoom((currentZoom) => {
      const clampedZoom = clampZoom(nextZoom);
      if (clampedZoom === currentZoom) return currentZoom;

      zoomRef.current = clampedZoom;
      setOffset((currentOffset) => {
        const viewport = viewportRef.current;
        if (!viewport) {
          const nextOffset = boundOffset(currentOffset, clampedZoom);
          offsetRef.current = nextOffset;
          return nextOffset;
        }

        const focusX = focus?.x ?? viewport.clientWidth / 2;
        const focusY = focus?.y ?? viewport.clientHeight / 2;
        const worldX = (focusX - currentOffset.x) / currentZoom;
        const worldY = (focusY - currentOffset.y) / currentZoom;

        const nextOffset = boundOffset({
          x: focusX - worldX * clampedZoom,
          y: focusY - worldY * clampedZoom,
        }, clampedZoom);
        offsetRef.current = nextOffset;
        return nextOffset;
      });

      return clampedZoom;
    });
  }, [boundOffset]);

  const zoomIn = useCallback(() => {
    zoomTo(zoom * ZOOM_BUTTON_FACTOR);
  }, [zoom, zoomTo]);

  const zoomOut = useCallback(() => {
    zoomTo(zoom / ZOOM_BUTTON_FACTOR);
  }, [zoom, zoomTo]);

  const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomTo(
      zoom * Math.exp(-e.deltaY * WHEEL_ZOOM_SENSITIVITY),
      viewportPoint(e.clientX, e.clientY),
    );
  }, [viewportPoint, zoom, zoomTo]);

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
      setOffset((current) => {
        const nextOffset = boundOffset(current, zoom);
        offsetRef.current = nextOffset;
        return nextOffset;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [boundOffset, zoom]);

  const getActivePointerPair = useCallback((): [PanOffset, PanOffset] | null => {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return null;
    return [points[0], points[1]];
  }, []);

  const startPan = useCallback((pointerId: number, point: PanOffset) => {
    pointerIdRef.current = pointerId;
    dragStartRef.current = {
      x: point.x,
      y: point.y,
      offset: offsetRef.current,
    };
    pinchStartRef.current = null;
  }, []);

  const startPinch = useCallback(() => {
    const pair = getActivePointerPair();
    if (!pair) return;
    const [a, b] = pair;
    const startDistance = distance(a, b);
    if (startDistance <= 0) return;
    const startMidpoint = midpoint(a, b);
    const startZoom = zoomRef.current;
    const startOffset = offsetRef.current;
    pinchStartRef.current = {
      distance: startDistance,
      zoom: startZoom,
      world: {
        x: (startMidpoint.x - startOffset.x) / startZoom,
        y: (startMidpoint.y - startOffset.y) / startZoom,
      },
    };
    pointerIdRef.current = null;
  }, [getActivePointerPair]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest('button, a, input, textarea, select')) return;

    const point = viewportPoint(e.clientX, e.clientY);
    activePointersRef.current.set(e.pointerId, point);
    movedDuringDragRef.current = false;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activePointersRef.current.size >= 2) {
      startPinch();
    } else {
      startPan(e.pointerId, point);
    }
  }, [startPan, startPinch, viewportPoint]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;

    const point = viewportPoint(e.clientX, e.clientY);
    activePointersRef.current.set(e.pointerId, point);

    if (activePointersRef.current.size >= 2) {
      const pair = getActivePointerPair();
      const pinchStart = pinchStartRef.current;
      if (!pair || !pinchStart) return;

      const [a, b] = pair;
      const nextDistance = distance(a, b);
      if (nextDistance <= 0) return;
      const nextZoom = clampZoom(pinchStart.zoom * (nextDistance / pinchStart.distance));
      const nextMidpoint = midpoint(a, b);

      movedDuringDragRef.current = true;
      e.preventDefault();

      setZoom(nextZoom);
      zoomRef.current = nextZoom;
      const nextOffset = boundOffset({
        x: nextMidpoint.x - pinchStart.world.x * nextZoom,
        y: nextMidpoint.y - pinchStart.world.y * nextZoom,
      }, nextZoom);
      offsetRef.current = nextOffset;
      setOffset(nextOffset);
      return;
    }

    if (pointerIdRef.current !== e.pointerId) return;

    const dx = point.x - dragStartRef.current.x;
    const dy = point.y - dragStartRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      movedDuringDragRef.current = true;
      e.preventDefault();
    }

    const nextOffset = boundOffset({
      x: dragStartRef.current.offset.x + dx,
      y: dragStartRef.current.offset.y + dy,
    }, zoom);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, [boundOffset, getActivePointerPair, viewportPoint, zoom]);

  const endDrag = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (activePointersRef.current.size >= 2) {
      startPinch();
      return;
    }

    if (activePointersRef.current.size === 1) {
      const [remaining] = Array.from(activePointersRef.current.entries());
      startPan(remaining[0], remaining[1]);
      return;
    }

    pointerIdRef.current = null;
    pinchStartRef.current = null;
    setIsDragging(false);
    if (movedDuringDragRef.current) {
      window.setTimeout(() => {
        movedDuringDragRef.current = false;
      }, 300);
    }
  }, [startPan, startPinch]);

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
    setOffset((current) => {
      const nextOffset = boundOffset({ x: current.x + move.x, y: current.y + move.y }, zoom);
      offsetRef.current = nextOffset;
      return nextOffset;
    });
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
                className="ace-tree-control ace-tree-zoom-button"
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
                className="ace-tree-control ace-tree-zoom-button"
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
