import { PageTitle } from '../components/common/PageTitle';
import { FALLBACK_LINKS } from '../config/publicFallbackContent';

function NoticeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--color-border)] pt-8">
      <h2 className="font-serif text-2xl font-bold tracking-tight text-[var(--color-text)]">{title}</h2>
      <div className="mt-3 space-y-3 font-sans text-sm leading-7 text-[var(--color-text2)]">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <>
      <PageTitle title="Privacy Notice" />
      <div className="bg-[var(--color-bg)] px-4 py-14 sm:py-20">
        <article className="mx-auto max-w-3xl">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-brand-600 dark:text-brand-400">
            Privacy and data use
          </p>
          <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight text-[var(--color-text)] sm:text-5xl">
            Privacy Notice
          </h1>
          <p className="mt-5 font-sans text-base leading-7 text-[var(--color-text2)]">
            This plain-language notice explains how the VSA at UCSD website uses information. It is a transparency notice,
            not a contract or a substitute for UC San Diego policies. Last updated June 19, 2026.
          </p>

          <div className="mt-12 space-y-10">
            <NoticeSection title="Information used by the site">
              <p>
                Depending on the feature, the site may use a name, email address, profile photo, membership or House details,
                points and attendance records, feedback, uploaded media, application-link interactions, and technical usage data.
                Optional fields are marked where the site collects them directly.
              </p>
              <p>
                Member and admin features may also use account identifiers and sign-in session data. Do not submit passwords,
                payment details, check-in codes, government identifiers, or other sensitive information through feedback or Ask VSA.
              </p>
            </NoticeSection>

            <NoticeSection title="How information is used and shared">
              <p>
                VSA uses information to operate events and programs, maintain member records, calculate and correct points,
                respond to feedback, publish approved organization content, prevent abuse, and administer the website.
              </p>
              <p>
                Public pages may show information intended for community recognition, such as names, points or leaderboard placement,
                House affiliation, cabinet and program profiles, and approved event or gallery media. Detailed attendance, contact details,
                check-in information, private rosters, admin notes, and feedback contact fields are not intended for public display.
              </p>
            </NoticeSection>

            <NoticeSection title="Forms, applications, feedback, and media">
              <p>
                Application buttons can open a form operated by another service. Review that form's disclosures before submitting;
                the outside service may process information under its own settings and policies.
              </p>
              <p>
                Feedback is reviewed by authorized VSA website administrators. A name and email are optional and should be included only
                if a response is wanted. Photos or other media submitted to VSA, or captured at VSA activities, may appear in approved
                public galleries or program pages.
              </p>
            </NoticeSection>

            <NoticeSection title="Ask VSA">
              <p>
                Ask VSA sends your question, limited recent conversation context, a session identifier, and the current page to the site's
                AI service to generate a response. Questions may be processed by VSA's AI service provider. Use it only for public VSA
                questions and do not include private, personal, or confidential information.
              </p>
            </NoticeSection>

            <NoticeSection title="Analytics and browser storage">
              <p>
                If Google Analytics is configured, it remains off until you select “Allow analytics.” When allowed, VSA uses limited
                page-view information without URL query strings to understand site usage. Google Analytics may then use analytics
                identifiers in cookies or browser storage. You can change that choice from the footer.
              </p>
              <p>
                The site also uses browser storage for functional choices and features, including theme, analytics preference, temporary
                error recovery, event-interest choices, Ask VSA's session identifier, and authentication sessions where sign-in is enabled.
                Declining analytics does not disable this functional storage.
              </p>
            </NoticeSection>

            <NoticeSection title="Retention and requests">
              <p>
                Information is kept only as long as it remains useful for the relevant program, event, operational, safety, recordkeeping,
                or archival purpose. Some historical organization records, points, leadership information, and approved media may be kept
                as an archive. VSA should review records periodically and remove or de-identify information that is no longer needed.
              </p>
              <p>
                To ask what information VSA maintains about you, request a correction or deletion review, or raise a privacy concern,
                contact VSA through its official{' '}
                <a
                  href={FALLBACK_LINKS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-600 underline underline-offset-2 dark:text-brand-400"
                >
                  Instagram account
                </a>
                . VSA may need to verify your identity and may need to retain limited records for legitimate operational or legal reasons.
              </p>
            </NoticeSection>
          </div>
        </article>
      </div>
    </>
  );
}
