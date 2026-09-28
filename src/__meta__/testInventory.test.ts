import * as fs from "fs";
import * as path from "path";

/**
 * Keeps the canonical test inventory (§2 of
 * `.claude/skills/vsa-validation-and-qa/SKILL.md`) complete. Agents use it to
 * decide which behaviour is already protected, so a suite missing from it is
 * treated as untested, and a row for a deleted file claims protection that no
 * longer exists. Both sides are derived from the repo.
 */
const repoRoot = path.resolve(__dirname, "..", "..");
const inventoryFile = path.join(repoRoot, ".claude", "skills", "vsa-validation-and-qa", "SKILL.md");

function testFilesOnDisk(dir = path.join(repoRoot, "src")): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFilesOnDisk(full);
    return /\.test\.tsx?$/.test(entry.name) ? [path.relative(repoRoot, full).split(path.sep).join("/")] : [];
  });
}

/** `src/...test.ts(x)` paths named in the first column of the §2 table. */
function inventoriedFiles(): string[] {
  const text = fs.readFileSync(inventoryFile, "utf8");
  const section = text.slice(text.indexOf("## 2."), text.indexOf("## 3."));
  const files = new Set<string>();
  section.split("\n").forEach((line) => {
    if (!line.startsWith("| `src/")) return;
    const firstCell = line.split("|")[1] ?? "";
    Array.from(firstCell.matchAll(/`(src\/[^`]+\.test\.tsx?)`/g)).forEach((match) => files.add(match[1]));
  });
  return Array.from(files).sort();
}

describe("test inventory stays complete", () => {
  it("lists every test file on disk, and nothing that no longer exists", () => {
    const onDisk = testFilesOnDisk().sort();
    const listed = inventoriedFiles();

    expect({
      missingFromInventory: onDisk.filter((file) => !listed.includes(file)),
      listedButMissing: listed.filter((file) => !onDisk.includes(file)),
    }).toEqual({ missingFromInventory: [], listedButMissing: [] });
  });

  it("parses a non-empty inventory", () => {
    expect(inventoriedFiles().length).toBeGreaterThan(10);
  });
});
