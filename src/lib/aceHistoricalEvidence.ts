// Adapters that turn the historical sources into `ace-pickup-evidence/v1`
// bundles for aceHistoricalYears.ts (#670). They only reshape data: no source
// is trusted more here than in the reconciliation itself.
import { validateJson } from './aceFamilyImport';
import type { EvidenceBundle, EvidenceRecord, EvidenceSource } from './aceHistoricalYears';

/**
 * data/ace-families/*.json: each explicit member's link `added_term`. The
 * reconstruction already exists in the repo, so this carries no new private
 * data. `legacy` is kept as written; the reconciler reads it as "no year".
 */
export function evidenceFromRepoFamilies(files: readonly { file: string; json: unknown }[]): EvidenceBundle {
  const sources: EvidenceSource[] = [];
  const records: EvidenceRecord[] = [];
  for (const { file, json } of files) {
    const parsed = validateJson(json);
    if (!parsed.ok) throw new Error(`${file}: ${parsed.error}`);
    const slug = file.replace(/^.*\//, '').replace(/\.json$/, '');
    const sourceId = `REPO_${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
    sources.push({
      source_id: sourceId,
      kind: 'repo_added_term',
      label: `Reconstructed repo tree data/ace-families/${slug}.json`,
      extraction_complete: true,
      location: `data/ace-families/${slug}.json`,
    });
    parsed.json.members.forEach((m, i) => {
      const term = (m.added_term ?? '').trim();
      if (!term) return;
      records.push({
        source_id: sourceId,
        kind: 'repo_added_term',
        little: m.name,
        big: m.big ?? null,
        term,
        fam_hint: parsed.json.family,
        ref: `members[${i}]`,
        id_hint: m.id_hint ?? null,
        confidence: m.confidence ?? null,
      });
    });
  }
  return { sources, records };
}

interface PackageOfficial {
  term: string;
  big: string;
  little: string;
  fam_hint?: string;
  source: string;
  tab: string;
  source_row: number | string;
}

interface PackageMaster {
  variant: string;
  fam: string;
  tab: string;
  row: number | string;
  col: string;
  cell: string;
  year: number | null;
  simple: boolean;
}

function asArray<T>(value: unknown, name: string): T[] {
  if (!Array.isArray(value)) throw new Error(`Research package is missing the "${name}" array.`);
  return value as T[];
}

export interface PackageAdapterResult {
  bundle: EvidenceBundle;
  skippedMasterCells: number;
}

/**
 * The 2026-10-27 research package (ace_backfill_evidence.json): its official
 * pairing rows and Master workbook year cells. Its pre-joined `repos` section
 * is ignored in favour of the repo files themselves. Pass `sections` to take
 * only one part, e.g. Master cells when the pairing sheets were re-extracted. Multi-name Master cells
 * (`simple: false`) are skipped and counted, never split by guesswork.
 */
export function evidenceFromResearchPackage(input: unknown, sections: readonly ('official' | 'master')[] = ['official', 'master']): PackageAdapterResult {
  if (!input || typeof input !== 'object') throw new Error('Research package must be a JSON object.');
  const pkg = input as Record<string, unknown>;
  const official = asArray<PackageOfficial>(pkg.official, 'official');
  const master = asArray<PackageMaster>(pkg.master, 'master');
  const created = typeof pkg.created === 'string' ? pkg.created : 'unknown date';

  const sources = new Map<string, EvidenceSource>();
  const records: EvidenceRecord[] = [];
  for (const row of sections.includes('official') ? official : []) {
    if (typeof row.little !== 'string' || typeof row.term !== 'string') throw new Error('Research package official row is missing little/term.');
    const sourceId = `PKG_${row.term.toUpperCase()}_OFFICIAL`;
    if (!sources.has(sourceId)) {
      sources.set(sourceId, {
        source_id: sourceId,
        kind: 'official_pairing',
        label: `${row.source} (research package ${created})`,
        term: row.term,
        extraction_complete: true,
        location: `tab '${row.tab}'`,
      });
    }
    records.push({
      source_id: sourceId,
      kind: 'official_pairing',
      little: row.little,
      big: row.big ?? null,
      term: row.term,
      fam_hint: row.fam_hint ?? null,
      ref: `${row.tab}!row ${row.source_row}`,
    });
  }

  let skipped = 0;
  for (const cell of sections.includes('master') ? master : []) {
    if (!cell.simple || typeof cell.cell !== 'string' || typeof cell.year !== 'number') {
      skipped += 1;
      continue;
    }
    const sourceId = `PKG_MASTER_${String(cell.variant).toUpperCase()}`;
    if (!sources.has(sourceId)) {
      sources.set(sourceId, {
        source_id: sourceId,
        kind: 'master_year_cell',
        label: `Master ACE workbook variant ${cell.variant} (research package ${created})`,
        extraction_complete: true,
      });
    }
    records.push({
      source_id: sourceId,
      kind: 'master_year_cell',
      little: cell.cell,
      academic_year_start: cell.year,
      fam_hint: cell.tab || cell.fam,
      ref: `${cell.tab}!${cell.col}${cell.row}`,
      variant: cell.variant,
    });
  }
  return { bundle: { sources: Array.from(sources.values()), records }, skippedMasterCells: skipped };
}
