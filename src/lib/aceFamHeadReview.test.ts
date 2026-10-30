import type { AceFamily, AceFamilyMember } from '../types';
import { reviewExplicitFamHeads, isExplicitFamHeadRole } from './aceFamHeadReview';

const fam: AceFamily = {
  id: 'family-1', academic_year_start: 2026, academic_year_end: 2027,
  name: 'Fictional Family', slug: 'fictional', cover_image_url: null, theme_color: null,
  description: null, display_order: 0, is_published: true,
  created_at: '', updated_at: '',
};
const node = (id: string, role: string | null, memberId: string | null = null): AceFamilyMember => ({
  id, family_id: fam.id, name: id === 'n2' ? 'Second Example' : 'First Example',
  role_label: role, photo_url: null, parent_member_id: id === 'little' ? 'n1' : null,
  member_id: memberId, display_order: 0, is_published: true, created_at: '', updated_at: '',
});
const dir = new Map([
  ['m1', { id: 'm1', fullName: 'First Example', displayName: 'First Example · Sixth', year: '2029', college: 'Sixth' }],
  ['m2', { id: 'm2', fullName: 'Second Example', displayName: 'Second Example · Muir', year: '2029', college: 'Muir' }],
]);
it('accepts only explicit Fam Head/Co-Fam Head role labels, never Big/Little/root', () => {
  expect(['Fam Head','co-fam head','Co Fam Head','Family Head'].map(isExplicitFamHeadRole)).toEqual([true,true,true,true]);
  expect(['Big','Little','Grandbig',null,'Head of Family Council'].map(isExplicitFamHeadRole)).toEqual([false,false,false,false,false]);
  expect(reviewExplicitFamHeads(fam,[node('n1','Big','m1'),node('little','Little','m2')],dir,[],true)).toHaveLength(0);
});
it('checks year, publication, exact canonical linked person and allows distinct approved co-heads', () => {
  const rows=reviewExplicitFamHeads(fam,[node('n1','Fam Head','m1'),node('n2','Co-Fam Head','m2')],dir,[],true);
  expect(rows.map(r=>r.status)).toEqual(['verified-source','verified-source']);
  const changed=reviewExplicitFamHeads({...fam,academic_year_start:null,is_published:false},[node('n1','Fam Head','m1')],dir,[],true)[0];
  expect(changed.status).toBe('needs-review');
  expect(changed.notes).toEqual(expect.arrayContaining([expect.stringMatching(/Unpublished/),expect.stringMatching(/academic year/)]));
});
it('flags unlinked alumni, missing canonical IDs, duplicate links and renamed nodes', () => {
  const unlinked=reviewExplicitFamHeads(fam,[node('n1','Fam Head')],dir,[],true)[0];
  expect(unlinked.notes).toContain('No canonical member link');
  const missing=reviewExplicitFamHeads(fam,[node('n1','Fam Head','deleted')],dir,[],true)[0];
  expect(missing.notes).toEqual(expect.arrayContaining([expect.stringMatching(/no longer/)]));
  const duplicate=reviewExplicitFamHeads(fam,[node('n1','Fam Head','m1')],dir,
    [{nodeId:'other',memberId:'m1',nodeName:'Other',familyName:'Other Family'}],true)[0];
  expect(duplicate.notes).toEqual(expect.arrayContaining([expect.stringMatching(/another ACE node/)]));
  const renamed=reviewExplicitFamHeads(fam,[{...node('n1','Fam Head','m1'),name:'Different Name'}],dir,[],true)[0];
  expect(renamed.notes).toEqual(expect.arrayContaining([expect.stringMatching(/differs/)]));
});
it('fails closed while directory and other ACE member links are unavailable',()=>{
  const rows=reviewExplicitFamHeads(fam,[node('n1','Fam Head','m1')],new Map(),[],false);
  expect(rows[0].status).toBe('unknown');
  expect(rows[0].linkedMember).toBeNull();
});
it('does not expose draft ACE members as source-verified',()=>{
  const rows=reviewExplicitFamHeads(fam,[{...node('n1','Fam Head','m1'),is_published:false}],dir,[],true);
  expect(rows[0].status).toBe('needs-review');
  expect(rows[0].notes).toContain('Unpublished family or head node');
});
