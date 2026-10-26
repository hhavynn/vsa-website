/**
 * Pins the owner-confirmed 2026-2027 House data in
 * 20261026200000_house_2026_my_little_pony.sql: the four My Little Pony Houses,
 * their House Parent pairs, the "Pinkie Pie" spelling, and a scope that never
 * reaches another academic year, memberships, points or public grants.
 */
import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20261026200000_house_2026_my_little_pony.sql'),
  'utf8',
);
const code = sql.replace(/--.*$/gm, '');

function rows(prefix: string) {
  return Array.from(code.matchAll(new RegExp(`\\(${prefix}`, 'g'))).length;
}

describe('2026-2027 House migration', () => {
  it('upserts exactly the four My Little Pony Houses, in order, active, for 2026 only', () => {
    const houses = Array.from(code.matchAll(/\('([^']+)',\s+'([a-z-]+)',\s+(\d),\s+'#[0-9a-f]{6}',\s+'([^']+)'\)/g))
      .map((match) => [match[1], match[2], Number(match[3]), match[4]]);
    expect(houses).toEqual([
      ['Twilight Sparkle', 'twilight-sparkle', 0, 'Timothy (Tim) Huynh & Kent Nguyen'],
      ['Applejack', 'applejack', 1, 'Ryan Francisco & Nathan Centeno'],
      ['Pinkie Pie', 'pinkie-pie', 2, 'Ingyin Moh & Martin Dang'],
      ['Rarity', 'rarity', 3, 'Kirsten Ngo & Jonas Truong'],
    ]);
    expect(code).toMatch(/values \(2026, 2027, spec\.house/);
    expect(code).toMatch(/is_active = true/);
  });

  it('links each House Parent pair to the right House, searching Timothy Huynh as Tim Huynh too', () => {
    const parents = Array.from(code.matchAll(/\('([^']+)',\s+(\d), '([^']+)',\s+array\[([^\]]+)\]\)/g))
      .map((match) => [match[1], Number(match[2]), match[3], match[4].replace(/'/g, '').split(/,\s*/)]);
    expect(parents).toEqual([
      ['Twilight Sparkle', 0, 'Timothy (Tim) Huynh', ['timothy huynh', 'tim huynh']],
      ['Twilight Sparkle', 1, 'Kent Nguyen', ['kent nguyen']],
      ['Applejack', 0, 'Ryan Francisco', ['ryan francisco']],
      ['Applejack', 1, 'Nathan Centeno', ['nathan centeno']],
      ['Pinkie Pie', 0, 'Ingyin Moh', ['ingyin moh']],
      ['Pinkie Pie', 1, 'Martin Dang', ['martin dang']],
      ['Rarity', 0, 'Kirsten Ngo', ['kirsten ngo']],
      ['Rarity', 1, 'Jonas Truong', ['jonas truong']],
    ]);
    // Only a single exact match links; anything else stays for review, and an admin's link is kept.
    expect(code).toMatch(/case when candidate_count = 1 then candidate_id end/);
    expect(code).toMatch(/member_id = coalesce\(house_parents\.member_id, excluded\.member_id\)/);
    expect(code).not.toMatch(/insert into public\.members/);
  });

  it('spells Pinkie Pie correctly, mentioning "Pinky" only to rename a misspelled row', () => {
    const pinky = code.split('\n').filter((line) => /pinky/i.test(line));
    expect(pinky).toEqual([`    and (lower(house) = 'pinky pie' or house_key = 'pinky-pie')`]);
    expect(rows("'Pinkie Pie'")).toBeGreaterThan(0);
  });

  it('touches only 2026: no other year, no deletes, no memberships, points, attendance or views', () => {
    const years = Array.from(code.matchAll(/academic_year_start\s*=\s*(\d{4})/g)).map((match) => match[1]);
    expect(years.length).toBeGreaterThan(0);
    expect(new Set(years)).toEqual(new Set(['2026']));
    expect(code).not.toMatch(/\b2025\b|\b2024\b/);
    expect(code).not.toMatch(/delete from|truncate|drop table/i);
    expect(code).not.toMatch(/house_memberships|member_event_attendance|points|leaderboard/i);
    expect(code).not.toMatch(/create (or replace )?view|published_house_page_assets/i);
    expect(code).not.toMatch(/security definer/i);
  });

  it('keeps House Parent identity links admin-only', () => {
    expect(code).toMatch(/alter table public\.house_parents enable row level security;/);
    expect(code).toMatch(/revoke all on public\.house_parents from anon, authenticated;/);
    expect(code).not.toMatch(/grant [^;]* to anon/i);
    const policies = Array.from(code.matchAll(/create policy "[^"]+"\s+on public\.house_parents for (\w+)\s+to authenticated\s+(?:using|with check) \(public\.is_admin_user\(auth\.uid\(\)\)\)/g)).map((match) => match[1]);
    expect(policies.sort()).toEqual(['delete', 'insert', 'select', 'update']);
  });
});
