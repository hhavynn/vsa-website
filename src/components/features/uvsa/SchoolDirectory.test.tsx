/* eslint-disable testing-library/no-container, testing-library/no-node-access -- structural assertions (anchors, shimmer, section order) have no accessible role */
import { fireEvent, render, screen } from "@testing-library/react";
import { makeSchool } from "../../../test-utils/uvsaFixtures";
import { SchoolDirectory } from "./SchoolDirectory";

const schools = [
  makeSchool({ id: "1", slug: "ucsd", short_name: "UCSD", system_type: "UC" }),
  makeSchool({ id: "2", slug: "uci", short_name: "UCI", system_type: "UC" }),
  makeSchool({ id: "3", slug: "csuf", short_name: "CSUF", system_type: "CSU" }),
  makeSchool({
    id: "4",
    slug: "usc",
    short_name: "USC",
    system_type: "Private",
  }),
];

const names = () =>
  screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("SchoolDirectory", () => {
  it("shows every school and per-filter counts by default", () => {
    render(
      <SchoolDirectory
        heading="Explore the 4 Schools"
        schools={schools}
        loading={false}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Explore the 4 Schools" }),
    ).toBeInTheDocument();
    expect(names()).toEqual(["UCSD", "UCI", "CSUF", "USC"]);
    expect(screen.getByRole("button", { name: /^All 4$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^UC 2$/ })).toBeInTheDocument();
  });

  it.each([
    ["UC", ["UCSD", "UCI"]],
    ["CSU", ["CSUF"]],
    ["Private", ["USC"]],
  ])("filters to %s and back to All", (label, expected) => {
    render(
      <SchoolDirectory heading="Schools" schools={schools} loading={false} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${label} \\d`) }),
    );
    expect(names()).toEqual(expected);

    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    expect(names()).toHaveLength(4);
  });

  it("hides a filter that has no schools", () => {
    render(
      <SchoolDirectory
        heading="Schools"
        schools={schools.filter((s) => s.system_type !== "Private")}
        loading={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /^Private/ }),
    ).not.toBeInTheDocument();
  });

  it("provides a labeled native mobile school-system filter using the same counts as desktop", () => {
    render(<SchoolDirectory heading="Schools" schools={schools} loading={false} />);
    const picker = screen.getByRole("combobox", { name: "School system" });
    expect(picker).toHaveValue("All");
    expect(picker).toHaveClass("min-h-11", "w-full");
    expect(screen.getByRole("option", { name: "All school systems · 4" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "UC · 2" })).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: "CSU" } });
    expect(names()).toEqual(["CSUF"]);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 school in CSU.");
    expect(screen.getByRole("button", { name: /^CSU 1$/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("recovers to All when an updated list no longer contains the selected system", () => {
    const { rerender } = render(<SchoolDirectory heading="Schools" schools={schools} loading={false} />);
    fireEvent.change(screen.getByRole("combobox", { name: "School system" }), {
      target: { value: "Private" },
    });
    expect(names()).toEqual(["USC"]);

    rerender(
      <SchoolDirectory
        heading="Schools"
        schools={schools.filter((school) => school.system_type !== "Private")}
        loading={false}
      />,
    );
    expect(screen.getByRole("combobox", { name: "School system" })).toHaveValue("All");
    expect(screen.queryByRole("option", { name: /Private/ })).not.toBeInTheDocument();
    expect(names()).toEqual(["UCSD", "UCI", "CSUF"]);
    expect(screen.getByRole("status")).toHaveTextContent("Showing 3 schools across all systems.");
  });

  it("renders a skeleton, not cards or filters, while loading", () => {
    const { container } = render(
      <SchoolDirectory heading="Schools" schools={[]} loading />,
    );
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      container.querySelectorAll(".skeleton-shimmer").length,
    ).toBeGreaterThan(0);
  });

  it("has the #schools anchor the hero links to", () => {
    const { container } = render(
      <SchoolDirectory heading="Schools" schools={schools} loading={false} />,
    );
    expect(container.querySelector("section#schools")).toBeInTheDocument();
  });
});
