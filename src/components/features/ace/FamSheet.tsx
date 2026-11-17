import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReducedMotion } from 'framer-motion';
import { AceFamily, AceFamilyMember } from '../../../types';
import { getDisplayFamName, isDeadFam, membersToTreeNodes } from '../../../lib/aceFamilyAdapter';
import { getFamIconUrl } from '../../../lib/aceFamRoster';
import { FamilyTree, TreeNode, lineagePath, lineageTimeline } from './FamilyTree';
import { AceYearRail } from './AceYearRail';
import { RAIL_OPEN_MS, usePannableTree } from './usePannableTree';
import { layoutTree, treeMetrics } from '../../../lib/aceTreeLayout';
import { describePickup, pickupYearOf } from '../../../lib/acePickupYear';
import { FamAccent } from './FamCover';
import { PhotoRequestSection } from '../avatar/PhotoRequestSection';
import { useMemberAvatars } from '../../../hooks/useMemberAvatars';
import { resolveMemberPhoto } from '../../../lib/memberPhotos';
import { publishedAceNodePath } from '../../../lib/acePublishedSearch';

interface FamSheetProps {
  family: AceFamily;
  members: AceFamilyMember[];
  accent: FamAccent;
  viet: string | null;
  dark: boolean;
  onClose: () => void;
  /** Published tree node ID from a validated /ace deep link. */
  focusNodeId?: string | null;
  /** Synchronize manual tree selection with the shareable URL. */
  onFocusNodeChange?: (id: string | null) => void;
}

function firstInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}


export function FamSheet({ family, members, accent, viet, dark, onClose, focusNodeId, onFocusNodeChange }: FamSheetProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(
    () => focusNodeId && members.some((m) => m.id === focusNodeId) ? focusNodeId : null,
  );
  const [copyStatus, setCopyStatus] = useState('');
  const displayName = getDisplayFamName(family.name);
  const deadFam = isDeadFam(family.name);
  const iconUrl = getFamIconUrl(family.slug);

  const memberAvatars = useMemberAvatars();
  const treeNodes = useMemo<TreeNode[]>(
    () => membersToTreeNodes(members, memberAvatars),
    [members, memberAvatars],
  );
  const layout = useMemo(() => layoutTree(treeNodes), [treeNodes]);
  const [smallRail, setSmallRail] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 520);
  useEffect(() => {
    const resize = () => setSmallRail(window.innerWidth <= 520);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const railWidth = layout.mode === 'year' ? (smallRail ? 56 : 84) : 0;
  const pan = usePannableTree(`${family.id}:${treeNodes.length}:${layout.mode}:${railWidth}`, railWidth);
  const reduceMotion = !!useReducedMotion();
  const lineage = useMemo(() => lineagePath(treeNodes, selectedNode), [treeNodes, selectedNode]);
  const timeline = lineageTimeline(lineage.length, reduceMotion);

  useEffect(() => {
    setSelectedNode(focusNodeId && members.some((m) => m.id === focusNodeId) ? focusNodeId : null);
  }, [family.id, focusNodeId, members]);

  // Frame the whole lineage once the rail has opened (or right away when it
  // already is), so a tap deep in the tree still shows the light's journey.
  const railWasOpenRef = useRef(false);
  const { revealNodes } = pan;
  useEffect(() => {
    const railWasOpen = railWasOpenRef.current;
    railWasOpenRef.current = lineage.length > 0;
    if (lineage.length === 0) return;
    const timer = window.setTimeout(() => revealNodes(lineage), railWasOpen ? 0 : RAIL_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [lineage, revealNodes]);

  // Stable so it runs only when the trail mounts (it's keyed per selection),
  // not on every pan re-render.
  const scrollTrailToEnd = useCallback((list: HTMLOListElement | null) => {
    if (list) list.scrollLeft = list.scrollWidth;
  }, []);

  const focusNode = useCallback((id: string | null) => {
    setSelectedNode(id);
    setCopyStatus('');
    onFocusNodeChange?.(id);
  }, [onFocusNodeChange]);

  const toggleNode = useCallback((id: string) => {
    focusNode(selectedNode === id ? null : id);
  }, [focusNode, selectedNode]);

  const clearSelection = useCallback(() => {
    const cleared = selectedNode;
    focusNode(null);
    if (!cleared) return;
    // The Clear button unmounts with the rail; hand focus back to the node.
    const node = Array.from(pan.canvasRef.current?.querySelectorAll<SVGGElement>('[data-node-id]') ?? [])
      .find((el) => el.dataset.nodeId === cleared);
    node?.focus();
  }, [pan.canvasRef, selectedNode, focusNode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const selectedMember = selectedNode ? memberById.get(selectedNode) ?? null : null;
  const selectedBig = selectedMember && selectedMember.parent_member_id
    ? memberById.get(selectedMember.parent_member_id) ?? null
    : null;
  const selectedLittles = selectedMember
    ? members.filter((m) => m.parent_member_id === selectedMember.id)
    : [];
  const selectedPhotoUrl = selectedMember
    ? resolveMemberPhoto(memberAvatars, selectedMember.member_id, selectedMember.photo_url)
    : null;
  const selectedHasSharedAvatar = !!selectedMember?.member_id && memberAvatars.has(selectedMember.member_id);

  const copyNodeLink = useCallback(async () => {
    if (!selectedMember) return;
    const url = new URL(publishedAceNodePath(family, selectedMember), window.location.origin).href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setCopyStatus('Member link copied.');
    } catch {
      setCopyStatus('Could not access the clipboard. Copy the URL from your browser address bar.');
    }
  }, [family, selectedMember]);

  const genCount = useMemo(() => {
    if (treeNodes.length === 0) return 0;
    const byId = new Map(treeNodes.map((n) => [n.id, n]));
    function depth(id: string, seen: Set<string>): number {
      const n = byId.get(id);
      if (!n || !n.parent || !byId.has(n.parent) || seen.has(id)) return 1;
      seen.add(id);
      return 1 + depth(n.parent, seen);
    }
    let max = 0;
    treeNodes.forEach((n) => {
      const d = depth(n.id, new Set());
      if (d > max) max = d;
    });
    return max;
  }, [treeNodes]);

  const isLittle = (m: AceFamilyMember | null) =>
    !!m && (m.role_label ?? '').toLowerCase().includes('little');

  return (
    <div className="ace-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${displayName} family tree`}>
      <div className="ace-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ace-sheet-grabber" />

        <div className="ace-sheet-head">
          {iconUrl && <img className="ace-sheet-icon" src={iconUrl} alt="" decoding="async" />}
          <div className="ace-sheet-head-left">
            <div className={`ace-sheet-eyebrow ace-sheet-eyebrow-${accent}`}>
              Family{viet ? ` · ${viet}` : ''}{deadFam ? ' · Graveyard' : ''}
            </div>
            <div className="ace-sheet-title">
              {displayName}
              {viet && <span className={`ace-sheet-viet ace-sheet-viet-${accent}`}> · {viet}</span>}
              {deadFam && <span className="ace-sheet-badge">Graveyard</span>}
            </div>
            <div className="ace-sheet-meta">
              {members.length} members · {genCount} generation{genCount === 1 ? '' : 's'}
            </div>
          </div>
          <button className="ace-iconbtn" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="ace-sheet-legend">
          <span className="ace-year-legend-note">
            {layout.mode === 'year'
              ? 'Rows show the year each person was picked up.'
              : 'Rows show generations. Pickup years are still being verified.'}
          </span>
          <span className="ace-legend-item">
            <span className={`ace-legend-swatch ace-legend-swatch-fill-${accent}`} />
            Big · in fam
          </span>
          <span className="ace-legend-item">
            <span className={`ace-legend-swatch ace-legend-swatch-ring-${accent}`} />
            Little · current
          </span>
        </div>

        <div
          className={`ace-sheet-treewrap ace-tree-panviewport ${pan.isDragging ? 'is-dragging' : ''}`}
          ref={pan.viewportRef}
          tabIndex={treeNodes.length > 0 ? 0 : undefined}
          aria-label="Family tree canvas. Drag to pan, use arrow keys to pan, use plus and minus to zoom, or press Home to reset the view."
          {...pan.viewportHandlers}
        >
          {treeNodes.length > 0 && (
            <div className="ace-tree-controls">
              <button
                className="ace-tree-control ace-tree-zoom-button"
                type="button"
                onClick={pan.controls.zoomOut}
                disabled={!pan.controls.canZoomOut}
                aria-label="Zoom out family tree"
              >
                <span className="ace-tree-control-symbol" aria-hidden="true">−</span>
                <span className="ace-tree-control-text">Zoom Out</span>
              </button>
              <div className="ace-tree-zoom-readout" aria-hidden="true">
                {pan.controls.zoomPercent}%
              </div>
              <button
                className="ace-tree-control ace-tree-zoom-button"
                type="button"
                onClick={pan.controls.zoomIn}
                disabled={!pan.controls.canZoomIn}
                aria-label="Zoom in family tree"
              >
                <span className="ace-tree-control-symbol" aria-hidden="true">+</span>
                <span className="ace-tree-control-text">Zoom In</span>
              </button>
              <button
                className="ace-tree-control ace-tree-reset"
                type="button"
                onClick={pan.resetView}
                aria-label="Reset family tree view"
              >
                <span className="ace-tree-control-symbol" aria-hidden="true">Reset</span>
                <span className="ace-tree-control-text">Reset View</span>
              </button>
            </div>
          )}
          <div
            className="ace-sheet-treepad ace-tree-canvas"
            ref={pan.canvasRef}
            style={{ transform: `translate3d(${pan.offset.x}px, ${pan.offset.y}px, 0) scale(${pan.zoom})` }}
          >
            {layout.mode === 'year' && (
              <AceYearRail bands={layout.yearBands} metrics={treeMetrics(false)}
                offsetX={pan.offset.x} zoom={pan.zoom} railWidth={railWidth}
                focusKey={selectedNode ? layout.bandKeyById[selectedNode] ?? null : null} />
            )}
            {treeNodes.length === 0 ? (
              <div className="ace-fam-empty" style={{ minWidth: 280 }}>
                This fam has no published members yet.
              </div>
            ) : (
              <FamilyTree
                nodes={treeNodes}
                layout={layout}
                accent={accent}
                focusId={selectedNode}
                onSelect={toggleNode}
                compact={false}
                dark={dark}
              />
            )}
          </div>
        </div>

        <div className={`ace-sheet-rail ${selectedMember ? 'is-open' : ''}`}>
          {selectedMember ? (
            <div className="ace-rail-body">
              <div className="ace-rail-lineage-row">
                {lineage.length > 1 ? (
                  <nav className="ace-rail-lineage" aria-label={`Lineage of ${selectedMember.name}`}>
                    <div className="ace-rail-rel-h">Lineage</div>
                    {/* Keyed by the selection so the steps replay with the light. */}
                    <ol
                      className="ace-rail-lineage-list"
                      key={selectedMember.id}
                      ref={scrollTrailToEnd}
                    >
                      {lineage.map((id, i) => {
                        const step = memberById.get(id);
                        if (!step) return null;
                        const isCurrent = i === lineage.length - 1;
                        return (
                          // Ancestors appear as the light reaches them; the
                          // selected member is named at once (the trail opens
                          // scrolled to them).
                          <li
                            key={id}
                            className="ace-rail-lineage-step"
                            style={{ '--lineage-delay': `${isCurrent ? 0 : timeline.nodeDelay(i)}ms` } as CSSProperties}
                          >
                            {isCurrent ? (
                              <span className="ace-rail-lineage-current" aria-current="true">{step.name}</span>
                            ) : (
                              <button
                                type="button"
                                className="ace-rail-lineage-name"
                                onClick={() => focusNode(id)}
                              >
                                {step.name}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </nav>
                ) : (
                  <div className="ace-rail-lineage" />
                )}
                <button type="button" className="ace-rail-clear" onClick={clearSelection}>
                  Clear
                </button>
              </div>
              <div className="ace-rail-card">
                <div className={`ace-rail-avatar ace-rail-avatar-${accent}${isLittle(selectedMember) ? ' is-little' : ''}`}>
                  {selectedPhotoUrl ? (
                    <img className="ace-rail-photo" src={selectedPhotoUrl} alt={selectedMember.name} decoding="async" />
                  ) : (
                    firstInitial(selectedMember.name)
                  )}
                </div>
                <div className="ace-rail-info">
                  <div className="ace-rail-name">{selectedMember.name}</div>
                  <button type="button" className="ace-rail-chip" onClick={copyNodeLink}>
                    Copy member link
                  </button>
                  <span role="status" className="ace-rail-empty">{copyStatus}</span>
                  {selectedMember.role_label && (
                    <div className="ace-rail-role">{selectedMember.role_label}</div>
                  )}
                  <div className="ace-rail-pickup">{describePickup(pickupYearOf(selectedMember))}</div>
                </div>
                <div className="ace-rail-photo-request">
                  {selectedMember.member_id ? (
                    <PhotoRequestSection
                      key={selectedMember.id}
                      matchedMemberId={selectedMember.member_id}
                      selectedMemberName={selectedMember.name}
                      buttonLabel={selectedHasSharedAvatar ? 'Update photo' : 'Request photo'}
                    />
                  ) : (
                    <p className="ace-rail-empty">
                      Photo requests open once a VSA admin links this name to a member record.
                    </p>
                  )}
                </div>
              </div>
              <div className="ace-rail-rel">
                {selectedBig && (
                  <div>
                    <div className="ace-rail-rel-h">Big</div>
                    <button className="ace-rail-chip" onClick={() => focusNode(selectedBig.id)}>
                      <span className={`ace-rail-chip-dot ace-rail-chip-dot-${accent}`}>
                        {firstInitial(selectedBig.name)}
                      </span>
                      {selectedBig.name}
                      {selectedBig.role_label ? ` · ${selectedBig.role_label}` : ''}
                    </button>
                  </div>
                )}
                {selectedLittles.length > 0 && (
                  <div>
                    <div className="ace-rail-rel-h">Littles ({selectedLittles.length})</div>
                    <div className="ace-rail-chips">
                      {selectedLittles.map((l) => (
                        <button key={l.id} className="ace-rail-chip" onClick={() => focusNode(l.id)}>
                          <span className={`ace-rail-chip-dot ace-rail-chip-dot-${accent}${isLittle(l) ? ' is-little' : ''}`}>
                            {firstInitial(l.name)}
                          </span>
                          {l.name}
                          {l.role_label ? ` · ${l.role_label}` : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {!selectedBig && selectedLittles.length === 0 && (
                  <div className="ace-rail-empty">Founder — no Big in this fam.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="ace-sheet-hint">
              Tap a member to trace their lineage, Big, and Littles.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
