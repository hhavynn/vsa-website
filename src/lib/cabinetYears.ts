import { CabinetYear } from '../types';

export function getCurrentCabinetYear(cabinetYears: CabinetYear[]) {
  return (
    cabinetYears.find((year) => year.is_active) ??
    [...cabinetYears].sort((a, b) => {
      const byStartYear = b.start_year - a.start_year;
      if (byStartYear !== 0) return byStartYear;
      return b.display_order - a.display_order;
    })[0] ??
    null
  );
}

export function formatCabinetYearRange(cabinetYear: CabinetYear | null | undefined) {
  if (!cabinetYear) return 'Current Cabinet';
  return `${cabinetYear.start_year}-${cabinetYear.end_year}`;
}
