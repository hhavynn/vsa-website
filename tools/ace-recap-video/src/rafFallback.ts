/**
 * In some macOS headless Chromium sessions requestAnimationFrame never fires
 * (no display vsync), which stalls Remotion's "Waiting for root component"
 * step. Only inside a headless renderer, race each rAF against a 50 ms timer
 * so whichever comes first runs the callback exactly once. Frames are still
 * seeked explicitly by Remotion, so output is unaffected.
 */
const headless = typeof navigator !== 'undefined' && /HeadlessChrome|Headless/i.test(navigator.userAgent);
if (typeof window !== 'undefined' && headless) {
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const pending = new Map<number, [number, number]>();
  let next = 0;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = ++next;
    let done = false;
    const run = (t: number) => {
      if (done) return;
      done = true;
      const handles = pending.get(id);
      pending.delete(id);
      if (handles) { nativeCancel(handles[0]); clearTimeout(handles[1]); }
      cb(t);
    };
    pending.set(id, [nativeRaf(run), window.setTimeout(() => run(performance.now()), 50)]);
    return id;
  };
  window.cancelAnimationFrame = (id: number) => {
    const handles = pending.get(id);
    if (!handles) return;
    nativeCancel(handles[0]);
    clearTimeout(handles[1]);
    pending.delete(id);
  };
}
export {};
