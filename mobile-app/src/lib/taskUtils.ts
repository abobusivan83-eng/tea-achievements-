import type { TaskItem } from "../types/tasks";

const RANK: Record<string, number> = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  SECRET: 5,
  EXCLUSIVE: 6,
};

export function isTaskCompleted(t: TaskItem): boolean {
  const sub = t.mySubmission ?? t.submission;
  return sub?.status === "RESOLVED";
}

export function taskScheduleStatus(t: TaskItem, nowMs: number): TaskItem["scheduleStatus"] {
  if (t.scheduleStatus) return t.scheduleStatus;
  const s = t.startsAt ? new Date(t.startsAt).getTime() : null;
  const e = t.endsAt ? new Date(t.endsAt).getTime() : null;
  if (s !== null && nowMs < s) return "UPCOMING";
  if (e !== null && nowMs > e) return "EXPIRED";
  return "ACTIVE";
}

export function rarityRank(t: TaskItem): number {
  return RANK[t.achievement?.rarity ?? "COMMON"] ?? 0;
}

export function partitionTasks(tasks: TaskItem[], nowMs: number) {
  const available: TaskItem[] = [];
  const completed: TaskItem[] = [];
  for (const t of tasks) {
    const norm = {
      ...t,
      mySubmission: t.mySubmission ?? t.submission ?? null,
    };
    if (isTaskCompleted(norm)) completed.push(norm);
    else available.push(norm);
  }
  available.sort((a, b) => {
    const aOpen = taskScheduleStatus(a, nowMs) === "ACTIVE" ? 1 : 0;
    const bOpen = taskScheduleStatus(b, nowMs) === "ACTIVE" ? 1 : 0;
    if (bOpen !== aOpen) return bOpen - aOpen;
    const rd = rarityRank(b) - rarityRank(a);
    if (rd !== 0) return rd;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
  completed.sort((a, b) => {
    const rd = rarityRank(b) - rarityRank(a);
    if (rd !== 0) return rd;
    const sa = a.mySubmission?.reviewedAt ?? a.mySubmission?.createdAt ?? "";
    const sb = b.mySubmission?.reviewedAt ?? b.mySubmission?.createdAt ?? "";
    return +new Date(sb) - +new Date(sa);
  });
  return { available, completed };
}

export function scheduleLabel(t: TaskItem, nowMs: number): string {
  const st = taskScheduleStatus(t, nowMs);
  if (st === "UPCOMING") return "Скоро";
  if (st === "EXPIRED") return "Окно закрыто";
  return "Активно";
}
