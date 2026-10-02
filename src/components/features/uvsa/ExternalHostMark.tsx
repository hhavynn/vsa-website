import { ExternalHostIdentity } from "../../../lib/externalEventLinking";
import { sanitizeHref } from "../../../utils/sanitizeUrl";
import { SchoolMarkSize, SchoolVisualMark } from "./SchoolVisualMark";

/**
 * The host's logo / PFP. It opens the host's Instagram when one is known, the
 * same way the school directory does; UVSA SoCal uses its configured identity.
 */
export function ExternalHostMark({
  host,
  size = "md",
}: {
  host: ExternalHostIdentity;
  size?: SchoolMarkSize;
}) {
  const mark = (
    <SchoolVisualMark
      school={host.school}
      fallbackLabel={host.markLabel}
      size={size}
    />
  );

  if (!host.instagramUrl) return mark;

  return (
    <a
      href={sanitizeHref(host.instagramUrl)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${host.shortName} on Instagram`}
      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
    >
      {mark}
    </a>
  );
}
