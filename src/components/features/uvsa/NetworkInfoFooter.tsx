import { FALLBACK_LINKS } from "../../../config/publicFallbackContent";
import { UVSANetworkPageSettings } from "../../../data/repos/uvsaNetworkSettings";
import { InstagramIcon } from "./icons";
import { LinkButton } from "./LinkButton";

type FooterSettings = Pick<
  UVSANetworkPageSettings,
  | "intro_heading"
  | "intro_body"
  | "intro_note"
  | "stat_school_count_label"
  | "stat_competitions_label"
  | "stat_community_label"
>;

export function NetworkInfoFooter({ settings }: { settings: FooterSettings }) {
  const stats = [
    settings.stat_school_count_label,
    settings.stat_competitions_label,
    settings.stat_community_label,
  ].filter(Boolean);

  return (
    <section
      aria-labelledby="about-externals-heading"
      className="scrapbook-paper space-y-4 p-6 sm:p-8"
    >
      <h2
        id="about-externals-heading"
        className="font-serif text-2xl text-text-primary"
      >
        About {settings.intro_heading}
      </h2>
      <p className="font-sans text-sm leading-relaxed text-text-secondary sm:text-[15px]">
        {settings.intro_body}
      </p>
      {settings.intro_note && (
        <p className="font-sans text-sm leading-relaxed text-text-muted">
          {settings.intro_note}
        </p>
      )}
      <ul className="flex list-none flex-wrap gap-2 p-0">
        {stats.map((stat) => (
          <li
            key={stat}
            className="rounded-full border border-[var(--color-border)] bg-surface px-3.5 py-1.5 font-sans text-xs font-medium text-text-primary"
          >
            {stat}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3 pt-2">
        <LinkButton href={FALLBACK_LINKS.instagram} variant="primary">
          <InstagramIcon size={12} aria-hidden /> Follow VSA at UCSD
        </LinkButton>
        <LinkButton href={FALLBACK_LINKS.linktree}>
          Ride forms &amp; links
        </LinkButton>
      </div>
    </section>
  );
}
