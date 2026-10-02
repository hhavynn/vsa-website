/* eslint-disable testing-library/no-container, testing-library/no-node-access -- structural assertions (anchors, shimmer, section order) have no accessible role */
import { fireEvent, render, screen } from "@testing-library/react";
import { makeSchool, OWN_LOGO_URL } from "../../../test-utils/uvsaFixtures";
import { SchoolVisualMark } from "./SchoolVisualMark";

describe("SchoolVisualMark", () => {
  it("shows generated initials when the school has no logo", () => {
    render(<SchoolVisualMark school={makeSchool({ logo_url: null })} />);
    expect(
      screen.getByRole("img", { name: "UCSD logo placeholder" }),
    ).toHaveTextContent("UCSD");
    expect(screen.queryByAltText("UCSD logo")).not.toBeInTheDocument();
  });

  it("renders the logo image for a safe URL", () => {
    render(
      <SchoolVisualMark
        school={makeSchool({ logo_url: "https://cdn.example.com/ucsd.png" })}
      />,
    );
    expect(screen.getByAltText("UCSD logo")).toHaveAttribute(
      "src",
      "https://cdn.example.com/ucsd.png",
    );
  });

  it("accepts a logo from the site's own Supabase Storage bucket", () => {
    render(
      <SchoolVisualMark school={makeSchool({ logo_url: OWN_LOGO_URL })} />,
    );
    expect(screen.getByAltText("UCSD logo")).toHaveAttribute(
      "src",
      OWN_LOGO_URL,
    );
  });

  it("refuses storage URLs from other projects and falls back to initials", () => {
    render(
      <SchoolVisualMark
        school={makeSchool({
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
      <SchoolVisualMark school={makeSchool({ logo_url: OWN_LOGO_URL })} />,
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
      <SchoolVisualMark school={makeSchool({ logo_url: OWN_LOGO_URL })} />,
    );
    fireEvent.error(screen.getByAltText("UCSD logo"));
    expect(screen.queryByAltText("UCSD logo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "UCSD logo placeholder" }),
    ).toBeInTheDocument();
  });

  it("retries a new URL after a previous one failed", () => {
    const { rerender } = render(
      <SchoolVisualMark school={makeSchool({ logo_url: OWN_LOGO_URL })} />,
    );
    fireEvent.error(screen.getByAltText("UCSD logo"));

    const next = OWN_LOGO_URL.replace("logo-1", "logo-2");
    rerender(<SchoolVisualMark school={makeSchool({ logo_url: next })} />);
    expect(screen.getByAltText("UCSD logo")).toHaveAttribute("src", next);
  });

  it("hides decorative marks from assistive tech", () => {
    const { container } = render(
      <SchoolVisualMark school={makeSchool({ logo_url: null })} decorative />,
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
});
