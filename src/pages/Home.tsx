import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "../components/common/PageTitle";
import { DegradedModeBanner } from "../components/common/DegradedModeBanner";
import { RevealOnScrollWrapper } from "../components/common/RevealOnScrollWrapper";
import { ThisWeekInVSA } from "../components/features/home/ThisWeekInVSA";
import { ClosingSoonApplications } from "../components/features/home/ClosingSoonApplications";
import { OpenOpportunities } from "../components/features/home/OpenOpportunities";
import { PresidentsMessageSection } from "../components/features/home/PresidentsMessage";
import { WrappedRecapCard } from "../components/features/home/WrappedRecapCard";
import {
  EditorialAbout,
  EditorialEvents,
  EditorialGallery,
  EditorialGetInvolved,
  EditorialHero,
} from "../components/features/home/EditorialSections";
import { usePresidentsContent } from "../hooks/usePresidentsContent";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { OFFICIAL_LOGO } from "../config/brandAssets";
import {
  eventsRepository,
  type PublicEventPreview,
} from "../data/repos/events";
import { getLosAngelesDateOnly } from "../utils/losAngelesDate";
import { isEventUpcomingOrOngoing } from "../lib/eventLifecycle";
import { useEventLifecycleTimer } from "../hooks/useEventLifecycleTimer";

export function Home() {
  const { content: presidentsContent } = usePresidentsContent();
  const { settings: siteSettings } = useSiteSettings();
  const today = getLosAngelesDateOnly();
  const {
    data: rawUpcomingEvents = [],
    isError: eventsError,
    isLoading: upcomingEventsLoading,
  } = useQuery<PublicEventPreview[]>({
    queryKey: ["home", "upcoming-events-section", today],
    queryFn: () => eventsRepository.getPublicUpcomingPreview(today, 4),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const now = useEventLifecycleTimer(rawUpcomingEvents, [
    ["home", "upcoming-events-section"],
  ]);

  const upcomingEvents = useMemo(
    () =>
      rawUpcomingEvents
        .filter((event) => isEventUpcomingOrOngoing(event, now))
        .slice(0, 4),
    [rawUpcomingEvents, now],
  );

  const logoSrc = siteSettings.logoUrl || OFFICIAL_LOGO.src;

  return (
    <>
      <PageTitle title="Home" />
      {eventsError && <DegradedModeBanner sourceName="events" />}

      <EditorialHero
        logoSrc={logoSrc}
        logoAlt={siteSettings.logoAlt || "Official VSA at UC San Diego logo"}
      />

      <ThisWeekInVSA />
      <ClosingSoonApplications />

      <EditorialEvents
        events={upcomingEvents}
        isLoading={upcomingEventsLoading}
        isError={eventsError}
      />
      <EditorialAbout />
      <EditorialGallery />
      <EditorialGetInvolved />

      <RevealOnScrollWrapper>
        <OpenOpportunities compact />
      </RevealOnScrollWrapper>
      <RevealOnScrollWrapper>
        <PresidentsMessageSection content={presidentsContent} />
      </RevealOnScrollWrapper>
      <RevealOnScrollWrapper>
        <WrappedRecapCard />
      </RevealOnScrollWrapper>
    </>
  );
}
