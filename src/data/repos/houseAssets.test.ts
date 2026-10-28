import { houseAssetsRepository, type HousePageAssetFormData } from './houseAssets';
import { postgrestError, supabaseMock } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

const row = (house: string, display_order: number) => ({
  id: house.toLowerCase(),
  academic_year_start: 2026,
  house,
  house_key: null,
  display_name: null,
  is_active: null,
  display_order,
});

describe('houseAssetsRepository existing public/admin behavior (#291)', () => {
  it('reads only the published view for a requested year and normalizes/sorts the rows', async () => {
    supabaseMock.queueResult('published_house_page_assets', {
      data: [row('Rarity', 5), row('Applejack', 1)], error: null,
    });
    await expect(houseAssetsRepository.getPublishedAssets(2026)).resolves.toEqual([
      expect.objectContaining({ house: 'Applejack', house_key: 'Applejack', display_name: 'Applejack', is_active: true }),
      expect.objectContaining({ house: 'Rarity', house_key: 'Rarity', display_name: 'Rarity', is_active: true }),
    ]);
    expect(supabaseMock.filtersFor('published_house_page_assets')).toContainEqual(['academic_year_start', 2026]);
    expect(supabaseMock.queriesFor('house_page_assets')).toHaveLength(0);
  });

  it('does not replace explicit archived/inactive or authored fields during normalization', async () => {
    supabaseMock.queueResult('published_house_page_assets', {
      data: [{ ...row('Rarity', 1), house_key: 'rarity', display_name: 'Rarity House', is_active: false }],
      error: null,
    });
    await expect(houseAssetsRepository.getPublishedAssets(2026)).resolves.toEqual([
      expect.objectContaining({ house_key: 'rarity', display_name: 'Rarity House', is_active: false }),
    ]);
  });

  it('returns [] for missing published rows and when the public backend errors', async () => {
    supabaseMock.queueResult('published_house_page_assets', { data: null, error: null });
    await expect(houseAssetsRepository.getPublishedAssets(2026)).resolves.toEqual([]);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      supabaseMock.queueResult('published_house_page_assets', {
        data: null, error: postgrestError('permission denied', '42501'),
      });
      await expect(houseAssetsRepository.getPublishedAssets(2026)).resolves.toEqual([]);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('loads all years from the published view without reading the private base table', async () => {
    supabaseMock.queueResult('published_house_page_assets', {
      data: [row('Rarity', 2), row('Applejack', 1)], error: null,
    });
    await expect(houseAssetsRepository.getAllPublishedAssets()).resolves.toEqual([
      expect.objectContaining({ house: 'Applejack' }),
      expect.objectContaining({ house: 'Rarity' }),
    ]);
    const calls = supabaseMock.queriesFor('published_house_page_assets')[0].calls;
    expect(calls).toEqual(expect.arrayContaining([
      { method: 'order', args: ['academic_year_start', { ascending: false }] },
      { method: 'order', args: ['display_order', { ascending: true }] },
    ]));
    expect(supabaseMock.queriesFor('house_page_assets')).toHaveLength(0);
  });

  it('admin reads the base table, preserving the year filter and surfacing permission denial', async () => {
    supabaseMock.queueResult('house_page_assets', { data: [row('Rarity', 1)], error: null });
    await expect(houseAssetsRepository.getAdminAssets(2026)).resolves.toHaveLength(1);
    expect(supabaseMock.filtersFor('house_page_assets')).toContainEqual(['academic_year_start', 2026]);

    supabaseMock.queueResult('house_page_assets', { data: null, error: postgrestError('permission denied', '42501') });
    await expect(houseAssetsRepository.getAdminAssets(2026)).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('pins the current academic-year and house-key upsert conflict key without changing assets', async () => {
    const asset: HousePageAssetFormData = {
      id: 'rarity',
      house: 'Rarity',
      house_key: 'rarity',
      display_name: 'Rarity',
      academic_year_start: 2026,
      academic_year_end: 2027,
      display_order: 1,
      is_active: true,
      description: null,
      image_url: null,
      image_thumbnail_url: null,
      image_alt: null,
      cover_image_url: null,
      accent_color: null,
      emoji: null,
      house_parent_image_url: null,
      house_parent_heading: null,
      house_parent_body: null,
      source_doc_url: null,
      internal_notes: null,
    };
    supabaseMock.queueResult('house_page_assets', { data: asset, error: null });
    await expect(houseAssetsRepository.upsertAsset(asset))
      .resolves.toEqual(asset);
    const call = supabaseMock.queriesFor('house_page_assets')[0].calls.find(x => x.method === 'upsert');
    expect(call?.args).toEqual([
      expect.objectContaining({ house_key: 'rarity', academic_year_start: 2026, updated_at: expect.any(String) }),
      { onConflict: 'academic_year_start,house_key' },
    ]);
  });
});
