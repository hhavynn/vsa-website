/**
 * The Instagram migration is the source for what each school logo links to.
 * Pin the slug -> canonical URL mapping so a typo cannot silently redirect a
 * school's PFP to the wrong profile.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const dir = join(process.cwd(), "supabase/migrations");
const file = readdirSync(dir).find((name) =>
  name.endsWith("_update_uvsa_school_instagram_urls.sql"),
);
const sql = file ? readFileSync(join(dir, file), "utf8") : "";

const EXPECTED: Record<string, string> = {
  ucsd: "vsaatucsd",
  usc: "uscvsa",
  cpp: "cpp.vsa",
  chapman: "chapmanvsa",
  ucr: "ucrvsa",
  uci: "vsauci",
  sdsu: "sdsuvsa",
  ucsb: "ucsbvsa",
  csusm: "csusmvsa",
  csuf: "csufvsa",
  csulb: "lbvsa",
  cpslo: "calpolyvsa",
  csun: "csun_seasa",
};

describe("uvsa school Instagram URL migration", () => {
  it("exists", () => {
    expect(file).toBeDefined();
  });

  it("maps every slug to its canonical profile URL, exactly once", () => {
    const pairs = Array.from(
      sql.matchAll(
        /\('([a-z]+)',\s*'(https:\/\/www\.instagram\.com\/[^']+)'\)/g,
      ),
    ).map((match) => [match[1], match[2]]);
    expect(Object.fromEntries(pairs)).toEqual(
      Object.fromEntries(
        Object.entries(EXPECTED).map(([slug, handle]) => [
          slug,
          `https://www.instagram.com/${handle}/`,
        ]),
      ),
    );
    expect(pairs).toHaveLength(Object.keys(EXPECTED).length);
  });

  it("matches rows by slug and only touches instagram_url", () => {
    expect(sql).toMatch(/where slug = mapping\.slug/);
    expect(sql.match(/\bset\b/gi)).toHaveLength(1);
    expect(sql).toMatch(/set instagram_url = mapping\.instagram_url/);
    expect(sql).not.toMatch(/\b(delete|insert|alter|drop|grant|revoke)\b/i);
  });
});
