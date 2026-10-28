import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function getSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...getSourceFiles(fullPath));
    } else if (/\.(?:[cm]?[jt]sx?)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('output encoding policy (#350)', () => {
  it('enforces react/no-danger error rule in package.json eslintConfig', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(pkg.eslintConfig?.rules?.['react/no-danger']).toBe('error');
  });

  it('contains zero occurrences of dangerouslySetInnerHTML in client source', () => {
    const files = getSourceFiles(join(process.cwd(), 'src'));
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('dangerouslySetInnerHTML')) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });

  it('contains zero raw innerHTML assignments in client source', () => {
    const files = getSourceFiles(join(process.cwd(), 'src'));
    const violations: string[] = [];
    const innerHtmlRegex = /\.innerHTML\s*=/;
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (innerHtmlRegex.test(content)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
