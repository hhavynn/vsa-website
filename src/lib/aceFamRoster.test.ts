import * as fs from "fs";
import * as path from "path";
import { AceFamilyMember } from "../types";
import {
  ACTIVE_FAM_SLOTS,
  getFamIconUrl,
  resolveFamHeads,
} from "./aceFamRoster";

function member(overrides: Partial<AceFamilyMember>): AceFamilyMember {
  return {
    id: overrides.name ?? "id",
    family_id: "fam",
    name: "Someone",
    role_label: null,
    photo_url: null,
    parent_member_id: null,
    display_order: 0,
    is_published: true,
    created_at: "",
    updated_at: "",
    ...overrides,
  } as AceFamilyMember;
}

describe("ACE fam roster", () => {
  it("lists the eight active fams with unique slugs", () => {
    const slugs = ACTIVE_FAM_SLOTS.map((slot) => slot.slug);
    expect(slugs).toEqual([
      "sweatpants",
      "sunshine",
      "underwater",
      "down",
      "moon",
      "cross",
      "bang-mi",
      "nsf",
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every fam an icon that ships in public/", () => {
    const publicDir = path.resolve(__dirname, "..", "..", "public");
    ACTIVE_FAM_SLOTS.forEach((slot) => {
      expect(slot.iconUrl).not.toBeNull();
      expect(fs.existsSync(path.join(publicDir, slot.iconUrl!))).toBe(true);
    });
  });

  it("looks up icons by slug, case-insensitively, and returns null when missing", () => {
    expect(getFamIconUrl("Bang-Mi")).toBe("/images/ace/fams/bang-mi.webp");
    expect(getFamIconUrl("dead-royals")).toBeNull();
  });

  it("uses the roster heads when no member is labelled a head, borrowing tree photos by name", () => {
    const heads = resolveFamHeads("sunshine", [
      member({
        name: "Colin  Tran",
        role_label: "Big",
        photo_url: "https://example.test/colin.webp",
      }),
      member({ name: "Someone Else", role_label: "Little" }),
    ]);

    expect(heads).toEqual([
      {
        name: "Colin Tran",
        photoUrl: "https://example.test/colin.webp",
        roleLabel: "Fam Head",
      },
      { name: "Angelina Nguyen", photoUrl: null, roleLabel: "Fam Head" },
    ]);
  });

  it("gives Sweatpants a single head", () => {
    expect(resolveFamHeads("sweatpants", []).map((h) => h.name)).toEqual([
      "Jenny Diep",
    ]);
  });

  it("prefers members an admin labelled as fam heads", () => {
    const heads = resolveFamHeads("moon", [
      member({ name: "New Head", role_label: "Fam Head" }),
    ]);
    expect(heads).toEqual([
      { name: "New Head", photoUrl: null, roleLabel: "Fam Head" },
    ]);
  });

  it("returns no heads for fams outside the roster", () => {
    expect(resolveFamHeads("dead-royals", [])).toEqual([]);
  });
});
