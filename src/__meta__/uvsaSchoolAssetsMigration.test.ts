/**
 * The uvsa_school_assets bucket is public-by-URL / admin-only list+write and nothing else.
 * Guard the migration text so a later edit cannot quietly widen that.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const dir = join(process.cwd(), "supabase/migrations");
const file = readdirSync(dir).find((name) =>
  name.endsWith("_create_uvsa_school_assets_bucket.sql"),
);
const sql = file
  ? readFileSync(join(dir, file), "utf8").replace(/--.*$/gm, "")
  : "";

const policy = (name: string) => {
  const match = new RegExp(
    `create policy "${name}"[\\s\\S]*?;\\s*(?=drop policy|$)`,
    "i",
  ).exec(sql);
  return match ? match[0] : "";
};

describe("uvsa_school_assets bucket migration", () => {
  it("exists", () => {
    expect(file).toBeDefined();
  });

  it("creates a public bucket limited to raster images (no SVG)", () => {
    expect(sql).toMatch(/'uvsa_school_assets',\s*'uvsa_school_assets',\s*true/);
    expect(sql).toMatch(/array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
    expect(sql).not.toMatch(/svg/i);
    expect(sql).toMatch(/file_size_limit/);
  });

  it("serves objects by public URL but does not let anonymous clients list the bucket", () => {
    expect(sql).toMatch(/'uvsa_school_assets',\s*'uvsa_school_assets',\s*true/);
    // No policy may grant anon/public access to storage.objects.
    expect(sql).not.toMatch(/to anon|to public|to anon, authenticated/i);
  });

  it.each([
    ["Admins can list uvsa school assets", "select"],
    ["Admins can upload uvsa school assets", "insert"],
    ["Admins can update uvsa school assets", "update"],
  ])("%s is admin-only and scoped to the bucket", (name, verb) => {
    const body = policy(name);
    expect(body).toMatch(new RegExp(`for ${verb}`, "i"));
    expect(body).toMatch(/to authenticated/i);
    expect(body).not.toMatch(/anon/i);
    expect(body).toMatch(/public\.is_admin_user\(auth\.uid\(\)\)/);
    expect(body).toMatch(/bucket_id = 'uvsa_school_assets'/);
  });

  it("defines no DELETE policy (the repo never deletes Storage files)", () => {
    expect(sql).not.toMatch(/for delete/i);
    expect(sql).not.toMatch(/for all/i);
  });

  it("defines exactly the three expected policies", () => {
    expect(sql.match(/create policy/gi)).toHaveLength(3);
  });

  it("does not touch other buckets or tables", () => {
    expect(sql).not.toMatch(
      /uvsa_schools|external_events|ace_family_images|house_images/,
    );
  });
});
