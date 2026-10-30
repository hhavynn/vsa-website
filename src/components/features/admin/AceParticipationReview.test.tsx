import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AceParticipationReview } from './AceParticipationReview';
import { aceAssignmentsRepository } from '../../../data/repos/aceAssignments';
import { attendanceReadinessRepository } from '../../../data/repos/attendanceReadiness';
jest.mock('../../../data/repos/aceAssignments',()=>({aceAssignmentsRepository:{listPublishedCycleLittles:jest.fn()}}));
jest.mock('../../../data/repos/attendanceReadiness',()=>({attendanceReadinessRepository:{getReadiness:jest.fn(),getVerifiedSelectedAttendance:jest.fn()}}));
const readiness={events:[{id:'e1',name:'Example Event',date:'2026-10-10',term_label:'Fall',is_published:true,
  academic_term_id:'term',open_review_rows:0,reconciliation_pending_rows:0,reconciled_at:'2026-10-20'}],
  totalEvents:1,truncated:false,checkedAt:'2026-10-30T00:00:00Z'};
beforeEach(()=>{
  jest.clearAllMocks();
  (attendanceReadinessRepository.getReadiness as jest.Mock).mockResolvedValue(readiness);
  (aceAssignmentsRepository.listPublishedCycleLittles as jest.Mock).mockResolvedValue([
    {id:'a',little_name:'Sample Little',little_member_id:'m1',published_ace_member_id:'node-a',big_ace_member_id:'big'}]);
  (attendanceReadinessRepository.getVerifiedSelectedAttendance as jest.Mock).mockResolvedValue(new Map([['m1',new Set(['e1'])]]));
});
it('does not assume any requirement or fetch roster before explicit approved event selection',async()=>{
  render(<AceParticipationReview cycleId="cycle-1" year={2026}/>);
  expect(aceAssignmentsRepository.listPublishedCycleLittles).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Check verified attendance'}));
  fireEvent.click(screen.getByRole('button',{name:'Load current-year event import status'}));
  expect(await screen.findByText(/Example Event/)).toBeInTheDocument();
  expect(aceAssignmentsRepository.listPublishedCycleLittles).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Minimum approved events'),{target:{value:'1'}});
  fireEvent.click(screen.getByRole('button',{name:'Evaluate published ACE roster'}));
  expect(await screen.findByText('Sample Little · complete')).toBeInTheDocument();
  expect(aceAssignmentsRepository.listPublishedCycleLittles).toHaveBeenCalledWith('cycle-1',2026);
  expect(attendanceReadinessRepository.getVerifiedSelectedAttendance).toHaveBeenCalledWith(['m1'],['e1']);
});
it('a failed member read makes every status unavailable instead of fake zero',async()=>{
  (aceAssignmentsRepository.listPublishedCycleLittles as jest.Mock).mockRejectedValue(new Error('denied'));
  render(<AceParticipationReview cycleId="cycle-1" year={2026}/>);
  fireEvent.click(screen.getByRole('button',{name:'Check verified attendance'}));
  fireEvent.click(screen.getByRole('button',{name:'Load current-year event import status'}));
  await screen.findByText(/Example Event/);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Minimum approved events'),{target:{value:'1'}});
  fireEvent.click(screen.getByRole('button',{name:'Evaluate published ACE roster'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(/denied/));
  expect(screen.queryByText('Sample Little · complete')).not.toBeInTheDocument();
});
