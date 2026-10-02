/* eslint-disable testing-library/no-container, testing-library/no-node-access -- structural assertions (article landmark, flyer state) have no accessible role */
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  makeEvent,
  makeSchool,
  OWN_LOGO_URL,
} from "../../../test-utils/uvsaFixtures";
import { ExternalEvent } from "../../../types";
import { ExternalEventCard } from "./ExternalEventCard";
import { FeaturedExternal } from "./FeaturedExternal";
import { UpcomingExternals } from "./UpcomingExternals";

const THUMB = "https://cdn.example/events/tet-thumb.webp";
const FULL = "https://cdn.example/events/tet-full.webp";
const OWN = "https://cdn.example/externals/own-flyer.webp";

const linked = (overrides: Partial<ExternalEvent> = {}) =>
  makeEvent({
    source_event_id: "evt-1",
    title: "Tet Festival",
    source_event: {
      id: "evt-1",
      name: "Tet Festival",
      start_time: "18:00:00",
      end_time: null,
      thumbnail_url: THUMB,
      image_url: FULL,
    },
    ...overrides,
  });

describe("ExternalEventCard flyer", () => {
  it("shows the linked event's thumbnail first, lazily, with a described alt", () => {
    render(<ExternalEventCard event={linked()} />);
    const flyer = screen.getByRole("img", { name: "Tet Festival flyer" });
    expect(flyer).toHaveAttribute("src", THUMB);
    expect(flyer).toHaveAttribute("loading", "lazy");
  });

  it("falls back to the linked event's full image when the thumbnail fails", () => {
    render(<ExternalEventCard event={linked()} />);
    fireEvent.error(screen.getByRole("img", { name: "Tet Festival flyer" }));
    expect(
      screen.getByRole("img", { name: "Tet Festival flyer" }),
    ).toHaveAttribute("src", FULL);
  });

  it("uses the full image directly when the linked event has no thumbnail", () => {
    render(
      <ExternalEventCard
        event={linked({
          source_event: { id: "evt-1", name: "Tet Festival", image_url: FULL },
        })}
      />,
    );
    expect(
      screen.getByRole("img", { name: "Tet Festival flyer" }),
    ).toHaveAttribute("src", FULL);
  });

  it("shows a standalone external's own flyer", () => {
    render(
      <ExternalEventCard
        event={makeEvent({ title: "Standalone Night", image_url: OWN })}
      />,
    );
    expect(
      screen.getByRole("img", { name: "Standalone Night flyer" }),
    ).toHaveAttribute("src", OWN);
  });

  it("prefers the linked event's image over the listing's own", () => {
    render(<ExternalEventCard event={linked({ image_url: OWN })} />);
    expect(
      screen.getByRole("img", { name: "Tet Festival flyer" }),
    ).toHaveAttribute("src", THUMB);
  });

  it("renders a date tile, not a broken image, when there is no flyer", () => {
    const { container } = render(
      <ExternalEventCard event={makeEvent({ title: "Plain Night" })} />,
    );
    expect(
      screen.queryByRole("img", { name: /flyer/i }),
    ).not.toBeInTheDocument();
    const tile = container.querySelector('[data-flyer-status="fallback"]');
    expect(tile).toHaveTextContent("NOV");
    expect(tile).toHaveTextContent("14");
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByRole("heading", { name: "Plain Night" }),
    ).toBeInTheDocument();
  });

  it("falls back to the date tile once every flyer candidate has failed", () => {
    const { container } = render(<ExternalEventCard event={linked()} />);
    fireEvent.error(screen.getByRole("img", { name: "Tet Festival flyer" }));
    fireEvent.error(screen.getByRole("img", { name: "Tet Festival flyer" }));
    expect(
      screen.queryByRole("img", { name: /flyer/i }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-flyer-status="fallback"]'),
    ).toBeInTheDocument();
  });

  it("never uses the host school's logo as the flyer", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          uvsa_school: makeSchool({
            slug: "uci",
            short_name: "UCI",
            logo_url: OWN_LOGO_URL,
            image_url: "https://cdn.example/school-photo.webp",
          }),
        })}
      />,
    );
    expect(
      screen.queryByRole("img", { name: /flyer/i }),
    ).not.toBeInTheDocument();
    // The logo still appears, as the host mark.
    expect(screen.getByAltText("UCI logo")).toHaveAttribute(
      "src",
      OWN_LOGO_URL,
    );
  });
});

describe("ExternalEventCard details", () => {
  it("shows date and time, location and points", () => {
    render(<ExternalEventCard event={linked()} />);
    expect(screen.getByText("Sat, Nov 14 · 6 PM")).toBeInTheDocument();
    expect(screen.getByText("Irvine, CA")).toBeInTheDocument();
    expect(screen.getByText("+4 pts")).toBeInTheDocument();
  });

  it("hides points when the event has none", () => {
    render(<ExternalEventCard event={makeEvent({ points: 0 })} />);
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });

  it("names the host school next to its logo", () => {
    render(<ExternalEventCard event={makeEvent()} />);
    expect(screen.getByText("VSA at UCI")).toBeInTheDocument();
  });

  it("shows UVSA SoCal without forcing a school host", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          host_type: "uvsa_socal",
          uvsa_school_id: null,
          uvsa_school: undefined,
        })}
      />,
    );
    expect(screen.getByText("UVSA SoCal")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "UVSA logo placeholder" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/SoCal VSA logo/)).not.toBeInTheDocument();
  });

  it("opens the school's Instagram from its logo", () => {
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
});

describe("ExternalEventCard links", () => {
  it("renders only the links that exist, RSVP first", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          rsvp_url: null,
          host_info_url: "https://example.com/info",
          ride_form_url: "https://forms.example/ride",
        })}
      />,
    );
    const links = within(screen.getByRole("article")).getAllByRole("link");
    const names = links.map(
      (link) => link.getAttribute("aria-label") ?? link.textContent?.trim(),
    );
    expect(names).toEqual(["UCI on Instagram", "Event Info", "UCSD Ride Form"]);
    expect(
      screen.queryByRole("link", { name: /rsvp/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /instagram post/i }),
    ).not.toBeInTheDocument();
  });

  it("orders all four links RSVP, Event Info, Instagram Post, Ride Form", () => {
    render(
      <ExternalEventCard
        event={makeEvent({
          host_info_url: "https://example.com/info",
          instagram_url: "https://instagram.com/p/1",
          ride_form_url: "https://forms.example/ride",
        })}
      />,
    );
    // The host logo link carries an aria-label; the CTA links are named by text.
    const labels = screen
      .getAllByRole("link")
      .filter((link) => !link.hasAttribute("aria-label"))
      .map((link) => link.textContent?.trim());
    expect(labels).toEqual([
      "RSVP / Tickets",
      "Event Info",
      "Instagram Post",
      "UCSD Ride Form",
    ]);
  });

  it("renders no action row at all when the event has no links", () => {
    render(<ExternalEventCard event={makeEvent({ rsvp_url: null })} />);
    // Only the host logo link remains.
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("opens outbound links safely in a new tab", () => {
    render(<ExternalEventCard event={makeEvent()} />);
    expect(screen.getByRole("link", { name: /rsvp/i })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });
});

describe("responsive card structure", () => {
  it("is a labelled article whose heading names the event", () => {
    render(
      <ExternalEventCard event={makeEvent({ title: "Accessible Night" })} />,
    );
    const article = screen.getByRole("article", { name: "Accessible Night" });
    expect(
      within(article).getByRole("heading", {
        level: 3,
        name: "Accessible Night",
      }),
    ).toBeInTheDocument();
  });

  it("gives phone-sized tap targets to the action buttons", () => {
    render(<ExternalEventCard event={makeEvent()} />);
    expect(screen.getByRole("link", { name: /rsvp/i }).className).toContain(
      "min-h-[44px]",
    );
  });

  it("lays cards out one per row on phones and two to three on wider screens", () => {
    const { container } = render(
      <UpcomingExternals
        heading="Upcoming Externals"
        loading={false}
        emptyTitle="Nothing yet"
        emptyMessage="Soon"
        events={[makeEvent({ id: "a" }), makeEvent({ id: "b" })]}
      />,
    );
    const grid = container.querySelector("article")!.parentElement!;
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
    expect(grid.className).toContain("lg:grid-cols-3");
  });
});

describe("FeaturedExternal", () => {
  it("is flyer-forward and shares the card's host, facts and links", () => {
    render(<FeaturedExternal event={linked({ is_featured: true })} />);
    const article = screen.getByRole("article", { name: "Tet Festival" });
    expect(
      within(article).getByRole("img", { name: "Tet Festival flyer" }),
    ).toHaveAttribute("src", THUMB);
    expect(within(article).getByText("Featured External")).toBeInTheDocument();
    expect(within(article).getByText("VSA at UCI")).toBeInTheDocument();
    expect(within(article).getByText("Sat, Nov 14 · 6 PM")).toBeInTheDocument();
    expect(
      within(article).getByRole("link", { name: /rsvp \/ tickets/i }),
    ).toBeInTheDocument();
  });
});
