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
} = { schools: [], upcoming: [], past: [], historical: [], loading: false };

// Pin "today" so fixture dates never drift from upcoming to past as time passes.
jest.mock("../utils/losAngelesDate", () => ({
  ...jest.requireActual("../utils/losAngelesDate"),
  getLosAngelesDateOnly: () => "2026-10-01",
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
    error: null,
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
});

describe("UVSANetwork page", () => {
  it("orders sections: hero → schools → upcoming → first external → archive → info footer", () => {
    const { container } = renderPage();
    const ids = [
      "h1",
      "#schools",
      "#upcoming",
      "#first-external",
      "#archive",
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
});
