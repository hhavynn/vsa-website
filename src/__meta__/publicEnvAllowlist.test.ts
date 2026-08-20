import * as fs from "fs";
import * as path from "path";

/**
 * Guard against a secret reaching the public client bundle (#348).
 *
 * Create React App inlines every `REACT_APP_*` variable into the JavaScript it
 * ships to browsers. There is no such thing as a private `REACT_APP_*` value:
 * anyone can read it out of the deployed site. So the security question is not
 * "is this variable secret" but "is this variable safe to publish".
 *
 * This test answers that at the point of INTRODUCTION rather than after a build.
 * Scanning a built bundle for secret-shaped strings is the obvious alternative
 * and a worse one: it needs real credentials in CI to be meaningful, it only
 * catches key formats someone thought to write a regex for, and it fails after
 * the value has already been compiled in. An allowlist fails the moment a new
 * variable is referenced in source, with no credentials involved.
 *
 * Adding a variable here is deliberate, and that is the point — the moment you
 * edit this list is the moment to ask whether the value may be public forever.
 *
 * See also `.claude/skills/vsa-config-and-flags/` for the full configuration
 * catalog, including where genuine secrets belong instead (Supabase Edge
 * Function secrets, GitHub Actions secrets).
 */
const PUBLIC_ENV_ALLOWLIST = [
  // Supabase project endpoint. Public by construction.
  "REACT_APP_SUPABASE_URL",
  // Supabase anon key. Safe in a browser by design — Row Level Security is the
  // access boundary, not secrecy of this key. The service-role key must NEVER
  // appear here or in any REACT_APP_* variable.
  "REACT_APP_SUPABASE_ANON_KEY",
  // Google Analytics 4 measurement ID. Public identifier, consent-gated at use.
  "REACT_APP_GA4_MEASUREMENT_ID",
  // Boolean feature flag for Supabase image transforms. Carries no credential.
  "REACT_APP_SUPABASE_IMAGE_TRANSFORMS",
].sort();

const srcDir = path.resolve(__dirname, "..");

/** Every source file the CRA build can pull into the client bundle. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Every `process.env.REACT_APP_*` name referenced anywhere under src/. */
function referencedPublicEnvVars(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(srcDir)) {
    const contents = fs.readFileSync(file, "utf8");
    // exec loop rather than matchAll: tsconfig targets es5, where iterating a
    // matchAll result is a compile error (jest transpiles it fine, the build
    // does not — so matchAll passes tests and breaks `npm run build`).
    const pattern = /process\.env\.(REACT_APP_[A-Z0-9_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(contents)) !== null) {
      names.add(match[1]);
    }
  }
  return Array.from(names).sort();
}

describe("public client-bundle environment variables", () => {
  it("references no REACT_APP_* variable outside the reviewed allowlist", () => {
    const undeclared = referencedPublicEnvVars().filter(
      (name) => !PUBLIC_ENV_ALLOWLIST.includes(name),
    );

    // If this fails: the new variable's value WILL be readable by anyone in the
    // shipped bundle. Confirm it carries no secret, then add it above with a
    // comment saying why it is safe to publish.
    expect(undeclared).toEqual([]);
  });

  it("has no stale entries in the allowlist", () => {
    // Keeps the list honest — an entry nobody references is a rule nobody reads,
    // and it makes the next reviewer trust the list less.
    const referenced = referencedPublicEnvVars();
    const unused = PUBLIC_ENV_ALLOWLIST.filter((name) => !referenced.includes(name));

    expect(unused).toEqual([]);
  });

  it("declares every allowlisted variable in .env.example", () => {
    // .env.example is what a new contributor copies. A variable that is read by
    // the app but missing there produces a silently misconfigured setup — the
    // failure mode behind #323.
    const example = fs.readFileSync(path.resolve(srcDir, "..", ".env.example"), "utf8");
    const undocumented = PUBLIC_ENV_ALLOWLIST.filter((name) => !example.includes(name));

    expect(undocumented).toEqual([]);
  });

  it("contains no hardcoded secret-shaped literal in source", () => {
    // Defence in depth for the case the allowlist cannot see: a key pasted
    // directly into a file rather than read from the environment.
    const patterns: Array<{ label: string; re: RegExp }> = [
      { label: "OpenAI-style key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
      { label: "Google API key", re: /\bAIza[A-Za-z0-9_-]{30,}\b/ },
      { label: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
    ];

    const offenders: string[] = [];
    for (const file of sourceFiles(srcDir)) {
      const contents = fs.readFileSync(file, "utf8");
      for (const { label, re } of patterns) {
        if (re.test(contents)) {
          offenders.push(`${path.relative(srcDir, file)}: ${label}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
