import { QueryClient, QueryClientProvider } from "react-query";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import AppRoutes from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { AnalyticsConsentProvider } from "./context/AnalyticsConsentContext";
import { AnalyticsConsentBanner } from "./components/common/AnalyticsConsentBanner";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      cacheTime: 10 * 60 * 1000,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AnalyticsConsentProvider>
            <AuthProvider>
              <SiteSettingsProvider>
                <AppRoutes />
                <AnalyticsConsentBanner />
                <Toaster position="top-right" />
              </SiteSettingsProvider>
            </AuthProvider>
          </AnalyticsConsentProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
