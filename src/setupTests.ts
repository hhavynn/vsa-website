// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock environment variables for testing
process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';

const createMediaQueryList = (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
});

const matchMediaMock = (query: string) => createMediaQueryList(query);

// Mock window.matchMedia for testing. Framer Motion still reads the deprecated
// listener methods in JSDOM.
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: matchMediaMock,
});

Object.defineProperty(global, 'matchMedia', {
  configurable: true,
  writable: true,
  value: matchMediaMock,
});

class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [0];

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }

  takeRecords() {
    return [];
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: MockIntersectionObserver,
});

Object.defineProperty(global, 'IntersectionObserver', {
  configurable: true,
  writable: true,
  value: MockIntersectionObserver,
});

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const createQuery = (data: unknown[] = []) => {
      const response = { data, error: null };
      const query = {
        select: () => query,
        insert: () => query,
        update: () => query,
        delete: () => query,
        upsert: () => query,
        eq: () => query,
        gte: () => query,
        lte: () => query,
        in: () => query,
        order: () => query,
        limit: () => query,
        range: () => query,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: (value: typeof response) => unknown) =>
          Promise.resolve(response).then(resolve),
      };
      return query;
    };

    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ error: null }),
        signUp: () => Promise.resolve({ error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({
          data: {
            subscription: {
              unsubscribe: () => undefined,
            },
          },
        }),
      },
      from: () => createQuery(),
      channel: () => ({
        on: () => ({
          subscribe: () => ({ unsubscribe: () => undefined }),
        }),
        subscribe: () => ({ unsubscribe: () => undefined }),
      }),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ data: null, error: null }),
          remove: () => Promise.resolve({ data: null, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
    };
  },
}));
