// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Jest 27's jsdom omits the Web encoding APIs required by React Router 7.
Object.assign(globalThis, { TextEncoder, TextDecoder });

// Mock environment variables for testing
process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock window.matchMedia for testing.
//
// Deliberately a plain function, NOT jest.fn(). Create React App sets
// `resetMocks: true`, which strips the implementation off every jest.fn()
// before each test — including ones installed here. When this was a jest.fn(),
// `window.matchMedia(...)` returned undefined in every test, so ThemeProvider
// threw on `.matches` during render and any component tree wrapped in an
// ErrorBoundary silently rendered the error state instead of the app.
// A plain function survives resetMocks. Do not "modernise" this to jest.fn().
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined, // deprecated
    removeListener: () => undefined, // deprecated
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom has no IntersectionObserver, but every browser the site supports does.
// framer-motion's whileInView (RevealOnScrollWrapper) constructs one on mount,
// so without this stub any page using it throws into the ErrorBoundary under
// test. It never reports an intersection, so in-view content stays at its
// initial state. Plain class for the same resetMocks reason as matchMedia.
class IntersectionObserverStub {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserverStub,
});

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signIn: jest.fn(),
      signOut: jest.fn(),
      onAuthStateChange: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  })),
}));
