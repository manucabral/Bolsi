import type { ApiResponse } from "./user.api.types";

export type GetAppVersionResult = ApiResponse<{
  version?: string;
  [key: string]: unknown;
}> & {
  version?: string;
};
