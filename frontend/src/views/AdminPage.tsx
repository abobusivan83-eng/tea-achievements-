import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiFetch, apiJson, apiUpload } from "../lib/api";
import type {
  Achievement,
  AdminAchievement,
  AdminAuditLogRow,
  AdminUserRow,
  CreatedAchievement,
  Rarity,
  Role,
  TaskItem,
  TaskSubmission,
} from "../lib/types";
import { Button } from "../ui/components/Button";
import { Modal } from "../ui/components/Modal";
import { AnimatePresence, motion } from "framer-motion";
import { FiAward, FiChevronDown, FiChevronUp, FiEdit2, FiPlus, FiSearch, FiTrash2, FiUser } from "react-icons/fi";
import { useToasts } from "../state/toasts";
import { useAuth } from "../state/auth";
import { ConfirmModal } from "../ui/components/ConfirmModal";
import { Reveal } from "../ui/components/Reveal";
import { Skeleton } from "../ui/components/Skeleton";
import { rarityGlowClass } from "../ui/rarityStyles";
import clsx from "clsx";
import { badgeCatalog, frames, statusEmojiCatalog } from "../lib/cosmetics";
import { AvatarFrame } from "../ui/components/AvatarFrame";
import { AchievementIcon } from "../ui/components/AchievementIcon";
import { AchievementCard } from "../ui/components/AchievementCard";
import { TaskQuestCard } from "../ui/components/TaskQuestCard";
import { calculateLevelColor } from "../lib/levelColor";

type SupportSuggestionRow = {
  id: string;
  title: string;
  description: string;
  images?: string[];
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "REJECTED";
  adminResponse: string | null;
  isRead: boolean;
  createdAt: string;
  author: { id: string; nickname: string; email: string };
};

type SupportReportRow = {
  id: string;
  reason: string;
  description: string;
  images?: string[];
  status: "PENDING" | "REVIEWED" | "RESOLVED" | "REJECTED";
  adminResponse: string | null;
  isRead: boolean;
  createdAt: string;
  reporter: { id: string; nickname: string; email: string };
  reported: { id: string; nickname: string; email: string };
};

type AdminShopItem = {
  id: string;
  name: string;
  type: "FRAME" | "BADGE";
  key: string;
  price: number;
  rarity: Rarity;
  description: string | null;
  icon: string | null;
};

type AdminInboxCounts = {
  tasks: number;
  suggestions: number;
  reports: number;
};

type AdminTask = {
  id: string;
  title: string;
  description: string;
  conditions: string;
  rewardCoins?: number;
  isActive: boolean;
  isEvent: boolean;
  startsAt: string | null;
  endsAt: string | null;
  styleTag: string | null;
  achievementId: string;
  achievement: { id: string; title: string; rarity: Rarity; points: number; iconUrl?: string | null } | null;
  submissionsCount?: number;
};

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function isVideoMedia(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return (
    clean.includes("/video/upload/") ||
    /\.(mp4|webm|mov|m4v|mkv|avi|ogg)$/i.test(clean)
  );
}

function buildRejectReasonText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function getSafeStatusEmoji(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (/^[\u25A1\u25A0\uFFFD?]+$/.test(normalized)) return null;
  return normalized;
}

function getUserInitials(nickname: string | null | undefined) {
  const source = (nickname ?? "").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || source.slice(0, 1).toUpperCase();
}

function toAdminAchievementCardModel(a: AdminAchievement): Achievement {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    rarity: a.rarity,
    points: a.points,
    iconUrl: a.iconUrl,
    frameKey: a.frameKey,
    isPublic: a.isPublic,
    createdAt: a.createdAt,
    earned: true,
    awardedAt: a.createdAt,
  };
}

type AdminTaskSubmission = TaskSubmission & {
  user: NonNullable<TaskSubmission["user"]>;
};

function toAdminTaskCardModel(submission: AdminTaskSubmission): TaskItem {
  return {
    ...submission.task,
    rewardCoins: submission.task.rewardCoins ?? 0,
    achievementId: submission.task.achievementId,
    achievement: submission.task.achievement
      ? {
          ...submission.task.achievement,
          description: submission.task.achievement.description ?? "",
          frameKey: submission.task.achievement.frameKey ?? null,
          isPublic: submission.task.achievement.isPublic ?? true,
          createdAt: submission.task.achievement.createdAt ?? submission.task.createdAt,
        }
      : null,
    mySubmission: {
      id: submission.id,
      status: submission.status,
      createdAt: submission.createdAt,
      reviewedAt: submission.reviewedAt,
      adminResponse: submission.adminResponse,
      reviewedByNickname: null,
    },
  };
}

export function AdminPage() {
  const me = useAuth((s) => s.me);
  const isAdminUser = me?.role === "ADMIN";
  const isCreatorUser = me?.role === "CREATOR";
  const isStaffUser = isAdminUser || isCreatorUser;
  const toast = useToasts((s) => s.push);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [achievements, setAchievements] = useState<AdminAchievement[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"achievements" | "users" | "xp" | "customization" | "reports" | "suggestions" | "shop" | "tasks" | "audit">("achievements");
  const [userQuery, setUserQuery] = useState("");
  const [xpAmount, setXpAmount] = useState<number>(100);
  const [lvlAmount, setLvlAmount] = useState<number>(1);
  const [coinAmount, setCoinAmount] = useState<number>(50);
  const [customFrame, setCustomFrame] = useState("");
  const [customEmoji, setCustomEmoji] = useState("🔥");
  const [customBadges, setCustomBadges] = useState<string[]>([]);
  const [supportSuggestions, setSupportSuggestions] = useState<SupportSuggestionRow[]>([]);
  const [supportReports, setSupportReports] = useState<SupportReportRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([]);
  const [adminInboxCounts, setAdminInboxCounts] = useState<AdminInboxCounts>({ tasks: 0, suggestions: 0, reports: 0 });
  const [suggestionResponses, setSuggestionResponses] = useState<Record<string, string>>({});
  const [reportResponses, setReportResponses] = useState<Record<string, string>>({});
  const [shopItems, setShopItems] = useState<AdminShopItem[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [taskSubmissions, setTaskSubmissions] = useState<AdminTaskSubmission[]>([]);
  const [selectedTaskSubmissionId, setSelectedTaskSubmissionId] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskConditions, setTaskConditions] = useState("");
  const [taskAchievementId, setTaskAchievementId] = useState("");
  const [taskRewardCoins, setTaskRewardCoins] = useState<number>(0);
  const [taskIsEvent, setTaskIsEvent] = useState(false);
  const [taskStartsAt, setTaskStartsAt] = useState("");
  const [taskEndsAt, setTaskEndsAt] = useState("");
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AdminTask | null>(null);
  const [taskResponses, setTaskResponses] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<AdminTaskSubmission | null>(null);
  const [rejectReasonDraft, setRejectReasonDraft] = useState("");

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFiles, setViewerFiles] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  function openViewer(files: string[], index: number) {
    setViewerFiles(files);
    setViewerIndex(index);
    setZoom(1);
    setViewerOpen(true);
  }

  const [shopName, setShopName] = useState("");
  const [shopType, setShopType] = useState<"FRAME" | "BADGE">("FRAME");
  const [shopKey, setShopKey] = useState("");
  const [shopPrice, setShopPrice] = useState(50);
  const [shopRarity, setShopRarity] = useState<Rarity>("COMMON");
  const [shopDesc, setShopDesc] = useState("");
  const [shopIcon, setShopIcon] = useState("");
  const [editShopOpen, setEditShopOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<AdminShopItem | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rarity, setRarity] = useState<Rarity>("COMMON");
  const [isPublic, setIsPublic] = useState(true);
  const [awardOnCreateUserIds, setAwardOnCreateUserIds] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedAchievement | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [awardUserId, setAwardUserId] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAchievement | null>(null);
  const [editIconFile, setEditIconFile] = useState<File | null>(null);

  const [awardOpen, setAwardOpen] = useState(false);
  const [awardAchId, setAwardAchId] = useState<string>("");
  const [awardUserId2, setAwardUserId2] = useState<string>("");
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeUserId, setRevokeUserId] = useState<string>("");
  const [revokeAchievementIds, setRevokeAchievementIds] = useState<string[]>([]);
  const [userOwnedAchievements, setUserOwnedAchievements] = useState<Achievement[]>([]);
  const [loadingUserOwnedAchievements, setLoadingUserOwnedAchievements] = useState(false);

  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");
  const [levelDraft, setLevelDraft] = useState<number>(1);
  const [xpDraft, setXpDraft] = useState<number>(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addTaskExpanded, setAddTaskExpanded] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<AdminAchievement | null>(null);
  const [userDeleteOpen, setUserDeleteOpen] = useState(false);
  const [userDeleteTarget, setUserDeleteTarget] = useState<AdminUserRow | null>(null);
  const selectClass =
    "rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-steam-text outline-none focus:border-steam-accent glow--base";
  const inputClass =
    "rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-steam-text outline-none focus:border-steam-accent glow--base";

  async function refreshUsers() {
    setLoadingUsers(true);
    try {
      const data = await apiFetch<AdminUserRow[]>("/api/admin/users");
      setUsers(data);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function refreshAchievements() {
    const data = await apiFetch<AdminAchievement[]>("/api/admin/achievements");
    setAchievements(data);
  }

  async function refreshSupport() {
    const [suggestions, reports] = await Promise.all([
      apiFetch<SupportSuggestionRow[]>("/api/admin/support/suggestions"),
      apiFetch<SupportReportRow[]>("/api/admin/support/reports"),
    ]);
    setSupportSuggestions(suggestions);
    setSupportReports(reports);
    setAdminInboxCounts((prev) => ({
      ...prev,
      suggestions: suggestions.filter((item) => item.status === "PENDING").length,
      reports: reports.filter((item) => item.status === "PENDING").length,
    }));
  }

  async function refreshAuditLogs() {
    const rows = await apiFetch<AdminAuditLogRow[]>("/api/admin/audit-logs");
    setAuditLogs(rows);
  }

  async function refreshShop() {
    const items = await apiFetch<AdminShopItem[]>("/api/admin/shop/items");
    setShopItems(items);
  }

  async function refreshTasks() {
    const [taskRows, submissionRows] = await Promise.all([
      apiFetch<AdminTask[]>("/api/admin/tasks"),
      apiFetch<AdminTaskSubmission[]>("/api/admin/tasks/submissions"),
    ]);
    setTasks(taskRows);
    setTaskSubmissions(submissionRows);
    setAdminInboxCounts((prev) => ({
      ...prev,
      tasks: submissionRows.filter((item) => item.status === "PENDING").length,
    }));
  }

  async function refreshAdminInboxCounts() {
    const counts = await apiFetch<AdminInboxCounts>("/api/admin/inbox-counts", { silent: true });
    setAdminInboxCounts(counts);
  }

  function mapCosmeticRarityToShop(r: string): Rarity {
    if (r === "rare") return "RARE";
    if (r === "epic") return "EPIC";
    if (r === "legendary") return "LEGENDARY";
    if (r === "secret") return "LEGENDARY";
    return "COMMON";
  }

  async function bootstrapShopFromCatalog() {
    const existingKeys = new Set(shopItems.map((i) => `${i.type}:${i.key}`));
    const frameItems = frames
      .filter((f) => !f.adminOnly && !f.creatorOnly && !f.key.startsWith("admin-"))
      .map((f) => ({
        name: `Рамка: ${f.label}`,
        type: "FRAME" as const,
        key: f.key,
        price:
          f.rarity === "legendary" || f.rarity === "secret"
            ? 3500
            : f.rarity === "epic"
              ? 2200
              : f.rarity === "rare"
                ? 1300
                : 600,
        rarity: mapCosmeticRarityToShop(f.rarity),
        description: `${f.label}. ${f.animated ? "Анимированная" : "Статичная"} рамка профиля.`,
        icon: "🖼️",
      }));

    const badgeItems = badgeCatalog
      .filter((b) => !b.adminOnly)
      .map((b) => ({
        name: `Значок: ${b.label}`,
        type: "BADGE" as const,
        key: b.key,
        price:
          b.rarity === "legendary" || b.rarity === "secret"
            ? 2800
            : b.rarity === "epic"
              ? 1800
              : b.rarity === "rare"
                ? 1100
                : 500,
        rarity: mapCosmeticRarityToShop(b.rarity),
        description: b.description,
        icon: b.icon,
      }));

    const statusItems = statusEmojiCatalog
      .filter((s) => !s.adminOnly)
      .map((s) => ({
        name: `Статус: ${s.label}`,
        type: "BADGE" as const,
        key: `status:${s.key}`,
        price:
          s.rarity === "legendary" || s.rarity === "secret"
            ? 2400
            : s.rarity === "epic"
              ? 1600
              : s.rarity === "rare"
                ? 900
                : 400,
        rarity: mapCosmeticRarityToShop(s.rarity),
        description: s.description,
        icon: s.emoji,
      }));

    const prepared = [...frameItems, ...badgeItems, ...statusItems].filter(
      (x) => !existingKeys.has(`${x.type}:${x.key}`),
    );

    let createdCount = 0;
    for (const item of prepared) {
      await apiJson("/api/admin/shop/items", item);
      createdCount++;
    }
    await refreshShop();
    toast({ kind: "success", title: createdCount ? `Добавлено товаров: ${createdCount}` : "Каталог уже синхронизирован" });
  }

  useEffect(() => {
    const tasks: Promise<unknown>[] = [refreshAchievements()];
    if (isStaffUser) {
      tasks.push(refreshUsers(), refreshSupport(), refreshShop(), refreshTasks(), refreshAuditLogs(), refreshAdminInboxCounts());
    }
    Promise.all(tasks).catch((e: any) => setError(e?.message ?? "Ошибка загрузки"));
  }, [isStaffUser]);

  useEffect(() => {
    if (!isStaffUser && tab !== "achievements") setTab("achievements");
  }, [isStaffUser, tab]);

  useEffect(() => {
    if (!isStaffUser) return;
    let cancelled = false;

    const refreshCurrentSection = async () => {
      try {
        if (tab === "tasks") {
          await Promise.all([refreshTasks(), refreshAdminInboxCounts()]);
        } else if (tab === "reports" || tab === "suggestions") {
          await Promise.all([refreshSupport(), refreshAdminInboxCounts()]);
        } else {
          await refreshAdminInboxCounts();
        }
      } catch (e: any) {
        if (!cancelled) setError((prev) => prev ?? e?.message ?? "Ошибка обновления данных");
      }
    };

    void refreshCurrentSection();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refreshCurrentSection();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isStaffUser, tab]);

  const unreadTaskSubmissions = useMemo(() => taskSubmissions.filter((submission) => !submission.isRead), [taskSubmissions]);
  const readTaskSubmissions = useMemo(() => taskSubmissions.filter((submission) => submission.isRead), [taskSubmissions]);
  const selectedTaskSubmission = useMemo(
    () =>
      taskSubmissions.find((submission) => submission.id === selectedTaskSubmissionId) ??
      unreadTaskSubmissions[0] ??
      readTaskSubmissions[0] ??
      null,
    [readTaskSubmissions, selectedTaskSubmissionId, taskSubmissions, unreadTaskSubmissions],
  );

  useEffect(() => {
    if (!selectedTaskSubmission && selectedTaskSubmissionId) {
      setSelectedTaskSubmissionId("");
      return;
    }
    if (!selectedTaskSubmissionId && selectedTaskSubmission) {
      setSelectedTaskSubmissionId(selectedTaskSubmission.id);
    }
  }, [selectedTaskSubmission, selectedTaskSubmissionId]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.nickname.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.adminTags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [users, userQuery]);

  const selectedAwardAchievement = useMemo(
    () => achievements.find((a) => a.id === awardAchId) ?? null,
    [achievements, awardAchId],
  );

  async function loadUserOwnedAchievements(userId: string) {
    if (!userId) {
      setUserOwnedAchievements([]);
      return;
    }
    setLoadingUserOwnedAchievements(true);
    try {
      const data = await apiFetch<Achievement[]>(`/api/admin/users/${userId}/achievements`);
      setUserOwnedAchievements(data);
    } finally {
      setLoadingUserOwnedAchievements(false);
    }
  }

  function supportStatusLabel(status: "PENDING" | "REVIEWED" | "RESOLVED" | "REJECTED") {
    if (status === "REVIEWED") return "Рассмотрено";
    if (status === "RESOLVED") return "Решено";
    if (status === "REJECTED") return "Отклонено";
    return "Ожидает";
  }

  function renderAdminCountBadge(count: number) {
    if (count <= 0) return null;
    return (
      <span className="ml-2 inline-flex min-w-6 items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
        {count > 99 ? "99+" : count}
      </span>
    );
  }

  function shopRarityLabel(r: Rarity) {
    if (r === "RARE") return "Редкая";
    if (r === "EPIC") return "Эпическая";
    if (r === "LEGENDARY") return "Легендарная";
    return "Обычная";
  }

  function shopRarityTone(r: Rarity) {
    if (r === "RARE") return "border-blue-300/30 bg-blue-400/10 text-blue-100";
    if (r === "EPIC") return "border-purple-300/30 bg-purple-400/10 text-purple-100";
    if (r === "LEGENDARY") return "border-amber-300/30 bg-amber-400/10 text-amber-100";
    return "border-white/10 bg-white/5 text-steam-muted";
  }

  function openTaskEditor(task: AdminTask) {
    setEditingTask(task);
    setEditTaskOpen(true);
  }

  function openRejectTaskSubmission(submission: AdminTaskSubmission) {
    setSelectedTaskSubmissionId(submission.id);
    setRejectTarget(submission);
    setRejectReasonDraft(taskResponses[submission.id] ?? submission.adminResponse ?? "");
    setRejectOpen(true);
  }

  async function grantTaskSubmission(submission: AdminTaskSubmission) {
    await apiJson(
      `/api/admin/tasks/submissions/${submission.id}`,
      {
        status: "RESOLVED",
        isRead: true,
        adminResponse: taskResponses[submission.id] ?? submission.adminResponse ?? "",
      },
      "PATCH",
    );
    await refreshTasks();
    toast({ kind: "success", title: "Награда выдана" });
  }

  async function deleteTaskSubmission(submission: AdminTaskSubmission) {
    await apiDelete(`/api/admin/tasks/submissions/${submission.id}`);
    setTaskResponses((prev) => {
      const next = { ...prev };
      delete next[submission.id];
      return next;
    });
    if (selectedTaskSubmissionId === submission.id) setSelectedTaskSubmissionId("");
    await refreshTasks();
    toast({ kind: "success", title: "Р—Р°СЏРІРєР° СѓРґР°Р»РµРЅР°" });
  }

  async function updateReportStatus(report: SupportReportRow, status: SupportReportRow["status"], adminResponse?: string | null) {
    await apiJson(
      `/api/admin/support/reports/${report.id}`,
      { status, isRead: true, ...(adminResponse !== undefined ? { adminResponse } : {}) },
      "PATCH",
    );
    if (adminResponse !== undefined) {
      setReportResponses((prev) => ({ ...prev, [report.id]: adminResponse ?? "" }));
    }
    await refreshSupport();
  }

  async function updateSuggestionStatus(
    suggestion: SupportSuggestionRow,
    status: SupportSuggestionRow["status"],
    adminResponse?: string | null,
  ) {
    await apiJson(
      `/api/admin/support/suggestions/${suggestion.id}`,
      { status, isRead: true, ...(adminResponse !== undefined ? { adminResponse } : {}) },
      "PATCH",
    );
    if (adminResponse !== undefined) {
      setSuggestionResponses((prev) => ({ ...prev, [suggestion.id]: adminResponse ?? "" }));
    }
    await refreshSupport();
  }

  return (
    <div className="grid gap-6">
      <Reveal className="steam-card steam-card--hover p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto">
            <div className="text-lg font-semibold">Админ-панель</div>
            <div className="text-sm text-steam-muted">
              {isCreatorUser && !isAdminUser
                ? "Создание эксклюзивных достижений (редкость выше легендарной) и управление иконками."
                : "Достижения, выдача/отзыв, пользователи, заметки и метки."}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={tab === "achievements" ? "primary" : "ghost"}
              size="sm"
              leftIcon={<FiAward />}
              onClick={() => setTab("achievements")}
            >
              Достижения
            </Button>
            {isStaffUser ? (
              <>
                <Button
                  variant={tab === "users" ? "primary" : "ghost"}
                  size="sm"
                  leftIcon={<FiUser />}
                  onClick={() => setTab("users")}
                >
                  Пользователи
                </Button>
                <Button variant={tab === "xp" ? "primary" : "ghost"} size="sm" onClick={() => setTab("xp")}>
                  Опыт
                </Button>
                <Button variant={tab === "customization" ? "primary" : "ghost"} size="sm" onClick={() => setTab("customization")}>
                  Кастомизация профиля
                </Button>
                <Button variant={tab === "reports" ? "primary" : "ghost"} size="sm" onClick={() => setTab("reports")}>
                  <span className="inline-flex items-center">
                    Жалобы
                    {renderAdminCountBadge(adminInboxCounts.reports)}
                  </span>
                </Button>
                <Button variant={tab === "suggestions" ? "primary" : "ghost"} size="sm" onClick={() => setTab("suggestions")}>
                  <span className="inline-flex items-center">
                    Предложения
                    {renderAdminCountBadge(adminInboxCounts.suggestions)}
                  </span>
                </Button>
                <Button variant={tab === "shop" ? "primary" : "ghost"} size="sm" onClick={() => setTab("shop")}>
                  Магазин
                </Button>
                <Button variant={tab === "tasks" ? "primary" : "ghost"} size="sm" onClick={() => setTab("tasks")}>
                  <span className="inline-flex items-center">
                    Задания
                    {renderAdminCountBadge(adminInboxCounts.tasks)}
                  </span>
                </Button>
                <Button variant={tab === "audit" ? "primary" : "ghost"} size="sm" onClick={() => setTab("audit")}>
                  Действия администрации
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </Reveal>

      {error ? <div className="steam-card p-4">{error}</div> : null}

      {tab === "achievements" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="steam-card steam-card--hover p-4">
            <div className="text-sm font-semibold">Создать достижение</div>
            <div className="mt-1 text-xs text-steam-muted">
              Быстрое создание достижения. Непубличные достижения остаются только в профиле получателя и не попадают в общий раздел достижений.
            </div>
            <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Название</span>
              <input
                className="rounded-lg border border-white/10 bg-black/35 px-3 py-2 outline-none focus:border-steam-accent glow--base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Описание</span>
              <textarea
                className="min-h-20 rounded-lg border border-white/10 bg-black/35 px-3 py-2 outline-none focus:border-steam-accent glow--base"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className={selectClass}
                value={rarity}
                onChange={(e) => setRarity(e.target.value as Rarity)}
              >
                <option value="COMMON">Обычная</option>
                <option value="RARE">Редкая</option>
                <option value="EPIC">Эпическая</option>
                <option value="LEGENDARY">Легендарная</option>
                {isCreatorUser ? (
                  <option value="EXCLUSIVE">Эксклюзив (создатель) — выше легендарного</option>
                ) : null}
              </select>

              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm glow--base">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                <span>Публичное</span>
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Выдать сразу после создания</span>
              <div className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/25 p-2">
                <div className="grid gap-1">
                  {users.map((u) => {
                    const active = awardOnCreateUserIds.includes(u.id);
                    return (
                      <button
                        key={`award-on-create-${u.id}`}
                        type="button"
                        className={clsx(
                          "flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs",
                          active ? "border-emerald-400/40 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:bg-white/10",
                        )}
                        onClick={() =>
                          setAwardOnCreateUserIds((prev) => (prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]))
                        }
                      >
                        <span className="truncate">#{u.publicId ?? "—"} {u.nickname}</span>
                        <span className="font-mono text-[10px] text-steam-muted">{active ? "будет выдано" : "выбрать"}</span>
                      </button>
                    );
                  })}
                </div>
                </div>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Иконка (png/jpg/webp/gif)</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setIconFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className={clsx("steam-card rounded-xl p-3", rarityGlowClass(rarity, true))}>
              <div className="text-xs text-steam-muted">Предпросмотр редкости</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs">{rarity}</span>
                <span className="text-sm font-semibold">{title.trim() || "Новое достижение"}</span>
              </div>
            </div>

            <button
              className="hidden"
            />
              <Button
              leftIcon={<FiAward />}
              onClick={async () => {
                setError(null);
                try {
                  const created = await apiJson<CreatedAchievement>("/api/admin/achievements", {
                    title,
                    description,
                    rarity,
                    isPublic,
                    awardUserIds: awardOnCreateUserIds,
                  });
                  setCreated(created);
                  if (iconFile) await apiUpload(`/api/admin/achievements/${created.id}/icon`, iconFile);
                  await refreshAchievements();
                  setAwardOnCreateUserIds([]);
                  toast({
                    kind: "success",
                    title: "Достижение создано",
                    message: created.awardedUserIds?.length
                      ? `Сразу выдано пользователям: ${created.awardedUserIds.length}`
                      : undefined,
                  });
                } catch (e: any) {
                  setError(e?.message ?? "Ошибка создания");
                  toast({ kind: "error", title: "Не удалось создать достижение", message: e?.message ?? "Ошибка" });
                }
              }}
            >
              Создать
            </Button>

            {created ? (
              <div className="steam-card p-3 text-sm glow--base">
                <div className="font-semibold">Создано</div>
                <div className="mt-1 text-xs text-steam-muted">
                  ID: <span className="font-mono">{created.id}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className={selectClass}
                    value={awardUserId}
                    onChange={(e) => setAwardUserId(e.target.value)}
                  >
                    <option value="">Выбери пользователя</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        #{u.publicId ?? "—"} {u.nickname}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await apiJson(`/api/admin/achievements/${created.id}/award`, { userId: awardUserId });
                      } catch (e: any) {
                        setError(e?.message ?? "Ошибка выдачи");
                      }
                    }}
                  >
                    Выдать
                  </Button>
                </div>
              </div>
            ) : null}
            </div>
          </section>

          <section className="steam-card steam-card--hover p-4">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Все достижения</div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<FiAward />}
                  onClick={() => {
                    setAwardAchId(achievements[0]?.id ?? "");
                    setAwardUserId2(users[0]?.id ?? "");
                    setAwardOpen(true);
                  }}
                >
                  Выдать существующее
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<FiTrash2 />}
                  onClick={() => {
                    const firstUserId = users[0]?.id ?? "";
                    setRevokeUserId(firstUserId);
                    setRevokeAchievementIds([]);
                    setRevokeOpen(true);
                    loadUserOwnedAchievements(firstUserId).catch((e: any) =>
                      setError(e?.message ?? "Ошибка загрузки достижений пользователя"),
                    );
                  }}
                >
                  Забрать достижение
                </Button>
                <Button variant="ghost" size="sm" onClick={() => refreshAchievements().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>
                  Обновить
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {achievements.slice(0, 80).map((a) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  className={clsx("steam-card steam-card--hover p-3", rarityGlowClass(a.rarity, true))}
                >
                  <div className="flex items-start gap-3">
                    <AchievementIcon iconUrl={a.iconUrl} alt={a.title} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold tracking-tight">{a.title}</div>
                      <div className="truncate text-xs text-steam-muted">{a.description}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">{a.rarity}</span>
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">{a.points} pts</span>
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1">{a.isPublic ? "public" : "private"}</span>
                      </div>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<FiEdit2 />}
                        onClick={() => {
                          setEditing(a);
                          setEditIconFile(null);
                          setEditOpen(true);
                        }}
                      >
                        Изменить
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        leftIcon={<FiTrash2 />}
                        onClick={async () => {
                          setConfirmTarget(a);
                          setConfirmOpen(true);
                        }}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      ) : tab === "users" ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">Пользователи</div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steam-muted" />
                <input
                  className="w-72 rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-steam-text outline-none focus:border-steam-accent"
                  placeholder="Поиск пользователей…"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => refreshUsers().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>
                Обновить
              </Button>
            </div>
          </div>

          {loadingUsers ? (
            <div className="mt-3 grid gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-48 rounded-md" />
                    <Skeleton className="h-3 w-64 rounded-md" />
                    <Skeleton className="h-3 w-52 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 grid gap-2">
            {filteredUsers.map((u) => (
              <motion.div key={u.id} whileHover={{ y: -1 }} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => {
                      setSelectedUser(u);
                      setNotesDraft(u.adminNotes ?? "");
                      setTagsDraft((u.adminTags ?? []).join(", "));
                      setLevelDraft((u as any).level ?? 1);
                      setXpDraft((u as any).xp ?? 0);
                      setUserDetailsOpen(true);
                    }}
                  >
                    <div className="truncate text-sm font-semibold">
                      {u.nickname}{" "}
                      <span className="text-xs font-normal text-steam-muted">
                        ({u.role}){u.blocked ? " — заблокирован" : ""}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[11px] text-steam-muted">#{u.publicId ?? "—"} • {u.id}</div>
                    <div className="text-xs text-steam-muted">{u.email}</div>
                  </button>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none focus:border-steam-accent"
                      value={u.role}
                      onClick={(e) => e.stopPropagation()}
                      onChange={async (e) => {
                        const role = e.target.value as Role;
                        if (role === "CREATOR") {
                          toast({
                            kind: "info",
                            title: "Роль создателя закрыта",
                            message: "Эта роль назначается только вручную владельцу проекта.",
                          });
                          return;
                        }
                        await apiJson(`/api/admin/users/${u.id}`, { role }, "PATCH");
                        await refreshUsers();
                      }}
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                      {u.role === "CREATOR" ? <option value="CREATOR">CREATOR</option> : null}
                    </select>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={u.id === me?.id || u.role === "CREATOR"}
                      title={u.id === me?.id ? "Нельзя удалить свой аккаунт" : u.role === "CREATOR" ? "Нельзя удалить создателя" : undefined}
                      onClick={() => {
                        setUserDeleteTarget(u);
                        setUserDeleteOpen(true);
                      }}
                    >
                      Удалить аккаунт
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "xp" ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 text-sm font-semibold">Опыт</div>
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">XP за действие</span>
              <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2" value={xpAmount} onChange={(e) => setXpAmount(Number(e.target.value) || 0)} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Уровни за действие</span>
              <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2" value={lvlAmount} onChange={(e) => setLvlAmount(Number(e.target.value) || 0)} />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="text-steam-muted">Монеты за действие</span>
              <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2" value={coinAmount} onChange={(e) => setCoinAmount(Number(e.target.value) || 0)} />
            </label>
          </div>
          <div className="grid gap-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.nickname}</div>
                  <div className="text-xs text-steam-muted">
                    Lvl <span style={{ color: calculateLevelColor(u.level ?? 1) }}>{u.level ?? 1}</span> • XP {u.xp ?? 0}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={async () => { await apiJson(`/api/admin/users/${u.id}`, { xp: Math.max(0, (u.xp ?? 0) + xpAmount) }, "PATCH"); await refreshUsers(); }}>+Опыт</Button>
                <Button size="sm" variant="danger" onClick={async () => { await apiJson(`/api/admin/users/${u.id}`, { xp: Math.max(0, (u.xp ?? 0) - xpAmount) }, "PATCH"); await refreshUsers(); }}>-Опыт</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await apiJson(`/api/admin/users/${u.id}`, { level: Math.min(100, (u.level ?? 1) + lvlAmount) }, "PATCH"); await refreshUsers(); }}>+Уровень</Button>
                <Button size="sm" variant="danger" onClick={async () => { await apiJson(`/api/admin/users/${u.id}`, { level: Math.max(1, (u.level ?? 1) - lvlAmount) }, "PATCH"); await refreshUsers(); }}>-Уровень</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await apiJson(`/api/admin/users/${u.id}/coins`, { delta: Math.abs(coinAmount) }); toast({ kind: "success", title: "Монеты выданы" }); }}>+Монеты</Button>
                <Button size="sm" variant="danger" onClick={async () => { await apiJson(`/api/admin/users/${u.id}/coins`, { delta: -Math.abs(coinAmount) }); toast({ kind: "info", title: "Монеты списаны" }); }}>-Монеты</Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "customization" ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 text-sm font-semibold">Кастомизация профиля</div>
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <select className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={customFrame} onChange={(e) => setCustomFrame(e.target.value)}>
              <option value="">Без рамки</option>
              {frames.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <select className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)}>
              {["😀","😎","🥷","🔥","✨","💎","🏆","⚡","🌙","🌟","🎯","🧠","🛡️","💀","🦊","🐍"].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/30 p-2">
              {badgeCatalog.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={clsx("badge text-xs", customBadges.includes(b.key) ? "border-steam-accent/40 bg-steam-accent/10" : "hover:bg-white/10")}
                  onClick={() => setCustomBadges((prev) => (prev.includes(b.key) ? prev.filter((x) => x !== b.key) : [...prev, b.key]))}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-3 steam-card p-3">
            <div className="text-xs text-steam-muted">Превью выбранной рамки/эмодзи</div>
            <div className="mt-2 flex items-center gap-3">
              <AvatarFrame frameKey={customFrame || null} size={42} src="https://placehold.co/84x84/png?text=A" />
              <div className="text-lg">{customEmoji}</div>
            </div>
          </div>
          <div className="grid gap-2">
            {filteredUsers.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.nickname}</div>
                  <div className="text-xs text-steam-muted">Frame: {u.frameKey ?? "—"} • Emoji: {u.statusEmoji ?? "—"}</div>
                </div>
                <Button size="sm" onClick={async () => {
                  await apiJson(`/api/admin/users/${u.id}`, {
                    frameKey: customFrame.trim() ? customFrame.trim() : null,
                    statusEmoji: customEmoji.trim() ? customEmoji.trim() : null,
                    badges: customBadges,
                  }, "PATCH");
                  await refreshUsers();
                  toast({ kind: "success", title: "Кастомизация применена" });
                }}>
                  Применить
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "reports" ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-semibold">Жалобы</div>
            <Button size="sm" variant="ghost" onClick={() => refreshSupport().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>
              Обновить
            </Button>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Входящие</div>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-steam-muted">
                  {supportReports.filter((r) => !r.isRead).length}
                </span>
              </div>
              {supportReports.filter((r) => !r.isRead).map((r) => (
                <div key={`incoming-${r.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{r.reason.toUpperCase()} • {r.reporter.nickname} → {r.reported.nickname}</div>
                    <span className="text-xs text-steam-muted">{supportStatusLabel(r.status)}</span>
                  </div>
                  <div className="mt-1 text-sm text-steam-muted">{r.description}</div>
                  {r.images?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.images.map((img, i) => (
                        <button key={img} type="button" onClick={() => openViewer(r.images ?? [], i)}>
                          <img src={img} className="h-16 w-24 rounded-md border border-white/10 object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    className="mt-3 min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-steam-accent"
                    placeholder="Ответ пользователю"
                    value={reportResponses[r.id] ?? r.adminResponse ?? ""}
                    onChange={(e) => setReportResponses((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["PENDING", "REVIEWED", "RESOLVED", "REJECTED"] as const).map((st) => (
                      <Button key={st} size="sm" variant={r.status === st ? "primary" : "ghost"} onClick={async () => {
                        await updateReportStatus(r, st);
                        // Помечаем как прочитанное при смене статуса
                        if (!r.isRead) {
                          await apiJson(`/api/admin/support/reports/${r.id}`, { isRead: true }, "PATCH");
                          await refreshSupport();
                        }
                      }}>
                        {supportStatusLabel(st)}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        await updateReportStatus(r, r.status === "PENDING" ? "REVIEWED" : r.status, reportResponses[r.id] ?? r.adminResponse ?? "");
                        // Помечаем как прочитанное при отправке ответа
                        if (!r.isRead) {
                          await apiJson(`/api/admin/support/reports/${r.id}`, { isRead: true }, "PATCH");
                          await refreshSupport();
                        }
                      }}
                    >
                      Отправить ответ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Прочитано</div>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-steam-muted">
                  {supportReports.filter((r) => r.isRead).length}
                </span>
              </div>
              {supportReports.filter((r) => r.isRead).map((r) => (
                <div key={`read-${r.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{r.reason.toUpperCase()} • {r.reporter.nickname}</div>
                    <span className="text-xs text-steam-muted">{supportStatusLabel(r.status)}</span>
                  </div>
                  <div className="mt-1 text-sm text-steam-muted">{r.description}</div>
                  {r.adminResponse ? (
                    <div className="mt-3 whitespace-pre-line rounded-lg border border-steam-accent/20 bg-steam-accent/10 p-3 text-sm">
                      {r.adminResponse}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {false ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-semibold">Жалобы</div>
            <Button size="sm" variant="ghost" onClick={() => refreshSupport().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>Обновить</Button>
          </div>
          <div className="grid gap-2">
            {supportReports.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-sm font-semibold">{r.reason.toUpperCase()} • {r.reporter.nickname} → {r.reported.nickname}</div>
                <div className="mt-1 text-sm text-steam-muted">{r.description}</div>
                {r.images?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.images.map((img, i) => (
                      <button key={img} type="button" onClick={() => openViewer(r.images ?? [], i)}>
                        <img src={img} className="h-16 w-24 rounded-md border border-white/10 object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["PENDING", "REVIEWED", "RESOLVED", "REJECTED"] as const).map((st) => (
                    <Button key={st} size="sm" variant={r.status === st ? "primary" : "ghost"} onClick={async () => { await apiJson(`/api/admin/support/reports/${r.id}`, { status: st, isRead: true }, "PATCH"); await refreshSupport(); }}>
                      {st === "PENDING" ? "Ожидает" : st === "REVIEWED" ? "Рассмотрено" : st === "RESOLVED" ? "Решено" : "Отклонено"}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "suggestions" ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-semibold">Предложения</div>
            <Button size="sm" variant="ghost" onClick={() => refreshSupport().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>
              Обновить
            </Button>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Входящие</div>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-steam-muted">
                  {supportSuggestions.filter((s) => !s.isRead).length}
                </span>
              </div>
              {supportSuggestions.filter((s) => !s.isRead).map((s) => (
                <div key={`incoming-${s.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{s.title} • {s.author.nickname}</div>
                    <span className="text-xs text-steam-muted">{supportStatusLabel(s.status)}</span>
                  </div>
                  <div className="mt-1 text-sm text-steam-muted">{s.description}</div>
                  {s.images?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.images.map((img, i) => (
                        <button key={img} type="button" onClick={() => openViewer(s.images ?? [], i)}>
                          <img src={img} className="h-16 w-24 rounded-md border border-white/10 object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <textarea
                    className="mt-3 min-h-24 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-steam-accent"
                    placeholder="Ответ пользователю"
                    value={suggestionResponses[s.id] ?? s.adminResponse ?? ""}
                    onChange={(e) => setSuggestionResponses((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["PENDING", "REVIEWED", "RESOLVED", "REJECTED"] as const).map((st) => (
                      <Button key={st} size="sm" variant={s.status === st ? "primary" : "ghost"} onClick={async () => {
                        await updateSuggestionStatus(s, st);
                        // Помечаем как прочитанное при смене статуса
                        if (!s.isRead) {
                          await apiJson(`/api/admin/support/suggestions/${s.id}`, { isRead: true }, "PATCH");
                          await refreshSupport();
                        }
                      }}>
                        {supportStatusLabel(st)}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={async () => {
                        await updateSuggestionStatus(s, s.status === "PENDING" ? "REVIEWED" : s.status, suggestionResponses[s.id] ?? s.adminResponse ?? "");
                        // Помечаем как прочитанное при отправке ответа
                        if (!s.isRead) {
                          await apiJson(`/api/admin/support/suggestions/${s.id}`, { isRead: true }, "PATCH");
                          await refreshSupport();
                        }
                      }}
                    >
                      Отправить ответ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Прочитано</div>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-steam-muted">
                  {supportSuggestions.filter((s) => s.isRead).length}
                </span>
              </div>
              {supportSuggestions.filter((s) => s.isRead).map((s) => (
                <div key={`read-${s.id}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{s.title} • {s.author.nickname}</div>
                    <span className="text-xs text-steam-muted">{supportStatusLabel(s.status)}</span>
                  </div>
                  <div className="mt-1 text-sm text-steam-muted">{s.description}</div>
                  {s.adminResponse ? (
                    <div className="mt-3 whitespace-pre-line rounded-lg border border-steam-accent/20 bg-steam-accent/10 p-3 text-sm">
                      {s.adminResponse}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {false ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-semibold">Предложения</div>
            <Button size="sm" variant="ghost" onClick={() => refreshSupport().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>Обновить</Button>
          </div>
          <div className="grid gap-2">
            {supportSuggestions.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-sm font-semibold">{s.title} • {s.author.nickname}</div>
                <div className="mt-1 text-sm text-steam-muted">{s.description}</div>
                {s.images?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {s.images.map((img, i) => (
                      <button key={img} type="button" onClick={() => openViewer(s.images ?? [], i)}>
                        <img src={img} className="h-16 w-24 rounded-md border border-white/10 object-cover" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["PENDING", "REVIEWED", "RESOLVED", "REJECTED"] as const).map((st) => (
                    <Button key={st} size="sm" variant={s.status === st ? "primary" : "ghost"} onClick={async () => { await apiJson(`/api/admin/support/suggestions/${s.id}`, { status: st, isRead: true }, "PATCH"); await refreshSupport(); }}>
                      {st === "PENDING" ? "Ожидает" : st === "REVIEWED" ? "Рассмотрено" : st === "RESOLVED" ? "Решено" : "Отклонено"}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "shop" ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-semibold">Управление магазином</div>
            <Button size="sm" variant="ghost" onClick={() => refreshShop().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>Обновить</Button>
            <Button size="sm" onClick={() => bootstrapShopFromCatalog().catch((e: any) => setError(e?.message ?? "Ошибка синхронизации каталога"))}>
              Заполнить из каталога
            </Button>
          </div>
          <div className="mb-4 grid gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-steam-muted">Тип товара</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={shopType === "FRAME" ? "primary" : "ghost"}
                  onClick={() => {
                    setShopType("FRAME");
                    setShopIcon("");
                  }}
                >
                  Рамка
                </Button>
                <Button size="sm" variant={shopType === "BADGE" ? "primary" : "ghost"} onClick={() => setShopType("BADGE")}>
                  Значок / статус
                </Button>
              </div>
            </div>

            {shopType === "FRAME" ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-steam-muted">Выбор рамки</div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {frames.map((f) => {
                    const active = shopKey === f.key;
                    return (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => {
                          setShopType("FRAME");
                          setShopKey(f.key);
                          if (!shopName.trim()) setShopName(f.label);
                          setShopRarity(mapCosmeticRarityToShop(f.rarity));
                        }}
                        className={clsx(
                          "flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                          active ? "border-steam-accent/40 bg-steam-accent/10" : "border-white/10 bg-black/20 hover:bg-white/5",
                        )}
                      >
                        <AvatarFrame frameKey={f.key} size={36} src="https://placehold.co/72x72/png?text=A" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{f.label}</div>
                          <div className="truncate text-xs text-steam-muted">{f.key}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 md:grid-cols-3">
              <input className={inputClass} placeholder="Название" value={shopName} onChange={(e) => setShopName(e.target.value)} />
              <input className={inputClass} placeholder="Ключ товара" value={shopKey} onChange={(e) => setShopKey(e.target.value)} />
              <input
                className={inputClass}
                placeholder="Цена (монеты)"
                value={shopPrice}
                onChange={(e) => setShopPrice(Number(e.target.value) || 0)}
              />
              <select className={selectClass} value={shopRarity} onChange={(e) => setShopRarity(e.target.value as Rarity)}>
                <option value="COMMON">Обычная</option>
                <option value="RARE">Редкая</option>
                <option value="EPIC">Эпическая</option>
                <option value="LEGENDARY">Легендарная</option>
              </select>
              {shopType === "BADGE" ? (
                <input className={inputClass} placeholder="Иконка (эмодзи или URL)" value={shopIcon} onChange={(e) => setShopIcon(e.target.value)} />
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-steam-muted">
                  Для рамок иконка не требуется
                </div>
              )}
              <input className={inputClass} placeholder="Описание" value={shopDesc} onChange={(e) => setShopDesc(e.target.value)} />
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-steam-muted">Предпросмотр</div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="shrink-0">
                  {shopType === "FRAME" ? (
                    <AvatarFrame frameKey={shopKey || null} size={52} src="https://placehold.co/96x96/png?text=A" />
                  ) : (
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-lg">
                      {shopIcon || "🎁"}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{shopName || "Название товара"}</div>
                  <div className="truncate text-xs text-steam-muted">{shopType} • {shopKey || "key"}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={clsx("rounded-full border px-2 py-0.5 text-xs", shopRarityTone(shopRarity))}>
                      {shopRarityLabel(shopRarity)}
                    </span>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
                      {shopPrice || 0} 🪙
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <Button
              onClick={async () => {
                await apiJson("/api/admin/shop/items", {
                  name: shopName,
                  type: shopType,
                  key: shopKey,
                  price: shopPrice,
                  rarity: shopRarity,
                  description: shopDesc || null,
                  icon: shopIcon || null,
                });
                setShopName("");
                setShopKey("");
                setShopDesc("");
                setShopIcon("");
                setShopPrice(50);
                await refreshShop();
                toast({ kind: "success", title: "Товар добавлен" });
              }}
            >
              Добавить товар
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {shopItems.map((it) => (
              <div key={it.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    {it.type === "FRAME" ? (
                      <AvatarFrame frameKey={it.key} size={42} src="https://placehold.co/84x84/png?text=A" />
                    ) : (
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-base">
                        {it.icon || "🎁"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{it.name}</div>
                    <div className="truncate text-xs text-steam-muted">{it.type} • {it.key}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={clsx("rounded-full border px-2 py-0.5 text-xs", shopRarityTone(it.rarity))}>
                        {shopRarityLabel(it.rarity)}
                      </span>
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">
                        {it.price} 🪙
                      </span>
                    </div>
                  </div>
                </div>
                {it.description ? <div className="mt-2 line-clamp-2 text-xs text-steam-muted">{it.description}</div> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditingShop(it); setEditShopOpen(true); }}>
                    Изменить
                  </Button>
                  <Button size="sm" variant="danger" onClick={async () => { await apiDelete(`/api/admin/shop/items/${it.id}`); await refreshShop(); }}>
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "tasks" ? (
        <div className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(9,16,32,0.94))] p-4 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl lg:p-6">
          {/* Add Task Form - Styled to match main UI */}
          <section className="overflow-hidden rounded-2xl border border-steam-accent/20 bg-[linear-gradient(135deg,rgba(30,41,59,0.92),rgba(15,23,42,0.9))] shadow-[0_0_30px_rgba(102,192,244,0.08)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setAddTaskExpanded(!addTaskExpanded)}
              className="flex w-full items-center justify-between p-5 transition hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-steam-accent/20 text-steam-accent shadow-[0_0_12px_rgba(102,192,244,0.2)]">
                  <FiPlus className={clsx("transition-transform duration-300", addTaskExpanded && "rotate-45")} />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest text-steam-text">Добавить новое задание</span>
              </div>
              <div className="rounded-full bg-white/5 p-1 transition hover:bg-white/10">
                {addTaskExpanded ? <FiChevronUp className="text-steam-muted" /> : <FiChevronDown className="text-steam-muted" />}
              </div>
            </button>

            <motion.div
              initial={false}
              animate={{ height: addTaskExpanded ? "auto" : 0, opacity: addTaskExpanded ? 1 : 0 }}
              className="overflow-hidden"
            >
              <div className="grid gap-5 border-t border-white/10 bg-[linear-gradient(180deg,rgba(12,20,36,0.82),rgba(9,14,28,0.74))] p-6 backdrop-blur-xl">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Название задания</span>
                    <input className="rounded-lg border border-white/10 bg-[#1e293b]/60 px-3 py-2 text-sm text-steam-text outline-none focus:border-steam-accent glow--base" placeholder="Например: Победить босса без урона" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Связанное достижение</span>
                    <select className="rounded-lg border border-white/10 bg-[#1e293b]/60 px-3 py-2 text-sm text-steam-text outline-none focus:border-steam-accent glow--base" value={taskAchievementId} onChange={(e) => setTaskAchievementId(e.target.value)}>
                      <option value="">Выберите достижение...</option>
                      {achievements.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title} ({a.rarity})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Краткое описание</span>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-white/10 bg-[#1e293b]/60 px-4 py-3 text-sm text-steam-text outline-none transition focus:border-steam-accent focus:ring-1 focus:ring-steam-accent/20"
                      placeholder="Опишите суть задания для карточки"
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      onInput={(e) => {
                        const t = e.target as HTMLTextAreaElement;
                        t.style.height = "auto";
                        t.style.height = t.scrollHeight + "px";
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Условия выполнения</span>
                    <textarea
                      className="min-h-[100px] w-full rounded-xl border border-white/10 bg-[#1e293b]/60 px-4 py-3 text-sm text-steam-text outline-none transition focus:border-steam-accent focus:ring-1 focus:ring-steam-accent/20"
                      placeholder="Что именно нужно сделать пользователю?"
                      value={taskConditions}
                      onChange={(e) => setTaskConditions(e.target.value)}
                      onInput={(e) => {
                        const t = e.target as HTMLTextAreaElement;
                        t.style.height = "auto";
                        t.style.height = t.scrollHeight + "px";
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Награда (🪙)</span>
                    <div className="relative">
                      <input
                        className="w-full rounded-lg border border-white/10 bg-[#1e293b]/60 px-3 py-2 text-sm text-steam-text outline-none focus:border-steam-accent glow--base pr-10"
                        type="number"
                        min={0}
                        placeholder="Монеты"
                        value={taskRewardCoins}
                        onChange={(e) => setTaskRewardCoins(Number(e.target.value) || 0)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm opacity-40">🪙</span>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Тип задания</span>
                    <label className="flex h-[42px] cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#1e293b]/40 px-4 text-sm transition hover:bg-white/5">
                      <input type="checkbox" className="accent-steam-accent" checked={taskIsEvent} onChange={(e) => setTaskIsEvent(e.target.checked)} />
                      <span className="font-medium text-steam-text">Ивентовое</span>
                    </label>
                  </div>
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Начало</span>
                    <input className="rounded-lg border border-white/10 bg-[#1e293b]/60 px-3 py-2 text-sm text-steam-text outline-none focus:border-steam-accent glow--base" type="datetime-local" value={taskStartsAt} onChange={(e) => setTaskStartsAt(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-steam-muted">Конец</span>
                    <input className="rounded-lg border border-white/10 bg-[#1e293b]/60 px-3 py-2 text-sm text-steam-text outline-none focus:border-steam-accent glow--base" type="datetime-local" value={taskEndsAt} onChange={(e) => setTaskEndsAt(e.target.value)} />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    className="h-11 px-8 font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(102,192,244,0.15)]"
                    variant="primary"
                    onClick={async () => {
                      if (!taskAchievementId) {
                        setError("Выберите связанное достижение для задания");
                        return;
                      }
                      try {
                        await apiJson("/api/admin/tasks", {
                          title: taskTitle,
                          description: taskDesc,
                          conditions: taskConditions,
                          rewardCoins: taskRewardCoins,
                          achievementId: taskAchievementId,
                          isEvent: taskIsEvent,
                          startsAt: taskStartsAt ? new Date(taskStartsAt).toISOString() : null,
                          endsAt: taskEndsAt ? new Date(taskEndsAt).toISOString() : null,
                        });
                        setTaskTitle("");
                        setTaskDesc("");
                        setTaskConditions("");
                        setTaskAchievementId("");
                        setTaskRewardCoins(0);
                        setTaskIsEvent(false);
                        setTaskStartsAt("");
                        setTaskEndsAt("");
                        setAddTaskExpanded(false);
                        await refreshTasks();
                        toast({ kind: "success", title: "Задание добавлено" });
                      } catch (e: any) {
                        setError(e?.message ?? "Ошибка создания задания");
                        toast({ kind: "error", title: "Не удалось создать задание", message: e?.message ?? "Ошибка" });
                      }
                    }}
                  >
                    Создать задание
                  </Button>
                </div>
              </div>
            </motion.div>
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[25%_45%_30%]">
            {/* Left Column: Tasks List */}
            <section className="sticky top-6 grid gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-steam-muted">Все задания</div>
                <button
                  onClick={() => refreshTasks()}
                  className="text-[10px] font-bold uppercase tracking-widest text-steam-accent/60 transition hover:text-steam-accent"
                >
                  Обновить
                </button>
              </div>
              <div className="grid gap-3">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className={clsx(
                      "group relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 transition-all duration-300 backdrop-blur-xl",
                      t.isEvent
                        ? "from-amber-500/12 via-[#22304b]/88 to-[#111c32]/94 border-amber-400/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]"
                        : "from-[#22304b]/88 via-[#162235]/92 to-[#0d1728]/96 border-white/10 hover:border-steam-accent/35 shadow-[0_14px_34px_rgba(2,6,23,0.3)]",
                      !t.isActive && "opacity-50 grayscale",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-steam-text">{t.title}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={clsx(
                            "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            t.isEvent ? "bg-amber-500/20 text-amber-400" : "bg-steam-accent/10 text-steam-accent"
                          )}>
                            {t.isEvent ? "Ивент" : "Обычное"}
                          </span>
                          <span className="text-[10px] text-steam-muted font-medium">{t.submissionsCount ?? 0} заявок</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 transition duration-300 group-hover:opacity-100">
                        <button
                          title="Редактировать"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-steam-muted transition hover:bg-steam-accent/20 hover:text-steam-accent"
                          onClick={() => openTaskEditor(t)}
                        >
                          <FiEdit2 size={12} />
                        </button>
                        <button
                          title="Удалить"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-steam-muted transition hover:bg-red-500/20 hover:text-red-400"
                          onClick={async () => {
                            if (confirm("Удалить задание? Все связанные заявки также будут удалены.")) {
                              await apiDelete(`/api/admin/tasks/${t.id}`);
                              await refreshTasks();
                            }
                          }}
                        >
                          <FiTrash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                      <button
                        className={clsx(
                          "rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300",
                          t.isActive
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                            : "bg-white/5 text-steam-muted border border-white/10 hover:bg-white/10",
                        )}
                        onClick={async () => {
                          await apiJson(`/api/admin/tasks/${t.id}`, { isActive: !t.isActive }, "PATCH");
                          await refreshTasks();
                        }}
                      >
                        {t.isActive ? "Активно" : "Выключено"}
                      </button>
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-400">
                        <span className="drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">+{t.rewardCoins}</span>
                        <span className="text-[9px]">🪙</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Center Column: Submissions Feed */}
            <section className="grid gap-4">
              <div className="flex items-center justify-between px-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-steam-muted">Отправки пользователей</div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-steam-accent shadow-[0_0_8px_rgba(102,192,244,0.6)]"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-steam-accent">
                    {unreadTaskSubmissions.length} новых
                  </span>
                </div>
              </div>

              <div className="grid gap-3">
                {[...unreadTaskSubmissions, ...readTaskSubmissions].map((submission) => {
                  const selected = submission.id === selectedTaskSubmission?.id;
                  return (
                    <motion.button
                      layout
                      key={submission.id}
                      type="button"
                      onClick={async () => {
                        setSelectedTaskSubmissionId(submission.id);
                        if (!submission.isRead) {
                          try {
                            await apiJson(`/api/admin/tasks/submissions/${submission.id}`, { isRead: true }, "PATCH");
                            await refreshTasks();
                          } catch (e) {
                            console.error("Failed to mark submission as read", e);
                          }
                        }
                      }}
                      className={clsx(
                        "relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 backdrop-blur-xl shadow-[0_18px_40px_rgba(2,6,23,0.24)]",
                        selected
                          ? "border-steam-accent/50 bg-[linear-gradient(135deg,rgba(31,54,84,0.82),rgba(15,23,42,0.92))] shadow-[0_0_25px_rgba(102,192,244,0.14)]"
                          : "border-white/10 bg-[linear-gradient(135deg,rgba(26,43,68,0.58),rgba(15,23,42,0.9))] hover:border-white/20 hover:from-[#203351]/70",
                        !submission.isRead && "ring-1 ring-steam-accent/40 shadow-[0_0_15px_rgba(102,192,244,0.05)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="relative">
                            {submission.user.avatarUrl ? (
                              <AvatarFrame frameKey={submission.user.frameKey || null} size={42} src={submission.user.avatarUrl} />
                            ) : (
                              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-cyan-200/15 bg-[linear-gradient(180deg,rgba(34,52,80,0.92),rgba(15,23,42,0.96))] text-[12px] font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_18px_rgba(56,189,248,0.18)]">
                                {getUserInitials(submission.user.nickname)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-bold text-steam-text">{submission.user.nickname}</span>
                              <span
                                className="shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black text-white shadow-[0_0_8px_rgba(255,255,255,0.1)]"
                                style={{ backgroundColor: calculateLevelColor(submission.user.level) }}
                              >
                                {submission.user.level}
                              </span>
                            </div>
                            <div className="truncate text-[10px] font-bold tracking-wider text-steam-muted/80">
                              #{submission.userId} • {new Date(submission.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div
                          className={clsx(
                            "ml-3 shrink-0 self-start rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] shadow-md",
                            submission.status === "PENDING"
                              ? "border-amber-400/40 bg-amber-400/15 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]"
                              : submission.status === "RESOLVED"
                                ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.1)]"
                                : "border-red-400/40 bg-red-400/15 text-red-400 shadow-[0_0_10px_rgba(248,113,113,0.1)]",
                          )}
                        >
                          {supportStatusLabel(submission.status)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(9,16,30,0.82),rgba(7,12,24,0.92))] p-4 backdrop-blur-lg">
                        <div className="text-[11px] font-black uppercase tracking-widest text-steam-accent drop-shadow-[0_0_8px_rgba(102,192,244,0.3)]">{submission.task.title}</div>
                        <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-steam-text/80 font-medium">
                          {submission.message || "Без текстового комментария..."}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <div className="flex -space-x-2">
                          {submission.evidence.slice(0, 4).map((file, i) => (
                            <div key={i} className="h-8 w-12 overflow-hidden rounded-md border border-black/50 bg-[#0f172a]/80 shadow-md transition hover:scale-110 hover:z-10">
                              {isVideoMedia(file) ? (
                                <div className="flex h-full w-full items-center justify-center bg-steam-accent/20 text-[8px] font-black text-steam-accent">MP4</div>
                              ) : (
                                <img src={file} className="h-full w-full object-cover" />
                              )}
                            </div>
                          ))}
                          {submission.evidence.length > 4 && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-white/5 bg-[#1a2b44]/90 text-[10px] font-black text-steam-muted shadow-md">
                              +{submission.evidence.length - 4}
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-steam-muted/80">
                          {submission.evidence.length} вложений
                        </div>
                      </div>

                      {selected && (
                        <motion.div
                          layoutId="selected-indicator"
                          className="absolute inset-y-0 left-0 w-1 bg-steam-accent shadow-[4px_0_15px_rgba(102,192,244,0.6)]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        />
                      )}
                    </motion.button>
                  );
                })}

                {taskSubmissions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.62),rgba(9,16,30,0.7))] py-16 text-center backdrop-blur-xl">
                    <div className="text-sm font-bold uppercase tracking-widest text-steam-muted/60">Входящих заявок нет</div>
                  </div>
                )}
              </div>
            </section>

            {/* Right Column: Submission Details (Sticky) */}
            <section className="sticky top-6 overflow-hidden">
              {selectedTaskSubmission ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={selectedTaskSubmission.id}
                  className="overflow-hidden rounded-2xl border border-cyan-200/12 bg-[linear-gradient(180deg,rgba(34,52,80,0.94),rgba(15,23,42,0.96))] p-5 shadow-[0_24px_70px_rgba(8,15,30,0.45)] backdrop-blur-2xl"
                >
                  <div className="flex flex-col gap-6">
                    {/* Header Details */}
                    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-5">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="relative">
                          {selectedTaskSubmission.user.avatarUrl ? (
                            <AvatarFrame
                              frameKey={selectedTaskSubmission.user.frameKey || null}
                              size={56}
                              src={selectedTaskSubmission.user.avatarUrl}
                            />
                          ) : (
                            <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full border border-cyan-200/15 bg-[linear-gradient(180deg,rgba(34,52,80,0.92),rgba(15,23,42,0.96))] text-sm font-black uppercase tracking-[0.18em] text-cyan-100 shadow-[0_0_22px_rgba(56,189,248,0.18)]">
                              {getUserInitials(selectedTaskSubmission.user.nickname)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-lg font-bold text-steam-text">{selectedTaskSubmission.user.nickname}</span>
                            <span
                              className="shrink-0 rounded px-2 py-0.5 text-[10px] font-black text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                              style={{ backgroundColor: calculateLevelColor(selectedTaskSubmission.user.level) }}
                            >
                              LVL {selectedTaskSubmission.user.level}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs font-bold text-steam-muted/80 tracking-wide">ID: #{selectedTaskSubmission.userId}</div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end text-right">
                        <div className={clsx(
                          "inline-flex max-w-full items-center justify-center rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] shadow-lg",
                          selectedTaskSubmission.status === "PENDING" ? "border-amber-400/50 bg-amber-400/20 text-amber-400 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.2)]" :
                          selectedTaskSubmission.status === "RESOLVED" ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]" :
                          "border-red-500/50 bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.2)]"
                        )}>
                          {supportStatusLabel(selectedTaskSubmission.status)}
                        </div>
                        <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-steam-muted/40">
                          {new Date(selectedTaskSubmission.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Media Area */}
                    <div className="grid gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-steam-accent/60">Медиа-вложения</div>
                      {selectedTaskSubmission.evidence.length ? (
                        <div className="grid grid-cols-1 gap-4">
                          {selectedTaskSubmission.evidence.map((file, index) => {
                            const isVideo = isVideoMedia(file);
                            return (
                              <div key={file} className="group relative overflow-hidden rounded-xl border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(9,16,30,0.85),rgba(6,10,20,0.94))] shadow-inner backdrop-blur-lg">
                                {isVideo ? (
                                  <div className="aspect-video w-full bg-black">
                                    <video
                                      src={file}
                                      controls
                                      className="h-full w-full object-contain"
                                      poster={`${file}?thumb=1`}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openViewer(selectedTaskSubmission.evidence, index)}
                                    className="block w-full overflow-hidden"
                                  >
                                    <img src={file} className="w-full object-contain transition duration-1000 group-hover:scale-[1.05]" alt={`Evidence ${index + 1}`} />
                                    <div className="absolute bottom-3 right-3 rounded-lg bg-[#0f172a]/80 px-4 py-2 text-[10px] font-black tracking-[0.2em] text-white shadow-2xl backdrop-blur-xl border border-white/10 group-hover:border-steam-accent/40 transition-colors">
                                      СКРИНШОТ #{index + 1}
                                    </div>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(11,18,32,0.72),rgba(8,13,24,0.86))] py-12 text-center shadow-inner backdrop-blur-lg">
                          <div className="text-sm font-bold uppercase tracking-widest text-steam-muted/40">Файлы не приложены</div>
                        </div>
                      )}
                    </div>

                    {/* User Message */}
                    <div className="grid gap-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-steam-accent/60">Заявка пользователя</div>
                      <div className="max-h-56 overflow-auto whitespace-pre-line rounded-2xl border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(9,16,30,0.82),rgba(7,12,24,0.92))] p-5 text-sm font-medium leading-relaxed text-steam-text shadow-inner">
                        {selectedTaskSubmission.message || "Текстовый комментарий отсутствует."}
                      </div>
                    </div>

                    {/* Admin Response */}
                    <div className="grid gap-3 border-t border-white/5 pt-5">
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-steam-accent/60">Ваше решение / Комментарий</div>
                      <textarea
                        className="min-h-[140px] w-full rounded-2xl border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,18,34,0.82),rgba(8,12,24,0.92))] p-5 text-sm text-steam-text outline-none transition duration-500 focus:border-steam-accent/60 focus:ring-1 focus:ring-steam-accent/30 shadow-inner"
                        value={taskResponses[selectedTaskSubmission.id] ?? selectedTaskSubmission.adminResponse ?? ""}
                        onChange={(e) =>
                          setTaskResponses((prev) => ({
                            ...prev,
                            [selectedTaskSubmission.id]: e.target.value,
                          }))
                        }
                        placeholder="Поздравить с выполнением или указать причину отказа..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="grid gap-3 pt-1">
                      <Button
                        className="h-12 w-full border border-cyan-200/20 bg-gradient-to-r from-[#38bdf8] via-[#22d3ee] to-[#3b82f6] px-4 text-[11px] font-black uppercase tracking-[0.22em] text-white shadow-[0_10px_24px_rgba(34,211,238,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(34,211,238,0.35)]"
                        onClick={async () => {
                          try {
                            await grantTaskSubmission(selectedTaskSubmission);
                          } catch (e: any) {
                            setError(e?.message ?? "Ошибка выдачи");
                            toast({ kind: "error", title: "Не удалось выдать награду", message: e?.message ?? "Ошибка" });
                          }
                        }}
                      >
                        Принять заявку
                      </Button>
                      <Button
                        variant="danger"
                        className="h-12 w-full border border-red-400/30 bg-gradient-to-r from-[#4c0914] via-[#6b1120] to-[#8b1e31] px-4 text-[11px] font-black uppercase tracking-[0.22em] text-red-100 shadow-[0_10px_24px_rgba(127,29,29,0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(127,29,29,0.32)]"
                        onClick={() => openRejectTaskSubmission(selectedTaskSubmission)}
                      >
                        Отклонить
                      </Button>
                      {selectedTaskSubmission.status !== "PENDING" ? (
                        <Button
                          variant="ghost"
                          className="h-11 w-full border border-white/10 bg-white/5 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-steam-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white"
                          onClick={async () => {
                            try {
                              await deleteTaskSubmission(selectedTaskSubmission);
                            } catch (e: any) {
                              setError(e?.message ?? "������ ��������");
                              toast({ kind: "error", title: "�� ������� ������� ������", message: e?.message ?? "������" });
                            }
                          }}
                        >
                          ������� ������
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(24,37,60,0.68),rgba(12,20,36,0.82))] px-8 py-24 text-center backdrop-blur-xl shadow-inner">
                  <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-steam-accent/5 shadow-[0_0_30px_rgba(102,192,244,0.05)] border border-white/5">
                    <FiSearch className="h-12 w-12 text-steam-accent/20" />
                  </div>
                  <div className="text-sm font-black uppercase tracking-[0.3em] text-steam-muted/40">
                    Выберите заявку
                  </div>
                  <div className="mt-4 max-w-[240px] text-xs font-bold leading-relaxed text-steam-muted/20 uppercase tracking-widest">
                    Инструменты модерации и медиафайлы появятся здесь
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}

      {tab === "audit" ? (
        <section className="steam-card steam-card--hover p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="text-sm font-semibold">Журнал действий администрации</div>
            <Button size="sm" variant="ghost" onClick={() => refreshAuditLogs().catch((e: any) => setError(e?.message ?? "Ошибка загрузки"))}>
              Обновить
            </Button>
          </div>
          {auditLogs.length ? (
            <div className="grid gap-2">
              {auditLogs.map((row) => (
                <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{row.summary}</div>
                    <div className="text-xs text-steam-muted">{new Date(row.createdAt).toLocaleString("ru-RU")}</div>
                  </div>
                  <div className="mt-1 text-xs text-steam-muted">
                    {row.adminNickname} • {row.action}
                    {row.targetNickname ? ` • ${row.targetNickname}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-steam-muted">
              Логи пока пусты. После действий в админке они появятся здесь.
            </div>
          )}
        </section>
      ) : null}

      <Modal open={editOpen} title={editing ? `Редактирование: ${editing.title}` : "Редактирование достижения"} onClose={() => setEditOpen(false)}>
        {editing ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Название</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Описание</span>
              <textarea
                className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Иконка достижения (png/jpg/webp/gif)</span>
              <input type="file" accept="image/*" onChange={(e) => setEditIconFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                className={selectClass}
                value={editing.rarity}
                onChange={(e) => setEditing({ ...editing, rarity: e.target.value as Rarity })}
              >
                <option value="COMMON">Обычная</option>
                <option value="RARE">Редкая</option>
                <option value="EPIC">Эпическая</option>
                <option value="LEGENDARY">Легендарная</option>
                {isCreatorUser ? <option value="EXCLUSIVE">Эксклюзив (создатель)</option> : null}
                {!isCreatorUser && editing.rarity === "EXCLUSIVE" ? (
                  <option value="EXCLUSIVE" disabled>
                    Эксклюзив (только создатель)
                  </option>
                ) : null}
              </select>
              <input
                className={`w-32 ${inputClass}`}
                value={editing.points}
                onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) || 0 })}
              />
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.isPublic}
                  onChange={(e) => setEditing({ ...editing, isPublic: e.target.checked })}
                />
                <span>Публичное</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
              <Button
                leftIcon={<FiEdit2 />}
                onClick={async () => {
                  try {
                    const updated = await apiJson<AdminAchievement>(`/api/admin/achievements/${editing.id}`, {
                      title: editing.title,
                      description: editing.description,
                      rarity: editing.rarity,
                      points: editing.points,
                      isPublic: editing.isPublic,
                    }, "PATCH");
                    if (editIconFile) {
                      await apiUpload(`/api/admin/achievements/${editing.id}/icon`, editIconFile);
                    }
                    setEditing(updated);
                    await refreshAchievements();
                    setEditOpen(false);
                    setEditIconFile(null);
                  } catch (e: any) {
                    setError(e?.message ?? "Ошибка обновления");
                  }
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={userDetailsOpen} title={selectedUser ? `Пользователь: ${selectedUser.nickname}` : "Пользователь"} onClose={() => setUserDetailsOpen(false)}>
        {selectedUser ? (
          <div className="grid gap-3">
            <div className="text-xs text-steam-muted">
              ID: <span className="font-mono">{selectedUser.id}</span>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Заметки администратора</span>
              <textarea
                className="min-h-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Метки администратора (через запятую)</span>
              <input
                className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-steam-accent"
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
              />
            </label>

            <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-sm font-semibold">Уровень и опыт</div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-steam-muted">Level</span>
                  <select
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    value={levelDraft}
                    onChange={(e) => setLevelDraft(Number(e.target.value))}
                    style={{ color: calculateLevelColor(levelDraft) }}
                  >
                    {Array.from({ length: 100 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-steam-muted">XP</span>
                  <input
                    className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-steam-accent"
                    value={xpDraft}
                    onChange={(e) => setXpDraft(Number(e.target.value) || 0)}
                  />
                </label>
              </div>
              <div className="text-xs text-steam-muted">
                Подсказка: изменение XP влияет на прогресс. Выдача/отзыв достижений тоже меняет XP автоматически.
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setUserDetailsOpen(false)}>
                Закрыть
              </Button>
              <Button
                leftIcon={<FiUser />}
                onClick={async () => {
                  const tags = tagsDraft
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  try {
                    const updated = await apiJson<AdminUserRow>(
                      `/api/admin/users/${selectedUser.id}`,
                      { adminNotes: notesDraft || null, adminTags: tags, level: levelDraft, xp: xpDraft },
                      "PATCH",
                    );
                    setSelectedUser(updated);
                    await refreshUsers();
                    setUserDetailsOpen(false);
                    toast({ kind: "success", title: "Пользователь обновлен" });
                  } catch (e: any) {
                    setError(e?.message ?? "Ошибка обновления");
                    toast({ kind: "error", title: "Не удалось обновить пользователя", message: e?.message ?? "Ошибка" });
                  }
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={awardOpen} title="Выдать существующее достижение" onClose={() => setAwardOpen(false)}>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-steam-muted">Пользователь</span>
            <select
              className={selectClass}
              value={awardUserId2}
              onChange={(e) => setAwardUserId2(e.target.value)}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nickname} ({u.email})
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <div className="text-sm text-steam-muted">Достижение</div>
            <div className="max-h-[420px] overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-2">
              <div className="grid gap-2">
                {achievements.map((a) => {
                  const active = a.id === awardAchId;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAwardAchId(a.id)}
                      className={clsx(
                        "rounded-2xl border p-2 text-left transition",
                        active ? "border-steam-accent/45 bg-steam-accent/10" : "border-transparent hover:border-white/10 hover:bg-white/5",
                      )}
                    >
                      <AchievementCard a={toAdminAchievementCardModel(a)} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAwardOpen(false)}>
              Отмена
            </Button>
            <Button
              leftIcon={<FiAward />}
              onClick={async () => {
                try {
                  await apiJson(`/api/admin/achievements/${awardAchId}/award`, { userId: awardUserId2 });
                  toast({ kind: "success", title: "Достижение выдано" });
                  setAwardOpen(false);
                } catch (e: any) {
                  setError(e?.message ?? "Ошибка выдачи");
                  toast({ kind: "error", title: "Не удалось выдать достижение", message: e?.message ?? "Ошибка" });
                }
              }}
            >
              Выдать
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={revokeOpen} title="Забрать достижение" onClose={() => setRevokeOpen(false)}>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-steam-muted">Пользователь</span>
            <select
              className={selectClass}
              value={revokeUserId}
              onChange={async (e) => {
                const nextUserId = e.target.value;
                setRevokeUserId(nextUserId);
                setRevokeAchievementIds([]);
                await loadUserOwnedAchievements(nextUserId);
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nickname} ({u.email})
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-steam-muted">Достижения пользователя</div>
              <div className="text-xs text-steam-muted">
                Выбрано: {revokeAchievementIds.length}
              </div>
            </div>
            <div className="max-h-[420px] overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-2">
              {loadingUserOwnedAchievements ? (
                <div className="grid gap-2">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              ) : userOwnedAchievements.length ? (
                <div className="grid gap-2">
                  {userOwnedAchievements.map((a) => {
                    const active = revokeAchievementIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setRevokeAchievementIds((prev) =>
                            prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id],
                          )
                        }
                        className={clsx(
                          "rounded-2xl border p-2 text-left transition",
                          active ? "border-red-400/45 bg-red-500/10" : "border-transparent hover:border-white/10 hover:bg-white/5",
                        )}
                      >
                        <AchievementCard a={a} />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 text-sm text-steam-muted">У пользователя пока нет выданных достижений.</div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRevokeOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              leftIcon={<FiTrash2 />}
              onClick={async () => {
                try {
                  await apiJson(`/api/admin/users/${revokeUserId}/revoke-achievements`, { achievementIds: revokeAchievementIds });
                  toast({ kind: "info", title: "Достижения забраны" });
                  setRevokeOpen(false);
                  setRevokeAchievementIds([]);
                  await Promise.all([refreshAchievements(), refreshUsers()]);
                } catch (e: any) {
                  setError(e?.message ?? "Ошибка удаления достижений");
                  toast({ kind: "error", title: "Не удалось забрать достижения", message: e?.message ?? "Ошибка" });
                }
              }}
              disabled={!revokeUserId || revokeAchievementIds.length === 0}
            >
              Забрать выбранные
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Удаление достижения"
        message={
          confirmTarget
            ? `Достижение "${confirmTarget.title}" и связанные выдачи/доступы будут удалены навсегда. Продолжить?`
            : "Удалить это достижение?"
        }
        danger
        confirmText="Удалить"
        onCancel={() => {
          setConfirmOpen(false);
          setConfirmTarget(null);
        }}
        onConfirm={async () => {
          if (!confirmTarget) return;
          try {
            await apiDelete(`/api/admin/achievements/${confirmTarget.id}`);
            toast({ kind: "success", title: "Достижение удалено" });
            await refreshAchievements();
          } catch (e: any) {
            setError(e?.message ?? "Ошибка удаления");
            toast({ kind: "error", title: "Не удалось удалить достижение", message: e?.message ?? "Ошибка" });
          } finally {
            setConfirmOpen(false);
            setConfirmTarget(null);
          }
        }}
      />

      <ConfirmModal
        open={userDeleteOpen}
        title="Удаление аккаунта"
        message={
          userDeleteTarget
            ? `Пользователь «${userDeleteTarget.nickname}» (${userDeleteTarget.email}) будет удалён из базы вместе со связанными данными. Это действие необратимо.`
            : ""
        }
        danger
        confirmText="Удалить навсегда"
        onCancel={() => {
          setUserDeleteOpen(false);
          setUserDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (!userDeleteTarget) return;
          try {
            await apiDelete(`/api/admin/users/${userDeleteTarget.id}`);
            toast({ kind: "success", title: "Аккаунт удалён" });
            if (selectedUser?.id === userDeleteTarget.id) {
              setUserDetailsOpen(false);
              setSelectedUser(null);
            }
            await refreshUsers();
          } catch (e: any) {
            setError(e?.message ?? "Ошибка удаления");
            toast({ kind: "error", title: "Не удалось удалить аккаунт", message: e?.message ?? "Ошибка" });
          } finally {
            setUserDeleteOpen(false);
            setUserDeleteTarget(null);
          }
        }}
      />

      <Modal
        open={rejectOpen}
        title={rejectTarget ? `Отклонить: ${rejectTarget.task.title}` : "Отклонение задания"}
        onClose={() => {
          if (rejectBusy) return;
          setRejectOpen(false);
          setRejectTarget(null);
          setRejectReasonDraft("");
        }}
      >
        <div className="grid gap-3">
          <div className="text-sm text-steam-muted">Укажи причину отказа — пользователь получит ее в уведомлении.</div>
          <textarea
            className="min-h-28 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-red-300/60"
            value={rejectReasonDraft}
            onChange={(e) => setRejectReasonDraft(e.target.value)}
            placeholder="Причина отклонения"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                if (rejectBusy) return;
                setRejectOpen(false);
                setRejectTarget(null);
                setRejectReasonDraft("");
              }}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              loading={rejectBusy}
              disabled={!rejectTarget || buildRejectReasonText(rejectReasonDraft).length < 3}
              onClick={async () => {
                if (!rejectTarget) return;
                const reason = buildRejectReasonText(rejectReasonDraft);
                if (reason.length < 3) {
                  toast({ kind: "error", title: "Причина должна быть не короче 3 символов" });
                  return;
                }
                setRejectBusy(true);
                try {
                  await apiJson(
                    `/api/admin/tasks/submissions/${rejectTarget.id}`,
                    {
                      status: "REJECTED",
                      isRead: true,
                      adminResponse: taskResponses[rejectTarget.id] ?? "",
                      rejectionReason: reason,
                    },
                    "PATCH",
                  );
                  setTaskResponses((prev) => ({ ...prev, [rejectTarget.id]: reason }));
                  toast({ kind: "info", title: "Задание отклонено" });
                  setRejectOpen(false);
                  setRejectTarget(null);
                  setRejectReasonDraft("");
                  await refreshTasks();
                } catch (e: any) {
                  setError(e?.message ?? "Ошибка отклонения");
                  toast({ kind: "error", title: "Не удалось отклонить", message: e?.message ?? "Ошибка" });
                } finally {
                  setRejectBusy(false);
                }
              }}
            >
              Подтвердить отклонение
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editShopOpen} title={editingShop ? `Редактировать: ${editingShop.name}` : "Редактировать товар"} onClose={() => setEditShopOpen(false)}>
        {editingShop ? (
          <div className="grid gap-3">
            <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={editingShop.name} onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })} />
            <div className="grid gap-2 md:grid-cols-2">
              <select className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={editingShop.type} onChange={(e) => setEditingShop({ ...editingShop, type: e.target.value as any })}>
                <option value="FRAME">FRAME</option>
                <option value="BADGE">BADGE</option>
              </select>
              <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={editingShop.key} onChange={(e) => setEditingShop({ ...editingShop, key: e.target.value })} />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={editingShop.price} onChange={(e) => setEditingShop({ ...editingShop, price: Number(e.target.value) || 0 })} />
              <select className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={editingShop.rarity} onChange={(e) => setEditingShop({ ...editingShop, rarity: e.target.value as Rarity })}>
                <option value="COMMON">COMMON</option>
                <option value="RARE">RARE</option>
                <option value="EPIC">EPIC</option>
                <option value="LEGENDARY">LEGENDARY</option>
              </select>
            </div>
            <input className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={editingShop.icon ?? ""} onChange={(e) => setEditingShop({ ...editingShop, icon: e.target.value })} />
            <textarea className="min-h-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" value={editingShop.description ?? ""} onChange={(e) => setEditingShop({ ...editingShop, description: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditShopOpen(false)}>Отмена</Button>
              <Button
                onClick={async () => {
                  await apiJson(`/api/admin/shop/items/${editingShop.id}`, {
                    name: editingShop.name,
                    type: editingShop.type,
                    key: editingShop.key,
                    price: editingShop.price,
                    rarity: editingShop.rarity,
                    description: editingShop.description || null,
                    icon: editingShop.icon || null,
                  }, "PATCH");
                  setEditShopOpen(false);
                  await refreshShop();
                  toast({ kind: "success", title: "Товар обновлён" });
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={editTaskOpen} title={editingTask ? `Редактировать задание: ${editingTask.title}` : "Редактор задания"} onClose={() => setEditTaskOpen(false)}>
        {editingTask ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Название задания</span>
              <input
                className={inputClass}
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Описание</span>
              <textarea
                className="min-h-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-steam-accent"
                value={editingTask.description}
                onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-steam-muted">Условия выполнения</span>
              <textarea
                className="min-h-24 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-steam-accent"
                value={editingTask.conditions}
                onChange={(e) => setEditingTask({ ...editingTask, conditions: e.target.value })}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-steam-muted">Достижение в награде</span>
                <select
                  className={selectClass}
                  value={editingTask.achievementId}
                  onChange={(e) => {
                    const selected = achievements.find((a) => a.id === e.target.value);
                    setEditingTask({
                      ...editingTask,
                      achievementId: e.target.value,
                      achievement: selected
                        ? {
                            id: selected.id,
                            title: selected.title,
                            rarity: selected.rarity,
                            points: selected.points,
                            iconUrl: selected.iconUrl,
                          }
                        : null,
                    });
                  }}
                >
                  <option value="">Выбери достижение</option>
                  {achievements.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.rarity})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="text-steam-muted">Награда монетами</span>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  step={1}
                  value={editingTask.rewardCoins ?? 0}
                  onChange={(e) => setEditingTask({ ...editingTask, rewardCoins: Number(e.target.value) || 0 })}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-steam-muted">Дата начала</span>
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={toDateTimeLocalValue(editingTask.startsAt)}
                  onChange={(e) => setEditingTask({ ...editingTask, startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-steam-muted">Дата окончания</span>
                <input
                  className={inputClass}
                  type="datetime-local"
                  value={toDateTimeLocalValue(editingTask.endsAt)}
                  onChange={(e) => setEditingTask({ ...editingTask, endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingTask.isEvent}
                  onChange={(e) => setEditingTask({ ...editingTask, isEvent: e.target.checked })}
                />
                <span>Ивентовое задание</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingTask.isActive}
                  onChange={(e) => setEditingTask({ ...editingTask, isActive: e.target.checked })}
                />
                <span>Активно для пользователей</span>
              </label>
            </div>

            <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-amber-100/80">Предпросмотр награды</div>
              <div className="mt-2 text-sm text-steam-text">
                {editingTask.achievement?.title ?? "Достижение не выбрано"} • +{Math.max(0, editingTask.rewardCoins ?? 0)} 🪙
              </div>
              <div className="mt-1 text-xs text-steam-muted">
                Пользователь получит выбранное достижение в профиль и указанное количество монет после одобрения задания.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditTaskOpen(false)}>
                Отмена
              </Button>
              <Button
                leftIcon={<FiEdit2 />}
                onClick={async () => {
                  await apiJson(
                    `/api/admin/tasks/${editingTask.id}`,
                    {
                      title: editingTask.title,
                      description: editingTask.description,
                      conditions: editingTask.conditions,
                      achievementId: editingTask.achievementId,
                      rewardCoins: Math.max(0, editingTask.rewardCoins ?? 0),
                      isActive: editingTask.isActive,
                      isEvent: editingTask.isEvent,
                      startsAt: editingTask.startsAt,
                      endsAt: editingTask.endsAt,
                    },
                    "PATCH",
                  );
                  setEditTaskOpen(false);
                  await refreshTasks();
                  toast({ kind: "success", title: "Задание обновлено" });
                }}
              >
                Сохранить
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <AnimatePresence>
        {viewerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
            onClick={() => setViewerOpen(false)}
          >
            <div className="absolute right-6 top-6 flex items-center gap-4 z-[110]">
              <div className="text-sm font-bold text-white/40">
                {viewerIndex + 1} / {viewerFiles.length}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerOpen(false);
                }}
                className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="relative flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewerFiles[viewerIndex]}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="relative max-h-full max-w-full"
                >
                  {isVideoMedia(viewerFiles[viewerIndex]) ? (
                    <video
                      src={viewerFiles[viewerIndex]}
                      controls
                      autoPlay
                      className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl"
                    />
                  ) : (
                    <div className="relative overflow-hidden rounded-xl">
                      <motion.img
                        src={viewerFiles[viewerIndex]}
                        className="max-h-[85vh] max-w-[90vw] cursor-zoom-in object-contain shadow-2xl"
                        animate={{ scale: zoom }}
                        onClick={() => setZoom(prev => prev === 1 ? 2 : 1)}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {viewerFiles.length > 1 && (
                <>
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/5 p-4 text-white backdrop-blur-md transition hover:bg-white/15"
                    onClick={() => setViewerIndex((prev) => (prev === 0 ? viewerFiles.length - 1 : prev - 1))}
                  >
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/5 p-4 text-white backdrop-blur-md transition hover:bg-white/15"
                    onClick={() => setViewerIndex((prev) => (prev === viewerFiles.length - 1 ? 0 : prev + 1))}
                  >
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            <div className="mt-8 flex gap-2 overflow-x-auto p-2">
              {viewerFiles.map((file, i) => (
                <button
                  key={file}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerIndex(i);
                  }}
                  className={clsx(
                    "h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition",
                    i === viewerIndex ? "border-steam-accent scale-105 shadow-lg shadow-steam-accent/20" : "border-transparent opacity-50 hover:opacity-100"
                  )}
                >
                  {isVideoMedia(file) ? (
                    <div className="flex h-full w-full items-center justify-center bg-black/40 text-[10px] font-bold text-white">VIDEO</div>
                  ) : (
                    <img src={file} className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
