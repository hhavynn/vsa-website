import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "../..");

// Retired tables, RPCs, trigger functions and UI/API identifiers. The physical
// database objects are preserved (the retirement migration only revokes access
// and detaches triggers), so these names legitimately still exist in generated
// types, historical migrations and retirement tooling, but no active frontend,
// admin, Edge Function or script code may use them.
export const RETIRED_IDENTIFIER =
  /\b(check_in_to_event|CheckInCodeInput|useEventAttendance|PointsContext|PointsProvider|usePoints|user_points|event_attendance|generate_check_in_code|set_event_check_in_code|create_event_check_in_secrets?|handle_new_user_points|get_user_points|update_user_points|handle_check_in|event_check_in_secrets|check_in_codes|check_in_code_usage|check_ins|is_code_expired|SignUpSchema|SignUpForm|signUp|CheckInCodeSchema)\b/;

// Active-code roots. Historical migrations (supabase/migrations) and docs are
// deliberately not scanned: they are the record of what existed.
const SCANNED_ROOTS = ["src", "supabase/functions", "scripts"];
const SCANNED_FILE = /\.(ts|tsx|js|mjs|cjs|sh|sql)$/;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

// The only active-tree files allowed to name a retired object, with the reason.
export const ALLOWED: Record<string, string> = {
  "src/types/database.ts":
    "generated from the live schema, which still physically contains the preserved objects",
  "scripts/verify-rls-security.mjs":
    "hosted verifier asserts the legacy archives' pre- and post-retirement grants",
  "scripts/sql/retired-member-check-in.fixture.sql":
    "offline migration fixture reproducing the pre-retirement schema",
  "scripts/sql/retired-member-check-in.assert.sql":
    "offline migration assertions proving the retirement grants",
  "scripts/test-retired-member-check-in.sh":
    "offline migration fixture runner",
};

function filesUnder(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ["node_modules", "__meta__", "test-utils", "migrations"].includes(
        entry.name,
      )
        ? []
        : filesUnder(file);
    }
    return SCANNED_FILE.test(entry.name) &&
      !TEST_FILE.test(entry.name) &&
      entry.name !== "setupTests.ts"
      ? [file]
      : [];
  });
}

function violationsIn(files: string[]): string[] {
  return files.flatMap((file) => {
    const relative = path.relative(repoRoot, file).split(path.sep).join("/");
    if (relative in ALLOWED) return [];
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        RETIRED_IDENTIFIER.test(line) ? [`${relative}:${index + 1}`] : [],
      );
  });
}

it("ships no member signup or retired account/check-in application paths", () => {
  const files = SCANNED_ROOTS.flatMap((root) =>
    filesUnder(path.join(repoRoot, root)),
  );
  // Guard against the scan silently covering nothing.
  expect(files.length).toBeGreaterThan(100);
  expect(violationsIn(files)).toEqual([]);
});

it("recognizes every retired table, RPC and trigger function", () => {
  for (const identifier of [
    "event_attendance",
    "user_points",
    "event_check_in_secrets",
    "check_in_codes",
    "check_in_code_usage",
    "check_ins",
    "check_in_to_event",
    "generate_check_in_code",
    "get_user_points",
    "update_user_points",
    "handle_check_in",
    "is_code_expired",
  ]) {
    expect(`supabase.rpc('${identifier}')`).toMatch(RETIRED_IDENTIFIER);
    expect(`.from("${identifier}")`).toMatch(RETIRED_IDENTIFIER);
  }
});

it("does not mistake active member-model objects for retired ones", () => {
  for (const active of [
    "member_event_attendance",
    "member_yearly_points",
    "house_member_yearly_points",
    "get_event_points",
    "update_event_points",
    "set_event_points",
    "check_in_form_url",
    "public_members",
  ]) {
    expect(active).not.toMatch(RETIRED_IDENTIFIER);
  }
});

it("flags a retired call anywhere in active code (the scan can fail)", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "retirement-scan-"));
  try {
    const offender = path.join(scratch, "offender.ts");
    fs.writeFileSync(offender, 'supabase.rpc("check_in_to_event");\n');
    const [violation] = violationsIn([offender]);
    expect(violation).toMatch(/offender\.ts:1$/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

it("keeps every allowlist entry real and justified", () => {
  for (const [file, reason] of Object.entries(ALLOWED)) {
    expect(fs.existsSync(path.join(repoRoot, file))).toBe(true);
    expect(reason.length).toBeGreaterThan(10);
  }
});

it("keeps signup disabled in every local auth channel", () => {
  const config = fs.readFileSync(
    path.join(repoRoot, "supabase/config.toml"),
    "utf8",
  );
  const enabled = config
    .split("\n")
    .filter((line) => /^enable_signup\s*=\s*true\b/.test(line));
  expect(enabled).toEqual([]);
});
