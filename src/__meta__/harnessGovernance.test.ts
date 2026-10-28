import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const adapters = ['CLAUDE.md', 'GEMINI.md', 'ANTIGRAVITY.md'] as const;

describe('agent harness governance does not drift (#309)', () => {
  it('single-sources authority, protected rules and seasonal policy', () => {
    const governing = read('AGENTS.md');
    expect(governing).toContain('Single source of truth for AI coding agents');
    expect(governing).toContain('## Things to never do');
    expect(governing).toContain('attendance import, points calculation, House membership, or leaderboard calculation');
    expect(governing).toContain('Never');
    expect(read('docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md')).toContain('## 3. Risk classification');

    for (const file of adapters) {
      const content = read(file);
      expect(content).toContain('AGENTS.md');
      expect(content).toContain('docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md');
      expect(content).toMatch(/authoritative|governance contract/i);
      expect(content).not.toMatch(/(this file|this adapter) overrides? AGENTS\.md/i);
    }
  });

  it('keeps the Claude adapter from reintroducing retired points/auth paths or bypassing repositories', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('Member accounts and code-based check-in are retired');
    expect(content).toContain('src/data/repos/');
    expect(content).toMatch(/do \*\*not\*\* import `supabase` directly/i);
    expect(content).not.toMatch(/two coexisting points systems|authenticated check-in flow/i);
    expect(content).not.toMatch(/import `supabase` directly for one-off queries/i);
  });

  it('avoids unverifiable copies of source-derived routes, versions, tables and providers', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('package.json');
    expect(content).toContain('src/App.tsx');
    expect(content).toContain('src/routes/index.tsx');
    expect(content).toContain('supabase/migrations/');
    expect(content).not.toMatch(/React Router v\d/);
    expect(content).not.toMatch(/\*\*Protected\*\* \(auth required/i);
    expect(content).not.toMatch(/two coexisting points systems/i);
  });

  it('keeps nested Claude file limited to Graphify command wiring, not a competing authority', () => {
    const rootClaude = read('CLAUDE.md');
    const nested = read('.claude/CLAUDE.md');
    expect(rootClaude).toMatch(/not\*\* a competing authority/i);
    expect(nested).toContain('/graphify');
    expect(nested).toContain('.claude/skills/graphify/SKILL.md');
    expect(nested).not.toMatch(/authorization|RLS|production|migrations|points calculation/i);
  });

  it('retains harness-specific mechanics rather than requiring identical adapters', () => {
    expect(read('CLAUDE.md')).toContain('Claude-specific mechanics:');
    expect(read('GEMINI.md')).toContain('Gemini');
    expect(read('ANTIGRAVITY.md')).toContain('Antigravity');
    const source = read('AGENTS.md');
    expect(source).toContain('.claude/agents/README.md');
  });
});
