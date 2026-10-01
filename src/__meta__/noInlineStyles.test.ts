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
  'src/components/features/admin/OperationsDashboard.tsx',
  'src/pages/Admin/CabinetRollover.tsx',
  'src/pages/Admin/YearSetup.tsx',
];

it.each(FILES)('%s has no inline style props', (file) => {
  const source = readFileSync(join(process.cwd(), file), 'utf8');
  expect(source.match(/\sstyle=\{/g) ?? []).toEqual([]);
});
