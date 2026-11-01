import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { memberLookupRepository } from '../data/repos/memberLookup';
import type { AceNodeRef, BigLoad } from '../lib/aceAssignments';
import {
  ApplicationProfile,
  BigCandidate,
  BigSuggestion,
  PairWarning,
  ParsedApplicationProfiles,
  checkPair,
  pairWarningIssues,
  matchProfilesToDrafts,
  matchProfilesToNodes,
  parseApplicationProfiles,
  suggestBigs,
  unmatchedProfiles,
} from '../lib/aceApplicationProfiles';
import type { AceAssignmentDraft } from '../types';

/** What one assignment row shows once application answers are loaded. */
export interface AceRowApplication {
  little: ApplicationProfile | null;
  big: ApplicationProfile | null;
  bigName: string | null;
  warnings: PairWarning[];
  /** Only for an unassigned Little with a profile. */
  suggestions: BigSuggestion[];
}

export interface AceApplicationSummary {
  bigCount: number;
  littleCount: number;
  repeatsReplaced: number;
  skipped: number;
  unmatched: ApplicationProfile[];
  warnings: string[];
  emailLookupFailed: boolean;
}

interface Loaded {
  /** Answers belong to the cycle they were loaded for. */
  cycleId: string | null;
  parsed: ParsedApplicationProfiles;
  memberIdsByEmail: ReadonlyMap<string, readonly string[]>;
  emailLookupFailed: boolean;
}

/**
 * Holds pasted ACE application answers in React state only. Nothing is
 * written anywhere: no database row, browser storage, log, toast, or
 * analytics event. Leaving or refreshing the page clears it.
 */
export function useAceApplicationProfiles(
  cycleId: string | null,
  drafts: readonly AceAssignmentDraft[],
  nodes: readonly AceNodeRef[],
  loadFor: (bigId: string) => BigLoad,
) {
  const [stored, setStored] = useState<Loaded | null>(null);
  // Switching cycles drops the answers; a lookup still running for the old cycle is ignored.
  const cycleRef = useRef(cycleId);
  const requestRef = useRef(0);
  useEffect(() => {
    cycleRef.current = cycleId;
    requestRef.current += 1;
    setStored(null);
  }, [cycleId]);
  const loaded = stored && stored.cycleId === cycleId ? stored : null;

  const load = useCallback(async (text: string): Promise<ParsedApplicationProfiles> => {
    const forCycle = cycleRef.current;
    const request = ++requestRef.current;
    const parsed = parseApplicationProfiles(text);
    // Never replace a previously usable review with a malformed, header-only,
    // or otherwise all-skipped import. No raw answer or contact data is logged.
    if (parsed.profiles.length === 0) {
      throw new Error('No valid Big or Little applications found. Check the Form Responses header, role answers, and selected CSV tab. Earlier answers are unchanged.');
    }
    const emails = parsed.profiles.flatMap((profile) => (profile.role === 'little' && profile.email ? [profile.email] : []));
    let memberIdsByEmail = new Map<string, string[]>();
    let emailLookupFailed = false;
    if (emails.length > 0) {
      try {
        const matches = await memberLookupRepository.matchMembersByEmail(emails);
        memberIdsByEmail = new Map(Array.from(matches, ([email, members]) => [email, members.map((member) => member.id)]));
      } catch {
        // Name matching still works; the panel says email matching was skipped.
        emailLookupFailed = true;
      }
    }
    if (request === requestRef.current && forCycle === cycleRef.current) {
      setStored({ cycleId: forCycle, parsed, memberIdsByEmail, emailLookupFailed });
    }
    return parsed;
  }, []);

  const clear = useCallback(() => {
    requestRef.current += 1;
    setStored(null);
  }, []);

  const littleByDraft = useMemo(
    () => (loaded ? matchProfilesToDrafts(loaded.parsed.profiles, drafts, loaded.memberIdsByEmail) : new Map<string, ApplicationProfile>()),
    [loaded, drafts],
  );
  const bigByNode = useMemo(
    () => (loaded ? matchProfilesToNodes(loaded.parsed.profiles, nodes) : new Map<string, ApplicationProfile>()),
    [loaded, nodes],
  );
  const nodeNameById = useMemo(() => new Map(nodes.map((node) => [node.id, node.name])), [nodes]);

  const summary = useMemo<AceApplicationSummary | null>(() => {
    if (!loaded) return null;
    const { parsed } = loaded;
    return {
      bigCount: parsed.bigCount,
      littleCount: parsed.littleCount,
      repeatsReplaced: parsed.repeatsReplaced,
      skipped: parsed.skipped,
      unmatched: unmatchedProfiles(parsed.profiles, littleByDraft, bigByNode),
      warnings: parsed.warnings,
      emailLookupFailed: loaded.emailLookupFailed,
    };
  }, [loaded, littleByDraft, bigByNode]);

  const rowFor = useCallback(
    (draft: AceAssignmentDraft): AceRowApplication | undefined => {
      if (!loaded) return undefined;
      const little = littleByDraft.get(draft.id) ?? null;
      const bigId = draft.big_ace_member_id;
      const bigName = bigId ? nodeNameById.get(bigId) ?? null : null;
      const big = bigId ? bigByNode.get(bigId) ?? null : null;
      const warnings =
        bigId && bigName ? checkPair({ profile: big, name: bigName }, { profile: little, name: draft.little_name }, loadFor(bigId)) : [];
      let suggestions: BigSuggestion[] = [];
      if (!bigId && little) {
        const candidates: BigCandidate[] = Array.from(bigByNode, ([nodeId, profile]) => ({
          nodeId,
          name: nodeNameById.get(nodeId) ?? profile.displayName,
          profile,
          load: loadFor(nodeId),
        }));
        suggestions = suggestBigs({ profile: little, name: draft.little_name }, candidates);
      }
      return { little, big, bigName, warnings, suggestions };
    },
    [loaded, littleByDraft, bigByNode, nodeNameById, loadFor],
  );

  // Counts only, for the shared preflight panel; always warnings.
  const warningIssues = useMemo(() => (loaded ? pairWarningIssues(drafts.map((draft) => rowFor(draft)?.warnings ?? [])) : []), [loaded, drafts, rowFor]);

  const capacityFor = useCallback((bigId: string) => bigByNode.get(bigId)?.capacity ?? null, [bigByNode]);

  return { loaded: !!loaded, summary, load, clear, rowFor, warningIssues, capacityFor: loaded ? capacityFor : undefined };
}
