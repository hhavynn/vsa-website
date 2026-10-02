import { useEffect, useState } from 'react';
import { adminOperationsRepository } from '../data/repos/adminOperations';
import { getAcademicYearStart } from '../lib/academicTerms';

/**
 * The academic year the admin tools treat as "current": the active term's year,
 * else the calendar's. Starts from the calendar value so the year badge never
 * flashes empty, then settles on the active term. No provider required.
 */
export function useOperatingYear(): number {
  const [yearStart, setYearStart] = useState(() => getAcademicYearStart(new Date()));
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => adminOperationsRepository.resolveYearStart())
      .then((resolved) => {
        if (!cancelled && typeof resolved === 'number') setYearStart(resolved);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return yearStart;
}
