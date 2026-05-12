export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export type Role = "USER" | "ADMIN" | "CREATOR";

export type AuthUser = {
  id: string;
  nickname: string;
  email: string;
  role: Role;
  publicId: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};
