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
import {
  pickFeaturedUpcomingEvent,
  splitLapsedUpcoming,
} from "../lib/uvsaNetwork";
import { getLosAngelesDateOnly } from "../utils/losAngelesDate";
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
    events: upcomingRows,
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

  const { upcoming: upcomingEvents, lapsed: lapsedEvents } =
    splitLapsedUpcoming(upcomingRows, getLosAngelesDateOnly());
  const featuredEvent = pickFeaturedUpcomingEvent(upcomingEvents);
  // Any error that reaches here is not an outage (that returned above), e.g. a
  // schema mismatch. Show it as a failure, never as a legitimate empty state.
  // Rows react-query still holds from an earlier fetch stay visible.
  const upcomingFailed = Boolean(upcomingError) && upcomingRows.length === 0;
  const archiveFailed = Boolean(pastError || historicalError);
  const summerEmpty =
    !upcomingFailed && shouldUseSummerEmptyState(upcomingEvents.length > 0)
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
          <UpcomingExternals
            heading={settings.upcoming_heading}
            events={upcomingEvents}
            featured={featuredEvent}
            loading={upcomingLoading}
            error={upcomingFailed}
            summerEmpty={summerEmpty}
            emptyTitle={settings.empty_state_title}
            emptyMessage={settings.empty_state_message}
          />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <SchoolDirectory
            heading={settings.schools_heading}
            schools={schools}
            loading={schoolsLoading}
          />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <ExternalArchive
            heading={settings.showcase_heading}
            description={settings.showcase_description}
            events={[...pastEvents, ...lapsedEvents, ...historicalEvents]}
            loading={pastLoading || historicalLoading}
            error={archiveFailed}
          />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <FirstExternalGuide />
        </RevealOnScrollWrapper>

        <RevealOnScrollWrapper>
          <NetworkInfoFooter settings={settings} />
        </RevealOnScrollWrapper>
      </div>
    </>
  );
}
