import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../state/auth";
import { useEffect, useState, type ReactNode } from "react";
import {
  FiAward,
  FiBell,
  FiCheckSquare,
  FiGift,
  FiHome,
  FiShield,
  FiShoppingBag,
  FiTrendingUp,
  FiUser,
} from "react-icons/fi";
import { Toasts } from "./Toasts";
import { Scene, type SceneId } from "./components/Scene";
import { apiFetch, apiJson, apiUploadMany } from "../lib/api";
import type { AdminAuditLogRow, LeaderboardRow, Notification, Report, Suggestion } from "../lib/types";
import { useSound } from "../state/sound";
import { useToasts } from "../state/toasts";

export function Layout(props: { children: ReactNode }) {
  const { me, logout, isAdmin, isStaff } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [mySuggestions, setMySuggestions] = useState<Suggestion[]>([]);
  const [myReports, setMyReports] = useState<Report[]>([]);
  const [reportUsers, setReportUsers] = useState<LeaderboardRow[]>([]);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [suggestFiles, setSuggestFiles] = useState<File[]>([]);
  const [reportUserId, setReportUserId] = useState<string>("");
  const [reportReason, setReportReason] = useState<"spam" | "insult" | "cheat" | "other">("spam");
  const [reportDesc, setReportDesc] = useState("");
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const [giftUnread, setGiftUnread] = useState(0);
  const play = useSound((s) => s.play);
  const toast = useToasts((s) => s.push);
  const silentApiFetch = <T,>(path: string) => apiFetch<T>(path, { silent: true });

  const unreadCount = notificationUnread;

  function formatNotificationText(text: string) {
    // Hide internal coin marker lines from the UI (coins are still computed on the backend).
    const cleaned = text
      .split("\n")
      .filter((line) => !line.trim().startsWith("[COIN_BONUS]:"))
      .join("\n")
      .trim();
    return cleaned || text;
  }

  async function refreshNotificationCenter() {
    if (!me) return;
    const [notificationItems, suggestionItems, reportItems] = await Promise.all([
      silentApiFetch<Notification[]>("/api/support/notifications?take=50"),
      silentApiFetch<Suggestion[]>("/api/support/suggestions/mine"),
      silentApiFetch<Report[]>("/api/support/reports/mine"),
    ]);
    setNotifications(notificationItems);
    setNotificationUnread(notificationItems.filter((item) => !item.isRead).length);
    setMySuggestions(suggestionItems);
    setMyReports(reportItems);
  }

  async function markNotificationRead(id: string) {
    await apiJson(`/api/support/notifications/${id}/read`, {}, "PATCH");
    let unreadDelta = 0;
    setNotifications((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (!item.isRead) unreadDelta = -1;
        return { ...item, isRead: true };
      }),
    );
    if (unreadDelta !== 0) {
      setNotificationUnread((prev) => Math.max(0, prev + unreadDelta));
    }
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const items = await apiFetch<LeaderboardRow[]>("/api/leaderboard");
        if (!mounted) return;
        setReportUsers(items);
        if (!reportUserId) setReportUserId(items.find((x) => x.id !== me?.id)?.id ?? "");
      } catch {
        // ignore
      }
    }
    if (reportOpen) run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOpen]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const items = await apiFetch<AdminAuditLogRow[]>("/api/admin/audit-logs?take=120");
        if (!mounted) return;
        setLogs(items);
      } catch {
        if (!mounted) return;
        setLogs([]);
      }
    }
    if (logsOpen && isStaff()) run();
    return () => {
      mounted = false;
    };
  }, [logsOpen, isStaff]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!me) return;
      try {
        const r = await silentApiFetch<{ count: number }>("/api/support/notifications/unread-count");
        if (!mounted) return;
        setNotificationUnread(r.count ?? 0);
      } catch {
        if (!mounted) return;
        setNotificationUnread(0);
      }
    }
    run();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void run();
    }, 20_000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [me?.id]);

  useEffect(() => {
    if (!me) {
      setGiftUnread(0);
      setNotificationUnread(0);
      return;
    }
    let mounted = true;
    async function run() {
      try {
        const r = await silentApiFetch<{ count: number }>("/api/gifts/unread-count");
        if (!mounted) return;
        setGiftUnread(r.count ?? 0);
      } catch {
        if (mounted) setGiftUnread(0);
      }
    }
    run();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void run();
    }, 20_000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [me?.id]);

  useEffect(() => {
    if (!notificationsOpen || !me) return;
    refreshNotificationCenter().catch(() => {
      setMySuggestions([]);
      setMyReports([]);
    });
  }, [notificationsOpen, me]);

  const scene: SceneId =
    loc.pathname.startsWith("/profile")
      ? "profile"
      : loc.pathname.startsWith("/achievements")
        ? "achievements"
        : loc.pathname.startsWith("/leaderboard")
          ? "leaderboard"
          : loc.pathname.startsWith("/tasks")
            ? "achievements"
          : loc.pathname.startsWith("/shop")
            ? "shop"
            : loc.pathname.startsWith("/gifts")
              ? "gifts"
          : loc.pathname.startsWith("/admin")
            ? "admin"
            : "default";

  return (
    <Scene id={scene}>
      <Toasts />
      <header className="navbar">
        <div className="nav-container">
          <Link to="/" className="nav-brand flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 shadow-steam">
              <FiHome />
            </span>
            <span className="leading-none">Чайные достижения</span>
            <span className="text-xs font-normal text-steam-muted">клановая система прогресса</span>
          </Link>

          <nav className="nav-links">
            <NavItem to="/profile" icon={<FiUser />}>
              Профиль
            </NavItem>
            <NavItem to="/shop" icon={<FiShoppingBag />}>
              Магазин
            </NavItem>
            <NavLink
              to="/gifts"
              onMouseEnter={() => play("hover")}
              onClick={() => play("tab")}
              className={({ isActive }) => clsx("nav-link group relative inline-flex items-center gap-2", isActive && "active")}
            >
              <span className="relative z-10 inline-flex items-center text-base opacity-90">
                <FiGift />
                {giftUnread > 0 ? <span className="nav-badge">{giftUnread > 99 ? "99+" : giftUnread}</span> : null}
              </span>
              <span className="z-10">Подарки</span>
            </NavLink>
            <NavItem to="/tasks" icon={<FiCheckSquare />}>
              Задания
            </NavItem>
            <NavItem to="/achievements" icon={<FiAward />}>
              Достижения
            </NavItem>
            <NavItem to="/leaderboard" icon={<FiTrendingUp />}>
              Рейтинг
            </NavItem>
            {me ? (
              <button
                type="button"
                className="nav-link ml-auto"
                onMouseEnter={() => play("hover")}
                onClick={() => {
                  play("click");
                  logout();
                  nav("/login");
                }}
              >
                Выйти
              </button>
            ) : null}
            {me ? (
              <button
                type="button"
                className="nav-link relative"
                onMouseEnter={() => play("hover")}
                onClick={() => {
                  play("tab");
                  setNotificationsOpen(true);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <FiBell />
                  <span>Уведомления</span>
                </span>
                {unreadCount > 0 ? <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
              </button>
            ) : null}
            {isStaff() ? (
              <NavItem to="/admin" icon={<FiShield />}>
                {me?.role === "CREATOR" ? "Создатель" : "Админ"}
              </NavItem>
            ) : null}
          </nav>

          <div className="nav-actions">
            <button
              className="btn-suggestion"
              type="button"
              onMouseEnter={() => play("hover")}
              onClick={() => {
                play("click");
                setSuggestOpen(true);
              }}
            >
              Идея
            </button>
            <button
              className="btn-report"
              type="button"
              onMouseEnter={() => play("hover")}
              onClick={() => {
                play("click");
                setReportOpen(true);
              }}
            >
              Жалоба
            </button>
            {isStaff() ? (
              <button
                className="btn-logs"
                type="button"
                onMouseEnter={() => play("hover")}
                onClick={() => {
                  play("tab");
                  setLogsOpen((v) => !v);
                }}
              >
                Логи
              </button>
            ) : null}
            {me ? (
              <span className="hidden text-sm text-steam-muted sm:inline">
                {me.nickname}{" "}
                {me.role === "ADMIN" ? "(admin)" : me.role === "CREATOR" ? "(creator)" : ""}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {isStaff() ? (
        <div className={clsx("logs-panel", logsOpen && "active")}>
          <div className="logs-header">
            <h3>Журнал действий администраторов</h3>
            <button type="button" className="close-btn" onClick={() => setLogsOpen(false)}>
              ×
            </button>
          </div>
          <div className="logs-list">
            {logs.length ? (
              logs.map((row) => (
                <div key={row.id} className="log-item">
                  <span className="log-time">{new Date(row.createdAt).toLocaleString()}</span>
                  <span className="log-text">{row.summary}</span>
                  <span className="log-admin">Админ: {row.adminNickname}</span>
                  {row.targetNickname ? (
                    <span className="log-target text-steam-muted"> → {row.targetNickname}</span>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="log-item">
                <span className="log-time">—</span>
                <span className="log-text">Нет записей</span>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {notificationsOpen ? (
        <div className="modal active" onMouseDown={(e) => e.target === e.currentTarget && setNotificationsOpen(false)}>
          <div className="modal-content notifications-modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Уведомления и ответы администрации</h3>
              <button type="button" onClick={() => setNotificationsOpen(false)} className="close-btn">
                ×
              </button>
            </div>
            <div className="edit-form grid gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-steam-muted">
                  Здесь собраны личные уведомления, жалобы и предложения с ответами администрации.
                </div>
                <button
                  type="button"
                  className="btn-steam btn-secondary-steam"
                  onClick={async () => {
                    try {
                      await apiJson("/api/support/notifications/read-all", {}, "PATCH");
                      await refreshNotificationCenter();
                      setNotificationUnread(0);
                      toast({ kind: "success", title: "Уведомления отмечены как прочитанные" });
                    } catch (e: any) {
                      toast({ kind: "error", title: "Не удалось обновить уведомления", message: e?.message ?? "Ошибка" });
                    }
                  }}
                >
                  Прочитать всё
                </button>
              </div>

              <section className="grid gap-3">
                <div className="text-sm font-semibold">Лента уведомлений</div>
                <div className="grid gap-2">
                  {notifications.length ? (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={clsx(
                          "rounded-xl border p-3 text-left transition-colors",
                          item.isRead ? "border-white/10 bg-black/20" : "border-steam-accent/30 bg-steam-accent/10",
                        )}
                        onClick={async () => {
                          try {
                            if (!item.isRead) await markNotificationRead(item.id);
                          } catch (e: any) {
                            toast({ kind: "error", title: "Не удалось отметить уведомление", message: e?.message ?? "Ошибка" });
                          }
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{item.type}</span>
                          <span className="text-xs text-steam-muted">{new Date(item.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="mt-2 whitespace-pre-line text-sm text-steam-text">{formatNotificationText(item.text)}</div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-steam-muted">
                      Уведомлений пока нет.
                    </div>
                  )}
                </div>
              </section>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="grid gap-3">
                  <div className="text-sm font-semibold">Мои жалобы</div>
                  <div className="grid gap-2">
                    {myReports.length ? (
                      myReports.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{item.reason.toUpperCase()}</span>
                            <span className="text-xs text-steam-muted">{supportStatusLabel(item.status)}</span>
                          </div>
                          <div className="mt-2 text-sm text-steam-muted">{item.description}</div>
                          {item.adminResponse ? (
                            <div className="mt-3 rounded-lg border border-steam-accent/20 bg-steam-accent/10 p-3 text-sm">
                              <div className="text-xs uppercase tracking-wide text-steam-muted">Ответ администрации</div>
                              <div className="mt-1 whitespace-pre-line text-steam-text">{item.adminResponse}</div>
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-steam-muted">
                        Вы ещё не отправляли жалобы.
                      </div>
                    )}
                  </div>
                </section>

                <section className="grid gap-3">
                  <div className="text-sm font-semibold">Мои предложения</div>
                  <div className="grid gap-2">
                    {mySuggestions.length ? (
                      mySuggestions.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{item.title}</span>
                            <span className="text-xs text-steam-muted">{supportStatusLabel(item.status)}</span>
                          </div>
                          <div className="mt-2 text-sm text-steam-muted">{item.description}</div>
                          {item.adminResponse ? (
                            <div className="mt-3 rounded-lg border border-steam-accent/20 bg-steam-accent/10 p-3 text-sm">
                              <div className="text-xs uppercase tracking-wide text-steam-muted">Ответ администрации</div>
                              <div className="mt-1 whitespace-pre-line text-steam-text">{item.adminResponse}</div>
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-steam-muted">
                        Вы ещё не отправляли предложения.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-6">{props.children}</main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-steam-muted">
        Чайные достижения. Клановая система прогресса на базе Express, Prisma и Vite.
      </footer>

      {suggestOpen ? (
        <div className="modal active" onMouseDown={(e) => e.target === e.currentTarget && setSuggestOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Добавить предложение</h3>
              <button type="button" onClick={() => setSuggestOpen(false)} className="close-btn">
                ×
              </button>
            </div>
            <div className="edit-form">
              <div className="form-group">
                <label>Заголовок</label>
                <input
                  value={suggestTitle}
                  onChange={(e) => setSuggestTitle(e.target.value)}
                  className="w-full"
                  placeholder="Краткое описание идеи"
                />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea value={suggestDesc} onChange={(e) => setSuggestDesc(e.target.value)} rows={4} className="w-full" />
              </div>
              <div className="form-group">
                <label>Скриншоты (до 8)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setSuggestFiles(Array.from(e.target.files ?? []).slice(0, 8))}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-steam btn-primary-steam"
                  onClick={async () => {
                    try {
                      if (suggestTitle.trim().length < 3) {
                        toast({ kind: "error", title: "Укажите заголовок минимум из 3 символов" });
                        return;
                      }
                      if (suggestDesc.trim().length < 10) {
                        toast({ kind: "error", title: "Описание должно быть минимум 10 символов" });
                        return;
                      }
                      const created = await apiJson<{ id: string }>("/api/support/suggestions", {
                        title: suggestTitle,
                        description: suggestDesc,
                      });
                      if (suggestFiles.length) {
                        await apiUploadMany(`/api/support/suggestions/${created.id}/images`, suggestFiles);
                      }
                      setSuggestTitle("");
                      setSuggestDesc("");
                      setSuggestFiles([]);
                      setSuggestOpen(false);
                      await refreshNotificationCenter().catch(() => undefined);
                      toast({ kind: "success", title: "Предложение отправлено" });
                    } catch (e: any) {
                      toast({ kind: "error", title: "Не удалось отправить предложение", message: e?.message ?? "Ошибка" });
                    }
                  }}
                >
                  Отправить
                </button>
                <button type="button" className="btn-steam btn-secondary-steam" onClick={() => setSuggestOpen(false)}>
                  Назад
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reportOpen ? (
        <div className="modal active" onMouseDown={(e) => e.target === e.currentTarget && setReportOpen(false)}>
          <div className="modal-content" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h3>Подать жалобу</h3>
              <button type="button" onClick={() => setReportOpen(false)} className="close-btn">
                ×
              </button>
            </div>
            <div className="edit-form">
              <div className="form-group">
                <label>На кого жалоба</label>
                <select value={reportUserId} onChange={(e) => setReportUserId(e.target.value)}>
                  <option value="" disabled>
                    Выберите игрока
                  </option>
                  {reportUsers
                    .filter((u) => u.id !== me?.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nickname}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-group">
                <label>Причина</label>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value as typeof reportReason)}>
                  <option value="spam">Спам</option>
                  <option value="insult">Оскорбления</option>
                  <option value="cheat">Читерство</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} rows={4} className="w-full" />
              </div>
              <div className="form-group">
                <label>Скриншоты (до 8)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setReportFiles(Array.from(e.target.files ?? []).slice(0, 8))}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-steam btn-danger-steam"
                  onClick={async () => {
                    try {
                      if (!reportUserId) {
                        toast({ kind: "error", title: "Выберите игрока" });
                        return;
                      }
                      if (reportDesc.trim().length < 10) {
                        toast({ kind: "error", title: "Описание должно быть минимум 10 символов" });
                        return;
                      }
                      const created = await apiJson<{ id: string }>("/api/support/reports", {
                        reportedId: reportUserId,
                        reason: reportReason,
                        description: reportDesc,
                      });
                      if (reportFiles.length) {
                        await apiUploadMany(`/api/support/reports/${created.id}/images`, reportFiles);
                      }
                      setReportDesc("");
                      setReportReason("spam");
                      setReportUserId("");
                      setReportFiles([]);
                      setReportOpen(false);
                      await refreshNotificationCenter().catch(() => undefined);
                      toast({ kind: "success", title: "Жалоба отправлена" });
                    } catch (e: any) {
                      toast({ kind: "error", title: "Не удалось отправить жалобу", message: e?.message ?? "Ошибка" });
                    }
                  }}
                >
                  Отправить
                </button>
                <button type="button" className="btn-steam btn-secondary-steam" onClick={() => setReportOpen(false)}>
                  Назад
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Scene>
  );
}

function supportStatusLabel(status: Suggestion["status"] | Report["status"]) {
  switch (status) {
    case "REVIEWED":
      return "Рассмотрено";
    case "RESOLVED":
      return "Решено";
    case "REJECTED":
      return "Отклонено";
    default:
      return "Ожидает";
  }
}

function NavItem(props: { to: string; icon?: ReactNode; children: ReactNode }) {
  const play = useSound((s) => s.play);
  return (
    <NavLink
      to={props.to}
      onMouseEnter={() => play("hover")}
      onClick={() => play("tab")}
      className={({ isActive }) => clsx("nav-link group relative inline-flex items-center gap-2", isActive && "active")}
    >
      {() => (
        <>
          {props.icon ? <span className="text-base opacity-90">{props.icon}</span> : null}
          <span className="relative z-10">{props.children}</span>
        </>
      )}
    </NavLink>
  );
}
