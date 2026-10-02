/**
 * Guards the contract of 20261002060000_link_external_events_to_events.sql.
 * The app's idempotent upsert, the UVSA SoCal rule, and the anon column
 * allowlist all depend on exact schema details, so a later edit must not
 * quietly change them.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const dir = join(process.cwd(), "supabase/migrations");
const file = readdirSync(dir).find((name) =>
  name.endsWith("_link_external_events_to_events.sql"),
);
const sql = file
  ? readFileSync(join(dir, file), "utf8").replace(/--.*$/gm, "")
  : "";

describe("link_external_events_to_events migration", () => {
  it("exists", () => {
    expect(file).toBeDefined();
  });

  it("links an event to at most one listing and removes the listing with the event", () => {
    expect(sql).toMatch(
      /source_event_id uuid references public\.events \(id\) on delete cascade/i,
    );
    // Plain (non-partial) unique index, so PostgREST can upsert on_conflict=source_event_id.
    expect(sql).toMatch(
      /create unique index \w+\s+on public\.external_events \(source_event_id\);/i,
    );
  });

  it("adds host_type for UVSA SoCal and forbids a school on a UVSA SoCal listing", () => {
    expect(sql).toMatch(/host_type text not null default 'school'/i);
    expect(sql).toMatch(/check \(host_type in \('school', 'uvsa_socal'\)\)/i);
    expect(sql).toMatch(
      /check \(host_type <> 'uvsa_socal' or uvsa_school_id is null\)/i,
    );
  });

  it("does not create a fake uvsa_schools row for UVSA SoCal", () => {
    expect(sql).not.toMatch(/insert into public\.uvsa_schools/i);
  });

  it("grants anon exactly host_type and source_event_id, never show_on_network", () => {
    const grants = sql.match(/grant select \(([^)]*)\) on public\.external_events to anon;/i);
    expect(grants).not.toBeNull();
    const columns = (grants?.[1] ?? "").split(",").map((c) => c.trim());
    expect(columns).toEqual(["host_type", "source_event_id"]);
  });

  it("changes no policy and mutates no existing rows", () => {
    expect(sql).not.toMatch(/create policy|drop policy|alter policy/i);
    expect(sql).not.toMatch(/\b(update|delete from|insert into)\b/i);
  });
});

const imageFile = readdirSync(dir).find((name) =>
  name.endsWith("_add_external_event_image.sql"),
);
const imageSql = imageFile
  ? readFileSync(join(dir, imageFile), "utf8").replace(/--.*$/gm, "")
  : "";

describe("add_external_event_image migration", () => {
  it("adds one nullable flyer column and grants anon exactly that column", () => {
    expect(imageFile).toBeDefined();
    expect(imageSql).toMatch(
      /alter table public\.external_events\s+add column image_url text;/i,
    );
    const grants = imageSql.match(
      /grant select \(([^)]*)\) on public\.external_events to anon;/i,
    );
    expect((grants?.[1] ?? "").split(",").map((c) => c.trim())).toEqual([
      "image_url",
    ]);
  });

  it("changes no policy and mutates no existing rows", () => {
    expect(imageSql).not.toMatch(/create policy|drop policy|alter policy/i);
    expect(imageSql).not.toMatch(/\b(update|delete from|insert into)\b/i);
  });

  it("sorts after the linking migration it builds on", () => {
    expect(imageFile && file && imageFile > file).toBe(true);
  });
});
