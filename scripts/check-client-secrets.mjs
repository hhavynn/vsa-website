import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const allowedPublicVars = new Set([
  'REACT_APP_SUPABASE_URL', 'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_GA4_MEASUREMENT_ID', 'REACT_APP_SUPABASE_IMAGE_TRANSFORMS',
  'REACT_APP_ATTENDANCE_IDENTITY_V2',
]);
const credentialSignals = [
  /\b(?:sk-(?:proj-|test-|live-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{35,})\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
];
const assignments = /\b(REACT_APP_[A-Z0-9_]+)\s*=\s*([^\r\n#]+)/g;
const references = /\b(?:process\.env\.|import\.meta\.env\.)(REACT_APP_[A-Z0-9_]+)/g;
const isPlaceholder = (value) => /^(?:your_|example|placeholder|dummy|test_|<|\$\{|G-XXXXXXXX|https:\/\/example)/i.test(value.trim().replace(/^['"]|['"]$/g,''));

function jwtRole(value) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch { return null; }
}
function sensitiveAssignment(value) {
  const v = value.trim().replace(/^['"]|['"]$/g, '');
  if (isPlaceholder(v)) return false;
  if (credentialSignals.some((pattern) => {pattern.lastIndex=0; return pattern.test(v);})) return true;
  return /(?:secret|private|service.role|webhook|password|refresh.token)/i.test(v) && v.length > 12;
}
export function inspectText(file, source) {
  const errors = [];
  const isClient = file.startsWith('src/') || file.startsWith('public/');
  for (const pattern of credentialSignals) {
    pattern.lastIndex=0;
    if (pattern.test(source)) errors.push(file + ': credential signature detected');
  }
  assignments.lastIndex=0;
  for (const match of source.matchAll(assignments)) {
    const [, key, value] = match;
    if (!allowedPublicVars.has(key)) errors.push(file + ': unreviewed client environment variable ' + key);
    if (sensitiveAssignment(value)) errors.push(file + ': sensitive-looking public assignment ' + key);
    if (key === 'REACT_APP_SUPABASE_ANON_KEY') {
      const role = jwtRole(value);
      if (role && role !== 'anon') errors.push(file + ': public anon-key variable contains a non-anon JWT');
    }
  }
  if (isClient) {
    references.lastIndex=0;
    for (const [, key] of source.matchAll(references)) {
      if (!allowedPublicVars.has(key)) errors.push(file + ': unreviewed public variable reference ' + key);
    }
  }
  return [...new Set(errors)];
}
export function scanTracked(root = process.cwd()) {
  const names = execFileSync('git', ['ls-files', '-z'], {cwd:root}).toString('utf8').split('\0').filter(Boolean);
  const filtered = names.filter((name) =>
    ((name.startsWith('src/') || name.startsWith('public/')) && /\.(?:[cm]?[jt]sx?|html|json|css)$/.test(name) && !/\.test\.[jt]sx?$/.test(name)) ||
    /^\.env(?:\..*)?$/.test(name));
  const problems = [];
  for (const name of filtered) {
    try { problems.push(...inspectText(name, readFileSync(root + '/' + name, 'utf8'))); }
    catch (err) { if (err.code !== 'ENOENT') throw err; }
  }
  return problems;
}
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const issues = scanTracked();
  if (issues.length) {
    console.error(issues.join('\n'));
    console.error('Blocked: investigate, rotate exposed credentials, then remove them from committed history.');
    process.exitCode = 1;
  } else console.log('Client-secret guard passed: no unreviewed public variables or credential signatures.');
}
