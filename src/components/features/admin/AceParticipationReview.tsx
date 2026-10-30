import { useEffect, useRef, useState } from 'react';
import { aceAssignmentsRepository } from '../../../data/repos/aceAssignments';
import { attendanceReadinessRepository, type AttendanceReadiness } from '../../../data/repos/attendanceReadiness';
import { isAceEventAttendanceVerified, reviewAceParticipation, type AceParticipationRow } from '../../../lib/aceParticipationReview';

/**
 * Admin-only, read-only ACE participation investigation. An ACE Chair must
 * explicitly choose eligible event IDs and minimum each time; nothing is
 * stored as an approved year/quarter policy and no points are written.
 */
export function AceParticipationReview({cycleId,year}:{cycleId:string;year:number}) {
  const [expanded,setExpanded]=useState(false);
  const [events,setEvents]=useState<AttendanceReadiness|null>(null);
  const [selected,setSelected]=useState<ReadonlySet<string>>(new Set());
  const [minimum,setMinimum]=useState('');
  const [rows,setRows]=useState<AceParticipationRow[]|null>(null);
  const [filter,setFilter]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const request=useRef(0);
  useEffect(()=>{
    request.current++;
    setEvents(null);setSelected(new Set());setMinimum('');setRows(null);setError('');setFilter('');
  },[cycleId,year]);
  const refreshEvents=async()=>{
    const token=++request.current;
    setBusy(true);setError('');setRows(null);setSelected(new Set());
    try{
      const data=await attendanceReadinessRepository.getReadiness(year,null);
      if(token!==request.current)return;
      if(data.truncated || data.totalEvents>data.events.length){
        throw new Error('Attendance event summary is incomplete or truncated; cannot approve an ACE review.');
      }
      setEvents(data);
    }catch(e){
      if(token===request.current){setEvents(null);setError(e instanceof Error?e.message:'Attendance data unavailable');}
    }finally{if(token===request.current)setBusy(false);}
  };
  const evaluate=async()=>{
    const token=++request.current;
    setBusy(true);setError('');setRows(null);
    try{
      const rule=Number(minimum);
      const ids=Array.from(selected);
      if(!events||!ids.length||ids.length>20||!Number.isInteger(rule)||rule<1||rule>ids.length)
        throw new Error('Select 1–20 eligible events and a valid minimum; no ACE requirement is assumed.');
      const checkedEvents=ids.map(id=>events.events.find(event=>event.id===id));
      if(checkedEvents.some(event=>!event))throw new Error('Selected event is no longer in the reviewed year');
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if(checkedEvents.some(event=>!event?.date || event.date>today))throw new Error('Select completed, dated events only; upcoming or undated events cannot count as missed attendance');
      const sourceReady=checkedEvents.every(event=>event && isAceEventAttendanceVerified(event));
      const roster=await aceAssignmentsRepository.listPublishedCycleLittles(cycleId,year);
      const memberIds=Array.from(new Set(roster.map(row=>row.little_member_id).filter((id):id is string=>!!id)));
      const verified=await attendanceReadinessRepository.getVerifiedSelectedAttendance(memberIds,ids);
      if(token!==request.current)return;
      setRows(reviewAceParticipation(roster,verified,ids,rule,sourceReady));
    }catch(e){
      if(token===request.current)setError(e instanceof Error?e.message:'ACE participation verification failed');
    }finally{if(token===request.current)setBusy(false);}
  };
  const visible=(rows??[]).filter(row=>(row.name+' '+row.status).toLowerCase().includes(filter.toLowerCase())).slice(0,100);
  const complete=rows?.filter(r=>r.status==='complete').length??0;
  const unknown=rows?.filter(r=>r.status==='unknown'||r.status==='needs-review').length??0;
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-label="ACE verified attendance requirements review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold text-[var(--color-text)]">ACE participation requirements review</h3>
          <p className="text-xs text-[var(--color-text2)]">Published-cycle Littles · {year}–{year+1} · private/read-only</p>
        </div>
        <button type="button" className="vsa-btn-secondary min-h-11" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
          {expanded?'Hide requirements':'Check verified attendance'}
        </button>
      </div>
      {expanded&&(
        <div className="mt-4 space-y-4">
          <p className="text-sm text-[var(--color-text2)]">
            Select the ACE Chair-approved qualifying event IDs and minimum for this review.
            No event automatically qualifies based on points, and this temporary selection is <strong>not a saved quarter policy</strong>.
            Orphans and Bigs outside this published Little cohort are not included in the counts.
          </p>
          <button type="button" className="vsa-btn-secondary min-h-11" onClick={()=>void refreshEvents()} disabled={busy}>
            {busy?'Reading…':'Load current-year event import status'}
          </button>
          {error&&<p role="alert" className="text-sm text-red-600">Verification unavailable: {error}. No completed requirements are claimed.</p>}
          {events&&(
            <>
              <p className="text-xs text-[var(--color-text2)]">
                Event import snapshot checked {new Date(events.checkedAt).toLocaleString()}.
                Events with unresolved imports or no reconciliation keep final status Unknown.
              </p>
              {events.events.length===0 ? <p className="text-sm text-[var(--color-text2)]">No year-scoped events returned. No requirements can be evaluated.</p> : (
                <fieldset className="max-h-56 overflow-y-auto rounded border border-[var(--color-border)] p-3">
                  <legend className="px-1 text-sm font-semibold text-[var(--color-text)]">Select eligible events (max 20)</legend>
                  {events.events.map(event=>(
                    <label key={event.id} className="flex min-h-11 items-center gap-3 border-b border-[var(--color-border)] py-2 text-sm">
                      <input type="checkbox" checked={selected.has(event.id)}
                        onChange={e=>{
                          setSelected(old=>{const next=new Set(old);if(e.target.checked && next.size<20)next.add(event.id);else if(!e.target.checked)next.delete(event.id);return next;});
                          setRows(null);
                        }}/>
                      <span>{event.name} · {event.date||'no date'} · {event.term_label||'unassigned term'}
                        {!isAceEventAttendanceVerified(event)?' · import evidence incomplete':''}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-sm font-semibold text-[var(--color-text)]" htmlFor="ace-minimum">
                  Minimum approved events
                  <input id="ace-minimum" type="number" min={1} max={20} step={1} value={minimum}
                    onChange={e=>{setMinimum(e.target.value);setRows(null);}}
                    className="mt-1 block min-h-11 w-28 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3"/>
                </label>
                <button type="button" className="vsa-btn-primary min-h-11" disabled={busy||!selected.size||!minimum}
                  onClick={()=>void evaluate()}>{busy?'Evaluating…':'Evaluate published ACE roster'}</button>
              </div>
            </>
          )}
          {rows&&(
            <div aria-live="polite">
              <p className="text-sm font-semibold text-[var(--color-text)]">
                {rows.length} published Little rows · {complete} verified complete · {unknown} unknown/needs identity review.
                These are not acceptance or matching decisions.
              </p>
              <label htmlFor="ace-participation-filter" className="mt-3 block text-xs text-[var(--color-text2)]">Filter by member name or status</label>
              <input id="ace-participation-filter" type="search" value={filter} onChange={e=>setFilter(e.target.value)}
                className="mt-1 min-h-11 w-full max-w-sm rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2"/>
              <ul className="mt-3 space-y-2">
                {visible.map(row=>(
                  <li key={row.id} className="rounded border border-[var(--color-border)] p-3 text-sm">
                    <p className="font-semibold text-[var(--color-text)]">{row.name} · {row.status}</p>
                    <p className="text-xs text-[var(--color-text2)]">
                      {row.reason} · {row.attended} verified selected event{row.attended===1?'':'s'}
                      {row.remaining!==null?' · '+row.remaining+' remaining':''}
                    </p>
                  </li>
                ))}
              </ul>
              {(rows.length-visible.length)>0 && <p className="mt-3 text-xs text-[var(--color-text2)]">Showing up to 100 matching rows. Narrow the filter to inspect more.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
