import * as fs from "fs";
import * as path from "path";

/**
 * Drift guard for the skill library roster (#305).
 *
 * The playbook-agent roster already has one (`playbookRoster.test.ts`); this is
 * the equivalent for `.claude/skills/`. The canonical registry is
 * `.claude/skills/README.md`, which the root `CLAUDE.md` and `AGENTS.md` point
 * at instead of repeating the list. This test fails if the README registry and
 * the actual `vsa-*` skill directories diverge in either direction.
 *
 * Like the playbook guard, it derives BOTH sides from the repo rather than
 * hard-coding the roster — a hard-coded list would just be another duplicate
 * source of truth.
 *
 * Scope note: only `vsa-*` skills are tracked. `.claude/skills/graphify/` is
 * tooling documentation rather than a project-domain skill and is deliberately
 * absent from the README's roster.
 */
const skillsDir = path.resolve(__dirname, "..", "..", ".claude", "skills");

/** Skill names taken from the actual directories on disk (a skill = a dir with a SKILL.md). */
function actualSkillNames(): string[] {
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("vsa-"))
    .filter((entry) => fs.existsSync(path.join(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Skill names named in the README registry, which writes them bold (`**vsa-…**`).
 *
 * Bold rather than backticks is load-bearing: the README also backticks the
 * *playbook agent* names (`vsa-points-attendance-guardian`, `vsa-storage-egress`)
 * while explaining that agents are not skills, so a backtick match would pull in
 * names that will never have a skill directory.
 */
function registrySkillNames(): string[] {
  const readme = fs.readFileSync(path.join(skillsDir, "README.md"), "utf8");
  const names = new Set<string>();
  // exec loop rather than matchAll: tsconfig targets es5, where iterating a
  // matchAll result is a compile error (jest transpiles it fine, the build does
  // not — so matchAll passes tests and breaks `npm run build`).
  const pattern = /\*\*(vsa-[a-z0-9-]+)\*\*/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(readme)) !== null) {
    names.add(match[1]);
  }
  return Array.from(names).sort();
}

describe("skill roster stays canonical", () => {
  it("README registry lists exactly the vsa-* skill directories on disk", () => {
    const actual = actualSkillNames();
    const registry = registrySkillNames();

    const missingFromRegistry = actual.filter((n) => !registry.includes(n));
    const missingFromDisk = registry.filter((n) => !actual.includes(n));

    // Objects (not two bare arrays) so a failure names which side drifted.
    expect({ missingFromRegistry, missingFromDisk }).toEqual({
      missingFromRegistry: [],
      missingFromDisk: [],
    });
  });

  it("parses a non-empty roster from both sources", () => {
    // Guards against a silently-empty parse (e.g. the dir moved, or the README
    // switched away from bold) that would make the equality test pass trivially.
    expect(actualSkillNames().length).toBeGreaterThan(0);
    expect(registrySkillNames().length).toBeGreaterThan(0);
  });

  it("every tracked skill directory has a SKILL.md with a name and description", () => {
    // A skill with no frontmatter description never auto-loads, so it is present
    // in the roster but inert — a failure mode the roster diff alone can't see.
    const withoutFrontmatter = actualSkillNames().filter((name) => {
      const contents = fs.readFileSync(path.join(skillsDir, name, "SKILL.md"), "utf8");
      return !/^---\r?\n[\s\S]*?\bname:/m.test(contents) || !/\bdescription:/.test(contents);
    });

    expect(withoutFrontmatter).toEqual([]);
  });
});
