import { makeEvent } from "../test-utils/uvsaFixtures";
import {
  formatExternalWhen,
  getExternalDateTile,
  getExternalFlyerCandidates,
  getSafeFlyerUrl,
  isHttpsFlyerUrl,
} from "./externalEventDisplay";

const source = (overrides = {}) => ({
  id: "evt-1",
  name: "Tet Festival",
  ...overrides,
});

describe("getSafeFlyerUrl", () => {
  it("accepts https and root-relative static assets", () => {
    expect(getSafeFlyerUrl("https://cdn.example/flyer.webp")).toBe(
      "https://cdn.example/flyer.webp",
    );
    expect(getSafeFlyerUrl("/images/events/tet.webp")).toBe(
      "/images/events/tet.webp",
    );
  });

  it("rejects empty, insecure, protocol-relative and script URLs", () => {
    for (const bad of [
      "",
      "   ",
      null,
      undefined,
      "http://example.com/a.png",
      "//example.com/a.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
    ]) {
      expect(getSafeFlyerUrl(bad)).toBeNull();
    }
  });
});

describe("isHttpsFlyerUrl", () => {
  it("accepts only a parseable https URL", () => {
    expect(isHttpsFlyerUrl("https://cdn.example/flyer.webp")).toBe(true);
    expect(isHttpsFlyerUrl("  https://cdn.example/flyer.webp  ")).toBe(true);
  });

  it("rejects site-relative, protocol-relative, insecure, script and junk values", () => {
    for (const bad of [
      "/images/x.webp",
      "//host/x",
      "http://example.com/x.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
      "",
      "   ",
      null,
      undefined,
    ]) {
      expect(isHttpsFlyerUrl(bad)).toBe(false);
    }
  });
});

describe("getExternalFlyerCandidates", () => {
  it("prefers the linked event's thumbnail, then its full image, then the listing's own", () => {
    const event = makeEvent({
      image_url: "https://cdn.example/own.webp",
      source_event: source({
        thumbnail_url: "https://cdn.example/thumb.webp",
        image_url: "https://cdn.example/full.webp",
      }),
    });
    expect(getExternalFlyerCandidates(event)).toEqual([
      "https://cdn.example/thumb.webp",
      "https://cdn.example/full.webp",
      "https://cdn.example/own.webp",
    ]);
  });

  it("falls back to the full image when the linked event has no thumbnail", () => {
    const event = makeEvent({
      source_event: source({ image_url: "https://cdn.example/full.webp" }),
    });
    expect(getExternalFlyerCandidates(event)).toEqual([
      "https://cdn.example/full.webp",
    ]);
  });

  it("uses the listing's own image for a standalone external", () => {
    const event = makeEvent({ image_url: "https://cdn.example/own.webp" });
    expect(getExternalFlyerCandidates(event)).toEqual([
      "https://cdn.example/own.webp",
    ]);
  });

  it("never uses the school logo or school photo as a flyer", () => {
    const event = makeEvent();
    event.uvsa_school!.logo_url = "https://cdn.example/logo.webp";
    event.uvsa_school!.image_url = "https://cdn.example/school.webp";
    expect(getExternalFlyerCandidates(event)).toEqual([]);
  });

  it("drops unsafe URLs and duplicates", () => {
    const event = makeEvent({
      image_url: "https://cdn.example/same.webp",
      source_event: source({
        thumbnail_url: "http://insecure.example/a.webp",
        image_url: "https://cdn.example/same.webp",
      }),
    });
    expect(getExternalFlyerCandidates(event)).toEqual([
      "https://cdn.example/same.webp",
    ]);
  });
});

describe("formatExternalWhen", () => {
  it("shows only the day when the listing has no linked event time", () => {
    expect(formatExternalWhen(makeEvent({ date: "2026-11-14" }))).toBe(
      "Sat, Nov 14",
    );
  });

  it("adds the linked event's start time, or its time range", () => {
    expect(
      formatExternalWhen(
        makeEvent({ source_event: source({ start_time: "18:00:00" }) }),
      ),
    ).toBe("Sat, Nov 14 · 6 PM");
    expect(
      formatExternalWhen(
        makeEvent({
          source_event: source({
            start_time: "18:00:00",
            end_time: "21:30:00",
          }),
        }),
      ),
    ).toBe("Sat, Nov 14 · 6 PM – 9:30 PM");
  });

  it("is null for an undated listing", () => {
    expect(formatExternalWhen(makeEvent({ date: null }))).toBeNull();
    expect(getExternalDateTile(makeEvent({ date: null }))).toBeNull();
  });
});

describe("getExternalDateTile", () => {
  it("returns an upper-case month and the day", () => {
    expect(getExternalDateTile(makeEvent({ date: "2026-11-04" }))).toEqual({
      month: "NOV",
      day: "4",
    });
  });
});
