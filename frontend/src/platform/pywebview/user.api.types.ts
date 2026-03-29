export interface ApiResponse<TData = Record<string, unknown>> {
  ok: boolean;
  message: string;
  data?: TData;
  error?: string;
}

export interface RegisteredUser {
  id: number;
  username: string;
}

export interface UserSession {
  id: number;
  user_id: number;
  username: string;
  access_token: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  device_info?: string;
}

export type CurrentSessionResult = ApiResponse<{
  session?: UserSession;
  [key: string]: unknown;
}> & {
  session?: UserSession;
};

export type RegisterUserResult = ApiResponse<{
  user?: RegisteredUser;
  token?: string;
  device_info?: string;
  [key: string]: unknown;
}> & {
  user?: RegisteredUser;
  token?: string;
  device_info?: string;
};

export type LoginUserResult = ApiResponse<{
  session?: UserSession;
  user?: RegisteredUser;
  token?: string;
  device_info?: string;
  [key: string]: unknown;
}> & {
  session?: UserSession;
  user?: RegisteredUser;
  token?: string;
  device_info?: string;
};

export type LogoutUserResult = ApiResponse<Record<string, unknown>>;
