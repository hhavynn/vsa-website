// Exercises the real @supabase/supabase-js (setupTests mocks it globally) against
// a stubbed network `fetch`, through the real src/lib/supabase.ts wiring.
import { REQUEST_GUARD_CONFIG } from './supabaseRequestGuard';

type SupabaseModule = typeof import('./supabase');

function loadClient(): SupabaseModule['supabase'] {
  let client: SupabaseModule['supabase'] | undefined;
  jest.isolateModules(() => {
    jest.doMock('@supabase/supabase-js', () => jest.requireActual('@supabase/supabase-js'));
    client = require('./supabase').supabase;
  });
  return client as SupabaseModule['supabase'];
}

describe('supabase client safety layer', () => {
  const originalFetch = global.fetch;
  let network: jest.Mock;

  beforeEach(() => {
    network = jest.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    global.fetch = network as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.dontMock('@supabase/supabase-js');
  });

  it('does not retry a failed PostgREST read', async () => {
    network.mockImplementation(async () => new Response('{"message":"upstream"}', { status: 503, headers: { 'Content-Type': 'application/json' } }));
    const supabase = loadClient();

    const { error } = await supabase.from('events').select('id');

    expect(error).toBeTruthy();
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('does not retry a PostgREST read that fails at the network level', async () => {
    network.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    const supabase = loadClient();

    await supabase.from('events').select('id');

    expect(network).toHaveBeenCalledTimes(1);
  });

  it('routes Data API calls through the circuit breaker and surfaces a normal error when it trips', async () => {
    const supabase = loadClient();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      for (let i = 0; i < REQUEST_GUARD_CONFIG.repeatMaxRequests; i += 1) {
        expect((await supabase.from('events').select('id')).error).toBeNull();
      }
      const tripped = await supabase.from('events').select('id');

      expect(tripped.error).toMatchObject({ code: 'over_request_rate_limit' });
      expect(network).toHaveBeenCalledTimes(REQUEST_GUARD_CONFIG.repeatMaxRequests);
      expect(warn).toHaveBeenCalledTimes(1);
      // Other tables still count independently, but the breaker is per tab, so they pause too.
      expect((await supabase.from('members').select('id')).error).toMatchObject({ code: 'over_request_rate_limit' });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('leaves Auth calls alone while the Data API is paused', async () => {
    const supabase = loadClient();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      for (let i = 0; i <= REQUEST_GUARD_CONFIG.repeatMaxRequests; i += 1) await supabase.from('events').select('id');
      network.mockClear();
      network.mockImplementation(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));

      await supabase.auth.getUser('not-a-real-jwt');

      expect(network).toHaveBeenCalled();
      expect(String(network.mock.calls[0][0])).toContain('/auth/v1/user');
    } finally {
      warn.mockRestore();
    }
  });
});
