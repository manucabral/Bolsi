import { getBolsiApi } from "./pywebview";
import type { GetAppVersionResult } from "./app.api.types";

export async function getAppVersion(): Promise<GetAppVersionResult> {
  const api = await getBolsiApi();
  return api.app_version();
}
