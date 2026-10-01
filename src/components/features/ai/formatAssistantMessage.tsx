import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { sanitizeHref } from '../../../utils/sanitizeUrl';

// Ask VSA answers come back from Gemini as lightweight markdown. This renders
// the subset the model actually emits — paragraphs, bullet/numbered lists,
// headings, **bold**, *italic*, `code`, and [links](/path) — as React nodes.
// It never injects HTML, and only http(s) and same-site paths become links.

const LINK_CLASS =
  "font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300";

type Block =
  | { type: "paragraph"; lines: string[] }
  | { type: "heading"; text: string }
  | { type: "list"; ordered: boolean; start: number; items: string[] };

const BULLET_RE = /^[*\-•+]\s+(.*)$/;
const ORDERED_RE = /^(\d{1,3})[.)]\s+(.*)$/;
const HEADING_RE = /^#{1,6}\s+(.*)$/;
const RULE_RE = /^([-*_])(\s*\1){2,}$/;

// Link | **bold** | __bold__ | `code` | *italic*
const INLINE_RE =
  /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|`([^`\n]+)`|\*([^*\s](?:[^*\n]*?[^*\s])?)\*/g;

/**
 * Normalize line endings and recover list structure when the model flattens
 * a bulleted list onto one line ("…at your own pace by: * **Events:** …").
 */
export function normalizeAssistantText(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/([.!?:)])[ \t]+[*•][ \t]+(?=\S)/g, "$1\n* ")
    .trim();
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };

  for (const rawLine of normalizeAssistantText(content).split("\n")) {
    const line = rawLine.trim();

    if (!line || RULE_RE.test(line)) {
      flush();
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", text: heading[1] });
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const ordered = bullet ? null : ORDERED_RE.exec(line);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const text = bullet ? bullet[1] : ordered![2];
      if (
        !current ||
        current.type !== "list" ||
        current.ordered !== isOrdered
      ) {
        flush();
        current = {
          type: "list",
          ordered: isOrdered,
          start: ordered ? Number(ordered[1]) : 1,
          items: [],
        };
      }
      current.items.push(text);
      continue;
    }

    // An indented line directly under a list item continues that item.
    if (current?.type === "list" && /^\s/.test(rawLine)) {
      current.items[current.items.length - 1] += ` ${line}`;
      continue;
    }

    if (current?.type !== "paragraph") {
      flush();
      current = { type: "paragraph", lines: [] };
    }
    current.lines.push(line);
  }

  flush();
  return blocks;
}

function isInternalUrl(url: string) {
  return url.startsWith("/") && !url.startsWith("//");
}


// Drop markers the model left unbalanced (e.g. a truncated "**Note:") so raw
// asterisks never show up in the bubble.
function cleanText(text: string) {
  return text.replace(/\*\*|__/g, "");
}

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(INLINE_RE.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const key = `${keyPrefix}-${match.index}`;
    if (match.index > lastIndex) {
      nodes.push(cleanText(text.slice(lastIndex, match.index)));
    }

    const [, label, url, bold, boldAlt, code, italic] = match;

    if (label !== undefined) {
      const children = renderInline(label, `${key}-l`);
      const encoded = encodeURI(url.trim()).replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
      const safeUrl = sanitizeHref(encoded);
      if (safeUrl === '#') {
        nodes.push(...children);
      } else if (isInternalUrl(safeUrl)) {
        nodes.push(
          <Link key={key} to={safeUrl} className={LINK_CLASS}>
            {children}
          </Link>,
        );
      } else {
        nodes.push(
          <a
            key={key}
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {children}
          </a>,
        );
      }
    } else if (bold !== undefined || boldAlt !== undefined) {
      nodes.push(
        <strong key={key} className="font-bold">
          {renderInline(bold ?? boldAlt, `${key}-b`)}
        </strong>,
      );
    } else if (code !== undefined) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10"
        >
          {code}
        </code>,
      );
    } else if (italic !== undefined) {
      nodes.push(<em key={key}>{renderInline(italic, `${key}-e`)}</em>);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(cleanText(text.slice(lastIndex)));
  }

  return nodes;
}

export function AssistantMessageContent({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-2 break-words">
      {blocks.map((block, blockIndex) => {
        const key = `b${blockIndex}`;

        if (block.type === "heading") {
          return (
            <p key={key} className="font-bold">
              {renderInline(block.text, key)}
            </p>
          );
        }

        if (block.type === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`} className="pl-0.5">
              {renderInline(item, `${key}-${itemIndex}`)}
            </li>
          ));
          return block.ordered ? (
            <ol
              key={key}
              start={block.start}
              className="list-decimal space-y-1 pl-5"
            >
              {items}
            </ol>
          ) : (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {items}
            </ul>
          );
        }

        return (
          <p key={key}>
            {block.lines.map((line, lineIndex) => (
              <span key={`${key}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${key}-${lineIndex}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
