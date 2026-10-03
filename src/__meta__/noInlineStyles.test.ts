/**
 * AGENTS.md § Styling: Tailwind only, no inline `style` props. The yearly
 * operations surfaces were written to that rule; keep them there. (Older admin
 * pages predate it and are not covered here.)
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const FILES = [
  'src/components/common/ConfirmDialog.tsx',
  'src/components/features/admin/AdminPageHeader.tsx',
  'src/components/features/admin/ops/AdminFormShell.tsx',
  'src/components/features/admin/ops/BulkRunDialog.tsx',
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
  'src/pages/UVSANetwork.tsx',
  'src/components/features/admin/SchoolLogoField.tsx',
  'src/components/features/uvsa/ExternalArchive.tsx',
  'src/components/features/uvsa/ExternalEventCard.tsx',
  'src/components/features/uvsa/FeaturedExternal.tsx',
  'src/components/features/uvsa/FirstExternalGuide.tsx',
  'src/components/features/uvsa/LinkButton.tsx',
  'src/components/features/uvsa/NetworkHero.tsx',
  'src/components/features/uvsa/NetworkInfoFooter.tsx',
  'src/components/features/uvsa/SchoolCard.tsx',
  'src/components/features/uvsa/SchoolDirectory.tsx',
  'src/components/features/uvsa/SchoolVisualMark.tsx',
  'src/components/features/uvsa/UpcomingExternals.tsx',
];

it.each(FILES)('%s has no inline style props', (file) => {
  const source = readFileSync(join(process.cwd(), file), 'utf8');
  expect(source.match(/\sstyle=\{/g) ?? []).toEqual([]);
});
