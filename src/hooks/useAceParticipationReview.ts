import { useQuery } from '@tanstack/react-query';
import { aceAssignmentsRepository } from '../data/repos/aceAssignments';
import { attendanceReadinessRepository, type AttendanceReadiness } from '../data/repos/attendanceReadiness';
import { getLosAngelesDateOnly } from '../utils/losAngelesDate';
import { isAceEventAttendanceVerified, reviewAceParticipation, type AceParticipationRow } from '../lib/aceParticipationReview';

export interface AceReviewPolicy { ids: string[]; minimum: number; revision: number }

/** Every response is keyed to a frozen event policy and year. No stale policy can render. */
export function useAceParticipationReview(
  cycleId: string,
  year: number,
  expanded: boolean,
  loadEvents: boolean,
  eventVersion: number,
  policy: AceReviewPolicy | null,
) {
  const eventsQuery=useQuery<AttendanceReadiness>({
    queryKey:['ace','participation','events',cycleId,year,eventVersion],
    enabled:expanded && loadEvents,
    retry:false,staleTime:0,gcTime:0,
    queryFn:async()=>{
      const data=await attendanceReadinessRepository.getReadiness(year,null);
      if(data.truncated || data.totalEvents>data.events.length)
        throw new Error('Attendance event summary is incomplete or truncated');
      return data;
    },
  });
  const events=eventsQuery.data??null;
  const resultQuery=useQuery<AceParticipationRow[]>({
    queryKey:['ace','participation','result',cycleId,year,policy?.revision??null,policy?.ids??[],policy?.minimum??null,eventVersion],
    enabled:expanded && !!policy && !!events && !eventsQuery.isFetching && !eventsQuery.isError,
    retry:false,staleTime:0,gcTime:0,
    queryFn:async()=>{
      if(!policy||!events)throw new Error('Explicit eligible event policy required');
      const chosen=policy.ids.map(id=>events.events.find(event=>event.id===id));
      if(chosen.some(event=>!event))throw new Error('Selected event is no longer available in this year');
      const today=getLosAngelesDateOnly();
      if(chosen.some(event=>!event?.date || event.date>today))
        throw new Error('Select completed, dated events only; future events cannot count as missed attendance');
      const evidenceComplete=chosen.every(event=>event && isAceEventAttendanceVerified(event));
      const roster=await aceAssignmentsRepository.listPublishedCycleLittles(cycleId,year);
      const memberIds=Array.from(new Set(roster.map(row=>row.little_member_id).filter((id):id is string=>!!id)));
      const attendance=await attendanceReadinessRepository.getVerifiedSelectedAttendance(memberIds,policy.ids);
      return reviewAceParticipation(roster,attendance,policy.ids,policy.minimum,evidenceComplete);
    },
  });
  const busy=eventsQuery.isFetching||resultQuery.isFetching;
  const rows=policy && resultQuery.isSuccess && !busy ? resultQuery.data??null : null;
  const error=eventsQuery.error ?? (policy?resultQuery.error:null);
  return {events,rows,busy,error};
}
