import { QueryClient, QueryClientProvider } from "react-query";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import AppRoutes from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { AnalyticsConsentProvider } from "./context/AnalyticsConsentContext";
import { AnalyticsConsentBanner } from "./components/common/AnalyticsConsentBanner";
import { Toaster } from "react-hot-toast";
import { MotionConfig } from "framer-motion";

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
                {/* Safety net: with prefers-reduced-motion, every framer-motion
                    transform/layout animation is skipped. Components still opt
                    out of opacity reveals explicitly so nothing stays hidden. */}
                <MotionConfig reducedMotion="user">
                  <AppRoutes />
                  <AnalyticsConsentBanner />
                </MotionConfig>
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
