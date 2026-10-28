import { programContentRepository } from './programContent';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('programContentRepository public/admin boundaries (#291)', () => {
  it('filters public content by page, section, and published status with an explicit safe projection', async () => {
    const program = { id: 'program-1', title: 'Join us', is_published: true };
    supabaseMock.queueResult('program_content', { data: program, error: null });
    await expect(programContentRepository.getPublishedContent('house')).resolves.toEqual({
      ...program, source_doc_url: null, internal_notes: null,
    });
    const calls = supabaseMock.queriesFor('program_content')[0].calls;
    expect(calls).toEqual(expect.arrayContaining([
      { method: 'eq', args: ['page_key', 'house'] },
      { method: 'eq', args: ['section_key', 'current_cycle'] },
      { method: 'eq', args: ['is_published', true] },
      { method: 'limit', args: [1] },
    ]));
    const projection = String(calls.find(c => c.method === 'select')?.args[0]);
    expect(projection).toContain('is_published');
    expect(projection).not.toContain('internal_notes');
    expect(projection).not.toContain('source_doc_url');
  });

  it('uses a safe empty public state on missing rows or unavailable backend', async () => {
    supabaseMock.queueResult('program_content', { data: null, error: null });
    await expect(programContentRepository.getPublishedContent('house')).resolves.toBeNull();

    supabaseMock.queueResult('program_content', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(programContentRepository.getPublishedContent('house')).resolves.toBeNull();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('allows admin reads of all content without applying the public publication filter', async () => {
    supabaseMock.queueResult('program_content', {
      data: [{ id: 'draft', is_published: false }], error: null,
    });
    await expect(programContentRepository.getAllContent()).resolves.toEqual([
      { id: 'draft', is_published: false },
    ]);
    expect(supabaseMock.usedMethod('program_content', 'select')).toBe(true);
    expect(supabaseMock.filtersFor('program_content')).not.toContainEqual(['is_published', true]);
  });

  it('returns [] for an empty admin read but throws on a database error', async () => {
    supabaseMock.queueResult('program_content', { data: null, error: null });
    await expect(programContentRepository.getAllContent()).resolves.toEqual([]);
    supabaseMock.queueResult('program_content', {
      data: null, error: postgrestError('permission denied', '42501'),
    });
    await expect(programContentRepository.getAllContent()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('upserts content by the documented page/section composite key', async () => {
    supabaseMock.queueResult('program_content', { data: { id: 'program-1' }, error: null });
    await programContentRepository.upsertContent({
      page_key: 'house',
      section_key: 'current_cycle',
      title: 'Example',
    } as Parameters<typeof programContentRepository.upsertContent>[0]);
    const calls = supabaseMock.queriesFor('program_content')[0].calls;
    expect(calls.find(c => c.method === 'upsert')?.args).toEqual([
      expect.objectContaining({ title: 'Example', updated_at: expect.any(String) }),
      { onConflict: 'page_key,section_key' },
    ]);
  });
});
