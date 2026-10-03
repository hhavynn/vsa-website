import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const retired =
  /\b(check_in_to_event|CheckInCodeInput|useEventAttendance|PointsContext|PointsProvider|usePoints|user_points|event_attendance|generate_check_in_code|event_check_in_secrets|check_in_codes|check_in_code_usage|check_ins|is_code_expired|SignUpSchema|SignUpForm|signUp|CheckInCodeSchema)\b/;

function applicationFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ["__meta__", "test-utils"].includes(entry.name)
        ? []
        : applicationFiles(file);
    }
    return /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name) &&
      entry.name !== "setupTests.ts"
      ? [file]
      : [];
  });
}

it("ships no member signup or retired account/check-in application paths", () => {
  const violations = applicationFiles(path.join(repoRoot, "src")).flatMap(
    (file) =>
      fs
        .readFileSync(file, "utf8")
        .split("\n")
        .flatMap((line, index) =>
          retired.test(line)
            ? [`${path.relative(repoRoot, file)}:${index + 1}`]
            : [],
        ),
  );
  expect(violations).toEqual([]);
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
