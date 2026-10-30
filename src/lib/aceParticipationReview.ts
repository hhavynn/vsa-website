import type { PublishedAceLittle } from '../data/repos/aceAssignments';
import type { ReadinessEvent } from '../data/repos/attendanceReadiness';
import { eventStatus } from './attendanceReadiness';

export type AceParticipationStatus='complete'|'incomplete'|'needs-review'|'unknown';
export interface AceParticipationRow {
  id:string;
  name:string;
  memberId:string|null;
  attended:number;
  required:number;
  remaining:number|null;
  status:AceParticipationStatus;
  reason:string;
}

/** Unprocessed event/import rows make eligibility Unknown, not a confident failure. */
export function isAceEventAttendanceVerified(event: ReadinessEvent, now = new Date()): boolean {
  // Reuse #653's source-lifecycle authority: a newer import, failed/in-flight
  // job, recent credit, unresolved row or future event invalidates verification.
  return eventStatus(event, now).state === 'verified';
}


export function reviewAceParticipation(
  roster: readonly PublishedAceLittle[],
  attendance: ReadonlyMap<string, ReadonlySet<string>>,
  eventIds: readonly string[],
  minEvents:number,
  evidenceComplete:boolean,
):AceParticipationRow[]{
  if(!Number.isInteger(minEvents)||minEvents<1||minEvents>20||eventIds.length<minEvents||eventIds.length>20 ||
    new Set(eventIds).size!==eventIds.length)throw new Error('Explicit valid ACE event policy is required');
  const eligible = new Set(eventIds);
  const idCount=new Map<string,number>();
  roster.forEach(row=>{if(row.little_member_id)idCount.set(row.little_member_id,(idCount.get(row.little_member_id)??0)+1);});
  return roster.map(row=>{
    const memberId=row.little_member_id;
    const attended=memberId?Array.from(attendance.get(memberId)??[]).filter(id=>eligible.has(id)).length:0;
    const defaultRow={id:row.id,name:row.little_name,memberId,attended,required:minEvents,remaining:null as number|null};
    if(!memberId || !row.published_ace_member_id)return {...defaultRow,status:'needs-review' as const,reason:'Missing canonical member or published ACE node'};
    if((idCount.get(memberId)??0)>1)return {...defaultRow,status:'needs-review' as const,reason:'Canonical member appears more than once in published cycle'};
    if(!evidenceComplete)return {...defaultRow,status:'unknown' as const,reason:'Selected event attendance/import evidence is incomplete'};
    const remaining=Math.max(0,minEvents-attended);
    return {...defaultRow,remaining,status:remaining===0?'complete' as const:'incomplete' as const,
      reason:remaining===0?'Verified selected-event requirement met':'More verified eligible event attendance required'};
  });
}
