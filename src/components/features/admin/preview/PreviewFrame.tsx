import { type ReactNode, type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ROOT_ID = 'public-preview-root';

// Links, buttons, and forms inside a preview must never act: a click on
// "Going" would record interest, a form link would open a draft URL.
function blockInteraction(event: SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Renders children into a same-origin iframe that carries the app's own
 * stylesheets and theme class. Because the iframe has its own viewport,
 * Tailwind's `sm:`/`lg:` breakpoints respond to the frame width — a narrow
 * frame shows the genuine mobile layout, not a squeezed desktop one.
 *
 * Children stay in this React tree (via a portal), so router/query context
 * and the real public components work unchanged.
 */
export function PreviewFrame({
  title,
  children,
  onEscape,
  className,
}: {
  title: string;
  children: ReactNode;
  onEscape?: () => void;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    // No `src`: the iframe keeps its initial about:blank document, which
    // inherits this page's base URL so relative asset paths still resolve.
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    const viewport = doc.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    const headNodes: Node[] = [
      viewport,
      ...Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]')).map((node) => node.cloneNode(true)),
    ];
    headNodes.forEach((node) => doc.head.appendChild(node));

    const syncTheme = () => {
      doc.documentElement.className = document.documentElement.className;
    };
    syncTheme();
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onEscapeRef.current?.();
    };
    doc.addEventListener('keydown', handleKeyDown);

    const root = doc.createElement('div');
    root.id = ROOT_ID;
    doc.body.appendChild(root);
    setMountNode(root);

    return () => {
      themeObserver.disconnect();
      doc.removeEventListener('keydown', handleKeyDown);
      root.remove();
      headNodes.forEach((node) => doc.head.removeChild(node));
    };
  }, []);

  return (
    <iframe ref={iframeRef} title={title} className={className}>
      {mountNode &&
        createPortal(
          <div
            data-public-preview=""
            onClickCapture={blockInteraction}
            onAuxClickCapture={blockInteraction}
            onSubmitCapture={blockInteraction}
          >
            {children}
          </div>,
          mountNode,
        )}
    </iframe>
  );
}
