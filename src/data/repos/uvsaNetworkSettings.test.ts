import {
  DEFAULT_UVSA_NETWORK_PAGE_SETTINGS,
  uvsaNetworkSettingsRepository,
} from './uvsaNetworkSettings';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

describe('uvsaNetworkSettingsRepository', () => {
  it('reads only the main settings row and returns it when present', async () => {
    const row = { ...DEFAULT_UVSA_NETWORK_PAGE_SETTINGS, hero_title: 'Community Network' };
    supabaseMock.queueResult('uvsa_network_page_settings', { data: row, error: null });
    await expect(uvsaNetworkSettingsRepository.getSettings()).resolves.toEqual(row);
    expect(supabaseMock.filtersFor('uvsa_network_page_settings')).toEqual([['id', 'main']]);
    expect(supabaseMock.usedMethod('uvsa_network_page_settings', 'maybeSingle')).toBe(true);
  });

  it('falls back to approved static content when no saved row exists', async () => {
    supabaseMock.queueResult('uvsa_network_page_settings', { data: null, error: null });
    await expect(uvsaNetworkSettingsRepository.getSettings()).resolves.toEqual(
      DEFAULT_UVSA_NETWORK_PAGE_SETTINGS
    );
  });

  it('does not conceal a server permission error behind fallback content', async () => {
    supabaseMock.queueResult('uvsa_network_page_settings', {
      data: null,
      error: postgrestError('permission denied', '42501'),
    });
    await expect(uvsaNetworkSettingsRepository.getSettings()).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });

  it('uses an upsert for admin edits and surfaces the saved row', async () => {
    const { updated_at, ...input } = DEFAULT_UVSA_NETWORK_PAGE_SETTINGS;
    const saved = { ...input, updated_at: '2026-10-27T00:00:00Z', hero_title: 'Updated' };
    supabaseMock.queueResult('uvsa_network_page_settings', { data: saved, error: null });
    await expect(uvsaNetworkSettingsRepository.updateSettings(input)).resolves.toEqual(saved);
    const query = supabaseMock.queriesFor('uvsa_network_page_settings')[0].calls;
    expect(query.find((call) => call.method === 'upsert')?.args[0]).toEqual(input);
    expect(supabaseMock.usedMethod('uvsa_network_page_settings', 'single')).toBe(true);
  });

  it('does not report a successful admin save when the server rejects the update', async () => {
    const { updated_at, ...input } = DEFAULT_UVSA_NETWORK_PAGE_SETTINGS;
    supabaseMock.queueResult('uvsa_network_page_settings', {
      data: null,
      error: postgrestError('permission denied', '42501'),
    });
    await expect(uvsaNetworkSettingsRepository.updateSettings(input)).rejects.toMatchObject({
      name: 'DatabaseError', code: '42501',
    });
  });
});
