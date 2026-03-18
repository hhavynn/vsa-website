import { lazy, Suspense } from "react";
import { Routes as RouterRoutes, Route } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import { ProtectedRoute } from "./ProtectedRoute";
import { AdminRoute } from "./AdminRoute";
import { PageLoader } from "../components/common/PageLoader";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { PointsProvider } from "../context/PointsContext";
import AdminLayout from "../components/features/admin/AdminLayout";

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
const Profile = lazy(() =>
  import("../pages/Profile").then((module) => ({ default: module.Profile }))
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
const Points = lazy(() => import("../pages/Points"));
const Ace = lazy(() =>
  import("../pages/Ace").then((module) => ({ default: module.Ace }))
);
const House = lazy(() =>
  import("../pages/House").then((module) => ({ default: module.House }))
);
const Internship = lazy(() =>
  import("../pages/Internship").then((module) => ({
    default: module.Internship,
  }))
);
const Vcn = lazy(() =>
  import("../pages/Vcn").then((module) => ({ default: module.VCN }))
);
const WildNCulture = lazy(() =>
  import("../pages/WildNCulture").then((module) => ({
    default: module.WildNCulture,
  }))
);
const Feedback = lazy(() =>
  import("../pages/Feedback").then((module) => ({ default: module.FeedbackPage }))
);

const AdminEvents = lazy(() => import("../pages/Admin/Events"));
const AdminGallery = lazy(() => import("../pages/Admin/Gallery"));
const AdminFeedback = lazy(() => import("../pages/Admin/Feedback"));
const AdminImport = lazy(() => import("../pages/Admin/Import"));
const AdminMembers = lazy(() => import("../pages/Admin/Members"));
const AdminMergeSuggestions = lazy(() => import("../pages/Admin/MergeSuggestions"));
const SignIn = lazy(() =>
  import("../pages/SignIn").then((module) => ({ default: module.SignIn }))
);
const NotFound = lazy(() =>
  import("../pages/NotFound").then((module) => ({ default: module.NotFound }))
);

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
              <Route path="/house-system" element={<House />} />
              <Route path="/intern-program" element={<Internship />} />
              <Route path="/vcn" element={<Vcn />} />
              <Route path="/wild-n-culture" element={<WildNCulture />} />
              <Route path="/signin" element={<SignIn />} />

              {/* Member Routes - require authentication */}
              <Route element={<ProtectedRoute />}>
                <Route path="/profile" element={<Profile />} />
                <Route path="/points" element={<Points />} />
                <Route path="/feedback" element={<Feedback />} />
              </Route>

              {/* Admin Routes - require admin privileges */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<AdminLayout />} />
                <Route path="/admin/events" element={<AdminEvents />} />
                <Route path="/admin/gallery" element={<AdminGallery />} />
                <Route path="/admin/feedback" element={<AdminFeedback />} />
                <Route path="/admin/import" element={<AdminImport />} />
                <Route path="/admin/members" element={<AdminMembers />} />
                <Route path="/admin/merge-suggestions" element={<AdminMergeSuggestions />} />
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
