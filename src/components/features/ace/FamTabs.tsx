import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import { AceFamily, AceFamilyMember } from '../../../types';
import { generationDepth, getDisplayFamName, patternForFamily } from '../../../lib/aceFamilyAdapter';
import { getFamIconUrl, resolveFamHeads } from '../../../lib/aceFamRoster';
import { useMemberAvatars } from '../../../hooks/useMemberAvatars';
import { FamAccent, FamCover } from './FamCover';

export interface FamTabEntry {
  family: AceFamily;
  accent: FamAccent;
  viet: string | null;
  members: AceFamilyMember[];
  isPlaceholder?: boolean;
}

interface FamTabsProps {
  fams: FamTabEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpenSheet: (id: string) => void;
}

const tabId = (familyId: string) => `ace-famtab-${familyId}`;
const PANEL_ID = 'ace-famtabs-panel';

/**
 * Active-fam browser: a swipeable tab rail over one fam's panel. On phones only
 * two or three tabs fit, so the rail shows edge fades + a "more" chevron while
 * tabs are off-screen, the header counts every fam, and the panel ends with a
 * previous/next pager so the rest of the lineup is always one tap away.
 */
export function FamTabs({ fams, selectedId, onSelect, onOpenSheet }: FamTabsProps) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const selectedIndex = Math.max(0, fams.findIndex((f) => f.family.id === selectedId));
  const famIds = fams.map((f) => f.family.id).join('|');
  const selected = fams[selectedIndex];
  const prev = selectedIndex > 0 ? fams[selectedIndex - 1] : null;
  const next = selectedIndex < fams.length - 1 ? fams[selectedIndex + 1] : null;

  const updateEdges = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const max = bar.scrollWidth - bar.clientWidth;
    const start = bar.scrollLeft > 4;
    const end = bar.scrollLeft < max - 4;
    setEdges((cur) => (cur.start === start && cur.end === end ? cur : { start, end }));
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    updateEdges();
    if (!bar) return undefined;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateEdges);
      return () => window.removeEventListener('resize', updateEdges);
    }
    const ro = new ResizeObserver(updateEdges);
    ro.observe(bar);
    Array.from(bar.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
  }, [updateEdges, famIds]);

  // Keep the selected tab visible (centered where possible) in the rail.
  useEffect(() => {
    const bar = barRef.current;
    const tab = bar?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!bar || !tab) return;
    const left = Math.max(0, tab.offsetLeft - (bar.clientWidth - tab.offsetWidth) / 2);
    if (typeof bar.scrollTo === 'function') {
      bar.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    } else {
      bar.scrollLeft = left;
    }
  }, [selectedId, reduceMotion]);

  const nudgeRail = (dir: 1 | -1) => {
    const bar = barRef.current;
    if (!bar) return;
    const left = bar.scrollLeft + dir * bar.clientWidth * 0.7;
    if (typeof bar.scrollTo === 'function') {
      bar.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    } else {
      bar.scrollLeft = left;
    }
  };

  const focusTab = (familyId: string) => {
    document.getElementById(tabId(familyId))?.focus();
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let target: FamTabEntry | undefined;
    if (event.key === 'ArrowRight') target = fams[(selectedIndex + 1) % fams.length];
    else if (event.key === 'ArrowLeft') target = fams[(selectedIndex - 1 + fams.length) % fams.length];
    else if (event.key === 'Home') target = fams[0];
    else if (event.key === 'End') target = fams[fams.length - 1];
    if (!target) return;
    event.preventDefault();
    onSelect(target.family.id);
    focusTab(target.family.id);
  };

  // Pager lives at the bottom of a tall panel: after switching, bring the
  // top of the new fam back into view if it is behind the fixed site header.
  const goTo = (entry: FamTabEntry) => {
    onSelect(entry.family.id);
    const root = rootRef.current;
    if (root && root.getBoundingClientRect().top < 72 && typeof root.scrollIntoView === 'function') {
      root.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    // Reaching either end removes the button that was pressed; keep focus in the widget.
    const index = fams.indexOf(entry);
    if (index === 0 || index === fams.length - 1) {
      document.getElementById(tabId(entry.family.id))?.focus({ preventScroll: true });
    }
  };

  if (!selected) return null;

  return (
    <div className="ace-famtabs-wrap" ref={rootRef}>
      <div className="ace-famtabs-summary">
        <span className="ace-famtabs-count">
          <strong>{fams.length}</strong> active fam{fams.length === 1 ? '' : 's'}
        </span>
        {fams.length > 1 && (
          <span className="ace-famtabs-position" aria-hidden="true">
            {selectedIndex + 1} / {fams.length}
          </span>
        )}
      </div>

      <div className="ace-famtabs">
        <div
          className={`ace-famtabs-rail ${edges.start ? 'has-start' : ''} ${edges.end ? 'has-end' : ''}`}
        >
          <div
            className="ace-famtabs-bar"
            role="tablist"
            aria-label="ACE Families"
            ref={barRef}
            onScroll={updateEdges}
            onKeyDown={onTabKeyDown}
          >
            {fams.map((f) => {
              const name = getDisplayFamName(f.family.name);
              const active = f.family.id === selected.family.id;
              const tabIconUrl = getFamIconUrl(f.family.slug);
              return (
                <button
                  key={f.family.id}
                  id={tabId(f.family.id)}
                  role="tab"
                  aria-selected={active}
                  aria-controls={PANEL_ID}
                  tabIndex={active ? 0 : -1}
                  className={`ace-famtabs-tab ace-famtabs-tab-${f.accent} ${active ? 'is-active' : ''}`}
                  onClick={() => onSelect(f.family.id)}
                  type="button"
                >
                  {tabIconUrl && <img className="ace-famtabs-tab-icon" src={tabIconUrl} alt="" loading="lazy" decoding="async" />}
                  {name}
                  {f.viet && <span className="ace-famtabs-tab-viet">{f.viet}</span>}
                </button>
              );
            })}
          </div>
          {/* Pointer-only affordances; keyboard users move with the arrow keys. */}
          <button
            className="ace-famtabs-more ace-famtabs-more-start"
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => nudgeRail(-1)}
          >
            <Chevron dir="left" />
          </button>
          <button
            className="ace-famtabs-more ace-famtabs-more-end"
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={() => nudgeRail(1)}
          >
            <Chevron dir="right" />
          </button>
        </div>

        <FamPanel entry={selected} onOpenSheet={onOpenSheet} />

        {(prev || next) && (
          <nav className="ace-famtabs-pager" aria-label="Browse ACE fams">
            {prev ? (
              <button className="ace-famtabs-pager-btn is-prev" type="button" onClick={() => goTo(prev)}>
                <span className="ace-famtabs-pager-dir">
                  <Chevron dir="left" /> Previous
                </span>
                <span className="ace-famtabs-pager-name">{getDisplayFamName(prev.family.name)}</span>
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            {next ? (
              <button className="ace-famtabs-pager-btn is-next" type="button" onClick={() => goTo(next)}>
                <span className="ace-famtabs-pager-dir">
                  Next fam <Chevron dir="right" />
                </span>
                <span className="ace-famtabs-pager-name">{getDisplayFamName(next.family.name)}</span>
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FamPanel({ entry, onOpenSheet }: { entry: FamTabEntry; onOpenSheet: (id: string) => void }) {
  const { family, accent, viet, members, isPlaceholder } = entry;
  const displayName = getDisplayFamName(family.name);
  const memberAvatars = useMemberAvatars();

  const famHeads = resolveFamHeads(family.slug, members, memberAvatars);
  const iconUrl = getFamIconUrl(family.slug);
  const hasTree = members.length > 0;
  const gens = generationDepth(members);

  return (
    <div className="ace-famtabs-panel" role="tabpanel" id={PANEL_ID} aria-labelledby={tabId(family.id)}>
      {/* Panel header */}
      <div className="ace-famtabs-panel-head">
        {iconUrl ? (
          <img className="ace-famtabs-icon" src={iconUrl} alt={`${displayName} fam icon`} decoding="async" />
        ) : (
          <div className="ace-famtabs-cover">
            <FamCover
              pattern={patternForFamily(family)}
              accent={accent}
              imageUrl={family.cover_image_url}
              alt={displayName}
            />
          </div>
        )}
        <div className="ace-famtabs-panel-title">
          <div className={`ace-famtabs-panel-name ace-famtabs-panel-name-${accent}`}>{displayName}</div>
          {viet && <div className="ace-famtabs-panel-viet">{viet}</div>}
          <div className="ace-famtabs-panel-meta">
            {members.length} member{members.length === 1 ? '' : 's'}
            {members.length > 0 && (
              <>
                <span className="ace-fam-meta-sep">·</span>
                {gens} gen{gens === 1 ? '' : 's'}
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
            famHeads.map((head, i) => (
              <FamHeadCard
                key={`${head.name}-${i}`}
                name={head.name}
                photoUrl={head.photoUrl}
                roleLabel={head.roleLabel}
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
              This family's tree has {members.length} member{members.length === 1 ? '' : 's'} across {gens} generation{gens === 1 ? '' : 's'}.
            </p>
            <button
              className="ace-btn ace-btn-secondary ace-famtree-btn"
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
