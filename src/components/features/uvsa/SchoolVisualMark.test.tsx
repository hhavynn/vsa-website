/* eslint-disable testing-library/no-container, testing-library/no-node-access -- structural assertions (anchors, shimmer, section order) have no accessible role */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { makeSchool, OWN_LOGO_URL } from "../../../test-utils/uvsaFixtures";
import { SchoolVisualMark } from "./SchoolVisualMark";

const plainSchool = (overrides: Parameters<typeof makeSchool>[0] = {}) =>
  makeSchool({ instagram_url: null, ...overrides });

describe("SchoolVisualMark", () => {
  it("shows generated initials when the school has no logo", () => {
    render(<SchoolVisualMark school={plainSchool({ logo_url: null })} />);
    expect(
      screen.getByRole("img", { name: "UCSD logo placeholder" }),
    ).toHaveTextContent("UCSD");
    expect(screen.queryByAltText("UCSD logo")).not.toBeInTheDocument();
  });

  it("renders the logo image for a safe URL", () => {
    render(
      <SchoolVisualMark
        school={plainSchool({ logo_url: "https://cdn.example.com/ucsd.png" })}
      />,
    );
    expect(screen.getByAltText("UCSD logo")).toHaveAttribute(
      "src",
      "https://cdn.example.com/ucsd.png",
    );
  });

  it("accepts a logo from the site's own Supabase Storage bucket", () => {
    render(
      <SchoolVisualMark school={plainSchool({ logo_url: OWN_LOGO_URL })} />,
    );
    expect(screen.getByAltText("UCSD logo")).toHaveAttribute(
      "src",
      OWN_LOGO_URL,
    );
  });

  it("refuses storage URLs from other projects and falls back to initials", () => {
    render(
      <SchoolVisualMark
        school={plainSchool({
          logo_url:
            "https://other.supabase.co/storage/v1/object/public/uvsa_school_assets/x.webp",
        })}
      />,
    );
    expect(screen.queryByAltText("UCSD logo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "UCSD logo placeholder" }),
    ).toBeInTheDocument();
  });

  it("shows a loading shimmer until the image loads, then reveals it", () => {
    const { container } = render(
      <SchoolVisualMark school={plainSchool({ logo_url: OWN_LOGO_URL })} />,
    );
    expect(
      container.querySelector('[data-logo-status="loading"]'),
    ).toBeInTheDocument();
    expect(container.querySelector(".skeleton-shimmer")).toBeInTheDocument();

    fireEvent.load(screen.getByAltText("UCSD logo"));
    expect(
      container.querySelector('[data-logo-status="loaded"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".skeleton-shimmer"),
    ).not.toBeInTheDocument();
  });

  it("falls back to initials when the logo fails to load", () => {
    render(
      <SchoolVisualMark school={plainSchool({ logo_url: OWN_LOGO_URL })} />,
    );
    fireEvent.error(screen.getByAltText("UCSD logo"));
    expect(screen.queryByAltText("UCSD logo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "UCSD logo placeholder" }),
    ).toBeInTheDocument();
  });

  it("retries a new URL after a previous one failed", () => {
    const { rerender } = render(
      <SchoolVisualMark school={plainSchool({ logo_url: OWN_LOGO_URL })} />,
    );
    fireEvent.error(screen.getByAltText("UCSD logo"));

    const next = OWN_LOGO_URL.replace("logo-1", "logo-2");
    rerender(<SchoolVisualMark school={plainSchool({ logo_url: next })} />);
    expect(screen.getByAltText("UCSD logo")).toHaveAttribute("src", next);
  });

  it("hides decorative marks from assistive tech", () => {
    const { container } = render(
      <SchoolVisualMark school={plainSchool({ logo_url: null })} decorative />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("uses the fallback label when there is no school", () => {
    render(<SchoolVisualMark fallbackLabel="Cal Poly" />);
    expect(
      screen.getByRole("img", { name: "Cal Poly logo placeholder" }),
    ).toHaveTextContent("CALPOL");
  });

  describe("Instagram link", () => {
    const withIg = (overrides: Parameters<typeof makeSchool>[0] = {}) =>
      makeSchool({
        instagram_url: "https://www.instagram.com/vsaatucsd/",
        ...overrides,
      });
    const link = () =>
      screen.getByRole("link", { name: "Open UCSD VSA on Instagram" });

    it("renders the logo as a link to the school's instagram_url", () => {
      render(<SchoolVisualMark school={withIg({ logo_url: OWN_LOGO_URL })} />);
      expect(link()).toHaveAttribute(
        "href",
        "https://www.instagram.com/vsaatucsd/",
      );
      expect(
        within(link()).getByRole("presentation", { hidden: true }),
      ).toHaveAttribute("src", OWN_LOGO_URL);
    });

    it("opens in a new tab with safe external-link attributes", () => {
      render(<SchoolVisualMark school={withIg()} />);
      expect(link()).toHaveAttribute("target", "_blank");
      expect(link()).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("is also clickable when it shows generated initials", () => {
      render(<SchoolVisualMark school={withIg({ logo_url: null })} />);
      expect(link()).toHaveTextContent("UCSD");
      expect(link()).toHaveAttribute(
        "href",
        "https://www.instagram.com/vsaatucsd/",
      );
    });

    it("stays clickable after a broken logo falls back to initials", () => {
      render(<SchoolVisualMark school={withIg({ logo_url: OWN_LOGO_URL })} />);
      fireEvent.error(
        within(link()).getByRole("presentation", { hidden: true }),
      );
      expect(link()).toHaveTextContent("UCSD");
    });

    it("renders non-interactively when the school has no Instagram URL", () => {
      render(<SchoolVisualMark school={plainSchool()} />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(
        screen.getByRole("img", { name: "UCSD logo placeholder" }),
      ).toBeInTheDocument();
    });

    it("treats a blank Instagram URL as missing", () => {
      render(
        <SchoolVisualMark school={plainSchool({ instagram_url: "   " })} />,
      );
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("can be switched off for admin previews and nested interactive callers", () => {
      render(<SchoolVisualMark school={withIg()} interactive={false} />);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("never links an unsafe Instagram URL", () => {
      render(
        <SchoolVisualMark
          school={withIg({
            instagram_url: ["java", "script:alert(1)"].join(""),
          })}
        />,
      );
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("has no hover indicator on compact sizes but does on larger ones", () => {
      const { rerender } = render(
        <SchoolVisualMark school={withIg()} size="xs" />,
      );
      expect(link().querySelector("svg")).not.toBeInTheDocument();
      rerender(<SchoolVisualMark school={withIg()} size="card" />);
      expect(link().querySelector("svg")).toBeInTheDocument();
    });

    it("does not nest interactive elements inside the link", () => {
      render(<SchoolVisualMark school={withIg({ logo_url: OWN_LOGO_URL })} />);
      expect(
        link().querySelector("a, button, input, select, textarea"),
      ).toBeNull();
    });
  });
});
