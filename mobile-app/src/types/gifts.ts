export type GiftInboxItem = {
  id: string;
  xpAmount: number;
  message: string | null;
  createdAt: string;
  isRead: boolean;
  fromUser: { id: string; nickname: string };
};

export type GiftOutboxItem = {
  id: string;
  xpAmount: number;
  message: string | null;
  createdAt: string;
  toUser: { id: string; nickname: string };
};
