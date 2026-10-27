/**
 * Static guards for automatic House placement: the migration only adds
 * columns (no RLS, grant or policy change, no contact fields), the feature
 * stays behind the admin route, and none of its client code can write House
 * memberships, sign anyone up, or reach a service-role key.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.resolve(root, relative), 'utf8');
const stripSqlComments = (sql: string) => sql.replace(/--.*$/gm, '');
const stripTsComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MIGRATION = 'supabase/migrations/20261026230757_house_assignment_timestamp_placement.sql';
const PLACEMENT_SOURCES = [
  'src/lib/housePlacement.ts',
  'src/lib/housePlacementImport.ts',
  'src/lib/housePlacementExport.ts',
  'src/components/features/admin/HousePlacementPanel.tsx',
  'src/components/features/admin/HousePlacementReviewPanel.tsx',
  'src/components/features/admin/HousePlacementCapacityEditor.tsx',
  'src/components/features/admin/HousePlacementResults.tsx',
  'src/components/features/admin/HousePlacementExportPanel.tsx',
];
const OVERRIDE_MIGRATION = 'supabase/migrations/20261027120000_house_placement_override_rpc.sql';

describe('placement migration', () => {
  const sql = stripSqlComments(read(MIGRATION)).toLowerCase();

  it('is additive: no RLS, policy, grant, function or destructive change', () => {
    expect(sql).not.toMatch(/\b(grant|revoke)\b/);
    expect(sql).not.toMatch(/\b(create|alter|drop) policy\b/);
    expect(sql).not.toMatch(/row level security/);
    expect(sql).not.toMatch(/security definer|create (or replace )?function|create (or replace )?view/);
    expect(sql).not.toMatch(/drop (table|column)|delete from|truncate|update public\./);
    expect(sql).not.toMatch(/house_memberships|public\.members\b/);
  });

  it('adds no email, phone or other contact column', () => {
    expect(sql).not.toMatch(/email|phone|birth|allerg/);
  });
});

describe('override RPC migration', () => {
  const sql = stripSqlComments(read(OVERRIDE_MIGRATION)).toLowerCase();

  it('adds one SECURITY INVOKER function with a pinned search_path and an admin check', () => {
    expect(sql.match(/create or replace function/g)).toHaveLength(1);
    expect(sql).toMatch(/create or replace function public\.admin_apply_house_placement_override\(/);
    expect(sql).toMatch(/security invoker/);
    expect(sql).not.toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).toMatch(/if not public\.is_admin_user\(auth\.uid\(\)\) then/);
  });

  it('revokes EXECUTE from public and anon and grants it to authenticated only', () => {
    const revoke = sql.indexOf('revoke all on function public.admin_apply_house_placement_override(uuid, jsonb, text) from public, anon, authenticated');
    const grant = sql.indexOf('grant execute on function public.admin_apply_house_placement_override(uuid, jsonb, text) to authenticated;');
    expect(revoke).toBeGreaterThan(-1);
    expect(grant).toBeGreaterThan(revoke);
    expect(sql.match(/\bgrant\b/g)).toHaveLength(1);
    expect(sql).not.toMatch(/to anon|to public|service_role/);
  });

  it('only changes draft rows: no table, policy, membership, member or points change', () => {
    // The COMMENT ON FUNCTION text documents what it never touches; check the code itself.
    const code = sql.replace(/comment on function[\s\S]*?';/g, '');
    expect(code).not.toMatch(/\b(create|alter|drop) (table|policy|view|trigger)\b/);
    expect(code).not.toMatch(/row level security|truncate|delete from|insert into/);
    expect(code).not.toMatch(/house_memberships|public\.members\b|points|attendance|leaderboard/);
    expect(code.match(/\bupdate public\.\w+/g)).toEqual(['update public.house_assignment_drafts']);
  });

  it('refuses anything but a draft, automatic batch, and checks capacity after every change', () => {
    expect(sql).toMatch(/v_batch\.status <> 'draft'/);
    expect(sql).toMatch(/v_batch\.assignment_method <> 'timestamp_ranked'/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/v_count > v_capacity/);
    expect(sql).toMatch(/a reason is required for a manual override/);
  });
});

describe('placement exports', () => {
  it('build rows only from placement fields: no email, phone, birthday, allergy or note column', () => {
    const source = stripTsComments(read('src/lib/housePlacementExport.ts'));
    expect(source).not.toMatch(/email|phone|birth|allerg|\.notes\b/i);
  });
});

describe('placement client code', () => {
  it('stays on the admin-only /admin/houses route', () => {
    const routes = read('src/routes/index.tsx');
    const adminGate = routes.indexOf('<Route element={<AdminRoute />}>');
    expect(adminGate).toBeGreaterThan(-1);
    expect(routes.indexOf('path="/admin/houses"')).toBeGreaterThan(adminGate);
    expect(routes).not.toMatch(/placement/i);
  });

  it.each(PLACEMENT_SOURCES)('%s never writes memberships, signs up users, or uses a service key', (file) => {
    const source = stripTsComments(read(file));
    expect(source).not.toMatch(/house_memberships|houseMembershipsWriteRepository|publishBatch/);
    expect(source).not.toMatch(/signUp|service_role|SERVICE_ROLE/i);
    expect(source).not.toMatch(/from '\.\.\/\.\.\/\.\.\/lib\/supabase'|from '\.\/supabase'/);
  });

  it('loads the member directory through the paged repository, not a raw query', () => {
    const page = read('src/pages/Admin/Houses.tsx');
    expect(page).not.toMatch(/\.from\('members'\)/);
    expect(page).toMatch(/memberLookupRepository\.listHouseImportMembers\(\)/);
  });
});
