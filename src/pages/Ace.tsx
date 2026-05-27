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
  getDisplayFamName,
  isDeadFam,
  patternForFamily,
} from '../lib/aceFamilyAdapter';
import { FamAccent, FamCover } from '../components/features/ace/FamCover';
import { FamSheet } from '../components/features/ace/FamSheet';
import '../styles/ace.css';

// Members whose role_label contains these strings are treated as fam heads.
const FAM_HEAD_KEYWORDS = ['fam head', 'family head', 'head'];
function isFamHead(roleLabel: string | null): boolean {
  if (!roleLabel) return false;
  const lower = roleLabel.toLowerCase();
  return FAM_HEAD_KEYWORDS.some((kw) => lower.includes(kw));
}

const ROLES = [
  { role: 'Big',    viet: 'Anh / Chị',  desc: 'A supportive VSA member who helps guide and welcome their Little into the community. Think of your Big as an older sibling, mentor, or trusted friend.' },
  { role: 'Little', viet: 'Em',         desc: 'Someone who receives support and guidance from their Big. As a Little, you gain a built-in support system and a connection to an entire fam.' },
  { role: 'Fam',    viet: 'Gia Đình',   desc: 'The family line built through the Big/Little system. When a Big picks up a Little and that Little later picks up their own Little, the line grows into a multi-generation family tree.' },
];

const STEPS = [
  { n: '01', t: 'Attend VSA Events',     d: 'Get involved in VSA early. Both Bigs and Littles are expected to meet participation requirements before applications open — details are announced each cycle.' },
  { n: '02', t: 'Meet the Community',    d: 'Connect with potential Bigs or Littles at VSA events, Welcome Week activities, and ACE-hosted socials and mixers throughout the quarter.' },
  { n: '03', t: 'Apply When Ready',      d: 'When applications open, Littles share their intro materials and Bigs submit a profile. Application timelines and materials are announced each cycle.' },
  { n: '04', t: 'ACE Reveal & Fam Life', d: 'Your Big is revealed! You’re officially part of a fam — with connections to a multi-generation lineage and seasonal programming throughout the year.' },
];

const FAQS = [
  { q: 'What is a Big?',                          a: 'A Big (Anh/Chị) is a supportive VSA member who helps guide and welcome their Little into the community. Think of a Big as an older sibling, mentor, or trusted friend.' },
  { q: 'What is a Little?',                       a: 'A Little (Em) is someone who receives support and guidance from their Big during their VSA experience. As a Little, you gain a built-in support system and a connection to a fam.' },
  { q: 'What is a Fam?',                          a: 'A Fam is the family line created through the Big/Little system. When a Big picks up a Little, and that Little later picks up their own Little, the line grows into a multi-generation family tree.' },
  { q: 'How do I meet potential Bigs or Littles?', a: 'Attend VSA events and ACE socials throughout the quarter. Welcome Week and early-quarter mixers are a great time to meet people. Following VSA on Instagram is the best way to stay up to date.' },
  { q: 'Do requirements change each cycle?',       a: 'Yes — eligibility requirements, event attendance expectations, and application materials may vary from cycle to cycle. Always refer to current VSA announcements for the latest details.' },
  { q: 'How do I know when applications open?',    a: 'Application dates are announced through VSA’s Instagram and other official channels at the start of each ACE cycle. Follow @vsaatucsd to stay informed.' },
];

const ACTIVE_FAM_SLOTS = [
  { name: 'Sweatpants', slug: 'sweatpants' },
  { name: 'Sunshine', slug: 'sunshine' },
  { name: 'Underwater', slug: 'underwater' },
  { name: 'Down', slug: 'down' },
  { name: 'Moon', slug: 'moon' },
  { name: 'Cross', slug: 'cross' },
  { name: 'Bang Mi', slug: 'bang-mi' },
  { name: 'NSF', slug: 'nsf' },
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
        <section className="ace-hero">
          <div className="ace-hero-grain" aria-hidden="true" />
          <div className="ace-hero-inner">
            <div className="ace-eyebrow">ACE · Anh Chị Em</div>
            <h1 className="ace-hero-title">
              Anh<span className="ace-hero-script"> Chị </span>Em
            </h1>
            <p className="ace-hero-meta">
              VSA's Big/Little family program{heroCycleLine ? ` · ${heroCycleLine}` : ''}
            </p>
          </div>
          <div className="ace-hero-watermark" aria-hidden="true">gia<br/>đình</div>
        </section>

        {/* What is ACE */}
        <section className="ace-section">
          <div className="ace-eyebrow">What is ACE?</div>
          <p className="ace-body">
            ACE stands for <span className="ace-body-strong">Anh Chị Em</span> — Vietnamese for "older brother, older sister, younger sibling." It is VSA's Big/Little family program built to help members find mentorship, community, and a family away from home.
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

        {/* Fam tabs */}
        <section className="ace-section">
          <div className="ace-eyebrow">ACE Fams</div>
          {activeFams.length === 0 ? (
            <div className="ace-fam-empty">
              Active ACE fams will appear here once they're published.
            </div>
          ) : (
            <FamsTabSection
              activeFams={activeFams}
              selectedId={selectedFamTab ?? activeFams[0].family.id}
              onSelect={setSelectedFamTab}
              onOpenSheet={(id) => setOpenFamId(id)}
              dark={dark}
            />
          )}
        </section>

        {graveyardFams.length > 0 && (
          <section className="ace-section ace-graveyard-section">
            <div className="ace-eyebrow">Fam Graveyard</div>
            <p className="ace-graveyard-copy">
              Preserved ACE family lines from earlier eras.
            </p>
            <div className="ace-fam-grid ace-graveyard-grid">
              {graveyardFams.map((f) => (
                <FamCard
                  key={f.family.id}
                  family={f.family}
                  accent={f.accent}
                  viet={f.viet}
                  memberCount={f.members.length}
                  gens={f.gens}
                  isGraveyard
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

interface FamCardProps {
  family: AceFamily;
  accent: FamAccent;
  viet: string | null;
  memberCount: number;
  gens: number;
  isGraveyard?: boolean;
  onOpen: () => void;
}

function FamCard({ family, accent, viet, memberCount, gens, isGraveyard = false, onOpen }: FamCardProps) {
  const displayName = getDisplayFamName(family.name);
  return (
    <button className={`ace-fam-card ${isGraveyard ? 'ace-fam-card-graveyard' : ''}`} onClick={onOpen} type="button">
      <FamCover
        pattern={patternForFamily(family)}
        accent={accent}
        imageUrl={family.cover_image_url}
        alt={displayName}
      />
      <div className="ace-fam-body">
        <div className="ace-fam-row">
          <div className="ace-fam-name">
            {displayName}
            {viet && <span className={`ace-fam-viet ace-fam-viet-${accent}`}>· {viet}</span>}
          </div>
          {isGraveyard && <span className="ace-graveyard-pill">Graveyard</span>}
        </div>
        <div className="ace-fam-meta">
          <span>{memberCount} member{memberCount === 1 ? '' : 's'}</span>
          <span className="ace-fam-meta-sep">·</span>
          <span>{gens} gen{gens === 1 ? '' : 's'}</span>
        </div>
        <div className="ace-fam-cta">
          View family tree
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </button>
  );
}

// ── Fams Tab Section ──────────────────────────────────────────────

interface FamsTabSectionProps {
  activeFams: FamDerived[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenSheet: (id: string) => void;
  dark: boolean;
}

function FamsTabSection({ activeFams, selectedId, onSelect, onOpenSheet, dark: _dark }: FamsTabSectionProps) {
  const selected = activeFams.find((f) => f.family.id === selectedId) ?? activeFams[0];
  const { family, accent, viet, members, isPlaceholder } = selected;
  const displayName = getDisplayFamName(family.name);

  const famHeads = members.filter((m) => isFamHead(m.role_label));
  const hasTree = members.length > 0;

  return (
    <div className="ace-famtabs">
      {/* Tab bar */}
      <div className="ace-famtabs-bar" role="tablist" aria-label="ACE Families">
        {activeFams.map((f) => {
          const name = getDisplayFamName(f.family.name);
          const active = f.family.id === selectedId;
          return (
            <button
              key={f.family.id}
              role="tab"
              aria-selected={active}
              className={`ace-famtabs-tab ace-famtabs-tab-${f.accent} ${active ? 'is-active' : ''}`}
              onClick={() => onSelect(f.family.id)}
              type="button"
            >
              {name}
              {f.viet && <span className="ace-famtabs-tab-viet">{f.viet}</span>}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="ace-famtabs-panel" role="tabpanel">
        {/* Panel header */}
        <div className="ace-famtabs-panel-head">
          <div className="ace-famtabs-cover">
            <FamCover
              pattern={patternForFamily(family)}
              accent={accent}
              imageUrl={family.cover_image_url}
              alt={displayName}
            />
          </div>
          <div className="ace-famtabs-panel-title">
            <div className={`ace-famtabs-panel-name ace-famtabs-panel-name-${accent}`}>{displayName}</div>
            {viet && <div className="ace-famtabs-panel-viet">{viet}</div>}
            <div className="ace-famtabs-panel-meta">
              {members.length} member{members.length === 1 ? '' : 's'}
              {members.length > 0 && (
                <>
                  <span className="ace-fam-meta-sep">·</span>
                  {generationDepth(members)} gen{generationDepth(members) === 1 ? '' : 's'}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Fam heads */}
        <div className="ace-famtabs-subsection">
          <div className="ace-famtabs-sub-label">Fam Head{famHeads.length !== 1 ? 's' : ''}</div>
          <div className="ace-famheads-grid">
            {famHeads.length > 0 ? (
              famHeads.map((m) => (
                <FamHeadCard
                  key={m.id}
                  name={m.name}
                  photoUrl={m.photo_url ?? null}
                  roleLabel={m.role_label}
                  accent={accent}
                />
              ))
            ) : (
              <>
                <FamHeadCard name={null} photoUrl={null} roleLabel={null} accent={accent} />
                <FamHeadCard name={null} photoUrl={null} roleLabel={null} accent={accent} />
              </>
            )}
          </div>
        </div>

        {/* Family tree */}
        <div className="ace-famtabs-subsection">
          <div className="ace-famtabs-sub-label">Family Tree</div>
          {hasTree ? (
            <div className="ace-famtree-ready">
              <p className="ace-famtree-ready-text">
                This family's tree has {members.length} member{members.length === 1 ? '' : 's'} across {generationDepth(members)} generation{generationDepth(members) === 1 ? '' : 's'}.
              </p>
              <button
                className={`ace-btn ace-btn-secondary ace-famtree-btn`}
                onClick={() => onOpenSheet(family.id)}
                type="button"
              >
                View Family Tree
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="ace-famtree-placeholder">
              <svg className="ace-famtree-placeholder-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="19" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 7.5V11M12 11H6.5M12 11H17.5M6.5 11V13.5M17.5 11V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="ace-famtree-placeholder-text">
                {isPlaceholder ? 'TBD - coming soon' : 'Family tree not prepared yet'}
              </div>
              <div className="ace-famtree-placeholder-sub">
                {isPlaceholder
                  ? 'This fam slot is saved while the full lineup gets added.'
                  : "Check back soon - this fam's lineage is on its way."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FamHeadCardProps {
  name: string | null;
  photoUrl: string | null;
  roleLabel: string | null;
  accent: FamAccent;
}

function FamHeadCard({ name, photoUrl, roleLabel, accent }: FamHeadCardProps) {
  const initials = name
    ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : null;

  return (
    <div className="ace-famhead-card">
      <div className={`ace-famhead-avatar ace-famhead-avatar-${accent} ${!name ? 'is-placeholder' : ''}`}>
        {photoUrl ? (
          <img src={photoUrl} alt={name ?? ''} className="ace-famhead-photo" />
        ) : initials ? (
          <span>{initials}</span>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="ace-famhead-info">
        <div className="ace-famhead-name">{name ?? 'TBD'}</div>
        {roleLabel && <div className="ace-famhead-role">{roleLabel}</div>}
        {!name && <div className="ace-famhead-role">Fam Head · To be announced</div>}
      </div>
    </div>
  );
}
