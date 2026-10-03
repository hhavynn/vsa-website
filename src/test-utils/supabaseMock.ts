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

/** The slice of a supabase-js session the app reads. */
export interface AuthSession {
  user: { id: string; email?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export type AuthListener = (event: string, session: AuthSession | null) => void;

export interface AuthResult {
  data: { user: AuthSession['user'] | null; session: AuthSession | null };
  error: unknown | null;
}

export class SupabaseMock {
  private queued = new Map<string, QueryResult[]>();
  private defaults = new Map<string, QueryResult>();
  private recorded: RecordedQuery[] = [];

  private authListeners = new Set<AuthListener>();
  private authSession: AuthSession | null = null;
  private signInResult: AuthResult = { data: { user: null, session: null }, error: null };
  private signOutError: unknown | null = null;

  /**
   * Auth stubs, signed out by default. The providers touch exactly these
   * methods; anything beyond that should be added deliberately rather than
   * auto-stubbed, so an untested auth path fails loudly.
   *
   * Session behaviour is scriptable for auth-lifecycle tests: `setAuthSession`
   * sets what `getSession` returns, `emitAuthEvent` plays an event to every
   * subscriber the way supabase-js does (SIGNED_OUT on expiry, a fresh
   * SIGNED_IN on tab refocus), and `signOut` emits SIGNED_OUT like the real one.
   */
  readonly auth = {
    getSession: async () => ({ data: { session: this.authSession }, error: null }),
    getUser: async () => ({ data: { user: this.authSession?.user ?? null }, error: null }),
    onAuthStateChange: (callback?: AuthListener) => {
      if (callback) this.authListeners.add(callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              if (callback) this.authListeners.delete(callback);
            },
          },
        },
      };
    },
    signInWithPassword: async (_credentials?: unknown) => this.signInResult,
    signOut: async () => {
      this.authSession = null;
      this.emitAuthEvent('SIGNED_OUT', null);
      return { error: this.signOutError };
    },
    refreshSession: async () => {
      this.refreshSessionCalls += 1;
      return { data: { session: this.authSession, user: this.authSession?.user ?? null }, error: null };
    },
  };

  /** Times `auth.refreshSession` was called since the last reset. */
  refreshSessionCalls = 0;

  /** Set the session `getSession` returns (null = signed out). */
  setAuthSession(session: AuthSession | null): this {
    this.authSession = session;
    return this;
  }

  /** What `signInWithPassword` resolves with next (and until changed). */
  setSignInResult(result: AuthResult): this {
    this.signInResult = result;
    return this;
  }

  /** Make `signOut` report a server-side failure (local state still clears). */
  setSignOutError(error: unknown | null): this {
    this.signOutError = error;
    return this;
  }

  /** Deliver an auth event to every subscriber. Wrap in `act()` when rendered. */
  emitAuthEvent(event: string, session: AuthSession | null): void {
    if (event !== 'SIGNED_OUT') this.authSession = session;
    this.authListeners.forEach((listener) => listener(event, session));
  }

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
    // Realtime: an inert channel. Leaderboard subscribes to `members` changes
    // in its all-time view once data has loaded; without this the page threw
    // `supabase.channel is not a function` inside an effect, and the route
    // smoke test failed whenever that effect ran before the test finished.
    channel: (name: string) => {
      this.recorded.push({ table: `channel:${name}`, calls: [{ method: 'channel', args: [name] }] });
      const channel = {
        on: () => channel,
        subscribe: () => channel,
        unsubscribe: async () => 'ok' as const,
      };
      return channel;
    },
    removeChannel: async () => 'ok' as const,
  };

  /** Clear all queued results and recorded queries. Call in `beforeEach`. */
  reset(): void {
    this.queued.clear();
    this.defaults.clear();
    this.recorded = [];
    this.authListeners.clear();
    this.authSession = null;
    this.signInResult = { data: { user: null, session: null }, error: null };
    this.signOutError = null;
    this.refreshSessionCalls = 0;
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
 * This matters more than it looks, and the previous version of this helper had it
 * backwards. `PostgrestError` does extend `Error` in @supabase/supabase-js 2.50.0,
 * but the client only *constructs* one when the caller opts into
 * `.throwOnError()`. On the `{ data, error }` path that every repository in
 * `src/data/repos/` uses, `PostgrestBuilder` assigns a **plain object literal**
 * instead.
 *
 * So returning an `Error` here made the mock strictly friendlier than production:
 * it satisfied the old `instanceof Error` gate in `withErrorHandling`, the tests
 * went green, and the real plain-object payload fell through to the generic
 * "Unknown error occurred" branch in the browser — which is exactly the bug
 * users hit submitting a photo request.
 *
 * This now returns the plain object the client actually produces. Keep it that
 * way: a mock that is easier to handle than reality proves nothing.
 */
export function postgrestError(
  message: string,
  code?: string,
  details = '',
  hint = ''
): { message: string; code?: string; details: string; hint: string } {
  return { message, code, details, hint };
}
