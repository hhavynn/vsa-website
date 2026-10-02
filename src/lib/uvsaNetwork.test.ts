import { makeEvent, makeSchool } from "../test-utils/uvsaFixtures";
import {
  countSchoolsBySystem,
  filterSchoolsBySystem,
  formatAcademicYear,
  getAcademicYearStart,
  groupArchiveByAcademicYear,
  isHomeBaseSchool,
  pickFeaturedUpcomingEvent,
} from "./uvsaNetwork";

const schools = [
  makeSchool({ id: "1", slug: "ucsd", system_type: "UC" }),
  makeSchool({ id: "2", slug: "uci", system_type: "UC" }),
  makeSchool({ id: "3", slug: "csuf", system_type: "CSU" }),
  makeSchool({ id: "4", slug: "usc", system_type: "Private" }),
];

describe("school filtering", () => {
  it("returns everything for All", () => {
    expect(filterSchoolsBySystem(schools, "All")).toHaveLength(4);
  });

  it.each([
    ["UC", ["ucsd", "uci"]],
    ["CSU", ["csuf"]],
    ["Private", ["usc"]],
  ] as const)("filters %s", (filter, slugs) => {
    expect(filterSchoolsBySystem(schools, filter).map((s) => s.slug)).toEqual(
      slugs,
    );
  });

  it("counts each system type", () => {
    expect(countSchoolsBySystem(schools)).toEqual({
      All: 4,
      UC: 2,
      CSU: 1,
      Private: 1,
    });
  });

  it("treats UCSD as the home base", () => {
    expect(isHomeBaseSchool({ slug: "ucsd" })).toBe(true);
    expect(isHomeBaseSchool({ slug: "uci" })).toBe(false);
  });
});

describe("pickFeaturedUpcomingEvent", () => {
  it("returns nothing when no upcoming event is featured", () => {
    expect(
      pickFeaturedUpcomingEvent([makeEvent({ is_featured: false })]),
    ).toBeUndefined();
  });

  it("never promotes an archived event, even if it is flagged featured", () => {
    expect(
      pickFeaturedUpcomingEvent([
        makeEvent({ status: "past", is_featured: true }),
      ]),
    ).toBeUndefined();
    expect(
      pickFeaturedUpcomingEvent([
        makeEvent({ status: "historical", is_featured: true }),
      ]),
    ).toBeUndefined();
  });

  it("picks the soonest featured upcoming event", () => {
    const later = makeEvent({
      id: "later",
      is_featured: true,
      date: "2026-12-01",
    });
    const sooner = makeEvent({
      id: "sooner",
      is_featured: true,
      date: "2026-11-01",
    });
    expect(pickFeaturedUpcomingEvent([later, sooner])?.id).toBe("sooner");
  });
});

describe("academic years", () => {
  it("starts the year in August", () => {
    expect(getAcademicYearStart("2025-09-20")).toBe(2025);
    expect(getAcademicYearStart("2026-03-10")).toBe(2025);
    expect(getAcademicYearStart("2026-08-01")).toBe(2026);
    expect(getAcademicYearStart("2026-07-31")).toBe(2025);
    expect(getAcademicYearStart(null)).toBeNull();
  });

  it("formats the label", () => {
    expect(formatAcademicYear(2025)).toBe("2025–26");
    expect(formatAcademicYear(2099)).toBe("2099–00");
  });
});

describe("groupArchiveByAcademicYear", () => {
  const events = [
    makeEvent({ id: "old", date: "2024-11-02" }),
    makeEvent({ id: "new-mar", date: "2026-03-01" }),
    makeEvent({ id: "new-oct", date: "2025-10-05" }),
    makeEvent({ id: "undated", date: null }),
    makeEvent({
      id: "wnc",
      date: "2026-05-01",
      uvsa_school: makeSchool({ slug: "ucsd" }),
    }),
    makeEvent({
      id: "other-may",
      date: "2026-05-20",
      uvsa_school: makeSchool({ id: "x", slug: "uci" }),
    }),
  ];

  const groups = groupArchiveByAcademicYear(events);

  it("orders years newest first with undated last", () => {
    expect(groups.map((g) => g.label)).toEqual([
      "2025–26",
      "2024–25",
      "Earlier highlights",
    ]);
  });

  it("puts UCSD-hosted events first within a year, then newest first", () => {
    expect(groups[0].events.map((e) => e.id)).toEqual([
      "wnc",
      "other-may",
      "new-mar",
      "new-oct",
    ]);
  });

  it("returns no groups for no events", () => {
    expect(groupArchiveByAcademicYear([])).toEqual([]);
  });
});
