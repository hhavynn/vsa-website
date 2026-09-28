import * as fs from "fs";
import * as path from "path";

/**
 * Drift guard for the skill library (#305), the counterpart of
 * playbookRoster.test.ts for `.claude/skills/`.
 *
 * Two checks, both derived from the repo rather than a hard-coded roster
 * (a hard-coded list would be one more duplicate source of truth):
 *
 * 1. The routing table in `.claude/skills/README.md` and the `vsa-*` skill
 *    directories on disk agree in both directions.
 * 2. Every structured `vsa-*` reference in the governance docs (backticked or
 *    bold names) resolves to a real skill directory or a playbook agent in
 *    `.claude/agents/`. An agent told to load a skill that no longer exists
 *    improvises instead, so a dangling name is a real failure.
 *
 * Prose that mentions a name without backticks or bold is ignored on purpose.
 */
const repoRoot = path.resolve(__dirname, "..", "..");
const skillsDir = path.join(repoRoot, ".claude", "skills");
const agentsDir = path.join(repoRoot, ".claude", "agents");

const GOVERNANCE_DOCS = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "ANTIGRAVITY.md",
  "docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md",
  ".claude/skills/README.md",
];

/** `vsa-*` skill directories that actually contain a SKILL.md (graphify, README.md, PLAN.md excluded). */
function skillsOnDisk(): string[] {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("vsa-"))
    .filter((entry) => fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

function playbookAgents(): Set<string> {
  return new Set(
    fs
      .readdirSync(agentsDir)
      .filter((file) => file.endsWith(".md") && file !== "README.md")
      .map((file) => file.replace(/\.md$/, "")),
  );
}

/** Skills named in the README routing table: bold `**vsa-*`** in a table row's last column. */
function readmeRegistry(): string[] {
  const readme = fs.readFileSync(path.join(skillsDir, "README.md"), "utf8");
  const names = new Set<string>();
  for (const line of readme.split("\n")) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    const match = cells[cells.length - 1]?.match(/^\*\*(vsa-[a-z0-9-]+)\*\*$/);
    if (match) names.add(match[1]);
  }
  return Array.from(names).sort();
}

/** Structured `vsa-*` references in a doc: `vsa-name` or **vsa-name**. */
function structuredReferences(file: string): string[] {
  const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
  const names = new Set<string>();
  Array.from(text.matchAll(/(?:`|\*\*)(vsa-[a-z0-9]+(?:-[a-z0-9]+)*)/g)).forEach((match) => names.add(match[1]));
  return Array.from(names);
}

describe("skill library roster stays canonical (#305)", () => {
  it("README routing table lists exactly the skill directories on disk", () => {
    const onDisk = skillsOnDisk();
    const registry = readmeRegistry();

    expect({
      missingFromReadme: onDisk.filter((name) => !registry.includes(name)),
      missingFromDisk: registry.filter((name) => !onDisk.includes(name)),
    }).toEqual({ missingFromReadme: [], missingFromDisk: [] });
  });

  it("every structured vsa-* reference in the governance docs resolves", () => {
    const skills = new Set(skillsOnDisk());
    const agents = playbookAgents();
    const dangling = GOVERNANCE_DOCS.filter((file) => fs.existsSync(path.join(repoRoot, file))).flatMap((file) =>
      structuredReferences(file)
        .filter((name) => !skills.has(name) && !agents.has(name))
        .map((name) => `${file}: ${name}`),
    );

    expect(dangling).toEqual([]);
  });

  it("parses non-empty sources, so the checks above can't pass vacuously", () => {
    expect(skillsOnDisk().length).toBeGreaterThan(0);
    expect(readmeRegistry().length).toBeGreaterThan(0);
    const referenced = GOVERNANCE_DOCS.filter((file) => fs.existsSync(path.join(repoRoot, file))).flatMap(structuredReferences);
    expect(referenced.length).toBeGreaterThan(0);
    // Every listed governance doc exists; a moved file would otherwise be skipped silently.
    expect(GOVERNANCE_DOCS.filter((file) => !fs.existsSync(path.join(repoRoot, file)))).toEqual([]);
  });
});
