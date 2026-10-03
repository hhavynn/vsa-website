import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "../..");
const script = path.join(repoRoot, "scripts/verify-rls-security.mjs");
const workflow = path.join(repoRoot, ".github/workflows/rls-verify.yml");

// The hosted verifier runs against production, but the retirement migration is
// applied by hand after merge. These tests pin the rollout design so CI stays
// valid both before and after that moment.
describe("RLS verifier retirement phases", () => {
  it("rejects an unknown phase before touching the network", () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        REACT_APP_SUPABASE_URL: "http://127.0.0.1:9",
        REACT_APP_SUPABASE_ANON_KEY: "not-a-real-key",
        RLS_RETIREMENT_PHASE: "someday",
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("RLS_RETIREMENT_PHASE must be one of");
  });

  it("defaults to the pre-migration phase that matches current production", () => {
    const source = fs.readFileSync(script, "utf8");
    expect(source).toMatch(
      /process\.env\.RLS_RETIREMENT_PHASE \|\| 'pre-migration'/,
    );
  });

  it("only requires 42501 on the legacy archives in the post-migration phase", () => {
    const source = fs.readFileSync(script, "utf8");
    expect(source).toMatch(/if \(retired\) \{\s*await expectRetiredArchivesDenied\(anon/);
    // The anon RPC denial holds both before and after the migration.
    expect(source).toContain("anon cannot call check_in_to_event");
  });

  it("lets the workflow follow the rollout without a code change", () => {
    const yaml = fs.readFileSync(workflow, "utf8");
    expect(yaml).toContain(
      "RLS_RETIREMENT_PHASE: ${{ inputs.retirement_phase || vars.RLS_RETIREMENT_PHASE }}",
    );
    expect(yaml).toMatch(/retirement_phase:[\s\S]*post-migration/);
  });
});
