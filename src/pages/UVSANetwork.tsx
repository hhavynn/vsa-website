import { PageTitle } from "../components/common/PageTitle";
import { useUVSASchools } from "../hooks/useUVSASchools";
import { useUVSANetworkPageSettings } from "../hooks/useUVSANetworkPageSettings";
import { useExternalEvents } from "../hooks/useExternalEvents";
import { RevealOnScrollWrapper } from "../components/common/RevealOnScrollWrapper";
import {
  getSummerBreakMessage,
  shouldUseSummerEmptyState,
} from "../utils/seasonalState";
import { isSupabaseUnavailable } from "../utils/isSupabaseUnavailable";
import { DegradedModeBanner } from "../components/common/DegradedModeBanner";
import { ContentUnavailableState } from "../components/common/ContentUnavailableState";
import {
  FALLBACK_UVSA_NETWORK,
  FALLBACK_LINKS,
} from "../config/publicFallbackContent";
import { pickFeaturedUpcomingEvent } from "../lib/uvsaNetwork";
import { NetworkHero } from "../components/features/uvsa/NetworkHero";
import { SchoolDirectory } from "../components/features/uvsa/SchoolDirectory";
import { UpcomingExternals } from "../components/features/uvsa/UpcomingExternals";
import { FirstExternalGuide } from "../components/features/uvsa/FirstExternalGuide";
import { ExternalArchive } from "../components/features/uvsa/ExternalArchive";
import { NetworkInfoFooter } from "../components/features/uvsa/NetworkInfoFooter";

export default function UVSANetwork() {
  const {
    schools,
    loading: schoolsLoading,
    error: schoolsError,
  } = useUVSASchools();
  const { settings, error: settingsError } = useUVSANetworkPageSettings();
  const {
    events: upcomingEvents,
    loading: upcomingLoading,
    error: upcomingError,
  } = useExternalEvents({ status: "upcoming" });
  const {
    events: pastEvents,
    loading: pastLoading,
    error: pastError,
  } = useExternalEvents({ status: "past" });
  const {
    events: historicalEvents,
    loading: historicalLoading,
    error: historicalError,
  } = useExternalEvents({ status: "historical" });

  const isDegraded =
    isSupabaseUnavailable(schoolsError) ||
    isSupabaseUnavailable(settingsError) ||
    isSupabaseUnavailable(upcomingError) ||
    isSupabaseUnavailable(pastError) ||
    isSupabaseUnavailable(historicalError);

  if (isDegraded) {
    return (
      <>
        <PageTitle title="SoCal VSA Network" />
        <DegradedModeBanner sourceName="uvsa-network" />
        <div className="vsa-container py-20">
          <ContentUnavailableState
            title="External info temporarily unavailable"
            message={FALLBACK_UVSA_NETWORK.message}
            actionLabel="View on Instagram"
            actionHref={FALLBACK_LINKS.instagram}
          />
        </div>
      </>
    );
  }

  const featuredEvent = pickFeaturedUpcomingEvent(upcomingEvents);
  const summerEmpty = shouldUseSummerEmptyState(upcomingEvents.length > 0)
    ? getSummerBreakMessage("externals")
    : undefined;

  return (
    <>
      <PageTitle title="SoCal VSA Network" />

      <NetworkHero
        settings={settings}
        schools={schools}
        schoolsLoading={schoolsLoading}
      />

      <div className="vsa-container space-y-16 py-12 sm:space-y-20">
        <RevealOnScrollWrapper>
          <SchoolDirectory
            heading={settings.schools_heading}
            schools={schools}
            loading={schoolsLoading}
          />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <UpcomingExternals
            heading={settings.upcoming_heading}
            events={upcomingEvents}
            featured={featuredEvent}
            loading={upcomingLoading}
            summerEmpty={summerEmpty}
            emptyTitle={settings.empty_state_title}
            emptyMessage={settings.empty_state_message}
          />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <FirstExternalGuide />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <ExternalArchive
            heading={settings.showcase_heading}
            description={settings.showcase_description}
            events={[...pastEvents, ...historicalEvents]}
            loading={pastLoading || historicalLoading}
          />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <NetworkInfoFooter settings={settings} />
        </RevealOnScrollWrapper>
      </div>
    </>
  );
}
