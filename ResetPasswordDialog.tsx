import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { Layout } from "@/components/layout/Layout";
import { RequireAuth } from "@/components/RouteGuards";
import Login from "@/pages/Login";

// Route-level code splitting: each page (plus whatever it imports — dialogs,
// admin actions, etc.) becomes its own chunk fetched on demand, instead of
// one ~520KB bundle loaded up front. Login stays eager since it's the first
// thing an unauthenticated visitor sees.
const Tournaments = lazy(() => import("@/pages/Tournaments"));
const EventPage = lazy(() => import("@/pages/Event"));
const Rating = lazy(() => import("@/pages/Rating"));
const Profile = lazy(() => import("@/pages/Profile"));

// Admin isn't a separate section — every route above is the same interface for
// everyone. Admins just see extra buttons/dialogs inline (see isAdmin checks in
// Tournaments.tsx, Rating.tsx, and Event.tsx).
export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Tournaments />} />
            <Route path="/event/:id" element={<EventPage />} />
            <Route path="/rating" element={<Rating />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

function PageFallback() {
  return <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>;
}
