#!/usr/bin/env node
/**
 * scripts/ace-historical-years.ts
 *
 * Read-only reconciliation of historical ACE pickup years against the live,
 * published family tree (#670). Methodology: docs/ace-historical-pickup-years.md.
 *
 * It never connects to Supabase or Google Drive and never writes to a database.
 * It reads local files and writes local files. Every output except
 * summary.json/summary.md holds names, so --out-dir must be a gitignored or
 * out-of-repo directory; the script refuses anything git would track.
 *
 * Usage:
 *   npm run ace:years -- reconcile \
 *     --live-families <published_ace_families.json> \
 *     --live-members  <published_ace_family_members.json> \
 *     [--repo-families data/ace-families] \
 *     [--research-package <ace_backfill_evidence.json>] [--package-sections official,master] \
 *     [--evidence <ace-pickup-evidence/v1 file>]... \
 *     [--max-year 2025] [--out-dir scripts/reports/ace-historical-years/out]
 *
 *   npm run ace:years -- coverage
 *     --live-families <published_ace_families.json>
 *     --live-members <published_ace_family_members.json>
 *     --repo-families data/ace-families
 *     [--out-dir scripts/reports/ace-historical-years/coverage]
 *
 *   npm run ace:years -- plan \
 *     --live-families <...> --live-members <...> \
 *     --review <reviewed review_sheet.csv> [--pre-669-snapshot yes] \
 *     --batch-label <generic-review-batch-name> \\
 *     [--max-year 2025] [--out-dir scripts/reports/ace-historical-years/plan]
 *
 * `plan` is a DRY RUN: it writes backfill_plan.json and a SQL preview that
 * ends in ROLLBACK. Applying any year is a separate, owner-approved step after
 * #669's columns exist.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { csvCell } from '../src/lib/adminImportReview';
import { evidenceFromRepoFamilies, evidenceFromResearchPackage } from '../src/lib/aceHistoricalEvidence';
import {
  academicYearLabel,
  CONFIDENCE_CLASSES,
  EvidenceBundle,
  mergeEvidence,
  parseEvidenceFile,
  parseLiveSnapshot,
  reconcilePickupYears,
  summarize,
  AggregateSummary,
  summarizeYearCoverage,
  type PickupYearCoverage,
} from '../src/lib/aceHistoricalYears';
import {
  buildBackfillPlan,
  parseReviewSheet,
  planSqlPreview,
  validatePickupBatchLabel,
  reviewSheetCsv,
  reviewSheetForQueue,
  ReviewQueue,
} from '../src/lib/aceHistoricalYearsPlan';

const DEFAULT_MAX_YEAR = 2025;

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags = new Map<string, string[]>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const name = arg.slice(2);
    const value = rest[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value`);
    flags.set(name, [...(flags.get(name) ?? []), value]);
    i += 1;
  }
  const one = (name: string, fallback?: string): string => {
    const values = flags.get(name);
    if (!values || values.length === 0) {
      if (fallback !== undefined) return fallback;
      throw new Error(`--${name} is required`);
    }
    if (values.length > 1) throw new Error(`--${name} given more than once`);
    return values[0];
  };
  return { command, flags, one, many: (name: string) => flags.get(name) ?? [] };
}

function readJson(file: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${file} is not valid JSON: ${(error as Error).message}`);
  }
}

function sha256(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
}

/**
 * Refuses any output file git would track, so private rows cannot be committed
 * by accident. Checked per file (a negated ignore rule can re-include one file
 * in an ignored folder) and before the folder is created.
 */
function assertPrivateOutputs(dir: string, files: readonly string[]) {
  const absolute = path.resolve(dir);
  let probe = absolute;
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  let insideRepo = true;
  try {
    execFileSync('git', ['-C', probe, 'rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  } catch {
    insideRepo = false;
  }
  if (insideRepo) {
    for (const file of files) {
      try {
        execFileSync('git', ['-C', probe, 'check-ignore', '-q', '--no-index', path.join(absolute, file)], { stdio: 'ignore' });
      } catch {
        throw new Error(`${path.join(dir, file)} would not be gitignored. Use scripts/reports/... or a folder outside the repo.`);
      }
    }
  }
  fs.mkdirSync(absolute, { recursive: true, mode: 0o700 });
}

function write(dir: string, name: string, content: string) {
  fs.writeFileSync(path.join(dir, name), content, { mode: 0o600 });
}

const QUEUES: ReviewQueue[] = ['ambiguous_identity', 'conflicting_years', 'missing_evidence', 'chronology', 'roots'];
const RECONCILE_OUTPUTS = ['review_sheet.csv', ...QUEUES.map((q) => `queue_${q}.csv`), 'unmatched_evidence.csv', 'summary.json', 'summary.md'];
const PLAN_OUTPUTS = ['backfill_plan.json', 'backfill_preview.sql'];
const COVERAGE_OUTPUTS = ['coverage.json', 'coverage.md'];

function loadSnapshot(one: (n: string) => string) {
  const famFile = one('live-families');
  const memFile = one('live-members');
  return { snapshot: parseLiveSnapshot(readJson(famFile), readJson(memFile)), version: `live:${sha256(memFile)}` };
}

function parseMaxYear(raw: string): number {
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error(`--max-year must be a year such as ${DEFAULT_MAX_YEAR}`);
  return year;
}

function summaryMarkdown(summary: AggregateSummary): string {
  const header = ['Fam', 'Live nodes', 'Canonical member', ...CONFIDENCE_CLASSES, 'Source-matched', 'Legacy only', 'Master agrees'];
  const lines = [
    `# ACE pickup-year reconciliation: aggregate (${summary.generated})`,
    '',
    `Live published nodes: **${summary.live_nodes}** in ${summary.families} fams. Latest revealed cycle: ${academicYearLabel(summary.max_academic_year_start)}.`,
    '',
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
  ];
  for (const fam of summary.per_fam) {
    lines.push(
      `| ${fam.fam_name} | ${fam.live_nodes} | ${fam.with_canonical_member} | ${CONFIDENCE_CLASSES.map((c) => fam.classes[c]).join(' | ')} | ${fam.source_matched} | ${fam.legacy_only} | ${fam.master_compared ? `${fam.master_agreed}/${fam.master_compared}` : '–'} |`
    );
  }
  lines.push(
    `| **Total** | **${summary.live_nodes}** | | ${CONFIDENCE_CLASSES.map((c) => `**${summary.classes[c]}**`).join(' | ')} | | | |`,
    '',
    '## Review flags',
    '',
    ...Object.entries(summary.flags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([flag, count]) => `- ${flag}: ${count}`),
    '',
    '## Sources',
    '',
    '| Source | Kind | Term | Complete | Authoritative | Records | Reached a live node | Reached none |',
    '|---|---|---|---|---|---|---|---|',
    ...summary.sources.map(
      (s) =>
        `| ${s.source_id} | ${s.kind} | ${s.term ?? '–'} | ${s.extraction_complete ? 'yes' : 'NO'} | ${s.kind === 'official_pairing' ? (s.authoritative ? 'yes' : 'no') : '–'} | ${s.records} | ${s.matched_records} | ${s.unmatched_records} |`
    ),
    ''
  );
  return lines.join('\n');
}

function reconcile(args: ReturnType<typeof parseArgs>) {
  const outDir = args.one('out-dir', 'scripts/reports/ace-historical-years/out');
  assertPrivateOutputs(outDir, RECONCILE_OUTPUTS);
  const maxYear = parseMaxYear(args.one('max-year', String(DEFAULT_MAX_YEAR)));
  const { snapshot, version } = loadSnapshot(args.one);

  const bundles: EvidenceBundle[] = [];
  const versions = [version];
  const repoDir = args.one('repo-families', '');
  if (repoDir) {
    const files = fs
      .readdirSync(repoDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => ({ file: f, json: readJson(path.join(repoDir, f)) }));
    if (files.length === 0) throw new Error(`No .json files in ${repoDir}`);
    const repo = evidenceFromRepoFamilies(files);
    bundles.push(repo);
    versions.push(`repo:${files.length} files`);
    console.log(`Repo trees: ${repo.records.length} links with a term; ${repo.blankTerms} link(s) with no added_term (no evidence).`);
  }
  const pkgFile = args.one('research-package', '');
  if (pkgFile) {
    const sections = args
      .one('package-sections', 'official,master')
      .split(',')
      .map((s) => s.trim());
    for (const s of sections) if (s !== 'official' && s !== 'master') throw new Error(`--package-sections takes official and/or master, not ${s}`);
    const { bundle, skippedMasterCells, skippedOfficialRows } = evidenceFromResearchPackage(readJson(pkgFile), sections as ('official' | 'master')[]);
    bundles.push(bundle);
    versions.push(`package:${sha256(pkgFile)}`);
    if (skippedMasterCells > 0) console.log(`Research package: skipped ${skippedMasterCells} multi-name or out-of-range Master cell(s).`);
    if (skippedOfficialRows > 0) console.log(`Research package: skipped ${skippedOfficialRows} pairing row(s) with an unreadable term.`);
    if (sections.includes('official')) console.log('Research package pairing rows can corroborate but never confirm (not authoritative).');
  }
  for (const file of args.many('evidence')) {
    bundles.push(parseEvidenceFile(readJson(file)));
    versions.push(`${path.basename(file)}:${sha256(file)}`);
  }
  if (bundles.length === 0) throw new Error('Give at least one evidence input (--repo-families, --research-package or --evidence).');

  const evidence = mergeEvidence(bundles);
  const result = reconcilePickupYears(snapshot, evidence, { maxAcademicYearStart: maxYear });
  const now = new Date();
  const generated = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const sourceVersion = versions.join('; ');
  const summary = summarize(result, evidence, generated);

  write(outDir, 'review_sheet.csv', reviewSheetCsv(result.rows, sourceVersion));
  for (const queue of QUEUES) write(outDir, `queue_${queue}.csv`, reviewSheetForQueue(result, queue, sourceVersion));
  write(
    outDir,
    'unmatched_evidence.csv',
    ['source_id,kind,reason,little,big,term,academic_year,fam_hint,ref']
      .concat(
        result.unmatched.map((u) =>
          [u.record.source_id, u.record.kind, u.reason, u.record.little, u.record.big ?? '', u.record.term ?? '', academicYearLabel(u.record.academic_year_start), u.record.fam_hint ?? '', u.record.ref]
            .map(csvCell)
            .join(',')
        )
      )
      .join('\n') + '\n'
  );
  write(outDir, 'summary.json', `${JSON.stringify(summary, null, 2)}\n`);
  write(outDir, 'summary.md', summaryMarkdown(summary));

  console.log(`Live nodes reconciled: ${summary.live_nodes} (${summary.families} fams)`);
  for (const c of CONFIDENCE_CLASSES) console.log(`  ${c}: ${summary.classes[c]}`);
  console.log(`Evidence rows reaching no live node: ${result.unmatched.length}`);
  console.log(`Private outputs: ${path.resolve(outDir)} (review_sheet.csv holds names; summary.* is aggregate-only)`);
}

function plan(args: ReturnType<typeof parseArgs>) {
  const outDir = args.one('out-dir', 'scripts/reports/ace-historical-years/plan');
  assertPrivateOutputs(outDir, PLAN_OUTPUTS);
  const maxYear = parseMaxYear(args.one('max-year', String(DEFAULT_MAX_YEAR)));
  const { snapshot } = loadSnapshot(args.one);
  const reviewFile = args.one('review');
  const review = parseReviewSheet(fs.readFileSync(reviewFile, 'utf8'));
  const pre669 = args.one('pre-669-snapshot', 'no') === 'yes';
  // All applied evidence must carry a generic batch label; preview-only legacy snapshots may omit it.
  const rawLabel = args.one('batch-label', pre669 ? '' : undefined);
  const batchLabel = rawLabel ? validatePickupBatchLabel(rawLabel) : undefined;
  const result = buildBackfillPlan(review, snapshot, { maxAcademicYearStart: maxYear, allowMissingPickupColumns: pre669 });
  if (!result.snapshot_has_pickup_columns) console.log('PREVIEW ONLY: snapshot has no pickup columns; previous values assumed blank. Not idempotent.');
  write(outDir, 'backfill_plan.json', `${JSON.stringify(result, null, 2)}\n`);
  write(outDir, 'backfill_preview.sql', planSqlPreview(result, { batchLabel }));
  console.log('DRY RUN: nothing was written to any database.');
  console.log(`Updates: ${result.updates.length} (of which overwrite an existing value: ${result.updates.filter((u) => u.overwrites_existing_value).length})`);
  console.log(`Already applied: ${result.unchanged.length}; not approved: ${result.not_approved}; rejected: ${result.rejected.length}`);
  for (const r of result.rejected) console.log(`  rejected sheet row ${r.sheet_row}: ${r.reason}`);
  console.log(`Plan: ${path.resolve(outDir)}`);
}


/** Public only as aggregate counts; never log member names or IDs. */
function coverageMarkdown(result: PickupYearCoverage): string {
  const lines = [
    '# ACE pickup-year coverage (aggregate only)',
    '',
    '## Reconstructed source terms — not yet approved',
    '',
    '| Source file | Entries | Exact | Year only | Legacy | Absent | Needs review |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...result.sources.map((s) => '| ' + s.file + ' | ' + s.total + ' | ' + s.exact +
      ' | ' + s.year_only + ' | ' + s.legacy + ' | ' + s.absent + ' | ' + s.needs_review + ' |'),
    '| **Total** | **' + result.source_total.members + '** | **' + result.source_total.exact +
      '** | **' + result.source_total.year_only + '** | **' + result.source_total.legacy +
      '** | **' + result.source_total.absent + '** | **' + result.source_total.needs_review + '** |',
    '',
    '## Approved published members (includes Graveyard families)',
    '',
    '| Public fam slug | Nodes | Approved year | Approved term | Unknown |',
    '|---|---:|---:|---:|---:|',
    ...result.live_families.map((f) => '| ' + f.fam_slug + ' | ' + f.nodes + ' | ' +
      f.approved_year + ' | ' + f.approved_term + ' | ' + f.unknown + ' |'),
    '| **Total** | **' + result.live_total.nodes + '** | **' +
      result.live_total.approved_year + '** | **' + result.live_total.approved_term +
      '** | **' + result.live_total.unknown + '** |',
    '',
    'Source terms are unreviewed historical evidence. Only approved published columns',
    'count as live years. This is a read-only snapshot, never a backfill instruction.',
    '',
  ];
  return lines.join('\n');
}

/** #675 Part 3: source files and already-exported public views only; no DB client. */
function coverage(args: ReturnType<typeof parseArgs>) {
  const outDir = args.one('out-dir', 'scripts/reports/ace-historical-years/coverage');
  assertPrivateOutputs(outDir, COVERAGE_OUTPUTS);
  const { snapshot } = loadSnapshot(args.one);
  const repoDir = args.one('repo-families', 'data/ace-families');
  const files = fs.readdirSync(repoDir).filter((name) => name.endsWith('.json')).sort()
    .map((name) => ({ file: name, json: readJson(path.join(repoDir, name)) }));
  const result = summarizeYearCoverage(snapshot, files);
  write(outDir, 'coverage.json', JSON.stringify(result, null, 2) + '\n');
  write(outDir, 'coverage.md', coverageMarkdown(result));
  console.log('Aggregate coverage written to ' + path.resolve(outDir));
  console.log('Source entries: ' + result.source_total.members +
    '; live nodes: ' + result.live_total.nodes +
    '; unknown years: ' + result.live_total.unknown);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'reconcile') reconcile(args);
  else if (args.command === 'plan') plan(args);
  else if (args.command === 'coverage') coverage(args);
  else {
    console.log('Usage: npm run ace:years -- <reconcile|plan|coverage> [flags]  (see the header of scripts/ace-historical-years.ts)');
    process.exitCode = args.command === undefined || args.command === '--help' ? 0 : 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`ace-historical-years: ${(error as Error).message}`);
  process.exitCode = 1;
}
