import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const allowedPublicVars = new Set([
  'REACT_APP_SUPABASE_URL', 'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_GA4_MEASUREMENT_ID', 'REACT_APP_SUPABASE_IMAGE_TRANSFORMS',
  'REACT_APP_ATTENDANCE_IDENTITY_V2', 'REACT_APP_SENTRY_DSN',
  'REACT_APP_POSTHOG_KEY', 'REACT_APP_POSTHOG_HOST',
]);
const vercelSystemVars = new Set([
  'REACT_APP_VERCEL_ENV',
  'REACT_APP_VERCEL_URL',
  'REACT_APP_VERCEL_PROJECT_PRODUCTION_URL',
  'REACT_APP_VERCEL_BRANCH_URL',
  'REACT_APP_VERCEL_REGION',
  'REACT_APP_VERCEL_DEPLOYMENT_ID',
  'REACT_APP_VERCEL_PROJECT_ID',
  'REACT_APP_VERCEL_TARGET_ENV',
  'REACT_APP_VERCEL_SKEW_PROTECTION_ENABLED',
  'REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG',
  'REACT_APP_VERCEL_GIT_PROVIDER',
  'REACT_APP_VERCEL_GIT_REPO_SLUG',
  'REACT_APP_VERCEL_GIT_REPO_OWNER',
  'REACT_APP_VERCEL_GIT_REPO_ID',
  'REACT_APP_VERCEL_GIT_COMMIT_REF',
  'REACT_APP_VERCEL_GIT_COMMIT_SHA',
  'REACT_APP_VERCEL_GIT_COMMIT_MESSAGE',
  'REACT_APP_VERCEL_GIT_COMMIT_AUTHOR_LOGIN',
  'REACT_APP_VERCEL_GIT_COMMIT_AUTHOR_NAME',
  'REACT_APP_VERCEL_GIT_PULL_REQUEST_ID',
]);
const isAllowedVar = (key) => allowedPublicVars.has(key) || vercelSystemVars.has(key);
const credentialSignals = [
  /\b(?:sk-(?:proj-|test-|live-)?[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{35,})\b/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bAIza[A-Za-z0-9_-]{35}\b/g,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  /\bsntry[su]_[A-Za-z0-9_=+/-]{20,}/g,
  /\bphx_[A-Za-z0-9]{20,}\b/g,
];
const jwtCandidates = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const assignments = /\b(REACT_APP_[A-Z0-9_]+)\s*=\s*([^\r\n#]+)/gi;
const references = /\b(?:process\.env\.|import\.meta\.env\.)(REACT_APP_[A-Z0-9_]+)/gi;
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
export function inspectEnvironment(env, label = 'build environment') {
  const problems = [];
  for (const [key, value] of Object.entries(env)) {
    if (!/^REACT_APP_/i.test(key) || typeof value !== 'string') continue;
    const upperKey = key.toUpperCase();
    if (!vercelSystemVars.has(upperKey) && value.includes('$')) {
      problems.push(label + ': public environment interpolation is not allowed ' + key);
    }
    problems.push(...inspectText(label, `${key}=${value}`));
  }
  return problems;
}
export function inspectEnvFile(file, source) {
  const require = createRequire(import.meta.url);
  const dotenv = require(require.resolve('dotenv', { paths: [require.resolve('react-scripts/package.json')] }));
  const parsed = dotenv.parse(source);
  return inspectEnvironment(parsed, file);
}
export function inspectText(file, source) {
  const errors = [];
  const isClient = file.startsWith('src/') || file.startsWith('public/');
  for (const pattern of credentialSignals) {
    pattern.lastIndex=0;
    if (pattern.test(source)) errors.push(file + ': credential signature detected');
  }
  for (const [token] of source.matchAll(jwtCandidates)) {
    const role = jwtRole(token);
    if (role && role !== 'anon') errors.push(file + ': privileged JWT detected');
  }
  assignments.lastIndex=0;
  for (const match of source.matchAll(assignments)) {
    const [, rawKey, value] = match;
    const key = rawKey.toUpperCase();
    if (!isAllowedVar(key)) errors.push(file + ': unreviewed client environment variable ' + key);
    if (!vercelSystemVars.has(key) && sensitiveAssignment(value)) errors.push(file + ': sensitive-looking public assignment ' + key);
    if (key === 'REACT_APP_SUPABASE_ANON_KEY') {
      const role = jwtRole(value);
      if (role && role !== 'anon') errors.push(file + ': public anon-key variable contains a non-anon JWT');
    }
  }
  if (isClient) {
    references.lastIndex=0;
    for (const [, rawKey] of source.matchAll(references)) {
      const key = rawKey.toUpperCase();
      if (!isAllowedVar(key)) errors.push(file + ': unreviewed public variable reference ' + key);
    }
  }
  return [...new Set(errors)];
}
export function scanTracked(root = process.cwd()) {
  const names = execFileSync('git', ['ls-files', '-z'], {cwd:root}).toString('utf8').split('\0').filter(Boolean);
  const filtered = names.filter((name) =>
    (/\.(?:[cm]?[jt]sx?|html|json|css)$/.test(name) && !/\.test\.[cm]?[jt]sx?$/.test(name)) ||
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
  const issues = [...(process.argv.includes('--build') ? [] : scanTracked()), ...inspectEnvironment(process.env)];
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    if (existsSync(name)) issues.push(...inspectEnvFile(name, readFileSync(name, 'utf8')));
  }
  if (issues.length) {
    console.error(issues.join('\n'));
    console.error('Blocked: investigate, rotate exposed credentials, then remove them from committed history.');
    process.exitCode = 1;
  } else console.log('Client-secret guard passed: no unreviewed public variables or credential signatures.');
}
