import { sanitizeHref } from '../../../utils/sanitizeUrl';

export type AssistantLinkDecision =
  | { kind: 'text'; href: null }
  | { kind: 'internal'; href: string }
  | { kind: 'external'; href: string };

/**
 * Classify a URL from model-generated Markdown without trusting the model.
 * Preserve the existing encodeURI/escape behavior of formatAssistantMessage;
 * this extraction intentionally changes no allowed destinations.
 */
export function classifyAssistantLink(raw: string): AssistantLinkDecision {
  try {
    const encoded = encodeURI(raw.trim()).replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
    const safe = sanitizeHref(encoded);
    if (safe === '#') return { kind: 'text', href: null };
    if (safe.startsWith('/') && !safe.startsWith('//')) return { kind: 'internal', href: safe };
    return { kind: 'external', href: safe };
  } catch {
    // Model-produced malformed Unicode must not crash an entire chat bubble.
    return { kind: 'text', href: null };
  }
}
