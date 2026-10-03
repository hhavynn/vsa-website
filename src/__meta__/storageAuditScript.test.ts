import * as fs from "fs";
import * as path from "path";
import { CATEGORIES } from "../../scripts/lib/imageMigrationConfig";
import { AUDIT_TARGETS } from "../lib/storageContentAudit";

/**
 * Guards for `scripts/audit-storage-backed-content.ts` (read-only egress audit):
 * it must stay read-only, and its table list must stay in step with the
 * migration pipeline and the generated database types.
 */
const repoRoot = path.resolve(__dirname, "..", "..");
const read = (rel: string): string => fs.readFileSync(path.join(repoRoot, rel), "utf8");

const auditScript = read("scripts/audit-storage-backed-content.ts");

/** Column names in the `Row` type of a table or view in src/types/database.ts. */
function rowColumns(name: string): string[] | null {
  const types = read("src/types/database.ts");
  const start = types.search(new RegExp(`^      ${name}: \\{\\n        Row: \\{`, "m"));
  if (start === -1) return null;
  const body = types.slice(start).split("\n        };")[0];
  return Array.from(body.matchAll(/^ {10}([a-z_0-9]+)\??:/gm)).map((m) => m[1]);
}

describe("audit-storage-backed-content script is read-only", () => {
  const code = auditScript.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("issues only select queries", () => {
    expect(code).not.toMatch(/\.(insert|update|upsert|delete|rpc)\s*\(/);
    expect(code).toMatch(/\.select\(/);
  });

  it("never touches Storage or the network by itself", () => {
    expect(code).not.toMatch(/\.storage\b/);
    expect(code).not.toMatch(/from ['"](https?|http2)['"]|fetch\(/);
    expect(code).not.toMatch(/\bunlink|rmSync|rmdir|rename/);
  });

  it("does not import the migrate script (importing it would run a migration)", () => {
    expect(code).not.toMatch(/migrate-supabase-images-to-public/);
  });

  it("is wired to an npm script", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts["audit:storage-content"]).toBe("tsx scripts/audit-storage-backed-content.ts");
  });
});

describe("audit targets stay in step with the migration pipeline", () => {
  it("has a target for every migration category, covering every image field", () => {
    Object.keys(CATEGORIES).forEach((key) => {
      const config = CATEGORIES[key];
      const target = AUDIT_TARGETS.filter((t) => t.migrationCategory === key)[0];
      expect(target).toBeDefined();
      expect(target.table).toBe(config.table);
      const audited = target.columns.map((c) => c.name);
      config.imageFields.forEach((field) => expect(audited).toContain(field.name));
    });
  });

  it("matches the CATEGORIES table in the migrate script until that script imports the shared module", () => {
    const migrate = read("scripts/migrate-supabase-images-to-public.ts");
    if (/from ['"]\.\/lib\/imageMigrationConfig['"]/.test(migrate)) return; // single source of truth now
    Object.keys(CATEGORIES).forEach((key) => {
      const config = CATEGORIES[key];
      expect(migrate).toContain(`table: '${config.table}'`);
      expect(migrate).toContain(`select: '${config.select}'`);
      expect(migrate).toContain(`outputDir: '${config.outputDir}'`);
      config.imageFields.forEach((field) =>
        expect(migrate).toContain(`{ name: '${field.name}', suffix: '${field.suffix}' }`),
      );
    });
  });

  it("only audits columns that exist in the generated database types", () => {
    AUDIT_TARGETS.forEach((target) => {
      [target.table, target.publicSource].forEach((source) => {
        if (!source) return;
        const columns = rowColumns(source);
        expect({ source, found: columns !== null }).toEqual({ source, found: true });
        target.columns.forEach((c) => expect({ source, column: c.name, ok: (columns ?? []).includes(c.name) }).toEqual({ source, column: c.name, ok: true }));
        expect({ source, id: (columns ?? []).includes(target.idColumn) }).toEqual({ source, id: true });
      });
    });
  });
});
