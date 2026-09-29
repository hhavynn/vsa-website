import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTitle } from '../components/common/PageTitle';
import { useTheme } from '../context/ThemeContext';
import { useProgramContent } from '../hooks/useProgramContent';
import {
  usePublishedAceFamilies,
  useAllPublishedAceFamilyMembers,
} from '../hooks/useAceFamilies';
import { PROGRAM_STATUS_LABELS, formatProgramDateTime } from '../lib/programContent';
import { AceFamily, AceFamilyMember } from '../types';
import {
  accentFromThemeColor,
  generationDepth,
  isDeadFam,
} from '../lib/aceFamilyAdapter';
import { FamAccent } from '../components/features/ace/FamCover';
import { FamSheet } from '../components/features/ace/FamSheet';
import { FamTabs } from '../components/features/ace/FamTabs';
import { GhostFamCard } from '../components/features/ace/GhostFamCard';
import { ACTIVE_FAM_SLOTS } from '../lib/aceFamRoster';
import { ApplicationCTA } from '../components/common/ApplicationCTA';
import { EditorialHero, EditorialHeroScript } from '../components/common/EditorialHero';
import '../styles/ace.css';

const ROLES = [
  { role: 'Big',    viet: 'Anh / Chị',  desc: 'A VSA member who helps welcome their Little and show them around the org. Think older sibling, mentor, or trusted friend.' },
  { role: 'Little', viet: 'Em',         desc: 'Someone paired with a Big during their VSA experience. As a Little, you get a built-in person to ask questions and hang out with.' },
  { role: 'Fam',    viet: 'Gia Đình',   desc: 'The family line built through the Big/Little system. When a Big picks up a Little and that Little later picks up their own Little, the line grows into a multi-generation family tree.' },
];

const STEPS = [
  { n: '01', t: 'Attend VSA Events',     d: 'Get involved in VSA early. Both Bigs and Littles are expected to meet participation requirements before applications open. Details are announced each cycle.' },
  { n: '02', t: 'Meet the Community',    d: 'Connect with potential Bigs or Littles at VSA events, Welcome Week activities, and ACE-hosted socials and mixers throughout the quarter.' },
  { n: '03', t: 'Apply When Ready',      d: 'When applications open, Littles share their intro materials and Bigs submit a profile. Application timelines and materials are announced each cycle.' },
  { n: '04', t: 'ACE Reveal & Fam Life', d: 'Your Big is revealed! You are officially part of a fam, with connections to a multi-generation lineage and events throughout the year.' },
];

const FAQS = [
  { q: 'What is a Big?',                          a: 'A Big (Anh/Chị) is a VSA member who helps welcome their Little and show them around the org. Think of a Big as an older sibling, mentor, or trusted friend.' },
  { q: 'What is a Little?',                       a: 'A Little (Em) is someone paired with a Big during their VSA experience. As a Little, you get a built-in person to ask questions and a connection to a fam.' },
  { q: 'What is a Fam?',                          a: 'A Fam is the family line created through the Big/Little system. When a Big picks up a Little, and that Little later picks up their own Little, the line grows into a multi-generation family tree.' },
  { q: 'How do I meet potential Bigs or Littles?', a: 'Attend VSA events and ACE socials throughout the quarter. Welcome Week and early-quarter mixers are a great time to meet people. Following VSA on Instagram is the best way to stay up to date.' },
  { q: 'Do requirements change each cycle?',       a: 'Yes. Eligibility requirements, event attendance expectations, and application materials may vary from cycle to cycle. Always refer to current VSA announcements for the latest details.' },
  { q: 'How do I know when applications open?',    a: 'Application dates are announced through VSA’s Instagram and other official channels at the start of each ACE cycle. Follow @vsaatucsd to stay informed.' },
];

interface FamDerived {
  family: AceFamily;
  accent: FamAccent;
  viet: string | null;
  members: AceFamilyMember[];
  gens: number;
  isDead: boolean;
  isPlaceholder?: boolean;
}

function createPlaceholderFam(slot: number, name: string, slug: string): FamDerived {
  const id = `placeholder-active-fam-${slug}`;
  const family: AceFamily = {
    id,
    academic_year_start: null,
    academic_year_end: null,
    name,
    slug,
    cover_image_url: null,
    theme_color: null,
    description: 'Coming soon',
    display_order: slot,
    is_published: true,
    created_at: '',
    updated_at: '',
  };

  return {
    family,
    accent: accentFromThemeColor(null, id),
    viet: null,
    members: [],
    gens: 0,
    isDead: false,
    isPlaceholder: true,
  };
}

export function Ace() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const { content: cycleContent } = useProgramContent('ace');
  const { families } = usePublishedAceFamilies();
  const { members: allMembers } = useAllPublishedAceFamilyMembers();

  const [openFamId, setOpenFamId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number>(-1);
  const [selectedFamTab, setSelectedFamTab] = useState<string | null>(null);

  const membersByFamily = useMemo(() => {
    const map = new Map<string, AceFamilyMember[]>();
    allMembers.forEach((m) => {
      const list = map.get(m.family_id) ?? [];
      list.push(m);
      map.set(m.family_id, list);
    });
    return map;
  }, [allMembers]);

  const derivedFams = useMemo<FamDerived[]>(() => {
    return families.map((f, i) => {
      const members = membersByFamily.get(f.id) ?? [];
      return {
        family: f,
        accent: accentFromThemeColor(f.theme_color, f.id),
        viet: null,
        members,
        gens: generationDepth(members),
        isDead: isDeadFam(f.name),
      };
    });
  }, [families, membersByFamily]);

  const activeFams = useMemo(() => {
    const live = derivedFams.filter((f) => !f.isDead);
    const liveBySlug = new Map(live.map((f) => [f.family.slug.toLowerCase(), f]));
    const slotted = ACTIVE_FAM_SLOTS.map((slot, i) =>
      liveBySlug.get(slot.slug) ?? createPlaceholderFam(i + 1, slot.name, slot.slug),
    );
    const extras = live.filter((f) => !ACTIVE_FAM_SLOTS.some((slot) => slot.slug === f.family.slug.toLowerCase()));

    return [...slotted, ...extras];
  }, [derivedFams]);
  const graveyardFams = useMemo(() => derivedFams.filter((f) => f.isDead), [derivedFams]);

  const openFam = openFamId ? derivedFams.find((f) => f.family.id === openFamId) ?? null : null;

  // Cycle CTA: drive from program_content('ace'). Hide if hidden/null.
  const cycleStatusLabel = cycleContent ? PROGRAM_STATUS_LABELS[cycleContent.status] : '';
  const cycleVisible = !!cycleContent && cycleContent.status !== 'hidden';
  const cycleStatusText = cycleVisible
    ? (cycleContent!.status === 'open' ? 'Applications are now open'
      : cycleContent!.status === 'coming_soon' ? 'Applications coming soon'
      : cycleContent!.status === 'closed' ? 'Applications are closed'
      : cycleContent!.status === 'active' ? cycleContent!.title || 'Active cycle'
      : '')
    : '';
  const cyclePrimaryLink = cycleVisible
    && cycleContent!.primary_link_url
    && (cycleContent!.status === 'open' || cycleContent!.status === 'active')
    ? { href: cycleContent!.primary_link_url!, label: cycleContent!.primary_link_label || 'Apply Now' }
    : null;
  const cycleMetaParts = cycleVisible
    ? [
        cycleContent!.body ?? '',
        cycleContent!.deadline_at ? `Closes ${formatProgramDateTime(cycleContent!.deadline_at)}` : '',
        cycleContent!.event_date ? `Reveal ${formatProgramDateTime(cycleContent!.event_date)}` : '',
      ].filter(Boolean)
    : [];

  const heroCycleLine = cycleVisible
    ? cycleContent!.title || cycleStatusLabel
    : '';

  return (
    <>
      <PageTitle title="ACE Program" />

      <div className={`ace-app ${dark ? 'is-dark' : ''}`}>
        {/* Hero */}
        <EditorialHero
          eyebrow="ACE · Anh Chị Em"
          title={<>Anh<EditorialHeroScript> Chị </EditorialHeroScript>Em</>}
          meta={`VSA's Big/Little family program${heroCycleLine ? ` · ${heroCycleLine}` : ''}`}
          watermark={<>gia<br />đình</>}
        />

        {/* What is ACE */}
        <section className="ace-section">
          <div className="ace-eyebrow">What is ACE?</div>
          <p className="ace-body">
            ACE stands for <span className="ace-body-strong">Anh Chị Em</span>, Vietnamese for "older brother, older sister, younger sibling." It is VSA’s Big/Little program, where members get paired into ACE fams and meet people across the org.
          </p>
        </section>

        {/* Roles */}
        <section className="ace-section">
          <div className="ace-eyebrow">Big, Little &amp; Fam</div>
          <div className="ace-rolelist">
            {ROLES.map((r, i) => (
              <div key={r.role} className="ace-rolerow">
                <div className="ace-rolerow-head">
                  <span className="ace-rolerow-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="ace-rolerow-role">{r.role}</span>
                  <span className="ace-rolerow-viet">{r.viet}</span>
                </div>
                <p className="ace-rolerow-desc">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Cycle CTA */}
        {cycleVisible && (
          <section className="ace-section">
            <div className="ace-cta-card">
              <div className="ace-cta-row">
                <div className="ace-cta-body">
                  <div className="ace-cta-status">{cycleStatusText || (cycleContent!.title ?? '')}</div>
                  {cycleContent!.title && cycleStatusText && (
                    <div className="ace-cta-cycle">{cycleContent!.title}</div>
                  )}
                </div>
                {cyclePrimaryLink && (
                  <a className="ace-btn ace-btn-primary" href={cyclePrimaryLink.href} target="_blank" rel="noopener noreferrer">
                    {cyclePrimaryLink.label} →
                  </a>
                )}
              </div>
              {cycleMetaParts.length > 0 && (
                <div className="ace-cta-meta">
                  {cycleMetaParts.map((part, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {i > 0 && <span className="ace-cta-meta-sep">·</span>}
                      <span>{part}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ACE Application */}
        <section className="ace-section">
          <div className="ace-eyebrow">Apply to ACE</div>
          <ApplicationCTA
            applicationKeys="ace_application"
            fallback={{ closed: 'ACE applications have closed. Check back next year.' }}
          />
        </section>

        {/* Fam tabs */}
        <section className="ace-section">
          <div className="ace-eyebrow">ACE Fams</div>
          {activeFams.length === 0 ? (
            <div className="ace-fam-empty">
              Active ACE fams will appear here once they're published.
            </div>
          ) : (
            <FamTabs
              fams={activeFams}
              selectedId={selectedFamTab ?? activeFams[0].family.id}
              onSelect={setSelectedFamTab}
              onOpenSheet={(id) => setOpenFamId(id)}
            />
          )}
        </section>

        {graveyardFams.length > 0 && (
          <section className="ace-section ace-graveyard-section">
            <div className="ace-eyebrow">Fam Graveyard</div>
            <p className="ace-graveyard-copy">
              Preserved ACE family lines from earlier eras.
            </p>
            <div className="ace-ghost-grid">
              {graveyardFams.map((f) => (
                <GhostFamCard
                  key={f.family.id}
                  family={f.family}
                  accent={f.accent}
                  memberCount={f.members.length}
                  gens={f.gens}
                  onOpen={() => setOpenFamId(f.family.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="ace-section">
          <div className="ace-eyebrow">How ACE Works</div>
          <div className="ace-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="ace-step">
                <div className="ace-step-num">{s.n}</div>
                <div className="ace-step-t">{s.t}</div>
                <div className="ace-step-d">{s.d}</div>
              </div>
            ))}
          </div>
          <p className="ace-section-foot">
            Eligibility requirements and application timelines are announced each cycle. Follow @vsaatucsd for current details.
          </p>
        </section>

        {/* FAQ */}
        <section className="ace-section">
          <div className="ace-eyebrow">FAQ</div>
          <div className="ace-faq">
            {FAQS.map((f, i) => (
              <div key={i} className={`ace-faq-row ${openFaq === i ? 'is-open' : ''}`}>
                <button
                  className="ace-faq-q"
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                  type="button"
                  aria-expanded={openFaq === i}
                >
                  <span>{f.q}</span>
                  <span className="ace-faq-plus" aria-hidden="true">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && <div className="ace-faq-a">{f.a}</div>}
              </div>
            ))}
          </div>
        </section>

        {/* Footer actions */}
        <div className="ace-footer-actions">
          <a
            className="ace-btn ace-btn-primary"
            href="https://www.instagram.com/vsaatucsd/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow @vsaatucsd
          </a>
          <Link to="/get-involved" className="ace-btn ace-btn-ghost">
            ← All Programs
          </Link>
        </div>

        {openFam && (
          <FamSheet
            family={openFam.family}
            members={openFam.members}
            accent={openFam.accent}
            viet={openFam.viet}
            dark={dark}
            onClose={() => setOpenFamId(null)}
          />
        )}
      </div>
    </>
  );
}
