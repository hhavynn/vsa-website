import React from 'react';
import { render } from '@testing-library/react';

jest.mock('react-query', () => ({
  QueryClient: function () {
    return {};
  },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuery: jest.fn(),
  useMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock('./context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({
    theme: 'light',
    toggleTheme: jest.fn(),
  }),
}));

jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    session: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('./context/PointsContext', () => ({
  PointsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePointsContext: () => ({
    points: 0,
    loading: false,
    addPoints: jest.fn(),
    refreshPoints: jest.fn(),
  }),
}));

jest.mock('./routes', () => ({
  AppRoutes: () => <div>App Routes</div>,
}));

jest.mock('./components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('react-hot-toast', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

const App = require('./App').default;

test('renders VSA website', () => {
  render(<App />);
  // Check if the app renders without crashing
  expect(document.body).toBeInTheDocument();
});
