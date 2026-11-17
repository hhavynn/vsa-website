/**
 * Official pairings + published tree → private reconciliation + recap snapshot.
 *
 *   npx tsx scripts/ace-recap/build-snapshot.ts \
 *     --pairings  <official sheet export .json|.csv> \
 *     --published <dir from fetch-published-snapshot.ts> \
 *     --out       <private dir OUTSIDE any git repo> \
 *     --cycle "Fall 2026" --year 2026 \
 *     [--compare <older export .csv>]  [--approvals approvals.json] \
 *     [--import-dir data/ace-families]
 *
 * Writes: recap-snapshot.json (review preview), recap-presentation.json and
 * recap-video-props.json (video/player: no review data), review.csv (one row
 * per Little for the ACE Chair), summary.md, sheet-diff.json. Read-only: it
 * never contacts Supabase and never writes into the repo.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AceFamily } from '../../src/types';
import type { AceNodeRef } from '../../src/lib/aceAssignments';
import { normalizeMemberName } from '../../src/lib/memberLinkMatching';
import {
  buildRecapSnapshot, diffPairingSheets, parseOfficialPairingRows, planRecapTimeline, toRecapPresentation,
} from '../../src/lib/aceRecap';
import type { RecapApproval } from '../../src/lib/aceRecap';
import { arg, assertPrivateDir, csvEscape, extractRejectedNames, readSheetRows, requireArg } from './privateIo';

interface PublishedMemberRow {
  id: string; family_id: string; name: string; parent_member_id: string | null; member_id: string | null;
  role_label: string | null; pickup_academic_year_start: number | null; pickup_term: string | null;
}

/** node id → unreviewed historical term from the repo's import JSON (evidence only). */
function importTerms(dir: string, families: AceFamily[], nodes: AceNodeRef[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const json = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as {
      family: string; members: Array<{ name: string; big: string | null; added_term?: string }>;
    };
    const fam = families.find((f) => normalizeMemberName(f.name) === normalizeMemberName(json.family));
    if (!fam) continue;
    const famNodes = nodes.filter((n) => n.familyId === fam.id);
    const counts = new Map<string, number>();
    json.members.forEach((m) => counts.set(normalizeMemberName(m.name), (counts.get(normalizeMemberName(m.name)) ?? 0) + 1));
    for (const m of json.members) {
      const key = normalizeMemberName(m.name);
      if (counts.get(key) !== 1) continue; // same-name people: no evidence either way
      const matches = famNodes.filter((n) => normalizeMemberName(n.name) === key);
      if (matches.length !== 1) continue;
      let term = m.added_term ?? null;
      if (!term && !m.big) {
        const kids = json.members.filter((k) => k.big && normalizeMemberName(k.big) === key);
        if (kids.length && kids.every((k) => k.added_term === 'legacy')) term = 'legacy';
      }
      if (term) out.set(matches[0].id, term);
    }
  }
  return out;
}

function main() {
  const out = assertPrivateDir(requireArg('out'));
  const publishedDir = requireArg('published');
  const pairingsFile = requireArg('pairings');
  const cycleLabel = arg('cycle', 'Fall 2026')!;
  const year = Number(arg('year', '2026'));

  const familyRows = JSON.parse(readFileSync(path.join(publishedDir, 'families.json'), 'utf8')) as AceFamily[];
  const families = familyRows.map((f) => ({ ...f, is_published: true }));
  const familyName = new Map(families.map((f) => [f.id, f.name]));
  const memberRows = JSON.parse(readFileSync(path.join(publishedDir, 'members.json'), 'utf8')) as PublishedMemberRow[];
  const nodes: AceNodeRef[] = memberRows.map((m) => ({
    id: m.id, name: m.name, familyId: m.family_id, familyName: familyName.get(m.family_id) ?? null,
    memberId: m.member_id, parentId: m.parent_member_id, roleLabel: m.role_label, isPublished: true,
    pickupAcademicYearStart: m.pickup_academic_year_start, pickupTerm: m.pickup_term,
  }));

  const official = readSheetRows(pairingsFile);
  const sheet = parseOfficialPairingRows(official.rows);
  const compareFile = arg('compare');
  const older = compareFile ? readSheetRows(compareFile) : null;
  const olderSheet = older ? parseOfficialPairingRows(older.rows) : null;
  const diff = olderSheet ? diffPairingSheets(olderSheet, sheet) : null;
  const rejectedNames = Array.from(new Set([
    ...extractRejectedNames(official.rows), ...(older ? extractRejectedNames(older.rows) : []),
  ]));
  const approvalsFile = arg('approvals');
  const approvals: RecapApproval[] = approvalsFile ? JSON.parse(readFileSync(approvalsFile, 'utf8')) : [];
  const terms = importTerms(arg('import-dir', 'data/ace-families')!, families, nodes);

  const snapshot = buildRecapSnapshot({
    cycle: { label: cycleLabel, academicYearStart: year },
    source: {
      label: String(official.meta.sourceLabel ?? path.basename(pairingsFile)),
      revision: (official.meta.revisionId as string | undefined) ?? null,
      retrievedAt: String(official.meta.retrievedAt ?? new Date().toISOString().slice(0, 10)),
    },
    families, nodes, pairings: sheet.pairings, sheetIssues: sheet.issues,
    approvals, rejectedNames, importTermByNodeId: terms,
  });
  const timeline = planRecapTimeline(toRecapPresentation(snapshot));

  writeFileSync(path.join(out, 'recap-snapshot.json'), JSON.stringify(snapshot));
  // Presentation-only copy for the video renderer and player: no review records or evidence.
  const presentation = toRecapPresentation(snapshot);
  writeFileSync(path.join(out, 'recap-presentation.json'), JSON.stringify(presentation));
  writeFileSync(path.join(out, 'recap-video-props.json'), JSON.stringify({ presentation }));
  writeFileSync(path.join(out, 'sheet-diff.json'), JSON.stringify({ diff, rejectedNames, olderTotals: olderSheet && {
    bigs: olderSheet.bigCount, littles: olderSheet.littleCount, issues: olderSheet.issues } }, null, 2));
  const header = ['record_id', 'academic_cycle', 'sheet_row', 'big_display_name', 'canonical_big_node_id', 'big_member_id',
    'family_id', 'family_name', 'little_display_name', 'little_member_id', 'proposed_parent_node_id', 'candidate_status',
    'candidate_count', 'candidates', 'reviewer_approval', 'evidence', 'warnings', 'safe_to_preview', 'approved_for_publication'];
  const lines = [header.join(',')].concat(snapshot.records.map((r) => [
    r.id, r.cycleLabel, r.sheetRow, r.bigName, r.bigNodeId, r.bigMemberId, r.familyId, r.familyName, r.littleName,
    '', r.proposedParentNodeId, r.bigStatus, r.candidateCount,
    r.candidates.map((c) => `${c.nodeName} [${c.familyName}; ${c.matchKind}; depth ${c.depth}; ${c.childCount} littles${c.importTerm ? '; import ' + c.importTerm : ''}; ${c.nodeId}]`).join(' | '),
    r.reviewerApproval, r.evidence.join(' '), r.warnings.join(' '), r.safeToPreview ? 'YES' : 'NO', r.approvedForPublication ? 'YES' : 'NO',
  ].map(csvEscape).join(',')));
  writeFileSync(path.join(out, 'review.csv'), lines.join('\n') + '\n');

  const t = snapshot.totals;
  const md: string[] = [];
  md.push(`# ACE ${cycleLabel} — private reconciliation`, '', `PRIVATE. Not published. Source: ${snapshot.source.label} (revision ${snapshot.source.revision ?? 'n/a'}, retrieved ${snapshot.source.retrievedAt}).`, '');
  md.push(`- Big rows: **${t.bigRows}** · Little placements: **${t.littles}** (sheet declares ${sheet.declaredBigs ?? '?'} / ${sheet.declaredLittles ?? '?'})`);
  md.push(`- Safe to preview: **${t.previewed}** · In review queue: **${t.queued}** · Chair-approved: **${t.approved}**`);
  md.push(`- Families growing: **${t.familiesGrowing}** · People ${t.peopleBefore} → ${t.peopleAfter}`);
  md.push(`- Recap video plan: ${(timeline.durationInFrames / timeline.fps).toFixed(1)} s, ${timeline.scenes.length} scenes`, '');
  md.push('## Sheet checks', '', ...(sheet.issues.length ? sheet.issues.map((i) => `- \`${i.code}\` ${i.message}`) : ['- none']), '');
  if (diff && olderSheet) {
    md.push(`## Compared with older export (${olderSheet.bigCount} Bigs / ${olderSheet.littleCount} Littles)`, '');
    diff.bigsRenamed.forEach((b) => md.push(`- Big renamed: ${b.from} → ${b.to} (${b.littles.join(', ')})`));
    diff.littlesMoved.forEach((m) => md.push(`- Little moved: ${m.little}: ${m.fromBig} → ${m.toBig}`));
    diff.littlesAdded.forEach((m) => md.push(`- Little added: ${m.little} (Big ${m.big})`));
    diff.littlesRemoved.forEach((m) => md.push(`- Little removed: ${m.little} (Big ${m.big})`));
    diff.bigsAdded.forEach((b) => md.push(`- Big row added: ${b}`));
    diff.bigsRemoved.forEach((b) => md.push(`- Big row removed: ${b}`));
    md.push('');
  }
  md.push('## Family-by-family proposed additions (preview only)', '');
  for (const f of snapshot.families.filter((x) => x.added > 0)) {
    md.push(`### ${f.name} — +${f.added} (${f.before.people} → ${f.after.people} people, ${f.before.generations} → ${f.after.generations} generations)`);
    const byId = new Map(f.nodes.map((n) => [n.id, n]));
    f.growth.forEach((g) => md.push(`- ${g.bigLabel} → ${g.littleIds.map((id) => byId.get(id)?.label).join(', ')}`));
    md.push('');
  }
  md.push('## Review queue (not attached to any tree)', '');
  const queue = snapshot.records.filter((r) => !r.safeToPreview);
  const byBig = new Map<string, typeof queue>();
  queue.forEach((r) => byBig.set(r.bigName, [...(byBig.get(r.bigName) ?? []), r]));
  byBig.forEach((rs, big) => {
    const r = rs[0];
    md.push(`- **${big}** → ${rs.map((x) => x.littleName).join(', ')} — \`${r.bigStatus}\`${r.warnings.length ? ' ' + Array.from(new Set(rs.flatMap((x) => x.warnings))).map((w) => '`' + w + '`').join(' ') : ''}`);
    r.candidates.forEach((c) => md.push(`  - candidate: ${c.nodeName} — ${c.familyName}, ${c.matchKind}, depth ${c.depth}, ${c.childCount} littles${c.importTerm ? ', import term ' + c.importTerm : ''}`));
    r.evidence.forEach((e) => md.push(`  - ${e}`));
  });
  md.push('', '## Warnings on previewed rows', '');
  snapshot.records.filter((r) => r.safeToPreview && (r.evidence.length)).forEach((r) =>
    md.push(`- ${r.bigName} → ${r.littleName}: ${r.evidence.join(' ')}`));
  if (rejectedNames.length) md.push('', `Rejection-list names excluded from candidacy: ${rejectedNames.length}.`);
  writeFileSync(path.join(out, 'summary.md'), md.join('\n') + '\n');
  console.log(md.slice(0, 12).join('\n'));
  console.log(`\nWrote recap-snapshot.json, review.csv, summary.md, sheet-diff.json to ${out}`);
}
main();
