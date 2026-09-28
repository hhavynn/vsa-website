import { webcrypto } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  ImportPlan,
  SweatpantsJson,
  buildImportPlan,
  validateJson,
} from "./aceFamilyImport";

// jsdom has no crypto.randomUUID; the importer uses it for member ids.
beforeAll(() => {
  if (!globalThis.crypto?.randomUUID) {
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
  }
});

const dataDir = path.resolve(__dirname, "..", "..", "data", "ace-families");

function loadFam(file: string): SweatpantsJson {
  const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
  const result = validateJson(parsed);
  if (!result.ok) throw new Error(`${file}: ${result.error}`);
  return result.json;
}

function parentNameOf(plan: ImportPlan, name: string): (string | null)[] {
  const byId = new Map(plan.people.map((p) => [p.id, p]));
  return plan.people
    .filter((p) => p.name === name)
    .map((p) => (p.parent_id ? byId.get(p.parent_id)!.name : null));
}

function childNamesOf(plan: ImportPlan, parentId: string): string[] {
  return plan.people
    .filter((p) => p.parent_id === parentId)
    .map((p) => p.name)
    .sort();
}

describe("buildImportPlan big_id_hint", () => {
  it("attaches a little to the same-named big its big_id_hint names", () => {
    const plan = buildImportPlan({
      family: "Test",
      members: [
        { name: "Root A", big: null },
        { name: "Root B", big: null },
        { name: "Alex", id_hint: "alex-a", big: "Root A" },
        { name: "Alex", id_hint: "alex-b", big: "Root B" },
        { name: "Kid", big: "Alex", big_id_hint: "alex-b" },
      ],
    });

    expect(plan.warnings).toEqual([]);
    const alexB = plan.people.find(
      (p) =>
        p.name === "Alex" &&
        plan.people.find((q) => q.id === p.parent_id)?.name === "Root B",
    )!;
    expect(childNamesOf(plan, alexB.id)).toEqual(["Kid"]);
  });

  it("warns and treats the member as a root when big_id_hint matches nobody", () => {
    const plan = buildImportPlan({
      family: "Test",
      members: [
        { name: "Alex", id_hint: "alex-a", big: null },
        { name: "Kid", big: "Alex", big_id_hint: "alex-z" },
      ],
    });

    expect(plan.warnings).toHaveLength(1);
    expect(parentNameOf(plan, "Kid")).toEqual([null]);
  });
});

// Reconstructed from the ACE family-tree workbook (2026-09-27): every
// big -> little edge becomes one parent link; nothing is dropped or guessed.
const EXPECTED: Record<
  string,
  { family: string; people: number; links: number; roots: number }
> = {
  "underwater.json": {
    family: "Underwater",
    people: 103,
    links: 91,
    roots: 12,
  },
  "down.json": { family: "Down", people: 138, links: 133, roots: 5 },
  "moon.json": { family: "Moon", people: 28, links: 23, roots: 5 },
  "bang-mi.json": { family: "Bang Mi", people: 53, links: 50, roots: 3 },
  "nsf.json": { family: "NSF", people: 144, links: 132, roots: 12 },
  "cross.json": { family: "Cross", people: 82, links: 71, roots: 11 },
  "dead-attractive-af-aaf.json": {
    family: "(Dead) Attractive AF (AAF)",
    people: 37,
    links: 34,
    roots: 3,
  },
};

describe("ACE family import files", () => {
  it("covers exactly the files in data/ace-families", () => {
    const files = fs
      .readdirSync(dataDir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    expect(files).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))(
    "%s imports cleanly with every edge kept",
    (file, expected) => {
      const plan = buildImportPlan(loadFam(file));

      expect(plan.warnings).toEqual([]);
      expect(plan.familyName).toBe(expected.family);
      expect(plan.people).toHaveLength(expected.people);
      expect(plan.people.filter((p) => p.parent_id)).toHaveLength(
        expected.links,
      );
      expect(plan.people.filter((p) => !p.parent_id)).toHaveLength(
        expected.roots,
      );

      // Parents are emitted before children, so the two-pass insert is FK-safe.
      const seen = new Set<string>();
      const parentAfterChild = plan.people.filter((p) => {
        const outOfOrder = p.parent_id !== null && !seen.has(p.parent_id);
        seen.add(p.id);
        return outOfOrder;
      });
      expect(parentAfterChild).toEqual([]);
    },
  );

  it("maps fam slugs onto the ACE page's fam slots", () => {
    const slugs = Object.keys(EXPECTED).map(
      (file) => buildImportPlan(loadFam(file)).familySlug,
    );
    expect(slugs).toEqual([
      "underwater",
      "down",
      "moon",
      "bang-mi",
      "nsf",
      "cross",
      "dead-attractive-af-aaf",
    ]);
  });

  it("keeps same-named people apart and hangs littles on the right one", () => {
    const down = buildImportPlan(loadFam("down.json"));
    expect(parentNameOf(down, "Alex Nguyen").sort()).toEqual([
      "Danny Tran",
      "Mei Fu Lee",
    ]);
    const dannysAlex = down.people.find(
      (p) =>
        p.name === "Alex Nguyen" &&
        down.people.find((q) => q.id === p.parent_id)?.name === "Danny Tran",
    )!;
    expect(childNamesOf(down, dannysAlex.id)).toEqual([
      "Joyce Yuan",
      "Sabrina Lin",
    ]);

    const nsf = buildImportPlan(loadFam("nsf.json"));
    const legacyJenny = nsf.people.find(
      (p) =>
        p.name === "Jenny Nguyen" &&
        nsf.people.find((q) => q.id === p.parent_id)?.name === "Jonathan Kwok",
    )!;
    expect(childNamesOf(nsf, legacyJenny.id)).toEqual([
      "Heidi Tran",
      "Nguyen Nguyen",
      "Nicolas Lai",
      "Vincent Tang",
    ]);

    const cross = buildImportPlan(loadFam("cross.json"));
    expect(parentNameOf(cross, "Khanh Le").sort()).toEqual([
      "Johanna Q Nguyen",
      "Kevin Huynh",
    ]);
  });

  it("starts Moon at its FA23 roots without AAF ancestry", () => {
    const moon = buildImportPlan(loadFam("moon.json"));
    const aaf = buildImportPlan(loadFam("dead-attractive-af-aaf.json"));
    const aafNames = new Set(aaf.people.map((p) => p.name));
    // Carryover members appear in both trees, but only as Moon roots.
    const shared = moon.people.filter((p) => aafNames.has(p.name));
    expect(shared.map((p) => p.name).sort()).toEqual([
      "Andy G.A. Vu",
      "Hannah Nguyen",
      "Huy G. Le",
      "Lorenzo S Santo Domingo",
      "Theo N Bui",
    ]);
    shared.forEach((p) => expect(p.parent_id).toBeNull());
  });

  it("uses the fam heads' spelling for their own tree nodes", () => {
    expect(
      buildImportPlan(loadFam("cross.json")).people.map((p) => p.name),
    ).toContain("Anh Thu Vo");
    expect(
      buildImportPlan(loadFam("bang-mi.json")).people.map((p) => p.name),
    ).toContain("Katherine Chen");
    expect(
      buildImportPlan(loadFam("nsf.json")).people.map((p) => p.name),
    ).toContain("Jonas Truong");
  });
});
