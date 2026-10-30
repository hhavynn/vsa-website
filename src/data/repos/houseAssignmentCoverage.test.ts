import { getCompleteHouseBatchCoverage } from './houseAssignmentCoverage';
import { supabaseMock, postgrestError } from '../../test-utils/supabaseMock';

jest.mock('../../lib/supabase', () => ({
  get supabase() { return require('../../test-utils/supabaseMock').supabaseMock.client; },
}));
beforeEach(()=>supabaseMock.reset());

const row=(id:string)=>({id,source_name:'Fictional Person',member_id:'fake-id',
  house_profile_id:'fake-house',source_order:Number(id),match_status:'match'});

it('reads every batch assignment across the 1,000-row default PostgREST cap',async()=>{
  const first=Array.from({length:500},(_,i)=>row(String(i)));
  const second=Array.from({length:500},(_,i)=>row(String(i+500)));
  supabaseMock.queueResult('house_assignment_drafts',{data:first,error:null});
  supabaseMock.queueResult('house_assignment_drafts',{data:second,error:null});
  supabaseMock.queueResult('house_assignment_drafts',{data:[row('1000')],error:null});
  const rows=await getCompleteHouseBatchCoverage('batch-1');
  expect(rows).toHaveLength(1001);
  const queries=supabaseMock.queriesFor('house_assignment_drafts');
  expect(queries).toHaveLength(3);
  expect(queries.map(q=>q.calls.find(c=>c.method==='range')?.args))
    .toEqual([[0,499],[500,999],[1000,1499]]);
  queries.forEach(q=>{
    expect(q.calls).toContainEqual({method:'eq',args:['batch_id','batch-1']});
    expect(q.calls).toContainEqual({method:'select',args:['id,member_id,house_profile_id,source_name,source_order,match_status']});
  });
});

it('fails the whole coverage read on a denied later page instead of reporting misleading successes',async()=>{
  supabaseMock.queueResult('house_assignment_drafts',{data:Array.from({length:500},(_,i)=>row(String(i))),error:null});
  supabaseMock.queueResult('house_assignment_drafts',{data:null,error:postgrestError('permission denied','42501')});
  await expect(getCompleteHouseBatchCoverage('batch-1')).rejects.toThrow();
});
