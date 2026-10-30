import { isAceEventAttendanceVerified, reviewAceParticipation } from './aceParticipationReview';
import type { PublishedAceLittle } from '../data/repos/aceAssignments';
import type { ReadinessEvent } from '../data/repos/attendanceReadiness';
const row=(id:string,member:string|null,published=true):PublishedAceLittle=>({
  id,little_name:'Fictional '+id,little_member_id:member,big_ace_member_id:'big',
  published_ace_member_id:published?'node-'+id:null,
});
const event=(patch:Record<string,unknown>={}):ReadinessEvent=>({
  id:'e1',name:'Synthetic GBM',date:'2026-10-15',is_published:true,academic_term_id:'fall',
  open_review_rows:0,reconciliation_pending_rows:0,reconciled_at:'2026-10-20T00:00:00Z',
  last_credit_at:null,latest_job:null,attestation:null,credits:1,
  ...patch,
} as ReadinessEvent);
describe('ACE selected-event participation decision guard (#649)',()=>{
  it('never calls an unconfigured threshold complete',()=>{
    expect(()=>reviewAceParticipation([],new Map(),[],1,true)).toThrow(/Explicit/);
    expect(()=>reviewAceParticipation([],new Map(),['e1'],0,true)).toThrow(/Explicit/);
  });
  it('counts unique verified events, not repeated credits or self-reported checkboxes',()=>{
    const map=new Map([['m1',new Set(['e1','e2'])],['m2',new Set(['e1'])]]);
    const rows=reviewAceParticipation([row('1','m1'),row('2','m2')],map,['e1','e2'],2,true);
    expect(rows.map(r=>[r.status,r.remaining,r.attended]))
      .toEqual([['complete',0,2],['incomplete',1,1]]);
  });
  it('fails closed on unlinked/pending publication, duplicates, and import uncertainty',()=>{
    const roster=[row('1',null),row('2','dup'),row('3','dup'),row('4','good',false),row('5','ok')];
    const result=reviewAceParticipation(roster,new Map([['ok',new Set(['e1'])]]),['e1'],1,false);
    expect(result.map(x=>x.status)).toEqual(['needs-review','needs-review','needs-review','needs-review','unknown']);
    expect(result[4].remaining).toBeNull();
  });
  it('invalidates prior reconciliation after a failed/newer import or post-verify credit change',()=>{
    const now=new Date('2026-10-30T12:00:00Z');
    const late='2026-10-29T00:00:00Z';
    const job={id:'job',status:'completed',created_at:late,completed_at:late,total_rows:1,review_rows:0,error_count:0};
    expect(isAceEventAttendanceVerified(event({latest_job:job}),now)).toBe(false);
    expect(isAceEventAttendanceVerified(event({latest_job:{...job,status:'failed'}}),now)).toBe(false);
    expect(isAceEventAttendanceVerified(event({latest_job:{...job,status:'processing',completed_at:null}}),now)).toBe(false);
    expect(isAceEventAttendanceVerified(event({last_credit_at:late}),now)).toBe(false);
    expect(isAceEventAttendanceVerified(event({latest_job:{...job,completed_at:'2026-10-10T00:00:00Z'}}),now)).toBe(true);
  });
  it('blocks unprocessed, termless and unpublished event status as source-verified',()=>{
    expect(isAceEventAttendanceVerified(event(),new Date('2026-10-30T12:00:00Z'))).toBe(true);
    for(const patch of [{open_review_rows:1},{reconciliation_pending_rows:2},{reconciled_at:null},
      {academic_term_id:null},{is_published:false}]){
      expect(isAceEventAttendanceVerified(event(patch),new Date('2026-10-30T12:00:00Z'))).toBe(false);
    }
  });
});
