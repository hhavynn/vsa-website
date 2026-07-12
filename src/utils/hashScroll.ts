const HASH_SCROLL_SETTLE_FRAMES = 180;

export function keepHashTargetInView(id: string) {
  let cancelled = false;
  let frameId: number | null = null;
  let frames = 0;

  const scroll = () => {
    if (cancelled) return;

    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'auto' });

    if (frames++ < HASH_SCROLL_SETTLE_FRAMES) {
      frameId = window.requestAnimationFrame(scroll);
    }
  };

  frameId = window.requestAnimationFrame(scroll);

  return () => {
    cancelled = true;
    if (frameId !== null) window.cancelAnimationFrame(frameId);
  };
}
