import { normalizeVcnRole, reviewVcnRoleCsv } from './vcnRoleRosterReview';
import type { MemberOption } from './memberLinkMatching';

const member=(id:string,fullName:string):MemberOption=>({id,fullName,displayName:fullName+' · Muir',college:'Muir',year:'Fourth'});
const directory=[member('m1','Đặng Ánh'),member('m2','Alex Lee'),member('m3','Alex Lee')];

describe('VCN role CSV intake preview (#683)',()=>{
  it('maps only approved four roles; never collapses distinct creative jobs',()=>{
    expect(['Choreographer','VCN Dancer','Stage Ninja','Props Member'].map(normalizeVcnRole))
      .toEqual(['VCN Choreographer','VCN Dancer','VCN Stage Ninja','VCN Props Member']);
    expect(normalizeVcnRole('Stage Manager')).toBeNull();
    expect(normalizeVcnRole('Props Master')).toBeNull();
    expect(normalizeVcnRole('Dancer/Choreographer')).toBeNull();
  });
  it('retains separate verified roles, Vietnamese diacritics and quoted CSV cells',()=>{
    const csv='name,role,status\n"Dang Anh",Dancer,verified\n"Đặng Ánh",Choreographer,verified\n"Alex, Example",Props Member,verified';
    const rows=reviewVcnRoleCsv(csv,directory).rows;
    expect(rows[0]).toMatchObject({role:'VCN Dancer',candidateIds:['m1'],state:'ready-for-human-review'});
    expect(rows[1]).toMatchObject({role:'VCN Choreographer',candidateIds:['m1'],state:'ready-for-human-review'});
    expect(rows[2].state).toBe('unknown-identity');
  });
  it('flags tentative/interest, same-name duplicates, unknown ID and different roles independently',()=>{
    const csv='name\trole\tstatus\nAlex Lee\tDancer\tverified\nAlex Lee\tDancer\tverified\nNora\tStage Ninja\tinterest\nNora\tProps Master\tverified';
    expect(reviewVcnRoleCsv(csv,directory).rows.map(r=>r.state))
      .toEqual(['ambiguous-identity','duplicate','tentative','invalid-role']);
  });
  it('fails closed when required evidence headers are missing or CSV is malformed',()=>{
    expect(()=>reviewVcnRoleCsv('name,role\nFoo,Dancer',directory)).toThrow(/verification/);
    expect(()=>reviewVcnRoleCsv('name,role,status\n"Foo,Dancer,verified',directory)).toThrow(/Unclosed/);
    expect(()=>reviewVcnRoleCsv('name,role,status\nFoo,"Dancer"x,verified',directory)).toThrow(/Unexpected/);
    expect(()=>reviewVcnRoleCsv('x'.repeat(500001),directory)).toThrow(/500 KB/);
  });
});
