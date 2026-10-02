/**
 * AGENTS.md § Styling: Tailwind only, no inline `style` props. The yearly
 * operations surfaces were written to that rule; keep them there. (Older admin
 * pages predate it and are not covered here.)
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const FILES = [
  'src/components/features/admin/ops/OperationsCard.tsx',
  'src/components/features/admin/ops/PreflightItem.tsx',
  'src/components/features/admin/ops/PreflightSummary.tsx',
  'src/components/features/admin/ops/ProgressCount.tsx',
  'src/components/features/admin/ops/StatusBadge.tsx',
  'src/components/features/admin/ops/ActivityList.tsx',
  'src/components/features/admin/ops/BulkActionBar.tsx',
  'src/components/features/admin/ops/EmptyState.tsx',
  'src/components/features/admin/ops/FilterChips.tsx',
  'src/components/features/admin/ops/ImportReviewPanel.tsx',
  'src/components/features/admin/ops/NextStepBanner.tsx',
  'src/components/features/admin/ops/PossibleDuplicates.tsx',
  'src/components/features/admin/ops/ReadinessPanel.tsx',
  'src/components/features/admin/ops/SaveBar.tsx',
  'src/components/features/admin/ops/WorkflowProgress.tsx',
  'src/components/features/admin/ops/YearContextBadge.tsx',
  'src/components/features/admin/OperationsDashboard.tsx',
  'src/pages/Admin/CabinetRollover.tsx',
  'src/pages/Admin/YearSetup.tsx',
];

it.each(FILES)('%s has no inline style props', (file) => {
  const source = readFileSync(join(process.cwd(), file), 'utf8');
  expect(source.match(/\sstyle=\{/g) ?? []).toEqual([]);
});
