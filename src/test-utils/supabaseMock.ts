/**
 * A recording mock of the Supabase query builder, for repository-layer tests.
 *
 * WHY THIS EXISTS
 * ---------------
 * The global mock in `src/setupTests.ts` stubs `createClient` with a builder
 * that only knows `select/insert/update/delete/eq/single`. Real repositories
 * chain `order`, `in`, `gte`, `lte`, `is`, `range`, and more, so that mock
 * throws "not a function" the moment a repository is exercised. This harness
 * replaces it for repository tests.
 *
 * The important property is that it **records the chain**. A test can assert
 * that a public read path actually applied `.eq('is_published', true)` rather
 * than merely that it returned rows the mock was told to return. That
 * distinction is the whole point of issue #292: a mock that only replays
 * canned data proves nothing about whether drafts are filtered out.
 *
 * Usage:
 *
 *   jest.mock('../../lib/supabase', () => ({
 *     get supabase() {
 *       return require('../../test-utils/supabaseMock').supabaseMock.client;
 *     },
 *   }));
 *
 *   beforeEach(() => supabaseMock.reset());
 *
 *   supabaseMock.queueResult('events', { data: [row], error: null });
 *   await eventsRepository.getEvents();
 *   expect(supabaseMock.filtersFor('events')).toContainEqual(['is_published', true]);
 */

export interface QueryResult<T = unknown> {
  data: T | null;
  error: unknown | null;
}

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export interface RecordedQuery {
  table: string;
  calls: RecordedCall[];
}

/** Chainable builder methods that return the builder itself. */
const CHAINABLE = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'or',
  'not',
  'filter',
  'match',
  'order',
  'limit',
  'range',
  'abortSignal',
  'returns',
  'overrideTypes',
] as const;

/** Terminal methods that resolve to a single row rather than a list. */
const SINGLE_ROW = ['single', 'maybeSingle'] as const;

type ChainableMethod = (typeof CHAINABLE)[number];
type SingleRowMethod = (typeof SINGLE_ROW)[number];

/**
 * The builder's public shape, derived from the method lists above so the two
 * cannot drift apart.
 */
export type MockQueryBuilder<T = unknown> = {
  [K in ChainableMethod]: (...args: unknown[]) => MockQueryBuilder<T>;
} & {
  [K in SingleRowMethod]: (...args: unknown[]) => Promise<QueryResult<T>>;
} & PromiseLike<QueryResult<T>>;

/**
 * Builds the recording query builder.
 *
 * Methods are installed dynamically from the lists above rather than written
 * out one by one, but the result is still fully typed: the scratch object is
 * `Record<string, unknown>` and is narrowed once through `unknown` at the
 * return. AGENTS.md forbids `any` outright, so there is none here.
 */
function createQueryBuilder<T>(
  record: RecordedQuery,
  resolveResult: (table: string, singleRow: boolean) => QueryResult<T>
): MockQueryBuilder<T> {
  const builder: Record<string, unknown> = {};
  // Held on an object rather than a bare `let` so the closures installed in the
  // loops below capture a stable reference (satisfies no-loop-func).
  const state = { settled: false };

  for (const method of CHAINABLE) {
    builder[method] = (...args: unknown[]) => {
      record.calls.push({ method, args });
      return builder;
    };
  }

  for (const method of SINGLE_ROW) {
    builder[method] = (...args: unknown[]) => {
      record.calls.push({ method, args });
      state.settled = true;
      return Promise.resolve(resolveResult(record.table, true));
    };
  }

  // Makes the builder awaitable, matching PostgREST: `await supabase.from(t)
  // .select()` resolves with no terminal call. When a terminal method already
  // consumed the result, awaiting again must not pull a second queued result
  // and silently desynchronise the queue.
  builder.then = <TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> =>
    Promise.resolve(resolveResult(record.table, state.settled)).then(
      onfulfilled as never,
      onrejected as never
    );

  return builder as unknown as MockQueryBuilder<T>;
}

export class SupabaseMock {
  private queued = new Map<string, QueryResult[]>();
  private defaults = new Map<string, QueryResult>();
  private recorded: RecordedQuery[] = [];

  /**
   * Signed-out auth stubs. The providers touch exactly six methods
   * (getSession, getUser, onAuthStateChange, signInWithPassword, signUp,
   * signOut); anything beyond that should be added deliberately rather than
   * auto-stubbed, so an untested auth path fails loudly.
   */
  readonly auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: (_callback?: unknown) => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
    signUp: async () => ({ data: { user: null, session: null }, error: null }),
    signOut: async () => ({ error: null }),
  };

  /** The object to substitute for the real `supabase` client. */
  readonly client = {
    auth: this.auth,
    from: (table: string) => {
      const record: RecordedQuery = { table, calls: [] };
      this.recorded.push(record);
      return createQueryBuilder(record, (t, singleRow) => this.takeResult(t, singleRow));
    },
    rpc: (fn: string, args?: unknown) => {
      const record: RecordedQuery = { table: `rpc:${fn}`, calls: [{ method: 'rpc', args: [args] }] };
      this.recorded.push(record);
      return createQueryBuilder(record, (t, singleRow) => this.takeResult(t, singleRow));
    },
  };

  /** Clear all queued results and recorded queries. Call in `beforeEach`. */
  reset(): void {
    this.queued.clear();
    this.defaults.clear();
    this.recorded = [];
  }

  /** Queue one result for the next query against `table` (FIFO). */
  queueResult<T>(table: string, result: QueryResult<T>): this {
    const existing = this.queued.get(table) ?? [];
    existing.push(result as QueryResult);
    this.queued.set(table, existing);
    return this;
  }

  /** Result returned for `table` whenever the queue is empty. */
  setDefault<T>(table: string, result: QueryResult<T>): this {
    this.defaults.set(table, result as QueryResult);
    return this;
  }

  private takeResult(table: string, singleRow: boolean): QueryResult {
    const queue = this.queued.get(table);
    if (queue && queue.length > 0) return queue.shift() as QueryResult;

    const fallback = this.defaults.get(table);
    if (fallback) return fallback;

    // An unconfigured table resolves empty rather than throwing, so a
    // repository that fans out across several tables does not require every
    // one of them to be stubbed for an unrelated assertion to run.
    return { data: singleRow ? null : [], error: null };
  }

  /** Every query recorded since the last reset, in call order. */
  queries(): RecordedQuery[] {
    return this.recorded;
  }

  /** Queries issued against a given table. */
  queriesFor(table: string): RecordedQuery[] {
    return this.recorded.filter((q) => q.table === table);
  }

  /**
   * Equality filters applied to `table`, as [column, value] pairs across every
   * query against it. This is the assertion surface for "did the public read
   * path actually exclude drafts?".
   */
  filtersFor(table: string): Array<[unknown, unknown]> {
    return this.queriesFor(table)
      .flatMap((q) => q.calls)
      .filter((c) => c.method === 'eq')
      .map((c) => [c.args[0], c.args[1]] as [unknown, unknown]);
  }

  /** Whether any query against `table` used `method`. */
  usedMethod(table: string, method: string): boolean {
    return this.queriesFor(table).some((q) => q.calls.some((c) => c.method === method));
  }
}

/** Shared instance, so `jest.mock` factories can reach it without hoisting problems. */
export const supabaseMock = new SupabaseMock();

/**
 * Builds an error shaped like a real PostgREST failure.
 *
 * This matters more than it looks. In @supabase/supabase-js 2.50.0,
 * `PostgrestError extends Error` and carries `code`/`details`/`hint`. That is
 * exactly the shape `withErrorHandling` sniffs for before routing through
 * `normalizeSupabaseError`. A test that throws a plain object instead would
 * fall through to the generic "Unknown error occurred" branch and would prove
 * the opposite of what it claims.
 */
export function postgrestError(
  message: string,
  code?: string,
  details = '',
  hint = ''
): Error & { code?: string; details: string; hint: string } {
  const error = new Error(message) as Error & {
    code?: string;
    details: string;
    hint: string;
  };
  error.name = 'PostgrestError';
  error.code = code;
  error.details = details;
  error.hint = hint;
  return error;
}
