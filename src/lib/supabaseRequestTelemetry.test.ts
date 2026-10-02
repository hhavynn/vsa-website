import { createRequestTelemetry, labelRequestPath, supabaseRequestTelemetry } from './supabaseRequestTelemetry';

const BASE = 'https://test.supabase.co';

describe('supabase request telemetry (development only)', () => {
  it('labels requests by table or function, never by query string', () => {
    expect(labelRequestPath(`${BASE}/rest/v1/events?select=*&email=eq.a@ucsd.edu`)).toBe('events');
    expect(labelRequestPath(`${BASE}/rest/v1/rpc/check_in_to_event`)).toBe('rpc/check_in_to_event');
    expect(labelRequestPath(`${BASE}/auth/v1/token?grant_type=refresh_token`)).toBe('auth/token');
    expect(labelRequestPath(`${BASE}/storage/v1/object/avatars/a.png`)).toBe('storage/object');
    expect(labelRequestPath(`${BASE}/functions/v1/vsa-ai-assistant`)).toBe('functions/vsa-ai-assistant');
    expect(labelRequestPath('not a url')).toBe('unknown');
  });

  it('reports the session total and the busiest paths first', () => {
    const telemetry = createRequestTelemetry(true);
    const hit = (path: string, times: number) => {
      for (let i = 0; i < times; i += 1) telemetry.record(`${BASE}/rest/v1/${path}?n=${i}`);
    };
    hit('events', 12);
    hit('cabinet_members', 8);
    hit('gallery_events', 6);
    hit('members', 6);

    expect(telemetry.summary()).toEqual({
      total: 32,
      topPaths: [
        { path: 'events', count: 12 },
        { path: 'cabinet_members', count: 8 },
        { path: 'gallery_events', count: 6 },
        { path: 'members', count: 6 },
      ],
    });
    expect(telemetry.format(3)).toBe(
      ['Supabase requests this session: 32', 'Top paths:', 'events: 12', 'cabinet_members: 8', 'gallery_events: 6'].join('\n'),
    );
  });

  it('keeps nothing that could identify a user or a credential', () => {
    const telemetry = createRequestTelemetry(true);
    telemetry.record(`${BASE}/rest/v1/members?email=eq.private.person@ucsd.edu`);
    expect(JSON.stringify(telemetry.summary())).not.toContain('private.person');
    expect(telemetry.format()).not.toContain('ucsd.edu');
  });

  it('resets', () => {
    const telemetry = createRequestTelemetry(true);
    telemetry.record(`${BASE}/rest/v1/events`);
    telemetry.reset();
    expect(telemetry.summary()).toEqual({ total: 0, topPaths: [] });
  });

  it('records nothing when disabled', () => {
    const telemetry = createRequestTelemetry(false);
    telemetry.record(`${BASE}/rest/v1/events`);
    expect(telemetry.summary().total).toBe(0);
  });

  it('is disabled outside development and exposes no console handle', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(supabaseRequestTelemetry.enabled).toBe(false);
    expect((window as unknown as Record<string, unknown>).__vsaSupabaseRequests).toBeUndefined();
  });
});
