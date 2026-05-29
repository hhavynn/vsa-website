import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { Label } from '../components/ui/Label';
import { LEGACY_HOUSE_ARCHIVE, LegacyHouseArchiveYear, getLegacyHouseArchiveYears } from '../data/legacyHouseArchive';

const STATUS_LABEL: Record<LegacyHouseArchiveYear['status'], string> = {
  verified: 'Verified',
  unconfirmed: 'Needs alumni help',
  current: 'Current',
};

const STATUS_CLASS: Record<LegacyHouseArchiveYear['status'], string> = {
  verified: 'scrapbook-sticker-teal',
  unconfirmed: 'scrapbook-sticker-gold',
  current: 'scrapbook-sticker-coral',
};

function ArchiveYearCard({ entry, featured = false }: { entry: LegacyHouseArchiveYear; featured?: boolean }) {
  return (
    <article
      className={`scrapbook-paper p-5 sm:p-6 ${featured ? 'lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8' : ''}`}
      style={{ borderColor: entry.status === 'unconfirmed' ? 'var(--tape-gold)' : 'var(--color-border)' }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`scrapbook-sticker ${STATUS_CLASS[entry.status]} px-2 py-0.5 text-[9px]`}>
            {STATUS_LABEL[entry.status]}
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text3)' }}>
            {entry.academicYear}
          </span>
        </div>
        <h2 className="mt-3 font-serif text-[28px] leading-tight" style={{ color: 'var(--color-text)' }}>
          {entry.title}
        </h2>
        <p className="mt-1 font-sans text-sm font-semibold" style={{ color: 'var(--color-text2)' }}>
          {entry.theme}
        </p>
      </div>

      <div className={featured ? 'mt-5 lg:mt-0' : 'mt-5'}>
        <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
          {entry.note}
        </p>
        <p className="mt-3 font-sans text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
          {entry.detail}
        </p>
        {entry.caution && (
          <p className="mt-3 rounded border px-3 py-2 font-sans text-xs leading-relaxed" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)', background: 'var(--color-surface2)' }}>
            {entry.caution}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {entry.houses.length > 0 ? (
            entry.houses.map((house) => {
              const href = entry.currentHouseLinks?.[house];
              const chip = (
                <span className="scrapbook-sticker px-2 py-1 text-[10px]">
                  {house}
                </span>
              );
              return href ? (
                <Link key={house} to={href} className="transition-opacity hover:opacity-75">
                  {chip}
                </Link>
              ) : (
                <span key={house}>{chip}</span>
              );
            })
          ) : (
            <span className="rounded-full border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text3)' }}>
              No confirmed Houses yet
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function HouseArchive() {
  const years = getLegacyHouseArchiveYears();
  const currentEra = LEGACY_HOUSE_ARCHIVE.find((entry) => entry.status === 'current') ?? years[0];
  const previousYears = years.filter((entry) => entry !== currentEra);

  return (
    <>
      <PageTitle title="House Archive" />
      <div className="vsa-page-hero">
        <div className="vsa-container relative z-10">
          <Link to="/house" className="font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Back to House Program
          </Link>
          <div className="mt-8 max-w-4xl">
            <Label className="mb-4">House Legacy</Label>
            <h1 className="vsa-page-title">VSA Houses Have Lore</h1>
            <p className="mt-5 max-w-2xl font-sans text-[16px] leading-[1.75]" style={{ color: 'var(--text2)' }}>
              Houses reset every year, but the lore sticks around. Some years had four Houses, one year had three, and one year is still a mystery.
            </p>
            <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--text3)' }}>
              This archive is based on verified VSA records. Older years may still need alumni help, so tell cabinet if you remember a missing detail.
            </p>
          </div>
        </div>
      </div>

      <main className="vsa-container py-12 lg:py-16">
        <section className="mb-10 rounded border p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text3)' }}>
              Current year / {currentEra.academicYear}
            </div>
            <h2 className="mt-2 font-serif text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
              {currentEra.title}
            </h2>
            <p className="mt-1 max-w-2xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
              {currentEra.note}
            </p>
          </div>
          <Link to="/house" className="vsa-btn-primary mt-5 inline-flex shrink-0 font-sans text-sm sm:mt-0">
            View current House year
          </Link>
        </section>

        <section>
          <div className="mb-6">
            <Label className="mb-2">Timeline</Label>
            <h2 className="font-serif text-[32px] leading-tight" style={{ color: 'var(--color-text)' }}>
              House eras we could verify
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {previousYears.map((entry) => (
              <ArchiveYearCard key={entry.academicYear} entry={entry} />
            ))}
          </div>
        </section>

        <section className="mt-14 rounded border p-5 sm:p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}>
          <h2 className="font-serif text-2xl" style={{ color: 'var(--color-text)' }}>Archive note</h2>
          <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed" style={{ color: 'var(--color-text2)' }}>
            No private Drive links, check-in sheets, rosters, payment details, or member records are shown here. The public archive only summarizes House names, themes, and member-friendly notes.
          </p>
        </section>
      </main>
    </>
  );
}
