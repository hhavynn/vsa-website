import { QueryClientProvider } from "react-query";
import { createQueryClient } from "./lib/queryClient";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import AppRoutes from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { AnalyticsConsentProvider } from "./context/AnalyticsConsentContext";
import { AnalyticsConsentBanner } from "./components/common/AnalyticsConsentBanner";
import { Toaster } from "react-hot-toast";

const queryClient = createQueryClient();

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
