import * as fs from "fs";
import * as path from "path";

/**
 * Regression guard for the anon column allowlists (#379, #380, #382).
 *
 * Migrations 20260820000000 / 20260820000001 / 20260820000002 revoke anon's
 * table-wide SELECT on `events`, `uvsa_schools`, and `external_events`, and cut
 * anon off `member_event_attendance` entirely. That makes the database the real
 * boundary — but it also means a public read path that names a revoked column,
 * or reverts to `select('*')`, fails at runtime for anonymous visitors only.
 * Signed-in developers and admins would not see the breakage.
 *
 * These tests are the cheap early warning: they run in CI with no credentials
 * and fail at the point someone reintroduces the problem, rather than when an
 * anonymous visitor hits a 401 in production.
 *
 * They deliberately assert on source text rather than on runtime behavior —
 * proving the grants themselves requires a live database and belongs to
 * scripts/verify-rls-security.mjs.
 */
const reposDir = path.resolve(__dirname);
const srcDir = path.resolve(__dirname, "..", "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(srcDir, relativePath), "utf8");
}

/** The literal assigned to a `const NAME = '...' as const;` declaration. */
function columnConstant(fileContents: string, constName: string): string {
  const pattern = new RegExp(`${constName}\\s*=\\s*'([^']*)'`);
  const match = fileContents.match(pattern);
  if (!match) {
    throw new Error(`Could not find the ${constName} column literal`);
  }
  return match[1];
}

describe("anon column allowlists stay closed", () => {
  it("the public events select excludes check_in_form_url (#379)", () => {
    const columns = columnConstant(
      read("data/repos/events.ts"),
      "PUBLIC_EVENT_COLUMNS"
    );

    expect(columns).not.toContain("check_in_form_url");
    // Sanity: the constant is a real column list, so the assertion above is not
    // passing merely because the parse returned something empty.
    expect(columns).toContain("id");
    expect(columns).toContain("is_published");
  });

  it("the public UVSA school select excludes internal editorial columns (#382)", () => {
    const columns = columnConstant(
      read("data/repos/uvsaSchools.ts"),
      "PUBLIC_UVSA_SCHOOL_COLUMNS"
    );

    expect(columns).not.toContain("verification_notes");
    expect(columns).not.toContain("confidence_level");
    expect(columns).toContain("school_name");
  });

  it("the public external-event select excludes internal editorial columns (#382)", () => {
    const columns = columnConstant(
      read("data/repos/externalEvents.ts"),
      "PUBLIC_EXTERNAL_EVENT_COLUMNS"
    );

    // Covers the nested uvsa_schools(...) embed too, since it is part of the
    // same literal — an embed of `uvsa_schools(*)` would fail for anon as well.
    expect(columns).not.toContain("source_notes");
    expect(columns).not.toContain("verification_notes");
    expect(columns).not.toContain("confidence_level");
    expect(columns).not.toContain("uvsa_schools(*)");
    expect(columns).toContain("title");
  });

  it("no public read path selects '*' from a column-restricted table", () => {
    // getAllSchools and getAllEvents are admin-only and legitimately use '*';
    // they run as `authenticated`, which keeps table-level SELECT. Everything
    // else reading these tables must name its columns.
    const offenders: string[] = [];

    const restricted: Array<{ file: string; table: string }> = [
      { file: "data/repos/events.ts", table: "events" },
      { file: "data/repos/uvsaSchools.ts", table: "uvsa_schools" },
      { file: "data/repos/externalEvents.ts", table: "external_events" },
    ];

    for (const { file, table } of restricted) {
      const contents = read(file);
      // `select('*', { count: 'exact', head: true })` returns no rows and
      // projects no columns, so it is not a column-exposure path — only
      // row-returning `select('*')` is. The negative lookahead skips the
      // count-only form.
      const pattern = new RegExp(
        `from\\('${table}'\\)\\s*\\n?\\s*\\.select\\('\\*'(?!\\s*,)`,
        "g"
      );
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(contents)) !== null) {
        const line = contents.slice(0, match.index).split("\n").length;
        const preceding = contents.slice(0, match.index);
        // Admin-only accessors are the documented exception.
        if (/getAll(Schools|Events)\s*\(/.test(preceding.slice(-400))) continue;
        offenders.push(`${file}:${line} selects '*' from ${table}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("anon-reachable code reads member_event_history, not the raw ledger (#380)", () => {
    // /points and /events are public routes. Anon lost SELECT on
    // member_event_attendance, so these two must go through the view.
    const anonReachable = [
      "pages/Events.tsx",
      "components/features/points/MyVSACard.tsx",
    ];

    const offenders = anonReachable.filter((file) =>
      read(file).includes("from('member_event_attendance')")
    );

    expect(offenders).toEqual([]);
  });

  it("the repos directory has no stray raw-ledger read outside admin pages", () => {
    const offenders = fs
      .readdirSync(reposDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .filter((f) =>
        fs
          .readFileSync(path.join(reposDir, f), "utf8")
          .includes("from('member_event_attendance')")
      );

    expect(offenders).toEqual([]);
  });
});
