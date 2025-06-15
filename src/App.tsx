import { QueryClient, QueryClientProvider } from 'react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppRoutes } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { PointsProvider } from './context/PointsContext';

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <PointsProvider>
              <AppRoutes />
            </PointsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
