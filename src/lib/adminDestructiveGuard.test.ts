import fs from 'fs';
import path from 'path';

// Regression guard for the shared confirmation pattern (see
// docs/admin-dx-safety.md). Every confirmation goes through <ConfirmDialog>
// (or useDiscardConfirm, which wraps it). A bare window.confirm() blocks the
// page, cannot be styled or tested, and says nothing specific, so it fails here
// anywhere under src/ unless the file is on the allowlist below.

const SRC = 'src';
const repoRoot = path.resolve(__dirname, '../..');

// Files allowed to call window.confirm, and why. Keep this list tiny.
const ALLOWED: Record<string, string> = {
  'src/hooks/useUnsavedChangesGuard.ts':
    'Leave-page guard: a link click must be cancelled synchronously, and the helpers it shares with useAdminForm / AdminQuickSearch / AdminRoute return a boolean. beforeunload itself can only ever be the native prompt.',
};

const CONFIRM_CALL = /\b(?:window|globalThis|self)\s*(?:\.\s*confirm|\[\s*['"]confirm['"]\s*\])\b/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(full);
  }
  return out;
}

const isCommentLine = (line: string) => /^\s*(\/\/|\/\*|\*)/.test(line);

describe('window.confirm', () => {
  it('is not used in non-test source outside the allowlist', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(path.join(repoRoot, SRC))) {
      const relative = path.relative(repoRoot, file).split(path.sep).join('/');
      if (ALLOWED[relative]) continue;
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (!isCommentLine(line) && CONFIRM_CALL.test(line)) offenders.push(`${relative}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every allowlisted file real and still in need of the exception', () => {
    for (const relative of Object.keys(ALLOWED)) {
      const file = path.join(repoRoot, relative);
      expect(fs.existsSync(file)).toBe(true);
      expect(CONFIRM_CALL.test(fs.readFileSync(file, 'utf8'))).toBe(true);
    }
  });
});
