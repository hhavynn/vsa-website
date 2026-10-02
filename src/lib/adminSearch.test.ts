import {
  AdminSearchRecord,
  aceRecord,
  cabinetRecord,
  collidingTitles,
  eventRecord,
  houseDraftRecord,
  internDraftRecord,
  memberRecord,
  pageRecords,
  searchAdmin,
} from './adminSearch';

const records: AdminSearchRecord[] = [
  memberRecord({ id: 'm-havyn', first_name: 'Havyn', last_name: 'Nguyen', house: 'Toad' })!,
  aceRecord({ id: 'n1', name: 'Havyn Nguyen', role_label: 'Little', family_id: 'f1' }, { name: 'Sweatpants', academic_year_start: 2026 })!,
  eventRecord({ id: 'e1', name: 'GBM 1', date: '2026-10-08T01:00:00Z', is_published: true })!,
  cabinetRecord({ id: 'c1', name: 'Ada Lovelace', role: 'President', category: 'Executive Board' }, '2026–27')!,
  cabinetRecord({ id: 'c2', name: 'Grace Hopper', role: 'Intern', category: 'Interns' }, '2026–27')!,
  internDraftRecord({ id: 'i1', name: 'Kevin Tran', cycle_id: 'cy1' }, '2026–27')!,
  houseDraftRecord({ id: 'h1', source_name: 'Kevin T.', batch_id: 'b1' }, { memberName: 'Kevin Tran', houseLabel: 'Boo', yearLabel: '2026–27' })!,
  ...pageRecords(),
];

describe('record routing', () => {
  it('opens members by canonical id, never by name', () => {
    expect(memberRecord({ id: 'a b', first_name: 'A', last_name: 'B' })?.to).toBe('/admin/members?member=a%20b');
  });

  it('opens ACE nodes by family and node id', () => {
    expect(aceRecord({ id: 'n1', name: 'Jenny', family_id: 'f1' }, undefined)?.to).toBe('/admin/ace?family=f1&node=n1');
  });

  it('routes interns to the cohort row and published interns to Cabinet', () => {
    expect(internDraftRecord({ id: 'i1', name: 'K', cycle_id: 'cy1' })?.to).toBe('/admin/interns?cycle=cy1&row=i1');
    const published = cabinetRecord({ id: 'c2', name: 'G', role: 'Intern', category: 'Interns' });
    expect(published?.type).toBe('intern');
    expect(published?.to).toBe('/admin/cabinet?member=c2');
  });

  it('routes house rows to their batch and row, events to the event', () => {
    expect(houseDraftRecord({ id: 'h1', source_name: 'K', batch_id: 'b1' }, {})?.to).toBe('/admin/houses?batch=b1&row=h1');
    expect(eventRecord({ id: 'e1', name: 'GBM 1' })?.to).toBe('/admin/events?event=e1');
  });

  it('skips records with no usable name', () => {
    expect(memberRecord({ id: 'x', first_name: ' ', last_name: null })).toBeNull();
    expect(aceRecord({ id: 'x', name: '', family_id: 'f' }, undefined)).toBeNull();
    expect(cabinetRecord({ id: 'x', name: null, role: 'R' })).toBeNull();
  });
});

describe('searchAdmin', () => {
  it('identifies the type and destination of each result', () => {
    const results = searchAdmin(records, 'havyn');
    const member = results.find((result) => result.type === 'member')!;
    const ace = results.find((result) => result.type === 'ace')!;
    expect(member.typeLine).toBe('Member · House · Toad');
    expect(member.destination).toBe('Members');
    expect(ace.typeLine).toBe('ACE · Sweatpants · Little · 2026–27');
    expect(ace.destination).toBe('ACE');
  });

  it('finds an event and sends it to Events', () => {
    const [first] = searchAdmin(records, 'gbm 1');
    expect(first).toMatchObject({ type: 'event', destination: 'Events', to: '/admin/events?event=e1' });
  });

  it('ranks exact titles above prefixes above substrings', () => {
    const set: AdminSearchRecord[] = [
      { type: 'member', id: '3', title: 'Annemarie Cho', to: '/a' },
      { type: 'member', id: '2', title: 'Ann Marie', to: '/b' },
      { type: 'member', id: '1', title: 'Marie', to: '/c' },
    ];
    expect(searchAdmin(set, 'marie').map((result) => result.id)).toEqual(['1', '2', '3']);
  });

  it('matches every token regardless of order and ignores case, accents and punctuation', () => {
    const set: AdminSearchRecord[] = [{ type: 'member', id: '1', title: 'José Nguyễn', to: '/a' }];
    expect(searchAdmin(set, 'nguyen jose')).toHaveLength(1);
    expect(searchAdmin(set, 'JOSE, nguyen!')).toHaveLength(1);
    expect(searchAdmin(set, 'jose tran')).toHaveLength(0);
  });

  it('matches admin pages by keyword and shows pages for an empty query', () => {
    expect(searchAdmin(records, 'upload')[0].to).toBe('/admin/import');
    expect(searchAdmin(records, 'mentor').some((result) => result.to === '/admin/interns')).toBe(true);
    const empty = searchAdmin(records, '   ');
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.every((result) => result.type === 'page')).toBe(true);
  });

  it('puts a person ahead of a page when they match equally well', () => {
    const set: AdminSearchRecord[] = [
      { type: 'page', id: '/admin/events', title: 'Events', to: '/admin/events' },
      { type: 'member', id: 'm', title: 'Events', to: '/admin/members?member=m' },
    ];
    expect(searchAdmin(set, 'events')[0].type).toBe('member');
  });

  it('respects the limit and returns nothing for no match', () => {
    expect(searchAdmin(records, 'n', 3)).toHaveLength(3);
    expect(searchAdmin(records, 'zzzzqqq')).toEqual([]);
  });

  it('keeps two people with the same name as separate results with their own links', () => {
    const set = [
      memberRecord({ id: 'a1', first_name: 'Andy', last_name: 'Nguyen', house: 'Boo' })!,
      memberRecord({ id: 'a2', first_name: 'Andy', last_name: 'Nguyen', house: 'Toad' })!,
    ];
    const results = searchAdmin(set, 'andy nguyen');
    expect(results.map((result) => result.to)).toEqual(['/admin/members?member=a1', '/admin/members?member=a2']);
    expect(collidingTitles(results)).toEqual(new Set(['andy nguyen']));
  });

  it('exposes only admin routes', () => {
    for (const result of searchAdmin(records, 'a', 50)) expect(result.to.startsWith('/admin')).toBe(true);
  });
});
