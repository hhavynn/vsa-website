/**
 * Legacy display API retained for downstream helper compatibility.
 * The old numeric 2025 House overrides were intentionally removed from the
 * public client bundle for the #692 GBM-only House scoring embargo.
 * This function does not authorize public publication of calculated points.
 */
interface GetPublicHousePointsOptions {
  houseKey?: string | null;
  houseName?: string | null;
  academicYearStart?: number | null;
  calculatedPoints: number;
}

export function getPublicHousePoints({ calculatedPoints }: GetPublicHousePointsOptions): number {
  return calculatedPoints;
}

export function isHousePointOverrideActive(_academicYearStart?: number | null): boolean {
  return false;
}
