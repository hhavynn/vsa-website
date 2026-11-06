import {
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type UIEvent as ReactUIEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * Drag/pinch/wheel/keyboard pan-zoom for an ACE tree canvas. Moved verbatim
 * out of FamSheet so the private recap preview can reuse it without pulling
 * in FamSheet's Supabase-backed avatar and photo-request modules.
 */
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
export const RAIL_OPEN_MS = 320;

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

export function usePannableTree(resetKey: string, leftInset = 0) {
  const leftInsetRef = useRef(leftInset);
  leftInsetRef.current = leftInset;
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

    const inset = leftInsetRef.current;
    const availableWidth = Math.max(1, viewportWidth - inset);
    const fits = canvasWidth <= availableWidth - PAN_BOUND_PADDING * 2;
    const centered = inset + (availableWidth - canvasWidth) / 2;
    const minX = fits ? centered : viewportWidth - canvasWidth - PAN_BOUND_PADDING;
    const maxX = fits ? centered : PAN_BOUND_PADDING + inset;
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
      return { x: PAN_BOUND_PADDING + leftInsetRef.current, y: PAN_RESET_Y };
    }

    // A tree that fits is centered by boundOffset; a wider one starts at its
    // left edge so the first root is on screen rather than connector lines.
    return boundOffset({ x: PAN_BOUND_PADDING + leftInsetRef.current, y: PAN_RESET_Y }, scale);
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

        const focusX = focus?.x ?? (viewport.clientWidth + leftInsetRef.current) / 2;
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
    /** Zoom to an absolute level, keeping `focus` (a viewport point) fixed. */
    zoomTo,
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
      x - halfW >= PAN_BOUND_PADDING + leftInsetRef.current && x + halfW <= viewport.clientWidth - PAN_BOUND_PADDING &&
      y - halfH >= PAN_BOUND_PADDING && y + halfH <= viewport.clientHeight - PAN_BOUND_PADDING;
    if (inView) return;

    const nextOffset = boundOffset({
      x: (viewport.clientWidth + leftInsetRef.current) / 2 - centerX * zoomRef.current,
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
      lowerPadding: number,
      upperPadding: number,
    ): number => {
      const lo = offset + min * scale;
      const hi = offset + max * scale;
      if (hi - lo > size - lowerPadding - upperPadding) return fallback();
      if (lo < lowerPadding) return offset + (lowerPadding - lo);
      if (hi > size - upperPadding) return offset - (hi - (size - upperPadding));
      return offset;
    };

    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const nextX = fitAxis(
      current.x,
      Math.min(...boxes.map((b) => b.left)),
      Math.max(...boxes.map((b) => b.right)),
      width,
      () => (width + leftInsetRef.current) / 2 - ((target.left + target.right) / 2) * scale,
      PAN_BOUND_PADDING + leftInsetRef.current,
      PAN_BOUND_PADDING,
    );
    const nextY = fitAxis(
      current.y,
      Math.min(...boxes.map((b) => b.top)),
      Math.max(...boxes.map((b) => b.bottom)),
      height,
      () => height - PAN_BOUND_PADDING - target.bottom * scale,
      PAN_BOUND_PADDING,
      PAN_BOUND_PADDING,
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
