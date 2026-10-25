export interface VacationBalance {
  /** Annual basic vacation length per working year (24 days by law). */
  annualDays: number;
  /** Days accrued since the employment start, may be fractional in the first working year. */
  totalDays: number;
  usedDays: number;
  plannedDays: number;
  availableDays: number;
  workingYearStart: string | null;
  workingYearEnd: string | null;
  /** First day annual vacation can start: after 6 months of continuous work (art. 10). */
  annualVacationAvailableFrom: string;
}
