import { Navigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import type { ReactNode } from "react";

export function Protected(props: { children: ReactNode }) {
  const { token, isReady } = useAuth();
  if (!isReady) return <div className="p-6 text-steam-muted">Загрузка…</div>;
  if (!token) return <Navigate to="/login" replace />;
  return <>{props.children}</>;
}

export function AdminOnly(props: { children: ReactNode }) {
  const { token, isReady, me } = useAuth();
  if (!isReady) return <div className="p-6 text-steam-muted">Загрузка…</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (me?.role !== "ADMIN" && me?.role !== "CREATOR") return <Navigate to="/" replace />;
  return <>{props.children}</>;
}

export function PublicOnly(props: { children: ReactNode }) {
  const { token, isReady } = useAuth();
  if (!isReady) return <div className="p-6 text-steam-muted">Загрузка…</div>;
  if (token) return <Navigate to="/profile" replace />;
  return <>{props.children}</>;
}

