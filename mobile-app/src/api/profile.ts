import { apiRequest } from "./request";

export type PublicProfileDto = {
  user: {
    id: string;
    publicId?: number;
    nickname: string;
    role: "USER" | "ADMIN" | "CREATOR";
    level?: number;
    xp?: number;
    avatarUrl: string | null;
    bannerUrl: string | null;
    frameKey?: string | null;
    badges: string[];
    statusEmoji?: string | null;
  };
  achievements: {
    earned: Array<{
      id: string;
      title: string;
      description?: string;
      rarity: string;
      iconUrl: string | null;
      points: number;
      awardedAt?: string;
    }>;
    locked: Array<{
      id: string;
      title: string;
      description?: string;
      rarity: string;
      iconUrl: string | null;
      points: number;
      scheduleLocked?: boolean;
      eventEnded?: boolean;
      taskConditions?: string | null;
    }>;
  };
};

export function fetchPublicProfile(userId: string) {
  return apiRequest.get<PublicProfileDto>(`/api/users/${userId}`);
}

export type PatchMyProfilePayload = {
  nickname?: string;
  frameKey?: string | null;
  badges?: string[];
  statusEmoji?: string | null;
};

export function patchMyProfile(body: PatchMyProfilePayload) {
  return apiRequest.patch<unknown>("/api/users/me", body);
}

export type ProfileImagePick = { uri: string; name: string; type: string };

export function uploadMyAvatar(file: ProfileImagePick) {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return apiRequest.post<unknown>("/api/users/me/avatar", form);
}

export function uploadMyBanner(file: ProfileImagePick) {
  const form = new FormData();
  form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return apiRequest.post<unknown>("/api/users/me/banner", form);
}
