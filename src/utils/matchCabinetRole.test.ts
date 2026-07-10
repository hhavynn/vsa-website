import { matchCabinetRole, normalizeRoleTitle } from './matchCabinetRole';

// Mirrors the shape/data seeded in the cabinet_role_descriptions migration.
const roles = [
  { role_slug: 'president', role_name: 'President', aliases: [] as string[] },
  { role_slug: 'ivp', role_name: 'Internal Vice President', aliases: [] as string[] },
  {
    role_slug: 'evp',
    role_name: 'External Vice President',
    aliases: ['Intercollegiate Council', 'ICC', 'External Vice President / ICC'],
  },
  { role_slug: 'events-chair', role_name: 'Events Chair', aliases: [] as string[] },
  { role_slug: 'media-director', role_name: 'Media Director', aliases: [] as string[] },
  { role_slug: 'historian', role_name: 'Historian', aliases: [] as string[] },
  {
    role_slug: 'ace-chair',
    role_name: 'ACE Chair',
    aliases: ['Anh Chi Em Chair', 'ACE (Anh Chi Em) Chair'],
  },
  {
    role_slug: 'cpc',
    role_name: 'Cultural Philanthropy Chair',
    aliases: ['Culture & Philanthropy Chair', 'CPC'],
  },
  {
    role_slug: 'pr-chair',
    role_name: 'Public Relations Chair',
    aliases: ['PR Chair', 'Public Relations / Media Chair'],
  },
  {
    role_slug: 'vcn-director',
    role_name: 'VCN Director',
    aliases: ['VCN Director & Executive Producer', 'Vietnamese Culture Night Director'],
  },
];

const slugFor = (title: string) => matchCabinetRole(roles, title)?.role_slug ?? null;

describe('normalizeRoleTitle', () => {
  it('strips the Co- co-chair prefix', () => {
    expect(normalizeRoleTitle('Co-President')).toBe('president');
    expect(normalizeRoleTitle('Co-Events Chair')).toBe('events chair');
  });

  it('expands ampersands and drops punctuation', () => {
    expect(normalizeRoleTitle('Culture & Philanthropy Chair')).toBe(
      'culture and philanthropy chair'
    );
  });

  it('does not strip "co" inside ordinary words', () => {
    expect(normalizeRoleTitle('Community Relations Chair')).toBe(
      'community relations chair'
    );
  });
});

describe('matchCabinetRole', () => {
  it('matches a straightforward role title exactly', () => {
    expect(slugFor('Internal Vice President')).toBe('ivp');
  });

  it('matches Co- co-chair titles to the base role', () => {
    expect(slugFor('Co-President')).toBe('president');
    expect(slugFor('Co-Events Chair')).toBe('events-chair');
    expect(slugFor('Co-Media Director')).toBe('media-director');
    expect(slugFor('Co-Historian')).toBe('historian');
  });

  it('matches ampersand and acronym aliases', () => {
    expect(slugFor('Culture & Philanthropy Chair')).toBe('cpc');
    expect(slugFor('Anh Chi Em Chair')).toBe('ace-chair');
    expect(slugFor('VCN Director & Executive Producer')).toBe('vcn-director');
  });

  it('matches a combined co-chair + acronym alias (ICC)', () => {
    expect(slugFor('Co-Intercollegiate Council')).toBe('evp');
  });

  it('matches the PR Chair role by name and alias', () => {
    expect(slugFor('Public Relations Chair')).toBe('pr-chair');
    expect(slugFor('PR Chair')).toBe('pr-chair');
  });

  it('returns null for unknown or empty titles instead of guessing', () => {
    expect(slugFor('Sports Coordinator')).toBeNull();
    expect(slugFor('')).toBeNull();
    expect(matchCabinetRole(roles, null)).toBeNull();
    expect(matchCabinetRole(roles, undefined)).toBeNull();
  });

  it('does not cross-map distinct roles', () => {
    // Bare "Vice President" must not silently attach to either VP role.
    expect(slugFor('Vice President')).toBeNull();
    // Internal vs External stay distinct.
    expect(slugFor('External Vice President')).toBe('evp');
    expect(slugFor('Internal Vice President')).toBe('ivp');
  });
});
