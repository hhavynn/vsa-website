import { FALLBACK_LINKS } from "../../../config/publicFallbackContent";

const STEPS = [
  {
    title: "Find an external",
    body: "Browse the upcoming externals above and pick one you want to attend.",
  },
  {
    title: "RSVP",
    body: "Check the host school’s Linktree or Instagram for RSVP/tickets.",
  },
  {
    title: "Check UCSD rides",
    body: "If VSA at UCSD is coordinating attendance, ride forms are usually posted through our Linktree.",
    link: { label: "VSA at UCSD Linktree", href: FALLBACK_LINKS.linktree },
  },
  {
    title: "Attend & represent UCSD",
    body: "Show up respectfully and represent VSA at UCSD well. Support other VSAs the way we want others to support us!",
  },
  {
    title: "Check in for points",
    body: "Check in or follow the points proof process if announced.",
  },
] as const;

const POINTS_NOTES = [
  "Approved externals generally count for 4 points on the VSA at UCSD leaderboard.",
  "Wild N Culture earns 5 points because it is a major UCSD-hosted event and one of the biggest nights of the year.",
  "Points reward you for representing VSA at UCSD in the wider UVSA community.",
  "Cabinet and interns do not earn leaderboard points for required work duties (staffing, shifts, etc.).",
];

export function FirstExternalGuide() {
  return (
    <section
      id="first-external"
      aria-labelledby="first-external-heading"
      className="scroll-mt-24 space-y-6"
    >
      <div>
        <h2
          id="first-external-heading"
          className="font-serif text-3xl text-text-primary sm:text-4xl"
        >
          Your First External
        </h2>
        <p className="mt-2 font-sans text-sm text-text-secondary">
          Have fun, meet other schools, and bring the energy back to UCSD!
        </p>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-surface p-4 lg:flex-col"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 font-sans text-xs font-bold text-white dark:bg-brand-400 dark:text-[#050810]">
              {index + 1}
            </span>
            <div className="space-y-1">
              <h3 className="font-sans text-sm font-semibold text-text-primary">
                {step.title}
              </h3>
              <p className="font-sans text-xs leading-relaxed text-text-secondary">
                {step.body}
              </p>
              {"link" in step && (
                <a
                  href={step.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block font-sans text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                >
                  {step.link.label}
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-[var(--color-border)] bg-surface2 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-8">
          <p className="shrink-0 font-serif text-xl text-text-primary md:text-2xl">
            All externals ={" "}
            <span className="font-bold text-brand-600 dark:text-brand-400">
              4 Points
            </span>
          </p>
          <ul className="list-disc space-y-1.5 pl-5 font-sans text-sm text-text-secondary">
            {POINTS_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
