import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import clsx from "clsx";
import { apiFetch } from "../lib/api";
import { API_BASE_URL } from "../lib/config";
import type { TaskItem } from "../lib/types";
import { Reveal } from "../ui/components/Reveal";
import { Skeleton } from "../ui/components/Skeleton";
import { TaskQuestCard, type TaskQuestCardVariant } from "../ui/components/TaskQuestCard";
import { FiCheckCircle, FiCheckSquare } from "react-icons/fi";
import { useToasts } from "../state/toasts";
import { getStoredAuthToken } from "../lib/authStorage";

type TasksTab = "available" | "completed";
const MAX_TASK_MEDIA_BYTES = 100 * 1024 * 1024;

function isCompletedForUser(t: TaskItem) {
  return t.mySubmission?.status === "RESOLVED";
}

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TasksTab>("available");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formTaskId, setFormTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const toast = useToasts((s) => s.push);
  const reduce = useReducedMotion();

  const { availableTasks, completedTasks } = useMemo(() => {
    const available: TaskItem[] = [];
    const completed: TaskItem[] = [];
    for (const t of tasks) {
      if (isCompletedForUser(t)) completed.push(t);
      else available.push(t);
    }
    completed.sort((a, b) => {
      const ta = new Date(a.mySubmission?.reviewedAt ?? a.mySubmission?.createdAt ?? 0).getTime();
      const tb = new Date(b.mySubmission?.reviewedAt ?? b.mySubmission?.createdAt ?? 0).getTime();
      return tb - ta;
    });
    return { availableTasks: available, completedTasks: completed };
  }, [tasks]);

  function switchTab(next: TasksTab) {
    setTab(next);
    setExpandedId(null);
    setFormTaskId(null);
    setMessage("");
    setFiles([]);
  }

  async function refresh() {
    const list = await apiFetch<TaskItem[]>("/api/tasks");
    setTasks(list);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await refresh();
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Не удалось загрузить задания");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep time-based task locks/countdowns fresh without page reload.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  function toggleExpand(taskId: string) {
    setExpandedId((prev) => {
      if (prev === taskId) {
        setFormTaskId(null);
        setMessage("");
        setFiles([]);
        setUploadProgress(0);
        setUploadStatus(null);
        return null;
      }
      setFormTaskId(null);
      setMessage("");
      setFiles([]);
      setUploadProgress(0);
      setUploadStatus(null);
      return taskId;
    });
  }

  function openForm(taskId: string) {
    setFormTaskId((prev) => (prev === taskId ? null : taskId));
  }

  async function submit(taskId: string) {
    const token = getStoredAuthToken();
    const form = new FormData();
    form.append("message", message.trim());
    files.forEach((f) => form.append("files", f));

    setSubmitting(true);
    setUploadProgress(0);
    setUploadStatus("Загрузка видео в облако...");
    try {
      const res = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE_URL}/api/tasks/${taskId}/submit`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const pct = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(Math.max(1, Math.min(100, pct)));
        };
        xhr.onerror = () => reject(new Error("Ошибка сети при загрузке файла"));
        xhr.onload = () => {
          const status = xhr.status;
          const text = xhr.responseText ?? "";
          resolve(
            new Response(text, {
              status,
              headers: { "Content-Type": xhr.getResponseHeader("Content-Type") ?? "application/json" },
            }),
          );
        };
        xhr.send(form);
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; data: unknown }
        | { ok: false; error?: { message?: string } }
        | null;
      if (!res.ok || !json || !("ok" in json) || !json.ok) {
        throw new Error((json as any)?.error?.message ?? "Ошибка отправки");
      }
      toast({ kind: "success", title: "Отправка принята" });
      setMessage("");
      setFiles([]);
      setUploadProgress(100);
      setUploadStatus("Загрузка завершена");
      setFormTaskId(null);
      setExpandedId(null);
      await refresh();
    } catch (e: any) {
      toast({ kind: "error", title: "Не удалось отправить", message: e?.message ?? "Ошибка" });
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadStatus(null);
      }, 400);
    }
  }

  function handleFilesChange(nextFiles: File[]) {
    const tooHeavyVideo = nextFiles.find((file) => /^video\//.test(file.type) && file.size > MAX_TASK_MEDIA_BYTES);
    if (tooHeavyVideo) {
      toast({ kind: "error", title: "Видео слишком тяжелое (макс. 100 МБ)" });
      return;
    }
    setFiles(nextFiles);
    setUploadProgress(0);
    setUploadStatus(null);
  }

  const tabHint =
    tab === "available"
      ? "Отправьте доказательства; после принятия модерацией задание окажется во вкладке «Выполненные»."
      : "Здесь только ваши принятые задания. Остальные участники клана проходят те же задания независимо.";

  const emptyAvailable =
    completedTasks.length > 0
      ? "У вас нет заданий в работе — все текущие из списка уже приняты или ещё не опубликованы."
      : "Сейчас нет заданий, доступных для выполнения.";

  function renderTaskGrid(items: TaskItem[], variant: TaskQuestCardVariant, emptyText: string, emptyKey: string) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {!items.length ? (
            <motion.div
              key={emptyKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="steam-card p-4 text-sm text-steam-muted md:col-span-2"
            >
              {emptyText}
            </motion.div>
          ) : null}

          {items.map((t, idx) => (
            <motion.div
              key={t.id}
              layout="position"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(6px)" }}
              transition={{ duration: 0.18 + Math.min(0.02 * idx, 0.12), ease: "easeOut" }}
            >
              <TaskQuestCard
                task={t}
                variant={variant}
                nowMs={nowMs}
                expanded={expandedId === t.id}
                showForm={formTaskId === t.id && expandedId === t.id}
                onToggleExpand={() => toggleExpand(t.id)}
                onOpenForm={() => openForm(t.id)}
                message={message}
                onMessageChange={setMessage}
                files={files}
                onFilesChange={handleFilesChange}
                submitting={submitting}
                uploadProgress={uploadProgress}
                uploadStatus={uploadStatus}
                onSubmit={() => submit(t.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <Reveal className="steam-card steam-card--hover overflow-hidden p-0">
        <div className="p-4 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <FiCheckSquare className="opacity-90" />
                Задания
              </div>
              <div className="mt-1 text-sm text-steam-muted">
                Список общий для клана: чужое выполнение не закрывает задание для вас. Статус и доказательства привязаны к вашему аккаунту.
              </div>
            </div>
          </div>

          {!loading && !error && tasks.length > 0 ? (
            <div
              className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch"
              role="tablist"
              aria-label="Тип заданий"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "available"}
                onClick={() => switchTab("available")}
                className={clsx(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-200",
                  tab === "available"
                    ? "border-steam-accent/55 bg-steam-accent/14 text-steam-text shadow-[0_0_24px_rgba(102,192,244,0.14)]"
                    : "border-white/10 bg-black/25 text-steam-muted hover:border-white/18 hover:bg-white/[0.06] hover:text-steam-text",
                )}
              >
                <FiCheckSquare className="h-[1.1em] w-[1.1em] shrink-0 opacity-90" />
                <span className="min-w-0 flex-1">Доступные</span>
                <span
                  className={clsx(
                    "shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums",
                    tab === "available" ? "bg-black/35 text-steam-text" : "bg-white/10 text-steam-muted",
                  )}
                >
                  {availableTasks.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "completed"}
                onClick={() => switchTab("completed")}
                className={clsx(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-200",
                  tab === "completed"
                    ? "border-steam-green/45 bg-steam-green/12 text-steam-text shadow-[0_0_22px_rgba(16,185,129,0.12)]"
                    : "border-white/10 bg-black/25 text-steam-muted hover:border-white/18 hover:bg-white/[0.06] hover:text-steam-text",
                )}
              >
                <FiCheckCircle className="h-[1.1em] w-[1.1em] shrink-0 text-steam-green/90" />
                <span className="min-w-0 flex-1">Выполненные</span>
                <span
                  className={clsx(
                    "shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums",
                    tab === "completed" ? "bg-black/35 text-steam-green" : "bg-white/10 text-steam-muted",
                  )}
                >
                  {completedTasks.length}
                </span>
              </button>
            </div>
          ) : null}

          {!loading && !error && tasks.length > 0 ? (
            <p className="mt-3 text-sm text-steam-muted">{tabHint}</p>
          ) : (
            <p className="mt-3 text-sm text-steam-muted">
              Ивентовые задания подсвечены золотом, временные — голубой полосой.
            </p>
          )}
        </div>

        <div className="border-t border-white/10 bg-black/20 p-4">
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-[rgba(27,40,56,0.5)] p-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-14 w-14 rounded-xl" />
                    <div className="grid flex-1 gap-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Skeleton className="h-6 w-24 rounded-md" />
                        <Skeleton className="h-6 w-20 rounded-md" />
                        <Skeleton className="h-6 w-28 rounded-md" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

          {!loading && !error && !tasks.length ? (
            <div className="steam-card p-4 text-sm text-steam-muted">Сейчас нет опубликованных заданий.</div>
          ) : null}

          {!loading && !error && tasks.length > 0 ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                role="tabpanel"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                {tab === "available"
                  ? renderTaskGrid(availableTasks, "available", emptyAvailable, "empty-available")
                  : renderTaskGrid(
                      completedTasks,
                      "completed",
                      "Пока нет принятых заданий — выполните задание во вкладке «Доступные» и дождитесь решения модерации.",
                      "empty-completed",
                    )}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}
