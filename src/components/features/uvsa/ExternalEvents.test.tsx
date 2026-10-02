/* eslint-disable testing-library/no-container, testing-library/no-node-access -- structural assertions (anchors, shimmer, section order) have no accessible role */
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  makeEvent,
  makeSchool,
  OWN_LOGO_URL,
} from "../../../test-utils/uvsaFixtures";
import { ExternalEventCard } from "./ExternalEventCard";
import { ExternalArchive } from "./ExternalArchive";
import { UpcomingExternals } from "./UpcomingExternals";

const withLogo = (slug: string, short_name: string) =>
  makeSchool({
    id: `id-${slug}`,
    slug,
    short_name,
    vsa_name: `VSA at ${short_name}`,
    logo_url: OWN_LOGO_URL.replace("ucsd", slug),
  });

describe("ExternalEventCard host logo", () => {
  it("uses the host school's logo_url", () => {
    render(
      <ExternalEventCard
        event={makeEvent({ uvsa_school: withLogo("uci", "UCI") })}
      />,
    );
    expect(screen.getByAltText("UCI logo")).toHaveAttribute(
      "src",
      expect.stringContaining("/uci/"),
    );
    expect(screen.getByText("VSA at UCI")).toBeInTheDocument();
  });

  it("falls back to host initials when the host has no logo", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          uvsa_school: makeSchool({
            slug: "uci",
            short_name: "UCI",
            logo_url: null,
          }),
        })}
      />,
    );
    expect(
      screen.getByRole("img", { name: "UCI logo placeholder" }),
    ).toBeInTheDocument();
  });

  it("still renders when the host school did not join", () => {
    render(
      <ExternalEventCard
        event={makeEvent({ uvsa_school: undefined, uvsa_school_id: null })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Sample External" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "SoCal VSA logo placeholder" }),
    ).toBeInTheDocument();
  });

  it("marks UCSD-hosted events and shows special points", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          points: 5,
          uvsa_school: makeSchool({ slug: "ucsd" }),
        })}
      />,
    );
    expect(screen.getByText("Hosted by VSA at UCSD")).toBeInTheDocument();
    expect(screen.getByText("+5 pts")).toBeInTheDocument();
  });

  it("offers RSVP / info / Instagram post as real links and keeps host links on the logo", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          host_info_url: "https://example.com/info",
          instagram_url: "https://instagram.com/p/1",
          uvsa_school: makeSchool({
            slug: "uci",
            linktree_url: "https://linktr.ee/uci",
          }),
        })}
      />,
    );
    expect(screen.getByText("Sat, Nov 14")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /rsvp \/ tickets/i }),
    ).toHaveAttribute("href", "https://example.com/rsvp");
    expect(screen.getByRole("link", { name: /event info/i })).toHaveAttribute(
      "href",
      "https://example.com/info",
    );
    expect(
      screen.getByRole("link", { name: /instagram post/i }),
    ).toHaveAttribute("href", "https://instagram.com/p/1");
    // The host's own links are not extra buttons in the CTA row.
    expect(
      screen.queryByRole("link", { name: /linktree/i }),
    ).not.toBeInTheDocument();
  });
});

describe("ExternalEventCard hosts", () => {
  it("shows a UVSA SoCal-hosted event with the UVSA identity and no school", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          host_type: "uvsa_socal",
          uvsa_school_id: null,
          uvsa_school: undefined,
          title: "UVSA SoCal Fall Social",
        })}
      />,
    );
    expect(screen.getByText("UVSA SoCal")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "UVSA logo placeholder" }),
    ).toBeInTheDocument();
    // The mark opens the configured UVSA SoCal Instagram, like a school PFP would.
    expect(
      screen.getByRole("link", { name: "UVSA SoCal on Instagram" }),
    ).toHaveAttribute("href", "https://www.instagram.com/uvsasocal/");
  });

  it("opens the host school's Instagram from its logo", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          uvsa_school: makeSchool({
            slug: "uci",
            short_name: "UCI",
            instagram_url: "https://www.instagram.com/vsauci/",
          }),
        })}
      />,
    );
    expect(
      screen.getByRole("link", { name: "UCI on Instagram" }),
    ).toHaveAttribute("href", "https://www.instagram.com/vsauci/");
  });

  it("renders the ride form and ride info only when they exist", () => {
    const { rerender } = render(<ExternalEventCard event={makeEvent()} />);
    expect(
      screen.queryByRole("link", { name: /ride form/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Rides:/)).not.toBeInTheDocument();

    rerender(
      <ExternalEventCard
        event={makeEvent({
          ride_form_url: "https://forms.example/ride",
          ride_info: "Meet at Gilman parking structure at 5:30 PM.",
        })}
      />,
    );
    expect(
      screen.getByRole("link", { name: /UCSD Ride Form/ }),
    ).toHaveAttribute("href", "https://forms.example/ride");
    expect(
      screen.getByText(/Meet at Gilman parking structure/),
    ).toBeInTheDocument();
  });
});

describe("UpcomingExternals", () => {
  const base = {
    heading: "Upcoming Externals",
    loading: false,
    emptyTitle: "Nothing yet",
    emptyMessage: "Check back soon",
  };

  it("renders the large spotlight only when a featured event is passed", () => {
    const featured = makeEvent({
      id: "f",
      title: "Big Night",
      is_featured: true,
    });
    const other = makeEvent({ id: "o", title: "Smaller Night" });
    const { rerender } = render(
      <UpcomingExternals
        {...base}
        events={[featured, other]}
        featured={featured}
      />,
    );

    expect(screen.getByText("Featured External")).toBeInTheDocument();
    // The featured event is promoted, not duplicated in the grid.
    expect(screen.getAllByRole("heading", { name: "Big Night" })).toHaveLength(
      1,
    );
    expect(
      screen.getByRole("heading", { name: "Smaller Night" }),
    ).toBeInTheDocument();

    rerender(<UpcomingExternals {...base} events={[featured, other]} />);
    expect(screen.queryByText("Featured External")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Big Night" }),
    ).toBeInTheDocument();
  });

  it("shows the admin-driven empty state when there are no upcoming events", () => {
    render(<UpcomingExternals {...base} events={[]} />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.queryByText("Featured External")).not.toBeInTheDocument();
  });

  it("shows the summer copy when provided", () => {
    render(
      <UpcomingExternals
        {...base}
        events={[]}
        summerEmpty={{
          badge: "Summer break",
          title: "Back in fall",
          body: "See you then",
        }}
      />,
    );
    expect(screen.getByText("Back in fall")).toBeInTheDocument();
    expect(screen.queryByText("Nothing yet")).not.toBeInTheDocument();
  });

  it("shows an error panel instead of the empty or summer state when errored", () => {
    render(
      <UpcomingExternals
        {...base}
        events={[]}
        error
        summerEmpty={{
          badge: "Summer break",
          title: "Back in fall",
          body: "See you then",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Upcoming externals couldn't load right now.",
    );
    expect(
      screen.getByRole("heading", { name: "Upcoming Externals" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /instagram/i })).toHaveAttribute(
      "href",
      expect.stringContaining("instagram.com"),
    );
    expect(screen.queryByText("Nothing yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Back in fall")).not.toBeInTheDocument();
  });

  it("does not show the error panel while still loading", () => {
    render(<UpcomingExternals {...base} events={[]} loading error />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders skeletons while loading", () => {
    const { container } = render(
      <UpcomingExternals {...base} events={[]} loading />,
    );
    expect(container.querySelectorAll(".skeleton-shimmer")).toHaveLength(3);
    expect(screen.queryByText("Nothing yet")).not.toBeInTheDocument();
  });
});

describe("ExternalArchive", () => {
  const events = [
    makeEvent({
      id: "a",
      title: "Fall Show",
      date: "2025-10-04",
      status: "past",
      uvsa_school: withLogo("uci", "UCI"),
      rsvp_url: null,
      host_info_url: "https://example.com/a",
    }),
    makeEvent({
      id: "b",
      title: "Spring Gala",
      date: "2026-04-11",
      status: "past",
      uvsa_school: withLogo("usc", "USC"),
      rsvp_url: null,
    }),
    makeEvent({
      id: "c",
      title: "Old Classic",
      date: "2024-11-09",
      status: "historical",
      uvsa_school: withLogo("sdsu", "SDSU"),
      rsvp_url: null,
    }),
  ];
  const props = {
    heading: "2025-2026 External Showcase",
    description: "Looking back.",
    loading: false,
  };

  it("groups by academic year, newest open and older collapsed", () => {
    render(<ExternalArchive {...props} events={events} />);

    expect(screen.getByRole("button", { name: /2025–26/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /2024–25/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByText("Fall Show")).toBeInTheDocument();
    expect(screen.getByText("Spring Gala")).toBeInTheDocument();
    expect(screen.queryByText("Old Classic")).not.toBeInTheDocument();
  });

  it("expands an older year on demand", () => {
    render(<ExternalArchive {...props} events={events} />);
    fireEvent.click(screen.getByRole("button", { name: /2024–25/ }));
    expect(screen.getByText("Old Classic")).toBeInTheDocument();
  });

  it("shows host logos on archive rows and only available links", () => {
    render(<ExternalArchive {...props} events={events} />);
    expect(screen.getByAltText("UCI logo")).toBeInTheDocument();
    const row = screen.getByText("Fall Show").closest("li") as HTMLElement;
    expect(
      within(row).getByRole("link", { name: "Info for Fall Show" }),
    ).toHaveAttribute("href", "https://example.com/a");
    expect(
      within(row).queryByRole("link", { name: /IG Post/ }),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when there is no archive", () => {
    const { container } = render(<ExternalArchive {...props} events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a notice, not nothing, when the archive failed to load", () => {
    render(<ExternalArchive {...props} events={[]} error />);
    expect(
      screen.getByRole("heading", { name: props.heading }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /couldn't load right now/i,
    );
  });

  it("keeps the partial archive visible alongside the notice", () => {
    render(<ExternalArchive {...props} events={events} error />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Fall Show")).toBeInTheDocument();
  });

  it("shows a skeleton while loading", () => {
    const { container } = render(
      <ExternalArchive {...props} events={[]} loading />,
    );
    expect(
      container.querySelectorAll(".skeleton-shimmer").length,
    ).toBeGreaterThan(0);
  });
});
