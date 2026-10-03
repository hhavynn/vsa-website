import * as fs from "fs";
import * as path from "path";

/**
 * Two PRs edit `.github/workflows/deploy.yml`: #509 adds a `workflow_dispatch` trigger
 * (the image-migration workflows start a production deploy with it, because pushes made
 * with GITHUB_TOKEN never trigger the push event) and #507 adds an `edge-functions` job
 * that `build` and `deploy-vercel` must wait for. Whichever lands second must keep both,
 * so this guards each invariant independently of the order they merge in.
 */
const repoRoot = path.resolve(__dirname, "..", "..");
const read = (file: string) => fs.readFileSync(path.join(repoRoot, ".github", "workflows", file), "utf8");

const deploy = read("deploy.yml");

/** The text of one top-level job, from its `  name:` line to the next job or EOF. */
function jobBlock(name: string): string | null {
  const jobs = deploy.slice(deploy.indexOf("\njobs:"));
  const start = jobs.search(new RegExp(`^  ${name}:\\s*$`, "m"));
  if (start === -1) return null;
  const rest = jobs.slice(start + 1);
  const next = rest.search(/^ {2}[A-Za-z0-9_-]+:\s*$/m);
  return next === -1 ? rest : rest.slice(0, next);
}

function needsOf(name: string): string[] {
  const block = jobBlock(name);
  const match = block?.match(/^ {4}needs:\s*(.+)$/m);
  if (!match) return [];
  return match[1].replace(/[[\]]/g, "").split(",").map((item) => item.trim()).filter(Boolean);
}

describe("deploy.yml keeps both #507 and #509 behavior", () => {
  it("declares workflow_dispatch under on: (needed by the image-migration workflows)", () => {
    const on = deploy.slice(deploy.indexOf("\non:"), deploy.indexOf("\nconcurrency:"));
    expect(on).toMatch(/^ {2}workflow_dispatch:/m);
    expect(on).toMatch(/^ {2}push:/m);
    expect(on).toMatch(/^ {2}pull_request:/m);
  });

  it("is dispatched by the migration workflows only while it declares workflow_dispatch", () => {
    const dispatchers = ["migrate-images.yml", "migrate-event-images.yml"].filter((file) =>
      /gh workflow run deploy\.yml/.test(read(file)),
    );
    expect(dispatchers.length).toBeGreaterThan(0);
    expect(deploy).toMatch(/^ {2}workflow_dispatch:/m);
  });

  it("the migration workflows can dispatch workflows (actions: write)", () => {
    for (const file of ["migrate-images.yml", "migrate-event-images.yml"]) {
      expect(read(file)).toMatch(/^ {2}actions: write/m);
    }
  });

  it("when an edge-functions job exists (#507), build and deploy-vercel wait for it", () => {
    if (!jobBlock("edge-functions")) return; // #507 not merged yet: nothing to preserve
    expect(needsOf("build")).toContain("edge-functions");
    expect(needsOf("deploy-vercel")).toContain("edge-functions");
  });

  it("production build and deploy still depend on test and security", () => {
    for (const job of ["build", "deploy-vercel"]) {
      expect(needsOf(job)).toEqual(expect.arrayContaining(["test", "security"]));
    }
  });
});
