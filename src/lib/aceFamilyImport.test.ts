import { webcrypto } from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  ImportPlan,
  SweatpantsJson,
  buildImportPlan,
  describePickupEvidence,
  pickupEvidenceRows,
  summarizePickupEvidence,
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
  "bang-mi.json": { family: "Bang Mi", people: 52, links: 49, roots: 3 },
  "nsf.json": { family: "NSF", people: 145, links: 139, roots: 6 },
  "cross.json": { family: "Cross", people: 81, links: 75, roots: 6 },
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
    // Owner-confirmed: the legacy "Alexandre Nguyen" is Vy Do (Vicky)'s big.
    expect(lineageOf(cross, "Vy Do (Vicky)").slice(-3)).toEqual([
      "Jeffrey Ha",
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
        "Alexandre Nguyen",
      ],
      "bang-mi.json": ["Deric Chu"],
    };
    Object.entries(merged).forEach(([file, aliases]) => {
      const names = loadFam(file).members.map((m) => m.name);
      expect(names.filter((n) => aliases.includes(n))).toEqual([]);
    });
  });

  it("keeps Sweatpants and Sunshine pairings out of these fams", () => {
    // Sweatpants' Helen Tran -> Tien Vo was once inferred into Bang Mi.
    const bangMiNames = loadFam("bang-mi.json").members.map((m) => m.name);
    expect(
      bangMiNames.filter((n) => ["Helen Tran", "Tien Vo"].includes(n)),
    ).toEqual([]);
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

describe("added_term pickup evidence", () => {
  const personNamed = (plan: ImportPlan, name: string) => {
    const matches = plan.people.filter((p) => p.name === name);
    expect(matches).toHaveLength(1);
    return matches[0];
  };

  it("carries a concrete FA23 and SP24 into the plan as 2023–24 candidates", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [
        { name: "Big", big: null, added_term: "FA23", confidence: "confirmed" },
        { name: "Little", big: "Big", added_term: "SP24" },
      ],
    });
    expect(plan.warnings).toEqual([]);
    expect(personNamed(plan, "Big").pickup).toEqual({
      rawValue: "FA23",
      parsed: { kind: "term", term: "FA23", season: "FA", academicYearStart: 2023 },
      sourceConfidence: "confirmed",
    });
    expect(personNamed(plan, "Little").pickup?.parsed).toEqual({
      kind: "term",
      term: "SP24",
      season: "SP",
      academicYearStart: 2023,
    });
  });

  it("keeps legacy as unknown and records nothing for blank or missing terms", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [
        { name: "Old", big: null, added_term: "legacy" },
        { name: "Blank", big: "Old", added_term: "" },
        { name: "Missing", big: "Old" },
        { name: "Null", big: "Old", added_term: null },
      ],
    });
    expect(plan.warnings).toEqual([]);
    expect(personNamed(plan, "Old").pickup?.parsed).toEqual({ kind: "unknown", reason: "legacy" });
    expect(personNamed(plan, "Blank").pickup).toBeNull();
    expect(personNamed(plan, "Missing").pickup).toBeNull();
    expect(personNamed(plan, "Null").pickup).toBeNull();
  });

  it("never gives an implicit little their big's term", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [{ name: "Big", big: null, added_term: "FA22", littles: ["Implicit Kid"] }],
    });
    expect(personNamed(plan, "Implicit Kid").pickup).toBeNull();
  });

  it("warns on a term it cannot place and keeps the raw value for review", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [
        { name: "Root", big: null },
        { name: "Odd", big: "Root", added_term: "Fall-ish 23" },
        { name: "Summer", big: "Root", added_term: "SU23" },
        { name: "Nineties", big: "Root", added_term: "FA98" },
      ],
    });
    expect(plan.warnings).toEqual([
      '"Odd" has added_term "Fall-ish 23" that cannot be placed (malformed). It is kept for review, not as a year.',
      '"Summer" has added_term "SU23" that cannot be placed (unsupported season). It is kept for review, not as a year.',
      '"Nineties" has added_term "FA98" that cannot be placed (ambiguous century). It is kept for review, not as a year.',
    ]);
    expect(personNamed(plan, "Odd").pickup?.rawValue).toBe("Fall-ish 23");
  });

  it("warns when a little is dated before their own big", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [
        { name: "Big", big: null, added_term: "FA23" },
        { name: "Early", big: "Big", added_term: "SP23" },
        { name: "Same Term", big: "Big", added_term: "FA23" },
        { name: "Later", big: "Big", added_term: "SP24" },
        { name: "Year Only", big: "Big", added_term: "2023-24" },
      ],
    });
    expect(plan.warnings).toEqual([
      '"Early" (SP23) is dated before their big "Big" (FA23). Check both terms.',
    ]);
  });

  it("keeps each same-named person's own term with id_hint and big_id_hint", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [
        { name: "Root A", big: null },
        { name: "Root B", big: null },
        { name: "Alex", id_hint: "alex-a", big: "Root A", added_term: "FA21" },
        { name: "Alex", id_hint: "alex-b", big: "Root B", added_term: "FA24" },
        { name: "Kid", big: "Alex", big_id_hint: "alex-b", added_term: "FA25" },
      ],
    });
    expect(plan.warnings).toEqual([]);
    const byId = new Map(plan.people.map((p) => [p.id, p]));
    const alexes = plan.people
      .filter((p) => p.name === "Alex")
      .map((p) => [byId.get(p.parent_id!)!.name, p.pickup?.rawValue])
      .sort();
    expect(alexes).toEqual([
      ["Root A", "FA21"],
      ["Root B", "FA24"],
    ]);
    const kid = personNamed(plan, "Kid");
    expect(byId.get(kid.parent_id!)?.pickup?.rawValue).toBe("FA24");
  });

  it("builds only pending evidence rows, one per person with a written term", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [
        { name: "Root", big: null, added_term: "legacy" },
        { name: "Kid", big: "Root", added_term: "fa 23", confidence: "inferred-medium" },
        { name: "Workbook", big: "Root", added_term: "2021–22" },
        { name: "None", big: "Root" },
      ],
    });
    const rows = pickupEvidenceRows(plan);
    expect(rows.map((r) => [r.raw_value, r.candidate_academic_year_start, r.candidate_term])).toEqual([
      ["legacy", null, null],
      ["fa 23", 2023, "FA23"],
      ["2021–22", 2021, null],
    ]);
    expect(rows.every((r) => r.review_status === "pending" && r.source_kind === "import_json")).toBe(true);
    expect(rows[1].source_confidence).toBe("inferred-medium");
  });

  it("clips over-long source text to what the evidence table accepts", () => {
    const long = "x".repeat(300);
    const plan = buildImportPlan({
      family: long,
      members: [{ name: "Root", big: null, added_term: long, confidence: long }],
    });
    const [row] = pickupEvidenceRows(plan);
    expect(row.raw_value).toHaveLength(64);
    expect(row.source_confidence).toHaveLength(64);
    expect(row.source_label!.length).toBeLessThanOrEqual(200);
    expect(plan.warnings).toHaveLength(1);
  });

  it("describes the evidence without calling any of it approved", () => {
    const plan = buildImportPlan({
      family: "Synthetic",
      members: [
        { name: "Root", big: null, added_term: "legacy" },
        { name: "Kid", big: "Root", added_term: "FA23" },
        { name: "None", big: "Root" },
      ],
    });
    expect(describePickupEvidence(plan)).toBe(
      "Pickup years: 1 with a term · 1 legacy · 1 none. Saved as unreviewed evidence; no year shows publicly until an admin approves it.",
    );
  });

  it("preserves every reconstructed file's added_term without changing any edge", () => {
    let explicitWithTerm = 0;
    const totals = { term: 0, academicYear: 0, legacy: 0, needsReview: 0 };
    Object.keys(EXPECTED).forEach((file) => {
      const json = loadFam(file);
      const plan = buildImportPlan(json);
      expect(plan.warnings).toEqual([]);

      const written = json.members
        .map((m) => (typeof m.added_term === "string" ? m.added_term.trim() : ""))
        .filter((t) => t !== "")
        .sort();
      explicitWithTerm += written.length;
      expect(
        plan.people
          .flatMap((p) => (p.pickup ? [p.pickup.rawValue] : []))
          .sort(),
      ).toEqual(written);

      const summary = summarizePickupEvidence(plan);
      totals.term += summary.term;
      totals.academicYear += summary.academicYear;
      totals.legacy += summary.legacy;
      totals.needsReview += summary.needsReview;
      expect(pickupEvidenceRows(plan)).toHaveLength(written.length);
    });
    // Source audit for #669: 330 exact FA/SP terms, 205 legacy, 53 blank.
    expect(explicitWithTerm).toBe(535);
    expect(totals).toEqual({ term: 330, academicYear: 0, legacy: 205, needsReview: 0 });
  });
});
