import { lazy, Suspense } from "react";
import { Routes as RouterRoutes, Route, Navigate, Link } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { AdminRoute } from "./AdminRoute";
import { PageLoader } from "../components/common/PageLoader";
import { PageTitle } from "../components/common/PageTitle";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { PointsProvider } from "../context/PointsContext";
import AdminLayout from "../components/features/admin/AdminLayout";
import RouteTracker from "../components/common/RouteTracker";

// Lazy load pages
const Home = lazy(() =>
  import("../pages/Home").then((module) => ({ default: module.Home }))
);
const Events = lazy(() =>
  import("../pages/Events").then((module) => ({ default: module.Events }))
);
const Leaderboard = lazy(() =>
  import("../pages/Leaderboard").then((module) => ({
    default: module.Leaderboard,
  }))
);
const Cabinet = lazy(() =>
  import("../pages/Cabinet").then((module) => ({ default: module.Cabinet }))
);
const GetInvolved = lazy(() =>
  import("../pages/GetInvolved").then((module) => ({
    default: module.GetInvolved,
  }))
);
const Gallery = lazy(() => import("../pages/Gallery"));
const Ace = lazy(() =>
  import("../pages/Ace").then((module) => ({ default: module.Ace }))
);
const House = lazy(() =>
  import("../pages/House").then((module) => ({ default: module.House }))
);
const HouseDetail = lazy(() =>
  import("../pages/HouseDetail").then((module) => ({ default: module.HouseDetail }))
);
const Internship = lazy(() =>
  import("../pages/Internship").then((module) => ({
    default: module.Internship,
  }))
);
const Vcn = lazy(() =>
  import("../pages/Vcn").then((module) => ({ default: module.VCN }))
);
const VcnCurrent = lazy(() =>
  import("../pages/VcnCurrent").then((module) => ({ default: module.VCNCurrent }))
);
const VcnArchive = lazy(() =>
  import("../pages/VcnArchive").then((module) => ({ default: module.VCNArchive }))
);
const WildNCulture = lazy(() =>
  import("../pages/WildNCulture").then((module) => ({
    default: module.WildNCulture,
  }))
);
const FeedbackPage = lazy(() =>
  import("../pages/Feedback").then((module) => ({ default: module.FeedbackPage }))
);
const Points = lazy(() => import("../pages/Points"));
const UVSANetwork = lazy(() => import("../pages/UVSANetwork"));

const AdminEvents = lazy(() => import("../pages/Admin/Events"));
const AdminOverview = lazy(() => import("../pages/Admin/Overview"));
const AdminContent = lazy(() => import("../pages/Admin/Content"));
const AdminResources = lazy(() => import("../pages/Admin/Resources"));
const AdminGallery = lazy(() => import("../pages/Admin/Gallery"));
const AdminVcnArchives = lazy(() => import("../pages/Admin/VcnArchives"));
const AdminFeedback = lazy(() => import("../pages/Admin/Feedback"));
const AdminImport = lazy(() => import("../pages/Admin/Import"));
const AdminMembers = lazy(() => import("../pages/Admin/Members"));
const AdminHouses = lazy(() => import("../pages/Admin/Houses"));
const AdminMergeSuggestions = lazy(() => import("../pages/Admin/MergeSuggestions"));
const AdminCabinet = lazy(() => import("../pages/Admin/Cabinet"));
const AdminYearsTerms = lazy(() => import("../pages/Admin/YearsTerms"));
const AdminPoints = lazy(() => import("../pages/Admin/Points"));
const AdminAnalytics = lazy(() => import("../pages/Admin/Analytics"));
const AdminSettings = lazy(() => import("../pages/Admin/Settings"));
const AdminAceFamilies = lazy(() => import("../pages/Admin/AceFamilies"));
const AdminUVSASchools = lazy(() => import("../pages/Admin/UVSASchools"));
const AdminExternalEvents = lazy(() => import("../pages/Admin/ExternalEvents"));
const SignIn = lazy(() =>
  import("../pages/SignIn").then((module) => ({ default: module.SignIn }))
);
const NotFound = lazy(() =>
  import("../pages/NotFound").then((module) => ({ default: module.NotFound }))
);

function MemberAccountsUnavailable() {
  return (
    <>
      <PageTitle title="Member Accounts Unavailable" />
      <div className="min-h-[60vh] px-4 py-20" style={{ background: "var(--color-bg)" }}>
        <div className="mx-auto max-w-md text-center">
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--color-text3)" }}>
            Member accounts
          </p>
          <h1 className="mt-3 font-serif leading-none tracking-[-0.03em]" style={{ fontSize: 36, color: "var(--color-text)" }}>
            Not currently enabled
          </h1>
          <p className="mt-4 font-sans text-sm leading-6" style={{ color: "var(--color-text2)" }}>
            VSA member account features are paused for this version of the site. Public pages are still available without signing in.
          </p>
          <Link
            to="/"
            className="mt-7 inline-flex rounded-lg bg-[var(--brand)] px-4 py-2.5 font-sans text-[13px] font-semibold text-[#f8fbfb] transition-opacity duration-150 hover:opacity-90"
          >
            Return Home
          </Link>
        </div>
      </div>
    </>
  );
}

export default function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader message="Loading page..." />}>
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-white focus:text-gray-900 focus:p-4 focus:rounded-br-lg"
        >
          Skip to main content
        </a>
        <PointsProvider>
          <RouteTracker />
          <RouterRoutes>
            <Route element={<Layout />}>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/cabinet" element={<Cabinet />} />
              <Route path="/get-involved" element={<GetInvolved />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/ace" element={<Ace />} />
              <Route path="/house" element={<House />} />
              <Route path="/house/archive/:yearSlug" element={<House />} />
              <Route path="/house/archive/:yearSlug/:houseSlug" element={<HouseDetail />} />
              <Route path="/house/:houseSlug" element={<HouseDetail />} />
              <Route path="/house-system" element={<House />} />
              <Route path="/intern-program" element={<Internship />} />
              <Route path="/vcn" element={<Vcn />} />
              <Route path="/vcn/current" element={<VcnCurrent />} />
              <Route path="/vcn/archive" element={<VcnArchive />} />
              <Route path="/wild-n-culture" element={<WildNCulture />} />
              <Route path="/uvsa-network" element={<UVSANetwork />} />
              <Route path="/signin" element={<Navigate to="/admin/login" replace />} />
              <Route path="/admin/login" element={<SignIn />} />

              {/* Member account routes are intentionally parked for this release. */}
              <Route path="/profile" element={<MemberAccountsUnavailable />} />
              {/* /points is a public no-account lookup (Find My Points + how-it-works). */}
              <Route path="/points" element={<Points />} />
              <Route path="/feedback" element={<FeedbackPage />} />

              {/* Admin Routes - all nested under AdminLayout (provides nav + shell) */}
              <Route element={<AdminRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminOverview />} />
                  <Route path="/admin/content" element={<AdminContent />} />
                  <Route path="/admin/resources" element={<AdminResources />} />
                  <Route path="/admin/events" element={<AdminEvents />} />
                  <Route path="/admin/gallery" element={<AdminGallery />} />
                  <Route path="/admin/vcn" element={<AdminVcnArchives />} />
                  <Route path="/admin/feedback" element={<AdminFeedback />} />
                  <Route path="/admin/import" element={<AdminImport />} />
                  <Route path="/admin/members" element={<AdminMembers />} />
                  <Route path="/admin/houses" element={<AdminHouses />} />
                  <Route path="/admin/merge-suggestions" element={<AdminMergeSuggestions />} />
                  <Route path="/admin/cabinet" element={<AdminCabinet />} />
                  <Route path="/admin/years" element={<AdminYearsTerms />} />
                  <Route path="/admin/points" element={<AdminPoints />} />
                  <Route path="/admin/analytics" element={<AdminAnalytics />} />
                  <Route path="/admin/settings" element={<AdminSettings />} />
                  <Route path="/admin/ace" element={<AdminAceFamilies />} />
                  <Route path="/admin/uvsa-schools" element={<AdminUVSASchools />} />
                  <Route path="/admin/external-events" element={<AdminExternalEvents />} />
                </Route>
              </Route>

              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </RouterRoutes>
        </PointsProvider>
      </Suspense>
    </ErrorBoundary>
  );
}
