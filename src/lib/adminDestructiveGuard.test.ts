import fs from 'fs';
import path from 'path';

// Regression guard for the shared confirmation pattern (see
// docs/admin-dx-safety.md). Destructive admin actions go through
// <ConfirmDialog>; a bare window.confirm() is only acceptable for the
// "unsaved changes — discard?" prompt, which protects edits in progress rather
// than stored data.

const ROOTS = ['src/pages/Admin', 'src/components/features/admin', 'src/components/features/cabinet'];
const repoRoot = path.resolve(__dirname, '../..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('admin destructive actions', () => {
  it('use the shared ConfirmDialog instead of window.confirm (except discard-unsaved prompts)', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of sourceFiles(path.join(repoRoot, root))) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (!/window\.confirm\(/.test(line)) return;
          // The prompt text may sit on the next lines of a multi-line call.
          const context = lines.slice(index - 1, index + 4).join(' ');
          // Also allowed: AceFamilies' duplicate-link warning, which asks whether to
          // link a second node to the same person and deletes nothing.
          if (/unsaved|discard|already linked/i.test(context)) return;
          offenders.push(`${path.relative(repoRoot, file)}:${index + 1}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });
});
