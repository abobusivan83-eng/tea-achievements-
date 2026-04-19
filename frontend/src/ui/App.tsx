import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../state/auth";
import { Layout } from "./Layout";
import { Protected, AdminOnly, PublicOnly } from "./Protected";
import { Scene } from "./components/Scene";
import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./components/PageTransition";
import { LoginPage } from "../views/LoginPage";
import { RegisterPage } from "../views/RegisterPage";
import { ProfilePage } from "../views/ProfilePage";
import { AchievementsPage } from "../views/AchievementsPage";
import { LeaderboardPage } from "../views/LeaderboardPage";
import { ShopPage } from "../views/ShopPage";
import { GiftsPage } from "../views/GiftsPage";
import { TasksPage } from "../views/TasksPage";
import { AdminPage } from "../views/AdminPage";
import { NotFoundPage } from "../views/NotFoundPage";

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
    </AnimatePresence>
  );
}
