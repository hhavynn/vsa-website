/**
 * Attendance status repository (#653): one admin RPC to read, one to record a
 * statement; a missing function becomes a plain "apply the migration" message
 * and every other error is surfaced, never turned into an empty list.
 */
import { attendanceReadinessRepository, ATTENDANCE_READINESS_UNAVAILABLE } from './attendanceReadiness';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return require('../../test-utils/supabaseMock').supabaseMock.client;
  },
}));

beforeEach(() => supabaseMock.reset());

it('reads through the admin RPC with year and term', async () => {
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', {
    data: { events: [], total_events: 0, truncated: false, checked_at: '2026-10-28T00:00:00Z' }, error: null,
  });
  await expect(attendanceReadinessRepository.getReadiness(2026, 'term')).resolves.toEqual({ events: [], totalEvents: 0, truncated: false, checkedAt: '2026-10-28T00:00:00Z' });
  expect(supabaseMock.queriesFor('rpc:admin_event_attendance_readiness')[0].calls[0].args).toEqual([{ p_year: 2026, p_term_id: 'term' }]);
});

it('explains a missing function instead of returning nothing', async () => {
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', { data: null, error: postgrestError('missing', 'PGRST202') });
  await expect(attendanceReadinessRepository.getReadiness(2026, null)).rejects.toThrow(ATTENDANCE_READINESS_UNAVAILABLE);
});

it('surfaces a permission error and a malformed result', async () => {
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', { data: null, error: postgrestError('denied', '42501') });
  await expect(attendanceReadinessRepository.getReadiness(2026, null)).rejects.toBeTruthy();
  supabaseMock.queueResult('rpc:admin_event_attendance_readiness', { data: {}, error: null });
  await expect(attendanceReadinessRepository.getReadiness(2026, null)).rejects.toThrow(/returned no result/);
});

it('records a statement through the admin RPC', async () => {
  supabaseMock.queueResult('rpc:admin_attest_event_attendance', { data: {}, error: null });
  await attendanceReadinessRepository.attest('ev', 'no_signin', 'Rained out');
  expect(supabaseMock.queriesFor('rpc:admin_attest_event_attendance')[0].calls[0].args).toEqual([{ p_event_id: 'ev', p_status: 'no_signin', p_note: 'Rained out' }]);
});

describe('ACE read-only selected-event verified attendance (#649)',()=>{
  it('chunks >100 canonical member IDs, filters chosen events and never touches points',async()=>{
    const ids=Array.from({length:101},(_,i)=>'m'+i);
    supabaseMock.queueResult('member_event_attendance',{data:[{member_id:'m0',event_id:'e1'}],error:null});
    supabaseMock.queueResult('member_event_attendance',{data:[{member_id:'m100',event_id:'e2'}],error:null});
    const got=await attendanceReadinessRepository.getVerifiedSelectedAttendance(ids,['e1','e2']);
    expect(got.get('m0')).toEqual(new Set(['e1']));
    expect(got.get('m100')).toEqual(new Set(['e2']));
    const calls=supabaseMock.queriesFor('member_event_attendance');
    expect(calls).toHaveLength(2);
    calls.forEach(q=>expect(q.calls).toContainEqual({method:'in',args:['event_id',['e1','e2']]}));
    expect(calls.map(q=>q.calls.find(c=>c.method==='select')?.args[0]))
      .toEqual(['member_id,event_id','member_id,event_id']);
    expect(supabaseMock.queriesFor('members')).toHaveLength(0);
  });
  it('rejects a null-success attendance page instead of silently reporting zero credit', async () => {
    supabaseMock.queueResult('member_event_attendance', { data: null, error: null });
    await expect(attendanceReadinessRepository.getVerifiedSelectedAttendance(['m1'], ['e1']))
      .rejects.toThrow(/incomplete page/);
  });

  it('rejects a missing later page without returning partial credited attendance', async () => {
    supabaseMock.queueResult('member_event_attendance', {
      data: Array.from({ length: 500 }, () => ({ member_id: 'm1', event_id: 'e1' })),
      error: null,
    });
    supabaseMock.queueResult('member_event_attendance', { data: null, error: null });
    await expect(attendanceReadinessRepository.getPolicyEventAttendance(['m1'], ['e1']))
      .rejects.toThrow(/incomplete page/);
    expect(supabaseMock.queriesFor('member_event_attendance').map((q) =>
      q.calls.find((call) => call.method === 'range')?.args
    )).toEqual([[0, 499], [500, 999]]);
  });

  it('accepts a real empty attendance page as zero credit', async () => {
    supabaseMock.queueResult('member_event_attendance', { data: [], error: null });
    const result = await attendanceReadinessRepository.getPolicyEventAttendance(['m1'], ['e1']);
    expect(result.size).toBe(0);
  });

  it('fails whole cohort when a later attendance page is denied instead of claiming zero',async()=>{
    supabaseMock.queueResult('member_event_attendance',{
      data:Array.from({length:500},()=>({member_id:'m1',event_id:'e1'})),error:null,
    });
    supabaseMock.queueResult('member_event_attendance',{data:null,error:postgrestError('denied','42501')});
    await expect(attendanceReadinessRepository.getVerifiedSelectedAttendance(['m1'],['e1'])).rejects.toThrow();
  });
  it('refuses zero, invalid or too many eligible events',async()=>{
    await expect(attendanceReadinessRepository.getVerifiedSelectedAttendance(['m1'],[])).rejects.toThrow();
    await expect(attendanceReadinessRepository.getVerifiedSelectedAttendance(['m1'],Array.from({length:21},(_,i)=>String(i)))).rejects.toThrow();
    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
  });
});

describe('ACE saved-policy attendance read (pre-sort eligibility)',()=>{
  it('chunks more than 50 qualifying events so no request grows unbounded',async()=>{
    const events=Array.from({length:51},(_,i)=>'e'+String(i).padStart(2,'0'));
    supabaseMock.queueResult('member_event_attendance',{data:[{member_id:'m1',event_id:'e00'}],error:null});
    supabaseMock.queueResult('member_event_attendance',{data:[{member_id:'m1',event_id:'e50'}],error:null});
    const got=await attendanceReadinessRepository.getPolicyEventAttendance(['m1'],events);
    expect(got.get('m1')).toEqual(new Set(['e00','e50']));
    const eventFilters=supabaseMock.queriesFor('member_event_attendance')
      .map(q=>q.calls.find(c=>c.method==='in'&&c.args[0]==='event_id')?.args[1] as string[]);
    expect(eventFilters.map(ids=>ids.length)).toEqual([50,1]);
  });
  it('refuses zero or more than 100 events, and rows outside the requested scope',async()=>{
    await expect(attendanceReadinessRepository.getPolicyEventAttendance(['m1'],[])).rejects.toThrow();
    await expect(attendanceReadinessRepository.getPolicyEventAttendance(['m1'],Array.from({length:101},(_,i)=>String(i)))).rejects.toThrow();
    expect(supabaseMock.queriesFor('member_event_attendance')).toHaveLength(0);
    supabaseMock.queueResult('member_event_attendance',{data:[{member_id:'m-other',event_id:'e1'}],error:null});
    await expect(attendanceReadinessRepository.getPolicyEventAttendance(['m1'],['e1'])).rejects.toThrow();
  });
});
