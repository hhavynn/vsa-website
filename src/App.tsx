import { QueryClient, QueryClientProvider } from 'react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppRoutes } from './routes';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { PointsProvider } from './context/PointsContext';
import { ChatProvider } from './context/ChatContext';
import { ChatWidget } from './components/Chat/ChatWidget';
import { Toaster } from 'react-hot-toast';

const queryClient = new QueryClient();

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <PointsProvider>
              <ChatProvider>
                <AppRoutes />
                <ChatWidget />
                <Toaster position="top-right" />
              </ChatProvider>
            </PointsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
