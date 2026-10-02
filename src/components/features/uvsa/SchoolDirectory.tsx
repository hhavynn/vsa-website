import { useMemo, useState } from "react";
import { UVSASchool } from "../../../types";
import { cn } from "../../../lib/utils";
import {
  SCHOOL_FILTERS,
  SchoolFilter,
  countSchoolsBySystem,
  filterSchoolsBySystem,
} from "../../../lib/uvsaNetwork";
import { Skeleton } from "../../ui/Skeleton";
import { SchoolCard } from "./SchoolCard";

const GRID =
  "grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function SchoolDirectory({
  heading,
  schools,
  loading,
}: {
  heading: string;
  schools: UVSASchool[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState<SchoolFilter>("All");
  const counts = useMemo(() => countSchoolsBySystem(schools), [schools]);
  const visible = useMemo(
    () => filterSchoolsBySystem(schools, filter),
    [schools, filter],
  );

  return (
    <section
      id="schools"
      aria-labelledby="schools-heading"
      className="scroll-mt-24 space-y-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2
          id="schools-heading"
          className="font-serif text-3xl text-text-primary sm:text-4xl"
        >
          {heading}
        </h2>

        {!loading && schools.length > 0 && (
          <div
            role="group"
            aria-label="Filter schools by system"
            className="flex flex-wrap gap-2"
          >
            {SCHOOL_FILTERS.filter(
              (option) => option === "All" || counts[option] > 0,
            ).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={cn(
                  "min-h-[36px] rounded-full border px-3.5 py-1.5 font-sans text-xs font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 dark:focus-visible:ring-brand-400",
                  filter === option
                    ? "border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400 dark:text-[#050810]"
                    : "border-[var(--color-border)] bg-surface text-text-secondary hover:bg-surface2 hover:text-text-primary",
                )}
              >
                {option} <span className="opacity-70">{counts[option]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className={GRID} aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border)] bg-surface p-5"
            >
              <Skeleton className="h-20 w-20 rounded-full sm:h-24 sm:w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className={GRID}>
          {visible.map((school) => (
            <SchoolCard key={school.id} school={school} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center font-sans text-sm text-text-secondary">
          Schools will be listed here soon.
        </p>
      )}
    </section>
  );
}
