import * as fs from "fs";
import * as path from "path";

/**
 * Drift guard for the domain-playbook roster.
 *
 * The canonical registry is `.claude/agents/README.md`. `AGENTS.md`, `GEMINI.md`,
 * and the `vsa-change-control` skill point at it instead of repeating the list.
 * This test fails if the README registry and the actual `.claude/agents/*.md`
 * playbook files diverge in either direction, so the "one canonical roster"
 * invariant is machine-checked rather than hand-maintained across files.
 *
 * It derives BOTH sides from the repo — it does not hard-code the roster, which
 * would just be another duplicate source of truth (the thing this whole change
 * is removing).
 */
const agentsDir = path.resolve(__dirname, "..", "..", ".claude", "agents");

/** Playbook names taken from the actual files on disk (README is not a playbook). */
function actualPlaybookNames(): string[] {
  return fs
    .readdirSync(agentsDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

/** Playbook names named in the README registry table (first backticked `vsa-*` per table row). */
function registryPlaybookNames(): string[] {
  const readme = fs.readFileSync(path.join(agentsDir, "README.md"), "utf8");
  const names = new Set<string>();
  for (const line of readme.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue; // table rows only
    const match = line.match(/`(vsa-[a-z0-9-]+)`/); // first backticked name = the Subagent column
    if (match) names.add(match[1]);
  }
  return Array.from(names).sort();
}

describe("domain-playbook roster stays canonical", () => {
  it("README registry lists exactly the playbook files on disk", () => {
    const actual = actualPlaybookNames();
    const registry = registryPlaybookNames();

    const missingFromRegistry = actual.filter((n) => !registry.includes(n));
    const missingFromDisk = registry.filter((n) => !actual.includes(n));

    // Objects (not two bare arrays) so a failure names which side drifted.
    expect({ missingFromRegistry, missingFromDisk }).toEqual({
      missingFromRegistry: [],
      missingFromDisk: [],
    });
  });

  it("parses a non-empty roster from both sources", () => {
    // Guards against a silently-empty parse (e.g. the dir moved) that would make
    // the equality test pass trivially with two empty sets.
    expect(actualPlaybookNames().length).toBeGreaterThan(0);
    expect(registryPlaybookNames().length).toBeGreaterThan(0);
  });
});
