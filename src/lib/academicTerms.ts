export type AcademicQuarter = 'fall' | 'winter' | 'spring' | 'summer';

export interface AcademicTermMeta {
  code: string;
  label: string;
  academicYearStart: number;
  academicYearEnd: number;
  academicYearLabel: string;
  quarter: AcademicQuarter;
  calendarYear: number;
}

const QUARTER_PREFIX: Record<AcademicQuarter, string> = {
  fall: 'FA',
  winter: 'WI',
  spring: 'SP',
  summer: 'SU',
};

const QUARTER_LABEL: Record<AcademicQuarter, string> = {
  fall: 'Fall',
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
};

export function getAcademicQuarter(date: Date): AcademicQuarter {
  const month = date.getMonth() + 1;
  if (month >= 9) return 'fall';
  if (month <= 3) return 'winter';
  if (month <= 6) return 'spring';
  return 'summer';
}

export function getAcademicYearStart(date: Date): number {
  const calendarYear = date.getFullYear();
  return getAcademicQuarter(date) === 'fall' ? calendarYear : calendarYear - 1;
}

export function formatAcademicYear(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

export function getAcademicTermCode(quarter: AcademicQuarter, calendarYear: number): string {
  return `${QUARTER_PREFIX[quarter]}${String(calendarYear).slice(-2)}`;
}

export function getAcademicTermMeta(value: string | Date): AcademicTermMeta | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const quarter = getAcademicQuarter(date);
  const calendarYear = date.getFullYear();
  const academicYearStart = getAcademicYearStart(date);
  const academicYearEnd = academicYearStart + 1;

  return {
    code: getAcademicTermCode(quarter, calendarYear),
    label: `${QUARTER_LABEL[quarter]} ${calendarYear}`,
    academicYearStart,
    academicYearEnd,
    academicYearLabel: formatAcademicYear(academicYearStart),
    quarter,
    calendarYear,
  };
}

export function getAcademicTermDateRange(quarter: AcademicQuarter, calendarYear: number) {
  switch (quarter) {
    case 'fall':
      return {
        startsOn: `${calendarYear}-09-01`,
        endsOn: `${calendarYear}-12-31`,
      };
    case 'winter':
      return {
        startsOn: `${calendarYear}-01-01`,
        endsOn: `${calendarYear}-03-31`,
      };
    case 'spring':
      return {
        startsOn: `${calendarYear}-04-01`,
        endsOn: `${calendarYear}-06-30`,
      };
    case 'summer':
      return {
        startsOn: `${calendarYear}-07-01`,
        endsOn: `${calendarYear}-08-31`,
      };
  }
}

export function getAcademicTermDisplayOrder(quarter: AcademicQuarter, academicYearStart: number) {
  const quarterOrder: Record<AcademicQuarter, number> = {
    fall: 1,
    winter: 2,
    spring: 3,
    summer: 4,
  };

  return academicYearStart * 10 + quarterOrder[quarter];
}
