/* eslint-disable testing-library/no-container, testing-library/no-node-access -- structural assertions (anchors, shimmer, section order) have no accessible role */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { makeSchool, OWN_LOGO_URL } from "../../../test-utils/uvsaFixtures";
import { SchoolCard } from "./SchoolCard";

describe("SchoolCard", () => {
  it("leads with logo, short name, VSA name, city and system badge", () => {
    render(
      <SchoolCard
        school={makeSchool({
          slug: "uci",
          short_name: "UCI",
          vsa_name: "VSA at UCI",
          city: "Irvine",
          logo_url: OWN_LOGO_URL,
        })}
      />,
    );

    expect(
      within(
        screen.getByRole("link", { name: "Open UCI VSA on Instagram" }),
      ).getByRole("presentation", { hidden: true }),
    ).toHaveAttribute("src", OWN_LOGO_URL);
    expect(screen.getByRole("heading", { name: "UCI" })).toBeInTheDocument();
    expect(screen.getByText("VSA at UCI")).toBeInTheDocument();
    expect(screen.getByText("UC")).toBeInTheDocument();
  });

  it("renders the city exactly once", () => {
    render(<SchoolCard school={makeSchool({ city: "La Jolla" })} />);
    expect(screen.getAllByText("La Jolla")).toHaveLength(1);
  });

  it("offers Instagram as the one primary social action, labelled with the @handle", () => {
    render(
      <SchoolCard school={makeSchool({ slug: "uci", short_name: "UCI" })} />,
    );
    const link = screen.getByRole("link", { name: "UCI on Instagram" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.instagram.com/vsaatucsd/",
    );
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveTextContent("@vsaatucsd");
  });

  it("makes the PFP link to Instagram too, and nothing else on the base card does", () => {
    render(
      <SchoolCard school={makeSchool({ slug: "uci", short_name: "UCI" })} />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    links.forEach((link) => {
      expect(link).toHaveAttribute(
        "href",
        "https://www.instagram.com/vsaatucsd/",
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
    expect(
      screen.getByRole("link", { name: "Open UCI VSA on Instagram" }),
    ).toBeInTheDocument();
  });

  it("does not make the whole card a link, so Details still works", () => {
    render(<SchoolCard school={makeSchool()} />);
    const card = screen.getByRole("article");
    expect(card.closest("a")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /details/i }));
    expect(screen.getByText("Home of Wild N Culture.")).toBeInTheDocument();
  });

  it("has no interactive element nested inside another", () => {
    render(
      <SchoolCard
        school={makeSchool({ tiktok_url: "https://tiktok.com/@x" })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /details/i }));
    const interactive = "a, button, input, select, textarea";
    document.querySelectorAll(interactive).forEach((el) => {
      expect(el.querySelector(interactive)).toBeNull();
    });
  });

  it("falls back to the plain label when the Instagram URL is not a profile link", () => {
    render(
      <SchoolCard
        school={makeSchool({
          instagram_url: "https://www.instagram.com/p/abc123/",
        })}
      />,
    );
    expect(
      screen.getByRole("link", { name: "UCSD on Instagram" }),
    ).toHaveTextContent(/^\s*Instagram\s*$/);
  });

  it("keeps the PFP non-interactive when there is no Instagram URL", () => {
    render(<SchoolCard school={makeSchool({ instagram_url: null })} />);
    expect(
      screen.queryByRole("link", { name: /on Instagram/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "UCSD logo placeholder" }),
    ).toBeInTheDocument();
  });

  it("does not render a row of secondary social buttons on the base card", () => {
    render(
      <SchoolCard
        school={makeSchool({
          tiktok_url: "https://tiktok.com/@x",
          youtube_url: "https://youtube.com/@x",
        })}
      />,
    );
    for (const label of [
      /linktree/i,
      /website/i,
      /facebook/i,
      /youtube/i,
      /tiktok/i,
    ]) {
      expect(
        screen.queryByRole("link", { name: label }),
      ).not.toBeInTheDocument();
    }
  });

  it("keeps description, tags, recurring events and other links behind a details toggle", () => {
    render(
      <SchoolCard
        school={makeSchool({ tiktok_url: "https://tiktok.com/@x" })}
      />,
    );
    const toggle = screen.getByRole("button", { name: /details/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText("Home of Wild N Culture."),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName(/hide details/i);
    const panel = document.getElementById(
      toggle.getAttribute("aria-controls") as string,
    ) as HTMLElement;
    expect(
      within(panel).getByText("Home of Wild N Culture."),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Wild N Culture")).toBeInTheDocument();
    expect(within(panel).getByText("GBMs")).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: /linktree/i }),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: /tiktok/i }),
    ).toBeInTheDocument();
    // Instagram is the primary action, so it is not repeated in the panel.
    expect(
      within(panel).queryByRole("link", { name: /instagram/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(
      screen.queryByText("Home of Wild N Culture."),
    ).not.toBeInTheDocument();
  });

  it("gives UCSD a Home Base treatment and no other school", () => {
    const { rerender } = render(
      <SchoolCard school={makeSchool({ slug: "ucsd" })} />,
    );
    expect(screen.getByText("Home Base")).toBeInTheDocument();

    rerender(
      <SchoolCard school={makeSchool({ slug: "uci", short_name: "UCI" })} />,
    );
    expect(screen.queryByText("Home Base")).not.toBeInTheDocument();
  });

  it("falls back to clickable initials without a logo", () => {
    render(<SchoolCard school={makeSchool({ logo_url: null })} />);
    expect(
      screen.getByRole("link", { name: "Open UCSD VSA on Instagram" }),
    ).toHaveTextContent("UCSD");
  });

  it("falls back to Linktree as the primary action when there is no Instagram", () => {
    render(<SchoolCard school={makeSchool({ instagram_url: null })} />);
    expect(
      screen.getByRole("link", { name: "UCSD on Linktree" }),
    ).toBeInTheDocument();
  });

  it("omits the details toggle and primary action when there is nothing to show", () => {
    render(
      <SchoolCard
        school={makeSchool({
          instagram_url: null,
          linktree_url: null,
          website_url: null,
          facebook_url: null,
          description: null,
          known_for: [],
          recurring_events: [],
        })}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /details/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
