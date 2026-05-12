export type NotificationType = "SYSTEM" | "ACH" | "XP" | "LVL" | "SHOP" | "SUPPORT" | "GIFT";

export type Notification = {
  id: string;
  type: NotificationType;
  text: string;
  adminName: string | null;
  userId: string | null;
  isRead: boolean;
  createdAt: string;
};
