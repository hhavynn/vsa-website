import { execFileSync } from 'child_process';
import { resolve } from 'path';

describe('generated repository ownership index (#306)', () => {
  it('matches current route, repo, playbook, and skill sources', () => {
    expect(() => execFileSync(process.execPath, ['scripts/generate-repo-map.cjs', '--check'], {
      cwd: resolve(__dirname, '../..'),
      encoding: 'utf8',
      stdio: 'pipe',
    })).not.toThrow();
  });
});
