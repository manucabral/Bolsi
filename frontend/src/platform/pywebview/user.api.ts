import { getBolsiApi } from "./pywebview";
import type {
  CurrentSessionResult,
  LoginUserResult,
  RegisterUserResult,
  LogoutUserResult,
} from "./user.api.types";

export async function getCurrentUserSession(): Promise<CurrentSessionResult> {
  const api = await getBolsiApi();
  return api.user_current_session();
}

export async function loginUser(
  username: string,
  password: string,
): Promise<LoginUserResult> {
  const api = await getBolsiApi();
  return api.user_login(username, password);
}

export async function registerUser(
  username: string,
  email: string,
  password: string,
): Promise<RegisterUserResult> {
  const api = await getBolsiApi();
  return api.register_user(username, email, password);
}

export async function logoutUser(
  accessToken?: string,
): Promise<LogoutUserResult> {
  const api = await getBolsiApi();
  return api.user_logout(accessToken);
}
