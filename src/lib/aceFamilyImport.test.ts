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

function lineageOf(plan: ImportPlan, name: string): string[] {
  const byId = new Map(plan.people.map((p) => [p.id, p]));
  const matches = plan.people.filter((p) => p.name === name);
  expect(matches).toHaveLength(1);
  const chain = [matches[0].name];
  let parentId = matches[0].parent_id;
  while (parentId) {
    const parent = byId.get(parentId)!;
    chain.unshift(parent.name);
    parentId = parent.parent_id;
  }
  return chain;
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

// Reconstructed from the ACE family-tree workbook (2026-09-27), plus the
// owner's lineage corrections (2026-09-28) that joined split identities and
// reconnected false roots.
const EXPECTED: Record<
  string,
  { family: string; people: number; links: number; roots: number }
> = {
  "underwater.json": {
    family: "Underwater",
    people: 104,
    links: 99,
    roots: 5,
  },
  "down.json": { family: "Down", people: 139, links: 135, roots: 4 },
  "moon.json": { family: "Moon", people: 30, links: 25, roots: 5 },
  "bang-mi.json": { family: "Bang Mi", people: 54, links: 51, roots: 3 },
  "nsf.json": { family: "NSF", people: 145, links: 139, roots: 6 },
  "cross.json": { family: "Cross", people: 82, links: 75, roots: 7 },
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
  it("applies the owner's confirmed lineage chains", () => {
    const underwater = buildImportPlan(loadFam("underwater.json"));
    expect(lineageOf(underwater, "Anh T Nguyen")).toEqual([
      "Jason Le",
      "Grace Nguyen",
      "Anthony Dang",
      "Jennifer Ho",
      "Anh T Nguyen",
    ]);
    expect(lineageOf(underwater, "Spencer Ho").slice(-3)).toEqual([
      "Grace Phuong Nguyen",
      "Amy Q. Tran",
      "Spencer Ho",
    ]);
    expect(lineageOf(underwater, "Kelly Nguyen").slice(-2)).toEqual([
      "Jenny Nguyen",
      "Kelly Nguyen",
    ]);
    const amy = underwater.people.find((p) => p.name === "Amy Q. Tran")!;
    expect(childNamesOf(underwater, amy.id)).toEqual(
      expect.arrayContaining([
        "Ashley Nguyen",
        "Clarkson Phan",
        "Eric Pham",
        "Spencer Ho",
      ]),
    );

    const down = buildImportPlan(loadFam("down.json"));
    expect(lineageOf(down, "Arianna Phan")).toEqual([
      "Elizabeth Hoang",
      "Larry Nguyen",
      "Arianna Phan",
    ]);
    expect(lineageOf(down, "Giale Le")).toEqual(["Tram Le", "Giale Le"]);

    const nsf = buildImportPlan(loadFam("nsf.json"));
    expect(lineageOf(nsf, "Aidan Nguyen-Tran").slice(-5)).toEqual([
      "Jamie Doan",
      "Joseph Luu",
      "Kim D. Tran",
      "Tracy T Vu",
      "Aidan Nguyen-Tran",
    ]);
    expect(lineageOf(nsf, "Mailan Doan")).toEqual([
      "Steven Nguyen",
      "Emily Dinh",
      "Mailan Doan",
    ]);
    expect(lineageOf(nsf, "Katrina Dinh")).toEqual([
      "Leilani Ma",
      "Eleanor Nguyen",
      "Katrina Dinh",
    ]);
    expect(lineageOf(nsf, "Paige Kwan")).toEqual([
      "My Nguyen",
      "Xuan-Mai Nguyen",
      "Paige Kwan",
    ]);
    expect(lineageOf(nsf, "Edward B Vo")).toEqual([
      "Vivian Dang",
      "Edward B Vo",
    ]);
    expect(lineageOf(nsf, "HenryPV Nguyen").slice(-2)).toEqual([
      "Sam Do",
      "HenryPV Nguyen",
    ]);

    const cross = buildImportPlan(loadFam("cross.json"));
    expect(lineageOf(cross, "Tyana T Lai")).toEqual([
      "Angelina Phan",
      "Fatima Dong",
      "Van Nguyen",
      "Tyana T Lai",
    ]);
    expect(lineageOf(cross, "Catherine Hoang").slice(-2)).toEqual([
      "Kira M Nguyen",
      "Catherine Hoang",
    ]);
    expect(lineageOf(cross, "Preston Shin")).toEqual([
      "Elwood Bui",
      "Preston Shin",
    ]);
    expect(lineageOf(cross, "Trinity Bui")).toEqual([
      "Wilson Nguyen",
      "Trinity Bui",
    ]);
    // Alexandre Nguyen == Alex Nguyen is unconfirmed, so they stay apart.
    expect(lineageOf(cross, "Vy Do (Vicky)")).toEqual([
      "Alex Nguyen",
      "Vy Do (Vicky)",
    ]);

    const bangMi = buildImportPlan(loadFam("bang-mi.json"));
    expect(lineageOf(bangMi, "Zihan Liu").slice(-2)).toEqual([
      "Deric Chau",
      "Zihan Liu",
    ]);

    const moon = buildImportPlan(loadFam("moon.json"));
    const codie = moon.people.find((p) => p.name === "Codie Yeung")!;
    expect(childNamesOf(moon, codie.id)).toEqual([
      "Kenny Le",
      "Michael Pham",
      "Patrick Woo",
      "Tina Q. Pham",
    ]);
  });

  it("leaves no duplicate spellings of a merged person behind", () => {
    const merged: Record<string, string[]> = {
      "underwater.json": [
        "Tiffany Lu",
        "Spencer",
        "Anh Nguyen",
        "Phuong Nguyen",
        "Jennie Ho",
      ],
      "down.json": ["Arianna Pham"],
      "nsf.json": [
        "Kim Tran",
        "Tracy Vu",
        "Aidan C Nguyen",
        "Mailan N Doan",
        "Henry Nguyen",
        "Edward Vo",
      ],
      "cross.json": [
        "Tyana Lai",
        "Catherine M Hoang",
        "Preston J Shin",
        "Vicky Do",
      ],
      "bang-mi.json": ["Deric Chu"],
    };
    Object.entries(merged).forEach(([file, aliases]) => {
      const names = loadFam(file).members.map((m) => m.name);
      expect(names.filter((n) => aliases.includes(n))).toEqual([]);
    });
  });

  it("keeps Sweatpants and Sunshine pairings out of these fams", () => {
    Object.keys(EXPECTED).forEach((file) => {
      const names = loadFam(file).members.map((m) => m.name);
      expect(
        names.filter((n) =>
          ["Helen T Tran", "Kelly Truong", "Tho Danh", "Colin T Tran"].includes(
            n,
          ),
        ),
      ).toEqual([]);
    });
  });

  it("never links a little from an earlier term than their big", () => {
    const TERMS = [
      "legacy",
      "FA21",
      "SP22",
      "FA22",
      "SP23",
      "FA23",
      "SP24",
      "FA24",
      "SP25",
      "FA25",
      "SP26",
    ];
    // FA23 official pairings list these bigs as FA23 littles too; the links
    // are confirmed but the bigs' own term is likely earlier than recorded.
    const knownSameTerm = [
      "Thomas T Nguyen -> Nhi H Trinh",
      "Thomas T Nguyen -> Tina Le",
      "Tiffany T Thai -> Mina N. Ho",
      "Tiffany T Thai -> Amy Nguyen",
    ];
    const violations: string[] = [];
    Object.keys(EXPECTED).forEach((file) => {
      const members = loadFam(file).members;
      const byKey = new Map(
        members.map((m) => [`${m.name}|${m.id_hint ?? ""}`, m]),
      );
      members.forEach((m) => {
        if (!m.big || !m.added_term) return;
        const big = byKey.get(`${m.big}|${m.big_id_hint ?? ""}`);
        if (!big?.added_term) return;
        const bigRank = TERMS.indexOf(big.added_term);
        const littleRank = TERMS.indexOf(m.added_term);
        const sameNonLegacy =
          littleRank === bigRank && m.added_term !== "legacy";
        if (littleRank < bigRank || sameNonLegacy) {
          violations.push(`${big.name} -> ${m.name}`);
        }
      });
    });
    expect(violations.sort()).toEqual(knownSameTerm.sort());
  });
});
