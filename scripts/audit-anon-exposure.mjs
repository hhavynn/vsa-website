import fs from 'fs';
import path from 'path';

function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (!fs.existsSync(fullPath)) continue;

    for (const line of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed
        .slice(separator + 1)
        .trim()
        .replace(/^["']|["']$/g, '');

      if (key && !process.env[key]) process.env[key] = value;
    }
  }
}

function requiredEnv(names, label) {
  const value = names.map((name) => process.env[name]).find(Boolean);
  if (!value) {
    throw new Error(`${label} is required (${names.join(' or ')})`);
  }
  return value;
}

function parseTotal(contentRange) {
  if (!contentRange?.includes('/')) return null;
  const total = contentRange.split('/').at(-1);
  return total === '*' ? null : Number(total);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, options, maxAttempts = 3) {
  let response;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetch(url, options);
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt < maxAttempts) await delay(250 * attempt);
  }
  return response;
}

async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await callback(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

async function headCount(baseUrl, relation, select, apiKey) {
  const url = new URL(`/rest/v1/${relation}`, baseUrl);
  url.searchParams.set('select', select);

  const response = await fetchWithRetry(url, {
    method: 'HEAD',
    headers: {
      apikey: apiKey,
      Prefer: 'count=exact',
    },
  });

  return {
    status: response.status,
    total: parseTotal(response.headers.get('content-range')),
  };
}

async function headFilteredCount(baseUrl, relation, query, apiKey) {
  const url = new URL(`/rest/v1/${relation}?${query}`, baseUrl);
  const response = await fetchWithRetry(url, {
    method: 'HEAD',
    headers: {
      apikey: apiKey,
      Prefer: 'count=exact',
    },
  });

  return {
    status: response.status,
    total: parseTotal(response.headers.get('content-range')),
  };
}

function formatTotal(probe) {
  if (probe.status === 429 || probe.status >= 500) return `error:${probe.status}`;
  if (probe.status >= 400) return `denied:${probe.status}`;
  return probe.total === null ? 'unknown' : String(probe.total);
}

function isExpectedDenial(status) {
  return status === 401 || status === 403;
}

function isProbeError(status) {
  return status >= 400 && !isExpectedDenial(status);
}

function collectSchemaRefs(value, refs = new Set()) {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.$ref === 'string') refs.add(value.$ref);
  for (const nested of Object.values(value)) collectSchemaRefs(nested, refs);
  return refs;
}

function rpcSignatures(schema, name) {
  const operation = schema.paths?.[`/rpc/${name}`]?.post;
  const bodySchema = operation?.parameters?.find(
    (parameter) => parameter.in === 'body'
  )?.schema;
  const references = [...collectSchemaRefs(bodySchema)];
  const definitions = [];
  if (bodySchema?.properties) {
    definitions.push({ definitionName: 'inline', definition: bodySchema });
  }
  for (const reference of references) {
    const definitionName = reference.split('/').at(-1);
    definitions.push({
      definitionName,
      definition: schema.definitions?.[definitionName] ?? {},
    });
  }

  return definitions.map(({ definitionName, definition }) => {
    const required = new Set(definition.required ?? []);
    const parameters = Object.entries(definition.properties ?? {}).map(
      ([parameterName, property]) => ({
        name: parameterName,
        type: property.type ?? 'unknown',
        format: property.format ?? null,
        required: required.has(parameterName),
      })
    );
    return { definition: definitionName, parameters };
  });
}

loadEnv();

const supabaseUrl = requiredEnv(
  ['VITE_SUPABASE_URL', 'REACT_APP_SUPABASE_URL', 'SUPABASE_URL'],
  'Supabase URL'
);
const anonKey = requiredEnv(
  ['VITE_SUPABASE_ANON_KEY', 'REACT_APP_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
  'Supabase anon key'
);
const serviceRoleKey = requiredEnv(
  ['SUPABASE_SERVICE_ROLE_KEY'],
  'Supabase service-role key for schema metadata and count-only comparison'
);

if (anonKey === serviceRoleKey) {
  throw new Error('Anon and service-role keys must be different');
}

const schemaResponse = await fetchWithRetry(new URL('/rest/v1/', supabaseUrl), {
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: 'application/openapi+json',
  },
});

if (!schemaResponse.ok) {
  throw new Error(
    `Could not load PostgREST schema metadata (${schemaResponse.status})`
  );
}

const schema = await schemaResponse.json();
const relationNames = Object.keys(schema.paths ?? {})
  .filter((endpoint) => endpoint !== '/' && !endpoint.startsWith('/rpc/'))
  .map((endpoint) => endpoint.slice(1))
  .sort();
const rpcNames = Object.keys(schema.paths ?? {})
  .filter((endpoint) => endpoint.startsWith('/rpc/'))
  .map((endpoint) => endpoint.slice('/rpc/'.length))
  .sort();

const relations = await mapWithConcurrency(relationNames, 6, async (name) => {
  const columns = Object.keys(schema.definitions?.[name]?.properties ?? {}).sort();
  const [anonWildcard, serviceTotal, columnProbes] = await Promise.all([
    headCount(supabaseUrl, name, '*', anonKey),
    headCount(supabaseUrl, name, '*', serviceRoleKey),
    mapWithConcurrency(columns, 6, async (column) => ({
      column,
      ...(await headCount(supabaseUrl, name, column, anonKey)),
    })),
  ]);

  return {
    name,
    anonWildcard,
    serviceTotal,
    selectableColumns: columnProbes
      .filter((probe) => probe.status < 400)
      .map((probe) => probe.column),
    blockedColumns: columnProbes
      .filter((probe) => isExpectedDenial(probe.status))
      .map((probe) => probe.column),
    columnErrors: columnProbes
      .filter((probe) => isProbeError(probe.status))
      .map((probe) => ({ column: probe.column, status: probe.status })),
  };
});

const focusedChecks = await mapWithConcurrency(
  [
    {
      name: 'unpublished events',
      relation: 'events',
      query: 'select=id&is_published=eq.false',
    },
    {
      name: 'non-empty event check-in form URLs',
      relation: 'events',
      query:
        'select=check_in_form_url&check_in_form_url=not.is.null&check_in_form_url=neq.',
    },
    {
      name: 'unpublished House events',
      relation: 'house_events',
      query: 'select=id&is_published=eq.false',
    },
    {
      name: 'draft external events',
      relation: 'external_events',
      query: 'select=id&status=eq.draft',
    },
    {
      name: 'private AI knowledge rows',
      relation: 'ai_knowledge_base',
      query: 'select=id&is_public=eq.false',
    },
    {
      name: 'inactive AI knowledge rows',
      relation: 'ai_knowledge_base',
      query: 'select=id&is_active=eq.false',
    },
    {
      name: 'public application rows with a target URL',
      relation: 'public_application_links',
      query: 'select=id&target_url=not.is.null',
    },
    {
      name: 'UVSA schools with verification notes',
      relation: 'uvsa_schools',
      query: 'select=id&verification_notes=not.is.null',
    },
    {
      name: 'external events with source notes',
      relation: 'external_events',
      query: 'select=id&source_notes=not.is.null',
    },
  ],
  6,
  async (check) => ({
    ...check,
    anon: await headFilteredCount(
      supabaseUrl,
      check.relation,
      check.query,
      anonKey
    ),
    service: await headFilteredCount(
      supabaseUrl,
      check.relation,
      check.query,
      serviceRoleKey
    ),
  })
);

const rpcs = rpcNames.map((name) => ({
  name,
  signatures: rpcSignatures(schema, name),
  probed: false,
}));

const probeFailures = [
  ...relations.flatMap((relation) => {
    const failures = [];
    if (isProbeError(relation.anonWildcard.status)) {
      failures.push(`${relation.name} anon wildcard (${relation.anonWildcard.status})`);
    }
    if (relation.serviceTotal.status >= 400) {
      failures.push(`${relation.name} service count (${relation.serviceTotal.status})`);
    }
    for (const error of relation.columnErrors) {
      failures.push(`${relation.name}.${error.column} anon column (${error.status})`);
    }
    return failures;
  }),
  ...focusedChecks.flatMap((check) => {
    const failures = [];
    if (isProbeError(check.anon.status)) {
      failures.push(`${check.name} anon focused check (${check.anon.status})`);
    }
    if (check.service.status >= 400) {
      failures.push(`${check.name} service focused check (${check.service.status})`);
    }
    return failures;
  }),
];

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        safety: {
          relationRequests: 'HEAD only; no row bodies retrieved',
          rpcRequests: 'none',
          serviceRoleUse: 'OpenAPI metadata and exact row counts only',
        },
        relations,
        focusedChecks,
        rpcs,
        probeFailures,
      },
      null,
      2
    )
  );
  process.exit(probeFailures.length > 0 ? 1 : 0);
}

console.log(
  'RELATION\tANON_ROWS_VIA_*\tSERVICE_ROWS\tANON_SELECTABLE_COLUMNS\tBLOCKED_COLUMNS\tERROR_COLUMNS'
);
for (const relation of relations) {
  console.log(
    [
      relation.name,
      formatTotal(relation.anonWildcard),
      formatTotal(relation.serviceTotal),
      relation.selectableColumns.join(',') || '-',
      relation.blockedColumns.join(',') || '-',
      relation.columnErrors
        .map((error) => `${error.column}:${error.status}`)
        .join(',') || '-',
    ].join('\t')
  );
}

console.log('\nFOCUSED_CHECK\tANON_ROWS\tSERVICE_ROWS');
for (const check of focusedChecks) {
  console.log(
    [check.name, formatTotal(check.anon), formatTotal(check.service)].join('\t')
  );
}

console.log('\nRPC\tSIGNATURES_FROM_OPENAPI\tPROBED');
for (const rpc of rpcs) {
  const signatures = rpc.signatures
    .map((signature) =>
      signature.parameters
        .map((parameter) =>
          `${parameter.name}:${parameter.type}${
            parameter.format ? `(${parameter.format})` : ''
          }${parameter.required ? '' : '?'}`
        )
        .join(',')
    )
    .join(' | ');
  console.log(`${rpc.name}\t${signatures || '(no arguments)'}\tno`);
}

console.log(
  '\nSafety: relation checks used HEAD only; RPCs were enumerated but not invoked.'
);

if (probeFailures.length > 0) {
  console.error(
    `Audit incomplete: ${probeFailures.join('; ')}`
  );
  process.exitCode = 1;
}
