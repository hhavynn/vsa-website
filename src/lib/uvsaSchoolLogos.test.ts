import {
  UVSA_SCHOOL_ASSETS_BUCKET,
  buildSchoolLogoPath,
  getFallbackPaletteClass,
  getInstagramHandle,
  getSafeLogoUrl,
  getSchoolInitials,
  isAcceptedSchoolLogoType,
} from "./uvsaSchoolLogos";
import { extractSupabasePublicObjectName } from "./imageUpload";

const OWN = "https://test.supabase.co";

describe("getSafeLogoUrl", () => {
  it("returns null for empty values", () => {
    expect(getSafeLogoUrl(null)).toBeNull();
    expect(getSafeLogoUrl(undefined)).toBeNull();
    expect(getSafeLogoUrl("   ")).toBeNull();
  });

  it("accepts ordinary https logos", () => {
    expect(getSafeLogoUrl("https://cdn.example.com/logo.png")).toBe(
      "https://cdn.example.com/logo.png",
    );
  });

  it("rejects http, javascript and unparseable values", () => {
    expect(getSafeLogoUrl("http://cdn.example.com/logo.png")).toBeNull();
    expect(getSafeLogoUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeLogoUrl("not a url")).toBeNull();
  });

  it("accepts this site's own school-assets bucket (REACT_APP_SUPABASE_URL from setupTests)", () => {
    const url = `${OWN}/storage/v1/object/public/${UVSA_SCHOOL_ASSETS_BUCKET}/ucsd/logo-1.webp`;
    expect(getSafeLogoUrl(url)).toBe(url);
  });

  it("accepts the image-transform render path for the same bucket", () => {
    const url = `${OWN}/storage/v1/render/image/public/${UVSA_SCHOOL_ASSETS_BUCKET}/ucsd/logo-1.webp?width=192`;
    expect(getSafeLogoUrl(url)).toBe(url);
  });

  it("rejects Supabase Storage from a different project", () => {
    expect(
      getSafeLogoUrl(
        `https://other.supabase.co/storage/v1/object/public/${UVSA_SCHOOL_ASSETS_BUCKET}/x.webp`,
      ),
    ).toBeNull();
  });

  it("rejects other buckets in this project", () => {
    expect(
      getSafeLogoUrl(`${OWN}/storage/v1/object/public/cabinet_images/x.webp`),
    ).toBeNull();
    expect(
      getSafeLogoUrl(`${OWN}/storage/v1/object/public/gallery/x.webp`),
    ).toBeNull();
  });

  it("rejects own-origin storage URLs that are not public object paths", () => {
    expect(
      getSafeLogoUrl(
        `${OWN}/storage/v1/object/sign/${UVSA_SCHOOL_ASSETS_BUCKET}/x.webp?token=1`,
      ),
    ).toBeNull();
  });

  it("rejects own-project storage when the project URL is unknown", () => {
    const url = `${OWN}/storage/v1/object/public/${UVSA_SCHOOL_ASSETS_BUCKET}/x.webp`;
    expect(getSafeLogoUrl(url, "not-a-url")).toBeNull();
  });
});

describe("buildSchoolLogoPath", () => {
  it("namespaces the object under the school slug", () => {
    expect(buildSchoolLogoPath("ucsd", "abc", "webp")).toBe(
      "ucsd/logo-abc.webp",
    );
  });

  it("normalizes the slug so a path can never escape its folder", () => {
    expect(buildSchoolLogoPath(" Cal Poly/../SLO ", "abc", "png")).toBe(
      "cal-poly-slo/logo-abc.png",
    );
  });

  it("refuses an empty slug", () => {
    expect(() => buildSchoolLogoPath("  ", "abc", "webp")).toThrow(/slug/i);
  });

  it("round-trips with extractSupabasePublicObjectName", () => {
    const path = buildSchoolLogoPath("uci", "abc", "webp");
    const url = `${OWN}/storage/v1/object/public/${UVSA_SCHOOL_ASSETS_BUCKET}/${path}`;
    expect(
      extractSupabasePublicObjectName(url, UVSA_SCHOOL_ASSETS_BUCKET),
    ).toBe(path);
  });
});

describe("logo type + fallback helpers", () => {
  it("accepts only the raster types the bucket allows", () => {
    expect(isAcceptedSchoolLogoType({ type: "image/png" })).toBe(true);
    expect(isAcceptedSchoolLogoType({ type: "image/jpeg" })).toBe(true);
    expect(isAcceptedSchoolLogoType({ type: "image/webp" })).toBe(true);
    expect(isAcceptedSchoolLogoType({ type: "image/svg+xml" })).toBe(false);
    expect(isAcceptedSchoolLogoType({ type: "application/pdf" })).toBe(false);
  });

  it("builds initials from the label", () => {
    expect(getSchoolInitials("UCSD")).toBe("UCSD");
    expect(getSchoolInitials("Cal Poly SLO!")).toBe("CALPOL");
    expect(getSchoolInitials("!!!")).toBe("VSA");
  });

  it("picks a stable palette per school", () => {
    const a = getFallbackPaletteClass({ slug: "ucsd", short_name: "UCSD" });
    expect(getFallbackPaletteClass({ slug: "ucsd", short_name: "UCSD" })).toBe(
      a,
    );
    expect(a).toMatch(/^bg-/);
  });
});

describe("getInstagramHandle", () => {
  it.each([
    ["https://www.instagram.com/vsaatucsd/", "@vsaatucsd"],
    ["https://instagram.com/cpp.vsa", "@cpp.vsa"],
    ["https://www.instagram.com/csun_seasa/?hl=en", "@csun_seasa"],
    ["  https://www.instagram.com/lbvsa/  ", "@lbvsa"],
  ])("extracts the handle from %s", (url, handle) => {
    expect(getInstagramHandle(url)).toBe(handle);
  });

  it.each([
    null,
    undefined,
    "",
    "not a url",
    "https://example.com/vsaatucsd/",
    "https://notinstagram.com/vsaatucsd/",
    "https://www.instagram.com/",
    "https://www.instagram.com/p/abc123/",
    "https://www.instagram.com/reel/abc123/",
  ])("returns null for %s", (url) => {
    expect(getInstagramHandle(url)).toBeNull();
  });
});
