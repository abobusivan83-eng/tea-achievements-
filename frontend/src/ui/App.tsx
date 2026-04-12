import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../state/auth";
import { Layout } from "./Layout";
import { Protected, AdminOnly, PublicOnly } from "./Protected";
import { Suspense, lazy } from "react";
import { Scene } from "./components/Scene";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./components/PageTransition";
import { Skeleton } from "./components/Skeleton";

const LoginPage = lazy(() => import("../views/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("../views/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ProfilePage = lazy(() => import("../views/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const AchievementsPage = lazy(() => import("../views/AchievementsPage").then((m) => ({ default: m.AchievementsPage })));
const LeaderboardPage = lazy(() => import("../views/LeaderboardPage").then((m) => ({ default: m.LeaderboardPage })));
const ShopPage = lazy(() => import("../views/ShopPage").then((m) => ({ default: m.ShopPage })));
const GiftsPage = lazy(() => import("../views/GiftsPage").then((m) => ({ default: m.GiftsPage })));
const TasksPage = lazy(() => import("../views/TasksPage").then((m) => ({ default: m.TasksPage })));
const AdminPage = lazy(() => import("../views/AdminPage").then((m) => ({ default: m.AdminPage })));
const NotFoundPage = lazy(() => import("../views/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="steam-card p-4">
        <div className="grid gap-3">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-3 w-72 rounded-md" />
          <Skeleton className="h-3 w-64 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const isReady = useAuth((s) => s.isReady);
  const me = useAuth((s) => s.me);
  const location = useLocation();

  // Before rendering protected areas, verify auth/token.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <PageTransition>
                <Scene id="auth">
                  <Suspense fallback={<RouteFallback />}>
                    <LoginPage />
                  </Suspense>
                </Scene>
              </PageTransition>
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <PageTransition>
                <Scene id="auth">
                  <Suspense fallback={<RouteFallback />}>
                    <RegisterPage />
                  </Suspense>
                </Scene>
              </PageTransition>
            </PublicOnly>
          }
        />

        <Route
          path="/"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Navigate to="/profile" replace />
                </PageTransition>
              </Layout>
            </Protected>
          }
        />

        <Route
          path="/profile"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <ProfilePage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </Protected>
          }
        />
        <Route
          path="/profile/:id"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <ProfilePage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </Protected>
          }
        />

        <Route
          path="/achievements"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <AchievementsPage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </Protected>
          }
        />

        <Route
          path="/leaderboard"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <LeaderboardPage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </Protected>
          }
        />

        <Route
          path="/shop"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <ShopPage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </Protected>
          }
        />

        <Route
          path="/gifts"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <GiftsPage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </Protected>
          }
        />

        <Route
          path="/tasks"
          element={
            <Protected>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <TasksPage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </Protected>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminOnly>
              <Layout>
                <PageTransition>
                  <Suspense fallback={<RouteFallback />}>
                    <AdminPage />
                  </Suspense>
                </PageTransition>
              </Layout>
            </AdminOnly>
          }
        />

        <Route
          path="*"
          element={
            <PageTransition>
              {isReady && me ? (
                <Layout>
                  <Suspense fallback={<RouteFallback />}>
                    <NotFoundPage />
                  </Suspense>
                </Layout>
              ) : (
                <Scene id="default">
                  <Suspense fallback={<RouteFallback />}>
                    <NotFoundPage />
                  </Suspense>
                </Scene>
              )}
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

