/* eslint-disable testing-library/no-container, testing-library/no-node-access -- structural assertions (anchors, shimmer, section order) have no accessible role */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UVSANetwork from "./UVSANetwork";
import { DEFAULT_UVSA_NETWORK_PAGE_SETTINGS } from "../data/repos/uvsaNetworkSettings";
import { ExternalEvent, UVSASchool } from "../types";
import {
  makeEvent,
  makeSchool,
  OWN_LOGO_URL,
} from "../test-utils/uvsaFixtures";

const mockState: {
  schools: UVSASchool[];
  upcoming: ExternalEvent[];
  past: ExternalEvent[];
  historical: ExternalEvent[];
  loading: boolean;
  errors: { upcoming?: unknown; past?: unknown; historical?: unknown };
  forceSummer: boolean;
} = {
  schools: [],
  upcoming: [],
  past: [],
  historical: [],
  loading: false,
  errors: {},
  forceSummer: false,
};

// A non-outage failure, e.g. the image_url migration has not been applied yet.
const SCHEMA_ERROR = {
  code: "42703",
  message: "column external_events.image_url does not exist",
};

// Pin "today" so fixture dates never drift from upcoming to past as time passes.
jest.mock("../utils/losAngelesDate", () => ({
  ...jest.requireActual("../utils/losAngelesDate"),
  getLosAngelesDateOnly: () => "2026-10-01",
}));
// Lets a test exercise the summer-break branch regardless of the real date.
jest.mock("../utils/seasonalState", () => ({
  ...jest.requireActual("../utils/seasonalState"),
  shouldUseSummerEmptyState: (hasActiveItems: boolean) =>
    mockState.forceSummer && !hasActiveItems,
}));
jest.mock("../hooks/useUVSASchools", () => ({
  useUVSASchools: () => ({
    schools: mockState.schools,
    loading: mockState.loading,
    error: null,
  }),
}));
jest.mock("../hooks/useUVSANetworkPageSettings", () => ({
  useUVSANetworkPageSettings: () => {
    const { DEFAULT_UVSA_NETWORK_PAGE_SETTINGS: settings } = jest.requireActual(
      "../data/repos/uvsaNetworkSettings",
    );
    return { settings, loading: false, error: null };
  },
}));
jest.mock("../hooks/useExternalEvents", () => ({
  useExternalEvents: ({ status }: { status: string }) => ({
    events:
      status === "upcoming"
        ? mockState.upcoming
        : status === "past"
          ? mockState.past
          : mockState.historical,
    loading: mockState.loading,
    error: (mockState.errors as Record<string, unknown>)[status] ?? null,
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <UVSANetwork />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockState.schools = [
    makeSchool({
      id: "1",
      slug: "ucsd",
      short_name: "UCSD",
      logo_url: OWN_LOGO_URL,
    }),
    makeSchool({
      id: "2",
      slug: "uci",
      short_name: "UCI",
      system_type: "UC",
      logo_url: null,
    }),
  ];
  mockState.upcoming = [makeEvent({ id: "u1", title: "Upcoming Pageant" })];
  mockState.past = [
    makeEvent({
      id: "p1",
      title: "Archived Showcase",
      status: "past",
      is_featured: true,
      date: "2026-03-01",
    }),
  ];
  mockState.historical = [];
  mockState.loading = false;
  mockState.errors = {};
  mockState.forceSummer = false;
});

describe("UVSANetwork page", () => {
  it("orders sections: hero → upcoming → schools → archive → first external → info footer", () => {
    const { container } = renderPage();
    const ids = [
      "h1",
      "#upcoming",
      "#schools",
      "#archive",
      "#first-external",
      "#about-externals-heading",
    ];
    const positions = ids.map(
      (selector) => container.querySelector(selector) as Element,
    );

    positions.forEach((node) => expect(node).toBeInTheDocument());
    positions.slice(1).forEach((node, i) => {
      expect(
        positions[i].compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it("keeps hero copy admin-driven and offers shortcuts to schools and upcoming externals", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      `${DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.hero_title} ${DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.hero_emphasis}`,
    );
    expect(
      screen.getByText(DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.hero_description),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Meet the Schools" }),
    ).toHaveAttribute("href", "#schools");
    expect(
      screen.getByRole("link", { name: "Upcoming Externals" }),
    ).toHaveAttribute("href", "#upcoming");
    expect(screen.getByText(/2 schools/i)).toBeInTheDocument();
  });

  it("keeps archived events out of Upcoming Externals, even a featured one", () => {
    mockState.historical = [
      makeEvent({
        id: "h1",
        title: "Historical Classic",
        status: "historical",
        is_featured: true,
        date: "2025-02-01",
      }),
    ];
    renderPage();
    const upcoming = document.querySelector("#upcoming") as HTMLElement;
    expect(
      within(upcoming).getByRole("heading", { name: "Upcoming Pageant" }),
    ).toBeInTheDocument();
    expect(
      within(upcoming).queryByText("Archived Showcase"),
    ).not.toBeInTheDocument();
    expect(
      within(upcoming).queryByText("Historical Classic"),
    ).not.toBeInTheDocument();
    expect(upcoming.querySelectorAll("article")).toHaveLength(1);
  });

  it("shows a linked external's source-event flyer and time on its upcoming card", () => {
    mockState.upcoming = [
      makeEvent({
        id: "linked-flyer",
        source_event_id: "evt-9",
        title: "Tet Festival",
        source_event: {
          id: "evt-9",
          name: "Tet Festival",
          start_time: "18:00:00",
          thumbnail_url: "https://cdn.example/tet-thumb.webp",
          image_url: "https://cdn.example/tet-full.webp",
        },
      }),
    ];
    renderPage();
    const upcoming = document.querySelector("#upcoming") as HTMLElement;
    expect(
      within(upcoming).getByRole("img", { name: "Tet Festival flyer" }),
    ).toHaveAttribute("src", "https://cdn.example/tet-thumb.webp");
    expect(within(upcoming).getByText(/· 6 PM/)).toBeInTheDocument();
  });

  it("does not promote an archived featured event as a spotlight", () => {
    renderPage();
    expect(screen.queryByText("Featured External")).not.toBeInTheDocument();
    expect(screen.queryByText("External Spotlight")).not.toBeInTheDocument();
  });

  it("spotlights a featured event only when it is upcoming", () => {
    mockState.upcoming = [
      makeEvent({ id: "u1", title: "Headline Night", is_featured: true }),
    ];
    renderPage();
    expect(screen.getByText("Featured External")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Headline Night" }),
    ).toBeInTheDocument();
  });

  it("lists a linked UVSA SoCal-hosted event under Upcoming Externals with its organizer", () => {
    mockState.upcoming = [
      makeEvent({
        id: "linked-1",
        source_event_id: "evt-1",
        host_type: "uvsa_socal",
        uvsa_school_id: null,
        uvsa_school: undefined,
        title: "UVSA SoCal Fall Social",
        date: "2026-10-24",
        rsvp_url: "https://rsvp.example/socal",
      }),
    ];
    renderPage();
    const upcoming = document.querySelector("#upcoming") as HTMLElement;
    expect(
      within(upcoming).getByRole("heading", { name: "UVSA SoCal Fall Social" }),
    ).toBeInTheDocument();
    expect(within(upcoming).getByText("UVSA SoCal")).toBeInTheDocument();
    expect(
      within(upcoming).getByRole("link", { name: /rsvp/i }),
    ).toHaveAttribute("href", "https://rsvp.example/socal");
  });

  it("moves an upcoming listing whose date has passed into the archive", () => {
    mockState.upcoming = [
      makeEvent({ id: "u1", title: "Still Coming", date: "2026-10-24" }),
      makeEvent({
        id: "lapsed",
        source_event_id: "evt-2",
        title: "Already Happened",
        date: "2026-09-12",
      }),
    ];
    renderPage();
    const upcoming = document.querySelector("#upcoming") as HTMLElement;
    const archive = document.querySelector("#archive") as HTMLElement;
    expect(within(upcoming).getByText("Still Coming")).toBeInTheDocument();
    expect(
      within(upcoming).queryByText("Already Happened"),
    ).not.toBeInTheDocument();
    // The archive groups by academic year; 2026-09 falls in 2026–27.
    expect(within(archive).getByRole("button", { name: /2026–27/ })).toBeInTheDocument();
  });

  it("puts the archive in a compact year-grouped list, not the main flow of cards", () => {
    renderPage();
    const archive = document.querySelector("#archive") as HTMLElement;
    expect(
      within(archive).getByRole("button", { name: /2025–26/ }),
    ).toBeInTheDocument();
    expect(within(archive).getByText("Archived Showcase")).toBeInTheDocument();
    expect(archive.querySelectorAll("article")).toHaveLength(0);
  });

  it('consolidates attending and points into "Your First External" with five steps', () => {
    renderPage();
    const guide = document.querySelector("#first-external") as HTMLElement;
    expect(
      within(guide).getByRole("heading", { name: "Your First External" }),
    ).toBeInTheDocument();
    expect(
      within(guide).getAllByRole("listitem").length,
    ).toBeGreaterThanOrEqual(5);
    expect(within(guide).getByText(/4 Points/)).toBeInTheDocument();
    expect(
      within(guide).getByText(/Wild N Culture earns 5 points/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("How to Attend Your First External"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("External Points Explainer"),
    ).not.toBeInTheDocument();
  });

  it("shows skeletons rather than empty states while loading", () => {
    mockState.loading = true;
    mockState.schools = [];
    mockState.upcoming = [];
    mockState.past = [];
    const { container } = renderPage();
    expect(
      container.querySelectorAll(".skeleton-shimmer").length,
    ).toBeGreaterThan(5);
    expect(
      screen.queryByText(DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.empty_state_title),
    ).not.toBeInTheDocument();
  });

  describe("when an external events query fails", () => {
    it("shows an error panel, not the empty or summer state, when upcoming fails", () => {
      mockState.upcoming = [];
      mockState.forceSummer = true;
      mockState.errors = { upcoming: SCHEMA_ERROR };
      renderPage();

      const upcoming = document.querySelector("#upcoming") as HTMLElement;
      expect(
        within(upcoming).getByRole("heading", {
          name: DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.upcoming_heading,
        }),
      ).toBeInTheDocument();
      expect(within(upcoming).getByRole("alert")).toHaveTextContent(
        /couldn't load right now/i,
      );
      expect(
        within(upcoming).getByRole("link", { name: /instagram/i }),
      ).toHaveAttribute("href", expect.stringContaining("instagram.com"));
      expect(
        screen.queryByText(
          DEFAULT_UVSA_NETWORK_PAGE_SETTINGS.empty_state_title,
        ),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Summer break/i)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Externals will return next school term/i),
      ).not.toBeInTheDocument();
    });

    it("keeps showing upcoming events react-query already holds when a refetch fails", () => {
      mockState.errors = { upcoming: SCHEMA_ERROR };
      renderPage();

      const upcoming = document.querySelector("#upcoming") as HTMLElement;
      expect(
        within(upcoming).getByRole("heading", { name: "Upcoming Pageant" }),
      ).toBeInTheDocument();
      expect(within(upcoming).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("keeps the hero and schools and shows no whole-page degraded banner", () => {
      mockState.upcoming = [];
      mockState.errors = { upcoming: SCHEMA_ERROR };
      renderPage();

      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(document.querySelector("#schools")).toBeInTheDocument();
      expect(
        screen.queryByText("External info temporarily unavailable"),
      ).not.toBeInTheDocument();
    });

    it.each(["past", "historical"] as const)(
      "shows an archive notice instead of a silent archive when %s fails",
      (status) => {
        mockState.past = [];
        mockState.historical = [];
        mockState.errors = { [status]: SCHEMA_ERROR };
        renderPage();

        const archive = document.querySelector("#archive") as HTMLElement;
        expect(archive).toBeInTheDocument();
        expect(within(archive).getByRole("status")).toHaveTextContent(
          /couldn't load right now/i,
        );
        // Upcoming is unaffected.
        const upcoming = document.querySelector("#upcoming") as HTMLElement;
        expect(within(upcoming).queryByRole("alert")).not.toBeInTheDocument();
        expect(
          within(upcoming).getByText("Upcoming Pageant"),
        ).toBeInTheDocument();
      },
    );

    it("keeps the genuinely empty archive hidden when nothing failed", () => {
      mockState.past = [];
      mockState.historical = [];
      renderPage();
      expect(document.querySelector("#archive")).not.toBeInTheDocument();
    });

    it("still shows the existing whole-page degraded state for an outage error", () => {
      mockState.errors = { upcoming: { status: 503, message: "unavailable" } };
      renderPage();

      expect(
        screen.getByText("External info temporarily unavailable"),
      ).toBeInTheDocument();
      expect(document.querySelector("#upcoming")).not.toBeInTheDocument();
    });
  });
});
