import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import { AceFamily, AceFamilyMember } from '../../../types';
import { getDisplayFamName, isDeadFam, membersToTreeNodes } from '../../../lib/aceFamilyAdapter';
import { getFamIconUrl } from '../../../lib/aceFamRoster';
import { FamilyTree, TreeNode, lineagePath, lineageTimeline } from './FamilyTree';
import { FamAccent } from './FamCover';
import { PhotoRequestSection } from '../avatar/PhotoRequestSection';
import { useMemberAvatars } from '../../../hooks/useMemberAvatars';
import { resolveMemberPhoto } from '../../../lib/memberPhotos';

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
// Matches the .ace-sheet-rail max-height transition, so framing a lineage
// measures the viewport after the rail has opened.
const RAIL_OPEN_MS = 320;

function clampZoom(next: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(3))));
}

function distance(a: PanOffset, b: PanOffset): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PanOffset, b: PanOffset): PanOffset {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return true;
  }
}

function capturePointer(e: ReactPointerEvent<HTMLDivElement>) {
  if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }
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

    // A tree that fits is centered by boundOffset; a wider one starts at its
    // left edge so the first root is on screen rather than connector lines.
    return boundOffset({ x: PAN_BOUND_PADDING, y: PAN_RESET_Y }, scale);
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
    // A press on a tree node defers capture until the pointer actually moves:
    // capturing here would retarget the tap's click to the viewport, so the
    // node could never be selected.
    if (!target?.closest('.ace-tree-node')) capturePointer(e);

    if (activePointersRef.current.size >= 2) {
      startPinch();
    } else {
      startPan(e.pointerId, point);
    }
  }, [startPan, startPinch, viewportPoint]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      // The button was released outside the viewport before capture began.
      activePointersRef.current.delete(e.pointerId);
      pointerIdRef.current = null;
      pinchStartRef.current = null;
      setIsDragging(false);
      return;
    }

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
      capturePointer(e);

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
      capturePointer(e);
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

  // Panning is transform-based, so a browser scroll (e.g. tabbing to an
  // off-screen node) would desync the view; undo it and pan to the node.
  const handleScroll = useCallback((e: ReactUIEvent<HTMLDivElement>) => {
    e.currentTarget.scrollTop = 0;
    e.currentTarget.scrollLeft = 0;
  }, []);

  const handleFocus = useCallback((e: ReactFocusEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    const node = e.target instanceof Element ? e.target.closest('.ace-tree-node') : null;
    if (!viewport || !canvas || !node || !canvas.offsetWidth) return;
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
    // Keyboard focus only: panning on a mouse/touch press would slide the node
    // out from under the pointer before its click lands.
    if (!isKeyboardFocus(node)) return;

    // Canvas-space position from two rects taken at the same instant, so a
    // pan/zoom transition in flight cancels out; then project it with the
    // target offset and zoom.
    const canvasBox = canvas.getBoundingClientRect();
    const renderedScale = canvasBox.width / canvas.offsetWidth;
    const box = node.getBoundingClientRect();
    const centerX = (box.left + box.width / 2 - canvasBox.left) / renderedScale;
    const centerY = (box.top + box.height / 2 - canvasBox.top) / renderedScale;
    const halfW = (box.width / renderedScale / 2) * zoomRef.current;
    const halfH = (box.height / renderedScale / 2) * zoomRef.current;
    const x = offsetRef.current.x + centerX * zoomRef.current;
    const y = offsetRef.current.y + centerY * zoomRef.current;
    const inView =
      x - halfW >= PAN_BOUND_PADDING && x + halfW <= viewport.clientWidth - PAN_BOUND_PADDING &&
      y - halfH >= PAN_BOUND_PADDING && y + halfH <= viewport.clientHeight - PAN_BOUND_PADDING;
    if (inView) return;

    const nextOffset = boundOffset({
      x: viewport.clientWidth / 2 - centerX * zoomRef.current,
      y: viewport.clientHeight / 2 - centerY * zoomRef.current,
    }, zoomRef.current);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, [boundOffset]);

  // Pans just enough to bring the given tree nodes into view. When they can't
  // all fit, the last one (the selected member) wins, with as many of the
  // nodes above it as the viewport allows.
  const revealNodes = useCallback((ids: string[]) => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas || !canvas.offsetWidth || ids.length === 0) return;
    // Never yank the canvas out from under a pan or pinch in progress.
    if (activePointersRef.current.size > 0) return;

    const wanted = new Set(ids);
    const elements = Array.from(canvas.querySelectorAll<SVGGElement>('[data-node-id]'))
      .filter((el) => wanted.has(el.dataset.nodeId ?? ''));
    if (elements.length === 0) return;

    const canvasBox = canvas.getBoundingClientRect();
    const renderedScale = canvasBox.width / canvas.offsetWidth;
    const boxes = elements.map((el) => {
      const box = el.getBoundingClientRect();
      return {
        left: (box.left - canvasBox.left) / renderedScale,
        right: (box.right - canvasBox.left) / renderedScale,
        top: (box.top - canvasBox.top) / renderedScale,
        bottom: (box.bottom - canvasBox.top) / renderedScale,
        id: el.dataset.nodeId,
      };
    });
    const target = boxes.find((b) => b.id === ids[ids.length - 1]) ?? boxes[boxes.length - 1];
    const scale = zoomRef.current;
    const current = offsetRef.current;

    const fitAxis = (
      offset: number,
      min: number,
      max: number,
      size: number,
      fallback: () => number,
    ): number => {
      const lo = offset + min * scale;
      const hi = offset + max * scale;
      if (hi - lo > size - PAN_BOUND_PADDING * 2) return fallback();
      if (lo < PAN_BOUND_PADDING) return offset + (PAN_BOUND_PADDING - lo);
      if (hi > size - PAN_BOUND_PADDING) return offset - (hi - (size - PAN_BOUND_PADDING));
      return offset;
    };

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const nextX = fitAxis(
      current.x,
      Math.min(...boxes.map((b) => b.left)),
      Math.max(...boxes.map((b) => b.right)),
      width,
      () => width / 2 - ((target.left + target.right) / 2) * scale,
    );
    const nextY = fitAxis(
      current.y,
      Math.min(...boxes.map((b) => b.top)),
      Math.max(...boxes.map((b) => b.bottom)),
      height,
      () => height - PAN_BOUND_PADDING - target.bottom * scale,
    );
    if (nextX === current.x && nextY === current.y) return;

    const nextOffset = boundOffset({ x: nextX, y: nextY }, scale);
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }, [boundOffset]);

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
    revealNodes,
    viewportHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture: handleClickCapture,
      onKeyDown: handleKeyDown,
      onWheel: handleWheel,
      onFocus: handleFocus,
      onScroll: handleScroll,
    },
  };
}

export function FamSheet({ family, members, accent, viet, dark, onClose }: FamSheetProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const displayName = getDisplayFamName(family.name);
  const deadFam = isDeadFam(family.name);
  const iconUrl = getFamIconUrl(family.slug);

  const memberAvatars = useMemberAvatars();
  const treeNodes = useMemo<TreeNode[]>(
    () => membersToTreeNodes(members, memberAvatars),
    [members, memberAvatars],
  );
  const pan = usePannableTree(`${family.id}:${treeNodes.length}`);
  const reduceMotion = !!useReducedMotion();
  const lineage = useMemo(() => lineagePath(treeNodes, selectedNode), [treeNodes, selectedNode]);
  const timeline = lineageTimeline(lineage.length, reduceMotion);

  useEffect(() => {
    setSelectedNode(null);
  }, [family.id]);

  // Frame the whole lineage once the rail has opened (or right away when it
  // already is), so a tap deep in the tree still shows the light's journey.
  const railWasOpenRef = useRef(false);
  const { revealNodes } = pan;
  useEffect(() => {
    const railWasOpen = railWasOpenRef.current;
    railWasOpenRef.current = lineage.length > 0;
    if (lineage.length === 0) return;
    const timer = window.setTimeout(() => revealNodes(lineage), railWasOpen ? 0 : RAIL_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [lineage, revealNodes]);

  // Stable so it runs only when the trail mounts (it's keyed per selection),
  // not on every pan re-render.
  const scrollTrailToEnd = useCallback((list: HTMLOListElement | null) => {
    if (list) list.scrollLeft = list.scrollWidth;
  }, []);

  const toggleNode = useCallback((id: string) => {
    setSelectedNode((current) => (current === id ? null : id));
  }, []);

  const clearSelection = useCallback(() => {
    const cleared = selectedNode;
    setSelectedNode(null);
    if (!cleared) return;
    // The Clear button unmounts with the rail; hand focus back to the node.
    const node = Array.from(pan.canvasRef.current?.querySelectorAll<SVGGElement>('[data-node-id]') ?? [])
      .find((el) => el.dataset.nodeId === cleared);
    node?.focus();
  }, [pan.canvasRef, selectedNode]);

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
  const selectedPhotoUrl = selectedMember
    ? resolveMemberPhoto(memberAvatars, selectedMember.member_id, selectedMember.photo_url)
    : null;
  const selectedHasSharedAvatar = !!selectedMember?.member_id && memberAvatars.has(selectedMember.member_id);

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
    <div className="ace-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${displayName} family tree`}>
      <div className="ace-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ace-sheet-grabber" />

        <div className="ace-sheet-head">
          {iconUrl && <img className="ace-sheet-icon" src={iconUrl} alt="" decoding="async" />}
          <div className="ace-sheet-head-left">
            <div className={`ace-sheet-eyebrow ace-sheet-eyebrow-${accent}`}>
              Family{viet ? ` · ${viet}` : ''}{deadFam ? ' · Graveyard' : ''}
            </div>
            <div className="ace-sheet-title">
              {displayName}
              {viet && <span className={`ace-sheet-viet ace-sheet-viet-${accent}`}> · {viet}</span>}
              {deadFam && <span className="ace-sheet-badge">Graveyard</span>}
            </div>
            <div className="ace-sheet-meta">
              {members.length} members · {genCount} generation{genCount === 1 ? '' : 's'}
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
                onSelect={toggleNode}
                compact={false}
                dark={dark}
              />
            )}
          </div>
        </div>

        <div className={`ace-sheet-rail ${selectedMember ? 'is-open' : ''}`}>
          {selectedMember ? (
            <div className="ace-rail-body">
              <div className="ace-rail-lineage-row">
                {lineage.length > 1 ? (
                  <nav className="ace-rail-lineage" aria-label={`Lineage of ${selectedMember.name}`}>
                    <div className="ace-rail-rel-h">Lineage</div>
                    {/* Keyed by the selection so the steps replay with the light. */}
                    <ol
                      className="ace-rail-lineage-list"
                      key={selectedMember.id}
                      ref={scrollTrailToEnd}
                    >
                      {lineage.map((id, i) => {
                        const step = memberById.get(id);
                        if (!step) return null;
                        const isCurrent = i === lineage.length - 1;
                        return (
                          // Ancestors appear as the light reaches them; the
                          // selected member is named at once (the trail opens
                          // scrolled to them).
                          <li
                            key={id}
                            className="ace-rail-lineage-step"
                            style={{ '--lineage-delay': `${isCurrent ? 0 : timeline.nodeDelay(i)}ms` } as CSSProperties}
                          >
                            {isCurrent ? (
                              <span className="ace-rail-lineage-current" aria-current="true">{step.name}</span>
                            ) : (
                              <button
                                type="button"
                                className="ace-rail-lineage-name"
                                onClick={() => setSelectedNode(id)}
                              >
                                {step.name}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </nav>
                ) : (
                  <div className="ace-rail-lineage" />
                )}
                <button type="button" className="ace-rail-clear" onClick={clearSelection}>
                  Clear
                </button>
              </div>
              <div className="ace-rail-card">
                <div className={`ace-rail-avatar ace-rail-avatar-${accent}${isLittle(selectedMember) ? ' is-little' : ''}`}>
                  {selectedPhotoUrl ? (
                    <img className="ace-rail-photo" src={selectedPhotoUrl} alt={selectedMember.name} decoding="async" />
                  ) : (
                    firstInitial(selectedMember.name)
                  )}
                </div>
                <div className="ace-rail-info">
                  <div className="ace-rail-name">{selectedMember.name}</div>
                  {selectedMember.role_label && (
                    <div className="ace-rail-role">{selectedMember.role_label}</div>
                  )}
                </div>
                <div className="ace-rail-photo-request">
                  {selectedMember.member_id ? (
                    <PhotoRequestSection
                      key={selectedMember.id}
                      matchedMemberId={selectedMember.member_id}
                      selectedMemberName={selectedMember.name}
                      buttonLabel={selectedHasSharedAvatar ? 'Update photo' : 'Request photo'}
                    />
                  ) : (
                    <p className="ace-rail-empty">
                      Photo requests open once a VSA admin links this name to a member record.
                    </p>
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
              Tap a member to trace their lineage, Big, and Littles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
