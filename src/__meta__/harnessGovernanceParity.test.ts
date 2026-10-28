import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const adapters = ['CLAUDE.md', 'GEMINI.md', 'ANTIGRAVITY.md'] as const;
const workflow = 'docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md';

/**
 * The governing facts have one owner, AGENTS.md. This guard deliberately
 * checks referrals to those facts, not duplicate copies of their text.
 * Provider hierarchy, route lists and table schemas are code/migration facts,
 * and should be re-derived rather than encoded here.
 */
export function adapterContract(text: string) {
  return {
    root: /\bAGENTS\.md\b/.test(text) && /authoritative|governance contract/i.test(text),
    workflow: text.includes(workflow) && /workflow|canonical/i.test(text),
    noShadowNeverDo: !/^#{1,3}\s+(?:Things to never do|Never-do list)\b/im.test(text),
    noShadowFreeze: !/^#{1,3}\s+Freeze windows\b/im.test(text),
    noShadowProtected: !/^#{1,3}\s+Protected domains\b/im.test(text),
  };
}

describe('cross-harness governance parity (#309)', () => {
  it('keeps protected-domain and never-do policy in canonical documents', () => {
    const agents = read('AGENTS.md');
    const canonical = read(workflow);
    expect(agents).toMatch(/authoritative governance contract/);
    expect(agents).toMatch(/Things to never do/);
    expect(canonical).toMatch(/Authority hierarchy/);
    expect(canonical).toContain('AGENTS.md');
  });

  it.each(adapters)('%s defers governance and workflow to their owners', (name) => {
    expect(adapterContract(read(name))).toEqual({
      root: true,
      workflow: true,
      noShadowNeverDo: true,
      noShadowFreeze: true,
      noShadowProtected: true,
    });
  });

  it('keeps adapters harness-specific without imposing false command parity', () => {
    expect(read('CLAUDE.md')).toMatch(/Claude-specific mechanics:/);
    expect(read('CLAUDE.md')).toContain('.claude/CLAUDE.md');
    expect(read('GEMINI.md')).toMatch(/Gemini-specific lifecycle/);
    expect(read('ANTIGRAVITY.md')).toMatch(/Antigravity|Antigravity uses the encoded equivalent/);
  });

  it('keeps nested Claude wiring explicitly non-authoritative and slash-command scoped', () => {
    const nested = read('.claude/CLAUDE.md');
    expect(nested).toMatch(/not a competing authority/i);
    expect(nested).toContain('AGENTS.md');
    expect(nested).toContain(workflow);
    expect(nested).toMatch(/\/graphify/);
    expect(nested).not.toMatch(/^#{1,3}\s+(?:Protected domains|Freeze windows|Things to never do)/im);
  });

  it('treats provider nesting, routes and database tables as derived facts', () => {
    const claude = read('CLAUDE.md');
    expect(claude).toMatch(/Provider hierarchy:[^\n]*src\/App\.tsx/);
    expect(claude).toMatch(/Routing[^\n]*src\/routes\/index\.tsx/);
    expect(claude).toContain('supabase/migrations/');
    expect(claude).toMatch(/read it there rather than trusting a copy/);
  });

  it('detects a disconnected adapter or a shadow never-do section', () => {
    const sample = read('GEMINI.md');
    expect(adapterContract(sample.split('AGENTS.md').join('OTHER.md')).root).toBe(false);
    expect(adapterContract(sample.replace(workflow, 'other-process.md')).workflow).toBe(false);
    expect(adapterContract(sample + '\n## Things to never do\n- sample').noShadowNeverDo).toBe(false);
  });
});
