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

const MIGRATION = 'supabase/migrations/20261026180000_house_assignment_timestamp_placement.sql';
const PLACEMENT_SOURCES = [
  'src/lib/housePlacement.ts',
  'src/lib/housePlacementImport.ts',
  'src/lib/housePlacementExport.ts',
  'src/components/features/admin/HousePlacementPanel.tsx',
  'src/components/features/admin/HousePlacementReviewPanel.tsx',
  'src/components/features/admin/HousePlacementCapacityEditor.tsx',
  'src/components/features/admin/HousePlacementResults.tsx',
];

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
