import { AceFamily } from '../../../types';
import { getDisplayFamName, patternForFamily } from '../../../lib/aceFamilyAdapter';
import { FamAccent, FamCover } from './FamCover';

interface GhostFamCardProps {
  family: AceFamily;
  accent: FamAccent;
  memberCount: number;
  gens: number;
  onOpen: () => void;
}

/**
 * Graveyard ("(Dead) …") fam card: a faded sheet with a scalloped hem and a
 * floating ghost over the fam's washed-out cover. Styles live in ace.css
 * under `.ace-ghost-*`.
 */
export function GhostFamCard({ family, accent, memberCount, gens, onOpen }: GhostFamCardProps) {
  const displayName = getDisplayFamName(family.name);
  return (
    <button className="ace-ghost-card" onClick={onOpen} type="button">
      {/* Sheet + hem + glow on their own layer so the floating ghost never repaints the filter. */}
      <span className="ace-ghost-sheet" aria-hidden="true" />
      <div className="ace-ghost-cover">
        <div className="ace-ghost-cover-art" aria-hidden="true">
          <FamCover
            pattern={patternForFamily(family)}
            accent={accent}
            imageUrl={family.cover_image_url}
            alt=""
            height="100%"
          />
        </div>
        <span className="ace-ghost-tag">R.I.P.</span>
        <GhostGlyph />
      </div>
      <div className="ace-ghost-body">
        <div className="ace-ghost-name">{displayName}</div>
        <div className="ace-ghost-meta">
          <span>{memberCount} member{memberCount === 1 ? '' : 's'}</span>
          <span className="ace-fam-meta-sep">·</span>
          <span>{gens} gen{gens === 1 ? '' : 's'}</span>
        </div>
        <div className="ace-ghost-cta">
          View family tree
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </button>
  );
}

function GhostGlyph() {
  return (
    <svg className="ace-ghost-glyph" viewBox="0 0 64 76" aria-hidden="true">
      <path
        className="ace-ghost-glyph-body"
        d="M8 32C8 16.5 18.7 6 32 6s24 10.5 24 26v34q-3 12-6 0t-6 0q-3 12-6 0t-6 0q-3 12-6 0t-6 0q-3 12-6 0t-6 0Z"
      />
      <ellipse className="ace-ghost-glyph-face" cx="24" cy="32" rx="3.6" ry="5" />
      <ellipse className="ace-ghost-glyph-face" cx="40" cy="32" rx="3.6" ry="5" />
      <ellipse className="ace-ghost-glyph-face" cx="32" cy="45" rx="3" ry="3.8" />
    </svg>
  );
}
