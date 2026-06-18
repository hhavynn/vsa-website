import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { ApplicationCTA } from '../components/common/ApplicationCTA';
import { ProgramContentCallout } from '../components/features/program/ProgramContentCallout';
import { CabinetIntern, useCurrentCabinetInterns } from '../hooks/useCabinetInterns';
import { useProgramContent } from '../hooks/useProgramContent';
import { PROGRAM_STATUS_LABELS } from '../lib/programContent';
import { getSupabaseImageUrl } from '../lib/supabaseImages';

const pillars = [
  { title: 'Social', desc: 'Build lasting friendships with fellow interns and cabinet. Bond through GBMs, aftersocials, externals, and VSA events throughout the year.' },
  { title: 'Cultural', desc: 'Stay connected to Vietnamese culture and AAPI identity. Participate in events like Vietnamese Culture Night, Tet Fest, and other cultural programming.' },
  { title: 'Community', desc: "Help create a welcoming space for Vietnamese and non-Vietnamese students alike. Contribute to VSA's broader community and philanthropic work." },
  { title: 'Academic', desc: 'Build communication, planning, and leadership skills. Learn to balance commitment with your academic and personal goals.' },
];

const whatYouDo = [
  { title: 'Attend Meetings & Events', desc: 'Participate in intern meetings, cabinet meetings, GBMs, aftersocials, and major VSA events across the year.' },
  { title: 'Cabinet Interviews', desc: 'Connect one-on-one with cabinet members to learn what each role does, how they lead, and what the day-to-day looks like behind the scenes.' },
  { title: 'Shadow Cabinet Positions', desc: 'Work directly with cabinet to learn planning, operations, communication, and event execution. Shadowing helps you figure out where you want to grow.' },
  { title: 'Support VSA Programming', desc: 'Help with event production, logistics, promotion, and execution across cultural, social, and community-focused VSA programming.' },
  { title: 'Lead an Intern Project', desc: 'Collaborate with your fellow interns on a team project, such as an intern-led fundraiser, from idea to execution.' },
  { title: "Learn VSA's Systems", desc: "Get hands-on with the tools and processes that keep VSA running: shared drives, calendars, planning forms, reimbursements, and cross-team communication." },
];

const shadowAreas = [
  { title: 'Treasurer', desc: 'Budgeting, money handling, reimbursements, funding resources, grants, and sponsorships.' },
  { title: 'Secretary', desc: 'Room booking, venue logistics, attendance tracking, meeting minutes, and planning communication.' },
  { title: 'ICC / External', desc: 'External event coordination, union-wide collaboration, externals promotion, and ride organizing.' },
  { title: 'ACE', desc: 'Fam event planning, ACE content creation, fam relations, and spring sorting support.' },
  { title: 'Events', desc: 'Event planning, delegation, logistics, working with media, and real-time problem solving.' },
  { title: 'Media', desc: 'Social media, graphics, marketing strategy, promotion, and digital content.' },
  { title: 'PR Chair', desc: 'Short-form video, TikToks/Reels, event promo clips, and social content that helps general members interact with VSA online.' },
  { title: 'Vietnamese Culture Night', desc: 'Committee coordination, promotion, production logistics, props, scheduling, and show day support.' },
  { title: 'Community Relations', desc: 'House events, sortings, check-ins, member communications, and event calendars.' },
  { title: 'Culture & Philanthropy', desc: 'Cultural programming, culture corners, and major community-centered events.' },
  { title: 'Fundraising', desc: 'Fundraiser planning and aftersocials, merchant relationships, and sponsorship support.' },
  { title: 'Historian', desc: 'Photo capture, event documentation, media archiving, and storytelling across VSA events.' },
];

const faqs = [
  { q: 'Who should apply?', a: 'Students who want to get more involved in VSA, meet cabinet, and learn how a student organization runs behind the scenes. You do not need prior experience. The program is built to teach and mentor you.' },
  { q: 'How much time does it take?', a: 'Expect roughly 4–8 hours per week, depending on the time of quarter and upcoming events. The program spans Fall, Winter, and Spring quarters, so the commitment varies throughout the year.' },
  { q: 'What will I actually do?', a: 'Attend meetings and events, build relationships with cabinet through one-on-one interviews, shadow cabinet positions to learn how VSA operates, help support event production and logistics, and collaborate with fellow interns on a team-led project.' },
  { q: 'What skills will I build?', a: 'Leadership, communication, teamwork, event planning, logistics, professionalism, and cultural engagement. Interns also gain practical experience with the organizational systems VSA uses day to day.' },
  { q: 'Will I get mentorship?', a: 'Yes. The program is built around learning directly from cabinet members through cab interviews, shadowing, collaborative projects, and ongoing feedback throughout the year.' },
  { q: 'What positions can I shadow?', a: 'Interns may have the opportunity to shadow a range of cabinet positions, including Events, Media, Treasurer, Secretary, ACE, VCN, Fundraising, Historian, Community Relations, Culture & Philanthropy, and ICC/External, among others. Which positions are available may vary by cycle.' },
  { q: 'How do I apply?', a: 'Applications typically open in Fall Quarter and include a written questionnaire followed by an interview process. Check our Instagram or current announcements for the latest application details.' },
  { q: 'Who do I contact with questions?', a: 'Reach out to VSA through Instagram (@vsaatucsd) or speak with a board member. For program-specific questions, contact the Internal Vice President through official VSA channels.' },
];

function internInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'IN';
}

const publicUrl = process.env.PUBLIC_URL || '';

function resolveInternImageUrl(image?: string | null) {
  if (!image) return null;
  return image.startsWith('http') || image.startsWith('data:') || image.startsWith('/') ? image : `${publicUrl}/images/cabinet/${image}`;
}

function InternCard({ intern }: { intern: CabinetIntern }) {
  const imageSize = 360;
  const imageUrl = resolveInternImageUrl(intern.thumbnail_url || intern.image_url);

  return (
    <article className="program-poster-card min-w-0">
      <div
        className="aspect-[4/5] overflow-hidden rounded"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
      >
        {imageUrl ? (
          <img
            src={getSupabaseImageUrl(imageUrl, {
              width: imageSize,
              height: Math.round(imageSize * 1.25),
              resize: 'cover',
              quality: 75,
            })}
            alt={intern.name}
            width={imageSize}
            height={Math.round(imageSize * 1.25)}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <span className="font-serif text-[34px]" style={{ color: 'var(--color-text3)' }}>
              {internInitials(intern.name)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 px-1">
        <h3 className="font-sans text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{intern.name}</h3>
        {intern.role && intern.role !== 'Intern' && (
          <p className="mt-0.5 font-sans text-xs" style={{ color: 'var(--color-text3)' }}>{intern.role}</p>
        )}
      </div>
    </article>
  );
}

export function Internship() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { content: cycleContent } = useProgramContent('intern');
  const statusLabel = cycleContent ? PROGRAM_STATUS_LABELS[cycleContent.status] : '';
  const { interns, loading: internsLoading } = useCurrentCabinetInterns();
  const showInternCohort = !internsLoading && interns.length > 0;

  return (
    <>
      <PageTitle title="Intern Program" />

      <div className="program-app">
        <section className="program-hero">
          <div className="program-hero-grain" />
          <div className="program-hero-inner">
            <span className="program-hero-kicker">Leadership Cohort</span>
            <h1 className="program-title">
              Intern <span className="program-title-script">Program</span>
            </h1>
            <p className="program-hero-meta">
              A year-long leadership class for students who want to learn how VSA runs, build community, and grow into future cabinet leaders.
            </p>
            <div className="program-hero-actions">
              {cycleContent && statusLabel && cycleContent.status !== 'hidden' && (
                <span className="scrapbook-sticker scrapbook-sticker-teal">
                  {statusLabel}{cycleContent.title ? ` · ${cycleContent.title}` : ''}
                </span>
              )}
            </div>
          </div>
          <div className="program-watermark">cohort</div>
        </section>

        {cycleContent && (
          <section className="program-section">
            <div className="program-section-inner">
              <ProgramContentCallout
                content={cycleContent}
                defaultTitle="Intern Program applications"
                defaultLinkLabel="Apply Now"
              />
            </div>
          </section>
        )}

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">Intern Application</div>
            <ApplicationCTA
              applicationKeys="intern_application"
              fallback={{ closed: 'Intern applications have closed. Check back next year.' }}
            />
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner program-section-narrow">
            <div className="program-eyebrow">About the Program</div>
            <p className="program-body">
              The VSA at UCSD Intern Program is for students who want to get more involved, learn how cabinet works, and help with events throughout the year.
            </p>
          </div>
        </section>

        {showInternCohort && (
          <section className="program-section">
            <div className="program-section-inner">
              <div className="program-eyebrow">Meet the Interns</div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {interns.map((intern) => (
                  <InternCard key={intern.id} intern={intern} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">Four Pillars</div>
            <div className="program-step-grid">
              {pillars.map((p) => (
                <div key={p.title} className="program-step-card program-feature-card">
                  <div className="program-card-title">{p.title}</div>
                  <p className="program-card-copy">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">What You'll Do</div>
            <div className="program-list">
              {whatYouDo.map((item) => (
                <div key={item.title} className="program-list-row">
                  <div className="program-list-title">{item.title}</div>
                  <p className="program-list-copy">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">Shadow Areas</div>
            <div className="program-three-grid">
              {shadowAreas.map((area) => (
                <div key={area.title} className="program-feature-card">
                  <div className="program-card-title">{area.title}</div>
                  <p className="program-card-copy">{area.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-eyebrow">FAQ</div>
            <div className="program-faq-card">
              {faqs.map((faq, i) => (
                <div key={i} className="program-faq-row">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="program-faq-button"
                  >
                    <span className="program-faq-question">{faq.q}</span>
                    <span className={`program-faq-plus ${openFaq === i ? 'is-open' : ''}`}>+</span>
                  </button>
                  {openFaq === i && (
                    <div className="program-faq-answer">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="program-section">
          <div className="program-section-inner">
            <div className="program-footer-actions-rich">
              <a href="https://www.instagram.com/vsaatucsd/" target="_blank" rel="noopener noreferrer" className="vsa-btn-primary font-sans text-sm font-medium">
                Follow @vsaatucsd
              </a>
              <Link to="/get-involved" className="vsa-btn-ghost font-sans text-sm">
                ← All Programs
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
