/**
 * Draft-content leak guard for the remaining draft-bearing repositories (#292):
 * ACE families, program content and VCN archives. events and house_events have
 * their own suites.
 *
 * Same structural approach as houseEvents.test.ts: public read methods are
 * discovered by name, every one must be registered below, and each must either
 * read a `published_*` view (which filters is_published server-side) or filter
 * `is_published = true` itself. A new public method that does neither fails.
 *
 * Server side, RLS also hides drafts from anon on the base tables (verified
 * against production 2026-09-28: 1 VCN draft and 4 program-content drafts,
 * none visible to anon). This suite guards the client half.
 */

import { AceFamiliesRepository, aceFamiliesRepository } from './aceFamilies';
import { ProgramContentRepository, programContentRepository } from './programContent';
import { VCNArchivesRepository, vcnArchivesRepository } from './vcnArchives';
import { supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

type Guarded = {
  name: string;
  prototype: object;
  // Public-read naming convention for this repository.
  isPublicRead: (method: string) => boolean;
  invocations: Record<string, () => Promise<unknown>>;
  // Tables the public path may read, and the admin read that must see drafts.
  baseTable: string;
  admin: () => Promise<unknown>;
};

const PUBLIC_PREFIXES = ['getPublic', 'getPublished', 'getAllPublished', 'getCurrent'];
const isPublicRead = (method: string) => PUBLIC_PREFIXES.some((prefix) => method.startsWith(prefix));

const REPOSITORIES: Guarded[] = [
  {
    name: 'AceFamiliesRepository',
    prototype: AceFamiliesRepository.prototype,
    isPublicRead,
    invocations: {
      getPublishedFamilies: () => aceFamiliesRepository.getPublishedFamilies(),
      getAllPublishedMembers: () => aceFamiliesRepository.getAllPublishedMembers(),
      getPublishedMembersForFamily: () => aceFamiliesRepository.getPublishedMembersForFamily('family-1'),
    },
    baseTable: 'ace_families',
    admin: () => aceFamiliesRepository.getAdminFamilies(),
  },
  {
    name: 'ProgramContentRepository',
    prototype: ProgramContentRepository.prototype,
    isPublicRead,
    invocations: {
      getPublishedContent: () => programContentRepository.getPublishedContent('ace'),
    },
    baseTable: 'program_content',
    admin: () => programContentRepository.getAllContent(),
  },
  {
    name: 'VCNArchivesRepository',
    prototype: VCNArchivesRepository.prototype,
    isPublicRead,
    invocations: {
      getPublishedArchives: () => vcnArchivesRepository.getPublishedArchives(),
      getCurrentArchive: () => vcnArchivesRepository.getCurrentArchive(),
    },
    baseTable: 'vcn_archives',
    admin: () => vcnArchivesRepository.getAllArchives(),
  },
];

function excludesDrafts(): boolean {
  return supabaseMock.queries().every(
    (query) =>
      query.table.startsWith('published_') ||
      query.calls.some((call) => call.method === 'eq' && call.args[0] === 'is_published' && call.args[1] === true),
  );
}

beforeEach(() => {
  supabaseMock.reset();
});

describe.each(REPOSITORIES)('$name — public reads exclude drafts (#292)', (repo) => {
  it('has an invocation registered for every public read method', () => {
    const discovered = Object.getOwnPropertyNames(repo.prototype).filter(repo.isPublicRead).sort();
    expect(discovered).toEqual(Object.keys(repo.invocations).sort());
  });

  it.each(Object.keys(repo.invocations))('%s reads a published_* view or filters is_published = true', async (method) => {
    await repo.invocations[method]().catch(() => undefined);

    expect(supabaseMock.queries().length).toBeGreaterThan(0);
    expect(excludesDrafts()).toBe(true);
  });

  it('the admin read path deliberately sees drafts', async () => {
    await repo.admin().catch(() => undefined);

    expect(supabaseMock.queriesFor(repo.baseTable).length).toBeGreaterThan(0);
    expect(supabaseMock.filtersFor(repo.baseTable)).not.toContainEqual(['is_published', true]);
  });
});
