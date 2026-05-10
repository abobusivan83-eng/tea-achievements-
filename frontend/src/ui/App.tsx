import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/auth";
import { Layout } from "./Layout";
import { Protected, AdminOnly, PublicOnly } from "./Protected";
import { Scene } from "./components/Scene";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./components/PageTransition";

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
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="grid gap-4">
        <div className="h-36 rounded-2xl bg-white/[0.06] animate-pulse" aria-hidden />
        <div className="h-24 rounded-2xl bg-white/[0.05] animate-pulse" aria-hidden />
        <div className="h-24 rounded-2xl bg-white/[0.04] animate-pulse md:col-span-1" aria-hidden />
      </div>
      <p className="mt-8 text-center text-sm text-steam-muted">Загрузка раздела…</p>
    </div>
  );
}

export function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const isReady = useAuth((s) => s.isReady);
  const me = useAuth((s) => s.me);
  const location = useLocation();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <PageTransition>
                  <Scene id="auth">
                    <LoginPage />
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
                    <RegisterPage />
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
                    <ProfilePage />
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
                    <ProfilePage />
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
                    <AchievementsPage />
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
                    <LeaderboardPage />
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
                    <ShopPage />
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
                    <GiftsPage />
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
                    <TasksPage />
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
                    <AdminPage />
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
                    <NotFoundPage />
                  </Layout>
                ) : (
                  <Scene id="default">
                    <NotFoundPage />
                  </Scene>
                )}
              </PageTransition>
            }
          />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}
