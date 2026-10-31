import {
  PUBLIC_ROLE_KINDS, relatedPublicPath, rolesForSelectedYear, shapePublicMemberRoles,
  type PublicMemberRoleRow,
} from './memberRoles';

const row = (member_id: string, kind: string, label: string, year = 2026, related_key: string | null = null): PublicMemberRoleRow => ({
  member_id, kind, label, academic_year_start: year, source_type: 'cabinet_members', related_key,
});

describe('public role projection (#623)', () => {
  it('orders Board, two positions, House Parent, ACE, Intern and VCN deterministically', () => {
    const map = shapePublicMemberRoles([
      row('one','intern','Intern'), row('one','cabinet_position','PR Chair'),
      row('one','board','Board Member'), row('one','cabinet_position','Events Chair'),
      row('one','house_parent','House Parent · Fictional',2026,'fictional'),
      row('one','ace_fam_head','ACE Fam Head'), row('one','vcn_dancer','VCN Dancer'),
    ], ['one'], 2026);
    expect(map.get('one')?.map(r => r.label)).toEqual([
      'Board Member','Events Chair','PR Chair','House Parent · Fictional','ACE Fam Head','Intern','VCN Dancer',
    ]);
    expect(PUBLIC_ROLE_KINDS).toHaveLength(9);
  });

  it('deduplicates repeated kinds case-insensitively without losing other positions', () => {
    const map = shapePublicMemberRoles([
      row('one','board','Board Member'),row('one','board',' BOARD member '),
      row('one','cabinet_position','Events Chair'),row('one','cabinet_position',' events chair '),
      row('one','cabinet_position','PR Chair'),
    ],['one'],2026);
    expect(map.get('one')?.map(r=>r.label)).toEqual(['Board Member','Events Chair','PR Chair']);
  });

  it('ignores an unsupported backend role kind and blank labels on older clients', () => {
    expect(shapePublicMemberRoles([
      row('one','future_hidden_kind','Private'),row('one','board','  '),row('one','intern','Intern'),
    ],['one'],2026).get('one')?.map(r=>r.kind)).toEqual(['intern']);
  });

  it('rejects foreign members and years, never trusting a bad RPC response', () => {
    expect(() => shapePublicMemberRoles([row('foreign','board','Board Member')],['one'],2026)).toThrow(/foreign year or member/);
    expect(() => shapePublicMemberRoles([row('one','board','Board Member',2025)],['one'],2026)).toThrow(/foreign year or member/);
    expect(shapePublicMemberRoles([],['one'],2026)).toEqual(new Map());
  });

  it('links a House Parent through a sanitized key only, never an arbitrary role', () => {
    const roles = shapePublicMemberRoles([
      row('one','house_parent','House Parent · Fictional',2026,'Fictional House'),
      row('one','board','Board Member'),
    ],['one'],2026).get('one')!;
    expect(relatedPublicPath(roles.find(r=>r.kind==='house_parent')!)).toBe('/house/year/2026-2027/fictional-house');
    expect(relatedPublicPath(roles.find(r=>r.kind==='board')!)).toBeNull();
    expect(relatedPublicPath({...roles[0],relatedKey:null})).toBeNull();
  });

  it('never presents archived roles as live or on All-Time', () => {
    const map = shapePublicMemberRoles([row('one','board','Board Member',2025)],['one'],2025);
    expect(rolesForSelectedYear(map,'one',2025)).toHaveLength(1);
    expect(rolesForSelectedYear(map,'one',2026)).toEqual([]);
    expect(rolesForSelectedYear(map,'one','all')).toEqual([]);
  });

  it('keeps unsafe-looking labels as plain React text', () => {
    expect(shapePublicMemberRoles([row('one','cabinet_position','<img src=x onerror=alert(1)>')],['one'],2026)
      .get('one')?.[0].label).toBe('<img src=x onerror=alert(1)>');
  });
});
