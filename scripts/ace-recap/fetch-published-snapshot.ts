/**
 * Read-only copy of the PUBLISHED ACE tree, through the same public views the
 * /ace page reads (published_ace_families / published_ace_family_members).
 * Uses only the public anon/publishable key. Writes nothing to Supabase.
 *
 *   REACT_APP_SUPABASE_URL=… REACT_APP_SUPABASE_ANON_KEY=… \
 *   npx tsx scripts/ace-recap/fetch-published-snapshot.ts --out ~/vsa-ace-private/snapshot
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertPrivateDir, requireArg } from './privateIo';

async function main() {
  const out = assertPrivateDir(requireArg('out'));
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY (public anon key only).');
  const get = async (view: string, select: string) => {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${url}/rest/v1/${view}?select=${select}&order=id`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
      });
      if (!res.ok) throw new Error(`${view}: HTTP ${res.status}`);
      const page = (await res.json()) as unknown[];
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  };
  const families = await get('published_ace_families', '*');
  const members = await get('published_ace_family_members',
    'id,family_id,name,parent_member_id,member_id,role_label,pickup_academic_year_start,pickup_term,display_order');
  writeFileSync(path.join(out, 'families.json'), JSON.stringify(families, null, 2));
  writeFileSync(path.join(out, 'members.json'), JSON.stringify(members, null, 2));
  writeFileSync(path.join(out, 'fetched-at.json'), JSON.stringify({ fetchedAt: new Date().toISOString() }));
  console.log(`Saved ${families.length} families and ${members.length} published nodes to ${out}`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
