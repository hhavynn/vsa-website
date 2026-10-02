import { UVSASchool } from "../../../types";
import { UVSANetworkPageSettings } from "../../../data/repos/uvsaNetworkSettings";
import { Skeleton } from "../../ui/Skeleton";
import { cn } from "../../../lib/utils";
import { isHomeBaseSchool } from "../../../lib/uvsaNetwork";
import { LinkButton } from "./LinkButton";
import { SchoolVisualMark } from "./SchoolVisualMark";

type HeroSettings = Pick<
  UVSANetworkPageSettings,
  | "hero_kicker"
  | "hero_title"
  | "hero_emphasis"
  | "hero_description"
  | "stat_school_count_label"
>;

export function NetworkHero({
  settings,
  schools,
  schoolsLoading,
}: {
  settings: HeroSettings;
  schools: UVSASchool[];
  schoolsLoading: boolean;
}) {
  const countLabel =
    schools.length > 0
      ? `${schools.length} schools`
      : settings.stat_school_count_label;

  return (
    <div className="vsa-page-hero">
      <div className="vsa-container relative z-10 grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div>
          <span className="scrapbook-sticker scrapbook-sticker-teal mb-4">
            {settings.hero_kicker}
          </span>
          <h1 className="vsa-page-title">
            {settings.hero_title} <em>{settings.hero_emphasis}</em>
          </h1>
          <p className="mt-4 max-w-xl font-sans text-[15px] leading-[1.8] text-text-secondary">
            {settings.hero_description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton
              href="#upcoming"
              external={false}
              variant="primary"
              className="min-h-[44px] px-5 text-sm"
            >
              Upcoming Externals
            </LinkButton>
            <LinkButton
              href="#schools"
              external={false}
              className="min-h-[44px] px-5 text-sm"
            >
              Meet the Schools
            </LinkButton>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 lg:items-end">
          {schoolsLoading ? (
            <div className="grid grid-cols-5 gap-2.5 sm:gap-3" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <Skeleton
                  key={i}
                  className="h-12 w-12 rounded-full sm:h-16 sm:w-16"
                />
              ))}
            </div>
          ) : (
            schools.length > 0 && (
              <ul
                className="grid list-none grid-cols-5 gap-2.5 p-0 sm:gap-3"
                aria-label="Schools in the network"
              >
                {schools.map((school) => (
                  <li key={school.id}>
                    <SchoolVisualMark
                      school={school}
                      size="sm"
                      decorative
                      className={cn(
                        "sm:h-16 sm:w-16",
                        isHomeBaseSchool(school) &&
                          "ring-2 ring-brand-600 ring-offset-2 ring-offset-[var(--color-bg)] dark:ring-brand-400",
                      )}
                    />
                  </li>
                ))}
              </ul>
            )
          )}
          <p className="font-sans text-xs font-semibold uppercase tracking-label text-text-secondary">
            {countLabel} <span aria-hidden>·</span> one community
          </p>
        </div>
      </div>
    </div>
  );
}
