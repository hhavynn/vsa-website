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

  describe("post-migration fails closed without signed-in test accounts", () => {
    const CREDENTIALS = {
      RLS_TEST_USER_EMAIL: "ordinary@example.invalid",
      RLS_TEST_USER_PASSWORD: "x",
      RLS_TEST_ADMIN_EMAIL: "admin@example.invalid",
      RLS_TEST_ADMIN_PASSWORD: "x",
    };

    // Unreachable host: these runs must end before any request is attempted.
    function runPostMigration(credentials: Record<string, string>) {
      const env: NodeJS.ProcessEnv = { ...process.env };
      for (const name of Object.keys(CREDENTIALS)) delete env[name];
      return spawnSync(process.execPath, [script], {
        cwd: repoRoot,
        encoding: "utf8",
        timeout: 15000,
        env: {
          ...env,
          ...credentials,
          REACT_APP_SUPABASE_URL: "http://127.0.0.1:9",
          REACT_APP_SUPABASE_ANON_KEY: "not-a-real-key",
          RLS_RETIREMENT_PHASE: "post-migration",
        },
      });
    }

    it("fails, rather than skips, with no credentials at all", () => {
      const result = runPostMigration({});
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("requires an existing ordinary authenticated test account AND an approved admin account");
      expect(result.stderr).toContain("do not create a public member account");
      expect(result.stdout).not.toContain("SKIP");
    });

    it("fails when only the ordinary account is configured", () => {
      const result = runPostMigration({
        RLS_TEST_USER_EMAIL: CREDENTIALS.RLS_TEST_USER_EMAIL,
        RLS_TEST_USER_PASSWORD: CREDENTIALS.RLS_TEST_USER_PASSWORD,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("RLS_TEST_ADMIN_EMAIL");
      expect(result.stderr).toContain("RLS_TEST_ADMIN_PASSWORD");
      expect(result.stderr).not.toContain("RLS_TEST_USER_EMAIL");
    });

    it("fails when only the admin account is configured", () => {
      const result = runPostMigration({
        RLS_TEST_ADMIN_EMAIL: CREDENTIALS.RLS_TEST_ADMIN_EMAIL,
        RLS_TEST_ADMIN_PASSWORD: CREDENTIALS.RLS_TEST_ADMIN_PASSWORD,
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("RLS_TEST_USER_EMAIL");
      expect(result.stderr).not.toContain("RLS_TEST_ADMIN_EMAIL");
    });

    it("never turns a missing signed-in section into a SKIP in this phase", () => {
      const source = fs.readFileSync(script, "utf8");
      expect(source).toContain("ordinary authenticated user checks cannot be skipped after the retirement migration");
      expect(source).toContain("admin checks cannot be skipped after the retirement migration");
    });

    it("asserts the retired archives for anon, ordinary users and admins", () => {
      const source = fs.readFileSync(script, "utf8");
      expect(source).toContain("expectRetiredArchivesDenied(anon, 'anon')");
      expect(source).toContain("expectRetiredArchivesDenied(userClient, 'ordinary user')");
      expect(source).toContain("expectRetiredArchivesDenied(adminClient, 'admin')");
    });

    it("keeps the signed-in sections optional before the migration", () => {
      const source = fs.readFileSync(script, "utf8");
      expect(source).toContain("reportSkip('ordinary authenticated user checks (email/password not provided in env)')");
      expect(source).toContain("reportSkip('admin checks (email/password not provided in env)')");
    });

    it("fails the workflow with a clear message before running the script", () => {
      const yaml = fs.readFileSync(workflow, "utf8");
      const gate = yaml.indexOf("Require signed-in test accounts for post-migration verification");
      const run = yaml.indexOf("name: Verify RLS and grants");
      expect(gate).toBeGreaterThan(-1);
      expect(gate).toBeLessThan(run);
      expect(yaml).toMatch(/\(inputs\.retirement_phase \|\| vars\.RLS_RETIREMENT_PHASE\) == 'post-migration'/);
      expect(yaml).toContain("::error title=Post-migration RLS verification cannot be skipped");
      for (const name of Object.keys(CREDENTIALS)) {
        expect(yaml).toContain(`${name}: \${{ secrets.${name} }}`);
      }
    });
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

// Same rollout design for 20261009232329_admin_member_lookup_rpcs.sql. After
// the migration a missing lookup RPC must fail the run, and "protected" must
// mean the function's own admin check, with admins proven able to call it.
describe("RLS verifier member lookup phases", () => {
  const CREDENTIALS = ["RLS_TEST_USER_EMAIL", "RLS_TEST_USER_PASSWORD", "RLS_TEST_ADMIN_EMAIL", "RLS_TEST_ADMIN_PASSWORD"];

  // Unreachable host: these runs must end before any request is attempted.
  function run(phase: string) {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const name of CREDENTIALS) delete env[name];
    return spawnSync(process.execPath, [script], {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...env,
        REACT_APP_SUPABASE_URL: "http://127.0.0.1:9",
        REACT_APP_SUPABASE_ANON_KEY: "not-a-real-key",
        RLS_RETIREMENT_PHASE: "pre-migration",
        RLS_MEMBER_LOOKUP_PHASE: phase,
      },
    });
  }

  it("rejects an unknown phase before touching the network", () => {
    const result = run("someday");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("RLS_MEMBER_LOOKUP_PHASE must be one of");
  });

  it("post-migration fails, rather than skips, without both signed-in accounts", () => {
    const result = run("post-migration");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("requires an existing ordinary authenticated test account AND an approved admin account");
    expect(result.stdout).not.toContain("SKIP");
  });

  it("defaults to pre-migration and only skips a missing lookup RPC in that phase", () => {
    const source = fs.readFileSync(script, "utf8");
    expect(source).toMatch(/process\.env\.RLS_MEMBER_LOOKUP_PHASE \|\| 'pre-migration'/);
    expect(source).toMatch(/if \(lookupsRequired\) reportFail\([\s\S]*?\);\s*else reportSkip\(/);
    expect(source).toContain("if (retired || lookupsRequired) {");
    for (const who of ["'anon'", "'ordinary user'", "'admin'"]) {
      expect(source).toContain(`reportMissingLookup(fn, ${who})`);
    }
  });

  it("accepts only the function's own refusal for an ordinary user, and requires admins to succeed", () => {
    const source = fs.readFileSync(script, "utf8");
    expect(source).toContain("uError.message === 'Only admins can look up members'");
    expect(source).toContain("authenticated may have lost EXECUTE");
    expect(source).toMatch(/adminClient\.rpc\(fn, args\)[\s\S]*?Array\.isArray\(aData\)/);
  });

  it("lets the workflow follow the rollout and fail closed without a code change", () => {
    const yaml = fs.readFileSync(workflow, "utf8");
    expect(yaml).toMatch(/RLS_MEMBER_LOOKUP_PHASE: \$\{\{ inputs\.member_lookup_phase \|\| vars\.RLS_MEMBER_LOOKUP_PHASE \}\}/);
    expect(yaml).toMatch(/member_lookup_phase:[\s\S]*post-migration/);
    expect(yaml).toMatch(/\(inputs\.member_lookup_phase \|\| vars\.RLS_MEMBER_LOOKUP_PHASE\) == 'post-migration'/);
  });
});
